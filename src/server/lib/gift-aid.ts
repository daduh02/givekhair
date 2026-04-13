import Decimal from "decimal.js";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { recordGiftAidPaid } from "@/server/lib/ledger";

function getClaimPeriod(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function toDecimal(value: { toString(): string } | null | undefined) {
  return new Decimal(value?.toString() ?? "0");
}

export async function queueEligibleGiftAidDeclarations(charityId: string) {
  // We build claims from declarations that are not yet attached to any claim.
  // Captured online donations are the primary settlement path because their
  // reclaim amounts feed back into donation payout totals once a claim is paid.
  const declarations = await db.giftAidDeclaration.findMany({
    where: {
      revokedAt: null,
      giftAidClaimItems: { none: {} },
      OR: [
        {
          donation: {
            status: "CAPTURED",
            page: { appeal: { charityId } },
          },
        },
        {
          offlineDonation: {
            status: "APPROVED",
            page: { appeal: { charityId } },
          },
        },
      ],
    },
    include: {
      donation: {
        select: {
          id: true,
          createdAt: true,
          amount: true,
          donationAmount: true,
        },
      },
      offlineDonation: {
        select: {
          id: true,
          createdAt: true,
          amount: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let createdItems = 0;

  for (const declaration of declarations) {
    const sourceDate = declaration.donation?.createdAt ?? declaration.offlineDonation?.createdAt ?? declaration.createdAt;
    const donationAmount = toDecimal(declaration.donation?.donationAmount ?? declaration.donation?.amount ?? declaration.offlineDonation?.amount);
    const reclaimAmount = donationAmount.times(0.25).toDecimalPlaces(2);
    const { start, end } = getClaimPeriod(sourceDate);

    await db.$transaction(async (tx) => {
      let claim = await tx.giftAidClaim.findFirst({
        where: {
          charityId,
          status: "DRAFT",
          periodStart: start,
          periodEnd: end,
        },
      });

      if (!claim) {
        claim = await tx.giftAidClaim.create({
          data: {
            charityId,
            periodStart: start,
            periodEnd: end,
            status: "DRAFT",
            totalDonations: "0.00",
            reclaimAmount: "0.00",
          },
        });
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
          totalDonations: toDecimal(claim.totalDonations).plus(donationAmount).toFixed(2),
          reclaimAmount: toDecimal(claim.reclaimAmount).plus(reclaimAmount).toFixed(2),
        },
      });
    });

    createdItems += 1;
  }

  return { createdItems };
}

export async function submitGiftAidClaim(claimId: string, hmrcRef?: string | null) {
  const claim = await db.giftAidClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    throw new Error("Gift Aid claim not found.");
  }

  if (claim.status !== "DRAFT") {
    throw new Error("Only draft Gift Aid claims can be submitted.");
  }

  return db.giftAidClaim.update({
    where: { id: claimId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      hmrcRef: hmrcRef || claim.hmrcRef,
    },
  });
}

export async function markGiftAidClaimPaid(claimId: string) {
  const claim = await db.giftAidClaim.findUnique({
    where: { id: claimId },
    include: {
      items: {
        include: {
          declaration: {
            select: {
              donationId: true,
            },
          },
        },
      },
    },
  });

  if (!claim) {
    throw new Error("Gift Aid claim not found.");
  }

  if (claim.status === "PAID") {
    return claim;
  }

  if (!["SUBMITTED", "ACCEPTED"].includes(claim.status)) {
    throw new Error("Gift Aid claim must be submitted or accepted before it can be marked paid.");
  }

  const correlationId = `gift-aid-claim:${claim.id}`;

  await db.$transaction(async (tx) => {
    for (const item of claim.items) {
      if (item.declaration.donationId) {
        await tx.donation.update({
          where: { id: item.declaration.donationId },
          data: {
            giftAidReceivedAmount: item.reclaimAmount.toFixed(2),
          },
        });
      }
    }

    await tx.giftAidClaim.update({
      where: { id: claim.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });
  });

  const existingLedgerEntry = await db.journalEntry.findFirst({
    where: { correlationId },
    select: { id: true },
  });

  if (!existingLedgerEntry) {
    await recordGiftAidPaid({
      amount: toDecimal(claim.reclaimAmount),
      correlationId,
    });
  }

  return db.giftAidClaim.findUnique({
    where: { id: claim.id },
    include: {
      items: true,
    },
  });
}

export async function getGiftAidOverview(charityId: string) {
  const [claims, declarationCount, expectedAgg, receivedAgg] = await Promise.all([
    db.giftAidClaim.findMany({
      where: { charityId },
      include: {
        items: {
          include: {
            declaration: {
              select: {
                donorFullName: true,
                donationId: true,
                offlineDonationId: true,
              },
            },
          },
        },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      take: 24,
    }),
    db.giftAidDeclaration.count({
      where: {
        revokedAt: null,
        OR: [
          { donation: { page: { appeal: { charityId } } } },
          { offlineDonation: { page: { appeal: { charityId } } } },
        ],
      },
    }),
    db.donation.aggregate({
      where: {
        page: { appeal: { charityId } },
      },
      _sum: {
        giftAidExpectedAmount: true,
      },
    }),
    db.donation.aggregate({
      where: {
        page: { appeal: { charityId } },
      },
      _sum: {
        giftAidReceivedAmount: true,
      },
    }),
  ]);

  return {
    claims,
    declarationCount,
    expectedAmount: toDecimal(expectedAgg._sum.giftAidExpectedAmount),
    receivedAmount: toDecimal(receivedAgg._sum.giftAidReceivedAmount),
    pendingClaimAmount: claims
      .filter((claim) => ["DRAFT", "SUBMITTED", "ACCEPTED"].includes(claim.status))
      .reduce((sum, claim) => sum.plus(claim.reclaimAmount.toString()), new Decimal(0)),
  };
}
