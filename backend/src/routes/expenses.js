const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

const CATEGORIES = [
  "LABOUR",
  "FUEL",
  "ELECTRICITY",
  "TRANSPORT",
  "MAINTENANCE",
  "RENT",
  "RAW_MATERIAL_PURCHASE",
  "MISCELLANEOUS",
  "RAW_MATERIAL",
  "UTILITIES",
  "SALARY",
  "OTHER",
];
const PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"];
const uploadDir = path.join(__dirname, "..", "uploads", "expenses");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/jpg", "application/pdf"].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Attachment must be a JPG or PDF file"));
  },
});

function attachmentUrl(req, expense) {
  if (!expense.attachmentPath) return null;
  return `${req.protocol}://${req.get("host")}/${expense.attachmentPath.replaceAll("\\", "/")}`;
}

function serializeExpense(req, expense) {
  return {
    ...expense,
    attachmentUrl: attachmentUrl(req, expense),
  };
}

function deleteAttachment(expense) {
  if (!expense?.attachmentPath) return;
  const relative = expense.attachmentPath.replace(/^uploads[\\/]/, "");
  const target = path.join(__dirname, "..", "uploads", relative);
  if (target.startsWith(path.join(__dirname, "..", "uploads")) && fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

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

function expenseData(body, file) {
  const {
    expenseDate,
    category,
    amount,
    paymentMode,
    paidTo,
    billRef,
    description,
    note,
  } = body;

  const data = {};
  if (expenseDate != null) data.expenseDate = new Date(expenseDate);
  if (category != null) data.category = category;
  if (amount != null) data.amount = Number(amount);
  if (paymentMode != null) data.paymentMode = paymentMode;
  if (paidTo !== undefined) data.paidTo = paidTo || null;
  if (billRef !== undefined) data.billRef = billRef || null;
  if (description !== undefined) data.description = description || null;
  if (note !== undefined) data.note = note || null;
  if (file) {
    data.attachmentPath = `uploads/expenses/${file.filename}`;
    data.attachmentOriginalName = file.originalname;
    data.attachmentMimeType = file.mimetype;
  }
  return data;
}

router.get("/", async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: buildWhere(req.query),
      orderBy: { expenseDate: "desc" },
      include: { enteredBy: { select: { name: true } } },
    });
    res.json(expenses.map((expense) => serializeExpense(req, expense)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const { expenseDate, category, amount, paymentMode } = req.body;
    if (!expenseDate || !category || amount == null || !paymentMode) {
      return res.status(400).json({ error: "Date, category, amount, and payment mode are required" });
    }
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid expense category" });
    if (!PAYMENT_MODES.includes(paymentMode)) return res.status(400).json({ error: "Invalid payment mode" });
    if (Number(amount) <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });

    const expense = await prisma.expense.create({
      data: {
        ...expenseData(req.body, req.file),
        enteredById: req.user.id,
      },
      include: { enteredBy: { select: { name: true } } },
    });
    res.status(201).json(serializeExpense(req, expense));
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create expense" });
  }
});

router.patch("/:id", upload.single("attachment"), async (req, res) => {
  try {
    const { category, amount, paymentMode } = req.body;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid expense category" });
    if (paymentMode && !PAYMENT_MODES.includes(paymentMode)) return res.status(400).json({ error: "Invalid payment mode" });
    if (amount != null && Number(amount) <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });

    const current = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Expense not found" });

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: expenseData(req.body, req.file),
      include: { enteredBy: { select: { name: true } } },
    });
    if (req.file) deleteAttachment(current);
    res.json(serializeExpense(req, expense));
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to update expense" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const expense = await prisma.expense.delete({ where: { id: req.params.id } });
    deleteAttachment(expense);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message?.includes("Attachment")) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: "Failed to process expense attachment" });
});

module.exports = router;
