const express = require("express");
const bcrypt = require("bcryptjs");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");
const { parsePaging } = require("./paging");
const { syncMaxDevicesToUserCount } = require("../helper/syncMaxDevices");

const router = express.Router();

// The operator's own identity — everything that's Client-level (Plan,
// balance, sync settings) lives on their lab, not here.
const userSelect = {
  id: true,
  clientId: true,
  homeClientId: true,
  name: true,
  role: true,
  phone: true,
  username: true,
  device: true,
  platform: true,
  isVerified: true,
  lastActive: true,
  createdAt: true,
  Client: { select: { id: true, name: true, labName: true } },
};

const ROLES = ["owner", "operator"];

// GET /api/dashboard/users?take=&skip=&q=&role=&excludeClientId= — search
// every operator across every lab. Powers both the standalone Users page
// and the "add existing user" picker on a lab's page (via excludeClientId,
// so a lab doesn't see operators already there).
router.get("/", adminAuth, async (req, res) => {
  try {
    const { take, skip, q } = parsePaging(req.query);
    const excludeClientId = parseInt(req.query.excludeClientId);
    const role = req.query.role;

    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { Client: { name: { contains: q, mode: "insensitive" } } },
              { Client: { labName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(excludeClientId ? { NOT: { clientId: excludeClientId } } : {}),
      ...(role && ROLES.includes(role) ? { role } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        select: userSelect,
      }),
    ]);

    res.status(200).json({ data: users, total, take, skip });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: "Could not search users" });
  }
});

// GET /api/dashboard/users/stats — totals across every operator.
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const [totalUsers, owners, operators, withDevice] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "owner" } }),
      prisma.user.count({ where: { role: "operator" } }),
      prisma.user.count({ where: { device: { not: null } } }),
    ]);

    res.status(200).json({ totalUsers, owners, operators, withDevice });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Could not fetch user stats" });
  }
});

// POST /api/dashboard/users — creates a new operator under an existing lab.
// There's no admin "create operator" endpoint yet in routers/client.js
// (only list/update/revoke-device for ones that already exist), so this
// fills that gap without touching that file.
router.post("/", adminAuth, async (req, res) => {
  try {
    const { name, phone, clientId, username, password, role } = req.body;

    if (!name || !phone || !clientId) {
      return res.status(400).json({ error: "Name, phone and lab are required" });
    }

    const client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } });
    if (!client) return res.status(400).json({ error: "Laboratory not found" });

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) return res.status(400).json({ error: "Phone number already exists" });

    if (username) {
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) return res.status(400).json({ error: "Username already exists" });
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        clientId: client.id,
        homeClientId: client.id,
        username: username || null,
        password: password ? await bcrypt.hash(password, 10) : null,
        role: role || "operator",
      },
      select: userSelect,
    });

    await syncMaxDevicesToUserCount(client.id);

    res.status(200).json({ message: "User created", data: user });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Unique constraint violation" });
    }
    res.status(500).json({ error: "Could not create user" });
  }
});

module.exports = router;
