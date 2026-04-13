import { endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import type { ReportFilters } from "@/server/lib/reports";
import { resolvePayoutPolicy } from "@/server/lib/commercials";

export type FinanceExceptionType =
  | "CAPTURED_UNBATCHED"
  | "PAYOUT_CONTRACT_BLOCKED"
  | "PAYOUT_BATCH_FAILED"
  | "PAYOUT_BATCH_MISSING_REFERENCE"
  | "GIFT_AID_EXPECTED_UNCLAIMED"
  | "GIFT_AID_CLAIM_UNPAID"
  | "GIFT_AID_PAID_UNALLOCATED"
  | "REFUND_OR_DISPUTE_PAYOUT_IMPACT";

export type FinanceExceptionStatus = "OPEN" | "WARNING";

export type ReconciliationFilters = ReportFilters & {
  exceptionType?: string | null;
  exceptionStatus?: string | null;
};

type DateRange = {
  gte?: Date;
  lte?: Date;
};

export type PayoutReconciliationRow = {
  payoutBatchId: string;
  charityId: string;
  charityName: string;
  status: string;
  scheduledFor: Date;
  processedAt: Date | null;
  createdAt: Date;
  donationCount: number;
  donationGrossTotal: number;
  charityFeeTotal: number;
  donorSupportExcludedTotal: number;
  giftAidAllocationTotal: number;
  netPayoutAmount: number;
  readinessStatus: string;
  blockedReason: string;
  contractReference: string;
  bankReference: string;
  providerReference: string;
};

export type GiftAidReconciliationRow = {
  charityId: string;
  charityName: string;
  claimId: string;
  claimStatus: string;
  periodStart: Date;
  periodEnd: Date;
  declarationCount: number;
  linkedDonationCount: number;
  expectedReclaimAmount: number;
  submittedAmount: number;
  paidAmount: number;
  paidAt: Date | null;
  payoutLinkedStatus: "FULLY_ALLOCATED" | "PARTIALLY_ALLOCATED" | "NOT_ALLOCATED" | "NOT_APPLICABLE";
  payoutAllocatedGiftAidAmount: number;
  unallocatedPaidGiftAidAmount: number;
  hmrcReference: string;
};

export type FinanceExceptionRow = {
  exceptionType: FinanceExceptionType;
  exceptionStatus: FinanceExceptionStatus;
  charityId: string;
  charityName: string;
  relatedEntityType: "DONATION" | "PAYOUT_BATCH" | "GIFT_AID_CLAIM" | "CHARITY_CONTRACT";
  relatedEntityId: string;
  relatedDate: Date;
  summary: string;
  actionHint: string;
  donationRef: string;
  payoutBatchRef: string;
  giftAidClaimRef: string;
};

function toAmount(value: { toString(): string } | null | undefined) {
  return parseFloat(value?.toString() ?? "0");
}

function getDateRange(filters: ReportFilters): DateRange {
  return {
    ...(filters.start ? { gte: startOfDay(new Date(filters.start)) } : {}),
    ...(filters.end ? { lte: endOfDay(new Date(filters.end)) } : {}),
  };
}

function inRange(date: Date, range: DateRange) {
  if (range.gte && date < range.gte) {
    return false;
  }
  if (range.lte && date > range.lte) {
    return false;
  }
  return true;
}

function requestedExceptionType(filters: ReconciliationFilters): FinanceExceptionType | null {
  const value = (filters.exceptionType ?? "").trim();
  if (!value) {
    return null;
  }
  const allowed: FinanceExceptionType[] = [
    "CAPTURED_UNBATCHED",
    "PAYOUT_CONTRACT_BLOCKED",
    "PAYOUT_BATCH_FAILED",
    "PAYOUT_BATCH_MISSING_REFERENCE",
    "GIFT_AID_EXPECTED_UNCLAIMED",
    "GIFT_AID_CLAIM_UNPAID",
    "GIFT_AID_PAID_UNALLOCATED",
    "REFUND_OR_DISPUTE_PAYOUT_IMPACT",
  ];
  return allowed.includes(value as FinanceExceptionType) ? (value as FinanceExceptionType) : null;
}

function requestedExceptionStatus(filters: ReconciliationFilters): FinanceExceptionStatus | null {
  const value = (filters.exceptionStatus ?? "").trim();
  if (value === "OPEN" || value === "WARNING") {
    return value;
  }
  return null;
}

export async function getPayoutReconciliationRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getDateRange(input.filters);
  const charityScope = input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"];

  const batches = await db.payoutBatch.findMany({
    where: {
      charityId: { in: charityScope },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: {
      charity: { select: { id: true, name: true } },
      items: {
        include: {
          donation: {
            select: {
              donationAmount: true,
              donorSupportAmount: true,
              feeChargedToCharity: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const charityPolicies = new Map<string, { blocked: boolean; reason: string; contractReference: string }>();
  for (const charityId of [...new Set(batches.map((batch) => batch.charityId))]) {
    try {
      const policy = await resolvePayoutPolicy(charityId);
      charityPolicies.set(charityId, {
        blocked: policy.blocked,
        reason: policy.reason ?? "",
        contractReference: policy.contract.termsVersion,
      });
    } catch {
      charityPolicies.set(charityId, {
        blocked: true,
        reason: "No commercial contract exists for this charity.",
        contractReference: "",
      });
    }
  }

  return batches.map<PayoutReconciliationRow>((batch) => {
    const donationItems = batch.items.filter((item) => item.itemType === "DONATION");
    const giftAidItems = batch.items.filter((item) => item.itemType === "GIFT_AID");
    const donationGrossTotal = donationItems.reduce((sum, item) => sum + toAmount(item.grossAmount), 0);
    const charityFeeTotal = donationItems.reduce((sum, item) => sum + toAmount(item.feesAmount), 0);
    const donorSupportExcludedTotal = donationItems.reduce((sum, item) => {
      if (!item.donation) {
        return sum;
      }
      return sum + toAmount(item.donation.donorSupportAmount);
    }, 0);
    const giftAidAllocationTotal = giftAidItems.reduce((sum, item) => sum + toAmount(item.netAmount), 0);
    const policy = charityPolicies.get(batch.charityId) ?? { blocked: false, reason: "", contractReference: "" };
    const missingRefs = batch.status === "PAID" && !batch.providerRef && !batch.bankRef;
    const readinessStatus = policy.blocked
      ? "BLOCKED"
      : missingRefs
        ? "MISSING_REFERENCE"
        : batch.status === "FAILED"
          ? "FAILED"
          : "READY";

    return {
      payoutBatchId: batch.id,
      charityId: batch.charity.id,
      charityName: batch.charity.name,
      status: batch.status,
      scheduledFor: batch.scheduledFor,
      processedAt: batch.processedAt,
      createdAt: batch.createdAt,
      donationCount: donationItems.length,
      donationGrossTotal,
      charityFeeTotal,
      donorSupportExcludedTotal,
      giftAidAllocationTotal,
      netPayoutAmount: toAmount(batch.netAmount),
      readinessStatus,
      blockedReason: policy.blocked ? policy.reason : "",
      contractReference: policy.contractReference,
      bankReference: batch.bankRef ?? "",
      providerReference: batch.providerRef ?? "",
    };
  });
}

export async function getGiftAidReconciliationRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getDateRange(input.filters);
  const charityScope = input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"];

  const claims = await db.giftAidClaim.findMany({
    where: {
      charityId: { in: charityScope },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: {
      charity: { select: { id: true, name: true } },
      items: {
        include: {
          declaration: {
            select: {
              donationId: true,
              donation: {
                select: {
                  giftAidExpectedAmount: true,
                  giftAidReceivedAmount: true,
                  payoutItems: {
                    where: { itemType: "GIFT_AID" },
                    select: { id: true, netAmount: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });

  return claims.map<GiftAidReconciliationRow>((claim) => {
    const linkedDonations = claim.items
      .map((item) => item.declaration.donation)
      .filter((donation): donation is NonNullable<typeof donation> => Boolean(donation));
    const expectedReclaimAmount = linkedDonations.reduce(
      (sum, donation) => sum + toAmount(donation.giftAidExpectedAmount),
      0,
    );
    const paidAmount = claim.status === "PAID" ? toAmount(claim.reclaimAmount) : 0;
    const submittedAmount = ["SUBMITTED", "ACCEPTED", "PAID"].includes(claim.status)
      ? toAmount(claim.reclaimAmount)
      : 0;

    const payoutAllocatedGiftAidAmount = linkedDonations.reduce((sum, donation) => {
      return sum + donation.payoutItems.reduce((itemSum, item) => itemSum + toAmount(item.netAmount), 0);
    }, 0);
    const linkedDonationCount = linkedDonations.length;
    const paidDonationGiftAidAmount = linkedDonations.reduce(
      (sum, donation) => sum + toAmount(donation.giftAidReceivedAmount),
      0,
    );
    const unallocatedPaidGiftAidAmount = Math.max(paidDonationGiftAidAmount - payoutAllocatedGiftAidAmount, 0);

    const payoutLinkedStatus: GiftAidReconciliationRow["payoutLinkedStatus"] =
      claim.status !== "PAID"
        ? "NOT_APPLICABLE"
        : payoutAllocatedGiftAidAmount <= 0
          ? "NOT_ALLOCATED"
          : unallocatedPaidGiftAidAmount > 0
            ? "PARTIALLY_ALLOCATED"
            : "FULLY_ALLOCATED";

    return {
      charityId: claim.charity.id,
      charityName: claim.charity.name,
      claimId: claim.id,
      claimStatus: claim.status,
      periodStart: claim.periodStart,
      periodEnd: claim.periodEnd,
      declarationCount: claim.items.length,
      linkedDonationCount,
      expectedReclaimAmount,
      submittedAmount,
      paidAmount,
      paidAt: claim.paidAt,
      payoutLinkedStatus,
      payoutAllocatedGiftAidAmount,
      unallocatedPaidGiftAidAmount,
      hmrcReference: claim.hmrcRef ?? "",
    };
  });
}

export async function getFinanceExceptionRows(input: {
  scopedCharityIds: string[];
  filters: ReconciliationFilters;
}) {
  const charityScope = input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"];
  const range = getDateRange(input.filters);
  const wantedType = requestedExceptionType(input.filters);
  const wantedStatus = requestedExceptionStatus(input.filters);

  const shouldInclude = (type: FinanceExceptionType) => !wantedType || wantedType === type;

  const exceptions: FinanceExceptionRow[] = [];

  if (shouldInclude("CAPTURED_UNBATCHED") || shouldInclude("REFUND_OR_DISPUTE_PAYOUT_IMPACT") || shouldInclude("GIFT_AID_EXPECTED_UNCLAIMED")) {
    const donations = await db.donation.findMany({
      where: {
        page: { appeal: { charityId: { in: charityScope } } },
        OR: [
          shouldInclude("CAPTURED_UNBATCHED")
            ? { status: "CAPTURED", payoutItems: { none: {} } }
            : undefined,
          shouldInclude("REFUND_OR_DISPUTE_PAYOUT_IMPACT")
            ? {
                payoutItems: { some: {} },
                OR: [
                  { refunds: { some: { status: "SUCCEEDED" } } },
                  { disputes: { some: { status: { in: ["OPEN", "UNDER_REVIEW", "LOST"] } } } },
                ],
              }
            : undefined,
          shouldInclude("GIFT_AID_EXPECTED_UNCLAIMED")
            ? {
                giftAidExpectedAmount: { gt: 0 },
                giftAidDeclaration: {
                  is: {
                    giftAidClaimItems: { none: {} },
                  },
                },
              }
            : undefined,
        ].filter(Boolean) as object[],
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        giftAidExpectedAmount: true,
        page: {
          select: {
            appeal: {
              select: {
                charity: { select: { id: true, name: true } },
              },
            },
          },
        },
        refunds: { where: { status: "SUCCEEDED" }, select: { id: true } },
        disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW", "LOST"] } }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const donation of donations) {
      if (!inRange(donation.createdAt, range)) {
        continue;
      }

      const charity = donation.page.appeal.charity;

      if (shouldInclude("CAPTURED_UNBATCHED") && donation.status === "CAPTURED") {
        exceptions.push({
          exceptionType: "CAPTURED_UNBATCHED",
          exceptionStatus: "OPEN",
          charityId: charity.id,
          charityName: charity.name,
          relatedEntityType: "DONATION",
          relatedEntityId: donation.id,
          relatedDate: donation.createdAt,
          summary: "Captured donation has not been allocated to any payout batch.",
          actionHint: "Review payout readiness and create/schedule a payout batch.",
          donationRef: donation.id,
          payoutBatchRef: "",
          giftAidClaimRef: "",
        });
      }

      if (shouldInclude("REFUND_OR_DISPUTE_PAYOUT_IMPACT") && (donation.refunds.length > 0 || donation.disputes.length > 0)) {
        exceptions.push({
          exceptionType: "REFUND_OR_DISPUTE_PAYOUT_IMPACT",
          exceptionStatus: "WARNING",
          charityId: charity.id,
          charityName: charity.name,
          relatedEntityType: "DONATION",
          relatedEntityId: donation.id,
          relatedDate: donation.createdAt,
          summary: "Donation has refund/dispute activity and is already linked to payout items.",
          actionHint: "Check payout adjustments and recovery handling before further settlement.",
          donationRef: donation.id,
          payoutBatchRef: "",
          giftAidClaimRef: "",
        });
      }

      if (shouldInclude("GIFT_AID_EXPECTED_UNCLAIMED") && toAmount(donation.giftAidExpectedAmount) > 0) {
        exceptions.push({
          exceptionType: "GIFT_AID_EXPECTED_UNCLAIMED",
          exceptionStatus: "OPEN",
          charityId: charity.id,
          charityName: charity.name,
          relatedEntityType: "DONATION",
          relatedEntityId: donation.id,
          relatedDate: donation.createdAt,
          summary: "Gift Aid expected amount exists but declaration is not attached to a claim yet.",
          actionHint: "Build draft Gift Aid claims and submit for this period.",
          donationRef: donation.id,
          payoutBatchRef: "",
          giftAidClaimRef: "",
        });
      }
    }
  }

  if (shouldInclude("PAYOUT_CONTRACT_BLOCKED")) {
    const charities = await db.charity.findMany({
      where: { id: { in: charityScope } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    for (const charity of charities) {
      try {
        const policy = await resolvePayoutPolicy(charity.id);
        if (policy.blocked) {
          exceptions.push({
            exceptionType: "PAYOUT_CONTRACT_BLOCKED",
            exceptionStatus: "OPEN",
            charityId: charity.id,
            charityName: charity.name,
            relatedEntityType: "CHARITY_CONTRACT",
            relatedEntityId: policy.contract.id,
            relatedDate: policy.contract.updatedAt,
            summary: policy.reason ?? "Payout policy currently blocks settlement.",
            actionHint: "Review contract status/expiry terms in Fees & Contracts.",
            donationRef: "",
            payoutBatchRef: "",
            giftAidClaimRef: "",
          });
        }
      } catch {
        // Missing contracts are already operationally blocking.
        exceptions.push({
          exceptionType: "PAYOUT_CONTRACT_BLOCKED",
          exceptionStatus: "OPEN",
          charityId: charity.id,
          charityName: charity.name,
          relatedEntityType: "CHARITY_CONTRACT",
          relatedEntityId: "",
          relatedDate: new Date(),
          summary: "No commercial contract exists for this charity.",
          actionHint: "Create and activate a contract before scheduling payouts.",
          donationRef: "",
          payoutBatchRef: "",
          giftAidClaimRef: "",
        });
      }
    }
  }

  if (shouldInclude("PAYOUT_BATCH_FAILED") || shouldInclude("PAYOUT_BATCH_MISSING_REFERENCE")) {
    const payoutBatches = await db.payoutBatch.findMany({
      where: {
        charityId: { in: charityScope },
        OR: [
          shouldInclude("PAYOUT_BATCH_FAILED") ? { status: "FAILED" } : undefined,
          shouldInclude("PAYOUT_BATCH_MISSING_REFERENCE")
            ? { status: "PAID", providerRef: null, bankRef: null }
            : undefined,
        ].filter(Boolean) as object[],
      },
      include: {
        charity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const batch of payoutBatches) {
      if (!inRange(batch.createdAt, range)) {
        continue;
      }

      if (shouldInclude("PAYOUT_BATCH_FAILED") && batch.status === "FAILED") {
        exceptions.push({
          exceptionType: "PAYOUT_BATCH_FAILED",
          exceptionStatus: "OPEN",
          charityId: batch.charity.id,
          charityName: batch.charity.name,
          relatedEntityType: "PAYOUT_BATCH",
          relatedEntityId: batch.id,
          relatedDate: batch.createdAt,
          summary: "Payout batch is in FAILED status.",
          actionHint: "Review payout references and retry processing or create replacement batch.",
          donationRef: "",
          payoutBatchRef: batch.id,
          giftAidClaimRef: "",
        });
      }

      if (shouldInclude("PAYOUT_BATCH_MISSING_REFERENCE") && batch.status === "PAID" && !batch.providerRef && !batch.bankRef) {
        exceptions.push({
          exceptionType: "PAYOUT_BATCH_MISSING_REFERENCE",
          exceptionStatus: "WARNING",
          charityId: batch.charity.id,
          charityName: batch.charity.name,
          relatedEntityType: "PAYOUT_BATCH",
          relatedEntityId: batch.id,
          relatedDate: batch.createdAt,
          summary: "Paid payout batch has no provider or bank reference recorded.",
          actionHint: "Add provider/bank references for reconciliation traceability.",
          donationRef: "",
          payoutBatchRef: batch.id,
          giftAidClaimRef: "",
        });
      }
    }
  }

  if (shouldInclude("GIFT_AID_CLAIM_UNPAID") || shouldInclude("GIFT_AID_PAID_UNALLOCATED")) {
    const claims = await db.giftAidClaim.findMany({
      where: {
        charityId: { in: charityScope },
        OR: [
          shouldInclude("GIFT_AID_CLAIM_UNPAID")
            ? { status: { in: ["DRAFT", "SUBMITTED", "ACCEPTED"] } }
            : undefined,
          shouldInclude("GIFT_AID_PAID_UNALLOCATED")
            ? { status: "PAID" }
            : undefined,
        ].filter(Boolean) as object[],
      },
      include: {
        charity: { select: { id: true, name: true } },
        items: {
          include: {
            declaration: {
              select: {
                donationId: true,
                donation: {
                  select: {
                    payoutItems: {
                      where: { itemType: "GIFT_AID" },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { periodStart: "desc" }],
    });

    for (const claim of claims) {
      const claimDate = claim.createdAt;
      if (!inRange(claimDate, range)) {
        continue;
      }

      if (shouldInclude("GIFT_AID_CLAIM_UNPAID") && ["DRAFT", "SUBMITTED", "ACCEPTED"].includes(claim.status)) {
        exceptions.push({
          exceptionType: "GIFT_AID_CLAIM_UNPAID",
          exceptionStatus: "OPEN",
          charityId: claim.charity.id,
          charityName: claim.charity.name,
          relatedEntityType: "GIFT_AID_CLAIM",
          relatedEntityId: claim.id,
          relatedDate: claimDate,
          summary: `Gift Aid claim is ${claim.status.toLowerCase()} and not yet paid.`,
          actionHint: claim.status === "DRAFT" ? "Submit the claim to HMRC." : "Track claim progress and mark paid when settled.",
          donationRef: "",
          payoutBatchRef: "",
          giftAidClaimRef: claim.id,
        });
      }

      if (shouldInclude("GIFT_AID_PAID_UNALLOCATED") && claim.status === "PAID") {
        const linkedDonations = claim.items
          .map((item) => item.declaration.donation)
          .filter((donation): donation is NonNullable<typeof donation> => Boolean(donation));
        const hasUnallocated = linkedDonations.some((donation) => donation.payoutItems.length === 0);
        if (hasUnallocated) {
          exceptions.push({
            exceptionType: "GIFT_AID_PAID_UNALLOCATED",
            exceptionStatus: "WARNING",
            charityId: claim.charity.id,
            charityName: claim.charity.name,
            relatedEntityType: "GIFT_AID_CLAIM",
            relatedEntityId: claim.id,
            relatedDate: claim.paidAt ?? claimDate,
            summary: "Claim is paid but one or more linked donations have no Gift Aid payout allocation yet.",
            actionHint: "Create/refresh payout batches so paid Gift Aid is allocated.",
            donationRef: "",
            payoutBatchRef: "",
            giftAidClaimRef: claim.id,
          });
        }
      }
    }
  }

  return exceptions
    .filter((row) => (wantedStatus ? row.exceptionStatus === wantedStatus : true))
    .sort((a, b) => b.relatedDate.getTime() - a.relatedDate.getTime());
}

export async function getReconciliationDashboardData(input: {
  scopedCharityIds: string[];
  filters: ReconciliationFilters;
}) {
  const [payoutRows, giftAidRows, exceptionRows] = await Promise.all([
    getPayoutReconciliationRows(input),
    getGiftAidReconciliationRows(input),
    getFinanceExceptionRows(input),
  ]);

  return {
    payoutRows,
    giftAidRows,
    exceptionRows,
  };
}
