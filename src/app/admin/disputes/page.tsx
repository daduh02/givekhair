import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { parseOptionalString, revalidateAdminSurfaces } from "@/lib/admin-management";
import { updateDisputeRecord } from "@/server/lib/donation-exceptions";

export const metadata: Metadata = { title: "Admin - Disputes" };

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
    OPEN: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
    UNDER_REVIEW: { bg: "rgba(212,160,23,0.15)", color: "#8A5B00" },
    WON: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    LOST: { bg: "rgba(58,74,66,0.14)", color: "#233029" },
    CLOSED: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
  };

  const style = palette[status] ?? palette.CLOSED;
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

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    status?: string;
    charityId?: string;
  };
}) {
  const { role, managedCharity } = await getAdminContext();
  const query = (searchParams.q ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const charityIdFilter = (searchParams.charityId ?? "").trim();

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

  async function updateDisputeAction(formData: FormData) {
    "use server";

    const { role, managedCharity } = await getAdminContext();
    const disputeId = String(formData.get("disputeId") ?? "").trim();
    const nextStatus = String(formData.get("status") ?? "").trim() as "OPEN" | "UNDER_REVIEW" | "WON" | "LOST" | "CLOSED";
    const nextOutcome = parseOptionalString(formData.get("outcome")) as "WON" | "LOST" | "WRITTEN_OFF" | null;
    const notes = parseOptionalString(formData.get("notes"));
    const providerRef = parseOptionalString(formData.get("providerRef"));
    const evidenceDueAtRaw = parseOptionalString(formData.get("evidenceDueAt"));

    if (!disputeId) {
      redirect("/admin/disputes");
    }

    const dispute = await db.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        donation: {
          select: {
            page: {
              select: {
                appeal: {
                  select: { charityId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      redirect("/admin/disputes");
    }

    if (role !== "PLATFORM_ADMIN" && role !== "FINANCE" && dispute.donation.page.appeal.charityId !== managedCharity?.id) {
      redirect("/403");
    }

    await updateDisputeRecord({
      disputeId,
      status: nextStatus,
      outcome: nextOutcome,
      notes,
      providerRef,
      evidenceDueAt: evidenceDueAtRaw ? new Date(evidenceDueAtRaw) : null,
    });

    revalidateAdminSurfaces(["/admin/disputes", "/admin/donations", "/admin/reports", "/admin/payouts"]);
    redirect("/admin/disputes");
  }

  const disputes = await db.dispute.findMany({
    where: {
      donation: {
        page: {
          appeal: {
            charityId: {
              in: scopedCharityIds.length ? scopedCharityIds : ["__none__"],
            },
          },
        },
      },
      ...(status ? { status: status as never } : {}),
      ...(query
        ? {
            OR: [
              { providerRef: { contains: query, mode: "insensitive" as const } },
              { reason: { contains: query, mode: "insensitive" as const } },
              { donation: { donorName: { contains: query, mode: "insensitive" as const } } },
              { donation: { donorEmail: { contains: query, mode: "insensitive" as const } } },
              { donation: { page: { title: { contains: query, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    include: {
      donation: {
        include: {
          payoutItems: { select: { payoutBatchId: true } },
          page: {
            select: {
              title: true,
              shortName: true,
              appeal: {
                select: {
                  title: true,
                  charity: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      journalEntries: { select: { id: true } },
    },
    orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Disputes & chargebacks</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Review chargeback records, update outcomes, and see whether a financial impact has already been recorded in the ledger.
          </p>
        </div>
        <Link href="/admin/donations" className="btn-outline" style={{ padding: "0.6rem 1rem", fontSize: "0.8rem" }}>
          Open donations
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.25rem] bg-white p-4 shadow-[0_2px_12px_rgba(18,78,64,0.07)] md:grid-cols-4">
        <input name="q" defaultValue={query} placeholder="Search dispute, donor, or fundraiser" className="input" />
        <select name="status" defaultValue={status} className="input">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
          <option value="CLOSED">Closed</option>
        </select>
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
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
            Apply
          </button>
          <Link href="/admin/disputes" className="btn-outline" style={{ padding: "0.7rem 1.1rem", fontSize: "0.85rem" }}>
            Reset
          </Link>
        </div>
      </form>

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Dispute records</h2>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Keep the operational story visible: donation link, payout exposure, evidence deadline, and current outcome.
          </p>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {disputes.map((dispute) => (
            <article key={dispute.id} className="rounded-2xl border p-5" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pill(dispute.status)}
                    {dispute.outcome ? pill(dispute.outcome) : null}
                  </div>
                  <h3 className="mt-3 text-base font-semibold" style={{ color: "#233029" }}>
                    {dispute.donation.page.appeal.charity.name} · {dispute.donation.page.title}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
                    /fundraise/{dispute.donation.page.shortName} · {dispute.donation.page.appeal.title}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                    {fmt(dispute.amount, dispute.currency)} · opened {new Date(dispute.openedAt).toLocaleDateString("en-GB")}
                    {dispute.providerRef ? ` · ${dispute.providerRef}` : ""}
                  </p>
                  {dispute.reason ? (
                    <p className="mt-2 text-sm" style={{ color: "#3A4A42" }}>
                      Reason: {dispute.reason}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl px-4 py-3 text-xs" style={{ background: "rgba(255,255,255,0.8)", color: "#64748B" }}>
                  <div>Payout batches: {dispute.donation.payoutItems.length}</div>
                  <div className="mt-1">Ledger impact: {dispute.financialImpactRecordedAt ? "Recorded" : "Not yet recorded"}</div>
                  <div className="mt-1">Evidence due: {dispute.evidenceDueAt ? new Date(dispute.evidenceDueAt).toLocaleDateString("en-GB") : "Not set"}</div>
                </div>
              </div>

              {dispute.notes ? (
                <div className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(255,255,255,0.8)", color: "#3A4A42" }}>
                  {dispute.notes}
                </div>
              ) : null}

              <form action={updateDisputeAction} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="disputeId" value={dispute.id} />
                <select name="status" defaultValue={dispute.status} className="input">
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under review</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <select name="outcome" defaultValue={dispute.outcome ?? ""} className="input">
                  <option value="">No outcome yet</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                  <option value="WRITTEN_OFF">Written off</option>
                </select>
                <input name="providerRef" className="input" defaultValue={dispute.providerRef ?? ""} placeholder="Provider dispute ref" />
                <input name="evidenceDueAt" type="date" className="input" defaultValue={dispute.evidenceDueAt ? dispute.evidenceDueAt.toISOString().slice(0, 10) : ""} />
                <textarea name="notes" className="input md:col-span-2" rows={3} style={{ resize: "vertical" }} defaultValue={dispute.notes ?? ""} placeholder="Add internal notes or outcome context" />
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.1rem" }}>
                    Save dispute
                  </button>
                  <Link href={`/admin/donations?q=${encodeURIComponent(dispute.donation.page.shortName)}`} className="btn-outline" style={{ padding: "0.7rem 1.1rem", fontSize: "0.85rem" }}>
                    Open donation ops
                  </Link>
                </div>
              </form>
            </article>
          ))}

          {disputes.length === 0 ? (
            <div className="rounded-2xl border px-4 py-10 text-center text-sm" style={{ borderColor: "rgba(18,78,64,0.08)", background: "#FCFBF7", color: "#8A9E94" }}>
              No disputes match the current filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
