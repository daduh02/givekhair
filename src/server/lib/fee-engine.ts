/**
 * Contract-led pricing engine
 *
 * This extends the existing fee schedule/rule model instead of replacing it.
 * Contracts resolve the active commercial posture first, then schedules/rules
 * provide the pricing inputs that feed a persisted fee snapshot.
 */

import Decimal from "decimal.js";
import type { ChargingMode, DonationKind, FundrasingModel } from "@prisma/client";
import { db } from "@/lib/db";
import {
  filterApplicableRules,
  resolveActiveContract,
  resolveApplicableSchedule,
  resolveAppliedChargingMode,
  resolveEffectiveDonorSupportEnabled,
} from "@/server/lib/commercials";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FeeContext {
  charityId: string;
  appealId?: string;
  countryCode?: string;
  paymentMethod?: string;
  subscriptionTier?: string;
  donationKind?: DonationKind;
  fundraisingModel?: FundrasingModel | null;
  donorSupportAmount?: number | string;
  at?: Date;
}

export interface FeePreview {
  donationAmount: Decimal;
  donorSupportAmount: Decimal;
  grossCheckoutTotal: Decimal;
  platformFeeAmount: Decimal;
  processingFeeAmount: Decimal;
  giftAidFeeAmount: Decimal;
  totalFees: Decimal;
  feeChargedToCharity: Decimal;
  charityNetAmount: Decimal;
  chargingMode: ChargingMode;
  contractId: string;
  scheduleId: string;
  scheduleVersion: number;
  donorSupportEnabled: boolean;
  donorSupportSuggestedPresets: number[];
  feeBreakdown: {
    platformFeeAmount: string;
    processingFeeAmount: string;
    giftAidFeeAmount: string;
    totalFees: string;
  };
  snapshotJson: object;
}

function normalizePresetArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

function computeRawFees(
  donationAmount: Decimal,
  rules: Array<{
    platformFeePct: { toString(): string } | null;
    platformFeeFixed: { toString(): string } | null;
    processingFeePct: { toString(): string } | null;
    processingFeeFixed: { toString(): string } | null;
    giftAidFeePct: { toString(): string } | null;
    capAmount: { toString(): string } | null;
  }>
) {
  let platformFee = new Decimal(0);
  let processingFee = new Decimal(0);
  let giftAidFee = new Decimal(0);

  for (const rule of rules) {
    if (rule.platformFeePct) {
      platformFee = platformFee.plus(donationAmount.times(new Decimal(rule.platformFeePct.toString())));
    }
    if (rule.platformFeeFixed) {
      platformFee = platformFee.plus(new Decimal(rule.platformFeeFixed.toString()));
    }
    if (rule.processingFeePct) {
      processingFee = processingFee.plus(donationAmount.times(new Decimal(rule.processingFeePct.toString())));
    }
    if (rule.processingFeeFixed) {
      processingFee = processingFee.plus(new Decimal(rule.processingFeeFixed.toString()));
    }
    if (rule.giftAidFeePct) {
      giftAidFee = giftAidFee.plus(donationAmount.times(new Decimal(rule.giftAidFeePct.toString())));
    }
    if (rule.capAmount) {
      platformFee = Decimal.min(platformFee, new Decimal(rule.capAmount.toString()));
    }
  }

  const roundedPlatform = platformFee.toDecimalPlaces(2);
  const roundedProcessing = processingFee.toDecimalPlaces(2);
  const roundedGiftAid = giftAidFee.toDecimalPlaces(2);
  const totalFees = roundedPlatform.plus(roundedProcessing).plus(roundedGiftAid);

  return {
    platformFeeAmount: roundedPlatform,
    processingFeeAmount: roundedProcessing,
    giftAidFeeAmount: roundedGiftAid,
    totalFees,
  };
}

