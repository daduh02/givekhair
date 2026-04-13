import { db } from "@/lib/db";
import type { ChargingMode, DonationKind, FundrasingModel, PayoutMethod, PayoutFrequency, Prisma } from "@prisma/client";

type ResolveContractInput = {
  charityId: string;
  at?: Date;
  region?: string | null;
  productType?: string | null;
};

export function isDateActive(at: Date, startsAt?: Date | null, endsAt?: Date | null) {
  return (!startsAt || startsAt <= at) && (!endsAt || endsAt >= at);
}

export async function validateNoOverlappingContracts(input: {
  charityId: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  region?: string | null;
  productType?: string | null;
  excludeId?: string;
}) {
  // Overlap checks are intentionally done in application logic so we can keep
  // the schema additive and avoid brittle multi-column database constraints
  // while the commercial scoping rules are still evolving.
  const overlaps = await db.charityContract.findFirst({
    where: {
      charityId: input.charityId,
      id: input.excludeId ? { not: input.excludeId } : undefined,
      status: { in: ["ACTIVE", "DRAFT", "SUSPENDED"] },
      region: input.region ?? undefined,
      productType: input.productType ?? undefined,
      OR: [
        {
          effectiveFrom: { lte: input.effectiveTo ?? new Date("9999-12-31") },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: input.effectiveFrom } },
          ],
        },
      ],
    },
    select: { id: true, termsVersion: true },
  });

  if (overlaps) {
    throw new Error(`Contract overlaps with existing contract ${overlaps.termsVersion}.`);
  }
}

export async function resolveActiveContract(input: ResolveContractInput) {
  const at = input.at ?? new Date();
  const region = input.region ?? "GB";

  const contract = await db.charityContract.findFirst({
    where: {
      AND: [
        { charityId: input.charityId },
        { status: "ACTIVE" },
        { OR: [{ region: null }, { region }] },
        input.productType ? { OR: [{ productType: null }, { productType: input.productType }] } : {},
        { effectiveFrom: { lte: at } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] },
      ],
    },
    include: {
      feeSchedule: { include: { rules: { orderBy: { sortOrder: "asc" } } } },
      commercialPlan: true,
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!contract) {
    throw new Error("No active commercial contract is configured for this charity.");
  }

  return contract;
}

export async function resolveApplicableSchedule(input: {
  charityId: string;
  contractId?: string;
  contractFeeScheduleId?: string | null;
  commercialPlanId?: string;
  at?: Date;
}) {
  const at = input.at ?? new Date();

  if (input.contractFeeScheduleId) {
    return db.feeSchedule.findUnique({
      where: { id: input.contractFeeScheduleId },
      include: { rules: { orderBy: { sortOrder: "asc" } } },
    });
  }

  // The schedule lookup prefers contract-linked pricing, then plan-scoped
  // schedules, then charity schedules, and finally the platform default.
  // This preserves the existing schedule entities while making contracts the
  // top-level commercial source of truth.
  return db.feeSchedule.findFirst({
    where: {
      isActive: true,
      validFrom: { lte: at },
      AND: [
        { OR: [{ validTo: null }, { validTo: { gte: at } }] },
        {
          OR: [
            ...(input.commercialPlanId ? [{ commercialPlanId: input.commercialPlanId }] : []),
            { charityId: input.charityId },
            { charityId: null },
          ],
        },
      ],
    },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
    orderBy: [
      { commercialPlanId: "desc" },
      { charityId: "desc" },
      { version: "desc" },
    ],
  });
}

export function filterApplicableRules(
  rules: Array<{
    countryCode: string | null;
    fundraisingModel: FundrasingModel | null;
    paymentMethod: string | null;
    subscriptionTier: string | null;
    donationKind: DonationKind | null;
    chargingMode: ChargingMode | null;
    platformFeePct: { toString(): string } | null;
    platformFeeFixed: { toString(): string } | null;
    processingFeePct: { toString(): string } | null;
    processingFeeFixed: { toString(): string } | null;
    giftAidFeePct: { toString(): string } | null;
    capAmount: { toString(): string } | null;
    isActive: boolean;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }>,
  ctx: {
    at: Date;
    countryCode?: string;
    fundraisingModel?: FundrasingModel | null;
    paymentMethod?: string;
    subscriptionTier?: string | null;
    donationKind: DonationKind;
    chargingMode: ChargingMode;
  }
) {
  return rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.countryCode && rule.countryCode !== (ctx.countryCode ?? "GB")) return false;
    if (rule.fundraisingModel && rule.fundraisingModel !== ctx.fundraisingModel) return false;
    if (rule.paymentMethod && rule.paymentMethod !== ctx.paymentMethod) return false;
    if (rule.subscriptionTier && rule.subscriptionTier !== ctx.subscriptionTier) return false;
    if (rule.donationKind && rule.donationKind !== ctx.donationKind) return false;
    if (rule.chargingMode && rule.chargingMode !== ctx.chargingMode) return false;
    if (!isDateActive(ctx.at, rule.effectiveFrom, rule.effectiveTo)) return false;
    return true;
  });
}

