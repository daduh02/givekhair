import { db } from "@/lib/db";
import {
  getGoalProgress,
  getLeaderboardPeriodStart,
  resolveLeaderboardPeriod,
  type LeaderboardPeriod,
  withRank,
} from "@/lib/leaderboard-metrics";

function decimalToNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : parseFloat(value.toString());
}

function buildPeriodFilter(period: LeaderboardPeriod) {
  const start = getLeaderboardPeriodStart(period);
  return {
    donationCreatedAt: start ? { gte: start } : undefined,
    offlineReceivedDate: start ? { gte: start } : undefined,
  };
}

type Ranked = { raisedTotal: number; rank: number; isTied: boolean };

export { getGoalProgress, resolveLeaderboardPeriod };
export type { LeaderboardPeriod };

type PageLeaderboardRow = {
  id: string;
  title: string;
  shortName: string;
  teamId: string | null;
  teamName: string | null;
  userName: string | null;
  status: string;
  visibility: string;
  targetAmount: number;
  onlineTotal: number;
  offlineTotal: number;
  donorCount: number;
  raisedTotal: number;
  progress: number;
};

type TeamLeaderboardRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  visibility: string;
  goalAmount: number;
  fundraiserPageCount: number;
  onlineTotal: number;
  offlineTotal: number;
  donorCount: number;
  raisedTotal: number;
  progress: number;
  topPages: Array<PageLeaderboardRow & Ranked>;
};

