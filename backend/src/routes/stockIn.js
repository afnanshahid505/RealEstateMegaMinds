const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireStaffOrAdmin);

router.get("/", async (req, res) => {
  try {
    const { fromDate, toDate, productId, source } = req.query;
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
    if (source) {
      const validSources = ["PRODUCTION", "PURCHASE", "TRANSFER", "ADJUSTMENT"];
      if (!validSources.includes(source)) {
        return res.status(400).json({ error: "Invalid source type" });
      }
      where.source = source;
    }

    const records = await prisma.stockIn.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        product: true,
        production: true,
        enteredBy: { select: { name: true } },
      },
    });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stock in records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, productId, quantity, source, referenceNumber, note, enteredById } = req.body;

    if (!date || !productId || !quantity || !source || !referenceNumber) {
      return res.status(400).json({ error: "All stock in fields are required" });
    }

    const validSources = ["PRODUCTION", "PURCHASE", "TRANSFER", "ADJUSTMENT"];
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: "Invalid source type" });
    }

    if (source === "PRODUCTION") {
      return res.status(400).json({
        error: "Production stock is created automatically when production is saved",
      });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== "APPROVED") {
      return res.status(400).json({ error: "Product must be approved" });
    }

    const record = await prisma.$transaction(async (tx) => {
      const stockIn = await tx.stockIn.create({
        data: {
          date: req.user.role === "STAFF" ? new Date() : new Date(date),
          productId,
          quantity,
          source,
          referenceNumber,
          note: note || null,
          enteredById: enteredById || req.user.id,
        },
        include: { product: true, enteredBy: { select: { name: true } } },
      });

      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: quantity } },
      });

      return stockIn;
    });

    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create stock in" });
  }
});

module.exports = router;
