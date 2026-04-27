import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { getAdminCampaignLeaderboard, resolveLeaderboardPeriod } from "@/lib/leaderboards";

export const metadata: Metadata = { title: "Admin — Overview" };

type AdminOverviewPageProps = {
  searchParams?: { period?: string };
};

function fmt(val: string | number | null | undefined, currency = "GBP") {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? "#233029" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  CAPTURED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
  PENDING: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
  FAILED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
  REFUNDED: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
  PAID: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
  SCHEDULED: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
  PROCESSING: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
  ACTIVE: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
  DRAFT: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
  ENDED: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
  PAUSED: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
};

function pill(status: string) {
  return (
    <span
      style={{
        borderRadius: "9999px",
        padding: "2px 8px",
        fontSize: "0.7rem",
        fontWeight: 600,
        background: STATUS_STYLE[status]?.bg ?? "rgba(58,74,66,0.12)",
        color: STATUS_STYLE[status]?.color ?? "#3A4A42",
      }}
    >
      {status}
    </span>
  );
}

function LeaderboardList({
  title,
  rows,
  empty,
  renderRow,
}: {
  title: string;
  rows: Array<{ id: string }>;
  empty: string;
  renderRow: (row: Record<string, unknown>) => React.ReactNode;
}) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1rem" }}>
      <h3 className="text-sm font-semibold px-1" style={{ color: "#233029" }}>{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length > 0 ? rows.map((row) => <div key={row.id}>{renderRow(row as Record<string, unknown>)}</div>) : (
          <p className="text-sm px-1 py-3" style={{ color: "#8A9E94" }}>{empty}</p>
        )}
      </div>
    </div>
  );
}

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  const period = resolveLeaderboardPeriod(searchParams?.period);
  const { role, managedCharity } = await getAdminContext();
  const charityId = managedCharity?.id ?? "";

  if (role === "PLATFORM_ADMIN") {
    const charities = await db.charity.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { appeals: true, admins: true } },
      },
    });

    const [onlineAgg, offlineAgg] = await Promise.all([
      db.donation.aggregate({ where: { status: "CAPTURED" }, _sum: { amount: true }, _count: true }),
      db.offlineDonation.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true }, _count: true }),
    ]);

    const [pendingPayoutAgg, giftAidAgg] = await Promise.all([
      db.payoutBatch.aggregate({ where: { status: { in: ["SCHEDULED", "PROCESSING"] } }, _sum: { netAmount: true } }),
      db.giftAidClaim.aggregate({ where: { status: { in: ["DRAFT", "SUBMITTED"] } }, _sum: { reclaimAmount: true } }),
    ]);

    const recentDonations = await db.donation.findMany({
      include: {
        page: { select: { title: true, appeal: { select: { title: true, charity: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const campaignLeaderboard = await getAdminCampaignLeaderboard({
      scopedCharityIds: charities.map((charity) => charity.id),
      period,
    });

    const platformRaised = campaignLeaderboard.totals.online + campaignLeaderboard.totals.offline;

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Platform overview</h1>
            <p className="text-sm" style={{ color: "#8A9E94" }}>All charity summary across the platform</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/charities" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Open charities</Link>
            <Link href="/admin/charities/new" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Create charity</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Charities" value={String(charities.length)} sub="active and draft profiles" />
          <StatCard label="Platform raised" value={fmt(platformRaised)} color="#1E8C6E" />
          <StatCard label="Online raised" value={fmt(onlineAgg._sum.amount?.toString())} sub={`${onlineAgg._count} donations`} />
          <StatCard label="Offline raised" value={fmt(offlineAgg._sum.amount?.toString())} sub={`${offlineAgg._count} approved entries`} />
          <StatCard label="Pending payouts" value={fmt(pendingPayoutAgg._sum.netAmount?.toString())} />
          <StatCard label="Gift Aid pending" value={fmt(giftAidAgg._sum.reclaimAmount?.toString())} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#233029" }}>Charity overview</h2>
              <Link href="/admin/charities" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
            </div>
            <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflowX: "auto", overflowY: "hidden" }}>
              <table style={{ width: "100%", minWidth: "40rem", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#F6F1E8" }}>
                    {["Charity", "Appeals", "Admins", "Currency", "Status", "Action"].map((h) => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#8A9E94", fontSize: "0.75rem" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charities.map((charity, i) => (
                    <tr key={charity.id} style={{ borderTop: i > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#233029", fontWeight: 600 }}>{charity.name}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#3A4A42" }}>{charity._count.appeals}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#3A4A42" }}>{charity._count.admins}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#3A4A42" }}>{charity.defaultCurrency}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#3A4A42" }}>{charity.status}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <Link href={`/admin/charities/${charity.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                          Open overview
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#233029" }}>Recent donations</h2>
              <Link href="/admin/donations" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {recentDonations.map((d) => (
                <div key={d.id} style={{ background: "white", borderRadius: "0.875rem", padding: "0.875rem 1rem", boxShadow: "0 2px 8px rgba(18,78,64,0.06)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "#233029" }}>{d.page.appeal.charity.name}</p>
                    {pill(d.status)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{d.page.appeal.title} · {d.page.title}</p>
                </div>
              ))}
              {recentDonations.length === 0 ? <p className="text-sm" style={{ color: "#8A9E94" }}>No donations yet</p> : null}
            </div>
          </div>
        </div>

        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-semibold" style={{ color: "#233029" }}>Campaign performance leaderboards</h2>
            <div className="flex flex-wrap gap-2">
              {(["30d", "90d", "all"] as const).map((item) => (
                <Link
                  key={item}
                  href={item === "all" ? "/admin" : `/admin?period=${item}`}
                  className={period === item ? "btn-primary" : "btn-outline"}
                  style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                >
                  {item === "all" ? "All time" : item.toUpperCase()}
                </Link>
              ))}
              <Link href={`/admin/analytics?period=${period}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                View full rankings
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <LeaderboardList
              title="Top appeals"
              rows={campaignLeaderboard.topAppeals}
              empty="No appeal performance data yet."
              renderRow={(row) => (
                <Link href={`/appeals/${String(row.slug)}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                    <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.title)}</p>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                    {String(row.charityName)} · {String(row.status)} · {Number(row.progress)}% goal
                  </p>
                </Link>
              )}
            />
            <LeaderboardList
              title="Top teams"
              rows={campaignLeaderboard.topTeams}
              empty="No team leaderboard data yet."
              renderRow={(row) => (
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                    <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.name)}</p>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                    {Number(row.fundraiserPageCount)} pages · {Number(row.donorCount)} donor records · {String(row.status)}
                  </p>
                </div>
              )}
            />
            <LeaderboardList
              title="Top fundraiser pages"
              rows={campaignLeaderboard.topFundraiserPages}
              empty="No fundraiser ranking data yet."
              renderRow={(row) => (
                <Link href={`/fundraise/${String(row.shortName)}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                    <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.title)}</p>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                    {String(row.charityName)} · {String(row.appealTitle)}
                  </p>
                </Link>
              )}
            />
          </div>
        </section>
      </div>
    );
  }

  const [onlineAgg, offlineAgg] = await Promise.all([
    db.donation.aggregate({ where: { page: { appeal: { charityId } }, status: "CAPTURED" }, _sum: { amount: true }, _count: true }),
    db.offlineDonation.aggregate({ where: { page: { appeal: { charityId } }, status: "APPROVED" }, _sum: { amount: true }, _count: true }),
  ]);

  const [pendingPayoutAgg, giftAidAgg] = await Promise.all([
    db.payoutBatch.aggregate({ where: { charityId, status: { in: ["SCHEDULED", "PROCESSING"] } }, _sum: { netAmount: true } }),
    db.giftAidClaim.aggregate({ where: { charityId, status: { in: ["DRAFT", "SUBMITTED"] } }, _sum: { reclaimAmount: true } }),
  ]);

  const [recentDonations, appeals, payouts] = await Promise.all([
    db.donation.findMany({
      where: { page: { appeal: { charityId } } },
      include: { feeSet: { select: { donorCoversFees: true } }, giftAidDeclaration: { select: { id: true } }, page: { select: { shortName: true, title: true } } },
      orderBy: { createdAt: "desc" }, take: 10,
    }),
    db.appeal.findMany({ where: { charityId }, include: { _count: { select: { fundraisingPages: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.payoutBatch.findMany({ where: { charityId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const campaignLeaderboard = await getAdminCampaignLeaderboard({
    scopedCharityIds: [charityId],
    period,
  });

  const onlineTotal = parseFloat(onlineAgg._sum.amount?.toString() ?? "0");
  const offlineTotal = parseFloat(offlineAgg._sum.amount?.toString() ?? "0");
  const coverPct = onlineAgg._count > 0
    ? Math.round((recentDonations.filter((d) => (d.resolvedChargingMode ?? (d.feeSet?.donorCoversFees ? "DONOR_SUPPORTED" : "CHARITY_PAID")) === "DONOR_SUPPORTED").length / onlineAgg._count) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>{managedCharity?.name ?? "Overview"}</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>Charity dashboard</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/charities" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Charity setup</Link>
          <Link href="/admin/appeals" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Manage appeals</Link>
          <Link href="/admin/appeals/new" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>+ New appeal</Link>
          <Link href="/admin/moderation" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Moderation queue</Link>
          <Link href="/admin/reports" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>Export CSV</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total raised" value={fmt(onlineTotal + offlineTotal)} color="#1E8C6E" />
        <StatCard label="Online raised" value={fmt(onlineTotal)} sub={`${onlineAgg._count} donations`} />
        <StatCard label="Offline raised" value={fmt(offlineTotal)} sub={`${offlineAgg._count} entries`} />
        <StatCard label="Pending payout" value={fmt(pendingPayoutAgg._sum.netAmount?.toString())} color="#1E8C6E" />
        <StatCard label="Gift Aid pending" value={fmt(giftAidAgg._sum.reclaimAmount?.toString())} color="#1E8C6E" />
        <StatCard label="Fee cover rate" value={`${coverPct}%`} sub="donors covering fees" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: "#233029" }}>Recent donations</h2>
            <Link href="/admin/donations" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
          </div>
          <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflowX: "auto", overflowY: "hidden" }}>
            <table style={{ width: "100%", minWidth: "36rem", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#F6F1E8" }}>
                  {["Donor", "Amount", "Gift Aid", "Page", "Status"].map((h) => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#8A9E94", fontSize: "0.75rem" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDonations.map((d, i) => (
                  <tr key={d.id} style={{ borderTop: i > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                    <td style={{ padding: "0.75rem 1rem", color: "#233029" }}>{d.isAnonymous ? "Anonymous" : (d.donorName ?? "—")}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#233029" }}>
                      £{parseFloat(d.amount.toString()).toFixed(2)}
                      {(d.resolvedChargingMode ?? (d.feeSet?.donorCoversFees ? "DONOR_SUPPORTED" : "CHARITY_PAID")) === "DONOR_SUPPORTED" && (
                        <span style={{ fontSize: "0.65rem", color: "#1E8C6E", marginLeft: "4px" }}>+support</span>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>{pill(d.giftAidDeclaration ? "CAPTURED" : "DRAFT")}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#8A9E94", fontSize: "0.75rem" }}>{d.page.title}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{pill(d.status)}</td>
                  </tr>
                ))}
                {recentDonations.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>No donations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#233029" }}>Appeals</h2>
              <Link href="/admin/appeals" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {appeals.map((a) => (
                <div key={a.id} style={{ background: "white", borderRadius: "0.875rem", padding: "0.875rem 1rem", boxShadow: "0 2px 8px rgba(18,78,64,0.06)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "#233029" }}>{a.title}</p>
                    {pill(a.status)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{a._count.fundraisingPages} pages</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/admin/appeals/${a.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      Edit
                    </Link>
                    <Link href={`/appeals/${a.slug}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {appeals.length === 0 && <p className="text-sm" style={{ color: "#8A9E94" }}>No appeals yet</p>}
              <Link href="/admin/appeals" className="btn-outline w-full justify-center" style={{ padding: "0.5rem", fontSize: "0.8rem" }}>Open appeals manager</Link>
              <Link href="/admin/appeals/new" className="btn-outline w-full justify-center mt-2" style={{ padding: "0.5rem", fontSize: "0.8rem" }}>+ New appeal</Link>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#233029" }}>Recent payouts</h2>
              <Link href="/admin/payouts" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {payouts.map((p) => (
                <div key={p.id} style={{ background: "white", borderRadius: "0.875rem", padding: "0.875rem 1rem", boxShadow: "0 2px 8px rgba(18,78,64,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "#233029" }}>£{parseFloat(p.netAmount.toString()).toFixed(2)}</span>
                    {pill(p.status)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{new Date(p.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              ))}
              {payouts.length === 0 && <p className="text-sm" style={{ color: "#8A9E94" }}>No payouts yet</p>}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold" style={{ color: "#233029" }}>Campaign performance</h2>
          <div className="flex flex-wrap gap-2">
            {(["30d", "90d", "all"] as const).map((item) => (
              <Link
                key={item}
                href={item === "all" ? "/admin" : `/admin?period=${item}`}
                className={period === item ? "btn-primary" : "btn-outline"}
                style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
              >
                {item === "all" ? "All time" : item.toUpperCase()}
              </Link>
            ))}
            <Link href={`/admin/analytics?period=${period}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
              View full rankings
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Appeals tracked" value={String(campaignLeaderboard.totals.appealCount)} sub={`${campaignLeaderboard.totals.activeAppealCount} active · ${campaignLeaderboard.totals.endedAppealCount} ended`} />
          <StatCard label="Teams tracked" value={String(campaignLeaderboard.totals.teamCount)} sub="team standings in scope" />
          <StatCard label="Fundraiser pages" value={String(campaignLeaderboard.totals.fundraiserPageCount)} sub="rankable pages in scope" />
          <StatCard label="Leaderboard online" value={fmt(campaignLeaderboard.totals.online)} sub={`${campaignLeaderboard.totals.donorCount} donor records`} />
          <StatCard label="Leaderboard offline" value={fmt(campaignLeaderboard.totals.offline)} sub="approved offline entries" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <LeaderboardList
            title="Top appeals"
            rows={campaignLeaderboard.topAppeals}
            empty="No appeal performance data yet."
            renderRow={(row) => (
              <Link href={`/admin/appeals/${String(row.id)}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                  <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.title)}</p>
                <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                  {String(row.status)} · {Number(row.progress)}% goal · {Number(row.teamCount)} teams
                </p>
              </Link>
            )}
          />
          <LeaderboardList
            title="Top teams"
            rows={campaignLeaderboard.topTeams}
            empty="No team leaderboard data yet."
            renderRow={(row) => (
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                  <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.name)}</p>
                <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                  {Number(row.fundraiserPageCount)} pages · {Number(row.donorCount)} donor records · {String(row.status)}
                </p>
              </div>
            )}
          />
          <LeaderboardList
            title="Top fundraiser pages"
            rows={campaignLeaderboard.topFundraiserPages}
            empty="No fundraiser ranking data yet."
            renderRow={(row) => (
              <Link href={`/fundraise/${String(row.shortName)}`} className="block rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">{Boolean(row.isTied) ? `Tied #${String(row.rank)}` : `#${String(row.rank)}`}</span>
                  <span className="text-sm font-semibold" style={{ color: "#115E59" }}>{fmt(Number(row.raisedTotal))}</span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "#233029" }}>{String(row.title)}</p>
                <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                  {String(row.appealTitle)} · {String(row.status)}
                </p>
              </Link>
            )}
          />
        </div>
      </section>
    </div>
  );
}
