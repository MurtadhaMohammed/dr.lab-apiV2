-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeClientId" INTEGER;

-- Backfill: every existing user's home lab is whatever lab they're
-- currently attached to — homeClientId only diverges from clientId going
-- forward, once a user is manually reassigned to a different lab.
UPDATE "User" SET "homeClientId" = "clientId" WHERE "homeClientId" IS NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_homeClientId_fkey" FOREIGN KEY ("homeClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
