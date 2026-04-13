import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import {
  createScheduledPayoutBatch,
  getCharityPayoutOverview,
  markPayoutBatchPaid,
  markPayoutBatchProcessing,
} from "@/server/lib/payouts";

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
    SCHEDULED: { bg: "rgba(212,160,23,0.12)", color: "#8A5B00" },
    PROCESSING: { bg: "rgba(37,99,235,0.12)", color: "#1D4ED8" },
    PAID: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    FAILED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  };
  const style = palette[status] ?? { bg: "rgba(18,78,64,0.08)", color: "#355247" };

  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { role, managedCharity } = await getAdminContext();

  if (!managedCharity) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Payouts</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>No managed charity was found for this user.</p>
      </div>
    );
  }

  async function createBatchAction() {
    "use server";

    const { managedCharity: currentManagedCharity } = await getAdminContext();
    if (!currentManagedCharity) {
      redirect("/admin/payouts?error=no-charity");
    }

    try {
      await createScheduledPayoutBatch(currentManagedCharity.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create payout batch.";
      redirect(`/admin/payouts?error=${encodeURIComponent(message)}`);
    }

    revalidateAdminSurfaces(["/admin/payouts"]);
    redirect("/admin/payouts");
  }

  async function markProcessingAction(formData: FormData) {
    "use server";

    const payoutBatchId = String(formData.get("payoutBatchId") ?? "");
    if (!payoutBatchId) {
      redirect("/admin/payouts");
    }

    await markPayoutBatchProcessing(payoutBatchId);
    revalidateAdminSurfaces(["/admin/payouts"]);
    redirect("/admin/payouts");
  }

  async function markPaidAction(formData: FormData) {
    "use server";

    const payoutBatchId = String(formData.get("payoutBatchId") ?? "");
    const providerRef = String(formData.get("providerRef") ?? "").trim();
    const bankRef = String(formData.get("bankRef") ?? "").trim();

    if (!payoutBatchId) {
      redirect("/admin/payouts");
    }

    await markPayoutBatchPaid({
      payoutBatchId,
      providerRef: providerRef || null,
      bankRef: bankRef || null,
    });
    revalidateAdminSurfaces(["/admin/payouts"]);
    redirect("/admin/payouts");
  }

  const [overview, recentBatches, bankAccounts] = await Promise.all([
    getCharityPayoutOverview(managedCharity.id),
    db.payoutBatch.findMany({
      where: role === "PLATFORM_ADMIN" ? {} : { charityId: managedCharity.id },
      include: {
        charity: { select: { name: true } },
        bankAccount: { select: { accountName: true, maskedAccount: true, maskedSortCode: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.bankAccount.findMany({
      where: { charityId: managedCharity.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      take: 5,
    }),
  ]);

  const errorMessage = searchParams.error ? decodeURIComponent(searchParams.error) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>Payouts</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Contract-aware payout operations. Donor support never enters the charity payout pool, and received Gift Aid flows through in full.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={createBatchAction}>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: "0.6rem 1rem", opacity: overview.payoutsBlocked || overview.unbatchedDonationCount === 0 ? 0.6 : 1 }}
              disabled={overview.payoutsBlocked || overview.unbatchedDonationCount === 0}
            >
              Create payout batch
            </button>
          </form>
          <Link href="/admin/settings" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Open fees & contracts
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(185, 28, 28, 0.14)", background: "#FEF2F2", color: "#991B1B" }}>
          {errorMessage}
        </div>
      ) : null}

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
          <div>
            <p style={{ color: "#8A9E94" }}>Unbatched donations</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>
              {overview.unbatchedDonationCount} donations · {fmt(overview.unbatchedNetAmount)}
            </p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Default bank account</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>
              {bankAccounts[0] ? `${bankAccounts[0].accountName} ${bankAccounts[0].maskedAccount ?? bankAccounts[0].maskedSortCode ?? ""}` : "No verified bank account available"}
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Recent payout batches</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Created", "Charity", "Bank", "Gross", "Fees", "Net", "Items", "Status", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentBatches.map((batch, index) => (
              <tr key={batch.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none", verticalAlign: "top" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{new Date(batch.createdAt).toLocaleDateString("en-GB")}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{batch.charity.name}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {batch.bankAccount.accountName}
                  <div className="text-xs" style={{ color: "#8A9E94" }}>
                    {batch.bankAccount.maskedAccount ?? batch.bankAccount.maskedSortCode ?? "Masked account unavailable"}
                  </div>
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(batch.grossAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(batch.feesAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{fmt(batch.netAmount, batch.currency)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {batch.items.length}
                  <div className="text-xs" style={{ color: "#8A9E94" }}>
                    {batch.items.filter((item) => item.itemType === "GIFT_AID").length} Gift Aid items
                  </div>
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>{pill(batch.status)}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="space-y-2">
                    {batch.status === "SCHEDULED" ? (
                      <form action={markProcessingAction}>
                        <input type="hidden" name="payoutBatchId" value={batch.id} />
                        <button type="submit" className="btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                          Mark processing
                        </button>
                      </form>
                    ) : null}
                    {batch.status !== "PAID" ? (
                      <form action={markPaidAction} className="space-y-2">
                        <input type="hidden" name="payoutBatchId" value={batch.id} />
                        <input name="providerRef" placeholder="Provider ref" className="input" style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem" }} />
                        <input name="bankRef" placeholder="Bank ref" className="input" style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem" }} />
                        <button type="submit" className="btn-outline" style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>
                          Mark paid
                        </button>
                      </form>
                    ) : (
                      <div className="text-xs" style={{ color: "#8A9E94" }}>
                        {batch.providerRef || batch.bankRef ? `Refs: ${[batch.providerRef, batch.bankRef].filter(Boolean).join(" · ")}` : "Paid"}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {recentBatches.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
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
