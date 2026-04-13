import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type {
  ChargingMode,
  ContractStatus,
  DonorSupportPromptStyle,
  PayoutFrequency,
  PayoutMethod,
  TermsDocumentType,
} from "@prisma/client";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { parseOptionalString, revalidateAdminSurfaces, toDateInput } from "@/lib/admin-management";
import { CharityContractForm } from "@/components/admin/CharityContractForm";
import { logCommercialAudit, validateNoOverlappingContracts } from "@/server/lib/commercials";

export const metadata: Metadata = { title: "Admin - Renew Contract" };

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

function suggestNextTermsVersion(currentVersion: string) {
  const match = currentVersion.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${currentVersion}-next`;
  }

  const prefix = match[1];
  const current = Number(match[2]);
  return `${prefix}${current + 1}`;
}

export default async function RenewContractPage({
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
      },
    }),
  ]);

  if (!contract) {
    redirect("/admin/settings");
  }

  async function renewContract(formData: FormData) {
    "use server";

    const { role: currentRole, managedCharity: currentManagedCharity, session: currentSession } = await getAdminContext();
    const canEdit = currentRole === "PLATFORM_ADMIN" || currentRole === "FINANCE";

    const sourceContract = await db.charityContract.findFirst({
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

    if (!sourceContract) {
      redirect("/admin/settings");
    }

    const charityId = canEdit
      ? String(formData.get("charityId") ?? "").trim()
      : sourceContract.charityId;
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
      redirect(`/admin/settings/contracts/${params.contractId}/renew?error=invalid`);
    }

    await validateNoOverlappingContracts({
      charityId,
      effectiveFrom: new Date(effectiveFromRaw),
      effectiveTo: effectiveToRaw ? new Date(effectiveToRaw) : null,
      region,
      productType,
    });

    const created = await db.charityContract.create({
      data: {
        charityId,
        commercialPlanId,
        feeScheduleId: feeScheduleId ?? undefined,
        status,
        chargingMode,
        region,
        productType: productType ?? undefined,
        donorSupportEnabled,
        donorSupportPromptStyle,
        donorSupportSuggestedPresets,
        payoutFrequency,
        payoutMethod,
        settlementDelayDays: Number.isFinite(settlementDelayDays) ? settlementDelayDays : 0,
        reserveRule: reserveRule ?? undefined,
        autoPauseAppealsOnExpiry,
        blockPayoutsOnExpiry,
        effectiveFrom: new Date(effectiveFromRaw),
        effectiveTo: effectiveToRaw ? new Date(effectiveToRaw) : undefined,
        signedAt: signedByName || signedByEmail ? new Date() : undefined,
        signedByName: signedByName ?? undefined,
        signedByEmail: signedByEmail ?? undefined,
        termsVersion,
        payoutTerms: payoutTerms ?? undefined,
        reservePolicy: reservePolicy ?? undefined,
        autoRenew,
        notes: notes ?? undefined,
        internalNotes: internalNotes ?? undefined,
      },
    });

    if (signedByName || signedByEmail) {
      await db.termsAcceptance.create({
        data: {
          contractId: created.id,
          charityId: created.charityId,
          documentType: "PLATFORM_TERMS" as TermsDocumentType,
          version: created.termsVersion,
          acceptedByName: signedByName ?? undefined,
          acceptedByEmail: signedByEmail ?? undefined,
          notes: `Renewed from contract ${sourceContract.termsVersion}.`,
        },
      });
    }

    await logCommercialAudit({
      action: "RENEW",
      entityType: "CHARITY_CONTRACT",
      contractId: created.id,
      charityId: created.charityId,
      summary: `Created renewal ${created.termsVersion} from ${sourceContract.termsVersion}`,
      metadata: {
        sourceContractId: sourceContract.id,
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
      `/admin/settings/contracts/${created.id}`,
      `/admin/settings/contracts/${created.id}/renew`,
    ]);
    redirect("/admin/settings?saved=contract-renewal");
  }

  const suggestedEffectiveFrom = contract.effectiveTo ? addDays(contract.effectiveTo, 1) : new Date();
  const errorMessage =
    searchParams.error === "invalid"
      ? "Please complete the required renewal fields before creating the new version."
      : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
            Renew contract
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: "#7A8D84" }}>
            Create a fresh contract version from the existing record. This keeps historic pricing and operational terms intact while giving the charity a new commercial period.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/settings/contracts/${contract.id}`} className="btn-outline" style={{ padding: "0.6rem 1rem" }}>
            Edit current contract
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
            <p style={{ color: "#8A9E94" }}>Renewing</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{contract.termsVersion}</p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Charity</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{contract.charity.name}</p>
          </div>
          <div>
            <p style={{ color: "#8A9E94" }}>Previous period ends</p>
            <p className="mt-1 font-semibold" style={{ color: "#233029" }}>{toDateInput(contract.effectiveTo) || "Open-ended"}</p>
          </div>
        </div>

        <CharityContractForm
          action={renewContract}
          charities={charities}
          plans={plans}
          feeSchedules={feeSchedules}
          showCharitySelect={canManageCommercials}
          defaultCharityId={managedCharity?.id}
          mode="renew"
          submitLabel="Create renewal contract"
          initialValues={{
            charityId: contract.charityId,
            commercialPlanId: contract.commercialPlanId,
            feeScheduleId: contract.feeScheduleId ?? "",
            termsVersion: suggestNextTermsVersion(contract.termsVersion),
            effectiveFrom: toDateInput(suggestedEffectiveFrom),
            effectiveTo: "",
            status: "DRAFT",
            signedByName: session.user?.name ?? "",
            signedByEmail: session.user?.email ?? "",
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
