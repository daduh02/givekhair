-- AlterEnum
CREATE TYPE "FinanceAutomationRunType" AS ENUM ('AUTO_RECONCILIATION', 'PAYOUT_PROVIDER_SYNC', 'HMRC_CLAIM_SYNC');
CREATE TYPE "FinanceAutomationRunStatus" AS ENUM ('DRY_RUN', 'EXECUTED', 'FAILED');

-- AlterTable
ALTER TABLE "ReportExportLog"
ADD COLUMN "fileName" TEXT,
ADD COLUMN "contentType" TEXT DEFAULT 'text/csv; charset=utf-8',
ADD COLUMN "checksumSha256" TEXT,
ADD COLUMN "byteSize" INTEGER;

-- CreateTable
CREATE TABLE "ReportExportArtifact" (
  "id" TEXT NOT NULL,
  "exportLogId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportExportArtifact_exportLogId_key" ON "ReportExportArtifact"("exportLogId");

-- AddForeignKey
ALTER TABLE "ReportExportArtifact"
ADD CONSTRAINT "ReportExportArtifact_exportLogId_fkey"
FOREIGN KEY ("exportLogId") REFERENCES "ReportExportLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "FinanceAutomationRun" (
  "id" TEXT NOT NULL,
  "runType" "FinanceAutomationRunType" NOT NULL,
  "status" "FinanceAutomationRunStatus" NOT NULL,
  "requestedById" TEXT,
  "summary" TEXT NOT NULL,
  "detailsJson" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "FinanceAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAutomationRun_runType_startedAt_idx" ON "FinanceAutomationRun"("runType", "startedAt");
CREATE INDEX "FinanceAutomationRun_status_startedAt_idx" ON "FinanceAutomationRun"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "FinanceAutomationRun"
ADD CONSTRAINT "FinanceAutomationRun_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
