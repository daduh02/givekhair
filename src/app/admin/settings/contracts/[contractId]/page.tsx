import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type {
  ChargingMode,
  ContractStatus,
  DonorSupportPromptStyle,
  PayoutFrequency,
  PayoutMethod,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { parseOptionalString, revalidateAdminSurfaces, toDateInput } from "@/lib/admin-management";
import { CharityContractForm } from "@/components/admin/CharityContractForm";
import { logCommercialAudit, validateNoOverlappingContracts } from "@/server/lib/commercials";

export const metadata: Metadata = { title: "Admin - Edit Contract" };

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

export default async function EditContractPage({
  params,
  searchParams,
}: {
  params: { contractId: string };
  searchParams: { error?: string };
}) {
  const { role, managedCharity, session } = await getAdminContext();
  const canManageCommercials = role === "PLATFORM_ADMIN" || role === "FINANCE";

  const [charities, plans, feeSchedules, contract] = await Promise.all([
    db.charity.findMany({
      where: canManageCommercials ? {} : { id: managedCharity?.id ?? "__none__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.commercialPlan.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.feeSchedule.findMany({
      where: canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.charityContract.findFirst({
      where: {
        id: params.contractId,
        ...(canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" }),
      },
      include: {
        charity: { select: { id: true, name: true } },
        commercialPlan: { select: { id: true, name: true } },
        feeSchedule: { select: { id: true, name: true } },
      },
    }),
  ]);

  if (!contract) {
    redirect("/admin/settings");
  }

  async function updateContract(formData: FormData) {
    "use server";

    const { role: currentRole, managedCharity: currentManagedCharity, session: currentSession } = await getAdminContext();
    const canEdit = currentRole === "PLATFORM_ADMIN" || currentRole === "FINANCE";

    const existingContract = await db.charityContract.findFirst({
      where: {
        id: params.contractId,
        ...(canEdit ? {} : { charityId: currentManagedCharity?.id ?? "__none__" }),
      },
      select: {
        id: true,
        charityId: true,
        termsVersion: true,
      },
    });

    if (!existingContract) {
      redirect("/admin/settings");
    }

    const charityId = canEdit
      ? String(formData.get("charityId") ?? "").trim()
      : existingContract.charityId;
    const commercialPlanId = String(formData.get("commercialPlanId") ?? "").trim();
    const feeScheduleId = parseOptionalString(formData.get("feeScheduleId"));
    const termsVersion = String(formData.get("termsVersion") ?? "").trim();
    const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
    const effectiveToRaw = parseOptionalString(formData.get("effectiveTo"));
    const status = String(formData.get("status") ?? "DRAFT") as ContractStatus;
    const signedByName = parseOptionalString(formData.get("signedByName"));
    const signedByEmail = parseOptionalString(formData.get("signedByEmail"));
    const payoutTerms = parseOptionalString(formData.get("payoutTerms"));
    const reservePolicy = parseOptionalString(formData.get("reservePolicy"));
    const chargingMode = String(formData.get("chargingMode") ?? "CHARITY_PAID") as ChargingMode;
    const region = parseOptionalString(formData.get("region")) ?? "GB";
    const productType = parseOptionalString(formData.get("productType"));
    const donorSupportEnabled = formData.get("donorSupportEnabled") === "on";
    const donorSupportPromptStyle = String(formData.get("donorSupportPromptStyle") ?? "TOGGLE") as DonorSupportPromptStyle;
    const donorSupportSuggestedPresets = parseNumberList(String(formData.get("donorSupportSuggestedPresets") ?? ""));
    const payoutFrequency = String(formData.get("payoutFrequency") ?? "MONTHLY") as PayoutFrequency;
    const payoutMethod = String(formData.get("payoutMethod") ?? "BACS") as PayoutMethod;
    const settlementDelayDays = Number(formData.get("settlementDelayDays") ?? 0);
    const reserveRule = parseOptionalString(formData.get("reserveRule"));
    const autoPauseAppealsOnExpiry = formData.get("autoPauseAppealsOnExpiry") === "on";
    const blockPayoutsOnExpiry = formData.get("blockPayoutsOnExpiry") === "on";
    const notes = parseOptionalString(formData.get("notes"));
    const internalNotes = parseOptionalString(formData.get("internalNotes"));
    const autoRenew = formData.get("autoRenew") === "on";

    if (!charityId || !commercialPlanId || !termsVersion || !effectiveFromRaw) {
      redirect(`/admin/settings/contracts/${params.contractId}?error=invalid`);
    }

    await validateNoOverlappingContracts({
      charityId,
      effectiveFrom: new Date(effectiveFromRaw),
      effectiveTo: effectiveToRaw ? new Date(effectiveToRaw) : null,
      region,
      productType,
      excludeId: params.contractId,
    });

    const updated = await db.charityContract.update({
      where: { id: params.contractId },
      data: {
        charityId,
        commercialPlanId,
        feeScheduleId: feeScheduleId ?? null,
        status,
        chargingMode,
        region,
        productType: productType ?? null,
        donorSupportEnabled,
        donorSupportPromptStyle,
        donorSupportSuggestedPresets,
        payoutFrequency,
        payoutMethod,
        settlementDelayDays: Number.isFinite(settlementDelayDays) ? settlementDelayDays : 0,
        reserveRule: reserveRule ?? null,
        autoPauseAppealsOnExpiry,
        blockPayoutsOnExpiry,
        effectiveFrom: new Date(effectiveFromRaw),
        effectiveTo: effectiveToRaw ? new Date(effectiveToRaw) : null,
        signedAt: signedByName || signedByEmail ? new Date() : null,
        signedByName: signedByName ?? null,
        signedByEmail: signedByEmail ?? null,
        termsVersion,
        payoutTerms: payoutTerms ?? null,
        reservePolicy: reservePolicy ?? null,
        autoRenew,
        notes: notes ?? null,
        internalNotes: internalNotes ?? null,
      },
    });

    await logCommercialAudit({
      action: "UPDATE",
      entityType: "CHARITY_CONTRACT",
      contractId: updated.id,
      charityId: updated.charityId,
      summary: `Updated contract ${updated.termsVersion}`,
      metadata: {
        chargingMode,
        donorSupportEnabled,
        payoutFrequency,
        payoutMethod,
        settlementDelayDays,
        status,
      },
      changedByName: currentSession.user?.name ?? null,
      changedByEmail: currentSession.user?.email ?? null,
    });

    revalidateAdminSurfaces([
      `/admin/settings/contracts/${updated.id}`,
      `/admin/settings/contracts/${updated.id}/renew`,
    ]);
    redirect("/admin/settings?saved=contract-update");
  }

  const errorMessage =
    searchParams.error === "invalid"
      ? "Please complete the required contract fields before saving."
      : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
            Edit contract
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: "#7A8D84" }}>
            Update the active commercial terms without creating a new version. Use renewal when the charity needs a fresh contract period or terms version.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/settings/contracts/${contract.id}/renew`} className="btn-outline" style={{ padding: "0.6rem 1rem" }}>
            Renew as new version
          </Link>
          <Link href="/admin/settings" className="btn-outline" style={{ padding: "0.6rem 1rem" }}>
            Back to settings
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[1rem] border px-4 py-3 text-sm" style={{ borderColor: "rgba(185, 28, 28, 0.14)", background: "#FEF2F2", color: "#991B1B" }}>
          {errorMessage}
        </div>
      ) : null}

      <section
        className="rounded-[1.5rem] border p-6"
        style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.92)", boxShadow: "0 18px 45px rgba(17, 24, 39, 0.06)" }}
      >
        <div className="mb-5 grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p style={{ color: "#8A9E94" }}>Charity</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{contract.charity.name}</p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Current version</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{contract.termsVersion}</p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Current status</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{contract.status}</p>
          </div>
        </div>

        <CharityContractForm
          action={updateContract}
          charities={charities}
          plans={plans}
          feeSchedules={feeSchedules}
          showCharitySelect={canManageCommercials}
          defaultCharityId={managedCharity?.id}
          mode="edit"
          submitLabel="Save contract changes"
          initialValues={{
            charityId: contract.charityId,
            commercialPlanId: contract.commercialPlanId,
            feeScheduleId: contract.feeScheduleId ?? "",
            termsVersion: contract.termsVersion,
            effectiveFrom: toDateInput(contract.effectiveFrom),
            effectiveTo: toDateInput(contract.effectiveTo),
            status: contract.status,
            signedByName: contract.signedByName ?? "",
            signedByEmail: contract.signedByEmail ?? "",
            chargingMode: contract.chargingMode,
            region: contract.region ?? "GB",
            productType: contract.productType ?? "",
            payoutFrequency: contract.payoutFrequency,
            payoutMethod: contract.payoutMethod,
            settlementDelayDays: String(contract.settlementDelayDays),
            donorSupportPromptStyle: contract.donorSupportPromptStyle,
            donorSupportSuggestedPresets: Array.isArray(contract.donorSupportSuggestedPresets)
              ? contract.donorSupportSuggestedPresets.join(",")
              : "",
            payoutTerms: contract.payoutTerms ?? "",
            reservePolicy: contract.reservePolicy ?? "",
            reserveRule: contract.reserveRule ?? "",
            notes: contract.notes ?? "",
            internalNotes: contract.internalNotes ?? "",
            autoRenew: contract.autoRenew,
            donorSupportEnabled: contract.donorSupportEnabled,
            autoPauseAppealsOnExpiry: contract.autoPauseAppealsOnExpiry,
            blockPayoutsOnExpiry: contract.blockPayoutsOnExpiry,
          }}
        />
      </section>
    </div>
  );
}
