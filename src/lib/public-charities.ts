import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export type PublicDirectoryCharity = Awaited<ReturnType<typeof getPublicCharityDirectory>>[number];
export type PublicCharityProfile = Awaited<ReturnType<typeof getPublicCharityProfile>>;

function decimalToNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : parseFloat(value.toString());
}

async function getCharityRaisedTotal(charityId: string) {
  // The explicit online/offline split mirrors the fundraising reporting model
  // elsewhere in the app and keeps "includes offline" messaging accurate.
  const [online, offline] = await Promise.all([
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId } },
      },
      _sum: { amount: true },
    }),
    db.offlineDonation.aggregate({
      where: {
        status: "APPROVED",
        page: { appeal: { charityId } },
      },
      _sum: { amount: true },
    }),
  ]);

  return decimalToNumber(online._sum.amount) + decimalToNumber(offline._sum.amount);
}

async function getCharityRaisedTotalsMap(charityIds: string[]) {
  if (charityIds.length === 0) {
    return new Map<string, number>();
  }

  const [donations, offlineDonations] = await Promise.all([
    db.donation.findMany({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId: { in: charityIds } } },
      },
      select: {
        amount: true,
        page: {
          select: {
            appeal: {
              select: {
                charityId: true,
              },
            },
          },
        },
      },
    }),
    db.offlineDonation.findMany({
      where: {
        status: "APPROVED",
        page: { appeal: { charityId: { in: charityIds } } },
      },
      select: {
        amount: true,
        page: {
          select: {
            appeal: {
              select: {
                charityId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totals = new Map<string, number>();

  for (const charityId of charityIds) {
    totals.set(charityId, 0);
  }

  for (const donation of donations) {
    const charityId = donation.page.appeal.charityId;
    totals.set(charityId, (totals.get(charityId) ?? 0) + decimalToNumber(donation.amount));
  }

  for (const donation of offlineDonations) {
    const charityId = donation.page?.appeal.charityId;
    if (!charityId) {
      continue;
    }

    totals.set(charityId, (totals.get(charityId) ?? 0) + decimalToNumber(donation.amount));
  }

  return totals;
}

async function getFundraiserCountsMap(charityIds: string[]) {
  if (charityIds.length === 0) {
    return new Map<string, number>();
  }

  const fundraisingPages = await db.fundraisingPage.findMany({
    where: {
      appeal: { charityId: { in: charityIds } },
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
    select: {
      appeal: {
        select: {
          charityId: true,
        },
      },
    },
  });

  const counts = new Map<string, number>();

  for (const charityId of charityIds) {
    counts.set(charityId, 0);
  }

  for (const page of fundraisingPages) {
    const charityId = page.appeal.charityId;
    counts.set(charityId, (counts.get(charityId) ?? 0) + 1);
  }

  return counts;
}

export async function getPublicCharityDirectory() {
  const charities = await db.charity.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
    include: {
      appeals: {
        where: { status: "ACTIVE", visibility: "PUBLIC" },
        select: {
          id: true,
          slug: true,
          title: true,
        },
        take: 3,
      },
      _count: {
        select: {
          appeals: true,
        },
      },
    },
  });

  const charityIds = charities.map((charity) => charity.id);
  const [raisedTotalsByCharity, fundraiserCountsByCharity] = await Promise.all([
    getCharityRaisedTotalsMap(charityIds),
    getFundraiserCountsMap(charityIds),
  ]);

  return charities.map((charity) => ({
    ...charity,
    raisedTotal: raisedTotalsByCharity.get(charity.id) ?? 0,
    fundraiserCount: fundraiserCountsByCharity.get(charity.id) ?? 0,
  }));
}

export async function getPublicCharityProfile(slug: string) {
  const charity = await db.charity.findFirst({
    where: {
      slug,
      status: "ACTIVE",
    },
    include: {
      appeals: {
        where: {
          status: "ACTIVE",
          visibility: "PUBLIC",
        },
        include: {
          charity: { select: { name: true, logoUrl: true, isVerified: true } },
          _count: { select: { fundraisingPages: true, teams: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });

  if (!charity) {
    notFound();
  }

  // We keep the public profile query composed from a few targeted reads instead
  // of one huge include so each section can evolve independently later.
  const [raisedTotal, donorCount, fundraiserPages, fundraiserCount, teamsCount] = await Promise.all([
    getCharityRaisedTotal(charity.id),
    db.donation.count({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId: charity.id } },
      },
    }),
    db.fundraisingPage.findMany({
      where: {
        appeal: { charityId: charity.id },
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
      include: {
        user: { select: { name: true } },
        appeal: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
        take: 4,
      }),
    db.fundraisingPage.count({
      where: {
        appeal: { charityId: charity.id },
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
    }),
    db.team.count({
      where: {
        appeal: { charityId: charity.id },
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
    }),
  ]);

  return {
    charity,
    raisedTotal,
    donorCount,
    fundraiserPages,
    fundraiserCount,
    teamsCount,
  };
}
