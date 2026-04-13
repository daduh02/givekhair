import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppealLeaderboard, resolveLeaderboardPeriod } from "@/lib/leaderboards";

interface Props {
  params: { slug: string };
  searchParams?: { period?: string };
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function rankLabel(rank: number, isTied: boolean) {
  return isTied ? `Tied #${rank}` : `#${rank}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const appeal = await db.appeal.findUnique({
    where: { slug: params.slug },
    select: { title: true },
  });

  return {
    title: appeal ? `${appeal.title} Leaderboard` : "Appeal Leaderboard",
  };
}

export default async function AppealLeaderboardPage({ params, searchParams }: Props) {
  const appeal = await db.appeal.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      currency: true,
      visibility: true,
      charity: { select: { name: true } },
    },
  });

  if (!appeal || appeal.visibility === "HIDDEN") {
    notFound();
  }

  const period = resolveLeaderboardPeriod(searchParams?.period);
  const leaderboard = await getAppealLeaderboard({
    appealId: appeal.id,
    publicOnly: true,
    period,
  });

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Appeal leaderboard</p>
            <h1 className="section-heading mt-2">{appeal.title}</h1>
            <p className="section-copy mt-2">
              {appeal.charity.name} · {leaderboard.period === "all" ? "All-time performance" : `Last ${leaderboard.period.replace("d", "")} days`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["30d", "90d", "all"] as const).map((item) => (
              <Link
                key={item}
                href={item === "all" ? `/appeals/${appeal.slug}/leaderboard` : `/appeals/${appeal.slug}/leaderboard?period=${item}`}
                className={leaderboard.period === item ? "btn-primary" : "btn-outline"}
                style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
              >
                {item === "all" ? "All time" : item.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>

        <section className="mt-8 surface-card p-6">
          <h2 className="text-xl font-semibold text-[color:var(--color-ink)]">Fundraiser rankings</h2>
          <div className="mt-4 space-y-2">
            {leaderboard.rankedPages.length > 0 ? (
              leaderboard.rankedPages.map((row) => (
                <Link key={row.id} href={`/fundraise/${row.shortName}`} className="surface-muted flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                  <div className="min-w-0">
                    <p className="section-kicker">{rankLabel(row.rank, row.isTied)}</p>
                    <p className="mt-1 text-base font-semibold text-[color:var(--color-ink)]">{row.title}</p>
                    <p className="text-xs text-[color:var(--color-ink-muted)]">
                      {row.teamName ?? "No team"} · {row.donorCount} donor records
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[color:var(--color-primary-dark)]">
                    {formatCurrency(row.raisedTotal, appeal.currency)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-[color:var(--color-ink-muted)]">No fundraiser data yet for this period.</p>
            )}
          </div>
        </section>

        <section className="mt-6 surface-card p-6">
          <h2 className="text-xl font-semibold text-[color:var(--color-ink)]">Team standings</h2>
          <div className="mt-4 space-y-2">
            {leaderboard.rankedTeams.length > 0 ? (
              leaderboard.rankedTeams.map((row) => (
                <div key={row.id} className="surface-muted rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">{rankLabel(row.rank, row.isTied)}</p>
                      <p className="mt-1 text-base font-semibold text-[color:var(--color-ink)]">{row.name}</p>
                      <p className="text-xs text-[color:var(--color-ink-muted)]">
                        {row.fundraiserPageCount} pages · {row.donorCount} donor records
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-[color:var(--color-primary-dark)]">
                      {formatCurrency(row.raisedTotal, appeal.currency)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[color:var(--color-ink-muted)]">No teams are ranked for this appeal yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
