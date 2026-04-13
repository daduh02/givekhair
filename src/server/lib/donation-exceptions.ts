import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recordRefund, ACCOUNTS } from "@/server/lib/ledger";

function toDecimal(value: { toString(): string } | null | undefined) {
  return new Decimal(value?.toString() ?? "0");
}

async function syncDonationOperationalStatus(donationId: string) {
  const donation = await db.donation.findUnique({
    where: { id: donationId },
    include: {
      refunds: true,
      disputes: true,
    },
  });

  if (!donation) {
    throw new Error("Donation not found.");
  }

  const baseStatus = donation.status;
  if (!["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"].includes(baseStatus)) {
    return donation;
  }

  const successfulRefunds = donation.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const refundedAmount = successfulRefunds.reduce((sum, refund) => sum.plus(toDecimal(refund.amount)), new Decimal(0));
  const donationAmount = toDecimal(donation.donationAmount ?? donation.amount);
  const openDispute = donation.disputes.some((dispute) => ["OPEN", "UNDER_REVIEW"].includes(dispute.status));

  let nextStatus = donation.status;
  if (openDispute) {
    nextStatus = "DISPUTED";
  } else if (refundedAmount.greaterThanOrEqualTo(donationAmount)) {
    nextStatus = "REFUNDED";
  } else if (refundedAmount.greaterThan(0)) {
    nextStatus = "PARTIALLY_REFUNDED";
  } else if (["PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"].includes(donation.status)) {
    nextStatus = "CAPTURED";
  }

  if (nextStatus !== donation.status) {
    return db.donation.update({
      where: { id: donation.id },
      data: { status: nextStatus },
      include: {
        refunds: true,
        disputes: true,
      },
    });
  }

  return donation;
}

export async function createRefundRecord(input: {
  donationId: string;
  amount: number;
  reason?: string | null;
  initiatedBy: string;
  providerRef?: string | null;
  status?: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
}) {
  const donation = await db.donation.findUnique({
    where: { id: input.donationId },
    include: {
      feeSet: true,
      refunds: true,
      payment: true,
      journalEntries: { select: { id: true } },
    },
  });

  if (!donation) {
    throw new Error("Donation not found.");
  }

  if (donation.status !== "CAPTURED" && donation.status !== "PARTIALLY_REFUNDED" && donation.status !== "DISPUTED") {
    throw new Error("Only captured or already-exceptioned donations can be refunded.");
  }

  const donationAmount = toDecimal(donation.donationAmount ?? donation.amount);
  const requestedAmount = new Decimal(input.amount).toDecimalPlaces(2);
  if (requestedAmount.lte(0)) {
    throw new Error("Refund amount must be greater than zero.");
  }

  const succeededRefunds = donation.refunds.filter((refund) => refund.status === "SUCCEEDED");
  const refundedAmount = succeededRefunds.reduce((sum, refund) => sum.plus(toDecimal(refund.amount)), new Decimal(0));
  const remaining = Decimal.max(donationAmount.minus(refundedAmount), 0);

  if (requestedAmount.greaterThan(remaining)) {
    throw new Error("Refund amount is greater than the remaining refundable donation amount.");
  }

  const status = input.status ?? "REQUESTED";
  const created = await db.refund.create({
    data: {
      donationId: donation.id,
      amount: requestedAmount.toFixed(2),
      reason: input.reason ?? null,
      providerRef: input.providerRef ?? null,
      initiatedBy: input.initiatedBy,
      status,
      processedAt: status === "SUCCEEDED" ? new Date() : null,
    },
  });

  if (status === "SUCCEEDED") {
    await ensureRefundFinancialImpact({
      donationId: donation.id,
      refundId: created.id,
    });
  } else {
    await syncDonationOperationalStatus(donation.id);
  }

  return created;
}

export async function updateRefundRecord(input: {
  refundId: string;
  status: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  providerRef?: string | null;
  reason?: string | null;
}) {
  const refund = await db.refund.findUnique({
    where: { id: input.refundId },
    include: {
      donation: {
        include: {
          feeSet: true,
          journalEntries: { select: { refundId: true } },
        },
      },
      journalEntries: { select: { id: true } },
    },
  });

  if (!refund) {
    throw new Error("Refund record not found.");
  }

  if (refund.journalEntries.length > 0 && input.status !== "SUCCEEDED") {
    throw new Error("This refund already has a recorded ledger impact and cannot be moved away from succeeded.");
  }

  const updated = await db.refund.update({
    where: { id: refund.id },
    data: {
      status: input.status,
      providerRef: input.providerRef ?? refund.providerRef,
      reason: input.reason ?? refund.reason,
      processedAt: input.status === "SUCCEEDED" ? refund.processedAt ?? new Date() : input.status === "FAILED" || input.status === "CANCELLED" ? null : refund.processedAt,
    },
  });

  if (input.status === "SUCCEEDED") {
    await ensureRefundFinancialImpact({
      donationId: refund.donationId,
      refundId: refund.id,
    });
  } else {
    await syncDonationOperationalStatus(refund.donationId);
  }

  return updated;
}

