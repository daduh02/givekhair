import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type {
  BillingInterval,
  ChargingMode,
  DonationKind,
  ContractStatus,
  DonorSupportPromptStyle,
  FundrasingModel,
  PayoutFrequency,
  PayoutMethod,
  TermsDocumentType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { parseOptionalString, revalidateAdminSurfaces, slugify } from "@/lib/admin-management";
import { CommercialPlanForm } from "@/components/admin/CommercialPlanForm";
import { FeeScheduleForm } from "@/components/admin/FeeScheduleForm";
import { CharityContractForm } from "@/components/admin/CharityContractForm";
import { logCommercialAudit, payoutTermsSummary, validateNoOverlappingContracts } from "@/server/lib/commercials";

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

async function resolveContractDocumentInput(fileValue: FormDataEntryValue | null, fileUrlValue: FormDataEntryValue | null) {
  const fileUrl = String(fileUrlValue ?? "").trim();

  if (fileUrl) {
    return {
      fileUrl,
      mimeType: null as string | null,
    };
  }

  if (fileValue instanceof File && fileValue.size > 0) {
    // For now we support a simple inline upload path that keeps contract
    // documents attached without introducing a new storage subsystem. A more
    // durable object-store-backed uploader can replace this later without
    // changing the contract-document model.
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    return {
      fileUrl: `data:${fileValue.type || "application/octet-stream"};base64,${buffer.toString("base64")}`,
      mimeType: fileValue.type || null,
    };
  }

  return null;
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function formatMoney(value: { toString(): string } | null | undefined, currency = "GBP") {
  const amount = parseFloat(value?.toString() ?? "0");
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function pill(value: string, tone: "green" | "sand" | "gold" = "sand") {
  const palette =
    tone === "green"
      ? { background: "rgba(30, 140, 110, 0.12)", color: "#124E40" }
      : tone === "gold"
        ? { background: "rgba(212,160,23,0.14)", color: "#8A5B00" }
        : { background: "rgba(18,78,64,0.08)", color: "#355247" };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={palette}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[1.75rem] border p-6 md:p-7"
      style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.9)", boxShadow: "0 18px 45px rgba(17, 24, 39, 0.06)" }}
    >
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-7" style={{ color: "#7A8D84" }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-[1.5rem] border p-5"
      style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.92)" }}
    >
      <p className="text-sm font-medium" style={{ color: "#7A8D84" }}>
        {label}
      </p>
      <p className="mt-3 text-4xl font-bold tracking-[-0.05em]" style={{ color: "#233029" }}>
        {value}
      </p>
      <p className="mt-2 text-sm" style={{ color: "#8A9E94" }}>
        {sub}
      </p>
    </div>
  );
}

