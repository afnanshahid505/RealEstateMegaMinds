const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

const VALID_CUSTOMER_TYPES = ["RETAIL", "RETAILER", "WHOLESALE", "CONTRACTOR", "GOVERNMENT", "OTHER"];
const PHONE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function normalizeCustomerType(type) {
  if (type === "RETAILER") return "RETAIL";
  return type;
}

function validateCustomer(body) {
  const errors = [];
  if (!body.companyName?.trim()) errors.push("Full name / company name is required");
  if (!PHONE_RE.test(String(body.phone || ""))) errors.push("Phone number must be a valid 10-digit mobile number");
  if (!body.address?.trim()) errors.push("Billing address is required");
  if (!VALID_CUSTOMER_TYPES.includes(body.customerType)) errors.push("Invalid customer type");
  if (body.gstin && !GSTIN_RE.test(String(body.gstin).toUpperCase())) errors.push("GSTIN must be a valid 15-character GST number");
  if (body.panNumber && !PAN_RE.test(String(body.panNumber).toUpperCase())) errors.push("PAN must be a valid 10-character PAN");
  return errors;
}

router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { gstin: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        invoices: { orderBy: { invoiceDate: "desc" }, take: 10, include: { items: true } },
        _count: { select: { invoices: true, sales: true } },
      },
    });

    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.post("/", async (req, res) => {
  try {
    const errors = validateCustomer(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(", ") });

    const {
      companyName,
      phone,
      email,
      gstin,
      panNumber,
      address,
      shippingAddress,
      customerType,
      creditLimit,
      notes,
    } = req.body;

    const customer = await prisma.customer.create({
      data: {
        companyName: companyName.trim(),
        phone: phone.trim(),
        email: email || null,
        gstin: gstin ? gstin.toUpperCase() : null,
        panNumber: panNumber ? panNumber.toUpperCase() : null,
        address: address.trim(),
        shippingAddress: shippingAddress || null,
        customerType: normalizeCustomerType(customerType),
        creditLimit: creditLimit ?? 0,
        notes: notes || null,
        createdById: req.user.id,
      },
      include: {
        invoices: { orderBy: { invoiceDate: "desc" }, take: 10, include: { items: true } },
        _count: { select: { invoices: true, sales: true } },
      },
    });

    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: {
          orderBy: { invoiceDate: "desc" },
          include: { items: { include: { product: true } } },
        },
        sales: { orderBy: { saleDate: "desc" } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

module.exports = router;
