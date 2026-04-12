import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { previewFees } from "@/server/lib/fee-engine";
import { recordDonationAuthorised, recordFeesRecognised } from "@/server/lib/ledger";
import { donationsApi } from "@/server/lib/donations-api-stub";

const GIFT_AID_STATEMENT =
  "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.";

type CreateDonationIntentInput = {
  pageId: string;
  amount: number;
  currency?: string;
  donorCoversFees?: boolean;
  isAnonymous?: boolean;
  isRecurring?: boolean;
  donorName?: string;
  donorEmail: string;
  message?: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  giftAid?: {
    donorFullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
  };
};

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

function getClaimPeriod(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

async function addGiftAidDeclarationToDraftClaim(donationId: string) {
  const donation = await db.donation.findUnique({
    where: { id: donationId },
    include: {
      page: { include: { appeal: true } },
      giftAidDeclaration: true,
    },
  });

  if (!donation?.giftAidDeclaration) {
    return;
  }

  const declaration = donation.giftAidDeclaration;

  const existingItem = await db.giftAidClaimItem.findFirst({
    where: { declarationId: declaration.id },
    select: { id: true },
  });

  if (existingItem) {
    return;
  }

  const donationAmount = new Decimal(donation.amount.toString());
  const reclaimAmount = donationAmount.times(0.25).toDecimalPlaces(2);
  const { start, end } = getClaimPeriod(donation.createdAt);

  await db.$transaction(async (tx) => {
    let claim = await tx.giftAidClaim.findFirst({
      where: {
        charityId: donation.page.appeal.charityId,
        status: "DRAFT",
        periodStart: start,
        periodEnd: end,
      },
    });

    if (!claim) {
      claim = await tx.giftAidClaim.create({
        data: {
          charityId: donation.page.appeal.charityId,
          periodStart: start,
          periodEnd: end,
          status: "DRAFT",
          totalDonations: "0.00",
          reclaimAmount: "0.00",
        },
      });
    }

    const duplicate = await tx.giftAidClaimItem.findFirst({
      where: { declarationId: declaration.id },
      select: { id: true },
    });

    if (duplicate) {
      return;
    }

    await tx.giftAidClaimItem.create({
      data: {
        claimId: claim.id,
        declarationId: declaration.id,
        donationAmount: donationAmount.toFixed(2),
        reclaimAmount: reclaimAmount.toFixed(2),
      },
    });

    await tx.giftAidClaim.update({
      where: { id: claim.id },
      data: {
        totalDonations: new Decimal(claim.totalDonations.toString()).plus(donationAmount).toFixed(2),
        reclaimAmount: new Decimal(claim.reclaimAmount.toString()).plus(reclaimAmount).toFixed(2),
      },
    });
  });
}

export async function createDonationIntent(input: CreateDonationIntentInput) {
  const page = await db.fundraisingPage.findUnique({
    where: { id: input.pageId },
    include: { appeal: true },
  });

  if (!page) {
    throw new Error("Fundraiser page not found.");
  }

  const feePreview = await previewFees(input.amount, {
    charityId: page.appeal.charityId,
    donorCoversFees: input.donorCoversFees ?? false,
    paymentMethod: input.isRecurring ? "card_recurring" : "card",
  });

  const idempotencyKey = randomUUID();

  const donation = await db.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        pageId: input.pageId,
        userId: input.userId ?? undefined,
        amount: new Decimal(input.amount).toFixed(2),
        currency: input.currency ?? "GBP",
        status: "PENDING",
        isAnonymous: input.isAnonymous ?? false,
        isRecurring: input.isRecurring ?? false,
        donorName: input.donorName || undefined,
        donorEmail: input.donorEmail,
        message: input.message || undefined,
        idempotencyKey,
      },
    });

    await tx.feeSet.create({
      data: {
        scheduleId: feePreview.scheduleId === "none" ? await getOrCreateDefaultScheduleId(tx) : feePreview.scheduleId,
        donationId: created.id,
        platformFeeAmount: feePreview.platformFeeAmount.toFixed(2),
        processingFeeAmount: feePreview.processingFeeAmount.toFixed(2),
        giftAidFeeAmount: feePreview.giftAidFeeAmount.toFixed(2),
        totalFees: feePreview.totalFees.toFixed(2),
        donorCoversFees: input.donorCoversFees ?? false,
        netToCharity: feePreview.netToCharity.toFixed(2),
        snapshotJson: feePreview.snapshotJson,
      },
    });

    if (input.giftAid) {
      await tx.giftAidDeclaration.create({
        data: {
          donationId: created.id,
          userId: input.userId ?? undefined,
          donorFullName: input.giftAid.donorFullName,
          donorAddressLine1: input.giftAid.addressLine1,
          donorAddressLine2: input.giftAid.addressLine2 || undefined,
          donorCity: input.giftAid.city,
          donorPostcode: input.giftAid.postcode,
          type: "SINGLE",
          statementVersion: "v1",
          statementText: GIFT_AID_STATEMENT,
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
          createdById: input.userId ?? undefined,
        },
      });
    }

    return created;
  });

  const checkout = await donationsApi.createCheckout({
    donationId: donation.id,
    pageExternalId: page.externalPageId ?? page.id,
    amount: parseFloat(feePreview.donorPays.toFixed(2)),
    currency: input.currency ?? "GBP",
    returnUrl: `${getAppUrl()}/donations/thank-you/${donation.id}`,
    cancelUrl: `${getAppUrl()}/appeals/${page.appeal.slug}?checkout=cancelled`,
    idempotencyKey,
  });

  return {
    donationId: donation.id,
    idempotencyKey,
    donorPays: feePreview.donorPays.toFixed(2),
    netToCharity: feePreview.netToCharity.toFixed(2),
    checkoutUrl: checkout.checkoutUrl,
  };
}

