import Link from "next/link";
import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { getReportsDashboardData, resolveAdminReportScope } from "@/server/lib/reports";
import { getReconciliationDashboardData } from "@/server/lib/reconciliation";
import type { ReportsRole } from "@/server/lib/reports";

export const metadata: Metadata = { title: "Admin - Reports" };

type AdminReportsSearchParams = {
  charityId?: string;
  start?: string;
  end?: string;
};

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

function sumValues(values: Array<string | number | { toString(): string } | null | undefined>) {
  return values.reduce<number>((total, value) => {
    const amount =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? parseFloat(value)
          : parseFloat(value?.toString() ?? "0");

    return total + amount;
  }, 0);
}

function buildExportHref(input: {
  report:
    | "donations"
    | "offline"
    | "payouts"
    | "gift-aid"
    | "gl"
    | "payout-reconciliation"
    | "gift-aid-reconciliation"
    | "finance-exceptions";
  charityId?: string;
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams({ report: input.report });

  // We keep the export query builder in one place so the card CTAs and
  // filter form always emit the same scoped download URLs.
  if (input.charityId) {
    params.set("charityId", input.charityId);
  }
  if (input.start) {
    params.set("start", input.start);
  }
  if (input.end) {
    params.set("end", input.end);
  }

  return `/api/admin/reports/export?${params.toString()}`;
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "positive" | "neutral" | "warning" }) {
  const palette = {
    positive: { background: "rgba(30,140,110,0.12)", color: "#124E40" },
    neutral: { background: "rgba(58,74,66,0.10)", color: "#355247" },
    warning: { background: "rgba(212,160,23,0.15)", color: "#8A5B00" },
  }[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: palette.background, color: palette.color }}
    >
      {label}
    </span>
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

