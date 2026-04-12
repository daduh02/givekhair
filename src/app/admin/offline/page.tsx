import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { revalidateAdminSurfaces } from "@/lib/admin-management";
import {
  createOfflineDonationsFromDryRun,
  dryRunOfflineCsv,
  getAccessibleAppeals,
  type OfflineDryRunResult,
} from "@/lib/offline-donations";

export const metadata: Metadata = { title: "Admin - Offline donations" };

function formatCurrency(value: string | number, currency = "GBP") {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusPill(status: string) {
  const palette: Record<string, { bg: string; color: string }> = {
    APPROVED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    PENDING_APPROVAL: { bg: "rgba(212,162,76,0.12)", color: "#7A5010" },
    REJECTED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
    DRY_RUN: { bg: "rgba(59,130,246,0.12)", color: "#1E3A5F" },
    COMMITTED: { bg: "rgba(30,140,110,0.12)", color: "#124E40" },
    FAILED: { bg: "rgba(239,68,68,0.12)", color: "#7F1D1D" },
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

export default async function OfflinePage({
  searchParams,
}: {
  searchParams: { batchId?: string; error?: string; ok?: string };
}) {
  const { role, userId, managedCharity } = await getAdminContext();
  const accessibleAppeals = await getAccessibleAppeals(role, managedCharity?.id);
  const accessibleAppealIds = accessibleAppeals.map((appeal) => appeal.id);

  const [offlineDonations, uploadBatches, selectedBatch] = await Promise.all([
    db.offlineDonation.findMany({
      where: {
        page: role === "PLATFORM_ADMIN" ? undefined : { appeal: { charityId: managedCharity?.id } },
      },
      include: {
        batch: { select: { id: true, fileName: true, status: true } },
        page: {
          select: {
            id: true,
            title: true,
            shortName: true,
            appeal: { select: { id: true, title: true, charity: { select: { name: true } } } },
            team: { select: { name: true } },
          },
        },
        giftAidDeclaration: { select: { id: true } },
      },
      orderBy: { receivedDate: "desc" },
      take: 50,
    }),
    db.offlineUploadBatch.findMany({
      where: {
        appealId: { in: accessibleAppealIds.length > 0 ? accessibleAppealIds : ["__none__"] },
      },
      include: {
        appeal: { select: { title: true, charity: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    searchParams.batchId
      ? db.offlineUploadBatch.findFirst({
          where: {
            id: searchParams.batchId,
            appealId: { in: accessibleAppealIds.length > 0 ? accessibleAppealIds : ["__none__"] },
          },
        })
      : Promise.resolve(null),
  ]);

  async function createOfflineDonation(formData: FormData) {
    "use server";

    const { role: currentRole, userId: currentUserId, managedCharity: currentManagedCharity } = await getAdminContext();
    const accessible = await getAccessibleAppeals(currentRole, currentManagedCharity?.id);

    const pageId = String(formData.get("pageId") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);
    const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
    const receivedDateRaw = String(formData.get("receivedDate") ?? "").trim();
    const donorName = String(formData.get("donorName") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const status = String(formData.get("status") ?? "APPROVED").trim() as "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    const giftAid = String(formData.get("giftAid") ?? "") === "on";
    const donorAddressLine1 = String(formData.get("donorAddressLine1") ?? "").trim();
    const donorAddressLine2 = String(formData.get("donorAddressLine2") ?? "").trim();
    const donorCity = String(formData.get("donorCity") ?? "").trim();
    const donorPostcode = String(formData.get("donorPostcode") ?? "").trim();
    const donorCountry = String(formData.get("donorCountry") ?? "GB").trim().toUpperCase() || "GB";

    const page = accessible
      .flatMap((appeal) => appeal.fundraisingPages.map((item) => ({ ...item, appeal })))
      .find((item) => item.id === pageId);

    if (!page || !Number.isFinite(amount) || amount <= 0 || !receivedDateRaw) {
      redirect("/admin/offline?error=manual");
    }

    const receivedDate = new Date(receivedDateRaw);
    if (Number.isNaN(receivedDate.getTime())) {
      redirect("/admin/offline?error=manual");
    }

    const created = await db.offlineDonation.create({
      data: {
        pageId: page.id,
        amount,
        currency,
        receivedDate,
        donorName: donorName ?? undefined,
        notes: notes ?? undefined,
        status,
        createdById: currentUserId,
      },
    });

    if (giftAid) {
      if (!donorName || !donorAddressLine1 || !donorCity || !donorPostcode) {
        await db.offlineDonation.delete({ where: { id: created.id } });
        redirect("/admin/offline?error=giftaid");
      }

      await db.giftAidDeclaration.create({
        data: {
          offlineDonationId: created.id,
          donorFullName: donorName,
          donorAddressLine1,
          donorAddressLine2: donorAddressLine2 || undefined,
          donorCity,
          donorPostcode,
          donorCountry,
          type: "SINGLE",
          statementVersion: "v1",
          statementText:
            "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
          createdById: currentUserId,
        },
      });
    }

    revalidateAdminSurfaces(["/admin/offline", `/admin/appeals/${page.appeal.id}`]);
    redirect("/admin/offline?ok=created");
  }

  async function dryRunUpload(formData: FormData) {
    "use server";

    const { role: currentRole, userId: currentUserId, managedCharity: currentManagedCharity } = await getAdminContext();
    const appealId = String(formData.get("appealId") ?? "").trim();
    const file = formData.get("file");

    if (!(file instanceof File) || !appealId) {
      redirect("/admin/offline?error=upload");
    }

    const csvText = await file.text();
    const dryRun = await dryRunOfflineCsv({
      csvText,
      fileName: file.name || "offline-upload.csv",
      batchAppealId: appealId,
      role: currentRole,
      managedCharityId: currentManagedCharity?.id,
    });

    const batch = await db.offlineUploadBatch.create({
      data: {
        appealId,
        uploadedById: currentUserId,
        fileName: dryRun.fileName,
        rowCount: dryRun.rowCount,
        errorCount: dryRun.errorCount,
        status: "DRY_RUN",
        resultJson: dryRun,
      },
    });

    revalidateAdminSurfaces(["/admin/offline"]);
    redirect(`/admin/offline?batchId=${batch.id}`);
  }

  async function commitBatch(formData: FormData) {
    "use server";

    const { userId: currentUserId } = await getAdminContext();
    const batchId = String(formData.get("batchId") ?? "").trim();
    if (!batchId) {
      redirect("/admin/offline");
    }

    await createOfflineDonationsFromDryRun({
      batchId,
      createdById: currentUserId,
    });

    revalidateAdminSurfaces(["/admin/offline"]);
    redirect("/admin/offline?ok=committed");
  }

  async function updateOfflineStatus(formData: FormData) {
    "use server";

    await getAdminContext();
    const id = String(formData.get("id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim() as "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

    if (!id || !status) {
      redirect("/admin/offline");
    }

    await db.offlineDonation.update({
      where: { id },
      data: { status },
    });

    revalidateAdminSurfaces(["/admin/offline"]);
    redirect("/admin/offline?ok=status");
  }

  const selectedDryRun = selectedBatch?.resultJson
    ? (selectedBatch.resultJson as unknown as OfflineDryRunResult)
    : null;

  const totalApproved = offlineDonations
    .filter((donation) => donation.status === "APPROVED")
    .reduce((sum, donation) => sum + parseFloat(donation.amount.toString()), 0);

  const errorMessage =
    searchParams.error === "manual"
      ? "Please select a fundraiser page, a valid amount, and a valid received date."
      : searchParams.error === "giftaid"
        ? "Gift Aid rows need donor name and a full UK address."
        : searchParams.error === "upload"
          ? "Please choose an appeal and a CSV file."
          : "";

  const successMessage =
    searchParams.ok === "created"
      ? "Offline donation saved."
      : searchParams.ok === "committed"
        ? "Dry-run batch committed to offline donations."
        : searchParams.ok === "status"
          ? "Offline donation status updated."
          : "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Offline donations</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Add manual offline gifts, preview CSV uploads, and commit approved batches into the platform totals.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div style={{ padding: "0.9rem 1rem", borderRadius: "0.85rem", background: "#FEE2E2", color: "#991B1B", fontSize: "0.85rem" }}>
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div style={{ padding: "0.9rem 1rem", borderRadius: "0.85rem", background: "rgba(30,140,110,0.12)", color: "#124E40", fontSize: "0.85rem" }}>
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Offline entries" value={String(offlineDonations.length)} sub="recent visible records" />
        <SummaryCard label="Approved value" value={formatCurrency(totalApproved)} sub="included in totals" />
        <SummaryCard label="Upload batches" value={String(uploadBatches.length)} sub="dry-run and committed" />
        <SummaryCard
          label="Gift Aid linked"
          value={String(offlineDonations.filter((donation) => donation.giftAidDeclaration).length)}
          sub="offline declarations saved"
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "#233029" }}>Manual entry</h2>
          <form action={createOfflineDonation} className="space-y-4">
            <Field label="Fundraiser page">
              <select name="pageId" className="input" required defaultValue="">
                <option value="">Select fundraiser page</option>
                {accessibleAppeals.map((appeal) => (
                  <optgroup key={appeal.id} label={`${appeal.title} — ${appeal.charity.name}`}>
                    {appeal.fundraisingPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} ({page.shortName})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Amount">
                <input name="amount" type="number" min="0.01" step="0.01" className="input" required />
              </Field>
              <Field label="Currency">
                <input name="currency" className="input" maxLength={3} defaultValue="GBP" />
              </Field>
              <Field label="Received date">
                <input name="receivedDate" type="date" className="input" required />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Donor name">
                <input name="donorName" className="input" placeholder="Optional unless Gift Aid applies" />
              </Field>
              <Field label="Status">
                <select name="status" className="input" defaultValue="APPROVED">
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </Field>
            </div>

            <Field label="Notes">
              <textarea name="notes" className="input" rows={3} style={{ resize: "vertical" }} />
            </Field>

            <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "#3A4A42" }}>
              <input type="checkbox" name="giftAid" />
              Create Gift Aid declaration for this offline donation
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Address line 1">
                <input name="donorAddressLine1" className="input" />
              </Field>
              <Field label="Address line 2">
                <input name="donorAddressLine2" className="input" />
              </Field>
              <Field label="City">
                <input name="donorCity" className="input" />
              </Field>
              <Field label="Postcode">
                <input name="donorPostcode" className="input" />
              </Field>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.25rem" }}>
              Save offline donation
            </button>
          </form>
        </div>

        <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>CSV upload</h2>
              <p className="text-sm" style={{ color: "#8A9E94" }}>
                Dry-run a CSV first, then commit only the valid rows.
              </p>
            </div>
          </div>

          <form action={dryRunUpload} className="space-y-4">
            <Field label="Appeal scope">
              <select name="appealId" className="input" required defaultValue="">
                <option value="">Select appeal</option>
                {accessibleAppeals.map((appeal) => (
                  <option key={appeal.id} value={appeal.id}>
                    {appeal.title} — {appeal.charity.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="CSV file">
              <input name="file" type="file" accept=".csv,text/csv" className="input" required />
            </Field>

            <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7", color: "#3A4A42" }}>
              Required columns: `amount`, `currency`, `received_date`, and a resolvable fundraiser page.
              Optional columns: `appeal_id`, `team_id`, `page_short_name`, `donor_name`, `notes`, `gift_aid_declaration`, `address_line_1`, `address_line_2`, `city`, `postcode`, `country`.
            </div>

            <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.25rem" }}>
              Dry-run upload
            </button>
          </form>

          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "#233029" }}>Recent batches</h3>
            <div className="space-y-3">
              {uploadBatches.map((batch) => (
                <div key={batch.id} className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.12)", background: "#FCFBF7" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#233029" }}>{batch.fileName}</p>
                      <p className="text-xs" style={{ color: "#8A9E94" }}>
                        {batch.appeal.title} · {batch.appeal.charity.name}
                      </p>
                    </div>
                    {statusPill(batch.status)}
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "#3A4A42" }}>
                    {batch.rowCount} rows · {batch.errorCount} errors · {new Date(batch.createdAt).toLocaleString("en-GB")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/admin/offline?batchId=${batch.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      View dry-run
                    </Link>
                    {batch.status === "DRY_RUN" ? (
                      <form action={commitBatch}>
                        <input type="hidden" name="batchId" value={batch.id} />
                        <button type="submit" className="btn-primary" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                          Commit
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
              {uploadBatches.length === 0 ? (
                <p className="text-sm" style={{ color: "#8A9E94" }}>No upload batches yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {selectedDryRun ? (
        <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.5rem" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Dry-run preview</h2>
              <p className="text-sm" style={{ color: "#8A9E94" }}>
                {selectedDryRun.fileName} · {selectedDryRun.validCount}/{selectedDryRun.rowCount} valid rows
              </p>
            </div>
            {selectedBatch?.status === "DRY_RUN" && selectedDryRun.errorCount === 0 ? (
              <form action={commitBatch}>
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <button type="submit" className="btn-primary" style={{ padding: "0.6rem 1rem" }}>
                  Commit valid rows
                </button>
              </form>
            ) : null}
          </div>

          <div className="space-y-3">
            {selectedDryRun.rows.map((row) => (
              <div key={row.rowNumber} className="rounded-2xl border p-4" style={{ borderColor: "rgba(18,78,64,0.12)", background: row.errors.length > 0 ? "#FFF5F5" : "#FCFBF7" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: "#233029" }}>Row {row.rowNumber}</p>
                  {row.errors.length > 0 ? (
                    <span style={{ color: "#991B1B", fontSize: "0.75rem", fontWeight: 700 }}>Needs fixes</span>
                  ) : (
                    <span style={{ color: "#124E40", fontSize: "0.75rem", fontWeight: 700 }}>Ready to import</span>
                  )}
                </div>
                <p className="mt-2 text-xs" style={{ color: "#3A4A42" }}>
                  {row.normalized?.pageShortName ?? "auto page"} · {row.normalized?.currency ?? "GBP"} · {row.normalized?.amount ?? "—"}
                </p>
                {row.errors.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm" style={{ color: "#991B1B" }}>
                    {row.errors.map((error) => (
                      <li key={error}>• {error}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>Offline donation records</h2>
            <p className="text-sm" style={{ color: "#8A9E94" }}>
              Recent offline gifts already included in appeal and fundraiser totals.
            </p>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Received", "Appeal / Page", "Donor", "Amount", "Gift Aid", "Batch", "Status"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offlineDonations.map((donation, index) => (
              <tr key={donation.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {new Date(donation.receivedDate).toLocaleDateString("en-GB")}
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="font-semibold" style={{ color: "#233029" }}>{donation.page?.appeal.title ?? "Unlinked appeal"}</div>
                  <div className="text-xs" style={{ color: "#8A9E94" }}>
                    {donation.page?.title ?? "No fundraiser page"} {donation.page?.team ? `· ${donation.page.team.name}` : ""}
                  </div>
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{donation.donorName ?? "Anonymous / collection"}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#233029", fontWeight: 600 }}>
                  {formatCurrency(donation.amount.toString(), donation.currency)}
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  {donation.giftAidDeclaration ? statusPill("APPROVED") : <span style={{ color: "#8A9E94" }}>No</span>}
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>
                  {donation.batch ? (
                    <Link href={`/admin/offline?batchId=${donation.batch.id}`} className="text-xs font-medium" style={{ color: "#1E8C6E" }}>
                      {donation.batch.fileName}
                    </Link>
                  ) : (
                    "Manual"
                  )}
                </td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <form action={updateOfflineStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={donation.id} />
                    <select name="status" className="input" defaultValue={donation.status} style={{ minWidth: "150px" }}>
                      <option value="APPROVED">Approved</option>
                      <option value="PENDING_APPROVAL">Pending approval</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                    <button type="submit" className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {offlineDonations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#8A9E94" }}>
                  No offline donations yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="block text-sm font-medium mb-2" style={{ color: "#3A4A42" }}>{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", padding: "1.1rem 1.2rem" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "#8A9E94" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#233029" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#8A9E94" }}>{sub}</p>
    </div>
  );
}