export async function markDonationCaptured(input: {
  donationId: string;
  provider: string;
  providerRef: string;
}) {
  const donation = await db.donation.findUnique({
    where: { id: input.donationId },
    include: {
      feeSet: true,
      payment: true,
      journalEntries: { select: { id: true }, take: 1 },
      giftAidDeclaration: { select: { id: true } },
    },
  });

  if (!donation) {
    throw new Error("Donation not found.");
  }

  if (donation.status === "CAPTURED") {
    return donation;
  }

  const donorPays = donation.feeSet?.donorCoversFees
    ? new Decimal(donation.amount.toString()).plus(new Decimal(donation.feeSet.totalFees.toString()))
    : new Decimal(donation.amount.toString());

  await db.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: input.donationId },
      data: {
        status: "CAPTURED",
        externalRef: input.providerRef,
        receiptIssuedAt: donation.donorEmail ? new Date() : null,
      },
    });

    if (donation.payment) {
      await tx.payment.update({
        where: { donationId: input.donationId },
        data: {
          provider: input.provider,
          providerRef: input.providerRef,
          amount: donorPays.toFixed(2),
          currency: donation.currency,
          settledAt: new Date(),
          failureReason: null,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          donationId: input.donationId,
          provider: input.provider,
          providerRef: input.providerRef,
          amount: donorPays.toFixed(2),
          currency: donation.currency,
          settledAt: new Date(),
        },
      });
    }
  });

  if (donation.journalEntries.length === 0) {
    await recordDonationAuthorised({
      donationId: donation.id,
      amount: new Decimal(donation.amount.toString()),
      currency: donation.currency,
    });

    if (donation.feeSet) {
      await recordFeesRecognised({
        donationId: donation.id,
        platformFee: new Decimal(donation.feeSet.platformFeeAmount.toString()),
        processingFee: new Decimal(donation.feeSet.processingFeeAmount.toString()),
        currency: donation.currency,
      });
    }
  }

  if (donation.giftAidDeclaration) {
    await addGiftAidDeclarationToDraftClaim(donation.id);
  }

  return db.donation.findUnique({
    where: { id: donation.id },
    include: { feeSet: true, payment: true, giftAidDeclaration: true },
  });
}

export async function markDonationFailed(input: {
  donationId: string;
  providerRef?: string;
  failureReason?: string | null;
}) {
  const donation = await db.donation.findUnique({
    where: { id: input.donationId },
    include: { payment: true },
  });

  if (!donation) {
    throw new Error("Donation not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: input.donationId },
      data: {
        status: "FAILED",
        externalRef: input.providerRef ?? donation.externalRef,
      },
    });

    if (donation.payment) {
      await tx.payment.update({
        where: { donationId: input.donationId },
        data: {
          failureReason: input.failureReason ?? "Payment failed at checkout.",
        },
      });
    }
  });
}

async function getOrCreateDefaultScheduleId(tx: {
  feeSchedule: {
    findFirst: typeof db.feeSchedule.findFirst;
    create: typeof db.feeSchedule.create;
  };
}) {
  const existing = await tx.feeSchedule.findFirst({
    where: { charityId: null, isActive: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.feeSchedule.create({
    data: {
      version: 1,
      name: "Default platform schedule",
      isActive: true,
      validFrom: new Date(),
    },
  });

  return created.id;
}
