import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin - Charity Overview" };

export default async function CharityDetailPage({
  params,
  searchParams,
}: {
  params: { charityId: string };
  searchParams: { error?: string };
}) {
  const { role, managedCharity } = await getAdminContext();

  const charity = await db.charity.findFirst({
    where: {
      id: params.charityId,
      ...(role === "PLATFORM_ADMIN" ? {} : { id: managedCharity?.id }),
    },
    include: {
      _count: { select: { appeals: true, admins: true } },
      appeals: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { fundraisingPages: true, teams: true } } },
      },
    },
  });

  if (!charity) {
    redirect("/admin/charities");
  }

  const [onlineAgg, offlineAgg, pendingPayoutAgg, giftAidAgg, recentDonations, recentPayouts] = await Promise.all([
    db.donation.aggregate({ where: { page: { appeal: { charityId: charity.id } }, status: "CAPTURED" }, _sum: { amount: true }, _count: true }),
    db.offlineDonation.aggregate({ where: { page: { appeal: { charityId: charity.id } }, status: "APPROVED" }, _sum: { amount: true }, _count: true }),
    db.payoutBatch.aggregate({ where: { charityId: charity.id, status: { in: ["SCHEDULED", "PROCESSING"] } }, _sum: { netAmount: true } }),
    db.giftAidClaim.aggregate({ where: { charityId: charity.id, status: { in: ["DRAFT", "SUBMITTED"] } }, _sum: { reclaimAmount: true } }),
    db.donation.findMany({
      where: { page: { appeal: { charityId: charity.id } } },
      include: { page: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.payoutBatch.findMany({ where: { charityId: charity.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const fmt = (val: string | number | null | undefined, currency = charity.defaultCurrency) => {
    const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>{charity.name}</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            {charity._count.appeals} appeals · {charity._count.admins} admins
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/charities" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Back to charities
          </Link>
          <Link href={`/admin/charities/${charity.id}/edit`} className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Edit charity
          </Link>
          <Link href="/admin/appeals/new" className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            New appeal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total raised" value={fmt((parseFloat(onlineAgg._sum.amount?.toString() ?? "0") + parseFloat(offlineAgg._sum.amount?.toString() ?? "0")).toString())} />
        <StatCard label="Online raised" value={fmt(onlineAgg._sum.amount?.toString())} sub={`${onlineAgg._count} donations`} />
        <StatCard label="Offline raised" value={fmt(offlineAgg._sum.amount?.toString())} sub={`${offlineAgg._count} entries`} />
        <StatCard label="Pending payout" value={fmt(pendingPayoutAgg._sum.netAmount?.toString())} />
        <StatCard label="Gift Aid pending" value={fmt(giftAidAgg._sum.reclaimAmount?.toString())} />
        <StatCard label="Status" value={charity.status} sub={charity.verificationStatus} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Profile">
            <div className="grid gap-4 md:grid-cols-2 text-sm" style={{ color: "#3A4A42" }}>
              <Info label="Slug" value={charity.slug} />
              <Info label="Charity number" value={charity.charityNumber ?? charity.registrationNo ?? "Not set"} />
              <Info label="Contact email" value={charity.contactEmail ?? "Not set"} />
              <Info label="Default currency" value={charity.defaultCurrency} />
              <Info label="Website" value={charity.websiteUrl ?? "Not set"} />
              <Info label="Verification" value={charity.verificationStatus} />
            </div>
            {charity.shortDescription ? (
              <p className="mt-4 text-sm" style={{ color: "#3A4A42" }}>{charity.shortDescription}</p>
            ) : null}
          </Panel>

          <Panel title="Recent donations">
            <div className="space-y-3">
              {recentDonations.map((donation) => (
                <div key={donation.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "rgba(18,78,64,0.08)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#233029" }}>
                      {donation.isAnonymous ? "Anonymous" : donation.donorName ?? "Unnamed donor"}
                    </p>
                    <p className="text-xs" style={{ color: "#8A9E94" }}>{donation.page.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: "#233029" }}>{fmt(donation.amount.toString(), donation.currency)}</p>
                    <p className="text-xs" style={{ color: "#8A9E94" }}>{donation.status}</p>
                  </div>
                </div>
              ))}
              {recentDonations.length === 0 ? <p className="text-sm" style={{ color: "#8A9E94" }}>No donations yet.</p> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Appeals">
            <div className="space-y-3">
              {charity.appeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border p-3" style={{ borderColor: "rgba(18,78,64,0.08)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: "#233029" }}>{appeal.title}</p>
                    <span className="text-xs" style={{ color: "#8A9E94" }}>{appeal.status}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                    {appeal._count.fundraisingPages} pages · {appeal._count.teams} teams
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/admin/appeals/${appeal.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      Open
                    </Link>
                    <Link href={`/appeals/${appeal.slug}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {charity.appeals.length === 0 ? <p className="text-sm" style={{ color: "#8A9E94" }}>No appeals yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Recent payouts">
            <div className="space-y-3">
              {recentPayouts.map((payout) => (
                <div key={payout.id} className="rounded-xl border p-3" style={{ borderColor: "rgba(18,78,64,0.08)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "#233029" }}>{fmt(payout.netAmount.toString(), payout.currency)}</span>
                    <span className="text-xs" style={{ color: "#8A9E94" }}>{payout.status}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>{new Date(payout.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              ))}
              {recentPayouts.length === 0 ? <p className="text-sm" style={{ color: "#8A9E94" }}>No payouts yet.</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.1rem 1.2rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>{value}</p>
      {sub ? <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
      <h2 className="font-semibold mb-4" style={{ color: "#233029" }}>{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p style={{ color: "#233029" }}>{value}</p>
    </div>
  );
}
