# Prisma Migration Notes — Multi-PC Sync

This repo previously had NO migration history (schema changes were applied ad-hoc).
Before deploying the `20260702000001_add_device_user_sync` migration, the prod DB
must be baselined ONCE so Prisma knows the existing schema is already applied.

## One-time baseline (run against prod, BEFORE anything else)

```bash
# 1. Backup first. Always.
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql

# 2. Generate a baseline migration from the schema as it was BEFORE the sync changes
#    (i.e. the last deployed schema). Check out the commit before the sync changes, then:
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Tell Prisma the baseline is already applied on prod (records it, runs nothing):
npx prisma migrate resolve --applied 0_init
```

## Deploying the sync migration

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql   # backup before every deploy
npx prisma migrate deploy                            # applies pending migrations only
npx prisma generate
```

The sync migration is purely additive: two new columns on `Client`
(`syncEnabled` default false, `maxDevices` default 1) and two new tables
(`Device`, `User`). Existing rows and legacy behavior are untouched —
no client is multi-device until `syncEnabled` is flipped for their account.

## Rules going forward

- Never use `prisma db push` against prod.
- Every schema change gets a migration via `prisma migrate dev` (local) and is
  deployed with `prisma migrate deploy`.
