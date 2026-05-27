const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireStaffOrAdmin);

const REASONS = ["SALE", "DAMAGE", "SAMPLE", "TRANSFER", "ADJUSTMENT"];

function buildWhere(query) {
  const { fromDate, toDate, productId, reason } = query;
  const where = {};

  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.date.lte = endDate;
    }
  }

  if (productId) where.productId = productId;
  if (reason) where.reason = reason;
  return where;
}

router.get("/", async (req, res) => {
  try {
    const stockOuts = await prisma.stockOut.findMany({
      where: buildWhere(req.query),
      orderBy: { date: "desc" },
      include: {
        product: true,
        invoice: { select: { invoiceNumber: true } },
        enteredBy: { select: { name: true } },
      },
    });
    res.json(stockOuts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stock out records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, productId, quantity, reason, referenceNumber, note } = req.body;
    if (!date || !productId || !quantity || !reason) {
      return res.status(400).json({ error: "Date, product, quantity, and reason are required" });
    }
    if (!REASONS.includes(reason)) return res.status(400).json({ error: "Invalid stock out reason" });
    if (reason === "SALE") return res.status(400).json({ error: "Sale stock out is created automatically from invoices" });
    if (Number(quantity) <= 0) return res.status(400).json({ error: "Quantity must be greater than zero" });

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || product.status !== "APPROVED") throw new Error("Product must be approved");
      if (Number(product.stockQty) < Number(quantity)) throw new Error(`Insufficient stock for ${product.name}`);

      const stockOut = await tx.stockOut.create({
        data: {
          date: new Date(date),
          productId,
          quantity,
          reason,
          referenceNumber: referenceNumber || null,
          note: note || null,
          enteredById: req.user.id,
        },
        include: { product: true, enteredBy: { select: { name: true } } },
      });

      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { decrement: quantity } },
      });

      return stockOut;
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.message?.includes("Insufficient") || err.message?.includes("approved")) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create stock out" });
  }
});

module.exports = router;
