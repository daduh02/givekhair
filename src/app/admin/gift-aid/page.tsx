import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import { getGiftAidOverview, markGiftAidClaimPaid, queueEligibleGiftAidDeclarations, submitGiftAidClaim } from "@/server/lib/gift-aid";

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

function pill(status: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "rgba(212,160,23,0.12)", color: "#8A5B00" },
    SUBMITTED: { bg: "rgba(37,99,235,0.12)", color: "#1D4ED8" },
    ACCEPTED: { bg: "rgba(15,118,110,0.12)", color: "#115E59" },
    PAID: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    REJECTED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  };

  const style = palette[status] ?? { bg: "rgba(18,78,64,0.08)", color: "#355247" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

function formatDate(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "—";
}

export default async function Page({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { managedCharity } = await getAdminContext();

  if (!managedCharity) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Gift Aid</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>No managed charity was found for this user.</p>
      </div>
    );
  }

  async function buildClaimsAction() {
    "use server";

    const { managedCharity: currentManagedCharity } = await getAdminContext();
    if (!currentManagedCharity) {
      redirect("/admin/gift-aid?error=no-charity");
    }

    const result = await queueEligibleGiftAidDeclarations(currentManagedCharity.id);
    revalidateAdminSurfaces(["/admin/gift-aid", "/admin/payouts"]);
    redirect(`/admin/gift-aid?error=${encodeURIComponent(result.createdItems > 0 ? `Queued ${result.createdItems} declaration(s) into draft claims.` : "No new Gift Aid declarations were waiting to be claimed.")}`);
  }

  async function submitClaimAction(formData: FormData) {
    "use server";

    const claimId = String(formData.get("claimId") ?? "");
    const hmrcRef = String(formData.get("hmrcRef") ?? "").trim();
    if (!claimId) {
      redirect("/admin/gift-aid");
    }

    await submitGiftAidClaim(claimId, hmrcRef || null);
    revalidateAdminSurfaces(["/admin/gift-aid"]);
    redirect("/admin/gift-aid");
  }

  async function markPaidAction(formData: FormData) {
    "use server";

    const claimId = String(formData.get("claimId") ?? "");
    if (!claimId) {
      redirect("/admin/gift-aid");
    }

    await markGiftAidClaimPaid(claimId);
    revalidateAdminSurfaces(["/admin/gift-aid", "/admin/payouts"]);
    redirect("/admin/gift-aid");
  }

  const overview = await getGiftAidOverview(managedCharity.id);
  const message = searchParams.error ? decodeURIComponent(searchParams.error) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Gift Aid</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Build draft claims from eligible declarations, submit them, and mark paid claims so reclaimed Gift Aid flows into charity payout totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={buildClaimsAction}>
            <button type="submit" className="btn-primary" style={{ padding: "0.6rem 1rem" }}>
              Build draft claims
            </button>
          </form>
          <Link href="/admin/payouts" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Open payouts
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      {message ? (
        <div className="rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.92)", color: "#355247" }}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Declarations" value={String(overview.declarationCount)} sub="eligible Gift Aid records for this charity" />
        <StatCard label="Expected reclaim" value={fmt(overview.expectedAmount)} sub="from captured online donations" />
        <StatCard label="Received reclaim" value={fmt(overview.receivedAmount)} sub="already flowed into donation payout totals" />
        <StatCard label="Pending claims" value={fmt(overview.pendingClaimAmount)} sub="draft, submitted, or accepted claim value" />
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Gift Aid claims</h2>
          <p className="mt-2 text-sm" style={{ color: "#8A9E94" }}>
            Paid claims update linked donation records so payout batches can include reclaimed Gift Aid in full.
          </p>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Period", "Status", "Donations", "Reclaim", "Submitted", "Paid", "Items", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview.claims.map((claim, index) => (
              <tr key={claim.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none", verticalAlign: "top" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {formatDate(claim.periodStart)} to {formatDate(claim.periodEnd)}
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>{pill(claim.status)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{fmt(claim.totalDonations)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{fmt(claim.reclaimAmount)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {formatDate(claim.submittedAt)}
                  <div className="text-xs" style={{ color: "#8A9E94" }}>{claim.hmrcRef ?? "No HMRC ref"}</div>
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{formatDate(claim.paidAt)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {claim.items.length}
                  <div className="text-xs" style={{ color: "#8A9E94" }}>
                    {claim.items.filter((item) => item.declaration.donationId).length} linked donations
                  </div>
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="space-y-2">
                    {claim.status === "DRAFT" ? (
                      <form action={submitClaimAction} className="space-y-2">
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input name="hmrcRef" className="input" placeholder="HMRC reference" style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem" }} />
                        <button type="submit" className="btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                          Submit claim
                        </button>
                      </form>
                    ) : null}

                    {["SUBMITTED", "ACCEPTED"].includes(claim.status) ? (
                      <form action={markPaidAction}>
                        <input type="hidden" name="claimId" value={claim.id} />
                        <button type="submit" className="btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                          Mark paid
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {overview.claims.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No Gift Aid claims yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
        <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>What this now does</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7" style={{ color: "#355247" }}>
          <li>Draft claims are grouped by period and only pick up declarations that are not already claimed.</li>
          <li>Submitting a claim records HMRC reference and submission time.</li>
          <li>Marking a claim paid writes reclaim values into linked donations so `/admin/payouts` can include them in future batches.</li>
          <li>Gift Aid paid is also recorded in the ledger once per claim.</li>
        </ul>
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