async function ensureRefundFinancialImpact(input: { donationId: string; refundId: string }) {
  const refund = await db.refund.findUnique({
    where: { id: input.refundId },
    include: {
      donation: {
        include: {
          feeSet: true,
          refunds: true,
        },
      },
      journalEntries: { select: { id: true } },
    },
  });

  if (!refund) {
    throw new Error("Refund record not found.");
  }

  if (refund.status !== "SUCCEEDED") {
    return;
  }

  if (refund.journalEntries.length === 0) {
    const donationAmount = toDecimal(refund.donation.donationAmount ?? refund.donation.amount);
    const refundAmount = toDecimal(refund.amount);
    const proportionalRatio = donationAmount.equals(0) ? new Decimal(0) : refundAmount.div(donationAmount);
    const platformFee = toDecimal(refund.donation.feeSet?.platformFeeAmount).times(proportionalRatio).toDecimalPlaces(2);
    const processingFee = toDecimal(refund.donation.feeSet?.processingFeeAmount).times(proportionalRatio).toDecimalPlaces(2);

    await recordRefund({
      donationId: refund.donationId,
      refundId: refund.id,
      amount: refundAmount,
      platformFee,
      processingFee,
      clawbackFees: false,
    });
  }

  await syncDonationOperationalStatus(refund.donationId);
}

export async function createDisputeRecord(input: {
  donationId: string;
  amount: number;
  currency: string;
  reason?: string | null;
  providerRef?: string | null;
  evidenceDueAt?: Date | null;
  notes?: string | null;
  recordedById?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
}) {
  const donation = await db.donation.findUnique({
    where: { id: input.donationId },
    select: { id: true, status: true },
  });

  if (!donation) {
    throw new Error("Donation not found.");
  }

  const amount = new Decimal(input.amount).toDecimalPlaces(2);
  if (amount.lte(0)) {
    throw new Error("Dispute amount must be greater than zero.");
  }

  const dispute = await db.dispute.create({
    data: {
      donationId: donation.id,
      amount: amount.toFixed(2),
      currency: input.currency,
      reason: input.reason ?? null,
      providerRef: input.providerRef ?? null,
      evidenceDueAt: input.evidenceDueAt ?? null,
      notes: input.notes ?? null,
      recordedById: input.recordedById ?? null,
      metadataJson: input.metadataJson ?? undefined,
      status: "OPEN",
    },
  });

  await syncDonationOperationalStatus(donation.id);
  return dispute;
}

export async function updateDisputeRecord(input: {
  disputeId: string;
  status: "OPEN" | "UNDER_REVIEW" | "WON" | "LOST" | "CLOSED";
  outcome?: "WON" | "LOST" | "WRITTEN_OFF" | null;
  notes?: string | null;
  evidenceDueAt?: Date | null;
  providerRef?: string | null;
}) {
  const dispute = await db.dispute.findUnique({
    where: { id: input.disputeId },
    include: {
      donation: {
        include: {
          journalEntries: { select: { id: true } },
        },
      },
      journalEntries: { select: { id: true } },
    },
  });

  if (!dispute) {
    throw new Error("Dispute record not found.");
  }

  if (dispute.financialImpactRecordedAt && input.status !== "LOST" && input.outcome !== "LOST") {
    throw new Error("This dispute already has a recorded financial impact and cannot be moved away from a loss state.");
  }

  const updated = await db.dispute.update({
    where: { id: dispute.id },
    data: {
      status: input.status,
      outcome: input.outcome ?? dispute.outcome,
      notes: input.notes ?? dispute.notes,
      evidenceDueAt: input.evidenceDueAt ?? dispute.evidenceDueAt,
      providerRef: input.providerRef ?? dispute.providerRef,
      closedAt: ["WON", "LOST", "CLOSED"].includes(input.status) ? dispute.closedAt ?? new Date() : null,
    },
  });

  if ((input.status === "LOST" || input.outcome === "LOST") && dispute.journalEntries.length === 0) {
    await recordDisputeLoss(dispute.id);
  }

  await syncDonationOperationalStatus(dispute.donationId);
  return updated;
}

async function recordDisputeLoss(disputeId: string) {
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      journalEntries: { select: { id: true } },
      donation: true,
    },
  });

  if (!dispute || dispute.journalEntries.length > 0) {
    return;
  }

  const amount = toDecimal(dispute.amount);
  await db.journalEntry.create({
    data: {
      correlationId: `dispute:${dispute.id}`,
      donationId: dispute.donationId,
      disputeId: dispute.id,
      description: `Chargeback/dispute loss £${amount.toFixed(2)}`,
      lines: {
        create: [
          {
            accountCode: ACCOUNTS.CHARITY_PAYABLE,
            debit: amount.toFixed(2),
            credit: "0.00",
            currency: dispute.currency,
            fxRate: "1.000000",
            description: `Chargeback loss £${amount.toFixed(2)}`,
          },
          {
            accountCode: ACCOUNTS.DONOR_CLEARING,
            debit: "0.00",
            credit: amount.toFixed(2),
            currency: dispute.currency,
            fxRate: "1.000000",
            description: `Chargeback loss £${amount.toFixed(2)}`,
          },
        ],
      },
    },
  });

  await db.dispute.update({
    where: { id: dispute.id },
    data: { financialImpactRecordedAt: new Date() },
  });
}

export function getRefundedAmount(refunds: Array<{ amount: { toString(): string }; status: string }>) {
  return refunds.reduce(
    (sum, refund) => (refund.status === "SUCCEEDED" ? sum.plus(toDecimal(refund.amount)) : sum),
    new Decimal(0),
  );
}

export function getOpenDispute(disputes: Array<{ status: string }>) {
  return disputes.find((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") ?? null;
}
