import Link from "next/link";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { getCharityPayoutOverview } from "@/server/lib/payouts";

function fmt(value: string | number | { toString(): string } | null | undefined, currency = "GBP") {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : parseFloat(value?.toString() ?? "0");

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function Page() {
  const { role, managedCharity } = await getAdminContext();

  if (!managedCharity) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Payouts</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>No managed charity was found for this user.</p>
      </div>
    );
  }

  const [overview, recentBatches] = await Promise.all([
    getCharityPayoutOverview(managedCharity.id),
    db.payoutBatch.findMany({
      where: role === "PLATFORM_ADMIN" ? {} : { charityId: managedCharity.id },
      include: {
        charity: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Payouts</h1>
        <p className="text-sm" style={{ color: "#8A9E94" }}>
          Contract-aware payout readiness. Donor support never enters the charity payout pool, and received Gift Aid flows through in full.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Donation net pool" value={fmt(overview.donationNetAmount)} sub="captured donations after charity-paid fees" />
        <StatCard label="Gift Aid received" value={fmt(overview.giftAidReceivedAmount)} sub="eligible to pass through to charity" />
        <StatCard label="Already batched" value={fmt(overview.existingBatchedAmount)} sub="scheduled, processing, or paid batches" />
        <StatCard label="Eligible payout" value={fmt(overview.eligiblePayoutAmount)} sub={overview.payoutsBlocked ? "currently blocked by contract" : "available under current contract"} />
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
        <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Commercial gating</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <p style={{ color: "#8A9E94" }}>Contract</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>
              {overview.contract.termsVersion} · {overview.contract.status}
            </p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Payout policy</p>
            <p className="mt-1 font-semibold" style={{ color: overview.payoutsBlocked ? "#991B1B" : "#124E40" }}>
              {overview.payoutsBlocked ? overview.blockReason : "Payouts allowed under active contract policy"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/settings" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Open fees & contracts
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Back to overview
          </Link>
        </div>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Recent payout batches</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Created", "Charity", "Gross", "Fees", "Net", "Status"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentBatches.map((batch, index) => (
              <tr key={batch.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{new Date(batch.createdAt).toLocaleDateString("en-GB")}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{batch.charity.name}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(batch.grossAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(batch.feesAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{fmt(batch.netAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{batch.status}</td>
              </tr>
            ))}
            {recentBatches.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No payout batches yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p>
    </div>
  );
}
