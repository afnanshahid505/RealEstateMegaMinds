const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireStaffOrAdmin } = require("../middleware/auth");
const { validateMaterialInput, normalizeUnit } = require("../lib/rawMaterialConstants");

const router = express.Router();

router.use(authenticate, requireStaffOrAdmin);

function enrichMaterial(m) {
  const qty = Number(m.quantity);
  const price = Number(m.unitPrice);
  const reorder = Number(m.reorderLevel);
  return {
    ...m,
    totalValue: qty * price,
    isLowStock: reorder > 0 && qty <= reorder,
  };
}

async function getMovementHistory(rawMaterialId) {
  const [purchases, consumptions] = await Promise.all([
    prisma.rawMaterialPurchase.findMany({
      where: { rawMaterialId },
      orderBy: { purchaseDate: "desc" },
      include: { enteredBy: { select: { name: true } } },
    }),
    prisma.productionMaterialUsage.findMany({
      where: { rawMaterialId },
      orderBy: { production: { date: "desc" } },
      include: {
        production: {
          select: {
            id: true,
            date: true,
            batchReference: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const movements = [
    ...purchases.map((p) => ({
      id: p.id,
      type: "PURCHASE",
      date: p.purchaseDate,
      quantity: Number(p.quantity),
      unitPrice: Number(p.unitPrice),
      totalCost: Number(p.quantity) * Number(p.unitPrice),
      reference: p.invoiceRef || "—",
      supplier: p.supplier || "—",
      note: p.note,
      enteredBy: p.enteredBy?.name,
      productionBatch: null,
      productName: null,
    })),
    ...consumptions.map((c) => ({
      id: c.id,
      type: "CONSUMPTION",
      date: c.production.date,
      quantity: -Number(c.quantityUsed),
      unitPrice: null,
      totalCost: null,
      reference: c.production.batchReference,
      supplier: null,
      note: `Production: ${c.production.product?.name || "—"}`,
      enteredBy: null,
      productionBatch: c.production.batchReference,
      productName: c.production.product?.name,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return movements;
}

// 5.2 View all materials
router.get("/", async (req, res) => {
  try {
    const materials = await prisma.rawMaterial.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { purchases: true, materialUsages: true } },
      },
    });
    res.json(materials.map(enrichMaterial));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch raw materials" });
  }
});

// 5.1 Onboard / add material
router.post("/", async (req, res) => {
  try {
    const {
      name,
      category,
      unit,
      quantity,
      unitPrice,
      supplierName,
      reorderLevel,
      purchaseDate,
      invoiceRef,
      note,
    } = req.body;

    if (!name || !category || !unit || quantity == null || unitPrice == null) {
      return res.status(400).json({
        error: "Material name, category, unit, current stock, and unit price are required",
      });
    }

    const validationErrors = validateMaterialInput(req.body, { requireAll: true });
    if (validationErrors.length) {
      return res.status(400).json({ error: validationErrors.join(", ") });
    }

    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.rawMaterial.create({
        data: {
          name: name.trim(),
          category,
          unit,
          quantity,
          unitPrice,
          supplierName: supplierName || null,
          reorderLevel: reorderLevel ?? 0,
          note: note || null,
        },
      });

      let purchase = null;
      if (purchaseDate) {
        purchase = await tx.rawMaterialPurchase.create({
          data: {
            rawMaterialId: material.id,
            quantity,
            unitPrice,
            supplier: supplierName || null,
            purchaseDate: new Date(purchaseDate),
            invoiceRef: invoiceRef || null,
            note: note || null,
            enteredById: req.user.id,
          },
        });
      }

      return { material: enrichMaterial(material), purchase };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A material with this name already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to add material" });
  }
});

router.get("/purchases", async (req, res) => {
  try {
    const purchases = await prisma.rawMaterialPurchase.findMany({
      orderBy: { purchaseDate: "desc" },
      include: {
        rawMaterial: true,
        enteredBy: { select: { name: true } },
      },
      take: 200,
    });
    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

// Single material + movement history
router.get("/:id", async (req, res) => {
  try {
    const material = await prisma.rawMaterial.findUnique({
      where: { id: req.params.id },
      include: {
        purchases: { orderBy: { purchaseDate: "desc" }, take: 20 },
        _count: { select: { purchases: true, materialUsages: true } },
      },
    });
    if (!material) return res.status(404).json({ error: "Material not found" });

    const movements = await getMovementHistory(material.id);
    res.json({ ...enrichMaterial(material), movements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch material" });
  }
});

router.get("/:id/movements", async (req, res) => {
  try {
    const material = await prisma.rawMaterial.findUnique({ where: { id: req.params.id } });
    if (!material) return res.status(404).json({ error: "Material not found" });
    const movements = await getMovementHistory(req.params.id);
    res.json(movements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch movement history" });
  }
});

// 5.3 Edit material details / stock / price
router.patch("/:id", async (req, res) => {
  try {
    const {
      name,
      category,
      unit,
      quantity,
      unitPrice,
      supplierName,
      reorderLevel,
      note,
    } = req.body;

    const validationErrors = validateMaterialInput(req.body);
    if (validationErrors.length) {
      return res.status(400).json({ error: validationErrors.join(", ") });
    }

    const data = {};
    if (name != null) data.name = name.trim();
    if (category != null) data.category = category;
    if (unit != null) data.unit = normalizeUnit(unit);
    if (quantity != null) data.quantity = quantity;
    if (unitPrice != null) data.unitPrice = unitPrice;
    if (supplierName !== undefined) data.supplierName = supplierName || null;
    if (reorderLevel != null) data.reorderLevel = reorderLevel;
    if (note !== undefined) data.note = note || null;

    const material = await prisma.rawMaterial.update({
      where: { id: req.params.id },
      data,
    });
    res.json(enrichMaterial(material));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Material name already in use" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update material" });
  }
});

// 5.3 Log additional purchase
router.post("/:id/purchases", async (req, res) => {
  try {
    const { quantity, unitPrice, supplier, purchaseDate, invoiceRef, note } = req.body;

    if (!quantity || unitPrice == null || !purchaseDate) {
      return res.status(400).json({ error: "Quantity, unit price, and purchase date are required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          rawMaterialId: req.params.id,
          quantity,
          unitPrice,
          supplier: supplier || null,
          purchaseDate: new Date(purchaseDate),
          invoiceRef: invoiceRef || null,
          note: note || null,
          enteredById: req.user.id,
        },
      });

      const material = await tx.rawMaterial.update({
        where: { id: req.params.id },
        data: {
          quantity: { increment: quantity },
          unitPrice,
          ...(supplier ? { supplierName: supplier } : {}),
        },
      });

      return { material: enrichMaterial(material), purchase };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record purchase" });
  }
});

// Legacy: purchase by material name (kept for compatibility)
router.post("/purchase", async (req, res) => {
  try {
    const {
      materialName,
      category,
      unit,
      quantity,
      unitPrice,
      supplier,
      reorderLevel,
      purchaseDate,
      invoiceRef,
      note,
    } = req.body;

    if (!materialName || !quantity || unitPrice == null || !purchaseDate) {
      return res.status(400).json({ error: "Required purchase fields missing" });
    }

    let material = await prisma.rawMaterial.findUnique({
      where: { name: materialName.trim() },
    });

    if (!material) {
      if (!category || !unit) {
        return res.status(400).json({
          error: "New materials require category and unit of measure",
        });
      }
      const unitNorm = normalizeUnit(unit);
      if (!unitNorm) return res.status(400).json({ error: "Invalid unit of measure" });
      const created = await prisma.rawMaterial.create({
        data: {
          name: materialName.trim(),
          category,
          unit: unitNorm,
          quantity: 0,
          unitPrice,
          supplierName: supplier || null,
          reorderLevel: reorderLevel ?? 0,
          note: note || null,
        },
      });
      material = created;
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          rawMaterialId: material.id,
          quantity,
          unitPrice,
          supplier: supplier || null,
          purchaseDate: new Date(purchaseDate),
          invoiceRef: invoiceRef || null,
          note: note || null,
          enteredById: req.user.id,
        },
      });

      const updated = await tx.rawMaterial.update({
        where: { id: material.id },
        data: {
          quantity: { increment: quantity },
          unitPrice,
          ...(reorderLevel != null ? { reorderLevel } : {}),
          ...(supplier ? { supplierName: supplier } : {}),
          ...(unit ? { unit: normalizeUnit(unit) || material.unit } : {}),
          ...(category ? { category } : {}),
        },
      });

      return { material: enrichMaterial(updated), purchase };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record purchase" });
  }
});

module.exports = router;