export async function getAppealLeaderboard(input: {
  appealId: string;
  publicOnly?: boolean;
  period?: string | null;
}) {
  const period = resolveLeaderboardPeriod(input.period);
  const periodFilter = buildPeriodFilter(period);

  const wherePage = {
    appealId: input.appealId,
    ...(input.publicOnly ? { status: "ACTIVE" as const, visibility: "PUBLIC" as const } : {}),
  };

  const whereTeam = {
    appealId: input.appealId,
    ...(input.publicOnly ? { status: "ACTIVE" as const, visibility: "PUBLIC" as const } : {}),
  };

  const [pages, teams] = await Promise.all([
    db.fundraisingPage.findMany({
      where: wherePage,
      select: {
        id: true,
        title: true,
        shortName: true,
        teamId: true,
        status: true,
        visibility: true,
        targetAmount: true,
        team: { select: { name: true } },
        user: { select: { name: true } },
      },
    }),
    db.team.findMany({
      where: whereTeam,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        visibility: true,
        goalAmount: true,
      },
    }),
  ]);

  const [onlineByPage, offlineByPage, directOnlineTotals, directOfflineTotals] = await Promise.all([
    db.donation.groupBy({
      by: ["pageId"],
      where: {
        status: "CAPTURED",
        createdAt: periodFilter.donationCreatedAt,
        page: { appealId: input.appealId },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.offlineDonation.groupBy({
      by: ["pageId"],
      where: {
        status: "APPROVED",
        receivedDate: periodFilter.offlineReceivedDate,
        page: { appealId: input.appealId },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    input.publicOnly
      ? db.donation.aggregate({
          where: {
            status: "CAPTURED",
            createdAt: periodFilter.donationCreatedAt,
            page: {
              appealId: input.appealId,
              status: "ACTIVE",
              visibility: "HIDDEN",
              teamId: null,
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
    input.publicOnly
      ? db.offlineDonation.aggregate({
          where: {
            status: "APPROVED",
            receivedDate: periodFilter.offlineReceivedDate,
            page: {
              appealId: input.appealId,
              status: "ACTIVE",
              visibility: "HIDDEN",
              teamId: null,
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : Promise.resolve({ _sum: { amount: 0 }, _count: { _all: 0 } }),
  ]);

  const onlineMap = new Map(
    onlineByPage.map((row) => [
      row.pageId,
      {
        amount: decimalToNumber(row._sum.amount),
        count: row._count._all,
      },
    ]),
  );
  const offlineMap = new Map(
    offlineByPage.map((row) => [
      row.pageId,
      {
        amount: decimalToNumber(row._sum.amount),
        count: row._count._all,
      },
    ]),
  );

  const directOnlineAmount = decimalToNumber(directOnlineTotals._sum.amount);
  const directOfflineAmount = decimalToNumber(directOfflineTotals._sum.amount);
  const directDonorCount = directOnlineTotals._count._all + directOfflineTotals._count._all;

  const pagePerformance = pages.map<PageLeaderboardRow>((page) => {
    const online = onlineMap.get(page.id) ?? { amount: 0, count: 0 };
    const offline = offlineMap.get(page.id) ?? { amount: 0, count: 0 };
    const raisedTotal = online.amount + offline.amount;
    const targetAmount = decimalToNumber(page.targetAmount);

    return {
      id: page.id,
      title: page.title,
      shortName: page.shortName,
      teamId: page.teamId,
      teamName: page.team?.name ?? null,
      userName: page.user.name ?? null,
      status: page.status,
      visibility: page.visibility,
      targetAmount,
      onlineTotal: online.amount,
      offlineTotal: offline.amount,
      donorCount: online.count + offline.count,
      raisedTotal,
      progress: getGoalProgress(raisedTotal, targetAmount),
    };
  });

  const rankedPages = withRank(
    [...pagePerformance].sort((a, b) => {
      if (b.raisedTotal !== a.raisedTotal) {
        return b.raisedTotal - a.raisedTotal;
      }
      return a.title.localeCompare(b.title);
    }),
  );

  const teamPerformance = teams.map<TeamLeaderboardRow>((team) => {
    const teamPages = rankedPages.filter((page) => page.teamId === team.id);
    const onlineTotal = teamPages.reduce((sum, page) => sum + page.onlineTotal, 0);
    const offlineTotal = teamPages.reduce((sum, page) => sum + page.offlineTotal, 0);
    const donorCount = teamPages.reduce((sum, page) => sum + page.donorCount, 0);
    const raisedTotal = onlineTotal + offlineTotal;
    const goalAmount = decimalToNumber(team.goalAmount);

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      status: team.status,
      visibility: team.visibility,
      goalAmount,
      fundraiserPageCount: teamPages.length,
      onlineTotal,
      offlineTotal,
      donorCount,
      raisedTotal,
      progress: getGoalProgress(raisedTotal, goalAmount),
      topPages: teamPages.slice(0, 3),
    };
  });

  const rankedTeams = withRank(
    teamPerformance
      .filter((team) => team.fundraiserPageCount > 0 || team.raisedTotal > 0)
      .sort((a, b) => {
        if (b.raisedTotal !== a.raisedTotal) {
          return b.raisedTotal - a.raisedTotal;
        }
        return a.name.localeCompare(b.name);
      }),
  );

  return {
    period,
    rankedPages,
    rankedTeams,
    totals: {
      online: rankedPages.reduce((sum, row) => sum + row.onlineTotal, 0) + directOnlineAmount,
      offline: rankedPages.reduce((sum, row) => sum + row.offlineTotal, 0) + directOfflineAmount,
      donorCount: rankedPages.reduce((sum, row) => sum + row.donorCount, 0) + directDonorCount,
      fundraiserPageCount: rankedPages.length,
      teamCount: rankedTeams.length,
    },
  };
}

export async function getAdminCampaignLeaderboard(input: {
  scopedCharityIds: string[];
  period?: string | null;
  limit?: number;
}) {
  const limit = input.limit ?? 5;
  const charityScope = input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"];
  const period = resolveLeaderboardPeriod(input.period);
  const periodFilter = buildPeriodFilter(period);

  const [appeals, pages] = await Promise.all([
    db.appeal.findMany({
      where: { charityId: { in: charityScope } },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        goalAmount: true,
        currency: true,
        charity: { select: { id: true, name: true } },
        _count: { select: { teams: true, fundraisingPages: true } },
      },
    }),
    db.fundraisingPage.findMany({
      where: { appeal: { charityId: { in: charityScope } } },
      select: {
        id: true,
        title: true,
        shortName: true,
        status: true,
        visibility: true,
        targetAmount: true,
        appealId: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            status: true,
            visibility: true,
            appealId: true,
            goalAmount: true,
          },
        },
        appeal: {
          select: {
            title: true,
            slug: true,
            status: true,
            charity: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const [onlineByPage, offlineByPage] = await Promise.all([
    db.donation.groupBy({
      by: ["pageId"],
      where: {
        status: "CAPTURED",
        createdAt: periodFilter.donationCreatedAt,
        page: { appeal: { charityId: { in: charityScope } } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.offlineDonation.groupBy({
      by: ["pageId"],
      where: {
        status: "APPROVED",
        receivedDate: periodFilter.offlineReceivedDate,
        page: { appeal: { charityId: { in: charityScope } } },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const onlineMap = new Map(
    onlineByPage.map((row) => [row.pageId, { amount: decimalToNumber(row._sum.amount), count: row._count._all }]),
  );
  const offlineMap = new Map(
    offlineByPage.map((row) => [row.pageId, { amount: decimalToNumber(row._sum.amount), count: row._count._all }]),
  );

  const pageRows = pages.map((page) => {
    const online = onlineMap.get(page.id) ?? { amount: 0, count: 0 };
    const offline = offlineMap.get(page.id) ?? { amount: 0, count: 0 };
    const raisedTotal = online.amount + offline.amount;
    const targetAmount = decimalToNumber(page.targetAmount);

    return {
      id: page.id,
      title: page.title,
      shortName: page.shortName,
      status: page.status,
      visibility: page.visibility,
      appealId: page.appealId,
      appealTitle: page.appeal.title,
      appealSlug: page.appeal.slug,
      appealStatus: page.appeal.status,
      charityName: page.appeal.charity.name,
      teamId: page.teamId,
      teamName: page.team?.name ?? null,
      onlineTotal: online.amount,
      offlineTotal: offline.amount,
      donorCount: online.count + offline.count,
      raisedTotal,
      targetAmount,
      progress: getGoalProgress(raisedTotal, targetAmount),
    };
  });

  const rankedPages = withRank(
    [...pageRows].sort((a, b) => {
      if (b.raisedTotal !== a.raisedTotal) {
        return b.raisedTotal - a.raisedTotal;
      }
      return a.title.localeCompare(b.title);
    }),
  );

  const appealRows = appeals.map((appeal) => {
    const appealPages = pageRows.filter((page) => page.appealId === appeal.id);
    const onlineTotal = appealPages.reduce((sum, page) => sum + page.onlineTotal, 0);
    const offlineTotal = appealPages.reduce((sum, page) => sum + page.offlineTotal, 0);
    const donorCount = appealPages.reduce((sum, page) => sum + page.donorCount, 0);
    const raisedTotal = onlineTotal + offlineTotal;
    const goalAmount = decimalToNumber(appeal.goalAmount);

    return {
      id: appeal.id,
      title: appeal.title,
      slug: appeal.slug,
      status: appeal.status,
      visibility: appeal.visibility,
      charityName: appeal.charity.name,
      goalAmount,
      onlineTotal,
      offlineTotal,
      donorCount,
      raisedTotal,
      progress: getGoalProgress(raisedTotal, goalAmount),
      fundraiserPageCount: appeal._count.fundraisingPages,
      teamCount: appeal._count.teams,
    };
  });

  const teamMap = new Map<
    string,
    { id: string; name: string; status: string; visibility: string; goalAmount: number; appealId: string }
  >();
  for (const page of pages) {
    if (page.team) {
      teamMap.set(page.team.id, {
        id: page.team.id,
        name: page.team.name,
        status: page.team.status,
        visibility: page.team.visibility,
        goalAmount: decimalToNumber(page.team.goalAmount),
        appealId: page.team.appealId,
      });
    }
  }

  const teamRows = [...teamMap.values()].map((team) => {
    const teamPages = pageRows.filter((page) => page.teamId === team.id);
    const onlineTotal = teamPages.reduce((sum, page) => sum + page.onlineTotal, 0);
    const offlineTotal = teamPages.reduce((sum, page) => sum + page.offlineTotal, 0);
    const donorCount = teamPages.reduce((sum, page) => sum + page.donorCount, 0);
    const raisedTotal = onlineTotal + offlineTotal;

    return {
      id: team.id,
      name: team.name,
      status: team.status,
      visibility: team.visibility,
      appealId: team.appealId,
      raisedTotal,
      onlineTotal,
      offlineTotal,
      donorCount,
      fundraiserPageCount: teamPages.length,
      goalAmount: team.goalAmount,
      progress: getGoalProgress(raisedTotal, team.goalAmount),
    };
  });

  return {
    period,
    topAppeals: withRank(
      appealRows.sort((a, b) => (b.raisedTotal !== a.raisedTotal ? b.raisedTotal - a.raisedTotal : a.title.localeCompare(b.title))),
    ).slice(0, limit),
    topTeams: withRank(
      teamRows
        .filter((team) => team.fundraiserPageCount > 0 || team.raisedTotal > 0)
        .sort((a, b) => (b.raisedTotal !== a.raisedTotal ? b.raisedTotal - a.raisedTotal : a.name.localeCompare(b.name))),
    ).slice(0, limit),
    topFundraiserPages: rankedPages.slice(0, limit),
    totals: {
      online: pageRows.reduce((sum, row) => sum + row.onlineTotal, 0),
      offline: pageRows.reduce((sum, row) => sum + row.offlineTotal, 0),
      donorCount: pageRows.reduce((sum, row) => sum + row.donorCount, 0),
      fundraiserPageCount: pageRows.length,
      teamCount: teamRows.length,
      appealCount: appealRows.length,
      activeAppealCount: appealRows.filter((appeal) => appeal.status === "ACTIVE").length,
      endedAppealCount: appealRows.filter((appeal) => appeal.status === "ENDED").length,
    },
    full: {
      appeals: withRank(
        appealRows.sort((a, b) => (b.raisedTotal !== a.raisedTotal ? b.raisedTotal - a.raisedTotal : a.title.localeCompare(b.title))),
      ),
      teams: withRank(
        teamRows
          .filter((team) => team.fundraiserPageCount > 0 || team.raisedTotal > 0)
          .sort((a, b) => (b.raisedTotal !== a.raisedTotal ? b.raisedTotal - a.raisedTotal : a.name.localeCompare(b.name))),
      ),
      fundraiserPages: rankedPages,
    },
  };
}
