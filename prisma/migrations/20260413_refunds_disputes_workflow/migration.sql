-- Additive migration for refund workflow clarity and dispute/chargeback tracking.
-- Existing donations and refunds stay valid because new columns use defaults or
-- remain nullable until new operational actions populate them.

CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

ALTER TABLE "Refund"
ADD COLUMN "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED';

CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED');
CREATE TYPE "DisputeOutcome" AS ENUM ('WON', 'LOST', 'WRITTEN_OFF');

CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "reason" TEXT,
    "evidenceDueAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "outcome" "DisputeOutcome",
    "notes" TEXT,
    "metadataJson" JSONB,
    "recordedById" TEXT,
    "financialImpactRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JournalEntry"
ADD COLUMN "disputeId" TEXT;

CREATE INDEX "Dispute_donationId_idx" ON "Dispute"("donationId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");
CREATE INDEX "Dispute_openedAt_idx" ON "Dispute"("openedAt");

ALTER TABLE "Dispute"
ADD CONSTRAINT "Dispute_donationId_fkey"
FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
