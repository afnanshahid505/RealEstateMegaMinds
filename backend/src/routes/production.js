const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireStaffOrAdmin);

router.get("/", async (req, res) => {
  try {
    const { fromDate, toDate, productId } = req.query;
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

    const productions = await prisma.production.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        product: true,
        materialUsages: { include: { rawMaterial: true } },
        stockIn: true,
        enteredBy: { select: { name: true } },
      },
    });
    res.json(productions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch production records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      date,
      productId,
      quantityProduced,
      workerCount,
      batchReference,
      materialUsages,
    } = req.body;

    if (!date || !productId || !quantityProduced || !workerCount || !batchReference) {
      return res.status(400).json({ error: "Required production fields missing" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== "APPROVED") {
      return res.status(400).json({ error: "Product must be approved before production" });
    }

    const usages = Array.isArray(materialUsages) ? materialUsages : [];
    if (usages.length === 0) {
      return res.status(400).json({ error: "At least one raw material usage is required (e.g. cement)" });
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const usage of usages) {
        const mat = await tx.rawMaterial.findUnique({ where: { id: usage.rawMaterialId } });
        if (!mat) throw new Error(`Raw material not found: ${usage.rawMaterialId}`);
        if (Number(mat.quantity) < Number(usage.quantityUsed)) {
          throw new Error(`Insufficient stock for ${mat.name}`);
        }
      }

      const production = await tx.production.create({
        data: {
          date: new Date(date),
          productId,
          quantityProduced,
          workerCount: parseInt(workerCount, 10),
          batchReference,
          enteredById: req.user.id,
          materialUsages: {
            create: usages.map((u) => ({
              rawMaterialId: u.rawMaterialId,
              quantityUsed: u.quantityUsed,
            })),
          },
        },
        include: { materialUsages: { include: { rawMaterial: true } } },
      });

      for (const usage of usages) {
        await tx.rawMaterial.update({
          where: { id: usage.rawMaterialId },
          data: { quantity: { decrement: usage.quantityUsed } },
        });
      }

      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: quantityProduced } },
      });

      const stockIn = await tx.stockIn.create({
        data: {
          date: new Date(date),
          productId,
          quantity: quantityProduced,
          source: "PRODUCTION",
          referenceNumber: batchReference,
          productionId: production.id,
          enteredById: req.user.id,
        },
      });

      return { production, stockIn };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.message?.includes("Insufficient") || err.message?.includes("not found")) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to save production" });
  }
});

module.exports = router;
