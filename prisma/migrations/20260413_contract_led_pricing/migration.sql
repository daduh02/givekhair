-- CreateEnum
CREATE TYPE "ChargingMode" AS ENUM ('CHARITY_PAID', 'DONOR_SUPPORTED', 'HYBRID');

-- CreateEnum
CREATE TYPE "DonationKind" AS ENUM ('ONE_OFF', 'RECURRING');

-- CreateEnum
CREATE TYPE "DonorSupportPromptStyle" AS ENUM ('TOGGLE', 'CHECKBOX', 'PRESET');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('STRIPE_CONNECT', 'GOCARDLESS', 'BACS', 'MANUAL');

-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN     "donorSupportOverride" BOOLEAN;

-- AlterTable
ALTER TABLE "CharityContract" ADD COLUMN     "autoPauseAppealsOnExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blockPayoutsOnExpiry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chargingMode" "ChargingMode" NOT NULL DEFAULT 'CHARITY_PAID',
ADD COLUMN     "donorSupportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "donorSupportPromptStyle" "DonorSupportPromptStyle" NOT NULL DEFAULT 'TOGGLE',
ADD COLUMN     "donorSupportSuggestedPresets" JSONB,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "payoutFrequency" "PayoutFrequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'BACS',
ADD COLUMN     "productType" TEXT,
ADD COLUMN     "region" TEXT DEFAULT 'GB',
ADD COLUMN     "reserveRule" TEXT,
ADD COLUMN     "settlementDelayDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "charityNetAmount" DECIMAL(10,2),
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "donationAmount" DECIMAL(10,2),
ADD COLUMN     "donationKind" "DonationKind" NOT NULL DEFAULT 'ONE_OFF',
ADD COLUMN     "donorSupportAmount" DECIMAL(10,2),
ADD COLUMN     "feeBreakdownSnapshot" JSONB,
ADD COLUMN     "feeChargedToCharity" DECIMAL(10,2),
ADD COLUMN     "giftAidExpectedAmount" DECIMAL(10,2),
ADD COLUMN     "giftAidReceivedAmount" DECIMAL(10,2),
ADD COLUMN     "grossCheckoutTotal" DECIMAL(10,2),
ADD COLUMN     "resolvedChargingMode" "ChargingMode";

-- AlterTable
ALTER TABLE "FeeRule" ADD COLUMN     "chargingMode" "ChargingMode",
ADD COLUMN     "donationKind" "DonationKind",
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "documentType" "TermsDocumentType" NOT NULL DEFAULT 'PLATFORM_TERMS',
    "uploadedByName" TEXT,
    "uploadedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialAuditLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "feeScheduleId" TEXT,
    "feeRuleId" TEXT,
    "charityId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "changedByName" TEXT,
    "changedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CharityContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAuditLog" ADD CONSTRAINT "CommercialAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CharityContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAuditLog" ADD CONSTRAINT "CommercialAuditLog_feeScheduleId_fkey" FOREIGN KEY ("feeScheduleId") REFERENCES "FeeSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAuditLog" ADD CONSTRAINT "CommercialAuditLog_feeRuleId_fkey" FOREIGN KEY ("feeRuleId") REFERENCES "FeeRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAuditLog" ADD CONSTRAINT "CommercialAuditLog_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "Charity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CharityContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

