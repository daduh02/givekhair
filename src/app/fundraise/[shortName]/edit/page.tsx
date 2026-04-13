import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseOptionalString, revalidateAdminSurfaces, slugify } from "@/lib/admin-management";
import { FundraisingPageForm } from "@/components/fundraise/FundraisingPageForm";

interface Props {
  params: { shortName: string };
  searchParams: { error?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await db.fundraisingPage.findUnique({
    where: { shortName: params.shortName },
    select: { title: true },
  });

  return { title: page ? `Edit ${page.title}` : "Edit fundraiser page" };
}

export default async function EditFundraisingPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/fundraise/${params.shortName}/edit`)}`);
  }

  const currentUser = session.user as { id?: string; role?: string } | undefined;
  if (!currentUser?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/fundraise/${params.shortName}/edit`)}`);
  }

  const page = await db.fundraisingPage.findUnique({
    where: { shortName: params.shortName },
    include: {
      appeal: {
        include: { charity: true },
      },
    },
  });

  if (!page) {
    notFound();
  }

  const isPlatformAdmin = currentUser.role === "PLATFORM_ADMIN";
  if (page.userId !== currentUser.id && !isPlatformAdmin) {
    redirect("/403");
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

  async function updateFundraisingPage(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as { id?: string; role?: string } | undefined;
    if (!user?.id) {
      redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/fundraise/${params.shortName}/edit`)}`);
    }

    const existingPage = await db.fundraisingPage.findUnique({
      where: { shortName: params.shortName },
      select: { id: true, userId: true, shortName: true },
    });

    if (!existingPage) {
      notFound();
    }

    if (existingPage.userId !== user.id && user.role !== "PLATFORM_ADMIN") {
      redirect("/403");
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
      redirect(`/fundraise/${params.shortName}/edit?error=invalid`);
    }

    const appeal = await db.appeal.findUnique({ where: { id: appealId }, select: { id: true } });
    if (!appeal) {
      redirect(`/fundraise/${params.shortName}/edit?error=appeal`);
    }

    if (selectedTeamId) {
      const team = await db.team.findUnique({ where: { id: selectedTeamId }, select: { id: true, appealId: true } });
      if (!team || team.appealId !== appealId) {
        redirect(`/fundraise/${params.shortName}/edit?error=team`);
      }
    }

    const conflicting = await db.fundraisingPage.findUnique({
      where: { shortName },
      select: { id: true },
    });

    if (conflicting && conflicting.id !== existingPage.id) {
      redirect(`/fundraise/${params.shortName}/edit?error=slug`);
    }

    const updated = await db.fundraisingPage.update({
      where: { id: existingPage.id },
      data: {
        appealId,
        teamId: selectedTeamId,
        title,
        shortName,
        story,
        targetAmount: targetAmount ?? null,
        currency,
        coverImageUrl,
      },
    });

    revalidateAdminSurfaces([
      `/fundraise/${params.shortName}`,
      `/fundraise/${updated.shortName}`,
      "/dashboard",
    ]);
    redirect(`/fundraise/${updated.shortName}`);
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
              Edit fundraiser page
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "#3A4A42" }}>
              Update your page story, target, and routing details while keeping the same donation experience for supporters.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href={`/fundraise/${page.shortName}`} className="btn-outline" style={{ padding: "0.7rem 1.1rem" }}>
              View page
            </Link>
            <Link href="/dashboard" className="btn-outline" style={{ padding: "0.7rem 1.1rem" }}>
              Back to dashboard
            </Link>
          </div>
        </div>

        <FundraisingPageForm
          action={updateFundraisingPage}
          appeals={appeals.map((appeal) => ({
            id: appeal.id,
            title: appeal.title,
            charityName: appeal.charity.name,
          }))}
          teams={teams}
          submitLabel="Save fundraiser page"
          cancelHref={`/fundraise/${page.shortName}`}
          errorMessage={errorMessage}
          intro={`You are editing ${page.title}. Changes update the live public page once saved.`}
          initialValues={{
            appealId: page.appealId,
            teamId: page.teamId ?? "",
            title: page.title,
            shortName: page.shortName,
            story: page.story ?? "",
            targetAmount: page.targetAmount?.toString() ?? "",
            currency: page.currency,
            coverImageUrl: page.coverImageUrl ?? "",
          }}
        />
      </main>
    </div>
  );
}
