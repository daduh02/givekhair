import type { CSSProperties, ReactNode } from "react";

type CommercialPlanFormProps = {
  action: (formData: FormData) => Promise<void>;
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

export function CommercialPlanForm({ action }: CommercialPlanFormProps) {
  return (
    <form action={action} className="space-y-4">
      {/* This form intentionally captures only the stable commercial-plan fields.
          Negotiated pricing detail stays in schedules/contracts so the basics are
          usable now without locking in the final contract model too early. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Plan name">
          <input name="name" required minLength={3} placeholder="Growth charity" style={inputStyle} />
        </Field>
        <Field label="Slug" hint="Used as the stable internal identifier.">
          <input name="slug" required minLength={3} placeholder="growth-charity" style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Fundraising model">
          <select name="fundraisingModel" defaultValue="CHARITY" style={inputStyle}>
            <option value="CHARITY">Charity</option>
            <option value="CROWDFUNDING">Crowdfunding</option>
          </select>
        </Field>
        <Field label="Billing interval">
          <select name="billingInterval" defaultValue="MONTHLY" style={inputStyle}>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </Field>
        <Field label="Flat platform fee">
          <input name="platformFlatFee" type="number" min="0" step="0.01" placeholder="149.00" style={inputStyle} />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={4}
          placeholder="Commercial summary for this plan, who it is for, and any included operational support."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Feature summary" hint="One feature per line for now. This keeps the starter implementation editable without needing a full feature-entitlement model yet.">
        <textarea
          name="featureSummary"
          rows={4}
          placeholder={"Public charity profile\nFundraiser pages\nModeration queue"}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <button type="submit" className="btn-primary">
        Save commercial plan
      </button>
    </form>
  );
}
