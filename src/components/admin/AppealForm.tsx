import Link from "next/link";

type AppealFormValue = {
  title?: string;
  slug?: string;
  goalAmount?: string;
  currency?: string;
  charityId?: string;
  categoryId?: string;
  bannerUrl?: string;
  startsAt?: string;
  endsAt?: string;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  visibility?: "PUBLIC" | "UNLISTED" | "HIDDEN";
  story?: string;
  impact?: string;
  mediaGallery?: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type CharityOption = {
  id: string;
  name: string;
};

export function AppealForm({
  action,
  errorMessage,
  categories,
  charities,
  showCharitySelect,
  submitLabel,
  cancelHref,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  errorMessage?: string;
  categories: CategoryOption[];
  charities?: CharityOption[];
  showCharitySelect?: boolean;
  submitLabel: string;
  cancelHref: string;
  initialValues?: AppealFormValue;
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
    >
      {errorMessage ? (
        <div
          style={{
            marginBottom: "1rem",
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
        {showCharitySelect ? (
          <Field label="Charity">
            <select name="charityId" className="input" defaultValue={initialValues?.charityId ?? ""} required>
              <option value="">Select charity</option>
              {charities?.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Appeal title">
          <input
            name="title"
            required
            className="input"
            placeholder="Gaza emergency medical aid"
            defaultValue={initialValues?.title ?? ""}
          />
        </Field>

        <Field label="Slug">
          <input
            name="slug"
            className="input"
            placeholder="auto-generated-from-title"
            defaultValue={initialValues?.slug ?? ""}
          />
        </Field>

        <Field label="Goal amount">
          <input
            name="goalAmount"
            type="number"
            min="1"
            step="0.01"
            required
            className="input"
            placeholder="100000"
            defaultValue={initialValues?.goalAmount ?? ""}
          />
        </Field>

        <Field label="Currency">
          <input
            name="currency"
            defaultValue={initialValues?.currency ?? "GBP"}
            className="input"
            maxLength={3}
          />
        </Field>

        <Field label="Category">
          <select name="categoryId" className="input" defaultValue={initialValues?.categoryId ?? ""}>
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Banner image URL">
          <input
            name="bannerUrl"
            className="input"
            placeholder="https://..."
            defaultValue={initialValues?.bannerUrl ?? ""}
          />
        </Field>

        <Field label="Starts at">
          <input name="startsAt" type="date" className="input" defaultValue={initialValues?.startsAt ?? ""} />
        </Field>

        <Field label="Ends at">
          <input name="endsAt" type="date" className="input" defaultValue={initialValues?.endsAt ?? ""} />
        </Field>

        <Field label="Status">
          <select name="status" className="input" defaultValue={initialValues?.status ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ENDED">Ended</option>
          </select>
        </Field>

        <Field label="Visibility">
          <select name="visibility" className="input" defaultValue={initialValues?.visibility ?? "PUBLIC"}>
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Story">
          <textarea
            name="story"
            className="input"
            rows={8}
            placeholder="Explain the need, the impact, and why supporters should care."
            style={{ resize: "vertical" }}
            defaultValue={initialValues?.story ?? ""}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Impact">
          <textarea
            name="impact"
            className="input"
            rows={4}
            placeholder="Describe what the appeal will deliver and the outcome supporters help create."
            style={{ resize: "vertical" }}
            defaultValue={initialValues?.impact ?? ""}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Media gallery URLs">
          <textarea
            name="mediaGallery"
            className="input"
            rows={4}
            placeholder={"https://...\nhttps://..."}
            style={{ resize: "vertical" }}
            defaultValue={initialValues?.mediaGallery ?? ""}
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
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
      <span className="block text-sm font-medium mb-2" style={{ color: "#3A4A42" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
