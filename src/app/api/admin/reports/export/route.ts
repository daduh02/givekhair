import { stringify } from "csv-stringify/sync";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDonationsReportRows,
  getGiftAidClaimsReportRows,
  getOfflineDonationsReportRows,
  getPayoutsReportRows,
  resolveAdminReportScope,
} from "@/server/lib/reports";
import type { ReportsRole } from "@/server/lib/reports";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const charityId = url.searchParams.get("charityId");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const scope = await resolveAdminReportScope({
    userId,
    role: role as ReportsRole,
    charityId,
  });

  if (scope.scopedCharityIds.length === 0) {
    return forbidden();
  }

  const filters = { charityId, start, end };

  // One route serves multiple CSVs so the reports page can stay lightweight
  // while export logic remains centralized and access-controlled.
  if (report === "donations") {
    const rows = await getDonationsReportRows({ scopedCharityIds: scope.scopedCharityIds, filters });
    const csv = stringify(
      rows.map((row) => ({
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
        currency: row.currency,
      })),
      { header: true }
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="donations-report.csv"',
      },
    });
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

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="offline-donations-report.csv"',
      },
    });
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

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="payouts-report.csv"',
      },
    });
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

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gift-aid-report.csv"',
      },
    });
  }

  return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
}