export async function previewFees(rawAmount: number | string, ctx: FeeContext): Promise<FeePreview> {
  const donationAmount = new Decimal(rawAmount);
  const donorSupportAmount = new Decimal(ctx.donorSupportAmount ?? 0).toDecimalPlaces(2);
  const at = ctx.at ?? new Date();
  const appeal = ctx.appealId
    ? await db.appeal.findUnique({
        where: { id: ctx.appealId },
        select: { id: true, donorSupportOverride: true },
      })
    : null;

  const contract = await resolveActiveContract({
    charityId: ctx.charityId,
    at,
    region: ctx.countryCode ?? "GB",
  });

  const schedule = await resolveApplicableSchedule({
    charityId: ctx.charityId,
    contractId: contract.id,
    contractFeeScheduleId: contract.feeScheduleId,
    commercialPlanId: contract.commercialPlanId,
    at,
  });

  if (!schedule) {
    throw new Error("No active fee schedule is configured for this contract.");
  }

  const donorSupportEnabled = resolveEffectiveDonorSupportEnabled({
    contractDonorSupportEnabled: contract.donorSupportEnabled,
    appealOverride: appeal?.donorSupportOverride ?? null,
  });

  const appliedChargingMode = resolveAppliedChargingMode({
    contractChargingMode: contract.chargingMode,
    donorSupportEnabled,
    donorSupportAmount: donorSupportAmount.toNumber(),
  });

  const applicableRules = filterApplicableRules(schedule.rules, {
    at,
    countryCode: ctx.countryCode ?? "GB",
    fundraisingModel: ctx.fundraisingModel ?? contract.commercialPlan.fundraisingModel,
    paymentMethod: ctx.paymentMethod,
    subscriptionTier: ctx.subscriptionTier ?? null,
    donationKind: ctx.donationKind ?? "ONE_OFF",
    chargingMode: appliedChargingMode,
  });

  const fees = computeRawFees(donationAmount, applicableRules);

  let feeChargedToCharity = fees.totalFees;
  let charityNetAmount = donationAmount.minus(fees.totalFees);
  let grossCheckoutTotal = donationAmount;

  if (appliedChargingMode === "DONOR_SUPPORTED") {
    feeChargedToCharity = new Decimal(0);
    charityNetAmount = donationAmount;
    grossCheckoutTotal = donationAmount.plus(donorSupportAmount);
  }

  const suggestedPresets = normalizePresetArray(contract.donorSupportSuggestedPresets);

  return {
    donationAmount: donationAmount.toDecimalPlaces(2),
    donorSupportAmount,
    grossCheckoutTotal: grossCheckoutTotal.toDecimalPlaces(2),
    platformFeeAmount: fees.platformFeeAmount,
    processingFeeAmount: fees.processingFeeAmount,
    giftAidFeeAmount: fees.giftAidFeeAmount,
    totalFees: fees.totalFees,
    feeChargedToCharity: feeChargedToCharity.toDecimalPlaces(2),
    charityNetAmount: Decimal.max(charityNetAmount.toDecimalPlaces(2), new Decimal(0)),
    chargingMode: appliedChargingMode,
    contractId: contract.id,
    scheduleId: schedule.id,
    scheduleVersion: schedule.version,
    donorSupportEnabled,
    donorSupportSuggestedPresets: suggestedPresets,
    feeBreakdown: {
      platformFeeAmount: fees.platformFeeAmount.toFixed(2),
      processingFeeAmount: fees.processingFeeAmount.toFixed(2),
      giftAidFeeAmount: fees.giftAidFeeAmount.toFixed(2),
      totalFees: fees.totalFees.toFixed(2),
    },
    snapshotJson: {
      contractId: contract.id,
      contractChargingMode: contract.chargingMode,
      appliedChargingMode,
      contractTermsVersion: contract.termsVersion,
      donorSupportEnabled,
      donorSupportPromptStyle: contract.donorSupportPromptStyle,
      donorSupportSuggestedPresets: suggestedPresets,
      appealId: appeal?.id ?? null,
      appealDonorSupportOverride: appeal?.donorSupportOverride ?? null,
      scheduleId: schedule.id,
      scheduleVersion: schedule.version,
      scheduleName: schedule.name,
      rules: applicableRules,
    },
  };
}

export async function ensureDefaultFeeSchedule() {
  const existing = await db.feeSchedule.findFirst({
    where: { charityId: null, isActive: true },
  });

  if (existing) {
    return existing;
  }

  return db.feeSchedule.create({
    data: {
      version: 1,
      name: "Platform default v1",
      isActive: true,
      validFrom: new Date("2024-01-01"),
      rules: {
        create: [
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "CHARITY_PAID",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            sortOrder: 1,
          },
        ],
      },
    },
  });
}
