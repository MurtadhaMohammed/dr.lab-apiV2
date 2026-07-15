const express = require("express");
const rateLimit = require("express-rate-limit");
const clientAuth = require("../middleware/clientAuth");
const deviceAuth = require("../middleware/deviceAuth");
const prisma = require("../prisma/prismaClient");

const router = express.Router();

const MAX_BATCH = 500;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

// Whitelist of syncable tables → Prisma model + allowed payload fields.
// clientId/uuid/updatedAt/deletedAt are handled explicitly; anything else
// outside `fields` is dropped, never stored.
const TABLES = {
  patients: {
    model: "syncPatient",
    fields: ["name", "gender", "email", "phone", "birth"],
  },
  doctors: {
    model: "syncDoctor",
    fields: ["name", "gender", "email", "phone", "address", "type"],
  },
  visits: {
    model: "syncVisit",
    fields: [
      "patientUuid",
      "doctorUuid",
      "visitNumber",
      "status",
      "testType",
      "tests",
      "discount",
    ],
  },
  tests: {
    model: "syncTest",
    fields: ["name", "price", "type", "groupTest", "normal", "options", "isSelecte"],
  },
  packages: {
    model: "syncPackage",
    fields: ["title", "customePrice"],
  },
  test_to_packages: {
    model: "syncTestToPackage",
    fields: ["packageUuid", "testUuid"],
  },
};

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => `sync-${req.user?.id ?? req.ip}`,
  message: { error: "Too many sync requests, slow down." },
});

// Client clocks are untrusted: clamp asserted timestamps to serverNow + skew.
function clampTimestamp(value, clientId) {
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  const max = Date.now() + CLOCK_SKEW_MS;
  if (parsed.getTime() > max) {
    console.warn(`sync: clamped future timestamp from client ${clientId}`);
    return new Date(max);
  }
  return parsed;
}

function pickFields(row, allowed) {
  const out = {};
  for (const f of allowed) {
    if (row[f] !== undefined) out[f] = row[f];
  }
  return out;
}

router.post("/push", clientAuth, deviceAuth, syncLimiter, async (req, res) => {
  try {
    const clientId = parseInt(req.user.clientId);
    const { table, rows } = req.body || {};

    const config = TABLES[table];
    if (!config) {
      return res.status(400).json({ error: "Unknown table" });
    }
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_BATCH) {
      return res.status(400).json({ error: `rows must be 1..${MAX_BATCH}` });
    }

    const model = prisma[config.model];
    const applied = [];
    const skipped = [];

    for (const row of rows) {
      if (typeof row?.uuid !== "string" || row.uuid.length === 0 || row.uuid.length > 64) {
        skipped.push(row?.uuid ?? null);
        continue;
      }
      const updatedAt = clampTimestamp(row.updatedAt, clientId);
      if (!updatedAt) {
        skipped.push(row.uuid);
        continue;
      }

      const data = pickFields(row, config.fields);
      data.updatedAt = updatedAt;
      data.deletedAt = row.deletedAt ? clampTimestamp(row.deletedAt, clientId) : null;

      const existing = await model.findUnique({
        where: { clientId_uuid: { clientId, uuid: row.uuid } },
        select: { updatedAt: true },
      });

      // Last-write-wins: ties keep the stored row (deterministic), and
      // retries of already-applied pushes are naturally idempotent.
      if (existing && existing.updatedAt >= updatedAt) {
        skipped.push(row.uuid);
        continue;
      }

      if (existing) {
        await model.update({
          where: { clientId_uuid: { clientId, uuid: row.uuid } },
          data,
        });
      } else {
        await model.create({
          data: { ...data, clientId, uuid: row.uuid },
        });
      }
      applied.push(row.uuid);
    }

    res.status(200).json({ applied, skipped, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error("sync push error:", error.message);
    res.status(500).json({ error: "Sync push failed" });
  }
});

router.get("/pull", clientAuth, deviceAuth, syncLimiter, async (req, res) => {
  try {
    const clientId = parseInt(req.user.clientId);
    const { table, since } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || MAX_BATCH, MAX_BATCH);

    const config = TABLES[table];
    if (!config) {
      return res.status(400).json({ error: "Unknown table" });
    }

    const sinceDate = since ? new Date(since) : new Date(0);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: "Invalid since cursor" });
    }

    const model = prisma[config.model];
    const rows = await model.findMany({
      where: { clientId, serverUpdatedAt: { gt: sinceDate } },
      orderBy: { serverUpdatedAt: "asc" },
      take: limit,
    });

    // Strip server-internal fields; the desktop client keys everything by uuid.
    const payload = rows.map(({ id, clientId: _c, ...rest }) => rest);
    const nextCursor =
      rows.length > 0 ? rows[rows.length - 1].serverUpdatedAt.toISOString() : since || null;

    res.status(200).json({
      rows: payload,
      nextCursor,
      hasMore: rows.length === limit,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("sync pull error:", error.message);
    res.status(500).json({ error: "Sync pull failed" });
  }
});

module.exports = router;
