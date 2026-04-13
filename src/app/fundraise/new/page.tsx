import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseOptionalString, revalidateAdminSurfaces, slugify, upsertModerationItem } from "@/lib/admin-management";
import { FundraisingPageForm } from "@/components/fundraise/FundraisingPageForm";

export const metadata: Metadata = { title: "Create fundraiser page" };

export default async function NewFundraisingPage({
  searchParams,
}: {
  searchParams: { error?: string; appealId?: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=%2Ffundraise%2Fnew");
  }

  const currentUser = session.user as { id?: string } | undefined;
  if (!currentUser?.id) {
    redirect("/auth/signin?callbackUrl=%2Ffundraise%2Fnew");
  }

  const [appeals, teams] = await Promise.all([
    db.appeal.findMany({
      where: { status: "ACTIVE", visibility: { in: ["PUBLIC", "UNLISTED"] } },
      select: {
        id: true,
        title: true,
        charity: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.team.findMany({
      where: { status: "ACTIVE", visibility: { in: ["PUBLIC", "UNLISTED"] } },
      select: { id: true, name: true, appealId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  async function createFundraisingPage(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as { id?: string } | undefined;
    if (!user?.id) {
      redirect("/auth/signin?callbackUrl=%2Ffundraise%2Fnew");
    }

    const appealId = String(formData.get("appealId") ?? "").trim();
    const selectedTeamId = parseOptionalString(formData.get("teamId"));
    const title = String(formData.get("title") ?? "").trim();
    const submittedShortName = String(formData.get("shortName") ?? "").trim();
    const shortName = slugify(submittedShortName);
    const story = parseOptionalString(formData.get("story"));
    const targetAmountRaw = String(formData.get("targetAmount") ?? "").trim();
    const targetAmount = targetAmountRaw ? Number(targetAmountRaw) : null;
    const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
    const coverImageUrl = parseOptionalString(formData.get("coverImageUrl"));

    if (!appealId || title.length < 5 || shortName.length < 3 || (targetAmountRaw && (!Number.isFinite(targetAmount) || (targetAmount ?? 0) <= 0))) {
      redirect(`/fundraise/new?error=invalid&appealId=${encodeURIComponent(appealId)}`);
    }

    const appeal = await db.appeal.findUnique({
      where: { id: appealId },
      include: { charity: true },
    });

    if (!appeal) {
      redirect("/fundraise/new?error=appeal");
    }

    if (selectedTeamId) {
      const team = await db.team.findUnique({ where: { id: selectedTeamId }, select: { id: true, appealId: true } });
      if (!team || team.appealId !== appealId) {
        redirect(`/fundraise/new?error=team&appealId=${encodeURIComponent(appealId)}`);
      }
    }

    const existing = await db.fundraisingPage.findUnique({ where: { shortName }, select: { id: true } });
    if (existing) {
      redirect(`/fundraise/new?error=slug&appealId=${encodeURIComponent(appealId)}`);
    }

    const page = await db.fundraisingPage.create({
      data: {
        userId: user.id,
        appealId,
        teamId: selectedTeamId,
        title,
        shortName,
        story,
        targetAmount: targetAmount ?? undefined,
        currency,
        coverImageUrl,
        status: "PENDING_APPROVAL",
        visibility: "UNLISTED",
      },
    });

    await upsertModerationItem({
      entityType: "FUNDRAISING_PAGE",
      entityId: page.id,
      charityId: appeal.charityId,
      appealId: appeal.id,
      teamId: page.teamId,
      pageId: page.id,
      title: `New fundraiser page: ${page.title}`,
      summary: page.story ?? "Awaiting moderation review.",
      status: "PENDING",
      submittedById: user.id,
    });

    revalidateAdminSurfaces([`/fundraise/${page.shortName}`, "/dashboard"]);
    redirect(`/fundraise/${page.shortName}`);
  }

  const errorMessage =
    searchParams.error === "invalid"
      ? "Please choose an appeal, add a valid title and short name, and use a positive target if you set one."
      : searchParams.error === "slug"
        ? "That short name is already in use."
        : searchParams.error === "team"
          ? "That team does not belong to the selected appeal."
          : searchParams.error === "appeal"
            ? "That appeal could not be found."
            : "";

  return (
    <div style={{ minHeight: "100vh", background: "#F8F5EF" }}>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "#8A9E94" }}>
              Fundraiser tools
            </p>
            <h1 className="mt-2 text-3xl font-bold" style={{ color: "#233029" }}>
              Create your fundraiser page
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "#3A4A42" }}>
              Build a public page linked to an appeal, tell your story clearly, and collect donations through the hosted GiveKhair flow.
            </p>
          </div>
          <Link href="/dashboard" className="btn-outline" style={{ padding: "0.7rem 1.1rem" }}>
            Back to dashboard
          </Link>
        </div>

        <FundraisingPageForm
          action={createFundraisingPage}
          appeals={appeals.map((appeal) => ({
            id: appeal.id,
            title: appeal.title,
            charityName: appeal.charity.name,
          }))}
          teams={teams}
          submitLabel="Create fundraiser page"
          cancelHref="/dashboard"
          errorMessage={errorMessage}
          intro="Choose the appeal you want to support, add a page title supporters will recognize, and explain why this cause matters to you."
          initialValues={{
            appealId: searchParams.appealId ?? "",
          }}
        />
      </main>
    </div>
  );
}
