const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/prismaClient");
const adminAuth = require("../middleware/adminAuth");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

const adminSelect = {
  id: true,
  name: true,
  username: true,
  createdAt: true,
};

router.post("/register", async (req, res) => {
  const { name, username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: { name, username, password: hashedPassword },
      select: adminSelect,
    });
    res.json(admin);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      const token = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
        },
        JWT_SECRET,
        { expiresIn: "1y" }
      );

      res.json({ message: "Login successful", token });
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/me", adminAuth, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: adminSelect,
    });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/me", adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (name === undefined) {
      return res.status(400).json({ error: "Name is required" });
    }

    const admin = await prisma.admin.update({
      where: { id: req.user.id },
      data: { name: name?.trim() || null },
      select: adminSelect,
    });
    res.json(admin);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/password", adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
