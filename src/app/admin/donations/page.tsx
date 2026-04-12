import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin - Donations" };

function fmt(value: string | number | null | undefined, currency = "GBP") {
  const amount = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function pill(status: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    CAPTURED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    PENDING: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
    FAILED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
    REFUNDED: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
    PARTIALLY_REFUNDED: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    AUTHORISED: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    DISPUTED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
    CANCELLED: { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" },
  };

  const style = palette[status] ?? { bg: "rgba(58,74,66,0.12)", color: "#3A4A42" };

  return (
    <span
      style={{
        borderRadius: "9999px",
        padding: "2px 8px",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    charityId?: string;
    giftAid?: string;
  };
}) {
  const { role, managedCharity } = await getAdminContext();
  const query = (searchParams.q ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const charityIdFilter = (searchParams.charityId ?? "").trim();
  const giftAidFilter = (searchParams.giftAid ?? "").trim();

  const charities = await db.charity.findMany({
    where: role === "PLATFORM_ADMIN" ? {} : { id: managedCharity?.id ?? "" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedCharityIds =
    role === "PLATFORM_ADMIN"
      ? charityIdFilter
        ? [charityIdFilter]
        : charities.map((charity) => charity.id)
      : managedCharity?.id
        ? [managedCharity.id]
        : [];

  const where = {
    page: {
      appeal: {
        charityId: {
          in: scopedCharityIds.length > 0 ? scopedCharityIds : ["__none__"],
        },
      },
    },
    ...(status ? { status: status as never } : {}),
    ...(giftAidFilter === "yes"
      ? { giftAidDeclaration: { isNot: null } }
      : giftAidFilter === "no"
        ? { giftAidDeclaration: { is: null } }
        : {}),
    ...(query
      ? {
          OR: [
            { donorName: { contains: query, mode: "insensitive" as const } },
            { donorEmail: { contains: query, mode: "insensitive" as const } },
            { page: { title: { contains: query, mode: "insensitive" as const } } },
            { page: { appeal: { title: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [donations, capturedAgg, pendingCount, recurringCount, giftAidCount] = await Promise.all([
    db.donation.findMany({
      where,
      include: {
        feeSet: true,
        payment: true,
        giftAidDeclaration: { select: { id: true } },
        refunds: { select: { id: true, amount: true } },
        page: {
          select: {
            title: true,
            shortName: true,
            appeal: {
              select: {
                id: true,
                title: true,
                slug: true,
                charity: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.donation.aggregate({
      where: { ...where, status: "CAPTURED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.donation.count({
      where: { ...where, status: "PENDING" },
    }),
    db.donation.count({
      where: { ...where, isRecurring: true },
    }),
    db.donation.count({
      where: { ...where, giftAidDeclaration: { isNot: null } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Donations</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Monitor donation intents, hosted test checkout outcomes, fee coverage, Gift Aid, and receipt state.
          </p>
        </div>
        <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.8rem" }}>
          Back to overview
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search donor, appeal, or page"
          className="input"
        />
        <select name="status" defaultValue={status} className="input">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CAPTURED">Captured</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partially refunded</option>
          <option value="DISPUTED">Disputed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select name="giftAid" defaultValue={giftAidFilter} className="input">
          <option value="">All Gift Aid states</option>
          <option value="yes">Gift Aid declared</option>
          <option value="no">No Gift Aid</option>
        </select>
        <div className="flex gap-3">
          {role === "PLATFORM_ADMIN" ? (
            <select name="charityId" defaultValue={charityIdFilter} className="input">
              <option value="">All charities</option>
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="charityId" value={managedCharity?.id ?? ""} />
          )}
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
            Apply
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Visible donations" value={String(donations.length)} sub="latest matching records" />
        <StatCard label="Captured value" value={fmt(capturedAgg._sum.amount?.toString())} sub={`${capturedAgg._count} captured donations`} />
        <StatCard label="Pending checkout" value={String(pendingCount)} sub="still awaiting payment confirmation" />
        <StatCard label="Gift Aid / recurring" value={`${giftAidCount} / ${recurringCount}`} sub="declared and recurring donations" />
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Donation records</h2>
            <p className="text-sm" style={{ color: "#8A9E94" }}>
              Fee snapshots, test checkout links, Gift Aid status, and receipt state are stored per donation.
            </p>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Created", "Donor", "Charity / Appeal", "Page", "Amount", "Fees", "Gift Aid", "Receipt", "Status", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donations.map((donation, index) => {
              const donorPays = donation.feeSet?.donorCoversFees
                ? parseFloat(donation.amount.toString()) + parseFloat(donation.feeSet.totalFees.toString())
                : parseFloat(donation.amount.toString());

              return (
                <tr key={donation.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none", verticalAlign: "top" }}>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {new Date(donation.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div className="font-semibold" style={{ color: "#233029" }}>
                      {donation.isAnonymous ? "Anonymous donation" : (donation.donorName ?? "Named donor missing")}
                    </div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>
                      {donation.donorEmail ?? "No receipt email"} {donation.isRecurring ? "· recurring" : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div className="font-semibold" style={{ color: "#233029" }}>{donation.page.appeal.charity.name}</div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>{donation.page.appeal.title}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div className="font-semibold" style={{ color: "#233029" }}>{donation.page.title}</div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>/fundraise/{donation.page.shortName}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div className="font-semibold" style={{ color: "#233029" }}>{fmt(donorPays, donation.currency)}</div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>
                      donation {fmt(donation.amount.toString(), donation.currency)}
                    </div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div style={{ color: "#233029" }}>
                      {fmt(donation.feeSet?.totalFees.toString() ?? "0", donation.currency)}
                    </div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>
                      {donation.feeSet?.donorCoversFees ? "Donor covers" : "Charity absorbs"}
                    </div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    {donation.giftAidDeclaration ? pill("CAPTURED") : <span style={{ color: "#8A9E94" }}>No</span>}
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    {donation.receiptIssuedAt ? (
                      <div style={{ color: "#233029" }}>
                        {new Date(donation.receiptIssuedAt).toLocaleString("en-GB")}
                      </div>
                    ) : (
                      <span style={{ color: "#8A9E94" }}>Pending / no email</span>
                    )}
                    {donation.payment?.providerRef ? (
                      <div className="text-xs" style={{ color: "#8A9E94" }}>
                        {donation.payment.provider}: {donation.payment.providerRef}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    {pill(donation.status)}
                    {donation.payment?.failureReason ? (
                      <div className="mt-1 text-xs" style={{ color: "#991B1B" }}>
                        {donation.payment.failureReason}
                      </div>
                    ) : null}
                    {donation.refunds.length > 0 ? (
                      <div className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                        {donation.refunds.length} refund record{donation.refunds.length === 1 ? "" : "s"}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    <div className="flex flex-col gap-2">
                      <Link href={`/appeals/${donation.page.appeal.slug}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                        View appeal
                      </Link>
                      <Link href={`/checkout/test/${donation.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                        {donation.status === "PENDING" ? "Open checkout" : "Open payment"}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {donations.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No donations match these filters.
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
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.1rem 1.2rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p>
    </div>
  );
}
