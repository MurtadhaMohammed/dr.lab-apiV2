const express = require("express");
const dayjs = require("dayjs");
const adminAuth = require("../middleware/adminAuth");
const prisma = require("../prisma/prismaClient");
const { parsePaging } = require("./paging");
const { syncMaxDevicesToUserCount } = require("../helper/syncMaxDevices");

const router = express.Router();

// "Active operator" windows for the lab detail page — how many of this
// lab's operators have a User.lastActive inside the window. Computed here
// (not on the client) since it's a plain count query either way.
const ACTIVE_WINDOW_DAYS = { week: 7, month: 30 };

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
  maxDevicesOverride: true,
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

    const activeWindow = ACTIVE_WINDOW_DAYS[req.query.activeWindow] ? req.query.activeWindow : "week";
    const activeCutoff = dayjs().subtract(ACTIVE_WINDOW_DAYS[activeWindow], "day").toDate();

    const [lab, owner, activeOperators] = await Promise.all([
      prisma.client.findUnique({ where: { id }, select: labSelect }),
      prisma.user.findFirst({
        where: { clientId: id, role: "owner" },
        select: { id: true, name: true, phone: true, username: true, createdAt: true },
      }),
      prisma.user.count({ where: { clientId: id, lastActive: { gte: activeCutoff } } }),
    ]);
    if (!lab) return res.status(404).json({ error: "Laboratory not found" });

    res.status(200).json({ data: { ...lab, owner, activeOperators, activeWindow } });
  } catch (error) {
    console.error("Error fetching laboratory:", error);
    res.status(500).json({ error: "Could not fetch laboratory" });
  }
});

// PUT /api/dashboard/labs/:id/max-devices — set or clear the manual device
// slot override. { maxDevices: number } pins the slot count; { maxDevices: null }
// reverts to the auto-computed (1-per-operator) value.
router.put("/:id/max-devices", adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid laboratory id" });

    const { maxDevices } = req.body;
    if (maxDevices !== null && (!Number.isInteger(maxDevices) || maxDevices < 1)) {
      return res.status(400).json({ error: "maxDevices must be a positive integer or null" });
    }

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: "Laboratory not found" });

    if (maxDevices === null) {
      await prisma.client.update({ where: { id }, data: { maxDevicesOverride: null } });
      await syncMaxDevicesToUserCount(id);
    } else {
      await prisma.client.update({
        where: { id },
        data: { maxDevicesOverride: maxDevices, maxDevices },
      });
    }

    const updated = await prisma.client.findUnique({ where: { id }, select: labSelect });
    res.status(200).json({ data: updated });
  } catch (error) {
    console.error("Error updating device slots:", error);
    res.status(500).json({ error: "Could not update device slots" });
  }
});

module.exports = router;
