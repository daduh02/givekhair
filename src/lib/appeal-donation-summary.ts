import { db } from "@/lib/db";

function decimalToNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : parseFloat(value.toString());
}

export type AppealDonationSummaryData = {
  total: number;
  online: number;
  offline: number;
  direct: number;
  fundraisers: number;
};

export function buildAppealDonationSummary(input: {
  onlineDirect: number;
  offlineDirect: number;
  onlineFundraisers: number;
  offlineFundraisers: number;
}): AppealDonationSummaryData {
  const online = input.onlineDirect + input.onlineFundraisers;
  const offline = input.offlineDirect + input.offlineFundraisers;
  const direct = input.onlineDirect + input.offlineDirect;
  const fundraisers = input.onlineFundraisers + input.offlineFundraisers;

  return {
    total: online + offline,
    online,
    offline,
    direct,
    fundraisers,
  };
}

export async function getAppealDonationSummary(input: {
  appealId: string;
  directPageId: string;
}) {
  const [onlineDirectAgg, offlineDirectAgg, onlineFundraiserAgg, offlineFundraiserAgg] = await Promise.all([
    db.donation.aggregate({
      where: {
        pageId: input.directPageId,
        status: "CAPTURED",
      },
      _sum: { amount: true },
    }),
    db.offlineDonation.aggregate({
      where: {
        pageId: input.directPageId,
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: {
          appealId: input.appealId,
          id: { not: input.directPageId },
        },
      },
      _sum: { amount: true },
    }),
    db.offlineDonation.aggregate({
      where: {
        status: "APPROVED",
        page: {
          appealId: input.appealId,
          id: { not: input.directPageId },
        },
      },
      _sum: { amount: true },
    }),
  ]);

  return buildAppealDonationSummary({
    onlineDirect: decimalToNumber(onlineDirectAgg._sum.amount),
    offlineDirect: decimalToNumber(offlineDirectAgg._sum.amount),
    onlineFundraisers: decimalToNumber(onlineFundraiserAgg._sum.amount),
    offlineFundraisers: decimalToNumber(offlineFundraiserAgg._sum.amount),
  });
}
