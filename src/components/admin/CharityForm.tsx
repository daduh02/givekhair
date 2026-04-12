import Link from "next/link";

type CharityValue = {
  name?: string;
  slug?: string;
  charityNumber?: string;
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  logoUrl?: string;
  websiteUrl?: string;
  shortDescription?: string;
  fullDescription?: string;
  contactEmail?: string;
  defaultCurrency?: string;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
};

export function CharityForm({
  action,
  errorMessage,
  submitLabel,
  cancelHref,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  errorMessage?: string;
  submitLabel: string;
  cancelHref: string;
  initialValues?: CharityValue;
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
        <Field label="Charity name">
          <input name="name" required className="input" defaultValue={initialValues?.name ?? ""} />
        </Field>

        <Field label="Slug">
          <input name="slug" required className="input" defaultValue={initialValues?.slug ?? ""} />
        </Field>

        <Field label="Charity number">
          <input name="charityNumber" className="input" defaultValue={initialValues?.charityNumber ?? ""} />
        </Field>

        <Field label="Verification status">
          <select name="verificationStatus" className="input" defaultValue={initialValues?.verificationStatus ?? "PENDING"}>
            <option value="UNVERIFIED">Unverified</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </Field>

        <Field label="Logo URL">
          <input name="logoUrl" className="input" defaultValue={initialValues?.logoUrl ?? ""} />
        </Field>

        <Field label="Website URL">
          <input name="websiteUrl" className="input" defaultValue={initialValues?.websiteUrl ?? ""} />
        </Field>

        <Field label="Contact email">
          <input name="contactEmail" type="email" className="input" defaultValue={initialValues?.contactEmail ?? ""} />
        </Field>

        <Field label="Default currency">
          <input name="defaultCurrency" className="input" maxLength={3} defaultValue={initialValues?.defaultCurrency ?? "GBP"} />
        </Field>

        <Field label="Status">
          <select name="status" className="input" defaultValue={initialValues?.status ?? "ACTIVE"}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Short description">
          <textarea
            name="shortDescription"
            className="input"
            rows={3}
            style={{ resize: "vertical" }}
            defaultValue={initialValues?.shortDescription ?? ""}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Full description">
          <textarea
            name="fullDescription"
            className="input"
            rows={6}
            style={{ resize: "vertical" }}
            defaultValue={initialValues?.fullDescription ?? ""}
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
