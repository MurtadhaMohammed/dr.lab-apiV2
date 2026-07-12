const prisma = require("../prisma/prismaClient");

// Runs AFTER clientAuth. Sync routes only — never retrofit onto legacy
// endpoints, whose tokens have no deviceId. Enforces per-request device
// revocation to compensate for 1-year JWTs.
const deviceAuth = async (req, res, next) => {
  try {
    const deviceId = req.user?.deviceId;
    if (!deviceId) {
      return res
        .status(403)
        .json({ error: "SYNC_NOT_ENABLED", message: "Re-login required for sync." });
    }

    const device = await prisma.device.findUnique({
      where: { id: parseInt(deviceId) },
      include: { Client: { select: { syncEnabled: true, active: true } } },
    });

    if (!device || device.clientId !== parseInt(req.user.id)) {
      return res.status(401).json({ error: "DEVICE_NOT_FOUND" });
    }
    if (device.revokedAt) {
      return res.status(401).json({ error: "DEVICE_REVOKED" });
    }
    if (!device.Client.syncEnabled || !device.Client.active) {
      return res.status(403).json({ error: "SYNC_NOT_ENABLED" });
    }

    // Throttled lastSeen update — once per 5 minutes is plenty.
    if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error("Error in deviceAuth:", error);
    res.status(500).json({ error: "Device verification failed" });
  }
};

module.exports = deviceAuth;
