import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppealCard, type AppealCardAppeal } from "@/components/appeal/AppealCard";
import { TrendingAppealsPager } from "@/components/appeal/TrendingAppealsPager";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";
import { AppealFallbackImage } from "@/components/ui/AppealFallbackImage";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const CATEGORY_PILLS = [
  { label: "Emergency", slug: "emergency-relief" },
  { label: "Health", slug: "health" },
  { label: "Education", slug: "education" },
  { label: "Community", slug: "community" },
];

const TRUST_BAND = [
  {
    title: "Verified before the ask",
    copy: "Public charity profiles can show verification cues, registration context, and active campaigns before a donor reaches checkout.",
  },
  {
    title: "Clear giving details",
    copy: "Gift Aid and fee information are surfaced before payment so people understand the giving journey clearly.",
  },
  {
    title: "Built for real appeals",
    copy: "Appeals, fundraisers, and approved offline donations can all contribute to a clearer picture of support around a cause.",
  },
];

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

type LiveAppeal = AppealCardAppeal & {
  raisedAmount: number;
  category?: { slug: string; name: string } | null;
};

async function mapAppealWithRaised(appeal: {
  id: string;
  slug: string;
  title: string;
  goalAmount: { toString(): string };
  currency: string;
  bannerUrl?: string | null;
  category?: { slug: string; name: string } | null;
  charity: {
    name: string;
    logoUrl?: string | null;
    isVerified: boolean;
  };
  _count: { fundraisingPages: number };
}) {
  const [online, offline] = await Promise.all([
    db.donation.aggregate({
      where: { page: { appealId: appeal.id }, status: "CAPTURED" },
      _sum: { amount: true },
    }),
    db.offlineDonation.aggregate({
      where: { page: { appealId: appeal.id }, status: "APPROVED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    ...appeal,
    goalAmount: appeal.goalAmount.toString(),
    raisedAmount:
      parseFloat(online._sum.amount?.toString() ?? "0") +
      parseFloat(offline._sum.amount?.toString() ?? "0"),
  };
}

type RecentSupportEntry = {
  id: string;
  amount: number;
  currency: string;
  donorName: string;
  isAnonymous: boolean;
  createdAt: Date;
  appealTitle: string;
  appealSlug: string;
  charityName: string;
};

function formatSupporterName(entry: RecentSupportEntry) {
  if (entry.isAnonymous) {
    return "Anonymous supporter";
  }

  return entry.donorName || "Supporter";
}

export default async function HomePage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  const session = await auth();

  const publicWhere = {
    status: "ACTIVE" as const,
    visibility: "PUBLIC" as const,
    charity: {
      isActive: true,
      status: "ACTIVE" as const,
    },
  };

  const listingWhere = {
    ...publicWhere,
    ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
    ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" as const } } : {}),
  };

  let loadError = false;
  let featuredAppeal: LiveAppeal | null = null;
  let trendingAppeals: LiveAppeal[] = [];
  let urgentAppeals: LiveAppeal[] = [];
  let recentSupport: RecentSupportEntry[] = [];

  try {
    const [explicitFeaturedAppeal, liveAppeals, recentOnline, recentOffline] = await Promise.all([
      db.appeal.findFirst({
          where: {
          ...publicWhere,
          isFeaturedHomepage: true,
        },
        include: {
          charity: { select: { name: true, logoUrl: true, isVerified: true } },
          category: { select: { slug: true, name: true } },
          _count: { select: { fundraisingPages: true } },
        },
      }),
      db.appeal.findMany({
        where: listingWhere,
        include: {
          charity: { select: { name: true, logoUrl: true, isVerified: true } },
          category: { select: { slug: true, name: true } },
          _count: { select: { fundraisingPages: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 18,
      }),
      db.donation.findMany({
        where: {
          status: "CAPTURED",
          page: {
            appeal: {
              status: "ACTIVE",
              visibility: "PUBLIC",
              charity: {
                isActive: true,
                status: "ACTIVE",
              },
            },
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          donorName: true,
          isAnonymous: true,
          createdAt: true,
          page: {
            select: {
              appeal: {
                select: {
                  title: true,
                  slug: true,
                  charity: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.offlineDonation.findMany({
        where: {
          status: "APPROVED",
          page: {
            appeal: {
              status: "ACTIVE",
              visibility: "PUBLIC",
              charity: {
                isActive: true,
                status: "ACTIVE",
              },
            },
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          donorName: true,
          receivedDate: true,
          page: {
            select: {
              appeal: {
                select: {
                  title: true,
                  slug: true,
                  charity: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { receivedDate: "desc" },
        take: 6,
      }),
    ]);

    const appealsWithRaised = await Promise.all(liveAppeals.map((appeal) => mapAppealWithRaised(appeal)));
    const sortedTrending = [...appealsWithRaised].sort((left, right) => {
      if (right.raisedAmount !== left.raisedAmount) {
        return right.raisedAmount - left.raisedAmount;
      }

      return left.title.localeCompare(right.title);
    });

    featuredAppeal = explicitFeaturedAppeal
      ? await mapAppealWithRaised(explicitFeaturedAppeal)
      : appealsWithRaised[0] ?? null;
    trendingAppeals = sortedTrending.filter((appeal) => appeal.id !== featuredAppeal?.id);
    urgentAppeals = sortedTrending.filter((appeal) => appeal.category?.slug === "emergency-relief").slice(0, 3);

    recentSupport = [
      ...recentOnline.map((entry) => ({
        id: entry.id,
        amount: Number(entry.amount),
        currency: entry.currency,
        donorName: entry.donorName ?? "",
        isAnonymous: entry.isAnonymous,
        createdAt: entry.createdAt,
        appealTitle: entry.page.appeal.title,
        appealSlug: entry.page.appeal.slug,
        charityName: entry.page.appeal.charity.name,
      })),
      ...recentOffline.flatMap((entry) =>
        entry.page
          ? [{
              id: entry.id,
              amount: Number(entry.amount),
              currency: entry.currency,
              donorName: entry.donorName ?? "",
              isAnonymous: false,
              createdAt: entry.receivedDate,
              appealTitle: entry.page.appeal.title,
              appealSlug: entry.page.appeal.slug,
              charityName: entry.page.appeal.charity.name,
            }]
          : [],
      ),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 6);
  } catch (error) {
    loadError = true;
    console.error("Failed to load homepage public data", error);
  }

  const featuredGoal = featuredAppeal ? parseFloat(String(featuredAppeal.goalAmount)) : 0;
  const featuredPct = featuredAppeal && featuredGoal > 0 ? Math.min(Math.round((featuredAppeal.raisedAmount / featuredGoal) * 100), 100) : 0;

  return (
    <main>
      <section className="section-shell">
        <div className="site-shell hero-frame grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10">
          <div className="relative z-10 max-w-[42.5rem]">
            <div className="flex flex-wrap gap-2">
              <TrustChip tone="gold">Verified charities</TrustChip>
              <TrustChip>Gift Aid ready</TrustChip>
              <TrustChip>Transparent fees</TrustChip>
            </div>

            <h1 className="section-heading mt-6 font-bold">
              Every act of <span className="text-[color:var(--color-primary)]">Khair</span> is an act of care.
            </h1>

            <p className="section-copy mt-6">
              Give with confidence to verified causes, support meaningful appeals, and help charities turn generosity into real impact.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#appeals" className="btn-primary">
                Explore appeals
              </Link>
              <Link href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"} className="btn-outline">
                Start fundraising
              </Link>
            </div>
          </div>

          <aside className="relative z-10">
            {featuredAppeal ? (
              <div className="surface-card overflow-hidden">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {featuredAppeal.bannerUrl ? (
                    <Image src={featuredAppeal.bannerUrl} alt={featuredAppeal.title} fill className="object-cover" />
                  ) : (
                    <AppealFallbackImage title={featuredAppeal.title} compact />
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {featuredAppeal.charity.isVerified ? <TrustChip tone="gold">Verified</TrustChip> : null}
                    <TrustChip>{featuredAppeal.charity.name}</TrustChip>
                  </div>

                  <h2 className="mt-4 text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
                    {featuredAppeal.title}
                  </h2>

                  <div className="mt-4">
                    <ProgressBar value={featuredPct} label="Raised" />
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[1.9rem] font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">
                        {formatCurrency(featuredAppeal.raisedAmount, featuredAppeal.currency)}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                        of {formatCurrency(featuredGoal, featuredAppeal.currency)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[color:var(--color-ink-soft)]">{featuredPct}% funded</p>
                  </div>

                  <Link href={`/appeals/${featuredAppeal.slug}`} className="btn-primary mt-5 w-full">
                    Donate now
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Appeals will appear here as soon as they go live."
                description="Browse the public directory or check back shortly for the latest causes."
                action={<Link href="/charities" className="btn-outline">Explore charities</Link>}
              />
            )}
          </aside>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <div className="section-panel p-4 sm:p-5">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">Browse by focus</p>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">Start with the type of cause you want to support.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_PILLS.map((category) => (
                <Link
                  key={category.slug}
                  href={`/?category=${category.slug}`}
                  className="trust-chip bg-white text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary-dark)]"
                >
                  {category.label}
                </Link>
              ))}
              {(searchParams.category || searchParams.q) ? (
                <Link
                  href="/"
                  className="trust-chip bg-white text-[color:var(--color-primary-dark)] hover:border-[color:var(--color-primary)]"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Recent giving"
            title="Supporters are giving now"
            description="When live donation data is available, this shows the latest support flowing through public appeals."
          />

          <div className="mt-8">
            {recentSupport.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recentSupport.map((entry) => (
                  <Link key={entry.id} href={`/appeals/${entry.appealSlug}`} className="surface-card p-5 transition-transform duration-200 hover:-translate-y-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-ink)]">{formatSupporterName(entry)}</p>
                        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{entry.charityName}</p>
                      </div>
                      <p className="text-lg font-bold tracking-[-0.03em] text-[color:var(--color-primary-dark)]">
                        {formatCurrency(entry.amount, entry.currency)}
                      </p>
                    </div>
                    <p className="mt-4 text-base font-semibold text-[color:var(--color-ink)]">{entry.appealTitle}</p>
                    <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                      {entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Recent giving will appear here once public donations are recorded."
                description="There are no live recent-donation entries to show right now."
              />
            )}
          </div>
        </div>
      </section>

      {urgentAppeals.length > 0 ? (
        <section className="section-shell-tight">
          <div className="site-shell">
            <SectionIntro
              eyebrow="Featured causes"
              title="Appeals needing attention right now"
              description="These live public appeals are already tagged in existing data and are drawing support now."
            />
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {urgentAppeals.map((appeal) => (
                <AppealCard key={appeal.id} appeal={appeal} raisedAmount={appeal.raisedAmount} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section id="appeals" className="section-shell section-sandband">
        <div className="site-shell">
          <SectionIntro
            eyebrow={loadError ? "Temporarily unavailable" : "Appeals"}
            title={searchParams.q ? `Results for “${searchParams.q}”` : "Appeals people are giving to now"}
            description="Browse the live causes currently visible on GiveKhair."
            actions={<Link href="/charities" className="btn-outline">Explore charities</Link>}
          />

          <div className="mt-8">
            {loadError ? (
              <EmptyState
                title="We couldn’t load public appeals just now."
                description="Please try again shortly while the live public directory reconnects."
              />
            ) : trendingAppeals.length > 0 ? (
              <TrendingAppealsPager appeals={trendingAppeals} />
            ) : (
              <EmptyState
                title="No public appeals match this view yet."
                description="Try another category, remove your search, or explore charity profiles instead."
                action={<Link href="/charities" className="btn-outline">Explore charities</Link>}
              />
            )}
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Why people give through GiveKhair"
            title="Trust cues first, operational detail later"
            description="The public experience is designed to help donors understand the cause, the charity, and the giving flow before they ever reach payment."
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {TRUST_BAND.map((item) => (
              <article key={item.title} className="trust-card">
                <h3 className="text-[1.35rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <div className="section-panel overflow-hidden bg-[linear-gradient(135deg,rgba(15,118,110,0.92),rgba(17,94,89,0.92))] p-8 text-white sm:p-10">
            <div className="max-w-3xl">
              <TrustChip tone="gold">Ready to help a cause go further?</TrustChip>
              <h2 className="mt-5 text-[1.9rem] font-bold tracking-[-0.04em] sm:text-[2.25rem]">
                Support an appeal or start fundraising for one you care about.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-teal-50 sm:text-base">
                Give directly, share a cause with others, or create a fundraiser that brings more people into the story.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#appeals" className="btn-secondary border-white/20 bg-white text-[color:var(--color-primary-dark)]">
                Explore appeals
              </Link>
              <Link href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"} className="btn-outline border-white/20 bg-transparent text-white">
                Start fundraising
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
