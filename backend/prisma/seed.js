require("dotenv/config");
const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  const staffHash = await bcrypt.hash("staff123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@123.com" },
    update: {
     

    },
    create: {
      email: "admin@123.com",
      password: adminHash,
      name: "admin",
      role: "ADMIN",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@123.com" },
    update: { post: "Store Manager" },
    create: {
      email: "staff@123.com",
      password: staffHash,
      name: "rohit",
      post: "Store Manager",
      role: "STAFF",
    },
  });

  const products = [
    { name: "Wire Cut Brick", sellingPrice: 10, gstPercent: 5, hsnCode: "69041000", sku: "WCB-001", unitType: "PCS" },
    { name: "Fly Ash Brick", sellingPrice: 8, gstPercent: 5, hsnCode: "69041000", sku: "FAB-001", unitType: "PCS" },
    { name: "Red Clay Brick", sellingPrice: 7, gstPercent: 5, hsnCode: "69041000", sku: "RCB-001", unitType: "PCS" },
    
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
      create: {
        ...p,
        status: "APPROVED",
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    });
  }

  const materials = [
    { name: "Cement", category: "BINDING", unit: "BAGS", quantity: 500, unitPrice: 380, reorderLevel: 100, supplierName: "UltraTech Suppliers" },
    { name: "Sand", category: "AGGREGATE", unit: "TONS", quantity: 20, unitPrice: 1200, reorderLevel: 5, supplierName: "River Sand Co." },
    { name: "Fly Ash", category: "ADDITIVE", unit: "TONS", quantity: 15, unitPrice: 800, reorderLevel: 3, supplierName: "Thermal Plant Ash" },
    { name: "Coal", category: "FUEL", unit: "TONS", quantity: 8, unitPrice: 9500, reorderLevel: 2, supplierName: "Local Fuel Depot" },
    { name: "Water", category: "OTHER", unit: "LITRES", quantity: 5000, unitPrice: 0.05, reorderLevel: 500, supplierName: null },
  ];

  for (const m of materials) {
    await prisma.rawMaterial.upsert({
      where: { name: m.name },
      update: {
        quantity: m.quantity,
        reorderLevel: m.reorderLevel,
        unitPrice: m.unitPrice,
        category: m.category,
        unit: m.unit,
        supplierName: m.supplierName,
      },
      create: m,
    });
  }

  // Normalize legacy unit strings from older schema
  const legacy = await prisma.rawMaterial.findMany();
  const unitMap = { bags: "BAGS", tons: "TONS", kg: "KG" };
  for (const row of legacy) {
    const mapped = unitMap[String(row.unit).toLowerCase()];
    if (mapped && mapped !== row.unit) {
      await prisma.rawMaterial.update({ where: { id: row.id }, data: { unit: mapped } });
    }
    if (row.unitPrice === 0 && row.name === "Cement") {
      await prisma.rawMaterial.update({
        where: { id: row.id },
        data: { unitPrice: 380, category: "BINDING" },
      });
    }
  }

  

  const today = new Date();
  today.setHours(8, 0, 0, 0);

  await prisma.sale.createMany({
    data: [
      { amount: 85000, saleDate: today },
      { amount: 42000, saleDate: today },
    ],
    skipDuplicates: true,
  });

  await prisma.expense.createMany({
    data: [
      { amount: 15000, expenseDate: today, description: "Fuel & transport" },
      { amount: 8000, expenseDate: today, description: "Labour wages advance" },
    ],
    skipDuplicates: true,
  });

  
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
