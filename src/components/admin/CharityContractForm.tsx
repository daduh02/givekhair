import type { CSSProperties, ReactNode } from "react";

type CharityContractFormProps = {
  action: (formData: FormData) => Promise<void>;
  charities: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
  feeSchedules: Array<{ id: string; name: string }>;
  showCharitySelect: boolean;
  defaultCharityId?: string;
  submitLabel?: string;
  mode?: "create" | "edit" | "renew";
  initialValues?: {
    charityId?: string;
    commercialPlanId?: string;
    feeScheduleId?: string;
    termsVersion?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    status?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TERMINATED";
    signedByName?: string;
    signedByEmail?: string;
    chargingMode?: "CHARITY_PAID" | "DONOR_SUPPORTED" | "HYBRID";
    region?: string;
    productType?: string;
    payoutFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL";
    payoutMethod?: "STRIPE_CONNECT" | "GOCARDLESS" | "BACS" | "MANUAL";
    settlementDelayDays?: string;
    donorSupportPromptStyle?: "TOGGLE" | "CHECKBOX" | "PRESET";
    donorSupportSuggestedPresets?: string;
    payoutTerms?: string;
    reservePolicy?: string;
    reserveRule?: string;
    notes?: string;
    internalNotes?: string;
    autoRenew?: boolean;
    donorSupportEnabled?: boolean;
    autoPauseAppealsOnExpiry?: boolean;
    blockPayoutsOnExpiry?: boolean;
  };
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold" style={{ color: "#233029" }}>
        {label}
      </span>
      {hint ? (
        <span className="mt-1 block text-xs leading-5" style={{ color: "#7A8D84" }}>
          {hint}
        </span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "14px",
  border: "1px solid rgba(18, 78, 64, 0.12)",
  background: "rgba(255,255,255,0.96)",
  padding: "0.8rem 0.95rem",
  color: "#233029",
};

export function CharityContractForm({
  action,
  charities,
  plans,
  feeSchedules,
  showCharitySelect,
  defaultCharityId,
  submitLabel = "Save charity contract",
  mode = "create",
  initialValues,
}: CharityContractFormProps) {
  const selectedCharityId = initialValues?.charityId ?? defaultCharityId ?? "";

  return (
    <form action={action} className="space-y-4">
      {/* Contracts are the durable commercial record. The starter form focuses
          on stable legal/operational metadata so later pricing rules can be
          layered in without rewriting the admin surface. */}
      <div className="grid gap-4 md:grid-cols-3">
        {showCharitySelect ? (
          <Field label="Charity">
            <select name="charityId" required defaultValue={selectedCharityId} style={inputStyle}>
              <option value="" disabled>
                Select charity
              </option>
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="charityId" value={selectedCharityId} />
        )}

        <Field label="Commercial plan">
          <select name="commercialPlanId" required defaultValue={initialValues?.commercialPlanId ?? ""} style={inputStyle}>
            <option value="" disabled>
              Select plan
            </option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fee schedule">
          <select name="feeScheduleId" defaultValue={initialValues?.feeScheduleId ?? ""} style={inputStyle}>
            <option value="">No explicit schedule</option>
            {feeSchedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Terms version">
          <input name="termsVersion" required placeholder="2026.1" defaultValue={initialValues?.termsVersion ?? ""} style={inputStyle} />
        </Field>
        <Field label="Effective from">
          <input name="effectiveFrom" type="date" required defaultValue={initialValues?.effectiveFrom ?? ""} style={inputStyle} />
        </Field>
        <Field label="Effective to">
          <input name="effectiveTo" type="date" defaultValue={initialValues?.effectiveTo ?? ""} style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Status">
          <select name="status" defaultValue={initialValues?.status ?? (mode === "renew" ? "DRAFT" : "DRAFT")} style={inputStyle}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </Field>
        <Field label="Signed by name">
          <input name="signedByName" placeholder="Amina Operations" defaultValue={initialValues?.signedByName ?? ""} style={inputStyle} />
        </Field>
        <Field label="Signed by email">
          <input name="signedByEmail" type="email" placeholder="ops@charity.org" defaultValue={initialValues?.signedByEmail ?? ""} style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Charging mode">
          <select name="chargingMode" defaultValue={initialValues?.chargingMode ?? "CHARITY_PAID"} style={inputStyle}>
            <option value="CHARITY_PAID">Charity paid</option>
            <option value="DONOR_SUPPORTED">Donor supported</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </Field>
        <Field label="Region">
          <input name="region" placeholder="GB" defaultValue={initialValues?.region ?? "GB"} style={inputStyle} />
        </Field>
        <Field label="Product type">
          <input name="productType" placeholder="general-fundraising" defaultValue={initialValues?.productType ?? ""} style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Payout frequency">
          <select name="payoutFrequency" defaultValue={initialValues?.payoutFrequency ?? "MONTHLY"} style={inputStyle}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="MANUAL">Manual</option>
          </select>
        </Field>
        <Field label="Payout method">
          <select name="payoutMethod" defaultValue={initialValues?.payoutMethod ?? "BACS"} style={inputStyle}>
            <option value="STRIPE_CONNECT">Stripe Connect</option>
            <option value="GOCARDLESS">GoCardless</option>
            <option value="BACS">BACS</option>
            <option value="MANUAL">Manual</option>
          </select>
        </Field>
        <Field label="Settlement delay days">
          <input name="settlementDelayDays" type="number" min="0" defaultValue={initialValues?.settlementDelayDays ?? "0"} style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Donor-support prompt style">
          <select name="donorSupportPromptStyle" defaultValue={initialValues?.donorSupportPromptStyle ?? "TOGGLE"} style={inputStyle}>
            <option value="TOGGLE">Toggle</option>
            <option value="CHECKBOX">Checkbox</option>
            <option value="PRESET">Preset</option>
          </select>
        </Field>
        <Field label="Donor-support suggested presets" hint="Comma-separated amounts, for example 1,2,5">
          <input name="donorSupportSuggestedPresets" placeholder="1,2,5" defaultValue={initialValues?.donorSupportSuggestedPresets ?? ""} style={inputStyle} />
        </Field>
      </div>

      <Field label="Payout terms">
        <textarea
          name="payoutTerms"
          rows={3}
          placeholder="Monthly GBP payouts after compliance review."
          defaultValue={initialValues?.payoutTerms ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Reserve policy">
        <textarea
          name="reservePolicy"
          rows={3}
          placeholder="No reserve by default unless elevated risk review applies."
          defaultValue={initialValues?.reservePolicy ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Reserve rule">
        <input name="reserveRule" placeholder="none" defaultValue={initialValues?.reserveRule ?? ""} style={inputStyle} />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Commercial notes, negotiated context, or implementation caveats."
          defaultValue={initialValues?.notes ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Internal notes">
        <textarea
          name="internalNotes"
          rows={3}
          placeholder="Internal-only commercial notes for ops and finance."
          defaultValue={initialValues?.internalNotes ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="autoRenew" defaultChecked={Boolean(initialValues?.autoRenew)} />
        Contract auto-renews unless terminated
      </label>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="donorSupportEnabled" defaultChecked={Boolean(initialValues?.donorSupportEnabled)} />
        Enable donor-support prompts by default for this contract
      </label>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="autoPauseAppealsOnExpiry" defaultChecked={Boolean(initialValues?.autoPauseAppealsOnExpiry)} />
        Auto-pause appeals when this contract expires
      </label>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="blockPayoutsOnExpiry" defaultChecked={initialValues?.blockPayoutsOnExpiry ?? true} />
        Block payouts when this contract expires
      </label>

      <button type="submit" className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
