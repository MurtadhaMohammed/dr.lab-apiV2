-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "maxDevices" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT,
    "platform" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pin" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPatient" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "birth" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncDoctor" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncVisit" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "patientUuid" TEXT,
    "doctorUuid" TEXT,
    "visitNumber" TEXT,
    "status" TEXT,
    "testType" TEXT,
    "tests" TEXT,
    "discount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncTest" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT,
    "price" INTEGER,
    "type" TEXT,
    "groupTest" TEXT,
    "normal" TEXT,
    "options" TEXT,
    "isSelecte" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPackage" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "title" TEXT,
    "customePrice" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncTestToPackage" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "packageUuid" TEXT,
    "testUuid" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncTestToPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_clientId_machineId_key" ON "Device"("clientId", "machineId");

-- CreateIndex
CREATE INDEX "SyncPatient_clientId_serverUpdatedAt_idx" ON "SyncPatient"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPatient_clientId_uuid_key" ON "SyncPatient"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncDoctor_clientId_serverUpdatedAt_idx" ON "SyncDoctor"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDoctor_clientId_uuid_key" ON "SyncDoctor"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncVisit_clientId_serverUpdatedAt_idx" ON "SyncVisit"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncVisit_clientId_uuid_key" ON "SyncVisit"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncTest_clientId_serverUpdatedAt_idx" ON "SyncTest"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncTest_clientId_uuid_key" ON "SyncTest"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncPackage_clientId_serverUpdatedAt_idx" ON "SyncPackage"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPackage_clientId_uuid_key" ON "SyncPackage"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncTestToPackage_clientId_serverUpdatedAt_idx" ON "SyncTestToPackage"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncTestToPackage_clientId_uuid_key" ON "SyncTestToPackage"("clientId", "uuid");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

