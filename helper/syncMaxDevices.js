const prisma = require("../prisma/prismaClient");

// Multi-PC device slots track the lab's operator headcount 1:1 by default —
// every operator gets one device seat. An admin can set maxDevicesOverride
// to pin the slot count instead; when set, operator changes no longer move
// maxDevices. Call this after any operator is added to, removed from, or
// moved into a lab.
const syncMaxDevicesToUserCount = async (clientId) => {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { maxDevicesOverride: true },
  });
  if (client?.maxDevicesOverride != null) return;

  const userCount = await prisma.user.count({ where: { clientId } });
  await prisma.client.update({
    where: { id: clientId },
    data: { maxDevices: Math.max(userCount, 1) },
  });
};

module.exports = { syncMaxDevicesToUserCount };
