import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { CharityForm } from "@/components/admin/CharityForm";
import {
  parseOptionalString,
  revalidateAdminSurfaces,
  slugify,
  upsertModerationItem,
} from "@/lib/admin-management";

export const metadata: Metadata = { title: "Admin - Edit Charity" };

export default async function EditCharityPage({
  params,
  searchParams,
}: {
  params: { charityId: string };
  searchParams: { error?: string };
}) {
  const { role, managedCharity } = await getAdminContext();

  const charity = await db.charity.findFirst({
    where: {
      id: params.charityId,
      ...(role === "PLATFORM_ADMIN" ? {} : { id: managedCharity?.id }),
    },
  });

  if (!charity) {
    redirect("/admin/charities");
  }

  async function updateCharity(formData: FormData) {
    "use server";

    const { role: currentRole, userId: currentUserId, managedCharity: currentManagedCharity } = await getAdminContext();

    const editableCharity = await db.charity.findFirst({
      where: {
        id: params.charityId,
        ...(currentRole === "PLATFORM_ADMIN" ? {} : { id: currentManagedCharity?.id }),
      },
      select: { id: true },
    });

    if (!editableCharity) {
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
      redirect(`/admin/charities/${params.charityId}/edit?error=invalid`);
    }

    const duplicate = await db.charity.findFirst({
      where: {
        slug,
        NOT: { id: params.charityId },
      },
      select: { id: true },
    });

    if (duplicate) {
      redirect(`/admin/charities/${params.charityId}/edit?error=slug`);
    }

    const updated = await db.charity.update({
      where: { id: params.charityId },
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
      entityId: updated.id,
      charityId: updated.id,
      title: `Charity update submitted: ${updated.name}`,
      summary: shortDescription ?? fullDescription ?? null,
      status: "PENDING",
      submittedById: currentUserId,
    });

    revalidateAdminSurfaces([`/admin/charities/${updated.id}`, "/admin", "/admin/charities"]);
    redirect(`/admin/charities/${updated.id}`);
  }

  const errorMessage =
    searchParams.error === "slug"
      ? "That charity slug is already in use."
      : searchParams.error === "invalid"
        ? "Please fill in the charity name and slug."
        : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Edit {charity.name}</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Update profile, verification, contact details, and operating status.
          </p>
        </div>
        <Link href={`/admin/charities/${charity.id}`} className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          Back to overview
        </Link>
      </div>

      <CharityForm
        action={updateCharity}
        errorMessage={errorMessage}
        submitLabel="Save charity"
        cancelHref={`/admin/charities/${charity.id}`}
        initialValues={{
          name: charity.name,
          slug: charity.slug,
          charityNumber: charity.charityNumber ?? charity.registrationNo ?? "",
          verificationStatus: charity.verificationStatus,
          logoUrl: charity.logoUrl ?? "",
          websiteUrl: charity.websiteUrl ?? "",
          shortDescription: charity.shortDescription ?? "",
          fullDescription: charity.fullDescription ?? charity.description ?? "",
          contactEmail: charity.contactEmail ?? "",
          defaultCurrency: charity.defaultCurrency,
          status: charity.status,
        }}
      />
    </div>
  );
}
