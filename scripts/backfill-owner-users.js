// One-time backfill: give every existing lab (Client) an owner-role User,
// since the User table was introduced after these Clients already existed.
// Carries over the Client's own login identity (phone/username/password
// hash) so the owner can sign in with the credentials the lab already had.
//
// Idempotent — safe to re-run. Skips any Client that already has an
// owner-role User, and skips (without aborting the batch) any Client whose
// phone/username collides with a User created by something else.
//
// Usage:
//   node scripts/backfill-owner-users.js           (dry run — no writes)
//   node scripts/backfill-owner-users.js --apply    (creates the rows)

require("dotenv").config();
const prisma = require("../prisma/prismaClient");

const APPLY = process.argv.includes("--apply");

async function main() {
  const clients = await prisma.client.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      username: true,
      password: true,
      platform: true,
      isVerified: true,
      lastActive: true,
    },
  });

  const existingOwnerClientIds = new Set(
    (await prisma.user.findMany({ where: { role: "owner" }, select: { clientId: true } })).map(
      (u) => u.clientId
    )
  );

  let created = 0;
  let skippedHasOwner = 0;
  let skippedConflict = 0;

  for (const client of clients) {
    if (existingOwnerClientIds.has(client.id)) {
      skippedHasOwner += 1;
      continue;
    }

    const data = {
      clientId: client.id,
      homeClientId: client.id,
      name: client.name,
      phone: client.phone,
      username: client.username || null,
      password: client.password || null,
      platform: client.platform || null,
      isVerified: client.isVerified ?? false,
      lastActive: client.lastActive || null,
      role: "owner",
    };

    if (!APPLY) {
      created += 1;
      continue;
    }

    try {
      await prisma.user.create({ data });
      created += 1;
    } catch (error) {
      if (error.code === "P2002") {
        skippedConflict += 1;
        console.warn(
          `Skipped client #${client.id} (${client.name}) — phone/username already used by another User`
        );
      } else {
        throw error;
      }
    }
  }

  console.log(
    `${APPLY ? "Created" : "Would create"} ${created} owner-role users. ` +
      `Already had an owner: ${skippedHasOwner}. Skipped on conflict: ${skippedConflict}.`
  );

  if (!APPLY) {
    console.log("Dry run only — re-run with --apply to write these rows.");
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
