const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/stats", async (req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaySalesAgg,
      stockAgg,
      pendingPaymentsAgg,
      todayProductionAgg,
      todayExpensesAgg,
      monthSalesAgg,
      monthExpensesAgg,
      lowStockMaterials,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { saleDate: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.product.aggregate({
        where: { status: "APPROVED" },
        _sum: { stockQty: true },
      }),
      prisma.customer.aggregate({ _sum: { outstandingBalance: true } }),
      prisma.production.aggregate({
        where: { date: { gte: today, lt: tomorrow } },
        _sum: { quantityProduced: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      prisma.rawMaterial.findMany({
        where: {
          reorderLevel: { gt: 0 },
        },
        select: { id: true, name: true, quantity: true, reorderLevel: true, unit: true },
      }),
    ]);

    const alerts = lowStockMaterials.filter(
      (m) => Number(m.quantity) <= Number(m.reorderLevel)
    );

    const monthRevenue = Number(monthSalesAgg._sum.amount || 0);
    const monthExpenses = Number(monthExpensesAgg._sum.amount || 0);

    res.json({
      todaySales: Number(todaySalesAgg._sum.amount || 0),
      totalStock: Number(stockAgg._sum.stockQty || 0),
      pendingPayments: Number(pendingPaymentsAgg._sum.outstandingBalance || 0),
      productionToday: {
        quantity: Number(todayProductionAgg._sum.quantityProduced || 0),
        batches: todayProductionAgg._count,
      },
      expensesToday: Number(todayExpensesAgg._sum.amount || 0),
      profitSummary: {
        monthRevenue,
        monthExpenses,
        monthProfit: monthRevenue - monthExpenses,
      },
      lowStockAlerts: alerts,
      pendingProductApprovals: await prisma.product.count({ where: { status: "PENDING" } }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

module.exports = router;
