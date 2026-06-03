const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { authenticate, requireAdmin, requireStaffOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/recorders", requireStaffOrAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recorders" });
  }
});

router.get("/staff", requireAdmin, async (_req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: "STAFF" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, post: true, phone: true, email: true, role: true, createdAt: true },
    });
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff accounts" });
  }
});

router.post("/staff", requireAdmin, async (req, res) => {
  try {
    const { name, post, email, password } = req.body;
    if (!name || !post || !email || !password) {
      return res.status(400).json({ error: "Name, post, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        post: post.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: "STAFF",
      },
      select: { id: true, name: true, post: true, phone: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already exists" });
    console.error(err);
    res.status(500).json({ error: "Failed to create staff account" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, post: true, phone: true, email: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/me/phone", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone: phone.trim() },
      select: { id: true, name: true, post: true, phone: true, email: true, role: true },
    });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update phone number" });
  }
});

router.patch("/me/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

module.exports = router;
