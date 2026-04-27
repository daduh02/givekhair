import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DonationCheckout } from "@/components/donation/DonationCheckout";
import { TRPCProvider } from "@/components/providers";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrustChip } from "@/components/ui/TrustChip";
import {
  decimalToNumber,
  formatCurrency,
  formatDate,
  getGoalProgress,
} from "@/lib/fundraiser-management";
import { isFundraisingPagePubliclyAccessible } from "@/server/lib/public-access";

interface Props {
  params: { shortName: string };
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await db.fundraisingPage.findUnique({
    where: { shortName: params.shortName },
    select: {
      title: true,
      story: true,
      status: true,
      visibility: true,
      teamId: true,
      team: { select: { status: true, visibility: true } },
      appeal: {
        select: {
          title: true,
          status: true,
          visibility: true,
          charity: { select: { name: true, isActive: true, status: true } },
        },
      },
    },
  });

  if (!page || !isFundraisingPagePubliclyAccessible(page)) {
    return { title: "Fundraiser page" };
  }

  return {
    title: `${page.title} | ${page.appeal.charity.name}`,
    description: page.story ?? `Support ${page.title} for ${page.appeal.title} on GiveKhair.`,
  };
}

export default async function FundraisingPage({ params }: Props) {
  const page = await db.fundraisingPage.findUnique({
    where: { shortName: params.shortName },
    include: {
      user: { select: { id: true, name: true, image: true, email: true } },
      team: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
      appeal: {
        include: {
          charity: true,
          category: true,
        },
      },
      donations: {
        where: { status: "CAPTURED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          currency: true,
          donorName: true,
          isAnonymous: true,
          message: true,
          createdAt: true,
        },
      },
      offlineDonations: {
        where: { status: "APPROVED" },
        orderBy: { receivedDate: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          donorName: true,
          notes: true,
          receivedDate: true,
        },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      mediaItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  // Public fundraiser pages only render when moderation and visibility imply the
  // route is intentionally available to supporters.
  if (!page || !isFundraisingPagePubliclyAccessible(page)) {
    notFound();
  }

  const [onlineAgg, offlineAgg] = await Promise.all([
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
  ]);

  const onlineRaised = decimalToNumber(onlineAgg._sum.amount);
  const offlineRaised = decimalToNumber(offlineAgg._sum.amount);
  const raised = onlineRaised + offlineRaised;
  const target = decimalToNumber(page.targetAmount);
  const progress = getGoalProgress(raised, target);
  const donorCount = onlineAgg._count + offlineAgg._count;

  const donorFeed = [
    ...page.donations.map((donation) => ({
      id: donation.id,
      kind: "ONLINE" as const,
      name: donation.isAnonymous ? "Anonymous donor" : donation.donorName ?? "Supporter",
      message: donation.message ?? null,
      amount: decimalToNumber(donation.amount),
      currency: donation.currency,
      createdAt: donation.createdAt,
    })),
    ...page.offlineDonations.map((donation) => ({
      id: donation.id,
      kind: "OFFLINE" as const,
      name: donation.donorName ?? "Offline donor",
      message: donation.notes ?? null,
      amount: decimalToNumber(donation.amount),
      currency: donation.currency,
      createdAt: donation.receivedDate,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  const leadMember = page.team?.members.find((member) => member.isLead)?.user;

  return (
    <main className="section-shell">
      <div className="site-shell grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:items-start">
        <section>
          <div className="hero-frame p-6 sm:p-8">
            <div className="relative z-10">
              {page.coverImageUrl ? (
                <div className="relative mb-6 h-56 overflow-hidden rounded-[1.7rem] border border-white/60 bg-[color:var(--color-primary-soft)] shadow-[var(--shadow-card-soft)] sm:h-72">
                  <Image src={page.coverImageUrl} alt={page.title} fill className="object-cover" />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <TrustChip>{page.appeal.charity.name}</TrustChip>
                {page.appeal.charity.isVerified ? <TrustChip tone="gold">Verified charity</TrustChip> : null}
                {page.team ? <TrustChip>{page.team.name}</TrustChip> : <TrustChip>Solo fundraiser</TrustChip>}
                {page.visibility === "UNLISTED" ? <TrustChip>Shared by direct link</TrustChip> : null}
              </div>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--color-primary-soft)] text-2xl font-bold text-[color:var(--color-primary-dark)]">
                  {page.user.image ? (
                    <Image src={page.user.image} alt={page.user.name ?? page.title} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    <span>{page.user.name?.charAt(0) ?? "G"}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-ink-muted)]">
                    Fundraiser{page.team ? " team page" : ""}
                  </p>
                  <h1 className="mt-1 text-4xl font-bold tracking-[-0.05em] text-[color:var(--color-ink)] sm:text-5xl">
                    {page.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-[color:var(--color-ink-soft)]">
                    Supporting <strong>{page.appeal.title}</strong> for {page.appeal.charity.name}.
                    {page.user.name ? ` Created by ${page.user.name}.` : ""}
                    {leadMember && leadMember.id !== page.user.id ? ` Team lead: ${leadMember.name}.` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="stat-card">
                  <p className="stat-card-value">{formatCurrency(raised, page.currency)}</p>
                  <p className="stat-card-label">raised so far</p>
                </div>
                <div className="stat-card">
                  <p className="stat-card-value">{donorCount}</p>
                  <p className="stat-card-label">supporters</p>
                </div>
                <div className="stat-card">
                  <p className="stat-card-value">{target > 0 ? `${progress}%` : "Live"}</p>
                  <p className="stat-card-label">{target > 0 ? "of target" : "open campaign"}</p>
                </div>
              </div>

              {target > 0 ? (
                <div className="mt-8">
                  <ProgressBar value={progress} label={`Target ${formatCurrency(target, page.currency)}`} />
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/appeals/${page.appeal.slug}`} className="btn-secondary">
                  View appeal
                </Link>
                {page.team ? (
                  <span className="trust-chip bg-white text-[color:var(--color-ink-soft)]">
                    {page.team.members.length} team members
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {page.story ? (
            <section className="surface-card mt-8 p-7 sm:p-8">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
                Why I&apos;m fundraising
              </h2>
              <p className="mt-5 whitespace-pre-line text-base leading-8 text-[color:var(--color-ink-soft)]">
                {page.story}
              </p>
            </section>
          ) : null}

          {page.mediaItems.length > 0 ? (
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
                    Photos & media
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                    A few visual moments from the fundraiser and the cause behind it.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {page.mediaItems.map((item) => (
                  <div key={item.id} className="surface-card overflow-hidden">
                    <div className="relative h-56 w-full bg-[color:var(--color-primary-soft)]">
                      {item.type === "video" ? (
                        isDirectVideoUrl(item.url) ? (
                          <video src={item.url} controls className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center p-6 text-center text-sm leading-7 text-[color:var(--color-primary-dark)]">
                            <div>
                              <p className="font-semibold">Video link</p>
                              <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">
                                Open video
                              </a>
                            </div>
                          </div>
                        )
                      ) : (
                        <Image src={item.url} alt={page.title} fill className="object-cover" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {page.updates.length > 0 ? (
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
                    Updates from the fundraiser
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                    Progress notes shared directly by the fundraiser owner.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4">
                {page.updates.map((update) => (
                  <article key={update.id} className="trust-card">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">
                      {formatDate(update.createdAt)}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[color:var(--color-ink-soft)]">
                      {update.body}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
              Recent supporters
            </h2>
            <div className="mt-5 grid gap-4">
              {donorFeed.length > 0 ? (
                donorFeed.map((entry) => (
                  <article key={`${entry.kind}-${entry.id}`} className="surface-card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[color:var(--color-ink)]">{entry.name}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{formatDate(entry.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold tracking-[-0.03em] text-[color:var(--color-primary-dark)]">
                          {formatCurrency(entry.amount, entry.currency)}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
                          {entry.kind === "OFFLINE" ? "Offline gift" : "Online donation"}
                        </p>
                      </div>
                    </div>
                    {entry.message ? (
                      <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">{entry.message}</p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="surface-card p-6 text-sm text-[color:var(--color-ink-soft)]">
                  This fundraiser has no public donor messages yet.
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="lg:sticky lg:top-24">
          <TRPCProvider>
            <DonationCheckout
              pageId={page.id}
              appealId={page.appeal.id}
              charityId={page.appeal.charityId}
              charityName={page.appeal.charity.name}
              pageName={page.title}
            />
          </TRPCProvider>
        </aside>
      </div>
    </main>
  );
}
