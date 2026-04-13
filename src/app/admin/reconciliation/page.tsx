import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import { db } from "@/lib/db";
import { resolveAdminReportScope } from "@/server/lib/reports";
import { enqueueFinanceExceptionAlert } from "@/server/lib/queues";
import {
  getFinanceExceptionRows,
  getGiftAidReconciliationRows,
  getPayoutReconciliationRows,
} from "@/server/lib/reconciliation";
import { runFinanceAutomation } from "@/server/lib/finance-automation";
import type { ReportsRole } from "@/server/lib/reports";

export const metadata: Metadata = { title: "Admin — Reconciliation" };

type ReconciliationSearchParams = {
  charityId?: string;
  exceptionType?: string;
  exceptionStatus?: string;
  start?: string;
  end?: string;
  notice?: string;
};

function fmt(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusPill(label: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    OPEN: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    WARNING: { bg: "rgba(58,74,66,0.10)", color: "#355247" },
    BLOCKED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
    READY: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    MISSING_REFERENCE: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    FAILED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
    FULLY_ALLOCATED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    PARTIALLY_ALLOCATED: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    NOT_ALLOCATED: { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
    NOT_APPLICABLE: { bg: "rgba(58,74,66,0.10)", color: "#355247" },
  };
  const style = palette[label] ?? { bg: "rgba(58,74,66,0.10)", color: "#355247" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

function buildEntityLink(entityType: string, entityId: string) {
  if (!entityId) {
    return "/admin/settings";
  }

  if (entityType === "DONATION") {
    return `/admin/donations?focus=${entityId}`;
  }
  if (entityType === "PAYOUT_BATCH") {
    return `/admin/payouts?focus=${entityId}`;
  }
  if (entityType === "GIFT_AID_CLAIM") {
    return `/admin/gift-aid?focus=${entityId}`;
  }

  return `/admin/settings/contracts/${entityId}`;
}

export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: ReconciliationSearchParams;
}) {
  const { userId, role, managedCharity } = await getAdminContext();
  const charityIdFilter = (searchParams.charityId ?? "").trim();
  const exceptionType = (searchParams.exceptionType ?? "").trim();
  const exceptionStatus = (searchParams.exceptionStatus ?? "").trim();
  const start = (searchParams.start ?? "").trim();
  const end = (searchParams.end ?? "").trim();
  const notice = (searchParams.notice ?? "").trim();

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
    exceptionType: exceptionType || null,
    exceptionStatus: exceptionStatus || null,
  };

  const exportQuery = new URLSearchParams({
    ...(effectiveCharityId ? { charityId: effectiveCharityId } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(exceptionType ? { exceptionType } : {}),
    ...(exceptionStatus ? { exceptionStatus } : {}),
  }).toString();

  const baseQuery = new URLSearchParams({
    ...(effectiveCharityId ? { charityId: effectiveCharityId } : {}),
    ...(exceptionType ? { exceptionType } : {}),
    ...(exceptionStatus ? { exceptionStatus } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  }).toString();

  async function queueAlertAction() {
    "use server";
    const admin = await getAdminContext();
    const scopeForAction = await resolveAdminReportScope({
      userId: admin.userId,
      role: admin.role as ReportsRole,
      charityId: effectiveCharityId,
    });
    const exceptions = await getFinanceExceptionRows({
      scopedCharityIds: scopeForAction.scopedCharityIds,
      filters,
    });
    const stale = exceptions.filter((item) => {
      const ageDays = Math.floor((Date.now() - new Date(item.relatedDate).getTime()) / 86_400_000);
      return ageDays >= 14;
    });
    const summary = stale.length
      ? `${stale.length} stale reconciliation exception(s) require review.`
      : "No stale reconciliation exceptions currently in scope.";

    await enqueueFinanceExceptionAlert({
      charityId: effectiveCharityId ?? null,
      summary,
    });

    revalidateAdminSurfaces(["/admin/reconciliation"]);
    redirect(`/admin/reconciliation?${baseQuery}${baseQuery ? "&" : ""}notice=${encodeURIComponent("Queued finance exception alert.")}`);
  }

  async function runAutomationDryRunAction() {
    "use server";
    const admin = await getAdminContext();
    const scopeForAction = await resolveAdminReportScope({
      userId: admin.userId,
      role: admin.role as ReportsRole,
      charityId: effectiveCharityId,
    });
    const result = await runFinanceAutomation({
      scopedCharityIds: scopeForAction.scopedCharityIds,
      requestedById: admin.userId,
      execute: false,
    });
    revalidateAdminSurfaces(["/admin/reconciliation", "/admin/payouts", "/admin/gift-aid"]);
    redirect(`/admin/reconciliation?${baseQuery}${baseQuery ? "&" : ""}notice=${encodeURIComponent(result.summary)}`);
  }

  async function runAutomationExecuteAction() {
    "use server";
    const admin = await getAdminContext();
    const scopeForAction = await resolveAdminReportScope({
      userId: admin.userId,
      role: admin.role as ReportsRole,
      charityId: effectiveCharityId,
    });
    const result = await runFinanceAutomation({
      scopedCharityIds: scopeForAction.scopedCharityIds,
      requestedById: admin.userId,
      execute: true,
    });
    revalidateAdminSurfaces(["/admin/reconciliation", "/admin/payouts", "/admin/gift-aid"]);
    redirect(`/admin/reconciliation?${baseQuery}${baseQuery ? "&" : ""}notice=${encodeURIComponent(result.summary)}`);
  }

  const [payoutRows, giftAidRows, exceptionRows, exportLogs, automationRuns] = await Promise.all([
    getPayoutReconciliationRows({ scopedCharityIds: scope.scopedCharityIds, filters }),
    getGiftAidReconciliationRows({ scopedCharityIds: scope.scopedCharityIds, filters }),
    getFinanceExceptionRows({ scopedCharityIds: scope.scopedCharityIds, filters }),
    db.reportExportLog.findMany({
      where: {
        OR: [
          { charityId: { in: scope.scopedCharityIds.length ? scope.scopedCharityIds : ["__none__"] } },
          { charityId: null, requestedCharityId: effectiveCharityId ?? undefined },
          role === "PLATFORM_ADMIN" || role === "FINANCE"
            ? { exportedById: userId }
            : undefined,
        ].filter(Boolean) as object[],
      },
      include: {
        exportedBy: { select: { name: true, email: true } },
        charity: { select: { name: true } },
        artifact: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.financeAutomationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: {
        requestedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  const blockedPayoutRows = payoutRows.filter((row) => row.readinessStatus === "BLOCKED").length;
  const missingPayoutRefs = payoutRows.filter((row) => row.readinessStatus === "MISSING_REFERENCE").length;
  const failedPayoutRows = payoutRows.filter((row) => row.status === "FAILED").length;
  const unpaidClaimRows = giftAidRows.filter((row) => ["DRAFT", "SUBMITTED", "ACCEPTED"].includes(row.claimStatus)).length;
  const paidUnallocatedClaimRows = giftAidRows.filter((row) => row.payoutLinkedStatus !== "FULLY_ALLOCATED" && row.claimStatus === "PAID").length;
  const totalUnallocatedGiftAid = giftAidRows.reduce((sum, row) => sum + row.unallocatedPaidGiftAidAmount, 0);
  const staleWarningCount = exceptionRows.filter((item) => {
    const age = Math.floor((Date.now() - new Date(item.relatedDate).getTime()) / 86_400_000);
    return age >= 14 && age < 30;
  }).length;
  const staleCriticalCount = exceptionRows.filter((item) => {
    const age = Math.floor((Date.now() - new Date(item.relatedDate).getTime()) / 86_400_000);
    return age >= 30;
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Reconciliation & finance exceptions</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Operational queue for payout readiness, Gift Aid reconciliation, and donation exceptions with settlement impact.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/api/admin/reports/export?report=payout-reconciliation${exportQuery ? `&${exportQuery}` : ""}`} className="btn-primary" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Export payout recon
          </Link>
          <Link href={`/api/admin/reports/export?report=gift-aid-reconciliation${exportQuery ? `&${exportQuery}` : ""}`} className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Export Gift Aid recon
          </Link>
          <Link href={`/api/admin/reports/export?report=finance-exceptions${exportQuery ? `&${exportQuery}` : ""}`} className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Export exceptions
          </Link>
          <form action={queueAlertAction}>
            <button type="submit" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
              Queue stale alert
            </button>
          </form>
          <form action={runAutomationDryRunAction}>
            <button type="submit" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
              Run auto recon (dry-run)
            </button>
          </form>
          <form action={runAutomationExecuteAction}>
            <button type="submit" className="btn-primary" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
              Run auto recon (execute)
            </button>
          </form>
          <Link href="/admin/reports" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Back to reports
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.85rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.92)", color: "#355247" }}>
          {notice}
        </div>
      ) : null}

      <form className="grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-6">
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
        <select name="exceptionType" defaultValue={exceptionType} className="input">
          <option value="">All exception types</option>
          <option value="CAPTURED_UNBATCHED">CAPTURED_UNBATCHED</option>
          <option value="PAYOUT_CONTRACT_BLOCKED">PAYOUT_CONTRACT_BLOCKED</option>
          <option value="PAYOUT_BATCH_FAILED">PAYOUT_BATCH_FAILED</option>
          <option value="PAYOUT_BATCH_MISSING_REFERENCE">PAYOUT_BATCH_MISSING_REFERENCE</option>
          <option value="GIFT_AID_EXPECTED_UNCLAIMED">GIFT_AID_EXPECTED_UNCLAIMED</option>
          <option value="GIFT_AID_CLAIM_UNPAID">GIFT_AID_CLAIM_UNPAID</option>
          <option value="GIFT_AID_PAID_UNALLOCATED">GIFT_AID_PAID_UNALLOCATED</option>
          <option value="REFUND_OR_DISPUTE_PAYOUT_IMPACT">REFUND_OR_DISPUTE_PAYOUT_IMPACT</option>
        </select>
        <select name="exceptionStatus" defaultValue={exceptionStatus} className="input">
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="WARNING">WARNING</option>
        </select>
        <input type="date" name="start" defaultValue={start} className="input" />
        <input type="date" name="end" defaultValue={end} className="input" />
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
            Apply
          </button>
          <Link href="/admin/reconciliation" className="btn-outline" style={{ padding: "0.7rem 1.1rem", fontSize: "0.85rem" }}>
            Reset
          </Link>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Exception rows" value={String(exceptionRows.length)} sub="current queue size" />
        <StatCard label="Blocked payouts" value={String(blockedPayoutRows)} sub="contract policy blocks" />
        <StatCard label="Missing payout refs" value={String(missingPayoutRefs)} sub="paid batches without refs" />
        <StatCard label="Failed payouts" value={String(failedPayoutRows)} sub="batch status failed" />
        <StatCard label="Unpaid claims" value={String(unpaidClaimRows)} sub="draft/submitted/accepted" />
        <StatCard label="Unallocated Gift Aid" value={fmt(totalUnallocatedGiftAid)} sub={`${paidUnallocatedClaimRows} paid claim(s) not fully allocated`} />
        <StatCard label="Stale exceptions (14d+)" value={String(staleWarningCount + staleCriticalCount)} sub={`${staleCriticalCount} are older than 30 days`} />
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Finance exception queue</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Date", "Age", "Type", "Status", "Charity", "Entity", "Summary", "Action", "Open"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exceptionRows.map((item, index) => (
              <tr key={`${item.exceptionType}-${item.relatedEntityId}-${index}`} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{new Date(item.relatedDate).toLocaleDateString("en-GB")}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {Math.max(0, Math.floor((Date.now() - new Date(item.relatedDate).getTime()) / 86_400_000))}d
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.exceptionType}</td>
                <td style={{ padding: "0.9rem 1rem" }}>{statusPill(item.exceptionStatus)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{item.charityName}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.relatedEntityType}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.summary}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{item.actionHint}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <Link href={buildEntityLink(item.relatedEntityType, item.relatedEntityId)} className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {exceptionRows.length === 0 ? (
              <tr>
                  <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  Exception queue is clear for the current filter scope.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Payout readiness</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#F6F1E8" }}>
                {["Batch", "Charity", "Status", "Readiness", "Net", "Contract", "References", "Block reason"].map((heading) => (
                  <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payoutRows.slice(0, 20).map((row, index) => (
                <tr key={row.payoutBatchId} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{row.payoutBatchId}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{row.charityName}</td>
                  <td style={{ padding: "0.9rem 1rem" }}>{statusPill(row.status)}</td>
                  <td style={{ padding: "0.9rem 1rem" }}>{statusPill(row.readinessStatus)}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(row.netPayoutAmount)}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{row.contractReference || "—"}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                    {[row.providerReference, row.bankReference].filter(Boolean).join(" · ") || "Missing"}
                  </td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{row.blockedReason || "—"}</td>
                </tr>
              ))}
              {payoutRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                    No payout rows in the current scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Gift Aid reconciliation</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#F6F1E8" }}>
                {["Claim", "Charity", "Status", "Expected", "Submitted", "Paid", "Payout linkage"].map((heading) => (
                  <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {giftAidRows.slice(0, 20).map((row, index) => (
                <tr key={row.claimId} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{row.claimId}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{row.charityName}</td>
                  <td style={{ padding: "0.9rem 1rem" }}>{statusPill(row.claimStatus)}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(row.expectedReclaimAmount)}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(row.submittedAmount)}</td>
                  <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{fmt(row.paidAmount)}</td>
                  <td style={{ padding: "0.9rem 1rem" }}>{statusPill(row.payoutLinkedStatus)}</td>
                </tr>
              ))}
              {giftAidRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                    No Gift Aid claim rows in the current scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Recent export history</h2>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Lightweight audit trail of CSV generations across finance/reporting exports.
          </p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Time", "Report", "Status", "Rows", "Charity scope", "Requested by", "Artifact", "Error"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportLogs.map((log, index) => (
              <tr key={log.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {new Date(log.createdAt).toLocaleString("en-GB")}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{log.reportType}</td>
                <td style={{ padding: "0.9rem 1rem" }}>{statusPill(log.status)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{log.rowCount ?? "—"}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {log.charity?.name ?? log.requestedCharityId ?? "Cross-charity scope"}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {log.exportedBy.name ?? log.exportedBy.email ?? "Unknown user"}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {log.artifact ? (
                    <Link href={`/api/admin/reports/export/history/${log.id}`} className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                      Download
                    </Link>
                  ) : "—"}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{log.errorMessage ?? "—"}</td>
              </tr>
            ))}
            {exportLogs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No export history rows in this scope yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Automation runs</h2>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Dry-run by default. Execution requires `FINANCE_AUTOMATION_EXECUTE=1`.
          </p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Started", "Type", "Status", "Summary", "Requested by"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {automationRuns.map((run, index) => (
              <tr key={run.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{new Date(run.startedAt).toLocaleString("en-GB")}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>{run.runType}</td>
                <td style={{ padding: "0.9rem 1rem" }}>{statusPill(run.status)}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{run.summary}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {run.requestedBy?.name ?? run.requestedBy?.email ?? "System"}
                </td>
              </tr>
            ))}
            {automationRuns.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No automation runs recorded yet.
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
