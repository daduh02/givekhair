import { stringify } from "csv-stringify/sync";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimitResponse } from "@/server/lib/rate-limit";
import {
  getDonationsReportRows,
  getGeneralLedgerReportRows,
  getGiftAidClaimsReportRows,
  getOfflineDonationsReportRows,
  getPayoutsReportRows,
  resolveAdminReportScope,
} from "@/server/lib/reports";
import {
  getFinanceExceptionRows,
  getGiftAidReconciliationRows,
  getPayoutReconciliationRows,
} from "@/server/lib/reconciliation";
import type { ReportsRole } from "@/server/lib/reports";
import type { ReportExportType } from "@prisma/client";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function reportTypeFromQuery(value: string): ReportExportType | null {
  const map: Record<string, ReportExportType> = {
    donations: "DONATIONS",
    offline: "OFFLINE",
    payouts: "PAYOUTS",
    "gift-aid": "GIFT_AID",
    gl: "GL",
    "payout-reconciliation": "PAYOUT_RECONCILIATION",
    "gift-aid-reconciliation": "GIFT_AID_RECONCILIATION",
    "finance-exceptions": "FINANCE_EXCEPTIONS",
  };

  return map[value] ?? null;
}

async function writeExportAudit(input: {
  reportType: ReportExportType;
  status: "SUCCEEDED" | "FAILED";
  exportedById: string;
  scopedCharityIds: string[];
  requestedCharityId?: string | null;
  filters: Record<string, string | null>;
  rowCount?: number;
  errorMessage?: string;
  fileName?: string;
  csvContent?: string;
}) {
  const effectiveCharityId = input.scopedCharityIds.length === 1 ? input.scopedCharityIds[0] : null;
  const byteSize = input.csvContent ? Buffer.byteLength(input.csvContent, "utf8") : null;
  const checksumSha256 = input.csvContent
    ? createHash("sha256").update(input.csvContent, "utf8").digest("hex")
    : null;

  try {
    await db.reportExportLog.create({
      data: {
        reportType: input.reportType,
        status: input.status,
        exportedById: input.exportedById,
        charityId: effectiveCharityId,
        requestedCharityId: input.requestedCharityId ?? null,
        filtersJson: input.filters,
        fileName: input.fileName ?? null,
        contentType: input.csvContent ? "text/csv; charset=utf-8" : undefined,
        checksumSha256,
        byteSize,
        rowCount: input.rowCount,
        errorMessage: input.errorMessage,
        artifact: input.csvContent
          ? {
              create: {
                // TODO: CSV export artifacts can include donor PII. Encrypt at
                // rest or enforce stricter retention before relying on this in
                // production environments with real donor data.
                content: input.csvContent,
              },
            }
          : undefined,
      },
    });
  } catch {
    // Export delivery should not fail if audit writes are unavailable.
  }
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Generated-At": new Date().toISOString(),
    },
  });
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || !userId || !role || !["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role)) {
    return forbidden();
  }

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "donations";
  const reportType = reportTypeFromQuery(report);
  const charityId = url.searchParams.get("charityId");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const exceptionType = url.searchParams.get("exceptionType");
  const exceptionStatus = url.searchParams.get("exceptionStatus");
  const scope = await resolveAdminReportScope({
    userId,
    role: role as ReportsRole,
    charityId,
  });

  if (scope.scopedCharityIds.length === 0) {
    return forbidden();
  }

  const filters = {
    charityId,
    start,
    end,
    exceptionType,
    exceptionStatus,
  };

  if (!reportType) {
    return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  }

  const exportRateLimit = await enforceRateLimitResponse(
    {
      namespace: "reports:export",
      key: `${userId}:${reportType}`,
      limit: 10,
      windowSec: 10 * 60,
    },
    "Too many requests. Please try again later.",
  );

  if (exportRateLimit) {
    return exportRateLimit;
  }

  try {
    if (report === "donations") {
      const rows = await getDonationsReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => {
          const succeededRefunds = row.refunds.filter((refund) => refund.status === "SUCCEEDED");
          const refundedAmount = succeededRefunds.reduce(
            (sum, refund) => sum + parseFloat(refund.amount.toString()),
            0,
          );
          const latestRefund = [...row.refunds].sort((a, b) => {
            const aTs = (a.processedAt ?? row.createdAt).getTime();
            const bTs = (b.processedAt ?? row.createdAt).getTime();
            return bTs - aTs;
          })[0];
          const latestDispute = [...row.disputes].sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())[0];

          return {
            created_at: row.createdAt.toISOString(),
            charity: row.page.appeal.charity.name,
            appeal: row.page.appeal.title,
            page: row.page.title,
            short_name: row.page.shortName,
            donor_name: row.donorName ?? "",
            donor_email: row.donorEmail ?? "",
            donation_amount: row.donationAmount?.toString() ?? row.amount.toString(),
            donor_support_amount: row.donorSupportAmount?.toString() ?? "0.00",
            gross_checkout_total: row.grossCheckoutTotal?.toString() ?? row.amount.toString(),
            fee_charged_to_charity: row.feeChargedToCharity?.toString() ?? "0.00",
            charity_net_amount: row.charityNetAmount?.toString() ?? row.amount.toString(),
            charging_mode: row.resolvedChargingMode ?? "",
            gift_aid_declared: row.giftAidDeclaration ? "yes" : "no",
            gift_aid_expected_amount: row.giftAidExpectedAmount?.toString() ?? "0.00",
            gift_aid_received_amount: row.giftAidReceivedAmount?.toString() ?? "0.00",
            status: row.status,
            refunded_amount: refundedAmount.toFixed(2),
            refund_count: row.refunds.length,
            latest_refund_status: latestRefund?.status ?? "",
            latest_refund_processed_at: latestRefund?.processedAt?.toISOString() ?? "",
            dispute_count: row.disputes.length,
            latest_dispute_status: latestDispute?.status ?? "",
            latest_dispute_amount: latestDispute?.amount.toString() ?? "",
            latest_dispute_outcome: latestDispute?.outcome ?? "",
            payout_batch_count: row.payoutItems.length,
            currency: row.currency,
          };
        }),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "donations-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "donations-report.csv");
    }

    if (report === "offline") {
      const rows = await getOfflineDonationsReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          received_date: row.receivedDate.toISOString(),
          charity: row.page?.appeal.charity.name ?? "",
          appeal: row.page?.appeal.title ?? "",
          page: row.page?.title ?? "",
          short_name: row.page?.shortName ?? "",
          donor_name: row.donorName ?? "",
          amount: row.amount.toString(),
          currency: row.currency,
          status: row.status,
          gift_aid_declared: row.giftAidDeclaration ? "yes" : "no",
          upload_batch: row.batch?.fileName ?? "",
          notes: row.notes ?? "",
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "offline-donations-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "offline-donations-report.csv");
    }

    if (report === "payouts") {
      const rows = await getPayoutsReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          created_at: row.createdAt.toISOString(),
          charity: row.charity.name,
          currency: row.currency,
          gross_amount: row.grossAmount.toString(),
          fees_amount: row.feesAmount.toString(),
          net_amount: row.netAmount.toString(),
          item_count: row.items.length,
          status: row.status,
          bank_account: row.bankAccount.accountName,
          bank_reference: row.bankRef ?? "",
          provider_reference: row.providerRef ?? "",
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "payouts-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "payouts-report.csv");
    }

    if (report === "gift-aid") {
      const rows = await getGiftAidClaimsReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          period_start: row.periodStart.toISOString(),
          period_end: row.periodEnd.toISOString(),
          charity: row.charity.name,
          status: row.status,
          total_donations: row.totalDonations.toString(),
          reclaim_amount: row.reclaimAmount.toString(),
          item_count: row.items.length,
          submitted_at: row.submittedAt?.toISOString() ?? "",
          paid_at: row.paidAt?.toISOString() ?? "",
          hmrc_reference: row.hmrcRef ?? "",
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "gift-aid-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "gift-aid-report.csv");
    }

    if (report === "gl") {
      const rows = await getGeneralLedgerReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csvRows = rows.flatMap((entry) =>
        entry.lines.map((line) => ({
          entry_id: entry.id,
          entry_ts: entry.createdAt.toISOString(),
          correlation_id: entry.correlationId,
          charity:
            entry.donation?.page.appeal.charity.name ??
            entry.payoutBatch?.charity.name ??
            entry.dispute?.donation.page.appeal.charity.name ??
            "",
          account_code: line.accountCode,
          debit_minor: Math.round(parseFloat(line.debit.toString()) * 100),
          credit_minor: Math.round(parseFloat(line.credit.toString()) * 100),
          currency: line.currency,
          fx_rate: line.fxRate.toString(),
          ref_type: entry.donationId ? "Donation" : entry.payoutBatchId ? "PayoutBatch" : entry.refundId ? "Refund" : entry.disputeId ? "Dispute" : "JournalEntry",
          ref_id: entry.donationId ?? entry.payoutBatchId ?? entry.refundId ?? entry.disputeId ?? entry.id,
          description: line.description ?? entry.description,
        }))
      );
      const csv = stringify(csvRows, { header: true });

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: csvRows.length,
        fileName: "general-ledger-export.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "general-ledger-export.csv");
    }

    if (report === "payout-reconciliation") {
      const rows = await getPayoutReconciliationRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          payout_batch_id: row.payoutBatchId,
          charity: row.charityName,
          status: row.status,
          scheduled_for: row.scheduledFor.toISOString(),
          processed_at: row.processedAt?.toISOString() ?? "",
          created_at: row.createdAt.toISOString(),
          donation_count: row.donationCount,
          donation_gross_total: row.donationGrossTotal.toFixed(2),
          charity_fee_total: row.charityFeeTotal.toFixed(2),
          donor_support_total_excluded_from_payout: row.donorSupportExcludedTotal.toFixed(2),
          gift_aid_allocation_total: row.giftAidAllocationTotal.toFixed(2),
          net_payout_amount: row.netPayoutAmount.toFixed(2),
          readiness_status: row.readinessStatus,
          blocked_reason: row.blockedReason,
          contract_reference: row.contractReference,
          bank_reference: row.bankReference,
          provider_reference: row.providerReference,
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "payout-reconciliation-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "payout-reconciliation-report.csv");
    }

    if (report === "gift-aid-reconciliation") {
      const rows = await getGiftAidReconciliationRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          charity: row.charityName,
          claim_id: row.claimId,
          claim_status: row.claimStatus,
          period_start: row.periodStart.toISOString(),
          period_end: row.periodEnd.toISOString(),
          declaration_count: row.declarationCount,
          linked_donation_count: row.linkedDonationCount,
          expected_reclaim_amount: row.expectedReclaimAmount.toFixed(2),
          submitted_amount: row.submittedAmount.toFixed(2),
          paid_amount: row.paidAmount.toFixed(2),
          paid_at: row.paidAt?.toISOString() ?? "",
          payout_linked_status: row.payoutLinkedStatus,
          payout_allocated_gift_aid_amount: row.payoutAllocatedGiftAidAmount.toFixed(2),
          unallocated_paid_gift_aid_amount: row.unallocatedPaidGiftAidAmount.toFixed(2),
          hmrc_reference: row.hmrcReference,
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "gift-aid-reconciliation-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "gift-aid-reconciliation-report.csv");
    }

    if (report === "finance-exceptions") {
      const rows = await getFinanceExceptionRows({ scopedCharityIds: scope.scopedCharityIds, filters });
      const csv = stringify(
        rows.map((row) => ({
          exception_type: row.exceptionType,
          exception_status: row.exceptionStatus,
          age_days: Math.max(0, Math.floor((Date.now() - row.relatedDate.getTime()) / 86_400_000)),
          charity: row.charityName,
          related_entity_type: row.relatedEntityType,
          related_entity_id: row.relatedEntityId,
          related_date: row.relatedDate.toISOString(),
          summary: row.summary,
          action_hint: row.actionHint,
          donation_ref: row.donationRef,
          payout_batch_ref: row.payoutBatchRef,
          gift_aid_claim_ref: row.giftAidClaimRef,
        })),
        { header: true }
      );

      await writeExportAudit({
        reportType,
        status: "SUCCEEDED",
        exportedById: userId,
        scopedCharityIds: scope.scopedCharityIds,
        requestedCharityId: charityId,
        filters,
        rowCount: rows.length,
        fileName: "finance-exceptions-report.csv",
        csvContent: csv,
      });
      return csvResponse(csv, "finance-exceptions-report.csv");
    }
  } catch (error) {
    await writeExportAudit({
      reportType,
      status: "FAILED",
      exportedById: userId,
      scopedCharityIds: scope.scopedCharityIds,
      requestedCharityId: charityId,
      filters,
      errorMessage: error instanceof Error ? error.message : "Unknown export error",
    });

    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
}
