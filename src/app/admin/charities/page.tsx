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

export const metadata: Metadata = { title: "Admin - Charities" };

async function createCharity(formData: FormData) {
  "use server";

  const { role, userId, managedCharity } = await getAdminContext();
  if (role !== "PLATFORM_ADMIN" && !managedCharity) {
    redirect("/admin");
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

  if (role !== "PLATFORM_ADMIN") {
    redirect("/admin/charities");
  }

  if (!name || !slug) {
    redirect("/admin/charities?error=invalid");
  }

  const existing = await db.charity.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    redirect("/admin/charities?error=slug");
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

  revalidateAdminSurfaces([`/admin/charities/${charity.id}`]);
  redirect(`/admin/charities/${charity.id}`);
}

export default async function CharitiesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { role, managedCharity } = await getAdminContext();

  const charities = await db.charity.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { appeals: true, admins: true } },
    },
  });

  const errorMessage =
    searchParams.error === "slug"
      ? "That charity slug is already in use."
      : searchParams.error === "invalid"
        ? "Please fill in the charity name and slug."
        : "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Charities</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Create, review, and update charity profiles linked to appeals and admins.
          </p>
        </div>
        {managedCharity ? (
          <Link href={`/admin/charities/${managedCharity.id}`} className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Open current charity
          </Link>
        ) : null}
      </div>

      <div style={{ background: "white", borderRadius: "1rem", boxShadow: "0 2px 12px rgba(18,78,64,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#F6F1E8" }}>
              {["Charity", "Status", "Verification", "Currency", "Appeals", "Admins", "Actions"].map((heading) => (
                <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#8A9E94" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {charities.map((charity, index) => (
              <tr key={charity.id} style={{ borderTop: index > 0 ? "1px solid rgba(18,78,64,0.06)" : "none" }}>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <div className="font-semibold" style={{ color: "#233029" }}>{charity.name}</div>
                  <div className="text-xs" style={{ color: "#8A9E94" }}>{charity.contactEmail ?? charity.slug}</div>
                </td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.status}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.verificationStatus}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity.defaultCurrency}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity._count.appeals}</td>
                <td style={{ padding: "0.9rem 1rem", color: "#3A4A42" }}>{charity._count.admins}</td>
                <td style={{ padding: "0.9rem 1rem" }}>
                  <Link href={`/admin/charities/${charity.id}`} className="btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {role === "PLATFORM_ADMIN" ? (
        <div>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#233029" }}>Create charity</h2>
          <CharityForm
            action={createCharity}
            errorMessage={errorMessage}
            submitLabel="Create charity"
            cancelHref="/admin"
            initialValues={{ defaultCurrency: "GBP", verificationStatus: "PENDING", status: "ACTIVE" }}
          />
        </div>
      ) : null}
    </div>
  );
}
