import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CharityForm } from "@/components/admin/CharityForm";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import {
  parseOptionalString,
  revalidateAdminSurfaces,
  slugify,
  upsertModerationItem,
} from "@/lib/admin-management";

export const metadata: Metadata = { title: "Admin - Create Charity" };

export default async function NewCharityPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { role } = await getAdminContext();
  if (role !== "PLATFORM_ADMIN") {
    redirect("/admin/charities");
  }

  async function createCharity(formData: FormData) {
    "use server";

    const { role: currentRole, userId } = await getAdminContext();
    if (currentRole !== "PLATFORM_ADMIN") {
      redirect("/admin/charities");
    }

    const name = String(formData.get("name") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const slug = slugify(slugInput || name);
    const charityNumber = parseOptionalString(formData.get("charityNumber"));
    const verificationStatus = String(formData.get("verificationStatus") ?? "PENDING").trim() as
      | "UNVERIFIED"
      | "PENDING"
      | "VERIFIED"
      | "REJECTED";
    const logoUrl = parseOptionalString(formData.get("logoUrl"));
    const websiteUrl = parseOptionalString(formData.get("websiteUrl"));
    const shortDescription = parseOptionalString(formData.get("shortDescription"));
    const fullDescription = parseOptionalString(formData.get("fullDescription"));
    const contactEmail = parseOptionalString(formData.get("contactEmail"));
    const defaultCurrency = String(formData.get("defaultCurrency") ?? "GBP").trim().toUpperCase();
    const status = String(formData.get("status") ?? "ACTIVE").trim() as "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

    if (!name || !slug) {
      redirect("/admin/charities/new?error=invalid");
    }

    const existing = await db.charity.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      redirect("/admin/charities/new?error=slug");
    }

    const charity = await db.charity.create({
      data: {
        name,
        slug,
        charityNumber,
        registrationNo: charityNumber,
        verificationStatus,
        logoUrl,
        websiteUrl,
        shortDescription,
        fullDescription,
        description: fullDescription ?? shortDescription,
        contactEmail,
        defaultCurrency,
        status,
        isVerified: verificationStatus === "VERIFIED",
        isActive: status === "ACTIVE",
      },
    });

    await upsertModerationItem({
      entityType: "CHARITY",
      entityId: charity.id,
      charityId: charity.id,
      title: `Charity setup submitted: ${charity.name}`,
      summary: shortDescription ?? fullDescription ?? null,
      status: "PENDING",
      submittedById: userId,
    });

    revalidateAdminSurfaces([`/admin/charities/${charity.id}`, "/admin"]);
    redirect(`/admin/charities/${charity.id}`);
  }

  const errorMessage =
    searchParams.error === "slug"
      ? "That charity slug is already in use."
      : searchParams.error === "invalid"
        ? "Please fill in the charity name and slug."
        : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Create charity</h1>
        <p className="text-sm" style={{ color: "#8A9E94" }}>
          Add a new charity profile before linking appeals, admins, and reporting flows.
        </p>
      </div>

      <CharityForm
        action={createCharity}
        errorMessage={errorMessage}
        submitLabel="Create charity"
        cancelHref="/admin/charities"
        initialValues={{ defaultCurrency: "GBP", verificationStatus: "PENDING", status: "ACTIVE" }}
      />
    </div>
  );
}
