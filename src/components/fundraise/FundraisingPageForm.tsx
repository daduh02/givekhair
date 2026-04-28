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
      className="surface-card space-y-5 p-5 sm:p-6"
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
        <div className="rounded-[0.95rem] bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">
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
          <p className="mb-2 text-sm text-[color:var(--color-ink-muted)]">This becomes the public URL for your page.</p>
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
          <p className="mb-2 text-sm text-[color:var(--color-ink-muted)]">This appears at the top of your public fundraiser page.</p>
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
          rows={7}
          style={{ resize: "vertical" }}
          placeholder="Why this appeal matters to you, what supporters will help fund, and what progress you want to share."
          defaultValue={initialValues?.story ?? ""}
        />
      </Field>

      <div className="rounded-[1rem] bg-[color:var(--color-sand)] px-4 py-3 text-sm leading-6 text-[color:var(--color-ink-soft)]">
        New pages are submitted for moderation before they go live publicly. Use clear fundraising copy, accurate imagery, and a short name you are happy to share publicly. The cover image appears at the top of the public fundraiser page.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
        <Link href={cancelHref} className="btn-outline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="mb-2 block text-sm font-semibold text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}
