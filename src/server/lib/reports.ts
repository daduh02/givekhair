import { endOfDay, startOfDay } from "date-fns";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

export type ReportsRole = UserRole | "DONOR" | "FUNDRAISER" | "TEAM_LEAD";

export type ReportScope = {
  charities: Array<{ id: string; name: string }>;
  scopedCharityIds: string[];
  managedCharityId: string | null;
};

export type ReportFilters = {
  charityId?: string | null;
  start?: string | null;
  end?: string | null;
};

export async function resolveAdminReportScope(input: {
  userId: string;
  role: ReportsRole;
  charityId?: string | null;
}): Promise<ReportScope> {
  if (input.role === "PLATFORM_ADMIN" || input.role === "FINANCE") {
    const charities = await db.charity.findMany({
      where: input.charityId ? { id: input.charityId } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      charities,
      scopedCharityIds: charities.map((charity) => charity.id),
      managedCharityId: input.charityId ?? null,
    };
  }

  const assignment = await db.charityAdmin.findFirst({
    where: { userId: input.userId },
    select: { charityId: true, charity: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!assignment) {
    return {
      charities: [],
      scopedCharityIds: [],
      managedCharityId: null,
    };
  }

  return {
    charities: [{ id: assignment.charity.id, name: assignment.charity.name }],
    scopedCharityIds: [assignment.charityId],
    managedCharityId: assignment.charityId,
  };
}

export function getCreatedAtRange(filters: ReportFilters) {
  return {
    ...(filters.start ? { gte: startOfDay(new Date(filters.start)) } : {}),
    ...(filters.end ? { lte: endOfDay(new Date(filters.end)) } : {}),
  };
}

export async function getDonationsReportRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getCreatedAtRange(input.filters);

  return db.donation.findMany({
    where: {
      page: { appeal: { charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] } } },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: {
      page: {
        select: {
          title: true,
          shortName: true,
          appeal: { select: { title: true, charity: { select: { name: true } } } },
        },
      },
      giftAidDeclaration: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOfflineDonationsReportRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const receivedDate = {
    ...(input.filters.start ? { gte: startOfDay(new Date(input.filters.start)) } : {}),
    ...(input.filters.end ? { lte: endOfDay(new Date(input.filters.end)) } : {}),
  };

  return db.offlineDonation.findMany({
    where: {
      page: { appeal: { charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] } } },
      ...(Object.keys(receivedDate).length ? { receivedDate } : {}),
    },
    include: {
      page: {
        select: {
          title: true,
          shortName: true,
          appeal: { select: { title: true, charity: { select: { name: true } } } },
        },
      },
      giftAidDeclaration: { select: { id: true } },
      batch: { select: { fileName: true } },
    },
    orderBy: { receivedDate: "desc" },
  });
}

export async function getPayoutsReportRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getCreatedAtRange(input.filters);

  return db.payoutBatch.findMany({
    where: {
      charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: {
      charity: { select: { name: true } },
      bankAccount: { select: { accountName: true, maskedAccount: true, maskedSortCode: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGiftAidClaimsReportRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getCreatedAtRange(input.filters);

  return db.giftAidClaim.findMany({
    where: {
      charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] },
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    include: {
      charity: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });
}

export async function getGeneralLedgerReportRows(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const createdAt = getCreatedAtRange(input.filters);
  const scopedClaimIds = await db.giftAidClaim.findMany({
    where: {
      charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] },
    },
    select: { id: true },
  });

  const scopedCorrelationIds = scopedClaimIds.map((claim) => `gift-aid-claim:${claim.id}`);

  // Ledger exports need to stay charity-aware even though not every ledger
  // entry has a direct charity foreign key. We scope through donations,
  // payouts, and Gift Aid claim correlation ids.
  return db.journalEntry.findMany({
    where: {
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      OR: [
        {
          donation: {
            page: {
              appeal: {
                charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] },
              },
            },
          },
        },
        {
          payoutBatch: {
            charityId: { in: input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"] },
          },
        },
        ...(scopedCorrelationIds.length > 0
          ? [{ correlationId: { in: scopedCorrelationIds } }]
          : []),
      ],
    },
    include: {
      lines: true,
      donation: {
        select: {
          id: true,
          page: {
            select: {
              appeal: {
                select: {
                  title: true,
                  charity: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      payoutBatch: {
        select: {
          id: true,
          charity: { select: { name: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function getReportsDashboardData(input: {
  scopedCharityIds: string[];
  filters: ReportFilters;
}) {
  const [donations, offlineDonations, payouts, claims, ledgerEntries] = await Promise.all([
    getDonationsReportRows(input),
    getOfflineDonationsReportRows(input),
    getPayoutsReportRows(input),
    getGiftAidClaimsReportRows(input),
    getGeneralLedgerReportRows(input),
  ]);

  return {
    donations,
    offlineDonations,
    payouts,
    claims,
    ledgerEntries,
  };
}
