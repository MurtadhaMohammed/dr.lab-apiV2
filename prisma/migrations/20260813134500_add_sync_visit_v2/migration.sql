-- CreateTable
CREATE TABLE "SyncVisitV2" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "patientUuid" TEXT,
    "doctorUuid" TEXT,
    "visit_number" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "gross_price_iqd" INTEGER,
    "discount_iqd" INTEGER,
    "end_price_iqd" INTEGER,
    "paid_iqd" INTEGER,
    "payment_status" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncVisitV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncVisitItemV2" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "visitUuid" TEXT,
    "test_id" INTEGER,
    "code" TEXT,
    "type" TEXT,
    "name_en" TEXT,
    "name_ar" TEXT,
    "sample_type" TEXT,
    "unit" TEXT,
    "ref_text" TEXT,
    "price_iqd" INTEGER,
    "meta_json" TEXT,
    "result_json" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncVisitItemV2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncVisitV2_clientId_uuid_key" ON "SyncVisitV2"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncVisitV2_clientId_serverUpdatedAt_idx" ON "SyncVisitV2"("clientId", "serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncVisitItemV2_clientId_uuid_key" ON "SyncVisitItemV2"("clientId", "uuid");

-- CreateIndex
CREATE INDEX "SyncVisitItemV2_clientId_serverUpdatedAt_idx" ON "SyncVisitItemV2"("clientId", "serverUpdatedAt");
