import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { AppealForm } from "@/components/admin/AppealForm";
import {
  parseMediaGallery,
  parseOptionalString,
  revalidateAdminSurfaces,
  slugify,
  upsertModerationItem,
} from "@/lib/admin-management";

export const metadata: Metadata = { title: "Admin - New Appeal" };

async function createAppeal(formData: FormData) {
  "use server";

  const { managedCharity, role, userId } = await getAdminContext();
  if (!managedCharity && role !== "PLATFORM_ADMIN") {
    redirect("/admin/appeals");
  }

  const title = String(formData.get("title") ?? "").trim();
  const goalAmount = Number(formData.get("goalAmount") ?? 0);
  const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
  const charityIdInput = String(formData.get("charityId") ?? "").trim();
  const categoryId = parseOptionalString(formData.get("categoryId"));
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "PUBLIC").trim() as "PUBLIC" | "UNLISTED" | "HIDDEN";
  const status = String(formData.get("status") ?? "DRAFT").trim() as "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  const bannerUrl = parseOptionalString(formData.get("bannerUrl"));
  const story = parseOptionalString(formData.get("story"));
  const impact = parseOptionalString(formData.get("impact"));
  const mediaGallery = parseMediaGallery(String(formData.get("mediaGallery") ?? ""));
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || title);
  const charityId = role === "PLATFORM_ADMIN" ? charityIdInput : managedCharity?.id;

  if (!title || !slug || !charityId || !Number.isFinite(goalAmount) || goalAmount <= 0) {
    redirect("/admin/appeals/new?error=invalid");
  }

  const existing = await db.appeal.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    redirect("/admin/appeals/new?error=slug");
  }

  const created = await db.appeal.create({
    data: {
      charityId,
      categoryId: categoryId ?? undefined,
      title,
      slug,
      story: story ?? undefined,
      impact: impact ?? undefined,
      goalAmount,
      currency,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : undefined,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : undefined,
      visibility,
      status,
      bannerUrl: bannerUrl ?? undefined,
      mediaGallery,
    },
  });

  await upsertModerationItem({
    entityType: "APPEAL",
    entityId: created.id,
    charityId: created.charityId,
    appealId: created.id,
    title: `Appeal submitted: ${created.title}`,
    summary: impact ?? story ?? null,
    status: "PENDING",
    submittedById: userId,
  });

  revalidateAdminSurfaces([`/admin/appeals/${created.id}`, `/appeals/${created.slug}`]);
  redirect("/admin/appeals");
}

export default async function NewAppealPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { managedCharity, role } = await getAdminContext();

  const [categories, charities] = await Promise.all([
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    role === "PLATFORM_ADMIN"
      ? db.charity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  if (!managedCharity && role !== "PLATFORM_ADMIN") {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>New appeal</h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>
          A charity must be assigned to this admin account before appeals can be created.
        </p>
      </div>
    );
  }

  const errorMessage =
    searchParams.error === "slug"
      ? "That slug is already in use. Try a different one."
      : searchParams.error === "invalid"
        ? "Please fill in a title and a valid goal amount."
        : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>Create new appeal</h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Launch a new campaign for {managedCharity?.name ?? "the selected charity"}.
          </p>
        </div>
        <Link href="/admin/appeals" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          Back to appeals
        </Link>
      </div>

      <AppealForm
        action={createAppeal}
        errorMessage={errorMessage}
        categories={categories}
        charities={charities}
        showCharitySelect={role === "PLATFORM_ADMIN"}
        submitLabel="Create appeal"
        cancelHref="/admin/appeals"
        initialValues={{
          charityId: managedCharity?.id ?? "",
          currency: managedCharity?.defaultCurrency ?? "GBP",
          status: "DRAFT",
          visibility: "PUBLIC",
        }}
      />
    </div>
  );
}
