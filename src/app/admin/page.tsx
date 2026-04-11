import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Overview" };

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

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const charityAdmin = await db.charityAdmin.findFirst({
    where: { userId: session.user.id },
    include: { charity: true },
  });

  const charityId = charityAdmin?.charityId ?? "";

  const [onlineAgg, offlineAgg, pendingPayoutAgg, giftAidAgg, recentDonations, appeals, payouts] =
    await Promise.all([
      db.donation.aggregate({ where: { page: { appeal: { charityId } }, status: "CAPTURED" }, _sum: { amount: true }, _count: true }),
      db.offlineDonation.aggregate({ where: { page: { appeal: { charityId } }, status: "APPROVED" }, _sum: { amount: true }, _count: true }),
      db.payoutBatch.aggregate({ where: { charityId, status: { in: ["SCHEDULED", "PROCESSING"] } }, _sum: { netAmount: true } }),
      db.giftAidClaim.aggregate({ where: { charityId, status: { in: ["DRAFT", "SUBMITTED"] } }, _sum: { reclaimAmount: true } }),
      db.donation.findMany({
        where: { page: { appeal: { charityId } } },
        include: { feeSet: { select: { donorCoversFees: true } }, giftAidDeclaration: { select: { id: true } }, page: { select: { shortName: true, title: true } } },
        orderBy: { createdAt: "desc" }, take: 10,
      }),
      db.appeal.findMany({ where: { charityId }, include: { _count: { select: { fundraisingPages: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.payoutBatch.findMany({ where: { charityId }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const onlineTotal = parseFloat(onlineAgg._sum.amount?.toString() ?? "0");
  const offlineTotal = parseFloat(offlineAgg._sum.amount?.toString() ?? "0");
  const coverPct = onlineAgg._count > 0
    ? Math.round((recentDonations.filter(d => d.feeSet?.donorCoversFees).length / onlineAgg._count) * 100)
    : 0;

  const statusStyle: Record<string, { bg: string; color: string }> = {
    CAPTURED:   { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    PENDING:    { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
    FAILED:     { bg: "rgba(239,68,68,0.12)",  color: "#7F1D1D" },
    REFUNDED:   { bg: "rgba(58,74,66,0.12)",   color: "#3A4A42" },
    PAID:       { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    SCHEDULED:  { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
    PROCESSING: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    ACTIVE:     { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    DRAFT:      { bg: "rgba(58,74,66,0.12)",   color: "#3A4A42" },
  };

  const pill = (s: string) => (
    <span style={{ borderRadius: "9999px", padding: "2px 8px", fontSize: "0.7rem", fontWeight: 600, background: statusStyle[s]?.bg ?? "rgba(58,74,66,0.12)", color: statusStyle[s]?.color ?? "#3A4A42" }}>{s}</span>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>{charityAdmin?.charity.name ?? "Overview"}</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>Charity dashboard</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/appeals/new" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>+ New appeal</Link>
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
          <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#F6F1E8" }}>
                  {["Donor", "Amount", "Gift Aid", "Page", "Status"].map(h => (
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
                      {d.feeSet?.donorCoversFees && <span style={{ fontSize: "0.65rem", color: "#1E8C6E", marginLeft: "4px" }}>+fees</span>}
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
              {appeals.map(a => (
                <div key={a.id} style={{ background: "white", borderRadius: "0.875rem", padding: "0.875rem 1rem", boxShadow: "0 2px 8px rgba(18,78,64,0.06)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: "#233029" }}>{a.title}</p>
                    {pill(a.status)}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{a._count.fundraisingPages} pages</p>
                </div>
              ))}
              {appeals.length === 0 && <p className="text-sm" style={{ color: "#8A9E94" }}>No appeals yet</p>}
              <Link href="/admin/appeals/new" className="btn-outline w-full justify-center mt-2" style={{ padding: "0.5rem", fontSize: "0.8rem" }}>+ New appeal</Link>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: "#233029" }}>Recent payouts</h2>
              <Link href="/admin/payouts" className="text-xs font-medium" style={{ color: "#1E8C6E" }}>View all →</Link>
            </div>
            <div className="space-y-2">
              {payouts.map(p => (
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
    </div>
  );
}