function ExportCard({
  title,
  description,
  href,
  meta,
}: {
  title: string;
  description: string;
  href: string;
  meta: string;
}) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.25rem" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "#233029" }}>{title}</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "#5F766C" }}>{description}</p>
        </div>
        <StatusPill label="CSV" tone="positive" />
      </div>
      <p className="mt-3 text-xs" style={{ color: "#8A9E94" }}>{meta}</p>
      <Link href={href} className="btn-outline mt-4 inline-flex" style={{ padding: "0.6rem 0.95rem", fontSize: "0.8rem" }}>
        Export CSV
      </Link>
    </div>
  );
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: AdminReportsSearchParams;
}) {
  const { userId, role, managedCharity } = await getAdminContext();
  const charityIdFilter = (searchParams.charityId ?? "").trim();
  const start = (searchParams.start ?? "").trim();
  const end = (searchParams.end ?? "").trim();

  // The scope helper keeps reports aligned with the rest of admin access
  // rules, including platform-wide access and charity-admin restrictions.
  const scope = await resolveAdminReportScope({
    userId,
    role: role as ReportsRole,
    charityId: charityIdFilter || undefined,
  });

  const effectiveCharityId = role === "PLATFORM_ADMIN" || role === "FINANCE"
    ? charityIdFilter || undefined
    : scope.managedCharityId ?? managedCharity?.id ?? undefined;

  const filters = {
    charityId: effectiveCharityId ?? null,
    start: start || null,
    end: end || null,
  };

  const dashboardData = await getReportsDashboardData({
    scopedCharityIds: scope.scopedCharityIds,
    filters,
  });
  const reconciliationData = await getReconciliationDashboardData({
    scopedCharityIds: scope.scopedCharityIds,
    filters,
  });

  const donationGrossTotal = sumValues(
    dashboardData.donations.map((row) => row.grossCheckoutTotal ?? row.amount)
  );
  const donationNetTotal = sumValues(
    dashboardData.donations.map((row) => row.charityNetAmount ?? row.amount)
  );
  const offlineTotal = sumValues(dashboardData.offlineDonations.map((row) => row.amount));
  const payoutTotal = sumValues(dashboardData.payouts.map((row) => row.netAmount));
  const giftAidTotal = sumValues(dashboardData.claims.map((row) => row.reclaimAmount));
  const ledgerLineCount = dashboardData.ledgerEntries.reduce((count, entry) => count + entry.lines.length, 0);

  const donationExportHref = buildExportHref({
    report: "donations",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const offlineExportHref = buildExportHref({
    report: "offline",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const payoutsExportHref = buildExportHref({
    report: "payouts",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const giftAidExportHref = buildExportHref({
    report: "gift-aid",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const glExportHref = buildExportHref({
    report: "gl",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const payoutReconciliationHref = buildExportHref({
    report: "payout-reconciliation",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const giftAidReconciliationHref = buildExportHref({
    report: "gift-aid-reconciliation",
    charityId: effectiveCharityId,
    start,
    end,
  });
  const financeExceptionsHref = buildExportHref({
    report: "finance-exceptions",
    charityId: effectiveCharityId,
    start,
    end,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Reports & exports</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Export operations data and accounting-ready ledger rows with the same charity scope used across the admin platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={glExportHref} className="btn-primary" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Export GL
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      <form className="grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-4">
        {role === "PLATFORM_ADMIN" || role === "FINANCE" ? (
          <select name="charityId" defaultValue={charityIdFilter} className="input">
            <option value="">All charities</option>
            {scope.charities.map((charity) => (
              <option key={charity.id} value={charity.id}>
                {charity.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="input flex items-center" style={{ color: "#355247" }}>
            {managedCharity?.name ?? "Managed charity"}
            <input type="hidden" name="charityId" value={effectiveCharityId ?? ""} />
          </div>
        )}
        <input type="date" name="start" defaultValue={start} className="input" />
        <input type="date" name="end" defaultValue={end} className="input" />
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
            Apply filters
          </button>
          <Link href="/admin/reports" className="btn-outline" style={{ padding: "0.7rem 1.1rem", fontSize: "0.85rem" }}>
            Reset
          </Link>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Donation gross" value={fmt(donationGrossTotal)} sub={`${dashboardData.donations.length} donation records in scope`} />
        <StatCard label="Donation net" value={fmt(donationNetTotal)} sub="charity net after charity-paid fee logic" />
        <StatCard label="Offline recorded" value={fmt(offlineTotal)} sub={`${dashboardData.offlineDonations.length} approved or pending offline gifts`} />
        <StatCard label="Payouts / Gift Aid" value={`${fmt(payoutTotal)} / ${fmt(giftAidTotal)}`} sub={`${dashboardData.payouts.length} payout batches, ${dashboardData.claims.length} claims, ${ledgerLineCount} GL lines`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ExportCard
          title="Donations export"
          description="Donation operations including pricing snapshots, refunded amounts, dispute state, payout exposure, and Gift Aid expectations."
          href={donationExportHref}
          meta={`${dashboardData.donations.length} rows currently match the selected scope.`}
        />
        <ExportCard
          title="Offline donations export"
          description="Manual and CSV-imported offline gifts with batch references, notes, and Gift Aid declaration status."
          href={offlineExportHref}
          meta={`${dashboardData.offlineDonations.length} rows currently match the selected scope.`}
        />
        <ExportCard
          title="Payouts export"
          description="Batch-level payout history including gross, fees, net, bank references, and payout-item counts."
          href={payoutsExportHref}
          meta={`${dashboardData.payouts.length} payout batches currently match the selected scope.`}
        />
        <ExportCard
          title="Gift Aid export"
          description="Claim periods, statuses, HMRC references, reclaim amounts, and settlement timestamps."
          href={giftAidExportHref}
          meta={`${dashboardData.claims.length} claim rows currently match the selected scope.`}
        />
        <ExportCard
          title="General ledger export"
          description="Accounting-ready journal rows with entry IDs, account codes, debit and credit minor units, references, and descriptions."
          href={glExportHref}
          meta={`${dashboardData.ledgerEntries.length} journal entries and ${ledgerLineCount} ledger lines currently match the selected scope.`}
        />
        <ExportCard
          title="Payout reconciliation"
          description="Batch-level reconciliation view with donation totals, fee totals, donor-support exclusions, Gift Aid allocations, readiness state, and references."
          href={payoutReconciliationHref}
          meta={`${reconciliationData.payoutRows.length} payout reconciliation rows currently match the selected scope.`}
        />
        <ExportCard
          title="Gift Aid reconciliation"
          description="Claim-level expected vs submitted vs paid reconciliation, with payout-linkage status for received reclaim values."
          href={giftAidReconciliationHref}
          meta={`${reconciliationData.giftAidRows.length} Gift Aid reconciliation rows currently match the selected scope.`}
        />
        <ExportCard
          title="Finance exceptions"
          description="Operational exception queue for blocked payouts, missing references, unclaimed Gift Aid, and refund/dispute payout implications."
          href={financeExceptionsHref}
          meta={`${reconciliationData.exceptionRows.length} exception rows currently match the selected scope.`}
        />
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Finance exceptions</h2>
              <p className="text-sm" style={{ color: "#8A9E94" }}>
                Reconciliation-first queue showing payout, Gift Aid, and donation exception states that need finance attention.
              </p>
            </div>
            <Link href={`/admin/reconciliation?${new URLSearchParams({
              ...(effectiveCharityId ? { charityId: effectiveCharityId } : {}),
              ...(start ? { start } : {}),
              ...(end ? { end } : {}),
            }).toString()}`} className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
              Open exception queue →
            </Link>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Date", "Type", "Status", "Charity", "Summary", "Action hint"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reconciliationData.exceptionRows.slice(0, 10).map((item, index) => (
              <tr key={`${item.exceptionType}-${item.relatedEntityId}-${index}`} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {new Date(item.relatedDate).toLocaleDateString("en-GB")}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.exceptionType}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <StatusPill label={item.exceptionStatus} tone={item.exceptionStatus === "OPEN" ? "warning" : "neutral"} />
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{item.charityName}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.summary}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.actionHint}</td>
              </tr>
            ))}
            {reconciliationData.exceptionRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No finance exceptions match the current scope and filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Latest donations</h2>
                <p className="text-sm" style={{ color: "#8A9E94" }}>
                  A quick operational preview before exporting the full donation dataset.
                </p>
              </div>
              <Link href="/admin/donations" className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                Open donations →
              </Link>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#F6F1E8" }}>
                {["Created", "Donor", "Appeal", "Gross", "Net", "Exceptions", "Gift Aid"].map((heading) => (
                  <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dashboardData.donations.slice(0, 8).map((donation, index) => (
                <tr key={donation.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {new Date(donation.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>
                    {donation.isAnonymous ? "Anonymous" : donation.donorName ?? donation.donorEmail ?? "Unknown donor"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    <div>{donation.page.appeal.title}</div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>{donation.page.appeal.charity.name}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>
                    {fmt(donation.grossCheckoutTotal ?? donation.amount, donation.currency)}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {fmt(donation.charityNetAmount ?? donation.amount, donation.currency)}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {donation.refunds.length > 0 || donation.disputes.length > 0
                      ? `${donation.refunds.length} refund / ${donation.disputes.length} dispute`
                      : "None"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem" }}>
                    {donation.giftAidDeclaration ? <StatusPill label="Declared" tone="positive" /> : <StatusPill label="No claim" />}
                  </td>
                </tr>
              ))}
              {dashboardData.donations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                    No donation rows match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Payouts & claims</h2>
                <p className="text-sm" style={{ color: "#8A9E94" }}>
                  Recent payout and Gift Aid settlement rows that feed the finance exports.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/admin/payouts" className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                  Payouts →
                </Link>
                <Link href="/admin/gift-aid" className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                  Gift Aid →
                </Link>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 pt-0">
            <div className="rounded-[1rem] border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FDFBF7" }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Recent payout batches</h3>
                <StatusPill label={`${dashboardData.payouts.length} total`} />
              </div>
              <div className="space-y-3">
                {dashboardData.payouts.slice(0, 4).map((batch) => (
                  <div key={batch.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#233029" }}>{batch.charity.name}</p>
                      <p className="text-xs" style={{ color: "#8A9E94" }}>
                        {new Date(batch.createdAt).toLocaleDateString("en-GB")} · {batch.items.length} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: "#233029" }}>{fmt(batch.netAmount, batch.currency)}</p>
                      <p className="text-xs" style={{ color: "#8A9E94" }}>{batch.status}</p>
                    </div>
                  </div>
                ))}
                {dashboardData.payouts.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8A9E94" }}>No payout batches match the current filters.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1rem] border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FDFBF7" }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Recent Gift Aid claims</h3>
                <StatusPill label={`${dashboardData.claims.length} total`} tone="warning" />
              </div>
              <div className="space-y-3">
                {dashboardData.claims.slice(0, 4).map((claim) => (
                  <div key={claim.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#233029" }}>{claim.charity.name}</p>
                      <p className="text-xs" style={{ color: "#8A9E94" }}>
                        {new Date(claim.periodStart).toLocaleDateString("en-GB")} to {new Date(claim.periodEnd).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: "#233029" }}>{fmt(claim.reclaimAmount)}</p>
                      <p className="text-xs" style={{ color: "#8A9E94" }}>{claim.status}</p>
                    </div>
                  </div>
                ))}
                {dashboardData.claims.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8A9E94" }}>No Gift Aid claims match the current filters.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>General ledger preview</h2>
              <p className="text-sm" style={{ color: "#8A9E94" }}>
                The GL export follows the spec-style journal row format so finance can move from operational exports into accounting workflows.
              </p>
            </div>
            <Link href={glExportHref} className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
              Download GL CSV →
            </Link>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Entry", "Charity", "Account", "Debit", "Credit", "Reference"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dashboardData.ledgerEntries.flatMap((entry) =>
              entry.lines.map((line, index) => (
                <tr key={`${entry.id}-${line.id}`} style={{ borderTop: "1px solid rgba(18,78,64,0.06)" }}>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: index === 0 ? 600 : 500 }}>
                    {index === 0 ? entry.id : ""}
                    <div className="text-xs" style={{ color: "#8A9E94" }}>
                      {index === 0 ? new Date(entry.createdAt).toLocaleDateString("en-GB") : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {entry.donation?.page.appeal.charity.name ?? entry.payoutBatch?.charity.name ?? "Gift Aid / platform ledger"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029" }}>
                    <div className="font-semibold">{line.accountCode}</div>
                    <div className="text-xs" style={{ color: "#8A9E94" }}>{line.description ?? entry.description}</div>
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {parseFloat(line.debit.toString()) > 0 ? fmt(line.debit, line.currency) : "—"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {parseFloat(line.credit.toString()) > 0 ? fmt(line.credit, line.currency) : "—"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#8A9E94" }}>
                    {entry.donationId ?? entry.payoutBatchId ?? entry.refundId ?? entry.correlationId}
                  </td>
                </tr>
              ))
            ).slice(0, 10)}
            {dashboardData.ledgerEntries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No ledger entries match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