export default async function SettingsPage() {
  const { role, managedCharity } = await getAdminContext();
  const canManageCommercials = role === "PLATFORM_ADMIN" || role === "FINANCE";

  async function createCommercialPlan(formData: FormData) {
    "use server";

    const { role: currentRole } = await getAdminContext();
    if (!["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)) {
      redirect("/403");
    }

    const name = String(formData.get("name") ?? "").trim();
    const slug = slugify(String(formData.get("slug") ?? ""));
    const description = parseOptionalString(formData.get("description"));
    const fundraisingModel = String(formData.get("fundraisingModel") ?? "CHARITY") as FundrasingModel;
    const billingInterval = String(formData.get("billingInterval") ?? "MONTHLY") as BillingInterval;
    const platformFlatFee = parseOptionalString(formData.get("platformFlatFee"));
    const featureSummaryRaw = String(formData.get("featureSummary") ?? "");

    if (name.length < 3 || slug.length < 3) {
      redirect("/admin/settings?error=plan");
    }

    await db.commercialPlan.create({
      data: {
        name,
        slug,
        description: description ?? undefined,
        fundraisingModel,
        billingInterval,
        platformFlatFee: platformFlatFee ?? undefined,
        status: "ACTIVE",
        featureSummary: featureSummaryRaw
          .split("\n")
          .map((entry) => entry.trim())
          .filter(Boolean),
      },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=plan");
  }

  async function createFeeSchedule(formData: FormData) {
    "use server";

    const { role: currentRole, managedCharity: currentManagedCharity } = await getAdminContext();
    const name = String(formData.get("name") ?? "").trim();
    const version = Number(formData.get("version") ?? 1);
    const explicitCharityId = parseOptionalString(formData.get("charityId"));
    const charityId = ["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)
      ? explicitCharityId
      : currentManagedCharity?.id ?? null;
    const commercialPlanId = parseOptionalString(formData.get("commercialPlanId"));
    const validFromRaw = String(formData.get("validFrom") ?? "");
    const validToRaw = parseOptionalString(formData.get("validTo"));
    const subscriptionTier = parseOptionalString(formData.get("subscriptionTier"));
    const platformFeePct = parseOptionalString(formData.get("platformFeePct"));
    const processingFeePct = parseOptionalString(formData.get("processingFeePct"));
    const processingFeeFixed = parseOptionalString(formData.get("processingFeeFixed"));
    const giftAidFeePct = parseOptionalString(formData.get("giftAidFeePct"));
    const capAmount = parseOptionalString(formData.get("capAmount"));
    const paymentMethod = parseOptionalString(formData.get("paymentMethod"));
    const fundraisingModel = parseOptionalString(formData.get("fundraisingModel")) as FundrasingModel | null;
    const donationKind = parseOptionalString(formData.get("donationKind")) as DonationKind | null;
    const chargingMode = parseOptionalString(formData.get("chargingMode")) as ChargingMode | null;
    const isActive = formData.get("isActive") === "on";
    const ruleIsActive = formData.get("ruleIsActive") === "on";
    const ruleEffectiveFrom = parseOptionalString(formData.get("ruleEffectiveFrom"));
    const ruleEffectiveTo = parseOptionalString(formData.get("ruleEffectiveTo"));

    if (name.length < 3 || !validFromRaw || !Number.isFinite(version) || version < 1) {
      redirect("/admin/settings?error=schedule");
    }

    const createdSchedule = await db.feeSchedule.create({
      data: {
        charityId: charityId ?? undefined,
        commercialPlanId: commercialPlanId ?? undefined,
        version,
        name,
        isActive,
        validFrom: new Date(validFromRaw),
        validTo: validToRaw ? new Date(validToRaw) : undefined,
        rules: {
          create: {
            countryCode: "GB",
            fundraisingModel: fundraisingModel ?? undefined,
            paymentMethod: paymentMethod || undefined,
            subscriptionTier: subscriptionTier ?? undefined,
            donationKind: donationKind ?? undefined,
            chargingMode: chargingMode ?? undefined,
            ruleType: "PERCENTAGE",
            platformFeePct: platformFeePct ?? undefined,
            processingFeePct: processingFeePct ?? undefined,
            processingFeeFixed: processingFeeFixed ?? undefined,
            giftAidFeePct: giftAidFeePct ?? undefined,
            capAmount: capAmount ?? undefined,
            isActive: ruleIsActive,
            effectiveFrom: ruleEffectiveFrom ? new Date(ruleEffectiveFrom) : undefined,
            effectiveTo: ruleEffectiveTo ? new Date(ruleEffectiveTo) : undefined,
            sortOrder: 1,
          },
        },
      },
      include: {
        rules: { take: 1 },
      },
    });

    await logCommercialAudit({
      action: "CREATE",
      entityType: "FEE_SCHEDULE",
      feeScheduleId: createdSchedule.id,
      feeRuleId: createdSchedule.rules[0]?.id,
      charityId: charityId ?? undefined,
      summary: `Created fee schedule ${createdSchedule.name}`,
      metadata: {
        chargingMode,
        donationKind,
        paymentMethod,
        subscriptionTier,
      },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=schedule");
  }

  async function createContract(formData: FormData) {
    "use server";

    const { role: currentRole, managedCharity: currentManagedCharity } = await getAdminContext();
    const charityId = ["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)
      ? String(formData.get("charityId") ?? "").trim()
      : currentManagedCharity?.id ?? "";
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
      redirect("/admin/settings?error=contract");
    }

    await validateNoOverlappingContracts({
      charityId,
      effectiveFrom: new Date(effectiveFromRaw),
      effectiveTo: effectiveToRaw ? new Date(effectiveToRaw) : null,
      region,
      productType,
    });

    const contract = await db.charityContract.create({
      data: {
        charityId,
        commercialPlanId,
        feeScheduleId: feeScheduleId ?? undefined,
        status,
        chargingMode: chargingMode as ChargingMode,
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
          contractId: contract.id,
          charityId,
          documentType: "PLATFORM_TERMS" as TermsDocumentType,
          version: termsVersion,
          acceptedByName: signedByName ?? undefined,
          acceptedByEmail: signedByEmail ?? undefined,
          notes: "Created from the starter fees/contracts admin surface.",
        },
      });
    }

    await logCommercialAudit({
      action: "CREATE",
      entityType: "CHARITY_CONTRACT",
      contractId: contract.id,
      charityId,
      summary: `Created contract ${termsVersion}`,
      metadata: {
        chargingMode,
        donorSupportEnabled,
        donorSupportPromptStyle,
        payoutFrequency,
        payoutMethod,
        settlementDelayDays,
        reserveRule,
      },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=contract");
  }

  async function updateContractStatus(formData: FormData) {
    "use server";

    const { role: currentRole } = await getAdminContext();
    if (!["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)) {
      redirect("/403");
    }

    const contractId = String(formData.get("contractId") ?? "");
    const status = String(formData.get("status") ?? "DRAFT") as ContractStatus;
    const contract = await db.charityContract.update({
      where: { id: contractId },
      data: { status },
      select: { id: true, charityId: true, termsVersion: true },
    });

    await logCommercialAudit({
      action: "STATUS_CHANGE",
      entityType: "CHARITY_CONTRACT",
      contractId: contract.id,
      charityId: contract.charityId,
      summary: `Contract ${contract.termsVersion} moved to ${status}`,
      metadata: { status },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=contract-status");
  }

  async function toggleScheduleActive(formData: FormData) {
    "use server";

    const { role: currentRole } = await getAdminContext();
    if (!["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)) {
      redirect("/403");
    }

    const feeScheduleId = String(formData.get("feeScheduleId") ?? "");
    const nextActive = String(formData.get("nextActive") ?? "") === "true";
    const schedule = await db.feeSchedule.update({
      where: { id: feeScheduleId },
      data: { isActive: nextActive },
      select: { id: true, charityId: true, name: true },
    });

    await logCommercialAudit({
      action: nextActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "FEE_SCHEDULE",
      feeScheduleId: schedule.id,
      charityId: schedule.charityId ?? undefined,
      summary: `${nextActive ? "Activated" : "Deactivated"} fee schedule ${schedule.name}`,
      metadata: { isActive: nextActive },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=schedule-status");
  }

  async function attachContractDocument(formData: FormData) {
    "use server";

    const { role: currentRole } = await getAdminContext();
    if (!["PLATFORM_ADMIN", "FINANCE"].includes(currentRole)) {
      redirect("/403");
    }

    const contractId = String(formData.get("contractId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const upload = await resolveContractDocumentInput(formData.get("file"), formData.get("fileUrl"));
    const documentType = String(formData.get("documentType") ?? "PLATFORM_TERMS") as TermsDocumentType;
    const mimeType = parseOptionalString(formData.get("mimeType")) ?? upload?.mimeType ?? null;

    if (!contractId || !name || !upload?.fileUrl) {
      redirect("/admin/settings?error=document");
    }

    const contract = await db.charityContract.findUnique({
      where: { id: contractId },
      select: { id: true, charityId: true, termsVersion: true },
    });

    if (!contract) {
      redirect("/admin/settings?error=document");
    }

    await db.contractDocument.create({
      data: {
        contractId,
        name,
        fileUrl: upload.fileUrl,
        mimeType: mimeType ?? undefined,
        documentType,
      },
    });

    await logCommercialAudit({
      action: "ATTACH_DOCUMENT",
      entityType: "CHARITY_CONTRACT",
      contractId: contract.id,
      charityId: contract.charityId,
      summary: `Attached ${documentType} document to contract ${contract.termsVersion}`,
      metadata: { name, fileUrl: upload.fileUrl, documentType },
    });

    revalidateAdminSurfaces(["/admin/settings"]);
    redirect("/admin/settings?saved=document");
  }

  const charityScope = canManageCommercials ? {} : { id: managedCharity?.id ?? "__none__" };
  const [charities, plans, feeSchedules, contracts, acceptances, auditLogs] = await Promise.all([
    db.charity.findMany({
      where: charityScope,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.commercialPlan.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { contracts: true, feeSchedules: true } },
      },
      take: 12,
    }),
    db.feeSchedule.findMany({
      where: canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" },
      orderBy: { createdAt: "desc" },
      include: {
        charity: { select: { name: true } },
        commercialPlan: { select: { name: true } },
        rules: { orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { feeSets: true, contracts: true } },
      },
      take: 12,
    }),
    db.charityContract.findMany({
      where: canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" },
      orderBy: { createdAt: "desc" },
      include: {
        charity: { select: { name: true } },
        commercialPlan: { select: { name: true } },
        feeSchedule: { select: { name: true } },
        documents: { orderBy: { createdAt: "desc" }, take: 5 },
        _count: { select: { acceptances: true } },
      },
      take: 12,
    }),
    db.termsAcceptance.findMany({
      where: canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" },
      orderBy: { acceptedAt: "desc" },
      include: {
        charity: { select: { name: true } },
        contract: { select: { termsVersion: true } },
      },
      take: 12,
    }),
    db.commercialAuditLog.findMany({
      where: canManageCommercials ? {} : { charityId: managedCharity?.id ?? "__none__" },
      orderBy: { createdAt: "desc" },
      include: {
        charity: { select: { name: true } },
      },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section
        className="rounded-[1.9rem] border px-6 py-6 md:px-7"
        style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.92)", boxShadow: "0 22px 45px rgba(17,24,39,0.06)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-[-0.04em]" style={{ color: "#233029" }}>
              Fees & contracts
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "#7A8D84" }}>
              This is the starter commercial layer for GiveKhair. It gives us durable records for plans, fee schedules,
              and charity contracts now, without pretending we already know every pricing and legal edge-case.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/fees" className="btn-outline" style={{ padding: "0.6rem 1rem" }}>
              Public fees page
            </Link>
            <Link href="/terms" className="btn-outline" style={{ padding: "0.6rem 1rem" }}>
              Public terms page
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <StatCard label="Commercial plans" value={String(plans.length)} sub="starter plan catalogue" />
        <StatCard label="Fee schedules" value={String(feeSchedules.length)} sub="active and draft pricing records" />
        <StatCard label="Contracts" value={String(contracts.length)} sub="charity commercial agreements" />
        <StatCard label="Acceptances" value={String(acceptances.length)} sub="logged legal/version acceptances" />
      </section>

      <Panel
        title="Commercial plans"
        description="Plans describe the commercial package a charity is on. They are intentionally lightweight right now: enough to classify charities and support future entitlement and pricing rules."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className="rounded-[1.4rem] border p-5"
                style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(248,245,239,0.68)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {pill(plan.status, plan.status === "ACTIVE" ? "green" : "sand")}
                  {plan.fundraisingModel ? pill(plan.fundraisingModel, "gold") : null}
                  {pill(plan.billingInterval)}
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
                      {plan.name}
                    </h3>
                    <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
                      {plan.description || "No commercial summary has been written for this plan yet."}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8A9E94" }}>
                      Flat fee
                    </p>
                    <p className="mt-2 text-lg font-bold" style={{ color: "#124E40" }}>
                      {formatMoney(plan.platformFlatFee, plan.platformFlatFeeCurrency)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: "#5D6F67" }}>
                  <span>{plan._count.contracts} contracts</span>
                  <span>{plan._count.feeSchedules} linked fee schedules</span>
                </div>
              </article>
            ))}
          </div>

          {canManageCommercials ? (
            <div
              className="rounded-[1.4rem] border p-5"
              style={{ borderColor: "rgba(18,78,64,0.08)", background: "#F9F6F0" }}
            >
              <h3 className="text-lg font-bold" style={{ color: "#233029" }}>
                Create commercial plan
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
                Use this to establish the commercial packaging layer now. Final entitlements and contract logic can be expanded later without breaking the stored records.
              </p>
              <div className="mt-5">
                <CommercialPlanForm action={createCommercialPlan} />
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Fee schedules"
        description="Schedules hold the actual pricing inputs used by the fee engine. This starter screen creates one baseline rule per schedule so pricing remains auditable before the full pricing-builder exists."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {feeSchedules.map((schedule) => {
              const rule = schedule.rules[0];
              return (
                <article
                  key={schedule.id}
                  className="rounded-[1.4rem] border p-5"
                  style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(248,245,239,0.68)" }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {pill(schedule.isActive ? "ACTIVE" : "DRAFT", schedule.isActive ? "green" : "sand")}
                    {schedule.charity?.name ? pill(schedule.charity.name, "gold") : pill("PLATFORM DEFAULT")}
                    {schedule.commercialPlan?.name ? pill(schedule.commercialPlan.name) : null}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
                        {schedule.name}
                      </h3>
                      <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
                        Version {schedule.version} · valid from {formatDate(schedule.validFrom)}
                        {schedule.validTo ? ` to ${formatDate(schedule.validTo)}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm" style={{ color: "#5D6F67" }}>
                      <p>{schedule._count.feeSets} snapshots</p>
                      <p className="mt-1">{schedule._count.contracts} contracts</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm" style={{ color: "#355247" }}>
                    <span>Platform: {rule?.platformFeePct ? `${(Number(rule.platformFeePct) * 100).toFixed(2)}%` : "—"}</span>
                    <span>Processing: {rule?.processingFeePct ? `${(Number(rule.processingFeePct) * 100).toFixed(2)}%` : "—"}{rule?.processingFeeFixed ? ` + ${formatMoney(rule.processingFeeFixed)}` : ""}</span>
                    <span>Gift Aid fee: {rule?.giftAidFeePct ? `${(Number(rule.giftAidFeePct) * 100).toFixed(2)}%` : "—"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule?.chargingMode ? pill(rule.chargingMode) : null}
                    {rule?.donationKind ? pill(rule.donationKind, "gold") : null}
                    {rule?.paymentMethod ? pill(rule.paymentMethod) : null}
                  </div>
                  <form action={toggleScheduleActive} className="mt-4">
                    <input type="hidden" name="feeScheduleId" value={schedule.id} />
                    <input type="hidden" name="nextActive" value={String(!schedule.isActive)} />
                    <button type="submit" className="btn-outline" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
                      {schedule.isActive ? "Deactivate schedule" : "Activate schedule"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>

          <div
            className="rounded-[1.4rem] border p-5"
            style={{ borderColor: "rgba(18,78,64,0.08)", background: "#F9F6F0" }}
          >
            <h3 className="text-lg font-bold" style={{ color: "#233029" }}>
              Create fee schedule
            </h3>
            <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
              This is the minimum viable pricing admin. It captures schedule history and one baseline rule now, which is much safer than hard-coding the next pricing decision into the fee engine.
            </p>
            <div className="mt-5">
              <FeeScheduleForm
                action={createFeeSchedule}
                charities={charities}
                plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
                showCharitySelect={canManageCommercials}
                defaultCharityId={managedCharity?.id}
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Charity contracts"
        description="Contracts are the durable commercial agreement record between GiveKhair and a charity. We are storing the stable terms now so the final legal and pricing requirements can be mapped onto a real object later."
      >
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {contracts.map((contract) => (
              <article
                key={contract.id}
                className="rounded-[1.4rem] border p-5"
                style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(248,245,239,0.68)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {pill(contract.status, contract.status === "ACTIVE" ? "green" : "sand")}
                  {pill(contract.charity.name, "gold")}
                  {pill(contract.commercialPlan.name)}
                  {pill(contract.chargingMode)}
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-[-0.03em]" style={{ color: "#233029" }}>
                      {contract.commercialPlan.name}
                    </h3>
                    <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
                      Terms {contract.termsVersion} · effective {formatDate(contract.effectiveFrom)}
                      {contract.effectiveTo ? ` to ${formatDate(contract.effectiveTo)}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm" style={{ color: "#5D6F67" }}>
                    <p>{contract._count.acceptances} acceptances</p>
                    <p className="mt-1">{contract.feeSchedule?.name ?? "No explicit schedule"}</p>
                  </div>
                </div>
                {(contract.payoutTerms || contract.reservePolicy || contract.notes) ? (
                  <div className="mt-4 space-y-2 text-sm leading-7" style={{ color: "#355247" }}>
                    {contract.payoutTerms ? <p><strong>Payouts:</strong> {contract.payoutTerms}</p> : null}
                    {contract.reservePolicy ? <p><strong>Reserve:</strong> {contract.reservePolicy}</p> : null}
                    {contract.notes ? <p><strong>Notes:</strong> {contract.notes}</p> : null}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm" style={{ color: "#355247" }}>
                  <p><strong>Donor support:</strong> {contract.donorSupportEnabled ? "Enabled" : "Disabled"} · {contract.donorSupportPromptStyle.toLowerCase()}</p>
                  <p><strong>Payout ops:</strong> {payoutTermsSummary(contract)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/admin/settings/contracts/${contract.id}`} className="btn-outline" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
                    Edit contract
                  </Link>
                  <Link href={`/admin/settings/contracts/${contract.id}/renew`} className="btn-outline" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
                    Renew version
                  </Link>
                  <form action={updateContractStatus}>
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input type="hidden" name="status" value={contract.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                    <button type="submit" className="btn-outline" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
                      {contract.status === "ACTIVE" ? "Suspend contract" : "Activate contract"}
                    </button>
                  </form>
                  <form action={updateContractStatus}>
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input type="hidden" name="status" value="EXPIRED" />
                    <button type="submit" className="btn-outline" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
                      Mark expired
                    </button>
                  </form>
                </div>
                <div className="mt-5 rounded-[1.2rem] border p-4" style={{ borderColor: "rgba(18,78,64,0.08)", background: "rgba(255,255,255,0.8)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#233029" }}>Contract documents</p>
                  <div className="mt-3 space-y-2">
                    {contract.documents.map((document) => (
                      <a key={document.id} href={document.fileUrl} target="_blank" rel="noreferrer" className="block text-sm" style={{ color: "#124E40" }}>
                        {document.name} · {document.documentType.replaceAll("_", " ")}
                      </a>
                    ))}
                    {contract.documents.length === 0 ? <p className="text-sm" style={{ color: "#8A9E94" }}>No contract documents yet.</p> : null}
                  </div>
                  {canManageCommercials ? (
                    <form action={attachContractDocument} className="mt-4 grid gap-3 md:grid-cols-2">
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input name="name" placeholder="Document name" className="input" />
                      <input name="fileUrl" placeholder="https://... (optional if uploading a file)" className="input" />
                      <select name="documentType" className="input">
                        <option value="PLATFORM_TERMS">Platform terms</option>
                        <option value="MASTER_SERVICE_AGREEMENT">MSA</option>
                        <option value="FEE_SCHEDULE">Fee schedule</option>
                        <option value="DATA_PROCESSING">Data processing</option>
                        <option value="FUNDRAISING_RULES">Fundraising rules</option>
                        <option value="GIFT_AID_TERMS">Gift Aid terms</option>
                      </select>
                      <input name="file" type="file" className="input" />
                      <input name="mimeType" placeholder="application/pdf" className="input" />
                      <button type="submit" className="btn-primary md:col-span-2">
                        Attach document
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {canManageCommercials ? (
            <div
              className="rounded-[1.4rem] border p-5"
              style={{ borderColor: "rgba(18,78,64,0.08)", background: "#F9F6F0" }}
            >
              <h3 className="text-lg font-bold" style={{ color: "#233029" }}>
                Create charity contract
              </h3>
              <p className="mt-2 text-sm leading-7" style={{ color: "#7A8D84" }}>
                This creates the baseline legal/commercial record and optionally logs a matching terms acceptance if signer details are supplied.
              </p>
              <div className="mt-5">
                <CharityContractForm
                  action={createContract}
                  charities={charities}
                  plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
                  feeSchedules={feeSchedules.map((schedule) => ({ id: schedule.id, name: schedule.name }))}
                  showCharitySelect={canManageCommercials}
                  defaultCharityId={managedCharity?.id}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Commercial audit log"
        description="Commercial changes are logged separately from the core entity records so finance and ops can see how pricing and contract states changed over time."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ color: "#7A8D84" }}>
                {["When", "Entity", "Action", "Summary", "Charity"].map((heading) => (
                  <th key={heading} className="text-left font-semibold" style={{ padding: "0 0 0.85rem 0" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => (
                <tr key={entry.id} style={{ borderTop: "1px solid rgba(18,78,64,0.08)" }}>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{formatDate(entry.createdAt)}</td>
                  <td style={{ padding: "0.95rem 0", color: "#233029", fontWeight: 600 }}>{entry.entityType}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{entry.action}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{entry.summary}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{entry.charity?.name ?? "Platform"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Terms acceptances"
        description="Acceptance records are deliberately separate from the contract itself. That gives us space for later requirements like multiple document types, revised legal versions, or contract renewals without mutating history."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ color: "#7A8D84" }}>
                {["Accepted", "Charity", "Document", "Version", "Signer", "Contract"].map((heading) => (
                  <th key={heading} className="text-left font-semibold" style={{ padding: "0 0 0.85rem 0" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acceptances.map((acceptance) => (
                <tr key={acceptance.id} style={{ borderTop: "1px solid rgba(18,78,64,0.08)" }}>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{formatDate(acceptance.acceptedAt)}</td>
                  <td style={{ padding: "0.95rem 0", color: "#233029", fontWeight: 600 }}>{acceptance.charity.name}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{acceptance.documentType.replaceAll("_", " ")}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{acceptance.version}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{acceptance.acceptedByName ?? acceptance.acceptedByEmail ?? "Recorded acceptance"}</td>
                  <td style={{ padding: "0.95rem 0", color: "#355247" }}>{acceptance.contract?.termsVersion ?? "Standalone"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
