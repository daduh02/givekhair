-- CreateEnum
CREATE TYPE "ReportExportType" AS ENUM (
  'DONATIONS',
  'OFFLINE',
  'PAYOUTS',
  'GIFT_AID',
  'GL',
  'PAYOUT_RECONCILIATION',
  'GIFT_AID_RECONCILIATION',
  'FINANCE_EXCEPTIONS'
);

-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ReportExportLog" (
  "id" TEXT NOT NULL,
  "reportType" "ReportExportType" NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'SUCCEEDED',
  "exportedById" TEXT NOT NULL,
  "charityId" TEXT,
  "requestedCharityId" TEXT,
  "filtersJson" JSONB,
  "rowCount" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportExportLog_exportedById_createdAt_idx" ON "ReportExportLog"("exportedById", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExportLog_charityId_createdAt_idx" ON "ReportExportLog"("charityId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExportLog_reportType_createdAt_idx" ON "ReportExportLog"("reportType", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportExportLog" ADD CONSTRAINT "ReportExportLog_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExportLog" ADD CONSTRAINT "ReportExportLog_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "Charity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
