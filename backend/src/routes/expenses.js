const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

const CATEGORIES = ["RAW_MATERIAL", "LABOUR", "TRANSPORT", "FUEL", "MAINTENANCE", "RENT", "UTILITIES", "SALARY", "OTHER"];

function buildWhere(query) {
  const { fromDate, toDate, category } = query;
  const where = {};

  if (fromDate || toDate) {
    where.expenseDate = {};
    if (fromDate) where.expenseDate.gte = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.expenseDate.lte = endDate;
    }
  }

  if (category) where.category = category;
  return where;
}

router.get("/", async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: buildWhere(req.query),
      orderBy: { expenseDate: "desc" },
      include: { enteredBy: { select: { name: true } } },
    });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { expenseDate, category, amount, description, note } = req.body;
    if (!expenseDate || !category || amount == null || !description) {
      return res.status(400).json({ error: "Date, category, amount, and description are required" });
    }
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid expense category" });
    if (Number(amount) <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });

    const expense = await prisma.expense.create({
      data: {
        expenseDate: new Date(expenseDate),
        category,
        amount,
        description,
        note: note || null,
        enteredById: req.user.id,
      },
      include: { enteredBy: { select: { name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { expenseDate, category, amount, description, note } = req.body;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid expense category" });
    if (amount != null && Number(amount) <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });

    const data = {};
    if (expenseDate != null) data.expenseDate = new Date(expenseDate);
    if (category != null) data.category = category;
    if (amount != null) data.amount = amount;
    if (description != null) data.description = description;
    if (note !== undefined) data.note = note || null;

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data,
      include: { enteredBy: { select: { name: true } } },
    });
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

module.exports = router;
