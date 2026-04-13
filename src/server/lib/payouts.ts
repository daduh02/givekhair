import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recordPayoutPaid } from "@/server/lib/ledger";
import { resolvePayoutPolicy } from "@/server/lib/commercials";

type EligibleDonation = {
  id: string;
  currency: string;
  donationAmount: Decimal;
  feeChargedToCharity: Decimal;
  charityNetAmount: Decimal;
  giftAidReceivedAmount: Decimal;
};

function toDecimal(value: { toString(): string } | null | undefined) {
  return new Decimal(value?.toString() ?? "0");
}

async function getDefaultBankAccount(charityId: string) {
  const bankAccount = await db.bankAccount.findFirst({
    where: {
      charityId,
      OR: [{ isDefault: true }, { isVerified: true }],
    },
    orderBy: [{ isDefault: "desc" }, { isVerified: "desc" }, { createdAt: "asc" }],
  });

  if (!bankAccount) {
    throw new Error("No verified bank account is configured for this charity.");
  }

  return bankAccount;
}

async function getEligibleDonations(charityId: string): Promise<EligibleDonation[]> {
  const donations = await db.donation.findMany({
    where: {
      status: "CAPTURED",
      page: { appeal: { charityId } },
      payoutItems: { none: {} },
    },
    select: {
      id: true,
      currency: true,
      amount: true,
      donationAmount: true,
      feeChargedToCharity: true,
      charityNetAmount: true,
      giftAidReceivedAmount: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return donations.map((donation) => ({
    id: donation.id,
    currency: donation.currency,
    donationAmount: toDecimal(donation.donationAmount ?? donation.amount),
    feeChargedToCharity: toDecimal(donation.feeChargedToCharity),
    charityNetAmount: toDecimal(donation.charityNetAmount ?? donation.amount),
    giftAidReceivedAmount: toDecimal(donation.giftAidReceivedAmount),
  }));
}

export async function getCharityPayoutOverview(charityId: string) {
  const policy = await resolvePayoutPolicy(charityId);
  const [captured, paidGiftAid, existingBatches, unbatchedDonations] = await Promise.all([
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId } },
      },
      _sum: {
        charityNetAmount: true,
      },
    }),
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId } },
      },
      _sum: {
        giftAidReceivedAmount: true,
      },
    }),
    db.payoutBatch.aggregate({
      where: {
        charityId,
        status: { in: ["SCHEDULED", "PROCESSING", "PAID"] },
      },
      _sum: {
        netAmount: true,
      },
    }),
    getEligibleDonations(charityId),
  ]);

  const donationNet = toDecimal(captured._sum.charityNetAmount);
  const giftAidReceived = toDecimal(paidGiftAid._sum.giftAidReceivedAmount);
  const alreadyBatched = toDecimal(existingBatches._sum.netAmount);
  const eligibleBeforeBlock = donationNet.plus(giftAidReceived);
  const unbatchedNetAmount = unbatchedDonations.reduce((sum, donation) => sum.plus(donation.charityNetAmount).plus(donation.giftAidReceivedAmount), new Decimal(0));

  return {
    contract: policy.contract,
    payoutsBlocked: policy.blocked,
    blockReason: policy.reason,
    donationNetAmount: donationNet,
    giftAidReceivedAmount: giftAidReceived,
    eligiblePayoutAmount: policy.blocked ? new Decimal(0) : Decimal.max(eligibleBeforeBlock.minus(alreadyBatched), 0),
    existingBatchedAmount: alreadyBatched,
    unbatchedDonationCount: unbatchedDonations.length,
    unbatchedNetAmount,
  };
}

export async function createScheduledPayoutBatch(charityId: string) {
  const policy = await resolvePayoutPolicy(charityId);
  if (policy.blocked) {
    throw new Error(policy.reason ?? "Payouts are currently blocked.");
  }

  const bankAccount = await getDefaultBankAccount(charityId);
  const eligibleDonations = await getEligibleDonations(charityId);

  if (eligibleDonations.length === 0) {
    throw new Error("No eligible donations are available for payout.");
  }

  const currencies = new Set(eligibleDonations.map((donation) => donation.currency));
  if (currencies.size > 1) {
    throw new Error("Multiple payout currencies are not yet supported in one batch.");
  }

  const grossAmount = eligibleDonations.reduce((sum, donation) => sum.plus(donation.donationAmount).plus(donation.giftAidReceivedAmount), new Decimal(0));
  const feesAmount = eligibleDonations.reduce((sum, donation) => sum.plus(donation.feeChargedToCharity), new Decimal(0));
  const netAmount = eligibleDonations.reduce((sum, donation) => sum.plus(donation.charityNetAmount).plus(donation.giftAidReceivedAmount), new Decimal(0));
  const currency = eligibleDonations[0]?.currency ?? bankAccount.currency;

  // Batch items make the payout traceable without replacing the existing
  // payout entities. They let us tie scheduled batches back to captured
  // donations and received Gift Aid entries.
  return db.payoutBatch.create({
    data: {
      charityId,
      bankAccountId: bankAccount.id,
      currency,
      grossAmount: grossAmount.toFixed(2),
      feesAmount: feesAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      status: "SCHEDULED",
      scheduledFor: new Date(),
      idempotencyKey: randomUUID(),
      items: {
        create: eligibleDonations.flatMap((donation) => {
          const items: Prisma.PayoutBatchItemUncheckedCreateWithoutPayoutBatchInput[] = [
            {
              donationId: donation.id,
              itemType: "DONATION" as const,
              grossAmount: donation.donationAmount.toFixed(2),
              feesAmount: donation.feeChargedToCharity.toFixed(2),
              netAmount: donation.charityNetAmount.toFixed(2),
              notes: "Donation net allocation",
            },
          ];

          if (donation.giftAidReceivedAmount.greaterThan(0)) {
            items.push({
              donationId: donation.id,
              itemType: "GIFT_AID" as const,
              grossAmount: donation.giftAidReceivedAmount.toFixed(2),
              feesAmount: "0.00",
              netAmount: donation.giftAidReceivedAmount.toFixed(2),
              notes: "Gift Aid received passes through in full",
            });
          }

          return items;
        }),
      },
    },
    include: {
      items: true,
      bankAccount: true,
      charity: true,
    },
  });
}

export async function markPayoutBatchProcessing(payoutBatchId: string) {
  return db.payoutBatch.update({
    where: { id: payoutBatchId },
    data: { status: "PROCESSING" },
    include: {
      charity: true,
      bankAccount: true,
      items: true,
    },
  });
}

export async function markPayoutBatchPaid(input: {
  payoutBatchId: string;
  providerRef?: string | null;
  bankRef?: string | null;
}) {
  const batch = await db.payoutBatch.findUnique({
    where: { id: input.payoutBatchId },
    include: {
      items: true,
      journalEntries: { select: { id: true }, take: 1 },
    },
  });

  if (!batch) {
    throw new Error("Payout batch not found.");
  }

  const updated = await db.payoutBatch.update({
    where: { id: batch.id },
    data: {
      status: "PAID",
      processedAt: new Date(),
      providerRef: input.providerRef ?? batch.providerRef,
      bankRef: input.bankRef ?? batch.bankRef,
    },
  });

  if (batch.journalEntries.length === 0) {
    await recordPayoutPaid({
      payoutBatchId: batch.id,
      amount: toDecimal(batch.netAmount),
      currency: batch.currency,
    });
  }

  return updated;
}
