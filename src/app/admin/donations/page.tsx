import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { parseOptionalString, revalidateAdminSurfaces } from "@/lib/admin-management";
import {
  createDisputeRecord,
  createRefundRecord,
  getRefundedAmount,
  updateRefundRecord,
} from "@/server/lib/donation-exceptions";

export const metadata: Metadata = { title: "Admin - Donations" };

function fmt(value: string | number | Decimal | { toString(): string } | null | undefined, currency = "GBP") {
  const amount =
    value instanceof Decimal
      ? value.toNumber()
      : typeof value === "number"
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

function toDecimal(value: { toString(): string } | null | undefined) {
  return new Decimal(value?.toString() ?? "0");
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
    REQUESTED: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    PROCESSING: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    SUCCEEDED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    OPEN: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
    UNDER_REVIEW: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    WON: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    LOST: { bg: "rgba(58,74,66,0.14)", color: "#233029" },
    CLOSED: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    WRITTEN_OFF: { bg: "rgba(58,74,66,0.14)", color: "#233029" },
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
      {status.replaceAll("_", " ")}
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

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    charityId?: string;
    giftAid?: string;
    source?: string;
    error?: string;
  };
}) {
  const { role, managedCharity, userId } = await getAdminContext();
  const query = (searchParams.q ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const charityIdFilter = (searchParams.charityId ?? "").trim();
  const giftAidFilter = (searchParams.giftAid ?? "").trim();
  const sourceFilter = (searchParams.source ?? "").trim();
  const errorCode = (searchParams.error ?? "").trim();

  const charities = await db.charity.findMany({
    where: role === "PLATFORM_ADMIN" || role === "FINANCE" ? {} : { id: managedCharity?.id ?? "" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedCharityIds =
    role === "PLATFORM_ADMIN" || role === "FINANCE"
      ? charityIdFilter
        ? [charityIdFilter]
        : charities.map((charity) => charity.id)
      : managedCharity?.id
        ? [managedCharity.id]
        : [];

  async function resolveScopedDonation(donationId: string) {
    const donation = await db.donation.findUnique({
      where: { id: donationId },
      include: {
        page: {
          include: {
            appeal: true,
          },
        },
      },
    });

    if (!donation) {
      throw new Error("Donation not found.");
    }

    const donationCharityId = donation.page.appeal.charityId;
    if (role !== "PLATFORM_ADMIN" && role !== "FINANCE" && donationCharityId !== managedCharity?.id) {
      redirect("/403");
    }

    return donation;
  }

  async function createRefundAction(formData: FormData) {
    "use server";

    const donationId = String(formData.get("donationId") ?? "").trim();
    const amountRaw = String(formData.get("amount") ?? "").trim();
    const reason = parseOptionalString(formData.get("reason"));
    const providerRef = parseOptionalString(formData.get("providerRef"));
    const status = String(formData.get("refundStatus") ?? "REQUESTED").trim() as "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

    if (!donationId || !amountRaw) {
      redirect("/admin/donations");
    }

    const donation = await resolveScopedDonation(donationId);
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      redirect("/admin/donations");
    }

    try {
      await createRefundRecord({
        donationId: donation.id,
        amount,
        reason,
        initiatedBy: userId,
        providerRef,
        status,
      });
    } catch {
      redirect("/admin/donations?error=refund");
    }

    revalidateAdminSurfaces(["/admin/donations", "/admin/disputes", "/admin/reports", "/admin/payouts"]);
    redirect("/admin/donations");
  }

  async function updateRefundAction(formData: FormData) {
    "use server";

    const refundId = String(formData.get("refundId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim() as "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    const providerRef = parseOptionalString(formData.get("providerRef"));

    if (!refundId) {
      redirect("/admin/donations");
    }

    const refund = await db.refund.findUnique({
      where: { id: refundId },
      include: {
        donation: {
          include: {
            page: {
              include: { appeal: true },
            },
          },
        },
      },
    });

    if (!refund) {
      redirect("/admin/donations");
    }

    if (role !== "PLATFORM_ADMIN" && role !== "FINANCE" && refund.donation.page.appeal.charityId !== managedCharity?.id) {
      redirect("/403");
    }

    try {
      await updateRefundRecord({
        refundId,
        status,
        providerRef,
      });
    } catch {
      redirect("/admin/donations?error=refund-update");
    }

    revalidateAdminSurfaces(["/admin/donations", "/admin/disputes", "/admin/reports", "/admin/payouts"]);
    redirect("/admin/donations");
  }

  async function createDisputeAction(formData: FormData) {
    "use server";

    const donationId = String(formData.get("donationId") ?? "").trim();
    const amountRaw = String(formData.get("amount") ?? "").trim();
    const reason = parseOptionalString(formData.get("reason"));
    const providerRef = parseOptionalString(formData.get("providerRef"));
    const evidenceDueAtRaw = parseOptionalString(formData.get("evidenceDueAt"));
    const notes = parseOptionalString(formData.get("notes"));

    if (!donationId || !amountRaw) {
      redirect("/admin/donations");
    }

    const donation = await resolveScopedDonation(donationId);
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      redirect("/admin/donations");
    }

    try {
      await createDisputeRecord({
        donationId: donation.id,
        amount,
        currency: donation.currency,
        reason,
        providerRef,
        evidenceDueAt: evidenceDueAtRaw ? new Date(evidenceDueAtRaw) : null,
        notes,
        recordedById: userId,
      });
    } catch {
      redirect("/admin/donations?error=dispute");
    }

    revalidateAdminSurfaces(["/admin/donations", "/admin/disputes", "/admin/reports", "/admin/payouts"]);
    redirect("/admin/donations");
  }

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
            { payment: { providerRef: { contains: query, mode: "insensitive" as const } } },
            { externalRef: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const offlineWhere = {
    page: {
      appeal: {
        charityId: {
          in: scopedCharityIds.length > 0 ? scopedCharityIds : ["__none__"],
        },
      },
    },
    ...(status
      ? { status: status as "PENDING_APPROVAL" | "APPROVED" | "REJECTED" }
      : {}),
    ...(giftAidFilter === "yes"
      ? { giftAidDeclaration: { isNot: null } }
      : giftAidFilter === "no"
        ? { giftAidDeclaration: { is: null } }
        : {}),
    ...(query
      ? {
          OR: [
            { donorName: { contains: query, mode: "insensitive" as const } },
            { page: { title: { contains: query, mode: "insensitive" as const } } },
            { page: { appeal: { title: { contains: query, mode: "insensitive" as const } } } },
            { batch: { fileName: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [donations, offlineDonations, capturedAgg, approvedOfflineAgg, pendingCount, recurringCount, disputeCount] = await Promise.all([
    sourceFilter === "offline"
      ? Promise.resolve([])
      : db.donation.findMany({
          where,
          include: {
            feeSet: true,
            payment: true,
            giftAidDeclaration: { select: { id: true } },
            refunds: { orderBy: [{ createdAt: "desc" }] },
            disputes: { orderBy: [{ openedAt: "desc" }] },
            payoutItems: {
              select: {
                payoutBatchId: true,
                itemType: true,
                payoutBatch: { select: { status: true, processedAt: true } },
              },
            },
            journalEntries: {
              select: {
                id: true,
                refundId: true,
                disputeId: true,
              },
            },
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
    sourceFilter === "online"
      ? Promise.resolve([])
      : db.offlineDonation.findMany({
          where: offlineWhere,
          include: {
            batch: { select: { id: true, fileName: true, status: true } },
            giftAidDeclaration: { select: { id: true } },
            page: {
              select: {
                id: true,
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
          orderBy: [{ createdAt: "desc" }],
          take: 100,
        }),
    db.donation.aggregate({
      where: { ...where, status: "CAPTURED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.offlineDonation.aggregate({
      where: { ...offlineWhere, status: "APPROVED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.donation.count({
      where: { ...where, status: "PENDING" },
    }),
    db.donation.count({
      where: { ...where, isRecurring: true },
    }),
    db.dispute.count({
      where: {
        donation: {
          page: {
            appeal: {
              charityId: {
                in: scopedCharityIds.length > 0 ? scopedCharityIds : ["__none__"],
              },
            },
          },
        },
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
    }),
  ]);

  const totalRefundedAmount = donations.reduce((sum, donation) => sum.plus(getRefundedAmount(donation.refunds)), new Decimal(0));
  const onlineCapturedValue = toDecimal(capturedAgg._sum.amount);
  const offlineApprovedValue = toDecimal(approvedOfflineAgg._sum.amount);
  const combinedVisibleValue = onlineCapturedValue.plus(offlineApprovedValue);
  const combinedRecords = [
    ...donations.map((donation) => ({
      id: donation.id,
      createdAt: donation.createdAt,
      source: "ONLINE" as const,
      donation,
    })),
    ...offlineDonations.map((offlineDonation) => ({
      id: offlineDonation.id,
      createdAt: offlineDonation.createdAt,
      source: "OFFLINE" as const,
      offlineDonation,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const errorMessage =
    errorCode === "refund"
      ? "We couldn't record that refund. Check that the donation is refundable and that the amount does not exceed the remaining refundable amount."
      : errorCode === "refund-update"
        ? "We couldn't update that refund record. Refunds with recorded ledger impact must stay succeeded."
        : errorCode === "dispute"
          ? "We couldn't record that dispute. Check the amount and donation scope, then try again."
          : "";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Donations</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Monitor online and offline donation records, record refunds, track disputes, and see whether payouts or ledger reversals are affected.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/disputes" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.8rem" }}>
            Open disputes
          </Link>
          <Link href="/admin" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.8rem" }}>
            Back to overview
          </Link>
        </div>
      </div>

      <form className="grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-5">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search donor, appeal, page, upload, or provider ref"
          className="input"
        />
        <select name="status" defaultValue={status} className="input">
          <option value="">All statuses</option>
          <option value="APPROVED">Approved offline</option>
          <option value="PENDING_APPROVAL">Pending approval offline</option>
          <option value="REJECTED">Rejected offline</option>
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
        <select name="source" defaultValue={sourceFilter} className="input">
          <option value="">All sources</option>
          <option value="online">Online only</option>
          <option value="offline">Offline only</option>
        </select>
        <div className="flex gap-3">
          {role === "PLATFORM_ADMIN" || role === "FINANCE" ? (
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

      {errorMessage ? (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "#FEE2E2", color: "#991B1B" }}>
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Visible records" value={String(combinedRecords.length)} sub={`${donations.length} online · ${offlineDonations.length} offline`} />
        <StatCard label="Combined value" value={fmt(combinedVisibleValue)} sub={`${capturedAgg._count + approvedOfflineAgg._count} captured or approved records`} />
        <StatCard label="Online value" value={fmt(onlineCapturedValue)} sub={`${capturedAgg._count} captured online donations`} />
        <StatCard label="Offline value" value={fmt(offlineApprovedValue)} sub={`${approvedOfflineAgg._count} approved offline donations`} />
        <StatCard label="Refunded / open disputes" value={`${fmt(totalRefundedAmount)} / ${disputeCount}`} sub="succeeded refunds and active dispute cases" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatCard label="Pending / recurring" value={`${pendingCount} / ${recurringCount}`} sub="still awaiting payment confirmation and recurring gifts" />
        <StatCard label="Source mix" value={`${donations.length}:${offlineDonations.length}`} sub="online to offline records in current results" />
      </div>

      <div className="space-y-4">
        {combinedRecords.map((record) => {
          if (record.source === "OFFLINE") {
            const donation = record.offlineDonation;
            return (
              <section key={`offline-${donation.id}`} style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
                <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-blue">Offline</span>
                      {pill(donation.status)}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold" style={{ color: "#233029" }}>
                      {donation.donorName ?? "Anonymous / collection"}
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
                      {donation.page?.appeal.charity.name ?? "Unknown charity"} · {donation.page?.appeal.title ?? "Unlinked appeal"} · {donation.page?.shortName ? `/fundraise/${donation.page.shortName}` : "No fundraiser page"}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                      Imported {new Date(donation.createdAt).toLocaleString("en-GB")} · Received {new Date(donation.receivedDate).toLocaleDateString("en-GB")}
                      {donation.batch?.fileName ? ` · Batch: ${donation.batch.fileName}` : " · Manual offline entry"}
                    </p>
                  </div>
                  <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: "#FCFBF7", color: "#3A4A42", minWidth: "16rem" }}>
                    <div className="flex items-center justify-between gap-3">
                      <span>Donation amount</span>
                      <strong>{fmt(donation.amount, donation.currency)}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Source</span>
                      <strong>Offline upload</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Gift Aid</span>
                      <strong>{donation.giftAidDeclaration ? "Declared" : "No"}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Batch status</span>
                      <strong>{donation.batch?.status ?? "Manual"}</strong>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 px-6 pb-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Offline record details</h3>
                    <div className="mt-3 grid gap-2 text-sm" style={{ color: "#3A4A42" }}>
                      <div>Appeal: {donation.page?.appeal.title ?? "Not linked"}</div>
                      <div>Fundraiser page: {donation.page?.title ?? "Not linked"}</div>
                      <div>Gift Aid: {donation.giftAidDeclaration ? "Declaration saved" : "Not declared"}</div>
                      <div>Status: {donation.status.replaceAll("_", " ")}</div>
                      <div>Notes: {donation.notes ?? "No notes recorded"}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7", color: "#3A4A42" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Availability</h3>
                    <ul className="mt-3 space-y-2">
                      <li>Offline records count toward public totals only when status is `APPROVED`.</li>
                      <li>Offline records appear on public appeal and fundraiser totals after import revalidation.</li>
                      <li>Refund and dispute tools apply to online checkout donations only.</li>
                    </ul>
                  </div>
                </div>
              </section>
            );
          }

          const donation = record.donation;
          const grossCheckoutTotal = donation.grossCheckoutTotal
            ? toDecimal(donation.grossCheckoutTotal)
            : donation.feeSet?.donorCoversFees
              ? toDecimal(donation.amount).plus(toDecimal(donation.feeSet.totalFees))
              : toDecimal(donation.amount);
          const donationAmount = toDecimal(donation.donationAmount ?? donation.amount);
          const feeChargedToCharity = toDecimal(donation.feeChargedToCharity ?? donation.feeSet?.totalFees);
          const refundedAmount = getRefundedAmount(donation.refunds);
          const remainingRefundable = Decimal.max(donationAmount.minus(refundedAmount), 0);
          const latestDispute = donation.disputes[0] ?? null;
          const hasPayoutItems = donation.payoutItems.length > 0;
          const ledgerRefundCount = donation.journalEntries.filter((entry) => entry.refundId).length;
          const ledgerDisputeCount = donation.journalEntries.filter((entry) => entry.disputeId).length;

          return (
            <section key={donation.id} style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
              <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-green">Online</span>
                    {pill(donation.status)}
                    {latestDispute ? pill(latestDispute.status) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold" style={{ color: "#233029" }}>
                    {donation.isAnonymous ? "Anonymous donation" : (donation.donorName ?? donation.donorEmail ?? "Unnamed donor")}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
                    {donation.page.appeal.charity.name} · {donation.page.appeal.title} · /fundraise/{donation.page.shortName}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                    Created {new Date(donation.createdAt).toLocaleString("en-GB")}
                    {donation.payment?.providerRef ? ` · ${donation.payment.provider}: ${donation.payment.providerRef}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl px-4 py-4 text-sm" style={{ background: "#FCFBF7", color: "#3A4A42", minWidth: "16rem" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span>Gross checkout</span>
                    <strong>{fmt(grossCheckoutTotal, donation.currency)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Donation amount</span>
                    <strong>{fmt(donationAmount, donation.currency)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Refunded</span>
                    <strong>{fmt(refundedAmount, donation.currency)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Remaining refundable</span>
                    <strong>{fmt(remainingRefundable, donation.currency)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Charity fee</span>
                    <strong>{fmt(feeChargedToCharity, donation.currency)}</strong>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 pb-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Operational state</h3>
                    <div className="mt-3 grid gap-2 text-sm" style={{ color: "#3A4A42" }}>
                      <div>Charging mode: {donation.resolvedChargingMode ?? (donation.feeSet?.donorCoversFees ? "DONOR_SUPPORTED" : "CHARITY_PAID")}</div>
                      <div>Gift Aid: {donation.giftAidDeclaration ? "Declared" : "Not declared"}</div>
                      <div>Receipt: {donation.receiptIssuedAt ? new Date(donation.receiptIssuedAt).toLocaleString("en-GB") : "Pending or no receipt email"}</div>
                      <div>Payout exposure: {hasPayoutItems ? `${donation.payoutItems.length} payout item(s) already created` : "Not yet included in a payout batch"}</div>
                      <div>Ledger reversals: {ledgerRefundCount} refund entry / {ledgerDisputeCount} dispute entry</div>
                    </div>
                    {donation.payment?.failureReason ? (
                      <div className="mt-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(254,226,226,0.72)", color: "#991B1B" }}>
                        {donation.payment.failureReason}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Refund history</h3>
                      {donation.refunds.length > 0 ? (
                        <span className="text-xs" style={{ color: "#8A9E94" }}>
                          {donation.refunds.length} record{donation.refunds.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-3">
                      {donation.refunds.length > 0 ? donation.refunds.map((refund) => (
                        <article key={refund.id} className="rounded-2xl bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                {pill(refund.status)}
                                <span className="text-sm font-semibold" style={{ color: "#233029" }}>
                                  {fmt(refund.amount, donation.currency)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs" style={{ color: "#64748B" }}>
                                Created {new Date(refund.createdAt).toLocaleString("en-GB")}
                                {refund.processedAt ? ` · Processed ${new Date(refund.processedAt).toLocaleString("en-GB")}` : ""}
                              </p>
                              {refund.reason ? (
                                <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                                  {refund.reason}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                                Provider ref: {refund.providerRef ?? "Not recorded"} · Initiated by {refund.initiatedBy ?? "Unknown"}
                              </p>
                            </div>
                          </div>

                          <form action={updateRefundAction} className="mt-4 flex flex-wrap gap-2">
                            <input type="hidden" name="refundId" value={refund.id} />
                            <select name="status" defaultValue={refund.status} className="input" style={{ maxWidth: "14rem" }}>
                              <option value="REQUESTED">Requested</option>
                              <option value="PROCESSING">Processing</option>
                              <option value="SUCCEEDED">Succeeded</option>
                              <option value="FAILED">Failed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                            <input name="providerRef" defaultValue={refund.providerRef ?? ""} className="input" placeholder="Provider refund ref" />
                            <button type="submit" className="btn-outline" style={{ padding: "0.7rem 1rem", fontSize: "0.8rem" }}>
                              Update refund
                            </button>
                          </form>
                        </article>
                      )) : (
                        <p className="text-sm" style={{ color: "#8A9E94" }}>
                          No refund records yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Dispute / chargeback state</h3>
                      <Link href={`/admin/disputes?q=${encodeURIComponent(donation.page.shortName)}`} className="text-xs font-semibold" style={{ color: "#1E8C6E" }}>
                        Open disputes →
                      </Link>
                    </div>
                    <div className="mt-3 space-y-3">
                      {donation.disputes.length > 0 ? donation.disputes.map((dispute) => (
                        <article key={dispute.id} className="rounded-2xl bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {pill(dispute.status)}
                            {dispute.outcome ? pill(dispute.outcome) : null}
                            <span className="text-sm font-semibold" style={{ color: "#233029" }}>
                              {fmt(dispute.amount, dispute.currency)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs" style={{ color: "#64748B" }}>
                            Opened {new Date(dispute.openedAt).toLocaleString("en-GB")}
                            {dispute.closedAt ? ` · Closed ${new Date(dispute.closedAt).toLocaleString("en-GB")}` : ""}
                          </p>
                          <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                            {dispute.reason ?? "No reason recorded"}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "#8A9E94" }}>
                            Provider ref: {dispute.providerRef ?? "Not recorded"} · Evidence due: {dispute.evidenceDueAt ? new Date(dispute.evidenceDueAt).toLocaleDateString("en-GB") : "Not set"} · Ledger impact: {dispute.financialImpactRecordedAt ? "Recorded" : "Pending"}
                          </p>
                        </article>
                      )) : (
                        <p className="text-sm" style={{ color: "#8A9E94" }}>
                          No dispute or chargeback records yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Record refund</h3>
                    <p className="mt-2 text-sm leading-6" style={{ color: "#3A4A42" }}>
                      Use this when support or finance needs to record a refund request or note that a provider refund has completed. This does not call a live provider refund API yet.
                    </p>
                    <form action={createRefundAction} className="mt-4 grid gap-3">
                      <input type="hidden" name="donationId" value={donation.id} />
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max={remainingRefundable.toFixed(2)}
                        step="0.01"
                        className="input"
                        defaultValue={remainingRefundable.toFixed(2)}
                      />
                      <select name="refundStatus" defaultValue="REQUESTED" className="input">
                        <option value="REQUESTED">Requested</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SUCCEEDED">Succeeded</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                      <input name="providerRef" className="input" placeholder="Provider refund reference (optional)" />
                      <textarea name="reason" className="input" rows={3} style={{ resize: "vertical" }} placeholder="Why is this refund being issued?" />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ padding: "0.7rem 1.1rem" }}
                        disabled={remainingRefundable.lte(0)}
                      >
                        Record refund
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Record dispute / chargeback</h3>
                    <p className="mt-2 text-sm leading-6" style={{ color: "#3A4A42" }}>
                      Create an operational dispute record when a provider opens a chargeback or when the finance team needs to track one manually.
                    </p>
                    <form action={createDisputeAction} className="mt-4 grid gap-3">
                      <input type="hidden" name="donationId" value={donation.id} />
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="input"
                        defaultValue={donationAmount.toFixed(2)}
                      />
                      <input name="providerRef" className="input" placeholder="Provider dispute reference" />
                      <input name="evidenceDueAt" type="date" className="input" />
                      <input name="reason" className="input" placeholder="Reason or category" />
                      <textarea name="notes" className="input" rows={3} style={{ resize: "vertical" }} placeholder="Internal notes or provider context" />
                      <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
                        Record dispute
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7", color: "#3A4A42" }}>
                    <h3 className="text-sm font-semibold" style={{ color: "#233029" }}>Finance implications</h3>
                    <ul className="mt-3 space-y-2">
                      <li>Refunds only affect the ledger when the refund record is marked as succeeded.</li>
                      <li>Lost disputes create a dedicated dispute-linked reversal entry so finance can audit the chargeback hit separately from refunds.</li>
                      <li>Payout items are shown above when a donation has already been included in payout operations, but automatic clawback from paid batches is not yet implemented.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {combinedRecords.length === 0 ? (
          <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
            No donation records match the current filters.
          </section>
        ) : null}
      </div>
    </div>
  );
}
