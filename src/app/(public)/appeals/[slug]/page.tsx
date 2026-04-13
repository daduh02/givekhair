import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DonationCheckout } from "@/components/donation/DonationCheckout";
import { TRPCProvider } from "@/components/providers";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrustChip } from "@/components/ui/TrustChip";
import { getOrCreateAppealCheckoutPage } from "@/lib/appeal-checkout";
import { getAppealLeaderboard, getGoalProgress } from "@/lib/leaderboards";

interface Props {
  params: { slug: string };
  searchParams?: { period?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const appeal = await db.appeal.findUnique({
    where: { slug: params.slug },
    select: { title: true, story: true },
  });

  return {
    title: appeal?.title ?? "Appeal",
    description: appeal?.story ?? "Support this GiveKhair appeal with a secure, transparent donation.",
  };
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

export default async function AppealPage({ params, searchParams }: Props) {
  const appeal = await db.appeal.findUnique({
    where: { slug: params.slug },
    include: {
      charity: true,
      category: true,
      teams: {
        where: { status: "ACTIVE", visibility: "PUBLIC" },
        select: { id: true, name: true, slug: true },
      },
      fundraisingPages: {
        where: { status: "ACTIVE", visibility: "PUBLIC", teamId: null },
        include: { user: { select: { name: true, image: true } } },
        take: 12,
      },
    },
  });

  if (!appeal || appeal.visibility === "HIDDEN") {
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

  const checkoutPage =
    appeal.fundraisingPages[0] ??
    (await getOrCreateAppealCheckoutPage({
      appealId: appeal.id,
      appealTitle: appeal.title,
      appealSlug: appeal.slug,
      charityId: appeal.charityId,
      currency: appeal.currency,
    }));

  return (
    <main className="section-shell">
      <div className="site-shell grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] lg:items-start">
        <section>
          <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-line)] bg-[color:var(--color-primary-soft)] shadow-[var(--shadow-card)]">
            <div className="relative h-[18rem] w-full sm:h-[24rem]">
              {appeal.bannerUrl ? (
                <Image src={appeal.bannerUrl} alt={appeal.title} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(204,251,241,0.9),rgba(248,245,239,0.95))] text-6xl">
                  🌿
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <TrustChip>
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-primary)]" />
              {appeal.charity.name}
            </TrustChip>
            {appeal.charity.isVerified ? <TrustChip tone="gold">Verified charity</TrustChip> : null}
            {appeal.category?.name ? <TrustChip>{appeal.category.name}</TrustChip> : null}
            {appeal.status === "ENDED" ? <TrustChip>Campaign ended</TrustChip> : null}
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-5xl">
            {appeal.title}
          </h1>

          <div className="mt-6 max-w-3xl">
            <p className="text-4xl font-bold tracking-[-0.05em] text-[color:var(--color-primary-dark)]">
              {formatCurrency(raised, appeal.currency)}
            </p>
            <p className="mt-2 text-base text-[color:var(--color-ink-muted)]">
              raised of {formatCurrency(goal, appeal.currency)} goal · includes approved offline donations
            </p>
            <ProgressBar value={progress} className="mt-5" />
          </div>

          <div className="mt-6 flex flex-wrap gap-6 text-sm font-semibold text-[color:var(--color-ink-soft)]">
            <span>{leaderboard.totals.donorCount} donor records</span>
            <span>{progress}% of goal</span>
            <span>{leaderboard.totals.fundraiserPageCount} fundraiser pages</span>
            {appeal.endsAt ? (
              <span>{Math.max(0, Math.ceil((appeal.endsAt.getTime() - Date.now()) / 86_400_000))} days left</span>
            ) : null}
          </div>

          {appeal.story ? (
            <section className="mt-10 surface-card p-7 sm:p-8">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">About this appeal</h2>
              <p className="mt-5 whitespace-pre-line text-base leading-8 text-[color:var(--color-ink-soft)]">{appeal.story}</p>
            </section>
          ) : null}

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Fundraiser leaderboard</h2>
                <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                  Ranked by total raised, combining online and approved offline donations.
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
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                    >
                      {period === "all" ? "All time" : period.toUpperCase()}
                    </Link>
                  );
                })}
              </div>
            </div>

            {leaderboard.rankedPages.length > 0 ? (
              <div className="mt-5 space-y-3">
                {leaderboard.rankedPages.slice(0, 10).map((page) => (
                  <Link key={page.id} href={`/fundraise/${page.shortName}`} className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="section-kicker">{rankLabel(page.rank, page.isTied)}</span>
                        {page.teamName ? <TrustChip>{page.teamName}</TrustChip> : null}
                      </div>
                      <p className="mt-3 text-lg font-semibold text-[color:var(--color-ink)]">{page.title}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                        {page.userName ?? "Fundraiser"} · {page.donorCount} donor records
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[color:var(--color-primary-dark)]">
                        {formatCurrency(page.raisedTotal, appeal.currency)}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
                        Online {formatCurrency(page.onlineTotal, appeal.currency)} · Offline {formatCurrency(page.offlineTotal, appeal.currency)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="surface-card mt-5 p-6 text-sm text-[color:var(--color-ink-muted)]">
                No fundraiser pages are ranked yet for this appeal.
              </div>
            )}
            {leaderboard.rankedPages.length > 10 ? (
              <div className="mt-4">
                <Link href={`/appeals/${appeal.slug}/leaderboard?period=${leaderboard.period}`} className="btn-outline">
                  View full leaderboard
                </Link>
              </div>
            ) : null}
          </section>

          {leaderboard.rankedTeams.length > 0 ? (
            <section className="mt-10">
              <div>
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Team standings</h2>
                <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                  Teams are ranked by the combined performance of their fundraiser pages.
                </p>
              </div>
              <div className="mt-5 grid gap-4">
                {leaderboard.rankedTeams.slice(0, 8).map((team) => (
                  <article key={team.id} className="surface-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="section-kicker">{rankLabel(team.rank, team.isTied)}</span>
                          <TrustChip>{team.fundraiserPageCount} pages</TrustChip>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-[color:var(--color-ink)]">{team.name}</h3>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                          {team.donorCount} donor records · Online {formatCurrency(team.onlineTotal, appeal.currency)} · Offline {formatCurrency(team.offlineTotal, appeal.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[color:var(--color-primary-dark)]">
                          {formatCurrency(team.raisedTotal, appeal.currency)}
                        </p>
                        {team.goalAmount > 0 ? (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
                            {team.progress}% of team goal
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {team.topPages.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--color-ink-soft)]">
                        {team.topPages.map((teamPage) => (
                          <Link key={teamPage.id} href={`/fundraise/${teamPage.shortName}`} className="trust-chip">
                            {rankLabel(teamPage.rank, teamPage.isTied)} {teamPage.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              {leaderboard.rankedTeams.length > 8 ? (
                <div className="mt-4">
                  <Link href={`/appeals/${appeal.slug}/leaderboard?period=${leaderboard.period}`} className="btn-outline">
                    View full team standings
                  </Link>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="mt-10 surface-card p-6 text-sm text-[color:var(--color-ink-muted)]">
              This appeal currently has no active public teams.
            </section>
          )}
        </section>

        <aside className="lg:sticky lg:top-24">
          <TRPCProvider>
            <DonationCheckout
              pageId={checkoutPage.id}
              appealId={appeal.id}
              charityId={appeal.charityId}
              charityName={appeal.charity.name}
              pageName={appeal.title}
            />
          </TRPCProvider>
        </aside>
      </div>
    </main>
  );
}
