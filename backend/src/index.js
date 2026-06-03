require("dotenv/config");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const productRoutes = require("./routes/products");
const rawMaterialRoutes = require("./routes/rawMaterials");
const productionRoutes = require("./routes/production");
const stockInRoutes = require("./routes/stockIn");
const customerRoutes = require("./routes/customers");
const invoiceRoutes = require("./routes/invoices");
const expenseRoutes = require("./routes/expenses");
const stockOutRoutes = require("./routes/stockOut");
const reportRoutes = require("./routes/reports");
const userRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/stock-in", stockInRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/stock-out", stockOutRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Brick Factory API running on http://localhost:${PORT}`);
});
