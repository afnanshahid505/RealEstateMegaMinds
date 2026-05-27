const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "brick-factory-dev-secret-change-in-production";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireStaffOrAdmin(req, res, next) {
  if (!["ADMIN", "STAFF"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireStaffOrAdmin, JWT_SECRET };