export function resolveEffectiveDonorSupportEnabled(input: {
  contractDonorSupportEnabled: boolean;
  appealOverride: boolean | null;
}) {
  return input.appealOverride ?? input.contractDonorSupportEnabled;
}

export function resolveAppliedChargingMode(input: {
  contractChargingMode: ChargingMode;
  donorSupportEnabled: boolean;
  donorSupportAmount: number;
}) {
  if (!input.donorSupportEnabled && input.contractChargingMode !== "CHARITY_PAID") {
    return "CHARITY_PAID" as ChargingMode;
  }

  if (input.contractChargingMode === "HYBRID") {
    return input.donorSupportAmount > 0 ? ("DONOR_SUPPORTED" as ChargingMode) : ("CHARITY_PAID" as ChargingMode);
  }

  return input.contractChargingMode;
}

export async function logCommercialAudit(input: {
  action: string;
  entityType: string;
  summary: string;
  contractId?: string | null;
  feeScheduleId?: string | null;
  feeRuleId?: string | null;
  charityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  changedByName?: string | null;
  changedByEmail?: string | null;
}) {
  return db.commercialAuditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      summary: input.summary,
      contractId: input.contractId ?? undefined,
      feeScheduleId: input.feeScheduleId ?? undefined,
      feeRuleId: input.feeRuleId ?? undefined,
      charityId: input.charityId ?? undefined,
      metadata: input.metadata,
      changedByName: input.changedByName ?? undefined,
      changedByEmail: input.changedByEmail ?? undefined,
    },
  });
}

export async function resolvePayoutPolicy(charityId: string, at = new Date()) {
  const contract = await db.charityContract.findFirst({
    where: {
      charityId,
      status: { in: ["ACTIVE", "SUSPENDED", "EXPIRED", "TERMINATED"] },
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!contract) {
    throw new Error("No commercial contract exists for this charity.");
  }

  const expired = !isDateActive(at, contract.effectiveFrom, contract.effectiveTo) || contract.status === "EXPIRED" || contract.status === "TERMINATED";
  const blocked = contract.status === "SUSPENDED" || (expired && contract.blockPayoutsOnExpiry);

  return {
    contract,
    blocked,
    reason: blocked
      ? contract.status === "SUSPENDED"
        ? "Payouts are blocked while the charity contract is suspended."
        : "Payouts are blocked because the charity contract has expired."
      : null,
  };
}

export function payoutTermsSummary(input: {
  payoutFrequency: PayoutFrequency;
  payoutMethod: PayoutMethod;
  settlementDelayDays: number;
  reserveRule?: string | null;
}) {
  return `${input.payoutFrequency.toLowerCase()} via ${input.payoutMethod.toLowerCase()} with ${input.settlementDelayDays} day settlement delay${input.reserveRule ? ` · reserve: ${input.reserveRule}` : ""}`;
}
