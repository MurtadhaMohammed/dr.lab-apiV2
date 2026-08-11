const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");
const { parsePaging } = require("./paging");

const router = express.Router();

// A laboratory IS a Client row (billing/plan/sync scope). Its people are
// User rows with clientId pointing here — the "owner" is the User created
// with role "owner", everyone else is an operator who logs in under this lab.
const labSelect = {
  id: true,
  name: true,
  labName: true,
  phone: true,
  email: true,
  address: true,
  active: true,
  device: true,
  Plan: true,
  balance: true,
  whatsappMsgPrice: true,
  printCount: true,
  syncEnabled: true,
  maxDevices: true,
  createdAt: true,
  expiredAt: true,
  lastActive: true,
  _count: { select: { users: true, devices: true } },
};

const PLAN_TYPES = ["FREE", "PAID", "SUBSCRIPTION"];

const buildWhere = ({ q, status, planType }) => ({
  ...(q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { labName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { users: { some: { name: { contains: q, mode: "insensitive" } } } },
          { users: { some: { phone: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {}),
  ...(status === "active" ? { active: true } : {}),
  ...(status === "inactive" ? { active: false } : {}),
  ...(planType && PLAN_TYPES.includes(planType) ? { Plan: { type: planType } } : {}),
});

const SORT_FIELDS = {
  labName: (dir) => ({ labName: dir }),
  users: (dir) => ({ users: { _count: dir } }),
  createdAt: (dir) => ({ createdAt: dir }),
};

// GET /api/dashboard/labs?take=&skip=&q=&status=&planType=&sortBy=&sortDir=
router.get("/", adminAuth, async (req, res) => {
  try {
    const { take, skip, q } = parsePaging(req.query);
    const { status, planType, sortBy, sortDir } = req.query;
    const where = buildWhere({ q, status, planType });
    const orderBy = (SORT_FIELDS[sortBy] || SORT_FIELDS.labName)(sortDir === "desc" ? "desc" : "asc");

    const [total, labs] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({ where, orderBy, take, skip, select: labSelect }),
    ]);

    res.status(200).json({ data: labs, total, take, skip });
  } catch (error) {
    console.error("Error fetching labs:", error);
    res.status(500).json({ error: "Could not fetch laboratories" });
  }
});

// GET /api/dashboard/labs/stats — totals across every lab, not just this page.
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const [totalLabs, activeLabs, paidLabs, noUsersCount] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { active: true } }),
      prisma.client.count({ where: { Plan: { type: { in: ["PAID", "SUBSCRIPTION"] } } } }),
      prisma.client.count({ where: { users: { none: {} } } }),
    ]);

    res.status(200).json({ totalLabs, activeLabs, paidLabs, noUsersCount });
  } catch (error) {
    console.error("Error fetching lab stats:", error);
    res.status(500).json({ error: "Could not fetch laboratory stats" });
  }
});

// GET /api/dashboard/labs/:id — one lab (Client) with its owner, for the
// detail page. The operator list itself is fetched separately via the
// existing GET /client/users/:id.
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid laboratory id" });

    const lab = await prisma.client.findUnique({ where: { id }, select: labSelect });
    if (!lab) return res.status(404).json({ error: "Laboratory not found" });

    const owner = await prisma.user.findFirst({
      where: { clientId: id, role: "owner" },
      select: { id: true, name: true, phone: true, username: true, createdAt: true },
    });

    res.status(200).json({ data: { ...lab, owner } });
  } catch (error) {
    console.error("Error fetching laboratory:", error);
    res.status(500).json({ error: "Could not fetch laboratory" });
  }
});

module.exports = router;
