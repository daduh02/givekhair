import type { CSSProperties, ReactNode } from "react";

type FeeScheduleFormProps = {
  action: (formData: FormData) => Promise<void>;
  charities: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
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

export function FeeScheduleForm({
  action,
  charities,
  plans,
  showCharitySelect,
  defaultCharityId,
}: FeeScheduleFormProps) {
  return (
    <form action={action} className="space-y-4">
      {/* The starter fees UI creates one schedule plus one default rule. That
          gives ops a durable data foundation now, while leaving room for more
          advanced rule builders once the pricing requirements are finalized. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Schedule name">
          <input name="name" required minLength={3} placeholder="Islamic Relief UK default 2026" style={inputStyle} />
        </Field>
        <Field label="Version">
          <input name="version" type="number" min="1" defaultValue="1" required style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Commercial plan">
          <select name="commercialPlanId" defaultValue="" style={inputStyle}>
            <option value="">No linked plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        {showCharitySelect ? (
          <Field label="Charity scope" hint="Leave empty to make this the platform default.">
            <select name="charityId" defaultValue="" style={inputStyle}>
              <option value="">Platform default</option>
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
        <Field label="Valid from">
          <input name="validFrom" type="date" required style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Valid to">
          <input name="validTo" type="date" style={inputStyle} />
        </Field>
        <Field label="Subscription tier" hint="Optional tier label used by fee resolution later.">
          <input name="subscriptionTier" placeholder="growth" style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Platform fee %">
          <input name="platformFeePct" type="number" min="0" step="0.0001" placeholder="0.0150" style={inputStyle} />
        </Field>
        <Field label="Processing fee %">
          <input name="processingFeePct" type="number" min="0" step="0.0001" placeholder="0.0140" style={inputStyle} />
        </Field>
        <Field label="Processing fixed fee">
          <input name="processingFeeFixed" type="number" min="0" step="0.01" placeholder="0.20" style={inputStyle} />
        </Field>
        <Field label="Gift Aid fee %">
          <input name="giftAidFeePct" type="number" min="0" step="0.0001" placeholder="0.0000" style={inputStyle} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Payment method">
          <select name="paymentMethod" defaultValue="card" style={inputStyle}>
            <option value="card">Card</option>
            <option value="card_recurring">Card recurring</option>
            <option value="">Any method</option>
          </select>
        </Field>
        <Field label="Donation kind">
          <select name="donationKind" defaultValue="ONE_OFF" style={inputStyle}>
            <option value="ONE_OFF">One off</option>
            <option value="RECURRING">Recurring</option>
            <option value="">Any kind</option>
          </select>
        </Field>
        <Field label="Fundraising model">
          <select name="fundraisingModel" defaultValue="CHARITY" style={inputStyle}>
            <option value="CHARITY">Charity</option>
            <option value="CROWDFUNDING">Crowdfunding</option>
          </select>
        </Field>
        <Field label="Charging mode">
          <select name="chargingMode" defaultValue="CHARITY_PAID" style={inputStyle}>
            <option value="CHARITY_PAID">Charity paid</option>
            <option value="DONOR_SUPPORTED">Donor supported</option>
            <option value="HYBRID">Hybrid</option>
            <option value="">Any mode</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Cap amount">
          <input name="capAmount" type="number" min="0" step="0.01" placeholder="15.00" style={inputStyle} />
        </Field>
        <Field label="Rule effective from">
          <input name="ruleEffectiveFrom" type="date" style={inputStyle} />
        </Field>
        <Field label="Rule effective to">
          <input name="ruleEffectiveTo" type="date" style={inputStyle} />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="isActive" defaultChecked />
        Mark this schedule active immediately
      </label>

      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: "#233029" }}>
        <input type="checkbox" name="ruleIsActive" defaultChecked />
        Mark the starter fee rule active
      </label>

      <button type="submit" className="btn-primary">
        Save fee schedule
      </button>
    </form>
  );
}
