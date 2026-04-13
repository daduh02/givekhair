import Link from "next/link";

type AppealOption = {
  id: string;
  title: string;
  charityName: string;
};

type TeamOption = {
  id: string;
  name: string;
  appealId: string;
};

type FundraisingPageFormValues = {
  appealId?: string;
  teamId?: string;
  title?: string;
  shortName?: string;
  story?: string;
  targetAmount?: string;
  currency?: string;
  coverImageUrl?: string;
};

export function FundraisingPageForm({
  action,
  appeals,
  teams,
  submitLabel,
  cancelHref,
  errorMessage,
  intro,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  appeals: AppealOption[];
  teams: TeamOption[];
  submitLabel: string;
  cancelHref: string;
  errorMessage?: string;
  intro: string;
  initialValues?: FundraisingPageFormValues;
}) {
  return (
    <form
      action={action}
      style={{
        background: "white",
        borderRadius: "1rem",
        boxShadow: "0 2px 12px rgba(18,78,64,0.07)",
        padding: "1.5rem",
      }}
      className="space-y-6"
    >
      {/* The core form stays focused on permanent page settings so richer
          self-serve tools like updates and media management can live alongside
          it without crowding the basic fundraiser setup flow. */}
      <div>
        <p className="text-sm leading-7" style={{ color: "#3A4A42" }}>
          {intro}
        </p>
      </div>

      {errorMessage ? (
        <div
          style={{
            padding: "0.9rem 1rem",
            borderRadius: "0.85rem",
            background: "#FEE2E2",
            color: "#991B1B",
            fontSize: "0.85rem",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Appeal">
          <select name="appealId" className="input" defaultValue={initialValues?.appealId ?? ""} required>
            <option value="">Select appeal</option>
            {appeals.map((appeal) => (
              <option key={appeal.id} value={appeal.id}>
                {appeal.title} · {appeal.charityName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Team (optional)">
          <select name="teamId" className="input" defaultValue={initialValues?.teamId ?? ""}>
            <option value="">No team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Page title">
          <input
            name="title"
            required
            className="input"
            placeholder="Run for clean water"
            defaultValue={initialValues?.title ?? ""}
          />
        </Field>

        <Field label="Short name">
          <input
            name="shortName"
            required
            className="input"
            placeholder="run-for-clean-water"
            defaultValue={initialValues?.shortName ?? ""}
          />
        </Field>

        <Field label="Target amount (optional)">
          <input
            name="targetAmount"
            type="number"
            min="1"
            step="0.01"
            className="input"
            placeholder="2500"
            defaultValue={initialValues?.targetAmount ?? ""}
          />
        </Field>

        <Field label="Currency">
          <input
            name="currency"
            className="input"
            maxLength={3}
            defaultValue={initialValues?.currency ?? "GBP"}
          />
        </Field>

        <Field label="Cover image URL">
          <input
            name="coverImageUrl"
            className="input"
            placeholder="https://..."
            defaultValue={initialValues?.coverImageUrl ?? ""}
          />
        </Field>
      </div>

      <Field label="Your fundraising story">
        <textarea
          name="story"
          className="input"
          rows={9}
          style={{ resize: "vertical" }}
          placeholder="Why this appeal matters to you, what supporters will help fund, and what progress you want to share."
          defaultValue={initialValues?.story ?? ""}
        />
      </Field>

      <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "#F8F5EF", color: "#3A4A42" }}>
        New pages are submitted for moderation before they go live publicly. Use clear fundraising copy, accurate imagery, and a short name you are happy to share publicly. The cover image appears at the top of the public fundraiser page.
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" style={{ padding: "0.7rem 1.25rem" }}>
          {submitLabel}
        </button>
        <Link href={cancelHref} className="btn-outline" style={{ padding: "0.7rem 1.25rem" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="mb-2 block text-sm font-medium" style={{ color: "#3A4A42" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
