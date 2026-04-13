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

  return Promise.all(
    charities.map(async (charity) => {
      const [raisedTotal, fundraiserCount] = await Promise.all([
        getCharityRaisedTotal(charity.id),
        db.fundraisingPage.count({
          where: {
            appeal: { charityId: charity.id },
            status: "ACTIVE",
            visibility: "PUBLIC",
          },
        }),
      ]);

      return {
        ...charity,
        raisedTotal,
        fundraiserCount,
      };
    })
  );
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
