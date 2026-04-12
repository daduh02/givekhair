import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAdminContext } from "@/lib/admin";
import { AppealForm } from "@/components/admin/AppealForm";

export const metadata: Metadata = { title: "Admin - Edit Appeal" };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toDateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditAppealPage({
  params,
  searchParams,
}: {
  params: { appealId: string };
  searchParams: { error?: string };
}) {
  const { managedCharity } = await getAdminContext();

  if (!managedCharity) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>
          Edit appeal
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>
          A charity must be assigned to this admin account before appeals can be edited.
        </p>
      </div>
    );
  }

  const [categories, appeal] = await Promise.all([
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.appeal.findFirst({
      where: { id: params.appealId, charityId: managedCharity.id },
    }),
  ]);

  if (!appeal) {
    redirect("/admin/appeals");
  }

  async function updateAppeal(formData: FormData) {
    "use server";

    const { managedCharity: latestManagedCharity } = await getAdminContext();
    if (!latestManagedCharity) {
      redirect("/admin/appeals");
    }

    const existingAppeal = await db.appeal.findFirst({
      where: { id: params.appealId, charityId: latestManagedCharity.id },
      select: { id: true, slug: true },
    });

    if (!existingAppeal) {
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
      redirect(`/admin/appeals/${params.appealId}?error=invalid`);
    }

    const duplicate = await db.appeal.findFirst({
      where: {
        slug,
        NOT: { id: params.appealId },
      },
      select: { id: true },
    });

    if (duplicate) {
      redirect(`/admin/appeals/${params.appealId}?error=slug`);
    }

    await db.appeal.update({
      where: { id: params.appealId },
      data: {
        categoryId: categoryId || null,
        title,
        slug,
        story: story || null,
        goalAmount,
        currency,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        visibility,
        status,
        bannerUrl: bannerUrl || null,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/appeals");
    revalidatePath(`/admin/appeals/${params.appealId}`);
    revalidatePath("/");
    revalidatePath(`/appeals/${existingAppeal.slug}`);
    revalidatePath(`/appeals/${slug}`);
    redirect("/admin/appeals");
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
          <h1 className="text-xl font-bold" style={{ color: "#233029" }}>
            Edit appeal
          </h1>
          <p className="text-sm" style={{ color: "#8A9E94" }}>
            Update campaign details for {appeal.title}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/appeals/${appeal.slug}`}
            className="btn-outline"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          >
            View public page
          </Link>
          <Link
            href="/admin/appeals"
            className="btn-outline"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          >
            Back to appeals
          </Link>
        </div>
      </div>

      <AppealForm
        action={updateAppeal}
        errorMessage={errorMessage}
        categories={categories}
        submitLabel="Save changes"
        cancelHref="/admin/appeals"
        initialValues={{
          title: appeal.title,
          slug: appeal.slug,
          goalAmount: appeal.goalAmount.toString(),
          currency: appeal.currency,
          categoryId: appeal.categoryId ?? "",
          bannerUrl: appeal.bannerUrl ?? "",
          startsAt: toDateInput(appeal.startsAt),
          endsAt: toDateInput(appeal.endsAt),
          status: appeal.status,
          visibility: appeal.visibility,
          story: appeal.story ?? "",
        }}
      />
    </div>
  );
}
