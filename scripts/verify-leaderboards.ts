import {
  getGoalProgress,
  getLeaderboardPeriodStart,
  resolveLeaderboardPeriod,
  withRank,
} from "../src/lib/leaderboard-metrics";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testPeriodResolution() {
  assert(resolveLeaderboardPeriod("30d") === "30d", "30d should resolve");
  assert(resolveLeaderboardPeriod("90d") === "90d", "90d should resolve");
  assert(resolveLeaderboardPeriod("all") === "all", "all should resolve");
  assert(resolveLeaderboardPeriod("unexpected") === "all", "unexpected period should fallback to all");
}

function testPeriodStart() {
  const now = new Date("2026-04-13T12:00:00.000Z");
  const start30 = getLeaderboardPeriodStart("30d", now);
  const start90 = getLeaderboardPeriodStart("90d", now);
  const all = getLeaderboardPeriodStart("all", now);

  assert(start30?.toISOString() === "2026-03-14T12:00:00.000Z", "30d start should be 30 days back");
  assert(start90?.toISOString() === "2026-01-13T12:00:00.000Z", "90d start should be 90 days back");
  assert(all === null, "all period should have no start date");
}

function testRankingAndTies() {
  const ranked = withRank([
    { id: "a", raisedTotal: 100 },
    { id: "b", raisedTotal: 100 },
    { id: "c", raisedTotal: 90 },
    { id: "d", raisedTotal: 50 },
    { id: "e", raisedTotal: 50 },
  ]);

  assert(ranked[0]?.rank === 1, "first row should be rank 1");
  assert(ranked[1]?.rank === 1, "second tied row should also be rank 1");
  assert(ranked[2]?.rank === 3, "third row should skip to rank 3 after tie");
  assert(ranked[3]?.rank === 4, "fourth row should be rank 4");
  assert(ranked[4]?.rank === 4, "fifth tied row should be rank 4");
  assert(ranked[0]?.isTied === true && ranked[1]?.isTied === true, "tie rows should be marked isTied");
  assert(ranked[2]?.isTied === false, "non tie row should be marked non-tied");
}

function testGoalProgress() {
  assert(getGoalProgress(50, 100) === 50, "progress should be percent");
  assert(getGoalProgress(0, 0) === 0, "zero goal should return 0");
  assert(getGoalProgress(200, 100) === 100, "progress should cap at 100");
}

function main() {
  testPeriodResolution();
  testPeriodStart();
  testRankingAndTies();
  testGoalProgress();
  console.log("Leaderboard verification checks passed.");
}

main();
