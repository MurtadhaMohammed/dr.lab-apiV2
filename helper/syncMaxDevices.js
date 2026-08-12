const prisma = require("../prisma/prismaClient");

// Multi-PC device slots track the lab's operator headcount 1:1 — every
// operator gets one device seat, no separately configured cap. Call this
// after any operator is added to, removed from, or moved into a lab.
const syncMaxDevicesToUserCount = async (clientId) => {
  const userCount = await prisma.user.count({ where: { clientId } });
  await prisma.client.update({
    where: { id: clientId },
    data: { maxDevices: Math.max(userCount, 1) },
  });
};

module.exports = { syncMaxDevicesToUserCount };
