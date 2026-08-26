-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('SHORTAGE', 'OVERAGE', 'QUALITY', 'WRONG_ITEM');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'AGREED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Responsibility" AS ENUM ('SUPPLIER', 'BUYER', 'CARRIER', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "DiscrepancyResolution" AS ENUM ('REPLACE', 'RETURN', 'CREDIT', 'ACCEPT');

-- CreateTable
CREATE TABLE "Discrepancy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "grnLineId" TEXT NOT NULL,
    "buyerOrgId" TEXT NOT NULL,
    "supplierOrgId" TEXT NOT NULL,
    "type" "DiscrepancyType" NOT NULL,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "quantity" DECIMAL(18,3) NOT NULL,
    "responsibility" "Responsibility" NOT NULL DEFAULT 'UNDETERMINED',
    "resolution" "DiscrepancyResolution",
    "description" TEXT NOT NULL,
    "supplierNote" TEXT,
    "resolutionNote" TEXT,
    "creditAmount" DECIMAL(18,2),
    "raisedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discrepancyId" TEXT NOT NULL,
    "buyerOrgId" TEXT NOT NULL,
    "supplierOrgId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Discrepancy_buyerOrgId_status_idx" ON "Discrepancy"("buyerOrgId", "status");

-- CreateIndex
CREATE INDEX "Discrepancy_supplierOrgId_status_idx" ON "Discrepancy"("supplierOrgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Discrepancy_buyerOrgId_code_key" ON "Discrepancy"("buyerOrgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_discrepancyId_key" ON "CreditNote"("discrepancyId");

-- CreateIndex
CREATE INDEX "CreditNote_supplierOrgId_idx" ON "CreditNote"("supplierOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_buyerOrgId_code_key" ON "CreditNote"("buyerOrgId", "code");

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "Grn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_grnLineId_fkey" FOREIGN KEY ("grnLineId") REFERENCES "GrnLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "Discrepancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_supplierOrgId_fkey" FOREIGN KEY ("supplierOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
