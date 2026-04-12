import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { AppealForm } from "@/components/admin/AppealForm";

export const metadata: Metadata = { title: "Admin - New Appeal" };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function createAppeal(formData: FormData) {
  "use server";

  const { managedCharity } = await getAdminContext();
  if (!managedCharity) {
    redirect("/admin/appeals");
  }

  const title = String(formData.get("title") ?? "").trim();
  const story = String(formData.get("story") ?? "").trim();
  const goalAmount = Number(formData.get("goalAmount") ?? 0);
  const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "PUBLIC").trim() as "PUBLIC" | "UNLISTED" | "HIDDEN";
  const status = String(formData.get("status") ?? "DRAFT").trim() as "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  const bannerUrl = String(formData.get("bannerUrl") ?? "").trim() || null;
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || title);

  if (!title || !slug || !Number.isFinite(goalAmount) || goalAmount <= 0) {
    redirect("/admin/appeals/new?error=invalid");
  }

  const existing = await db.appeal.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    redirect("/admin/appeals/new?error=slug");
  }

  await db.appeal.create({
    data: {
      charityId: managedCharity.id,
      categoryId: categoryId ?? undefined,
      title,
      slug,
      story: story || undefined,
      goalAmount,
      currency,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : undefined,
      endsAt: endsAtRaw ? new Date(endsAtRaw) : undefined,
      visibility,
      status,
      bannerUrl: bannerUrl ?? undefined,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/appeals");
  revalidatePath("/");
  redirect("/admin/appeals");
}

export default async function NewAppealPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const { managedCharity } = await getAdminContext();

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (!managedCharity) {
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
            Launch a new campaign for {managedCharity.name}.
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
        submitLabel="Create appeal"
        cancelHref="/admin/appeals"
        initialValues={{ currency: "GBP", status: "DRAFT", visibility: "PUBLIC" }}
      />
    </div>
  );
}
