-- CreateEnum
CREATE TYPE "PayoutBatchItemType" AS ENUM ('DONATION', 'GIFT_AID');

-- CreateTable
CREATE TABLE "PayoutBatchItem" (
    "id" TEXT NOT NULL,
    "payoutBatchId" TEXT NOT NULL,
    "donationId" TEXT,
    "itemType" "PayoutBatchItemType" NOT NULL DEFAULT 'DONATION',
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "feesAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutBatchItem_payoutBatchId_idx" ON "PayoutBatchItem"("payoutBatchId");

-- CreateIndex
CREATE INDEX "PayoutBatchItem_donationId_idx" ON "PayoutBatchItem"("donationId");

-- AddForeignKey
ALTER TABLE "PayoutBatchItem" ADD CONSTRAINT "PayoutBatchItem_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatchItem" ADD CONSTRAINT "PayoutBatchItem_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

