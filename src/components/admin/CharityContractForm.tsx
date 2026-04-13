import type { CSSProperties, ReactNode } from "react";

type CharityContractFormProps = {
  action: (formData: FormData) => Promise<void>;
  charities: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
  feeSchedules: Array<{ id: string; name: string }>;
  showCharitySelect: boolean;
  defaultCharityId?: string;
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
}: CharityContractFormProps) {
  return (
    <form action={action} className="space-y-4">
      {/* Contracts are the durable commercial record. The starter form focuses
          on stable legal/operational metadata so later pricing rules can be
          layered in without rewriting the admin surface. */}
      <div className="grid gap-4 md:grid-cols-3">
        {showCharitySelect ? (
          <Field label="Charity">
            <select name="charityId" required defaultValue="" style={inputStyle}>
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
          <input type="hidden" name="charityId" value={defaultCharityId ?? ""} />
        )}

        <Field label="Commercial plan">
          <select name="commercialPlanId" required defaultValue="" style={inputStyle}>
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
          <select name="feeScheduleId" defaultValue="" style={inputStyle}>
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
          <input name="termsVersion" required placeholder="2026.1" style={inputStyle} />
        </Field>
        <Field label="Effective from">
          <input name="effectiveFrom" type="date" required style={inputStyle} />
        </Field>
        <Field label="Effective to">
          <input name="effectiveTo" type="date" style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Status">
          <select name="status" defaultValue="DRAFT" style={inputStyle}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </Field>
        <Field label="Signed by name">
          <input name="signedByName" placeholder="Amina Operations" style={inputStyle} />
        </Field>
        <Field label="Signed by email">
          <input name="signedByEmail" type="email" placeholder="ops@charity.org" style={inputStyle} />
        </Field>
      </div>

      <Field label="Payout terms">
        <textarea
          name="payoutTerms"
          rows={3}
          placeholder="Monthly GBP payouts after compliance review."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Reserve policy">
        <textarea
          name="reservePolicy"
          rows={3}
          placeholder="No reserve by default unless elevated risk review applies."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Commercial notes, negotiated context, or implementation caveats."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="autoRenew" />
        Contract auto-renews unless terminated
      </label>

      <button type="submit" className="btn-primary">
        Save charity contract
      </button>
    </form>
  );
}
