import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  parseOptionalString,
  revalidateAdminSurfaces,
  slugify,
  upsertModerationItem,
} from "@/lib/admin-management";
import {
  decimalToNumber,
  formatCurrency,
  formatDate,
  getFundraiserStateSummary,
  getGoalProgress,
  getStateToneStyles,
} from "@/lib/fundraiser-management";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FundraisingPageForm } from "@/components/fundraise/FundraisingPageForm";

interface Props {
  params: { shortName: string };
  searchParams: { error?: string };
}

type SessionUser = { id?: string; role?: string } | undefined;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await db.fundraisingPage.findUnique({
    where: { shortName: params.shortName },
    select: { title: true },
  });

  return { title: page ? `Manage ${page.title}` : "Manage fundraiser page" };
}

/*
  Owner-side fundraiser management has multiple server actions on one screen.
  This shared loader keeps permission checks and relation loading aligned so each
  action does not reimplement its own slightly different access logic.
*/
async function getAuthorizedPage(shortName: string, user: SessionUser) {
  if (!user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/fundraise/${shortName}/edit`)}`);
  }

  const page = await db.fundraisingPage.findUnique({
    where: { shortName },
    include: {
      appeal: {
        include: { charity: true },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      mediaItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      moderationItems: {
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!page) {
    notFound();
  }

  const isPlatformAdmin = user.role === "PLATFORM_ADMIN";
  if (page.userId !== user.id && !isPlatformAdmin) {
    redirect("/403");
  }

  return page;
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

export default async function EditFundraisingPage({ params, searchParams }: Props) {
  const session = await auth();
  const currentUser = session?.user as SessionUser;
  const page = await getAuthorizedPage(params.shortName, currentUser);

  const [appeals, teams, onlineAgg, offlineAgg, recentOnlineCount] = await Promise.all([
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
    db.donation.aggregate({
      where: { pageId: page.id, status: "CAPTURED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.offlineDonation.aggregate({
      where: { pageId: page.id, status: "APPROVED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.donation.count({
      where: {
        pageId: page.id,
        status: "CAPTURED",
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
      },
    }),
  ]);

  const moderationNote = page.moderationItems[0]?.reviewNotes ?? null;
  const stateSummary = getFundraiserStateSummary({
    status: page.status,
    visibility: page.visibility,
    reviewNotes: moderationNote,
  });
  const toneStyles = getStateToneStyles(stateSummary.tone);

  const onlineRaised = decimalToNumber(onlineAgg._sum.amount);
  const offlineRaised = decimalToNumber(offlineAgg._sum.amount);
  const totalRaised = onlineRaised + offlineRaised;
  const donorCount = onlineAgg._count + offlineAgg._count;
  const targetAmount = decimalToNumber(page.targetAmount);
  const progress = getGoalProgress(totalRaised, targetAmount);

  async function updateFundraisingPage(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as SessionUser;
    const existingPage = await getAuthorizedPage(params.shortName, user);

    const appealId = String(formData.get("appealId") ?? "").trim();
    const selectedTeamId = parseOptionalString(formData.get("teamId"));
    const title = String(formData.get("title") ?? "").trim();
    const submittedShortName = String(formData.get("shortName") ?? "").trim();
    const shortName = slugify(submittedShortName);
    const story = parseOptionalString(formData.get("story"));
    const targetAmountRaw = String(formData.get("targetAmount") ?? "").trim();
    const parsedTargetAmount = targetAmountRaw ? Number(targetAmountRaw) : null;
    const currency = String(formData.get("currency") ?? "GBP").trim().toUpperCase();
    const coverImageUrl = parseOptionalString(formData.get("coverImageUrl"));

    if (
      !appealId ||
      title.length < 5 ||
      shortName.length < 3 ||
      (targetAmountRaw && (!Number.isFinite(parsedTargetAmount) || (parsedTargetAmount ?? 0) <= 0))
    ) {
      redirect(`/fundraise/${params.shortName}/edit?error=invalid`);
    }

    const appeal = await db.appeal.findUnique({ where: { id: appealId }, select: { id: true } });
    if (!appeal) {
      redirect(`/fundraise/${params.shortName}/edit?error=appeal`);
    }

    if (selectedTeamId) {
      const team = await db.team.findUnique({
        where: { id: selectedTeamId },
        select: { id: true, appealId: true },
      });

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

    const shouldResubmitForReview = existingPage.status === "REJECTED";

    const updated = await db.fundraisingPage.update({
      where: { id: existingPage.id },
      data: {
        appealId,
        teamId: selectedTeamId,
        title,
        shortName,
        story,
        targetAmount: parsedTargetAmount ?? null,
        currency,
        coverImageUrl,
        status: shouldResubmitForReview ? "PENDING_APPROVAL" : undefined,
      },
    });

    if (shouldResubmitForReview) {
      await upsertModerationItem({
        entityType: "FUNDRAISING_PAGE",
        entityId: updated.id,
        pageId: updated.id,
        appealId,
        charityId: existingPage.appeal.charityId,
        title: `Fundraiser page review: ${updated.title}`,
        summary: "Fundraiser owner updated the page and requested a fresh moderation review.",
        status: "PENDING",
        submittedById: user?.id ?? null,
      });
    }

    revalidateAdminSurfaces([
      `/fundraise/${params.shortName}`,
      `/fundraise/${updated.shortName}`,
      `/fundraise/${updated.shortName}/edit`,
      "/dashboard",
    ]);

    redirect(`/fundraise/${updated.shortName}/edit`);
  }

  async function addUpdate(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as SessionUser;
    const existingPage = await getAuthorizedPage(params.shortName, user);
    const state = getFundraiserStateSummary({
      status: existingPage.status,
      visibility: existingPage.visibility,
      reviewNotes: existingPage.moderationItems[0]?.reviewNotes ?? null,
    });

    if (!state.canManageContent) {
      redirect(`/fundraise/${params.shortName}/edit?error=locked`);
    }

    const body = String(formData.get("body") ?? "").trim();
    if (body.length < 10) {
      redirect(`/fundraise/${params.shortName}/edit?error=update`);
    }

    await db.pageUpdate.create({
      data: {
        pageId: existingPage.id,
        body,
      },
    });

    revalidateAdminSurfaces([
      `/fundraise/${params.shortName}`,
      `/fundraise/${params.shortName}/edit`,
      "/dashboard",
    ]);

    redirect(`/fundraise/${params.shortName}/edit`);
  }

  async function addMedia(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as SessionUser;
    const existingPage = await getAuthorizedPage(params.shortName, user);
    const state = getFundraiserStateSummary({
      status: existingPage.status,
      visibility: existingPage.visibility,
      reviewNotes: existingPage.moderationItems[0]?.reviewNotes ?? null,
    });

    if (!state.canManageContent) {
      redirect(`/fundraise/${params.shortName}/edit?error=locked`);
    }

    const url = String(formData.get("url") ?? "").trim();
    const type = String(formData.get("type") ?? "image").trim().toLowerCase();

    if (!url) {
      redirect(`/fundraise/${params.shortName}/edit?error=media`);
    }

    try {
      new URL(url);
    } catch {
      redirect(`/fundraise/${params.shortName}/edit?error=media-url`);
    }

    if (!["image", "video"].includes(type)) {
      redirect(`/fundraise/${params.shortName}/edit?error=media`);
    }

    const latestMedia = await db.pageMedia.findFirst({
      where: { pageId: existingPage.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.pageMedia.create({
      data: {
        pageId: existingPage.id,
        url,
        type,
        sortOrder: (latestMedia?.sortOrder ?? -1) + 1,
      },
    });

    revalidateAdminSurfaces([
      `/fundraise/${params.shortName}`,
      `/fundraise/${params.shortName}/edit`,
      "/dashboard",
    ]);

    redirect(`/fundraise/${params.shortName}/edit`);
  }

  async function manageMedia(formData: FormData) {
    "use server";

    const session = await auth();
    const user = session?.user as SessionUser;
    const existingPage = await getAuthorizedPage(params.shortName, user);
    const state = getFundraiserStateSummary({
      status: existingPage.status,
      visibility: existingPage.visibility,
      reviewNotes: existingPage.moderationItems[0]?.reviewNotes ?? null,
    });

    if (!state.canManageContent) {
      redirect(`/fundraise/${params.shortName}/edit?error=locked`);
    }

    const mediaId = String(formData.get("mediaId") ?? "").trim();
    const intent = String(formData.get("intent") ?? "").trim();

    if (!mediaId || !intent) {
      redirect(`/fundraise/${params.shortName}/edit?error=media`);
    }

    const mediaItems = await db.pageMedia.findMany({
      where: { pageId: existingPage.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true },
    });

    const currentIndex = mediaItems.findIndex((item) => item.id === mediaId);
    if (currentIndex === -1) {
      redirect(`/fundraise/${params.shortName}/edit?error=media`);
    }

    if (intent === "remove") {
      await db.pageMedia.delete({ where: { id: mediaId } });
    } else {
      const direction = intent === "move-up" ? -1 : intent === "move-down" ? 1 : 0;
      const swapIndex = currentIndex + direction;

      if (direction === 0 || swapIndex < 0 || swapIndex >= mediaItems.length) {
        redirect(`/fundraise/${params.shortName}/edit`);
      }

      const currentItem = mediaItems[currentIndex];
      const swapItem = mediaItems[swapIndex];

      await db.$transaction([
        db.pageMedia.update({
          where: { id: currentItem.id },
          data: { sortOrder: swapItem.sortOrder },
        }),
        db.pageMedia.update({
          where: { id: swapItem.id },
          data: { sortOrder: currentItem.sortOrder },
        }),
      ]);
    }

    revalidateAdminSurfaces([
      `/fundraise/${params.shortName}`,
      `/fundraise/${params.shortName}/edit`,
      "/dashboard",
    ]);

    redirect(`/fundraise/${params.shortName}/edit`);
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
            : searchParams.error === "update"
              ? "Add a slightly fuller update so supporters get something useful."
              : searchParams.error === "media"
                ? "Please provide a media URL and choose a supported media type."
                : searchParams.error === "media-url"
                  ? "That media URL does not look valid."
                  : searchParams.error === "locked"
                    ? "This fundraiser is locked for owner content changes right now."
                    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#F8F5EF" }}>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "#8A9E94" }}>
              Fundraiser tools
            </p>
            <h1 className="mt-2 text-3xl font-bold" style={{ color: "#233029" }}>
              Manage fundraiser page
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "#3A4A42" }}>
              Keep your story current, add progress updates, and manage the gallery supporters see on your public page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/fundraise/${page.shortName}`} className="btn-outline" style={{ padding: "0.7rem 1.1rem" }}>
              View public page
            </Link>
            <Link href="/dashboard" className="btn-outline" style={{ padding: "0.7rem 1.1rem" }}>
              Back to dashboard
            </Link>
          </div>
        </div>

        <section
          className="surface-card p-6 sm:p-7"
          style={{
            borderColor: toneStyles.borderColor,
            background: toneStyles.background,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{
                  background: toneStyles.badgeBackground,
                  color: toneStyles.badgeColor,
                }}
              >
                {stateSummary.label}
              </span>
              <h2 className="mt-4 text-2xl font-bold" style={{ color: "#233029" }}>
                {stateSummary.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "#3A4A42" }}>
                {stateSummary.description}
              </p>
              {stateSummary.reviewNote ? (
                <div
                  className="mt-4 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "rgba(255,255,255,0.75)", color: "#334155" }}
                >
                  <strong>Review note:</strong> {stateSummary.reviewNote}
                </div>
              ) : null}
            </div>

            <div
              className="rounded-2xl px-4 py-4 text-sm"
              style={{ minWidth: "16rem", background: "rgba(255,255,255,0.72)", color: "#334155" }}
            >
              <p className="font-semibold" style={{ color: "#233029" }}>
                Public route
              </p>
              <p className="mt-2 break-all">/fundraise/{page.shortName}</p>
              <p className="mt-3 text-xs" style={{ color: "#64748B" }}>
                Appeal: {page.appeal.title} · {page.appeal.charity.name}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <AnalyticsCard label="Total raised" value={formatCurrency(totalRaised, page.currency)} subtext="Online and offline combined" />
          <AnalyticsCard label="Online donations" value={formatCurrency(onlineRaised, page.currency)} subtext={`${onlineAgg._count} captured gifts`} />
          <AnalyticsCard label="Offline donations" value={formatCurrency(offlineRaised, page.currency)} subtext={`${offlineAgg._count} approved entries`} />
          <AnalyticsCard label="Supporters" value={`${donorCount}`} subtext="Unique donation records" />
          <AnalyticsCard label="Updates posted" value={`${page.updates.length}`} subtext="Visible on the public page" />
          <AnalyticsCard label="Recent activity" value={`${recentOnlineCount}`} subtext="Online gifts in the last 30 days" />
        </section>

        {targetAmount > 0 ? (
          <section className="surface-card mt-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "#233029" }}>
                  Goal progress
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
                  {formatCurrency(totalRaised, page.currency)} raised of {formatCurrency(targetAmount, page.currency)} target
                </p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#115E59" }}>
                {progress}%
              </p>
            </div>
            <div className="mt-4">
              <ProgressBar value={progress} label={`Target ${formatCurrency(targetAmount, page.currency)}`} />
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-6">
            <FundraisingPageForm
              action={updateFundraisingPage}
              appeals={appeals.map((appeal) => ({
                id: appeal.id,
                title: appeal.title,
                charityName: appeal.charity.name,
              }))}
              teams={teams}
              submitLabel={page.status === "REJECTED" ? "Save and resubmit" : "Save fundraiser page"}
              cancelHref={`/fundraise/${page.shortName}`}
              errorMessage={errorMessage}
              intro={`You are managing ${page.title}. Keep the core story accurate so supporters and reviewers always see the latest version of your fundraiser.`}
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

            <section className="surface-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "#233029" }}>
                    Post an update
                  </h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: "#3A4A42" }}>
                    Share milestones, thank supporters, or explain what has changed. Updates appear on the public fundraiser page in date order.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#8A9E94" }}>
                  {stateSummary.canManageContent ? "Publishing enabled" : "Publishing locked"}
                </span>
              </div>

              <form action={addUpdate} className="mt-5 space-y-4">
                <textarea
                  name="body"
                  rows={5}
                  className="input"
                  style={{ resize: "vertical" }}
                  placeholder="Supporters helped us pass the halfway mark this week. Thank you for sharing the page and keeping the momentum going."
                  disabled={!stateSummary.canManageContent}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "0.7rem 1.15rem" }}
                  disabled={!stateSummary.canManageContent}
                >
                  Publish update
                </button>
              </form>

              <div className="mt-6 space-y-3">
                {page.updates.length > 0 ? (
                  page.updates.map((update) => (
                    <article key={update.id} className="rounded-2xl border px-4 py-4" style={{ borderColor: "rgba(15,23,42,0.08)", background: "#FCFBF7" }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#8A9E94" }}>
                        {formatDate(update.createdAt)}
                      </p>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7" style={{ color: "#3A4A42" }}>
                        {update.body}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)", background: "#FCFBF7", color: "#64748B" }}>
                    No updates published yet. Your first update is a good place to thank supporters or explain what progress has been made.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="surface-card p-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "#233029" }}>
                  Media gallery
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: "#3A4A42" }}>
                  Add image or video URLs that help supporters understand the fundraiser. Use the controls below to reorder or remove entries.
                </p>
              </div>

              <form action={addMedia} className="mt-5 grid gap-3">
                <input
                  name="url"
                  className="input"
                  placeholder="https://..."
                  disabled={!stateSummary.canManageContent}
                />
                <div className="flex flex-wrap gap-3">
                  <select name="type" className="input" defaultValue="image" disabled={!stateSummary.canManageContent}>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: "0.7rem 1.15rem" }}
                    disabled={!stateSummary.canManageContent}
                  >
                    Add media
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-4">
                {page.mediaItems.length > 0 ? (
                  page.mediaItems.map((item, index) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "rgba(15,23,42,0.08)", background: "#FCFBF7" }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-[color:var(--color-primary-soft)]">
                          {item.type === "video" ? (
                            isDirectVideoUrl(item.url) ? (
                              <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                            ) : (
                              <div className="grid h-full w-full place-items-center px-3 text-center text-xs font-semibold text-[color:var(--color-primary-dark)]">
                                Video link
                              </div>
                            )
                          ) : (
                            <Image src={item.url} alt={page.title} fill className="object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#8A9E94" }}>
                              {item.type}
                            </span>
                            <span className="text-xs" style={{ color: "#64748B" }}>
                              Position {index + 1}
                            </span>
                          </div>
                          <p className="mt-2 break-all text-sm leading-6" style={{ color: "#3A4A42" }}>
                            {item.url}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <form action={manageMedia}>
                              <input type="hidden" name="mediaId" value={item.id} />
                              <input type="hidden" name="intent" value="move-up" />
                              <button
                                type="submit"
                                className="btn-outline"
                                style={{ padding: "0.45rem 0.8rem", fontSize: "0.78rem" }}
                                disabled={!stateSummary.canManageContent || index === 0}
                              >
                                Move up
                              </button>
                            </form>
                            <form action={manageMedia}>
                              <input type="hidden" name="mediaId" value={item.id} />
                              <input type="hidden" name="intent" value="move-down" />
                              <button
                                type="submit"
                                className="btn-outline"
                                style={{ padding: "0.45rem 0.8rem", fontSize: "0.78rem" }}
                                disabled={!stateSummary.canManageContent || index === page.mediaItems.length - 1}
                              >
                                Move down
                              </button>
                            </form>
                            <form action={manageMedia}>
                              <input type="hidden" name="mediaId" value={item.id} />
                              <input type="hidden" name="intent" value="remove" />
                              <button
                                type="submit"
                                className="btn-outline"
                                style={{ padding: "0.45rem 0.8rem", fontSize: "0.78rem" }}
                                disabled={!stateSummary.canManageContent}
                              >
                                Remove
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)", background: "#FCFBF7", color: "#64748B" }}>
                    No gallery items yet. Add a cover image or a few progress photos to make the page feel active.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function AnalyticsCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8A9E94" }}>
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold" style={{ color: "#115E59" }}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-5" style={{ color: "#64748B" }}>
        {subtext}
      </p>
    </div>
  );
}
