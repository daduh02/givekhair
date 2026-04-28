import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { DonationCheckout } from "@/components/donation/DonationCheckout";
import { TRPCProvider } from "@/components/providers";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrustChip } from "@/components/ui/TrustChip";
import { ShareCause } from "@/components/appeal/ShareCause";
import { DonationSummary } from "@/components/appeal/DonationSummary";
import { StickyDonatePanel } from "@/components/appeal/StickyDonatePanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppealFallbackImage } from "@/components/ui/AppealFallbackImage";
import { getOrCreateAppealCheckoutPage } from "@/lib/appeal-checkout";
import { getAppealDonationSummary } from "@/lib/appeal-donation-summary";
import { getAppealLeaderboard, getGoalProgress } from "@/lib/leaderboards";
import { buildAbsoluteUrl } from "@/lib/public-url";

interface Props {
  params: { slug: string };
  searchParams?: { period?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const appeal = await db.appeal.findFirst({
    where: {
      slug: params.slug,
      status: "ACTIVE",
      visibility: "PUBLIC",
      charity: {
        isActive: true,
        status: "ACTIVE",
      },
    },
    select: { title: true, story: true },
  });

  return {
    title: appeal?.title ?? "Appeal",
    description: appeal?.story ?? "Support this GiveKhair appeal with a secure, transparent donation.",
  };
}

async function AppealDonationSummarySection({
  appealId,
  directPageId,
}: {
  appealId: string;
  directPageId: string;
}) {
  const summary = await getAppealDonationSummary({ appealId, directPageId });
  return <DonationSummary summary={summary} />;
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function periodLink(slug: string, period: "30d" | "90d" | "all") {
  return period === "all" ? `/appeals/${slug}` : `/appeals/${slug}?period=${period}`;
}

function rankLabel(rank: number, isTied: boolean) {
  return isTied ? `Tied #${rank}` : `#${rank}`;
}

type RecentSupportEntry = {
  id: string;
  amount: number;
  currency: string;
  donorName: string;
  isAnonymous: boolean;
  createdAt: Date;
  message?: string | null;
};

function renderSupporterName(entry: RecentSupportEntry) {
  if (entry.isAnonymous) {
    return "Anonymous supporter";
  }

  return entry.donorName || "Supporter";
}

export default async function AppealPage({ params, searchParams }: Props) {
  const appeal = await db.appeal.findFirst({
    where: {
      slug: params.slug,
      status: "ACTIVE",
      visibility: "PUBLIC",
      charity: {
        isActive: true,
        status: "ACTIVE",
      },
    },
    include: {
      charity: true,
      category: true,
    },
  });

  if (!appeal) {
    notFound();
  }

  const leaderboard = await getAppealLeaderboard({
    appealId: appeal.id,
    publicOnly: true,
    period: searchParams?.period,
  });

  const raised = leaderboard.totals.online + leaderboard.totals.offline;
  const goal = parseFloat(appeal.goalAmount.toString());
  const progress = getGoalProgress(raised, goal);

  const checkoutPage = await getOrCreateAppealCheckoutPage({
    appealId: appeal.id,
    appealTitle: appeal.title,
    appealSlug: appeal.slug,
    charityId: appeal.charityId,
    currency: appeal.currency,
  });

  if (!checkoutPage) {
    notFound();
  }

  const [recentOnline, recentOffline] = await Promise.all([
    db.donation.findMany({
      where: {
        status: "CAPTURED",
        page: { appealId: appeal.id },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        donorName: true,
        isAnonymous: true,
        createdAt: true,
        message: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.offlineDonation.findMany({
      where: {
        status: "APPROVED",
        page: { appealId: appeal.id },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        donorName: true,
        receivedDate: true,
      },
      orderBy: { receivedDate: "desc" },
      take: 6,
    }),
  ]);

  const recentSupport: RecentSupportEntry[] = [
    ...recentOnline.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      currency: entry.currency,
      donorName: entry.donorName ?? "",
      isAnonymous: entry.isAnonymous,
      createdAt: entry.createdAt,
      message: entry.message,
    })),
    ...recentOffline.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      currency: entry.currency,
      donorName: entry.donorName ?? "",
      isAnonymous: false,
      createdAt: entry.receivedDate,
      message: null,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 6);

  const appealUrl = buildAbsoluteUrl(`/appeals/${appeal.slug}`);

  return (
    <main className="section-shell pb-28 lg:pb-16">
      <div className="site-shell grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,400px)] lg:items-start">
        <section>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-[color:var(--color-line)] bg-[color:var(--color-primary-soft)] shadow-[var(--shadow-card)]">
            <div className="relative aspect-[16/9] w-full">
              {appeal.bannerUrl ? (
                <Image src={appeal.bannerUrl} alt={appeal.title} fill className="object-cover" />
              ) : (
                <AppealFallbackImage title={appeal.title} />
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <TrustChip>{appeal.charity.name}</TrustChip>
            {appeal.charity.isVerified ? <TrustChip tone="gold">Verified charity</TrustChip> : null}
            {appeal.category?.name ? <TrustChip>{appeal.category.name}</TrustChip> : null}
          </div>

          <h1 className="mt-5 text-[2.15rem] font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-[2.7rem] lg:text-[3rem]">
            {appeal.title}
          </h1>

          <p className="mt-4 max-w-[42rem] text-base leading-7 text-[color:var(--color-ink-soft)]">
            Support this appeal directly, share it with others, or back the fundraisers helping the cause go further.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#donation-checkout" className="btn-primary">
              Donate now
            </a>
            <a href="#share-this-cause" className="btn-outline">
              Share this appeal
            </a>
          </div>

          <div className="public-metrics-grid mt-8">
            <MetricCard label="Total raised" value={formatCurrency(raised, appeal.currency)} hint="Includes approved offline donations." />
            <MetricCard label="Supporters" value={String(leaderboard.totals.donorCount)} hint="People and donations recorded for this appeal." />
            <MetricCard label="Fundraisers" value={String(leaderboard.totals.fundraiserPageCount)} hint="Public fundraiser pages linked to this cause." />
          </div>

          {appeal.story ? (
            <section className="mt-8 surface-card p-6 sm:p-7">
              <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">About this appeal</h2>
              <div className="mt-4 max-w-[42rem] whitespace-pre-line text-base leading-8 text-[color:var(--color-ink-soft)]">
                {appeal.story}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Recent support</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                  A live look at the latest donations and approved offline support already recorded for this appeal.
                </p>
              </div>
            </div>

            <div className="mt-5">
              {recentSupport.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {recentSupport.map((entry) => (
                    <article key={entry.id} className="surface-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--color-ink)]">{renderSupporterName(entry)}</p>
                          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                            {entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <p className="text-xl font-bold tracking-[-0.03em] text-[color:var(--color-primary-dark)]">
                          {formatCurrency(entry.amount, entry.currency)}
                        </p>
                      </div>
                      {entry.message ? (
                        <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
                          {entry.message}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No public support updates to show yet."
                  description="Supporter activity will appear here once donations or approved offline entries have been recorded for this appeal."
                />
              )}
            </div>
          </section>

          <div className="mt-8">
            <ShareCause
              title={appeal.title}
              description={appeal.story ?? `Support ${appeal.title} on GiveKhair.`}
              url={appealUrl}
            />
          </div>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Fundraisers supporting this cause</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                  Ranked by total raised, including successful online and approved offline support.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["30d", "90d", "all"] as const).map((period) => {
                  const active = leaderboard.period === period;
                  return (
                    <Link
                      key={period}
                      href={periodLink(appeal.slug, period)}
                      className={active ? "btn-primary" : "btn-outline"}
                      style={{ paddingInline: "0.9rem", paddingBlock: "0.55rem", fontSize: "0.82rem" }}
                    >
                      {period === "all" ? "All time" : period.toUpperCase()}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              {leaderboard.rankedPages.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.rankedPages.slice(0, 8).map((page) => (
                    <Link key={page.id} href={`/fundraise/${page.shortName}`} className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="section-kicker">{rankLabel(page.rank, page.isTied)}</span>
                          {page.teamName ? <TrustChip>{page.teamName}</TrustChip> : null}
                        </div>
                        <p className="mt-3 text-lg font-semibold text-[color:var(--color-ink)]">{page.title}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                          {page.userName ?? "Fundraiser"} · {page.donorCount} supporters
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[color:var(--color-primary-dark)]">
                          {formatCurrency(page.raisedTotal, appeal.currency)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No fundraiser pages are ranked yet for this appeal."
                  description="The appeal is live, but there are no public fundraiser pages with recorded support to show yet."
                />
              )}
            </div>
          </section>

          {leaderboard.rankedTeams.length > 0 ? (
            <section className="mt-8">
              <div>
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Team standings</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">
                  Teams are ranked by the combined support raised by their fundraiser pages.
                </p>
              </div>
              <div className="mt-5 grid gap-4">
                {leaderboard.rankedTeams.slice(0, 6).map((team) => (
                  <article key={team.id} className="surface-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="section-kicker">{rankLabel(team.rank, team.isTied)}</span>
                          <TrustChip>{team.fundraiserPageCount} fundraisers</TrustChip>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-[color:var(--color-ink)]">{team.name}</h3>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                          {team.donorCount} supporters
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-[color:var(--color-primary-dark)]">
                        {formatCurrency(team.raisedTotal, appeal.currency)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8">
            <Suspense
              fallback={
                <DonationSummary
                  loading
                  summary={{ total: 0, online: 0, offline: 0, direct: 0, fundraisers: 0 }}
                />
              }
            >
              <AppealDonationSummarySection appealId={appeal.id} directPageId={checkoutPage.id} />
            </Suspense>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <StickyDonatePanel
            amountRaised={raised}
            goalAmount={goal}
            currency={appeal.currency}
            progress={progress}
            supporterCount={leaderboard.totals.donorCount}
            fundraiserCount={leaderboard.totals.fundraiserPageCount}
          />
          <div id="donation-checkout">
            <TRPCProvider>
              <DonationCheckout
                pageId={checkoutPage.id}
                appealId={appeal.id}
                charityId={appeal.charityId}
                charityName={appeal.charity.name}
                pageName={appeal.title}
              />
            </TRPCProvider>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-line)] bg-[rgba(255,255,255,0.98)] px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden">
        <div className="site-shell flex items-center gap-3 px-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--color-ink)]">{formatCurrency(raised, appeal.currency)} raised</p>
            <p className="text-xs text-[color:var(--color-ink-muted)]">{leaderboard.totals.donorCount} supporters</p>
          </div>
          <a href="#donation-checkout" className="btn-primary whitespace-nowrap">
            Donate now
          </a>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-3 text-[1.8rem] font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-muted)]">{hint}</p>
    </article>
  );
}
