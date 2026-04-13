import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAdminCampaignLeaderboard, resolveLeaderboardPeriod } from "@/lib/leaderboards";

export const metadata: Metadata = { title: "Admin — Campaign analytics" };

type Props = {
  searchParams?: { period?: string };
};

function fmt(val: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

function rankLabel(rank: number, isTied: boolean) {
  return isTied ? `Tied #${rank}` : `#${rank}`;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { role, managedCharity } = await getAdminContext();
  const period = resolveLeaderboardPeriod(searchParams?.period);

  const scopedCharityIds =
    role === "PLATFORM_ADMIN"
      ? (await db.charity.findMany({ select: { id: true } })).map((charity) => charity.id)
      : managedCharity?.id
        ? [managedCharity.id]
        : [];

  const leaderboard = await getAdminCampaignLeaderboard({
    scopedCharityIds,
    period,
    limit: 200,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Campaign analytics</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>Full rankings by appeal, team, and fundraiser page</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["30d", "90d", "all"] as const).map((item) => (
            <Link
              key={item}
              href={item === "all" ? "/admin/analytics" : `/admin/analytics?period=${item}`}
              className={period === item ? "btn-primary" : "btn-outline"}
              style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
            >
              {item === "all" ? "All time" : item.toUpperCase()}
            </Link>
          ))}
          <Link href={period === "all" ? "/admin" : `/admin?period=${period}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1rem" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#233029" }}>Appeals</h2>
          <div className="mt-3 space-y-2">
            {leaderboard.full.appeals.map((row) => (
              <Link key={row.id} href={`/admin/appeals/${row.id}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">{rankLabel(row.rank, row.isTied)}</span>
                  <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(row.raisedTotal)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{row.title}</p>
                <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>{row.teamCount} teams · {row.fundraiserPageCount} pages</p>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1rem" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#233029" }}>Teams</h2>
          <div className="mt-3 space-y-2">
            {leaderboard.full.teams.length > 0 ? (
              leaderboard.full.teams.map((row) => (
                <div key={row.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="section-kicker">{rankLabel(row.rank, row.isTied)}</span>
                    <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(row.raisedTotal)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{row.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>{row.fundraiserPageCount} pages · {row.donorCount} donor records</p>
                </div>
              ))
            ) : (
              <p className="text-sm" style={{ color: "#8A9E94" }}>No team ranking data yet.</p>
            )}
          </div>
        </section>

        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1rem" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#233029" }}>Fundraiser pages</h2>
          <div className="mt-3 space-y-2">
            {leaderboard.full.fundraiserPages.map((row) => (
              <Link key={row.id} href={`/fundraise/${row.shortName}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">{rankLabel(row.rank, row.isTied)}</span>
                  <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(row.raisedTotal)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{row.title}</p>
                <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>{row.charityName} · {row.appealTitle}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
