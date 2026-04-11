/**
 * Fee Engine
 * Resolves the active FeeSchedule for a given context, applies matching
 * FeeRules, and returns a FeeSet. All arithmetic uses Decimal.js to avoid
 * floating-point drift in financial calculations.
 */

import Decimal from "decimal.js";
import { db } from "@/lib/db";
import type { FeeRule, FeeSchedule } from "@prisma/client";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FeeContext {
  charityId: string;
  countryCode?: string;
  paymentMethod?: string;
  subscriptionTier?: string;
  donorCoversFees?: boolean;
}

export interface FeePreview {
  donationAmount: Decimal;
  platformFeeAmount: Decimal;
  processingFeeAmount: Decimal;
  giftAidFeeAmount: Decimal;
  totalFees: Decimal;
  netToCharity: Decimal;
  donorCoversFees: boolean;
  /** Gross amount the donor actually pays (= donation + fees if covering) */
  donorPays: Decimal;
  scheduleId: string;
  scheduleVersion: number;
  snapshotJson: object;
}

// ── Schedule resolution ───────────────────────────────────────────────────────

export async function resolveActiveSchedule(
  charityId: string
): Promise<(FeeSchedule & { rules: FeeRule[] }) | null> {
  const now = new Date();

  // Prefer charity-specific schedule, fall back to platform default
  const schedule = await db.feeSchedule.findFirst({
    where: {
      OR: [{ charityId }, { charityId: null }],
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ charityId: "desc" }, { version: "desc" }],
  });

  return schedule;
}

// ── Rule matching ─────────────────────────────────────────────────────────────

function matchesRule(rule: FeeRule, ctx: FeeContext): boolean {
  if (rule.countryCode && rule.countryCode !== (ctx.countryCode ?? "GB"))
    return false;
  if (rule.paymentMethod && rule.paymentMethod !== ctx.paymentMethod)
    return false;
  if (rule.subscriptionTier && rule.subscriptionTier !== ctx.subscriptionTier)
    return false;
  return true;
}

// ── Fee calculation ───────────────────────────────────────────────────────────

export function computeFees(
  donationAmount: Decimal,
  rules: FeeRule[],
  ctx: FeeContext
): Pick<
  FeePreview,
  | "platformFeeAmount"
  | "processingFeeAmount"
  | "giftAidFeeAmount"
  | "totalFees"
> {
  const matched = rules.filter((r) => matchesRule(r, ctx));

  let platformFee = new Decimal(0);
  let processingFee = new Decimal(0);
  let giftAidFee = new Decimal(0);

  for (const rule of matched) {
    if (rule.platformFeePct) {
      platformFee = platformFee.plus(
        donationAmount.times(new Decimal(rule.platformFeePct.toString()))
      );
    }
    if (rule.platformFeeFixed) {
      platformFee = platformFee.plus(new Decimal(rule.platformFeeFixed.toString()));
    }
    if (rule.processingFeePct) {
      processingFee = processingFee.plus(
        donationAmount.times(new Decimal(rule.processingFeePct.toString()))
      );
    }
    if (rule.processingFeeFixed) {
      processingFee = processingFee.plus(
        new Decimal(rule.processingFeeFixed.toString())
      );
    }
    if (rule.giftAidFeePct) {
      giftAidFee = giftAidFee.plus(
        donationAmount.times(new Decimal(rule.giftAidFeePct.toString()))
      );
    }
    // Cap
    if (rule.capAmount) {
      const cap = new Decimal(rule.capAmount.toString());
      platformFee = Decimal.min(platformFee, cap);
    }
  }

  // Round to 2dp
  platformFee = platformFee.toDecimalPlaces(2);
  processingFee = processingFee.toDecimalPlaces(2);
  giftAidFee = giftAidFee.toDecimalPlaces(2);
  const totalFees = platformFee.plus(processingFee).plus(giftAidFee);

  return { platformFeeAmount: platformFee, processingFeeAmount: processingFee, giftAidFeeAmount: giftAidFee, totalFees };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function previewFees(
  rawAmount: number | string,
  ctx: FeeContext
): Promise<FeePreview> {
  const donationAmount = new Decimal(rawAmount);

  const schedule = await resolveActiveSchedule(ctx.charityId);

  if (!schedule) {
    // No schedule — zero fees (useful for dev/test)
    const zero = new Decimal(0);
    return {
      donationAmount,
      platformFeeAmount: zero,
      processingFeeAmount: zero,
      giftAidFeeAmount: zero,
      totalFees: zero,
      netToCharity: donationAmount,
      donorCoversFees: ctx.donorCoversFees ?? false,
      donorPays: donationAmount,
      scheduleId: "none",
      scheduleVersion: 0,
      snapshotJson: {},
    };
  }

  const fees = computeFees(donationAmount, schedule.rules, ctx);

  const donorCoversFees = ctx.donorCoversFees ?? false;
  const netToCharity = donorCoversFees
    ? donationAmount
    : donationAmount.minus(fees.totalFees);
  const donorPays = donorCoversFees
    ? donationAmount.plus(fees.totalFees)
    : donationAmount;

  return {
    donationAmount,
    ...fees,
    netToCharity: netToCharity.toDecimalPlaces(2),
    donorCoversFees,
    donorPays: donorPays.toDecimalPlaces(2),
    scheduleId: schedule.id,
    scheduleVersion: schedule.version,
    snapshotJson: {
      scheduleId: schedule.id,
      version: schedule.version,
      name: schedule.name,
      rules: schedule.rules,
    },
  };
}

// ── Stub schedule for dev/test ────────────────────────────────────────────────

export async function ensureDefaultFeeSchedule() {
  const existing = await db.feeSchedule.findFirst({
    where: { charityId: null, isActive: true },
  });
  if (existing) return existing;

  return db.feeSchedule.create({
    data: {
      charityId: null,
      version: 1,
      name: "Platform default v1",
      isActive: true,
      validFrom: new Date("2024-01-01"),
      rules: {
        create: [
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            platformFeePct: 0.015,   // 1.5%
            processingFeePct: 0.014, // 1.4%
            processingFeeFixed: 0.2, // + £0.20
            sortOrder: 1,
          },
        ],
      },
    },
  });
}
