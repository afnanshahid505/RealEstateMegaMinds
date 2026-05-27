const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

function dateRange(query) {
  const to = query.toDate ? new Date(query.toDate) : new Date();
  to.setHours(23, 59, 59, 999);

  const from = query.fromDate ? new Date(query.fromDate) : new Date(to);
  if (!query.fromDate) from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);

  return { from, to };
}

function previousRange(from, to) {
  const days = Math.max(1, Math.ceil((to - from) / 86400000) + 1);
  const previousTo = new Date(from);
  previousTo.setDate(previousTo.getDate() - 1);
  previousTo.setHours(23, 59, 59, 999);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - days + 1);
  previousFrom.setHours(0, 0, 0, 0);
  return { previousFrom, previousTo };
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function round(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function summarizeProductions(productions) {
  const grouped = new Map();

  productions.forEach((entry) => {
    const key = `${dateKey(entry.date)}|${entry.productId}`;
    const row = grouped.get(key) || {
      date: dateKey(entry.date),
      productId: entry.productId,
      productName: entry.product?.name || "Unknown",
      totalBricks: 0,
      cementBags: 0,
      otherMaterials: new Map(),
    };

    row.totalBricks += Number(entry.quantityProduced);
    entry.materialUsages?.forEach((usage) => {
      const name = usage.rawMaterial?.name || "Unknown";
      const unit = usage.rawMaterial?.unit || "";
      const qty = Number(usage.quantityUsed);
      if (name.toLowerCase().includes("cement")) {
        row.cementBags += qty;
        return;
      }
      const material = row.otherMaterials.get(name) || { name, unit, quantity: 0 };
      material.quantity += qty;
      row.otherMaterials.set(name, material);
    });

    grouped.set(key, row);
  });

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      avgBagsPer1000: row.totalBricks > 0 ? round(row.cementBags / (row.totalBricks / 1000)) : 0,
      avgBricksPerBag: row.cementBags > 0 ? round(row.totalBricks / row.cementBags) : 0,
      otherMaterials: [...row.otherMaterials.values()].map((m) => ({
        ...m,
        quantity: round(m.quantity),
      })),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || a.productName.localeCompare(b.productName));
}

function productionTotals(rows) {
  const totalBricks = round(rows.reduce((sum, row) => sum + row.totalBricks, 0));
  const totalBags = round(rows.reduce((sum, row) => sum + row.cementBags, 0));
  return {
    totalBricks,
    totalBags,
    overallBagsPer1000: totalBricks > 0 ? round(totalBags / (totalBricks / 1000)) : 0,
    overallBricksPerBag: totalBags > 0 ? round(totalBricks / totalBags) : 0,
  };
}

router.get("/production", requireStaffOrAdmin, async (req, res) => {
  try {
    const { from, to } = dateRange(req.query);
    const { previousFrom, previousTo } = previousRange(from, to);
    const where = { date: { gte: from, lte: to } };
    const previousWhere = { date: { gte: previousFrom, lte: previousTo } };

    if (req.query.productId) {
      where.productId = req.query.productId;
      previousWhere.productId = req.query.productId;
    }

    const [productions, previousProductions] = await Promise.all([
      prisma.production.findMany({
        where,
        orderBy: { date: "desc" },
        include: {
          product: true,
          materialUsages: { include: { rawMaterial: true } },
        },
      }),
      prisma.production.findMany({
        where: previousWhere,
        include: {
          product: true,
          materialUsages: { include: { rawMaterial: true } },
        },
      }),
    ]);

    const rows = summarizeProductions(productions);
    const previousRows = summarizeProductions(previousProductions);
    const totals = productionTotals(rows);
    const previousTotals = productionTotals(previousRows);

    res.json({
      filters: { fromDate: dateKey(from), toDate: dateKey(to), productId: req.query.productId || "" },
      rows,
      totals,
      previousTotals,
      comparison: {
        bricksChange: totals.totalBricks - previousTotals.totalBricks,
        bagsChange: round(totals.totalBags - previousTotals.totalBags),
        efficiencyChange: round(totals.overallBagsPer1000 - previousTotals.overallBagsPer1000),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build production report" });
  }
});

router.get("/accounts", requireAdmin, async (req, res) => {
  try {
    const { from, to } = dateRange(req.query);
    const invoiceWhere = { invoiceDate: { gte: from, lte: to } };
    const expenseWhere = { expenseDate: { gte: from, lte: to } };

    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        include: { customer: true },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: { expenseDate: "desc" },
      }),
    ]);

    const totalSales = round(invoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0));
    const totalCollections = round(invoices.reduce((sum, invoice) => {
      const grandTotal = Number(invoice.grandTotal);
      const advancePaid = Number(invoice.advancePaid);
      if (invoice.paymentType === "CREDIT") return sum + advancePaid;
      return sum + (advancePaid > 0 ? advancePaid : grandTotal);
    }, 0));
    const outstanding = round(invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0));
    const totalExpenses = round(expenses.reduce((sum, expense) => sum + Number(expense.amount), 0));
    const gstPayable = round(invoices.reduce((sum, invoice) => sum + Number(invoice.totalGst), 0));
    const grossProfit = round(totalSales - totalExpenses);
    const netProfitAfterGst = round(grossProfit - gstPayable);

    const expenseBreakdown = new Map();
    expenses.forEach((expense) => {
      expenseBreakdown.set(expense.category, round((expenseBreakdown.get(expense.category) || 0) + Number(expense.amount)));
    });

    const customerRevenue = new Map();
    invoices.forEach((invoice) => {
      const name = invoice.customer?.companyName || "Unknown";
      const row = customerRevenue.get(invoice.customerId) || { customerId: invoice.customerId, customerName: name, revenue: 0, invoiceCount: 0 };
      row.revenue = round(row.revenue + Number(invoice.grandTotal));
      row.invoiceCount += 1;
      customerRevenue.set(invoice.customerId, row);
    });

    res.json({
      filters: { fromDate: dateKey(from), toDate: dateKey(to) },
      totals: {
        totalSales,
        totalCollections,
        outstanding,
        totalExpenses,
        gstPayable,
        grossProfit,
        netProfitAfterGst,
      },
      expenseBreakdown: [...expenseBreakdown.entries()].map(([category, total]) => ({ category, total })),
      topCustomers: [...customerRevenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      invoices,
      expenses,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to build account report" });
  }
});

module.exports = router;
