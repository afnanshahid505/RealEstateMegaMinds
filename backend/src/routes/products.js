const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    if (req.user.role === "STAFF") where.status = "APPROVED";

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, sellingPrice, gstPercent, hsnCode, sku, unitType } = req.body;
    if (!name || sellingPrice == null || gstPercent == null || !hsnCode || !sku || !unitType) {
      return res.status(400).json({ error: "All product fields are required" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        sellingPrice,
        gstPercent,
        hsnCode,
        sku,
        unitType,
        status: "PENDING",
        createdById: req.user.id,
      },
    });
    res.status(201).json(product);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.patch("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        approvedById: req.user.id,
        approvedAt: new Date(),
      },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve product" });
  }
});

router.patch("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: "REJECTED", approvedById: req.user.id, approvedAt: new Date() },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject product" });
  }
});

module.exports = router;
