const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { status, name, hsn, activeStatus } = req.query;
    const where = {};
    if (status === "ACTIVE") where.isActive = true;
    else if (status === "INACTIVE") where.isActive = false;
    else if (status) where.status = status;
    if (activeStatus === "ACTIVE") where.isActive = true;
    if (activeStatus === "INACTIVE") where.isActive = false;
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (hsn) where.hsnCode = { contains: hsn, mode: "insensitive" };
    if (req.user.role === "STAFF") {
      where.status = "APPROVED";
      where.isActive = true;
    }

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
    const { name, description, sellingPrice, gstPercent, hsnCode, sku, unitType, isActive } = req.body;
    if (!name || sellingPrice == null || gstPercent == null || !hsnCode || !sku || !unitType) {
      return res.status(400).json({ error: "All product fields are required" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        sellingPrice,
        gstPercent,
        hsnCode,
        sku,
        unitType,
        isActive: isActive ?? true,
        status: "APPROVED",
        approvedById: req.user.id,
        approvedAt: new Date(),
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

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { sellingPrice, gstPercent, description, isActive } = req.body;
    const data = {};
    if (sellingPrice != null) data.sellingPrice = sellingPrice;
    if (gstPercent != null) data.gstPercent = gstPercent;
    if (description !== undefined) data.description = description || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });
    res.json(product);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Product cannot be deleted because it is used in production, stock, sales, or invoice records" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
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
