const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireAdmin);

const PAYMENT_TYPES = ["CASH", "CREDIT", "UPI", "BANK_TRANSFER", "CHEQUE"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function numberToWordsIndian(amount) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function belowHundred(n) {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  }

  function belowThousand(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return `${hundred ? `${ones[hundred]} Hundred` : ""}${hundred && rest ? " " : ""}${rest ? belowHundred(rest) : ""}`;
  }

  const rupees = Math.floor(Number(amount));
  if (rupees === 0) return "Rupees Zero Only";

  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));

  return `Rupees ${parts.join(" ")} Only`;
}

async function nextInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const latest = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    orderBy: { invoiceNumber: "desc" },
  });
  const next = latest ? Number(latest.invoiceNumber.split("-").at(-1)) + 1 : 1;
  return `INV-${year}-${String(next).padStart(4, "0")}`;
}

function extractState(address) {
  const text = String(address || "").toLowerCase();
  return INDIAN_STATES.find((state) => text.includes(state.toLowerCase())) || "";
}

function calculateInvoice(items, billingState, placeOfSupply) {
  const gstType = billingState === placeOfSupply ? "CGST_SGST" : "IGST";
  const computedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const discount = Number(item.discount || 0);
    const gstPercent = Number(item.gstPercent || 0);
    const gross = roundMoney(quantity * rate);
    const taxableAmount = roundMoney(gross - discount);
    const gstAmount = roundMoney((taxableAmount * gstPercent) / 100);
    const cgstAmount = gstType === "CGST_SGST" ? roundMoney(gstAmount / 2) : 0;
    const sgstAmount = gstType === "CGST_SGST" ? roundMoney(gstAmount / 2) : 0;
    const igstAmount = gstType === "IGST" ? gstAmount : 0;

    return {
      productId: item.productId,
      description: item.description,
      hsnCode: item.hsnCode || null,
      quantity,
      rate,
      discount,
      taxableAmount,
      gstPercent,
      cgstAmount,
      sgstAmount,
      igstAmount,
      lineTotal: roundMoney(taxableAmount + gstAmount),
    };
  });

  const subtotal = roundMoney(computedItems.reduce((sum, item) => sum + item.quantity * item.rate, 0));
  const totalDiscount = roundMoney(computedItems.reduce((sum, item) => sum + item.discount, 0));
  const cgstTotal = roundMoney(computedItems.reduce((sum, item) => sum + item.cgstAmount, 0));
  const sgstTotal = roundMoney(computedItems.reduce((sum, item) => sum + item.sgstAmount, 0));
  const igstTotal = roundMoney(computedItems.reduce((sum, item) => sum + item.igstAmount, 0));
  const totalGst = roundMoney(cgstTotal + sgstTotal + igstTotal);
  const grandTotal = roundMoney(subtotal + totalGst - totalDiscount);

  return { items: computedItems, subtotal, totalDiscount, cgstTotal, sgstTotal, igstTotal, totalGst, grandTotal, gstType };
}

router.get("/", async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { invoiceDate: "desc" },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/next-number", async (_req, res) => {
  try {
    const invoiceNumber = await prisma.$transaction((tx) => nextInvoiceNumber(tx));
    res.json({ invoiceNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate invoice number" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      paymentType,
      customerId,
      placeOfSupply,
      advancePaid,
      items,
    } = req.body;

    if (!invoiceDate || !paymentType || !customerId || !placeOfSupply) {
      return res.status(400).json({ error: "Invoice date, payment type, customer, and place of supply are required" });
    }
    if (!PAYMENT_TYPES.includes(paymentType)) return res.status(400).json({ error: "Invalid payment type" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "At least one invoice line item is required" });

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(400).json({ error: "Customer not found" });
    const billingState = extractState(customer.address);
    if (!billingState) {
      return res.status(400).json({
        error: "Billing address must include a valid Indian state for GST calculation",
      });
    }

    const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((product) => [product.id, product]));

    const normalizedItems = items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new Error("Invalid product in invoice item");
      return {
        productId: product.id,
        description: item.description || product.name,
        hsnCode: product.hsnCode,
        quantity: Number(item.quantity),
        rate: Number(item.rate ?? product.sellingPrice),
        discount: Number(item.discount || 0),
        gstPercent: Number(item.gstPercent ?? product.gstPercent),
      };
    });

    if (normalizedItems.some((item) => !item.quantity || item.quantity <= 0 || item.rate < 0 || item.discount < 0)) {
      return res.status(400).json({ error: "Invoice line quantities and amounts must be valid" });
    }

    const totals = calculateInvoice(normalizedItems, billingState, placeOfSupply);
    const paid = roundMoney(advancePaid || 0);
    const balanceDue = roundMoney(totals.grandTotal - paid);

    const result = await prisma.$transaction(async (tx) => {
      const finalInvoiceNumber = invoiceNumber?.trim() || (await nextInvoiceNumber(tx));

      for (const item of totals.items) {
        const product = productById.get(item.productId);
        if (Number(product.stockQty) < Number(item.quantity)) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: finalInvoiceNumber,
          invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          paymentType,
          customerId,
          placeOfSupply,
          subtotal: totals.subtotal,
          totalDiscount: totals.totalDiscount,
          cgstTotal: totals.cgstTotal,
          sgstTotal: totals.sgstTotal,
          igstTotal: totals.igstTotal,
          totalGst: totals.totalGst,
          grandTotal: totals.grandTotal,
          advancePaid: paid,
          balanceDue,
          amountInWords: numberToWordsIndian(totals.grandTotal),
          gstType: totals.gstType,
          createdById: req.user.id,
          items: { create: totals.items },
        },
        include: { customer: true, items: { include: { product: true } } },
      });

      for (const item of totals.items) {
        await tx.stockOut.create({
          data: {
            date: new Date(invoiceDate),
            productId: item.productId,
            quantity: item.quantity,
            reason: "SALE",
            referenceNumber: finalInvoiceNumber,
            note: "Auto-created from invoice",
            invoiceId: invoice.id,
            enteredById: req.user.id,
          },
        });
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.quantity } } });
      }

      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: { increment: totals.grandTotal },
          outstandingBalance: { increment: balanceDue },
        },
      });

      await tx.sale.create({
        data: {
          amount: totals.grandTotal,
          saleDate: new Date(invoiceDate),
          customerId,
        },
      });

      return invoice;
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Invoice number already exists" });
    if (err.message?.includes("Invalid product") || err.message?.includes("Insufficient stock")) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

module.exports = router;
