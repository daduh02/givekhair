import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin dashboard" };

function fmt(val: string | number | null | undefined, currency = "GBP") {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  // Find charity this admin manages
  const charityAdmin = await db.charityAdmin.findFirst({
    where: { userId: session.user.id },
    include: { charity: true },
  });

  if (!charityAdmin && session.user.role !== "PLATFORM_ADMIN") {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="mb-2 text-lg font-medium">No charity linked</h1>
          <p className="text-sm text-gray-500">Your account isn't linked to a charity yet. Contact platform support.</p>
        </div>
      </>
    );
  }

  const charityId = charityAdmin?.charityId ?? "";
  const charity = charityAdmin?.charity;

  const [onlineAgg, offlineAgg, pendingPayoutAgg, giftAidAgg, recentDonations, appeals] =
    await Promise.all([
      db.donation.aggregate({
        where: { page: { appeal: { charityId } }, status: "CAPTURED" },
        _sum: { amount: true },
        _count: true,
      }),
      db.offlineDonation.aggregate({
        where: { page: { appeal: { charityId } }, status: "APPROVED" },
        _sum: { amount: true },
      }),
      db.payoutBatch.aggregate({
        where: { charityId, status: { in: ["SCHEDULED", "PROCESSING"] } },
        _sum: { netAmount: true },
      }),
      db.giftAidClaim.aggregate({
        where: { charityId, status: { in: ["DRAFT", "SUBMITTED"] } },
        _sum: { reclaimAmount: true },
      }),
      db.donation.findMany({
        where: { page: { appeal: { charityId } } },
        include: {
          feeSet: { select: { donorCoversFees: true } },
          giftAidDeclaration: { select: { id: true } },
          page: { select: { shortName: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.appeal.findMany({
        where: { charityId },
        include: { _count: { select: { fundraisingPages: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const coverPct =
    onlineAgg._count > 0
      ? Math.round(
          (recentDonations.filter((d) => d.feeSet?.donorCoversFees).length / onlineAgg._count) * 100
        )
      : 0;

  const statusColor: Record<string, string> = {
    CAPTURED: "badge-green",
    PENDING: "badge-amber",
    FAILED: "badge-red",
    REFUNDED: "badge-gray",
    DISPUTED: "badge-red",
  };

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{charity?.name ?? "Platform admin"}</h1>
            <p className="text-sm text-gray-500">Charity dashboard</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/appeals/new" className="btn-outline text-sm">New appeal</Link>
            <Link href="/admin/reports" className="btn-primary text-sm">Export CSV</Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total raised", value: fmt(parseFloat(onlineAgg._sum.amount?.toString() ?? "0") + parseFloat(offlineAgg._sum.amount?.toString() ?? "0")), color: "text-green-700" },
            { label: "Online raised", value: fmt(onlineAgg._sum.amount?.toString()), color: "text-gray-900" },
            { label: "Offline raised", value: fmt(offlineAgg._sum.amount?.toString()), color: "text-gray-900" },
            { label: "Pending payout", value: fmt(pendingPayoutAgg._sum.netAmount?.toString()), color: "text-green-600" },
            { label: "Gift Aid pending", value: fmt(giftAidAgg._sum.reclaimAmount?.toString()), color: "text-green-600" },
            { label: "Fee cover rate", value: `${coverPct}%`, color: "text-gray-900" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-medium ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent donations table */}
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-medium text-gray-900">Recent donations</h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Donor</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Gift Aid</th>
                    <th className="px-4 py-3 text-left font-medium">Page</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentDonations.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {d.isAnonymous ? "Anonymous" : (d.donorName ?? "—")}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        £{parseFloat(d.amount.toString()).toFixed(2)}
                        {d.feeSet?.donorCoversFees && (
                          <span className="ml-1 text-xs text-green-600">+fees</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d.giftAidDeclaration ? (
                          <span className="badge-green">Yes</span>
                        ) : (
                          <span className="badge-gray">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        <Link href={`/fundraise/${d.page.shortName}`} className="hover:text-green-600">
                          {d.page.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusColor[d.status] ?? "badge-gray"}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentDonations.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">No donations yet.</p>
              )}
            </div>
          </div>

          {/* Appeals sidebar */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-900">Appeals</h2>
            <div className="space-y-2">
              {appeals.map((a) => (
                <div key={a.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                    <span className={a.status === "ACTIVE" ? "badge-green" : "badge-gray"}>
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {a._count.fundraisingPages} page{a._count.fundraisingPages !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
              {appeals.length === 0 && (
                <p className="text-sm text-gray-400">No appeals yet.</p>
              )}
              <Link href="/admin/appeals/new" className="btn-outline mt-2 w-full text-center text-sm">
                + New appeal
              </Link>
            </div>

            {/* Quick links */}
            <h2 className="mb-3 mt-6 text-sm font-medium text-gray-900">Actions</h2>
            <div className="space-y-1 text-sm">
              {[
                { href: "/admin/payouts", label: "Payouts" },
                { href: "/admin/gift-aid", label: "Gift Aid claims" },
                { href: "/admin/offline", label: "Offline donations" },
                { href: "/admin/reports", label: "Reports & exports" },
                { href: "/admin/settings", label: "Settings" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-green-700"
                >
                  {link.label} <span className="text-gray-300">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
