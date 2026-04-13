export type LeaderboardPeriod = "30d" | "90d" | "all";

type RankedBase = {
  raisedTotal: number;
  rank: number;
  isTied: boolean;
};

const EPSILON = 0.000001;

function amountEquals(a: number, b: number) {
  return Math.abs(a - b) <= EPSILON;
}

export function resolveLeaderboardPeriod(input: string | null | undefined): LeaderboardPeriod {
  if (input === "30d" || input === "90d" || input === "all") {
    return input;
  }
  return "all";
}

export function getLeaderboardPeriodStart(period: LeaderboardPeriod, now = new Date()) {
  if (period === "all") {
    return null;
  }

  const days = period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function getGoalProgress(raisedTotal: number, goalAmount: number) {
  if (goalAmount <= 0) {
    return 0;
  }

  return Math.min(Math.round((raisedTotal / goalAmount) * 100), 100);
}

export function withRank<T extends { raisedTotal: number }>(items: T[]): Array<T & RankedBase> {
  let currentRank = 0;
  let previousAmount: number | null = null;

  const ranked = items.map((item, index) => {
    if (previousAmount === null || !amountEquals(item.raisedTotal, previousAmount)) {
      currentRank = index + 1;
      previousAmount = item.raisedTotal;
    }

    return {
      ...item,
      rank: currentRank,
      isTied: false,
    };
  });

  return ranked.map((item, index) => {
    const prev = ranked[index - 1];
    const next = ranked[index + 1];
    const tiedWithPrev = prev ? amountEquals(item.raisedTotal, prev.raisedTotal) : false;
    const tiedWithNext = next ? amountEquals(item.raisedTotal, next.raisedTotal) : false;

    return {
      ...item,
      isTied: tiedWithPrev || tiedWithNext,
    };
  });
}
