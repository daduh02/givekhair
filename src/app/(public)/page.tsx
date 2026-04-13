import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppealCard, type AppealCardAppeal } from "@/components/appeal/AppealCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const CATEGORY_PILLS = [
  { label: "Emergency", slug: "emergency-relief" },
  { label: "Health", slug: "health" },
  { label: "Education", slug: "education" },
  { label: "Community", slug: "community" },
];

const BENEFITS = [
  {
    title: "Why charities use GiveKhair",
    copy: "Each appeal can show verified charity context, live progress, online and offline totals, and a donation flow that explains fees before checkout.",
  },
  {
    title: "Built for fundraiser support",
    copy: "Teams, fundraiser pages, moderation, and donation tracking sit behind the same appeal, so charities can grow campaigns without losing oversight.",
  },
  {
    title: "Ready for finance follow-through",
    copy: "Gift Aid claims, offline uploads, payout batches, and reporting live in the admin side, so campaign activity does not end at the donate button.",
  },
];

const TRUST_BAND = [
  {
    title: "Registered charity details",
    copy: "Public charity pages can show registration details, verification status, and core contact information before a donor gives.",
  },
  {
    title: "Gift Aid information",
    copy: "Gift Aid eligibility and declaration language sit close to the donation flow instead of being buried after payment.",
  },
  {
    title: "Payment security",
    copy: "Hosted checkout keeps payment handling separate while GiveKhair still shows what the donor pays and what the charity receives.",
  },
  {
    title: "Accessibility commitment",
    copy: "The public journey is being shaped around readable structure, clear actions, and accessible giving on mobile and desktop.",
  },
];

const FALLBACK_APPEALS = [
  {
    id: "mock-gaza",
    slug: "gaza-emergency-medical-aid",
    title: "Gaza Emergency Medical Aid",
    goalAmount: "100000",
    currency: "GBP",
    charity: { name: "Islamic Relief UK", isVerified: true },
    raisedAmount: 22350,
  },
  {
    id: "mock-ramadan",
    slug: "feed-1000-families-this-ramadan",
    title: "Feed 1,000 Families This Ramadan",
    goalAmount: "20000",
    currency: "GBP",
    charity: { name: "AWET", isVerified: true },
    raisedAmount: 8420,
  },
  {
    id: "mock-water",
    slug: "build-a-village-water-well",
    title: "Build a Village Water Well",
    goalAmount: "25000",
    currency: "GBP",
    charity: { name: "GiveKhair Foundation", isVerified: true },
    raisedAmount: 12700,
  },
] satisfies Array<AppealCardAppeal & { raisedAmount: number }>;

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default async function HomePage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  const session = await auth();

  let loadError = false;
  let featuredAppeal: (AppealCardAppeal & { raisedAmount: number }) | null = null;
  let trendingAppeals: Array<AppealCardAppeal & { raisedAmount: number }> = [];

  try {
    const liveAppeals = await db.appeal.findMany({
      where: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        ...(searchParams.category ? { category: { slug: searchParams.category } } : {}),
        ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" } } : {}),
      },
      include: {
        charity: { select: { name: true, logoUrl: true, isVerified: true } },
        _count: { select: { fundraisingPages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    });

    // Keeping the total mapping explicit makes it easier for another developer to
    // swap this with a dedicated reporting query later without changing the UI map.
    const appealsWithRaised = await Promise.all(
      liveAppeals.map(async (appeal) => {
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
      })
    );

    featuredAppeal = appealsWithRaised[0] ?? null;
    trendingAppeals = appealsWithRaised.slice(0, 3);
  } catch (error) {
    loadError = true;
    console.error("Failed to load homepage appeals", error);
  }

  const featured = featuredAppeal ?? FALLBACK_APPEALS[0];
  const trending = trendingAppeals.length > 0 ? trendingAppeals : FALLBACK_APPEALS;
  const featuredGoal = typeof featured.goalAmount === "string" ? parseFloat(featured.goalAmount) : featured.goalAmount;
  const featuredPct = featuredGoal > 0 ? Math.round((featured.raisedAmount / featuredGoal) * 100) : 0;

  return (
    <main>
      <section className="section-shell">
        <div className="site-shell hero-frame grid gap-10 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10 lg:py-12">
          <div className="relative z-10">
            <TrustChip>UK Gift Aid eligible • Verified charities • Fee transparent</TrustChip>

            <h1 className="section-heading mt-6 max-w-4xl font-bold">
              Every act of <span className="text-[color:var(--color-primary)]">Khair</span> is an act of care.
            </h1>

            <p className="section-copy mt-6">
              Support verified charities, see Gift Aid and fees before you pay, and back appeals that include both online progress and offline fundraising already happening on the ground.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/appeals/${featured.slug}`} className="btn-primary">
                Donate now
              </Link>
              <Link href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"} className="btn-secondary">
                Start fundraising
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MiniTrustCard value="Fees" label="shown before checkout" />
              <MiniTrustCard value="Gift Aid" label="built into UK giving" />
              <MiniTrustCard value="Offline" label="donations count too" />
            </div>
          </div>

          {/* The featured card mirrors the donation journey we want users to trust:
              verified charity, visible progress, and one clear CTA. */}
          <aside className="surface-card relative z-10 overflow-hidden p-6 sm:p-8">
            <div className="section-kicker">Featured this week</div>
            <div className="mt-6 rounded-[1.75rem] border border-[color:var(--color-line)] bg-[linear-gradient(180deg,rgba(204,251,241,0.55),rgba(255,255,255,0.95))] p-6">
              <div className="flex items-center justify-between gap-3">
                <TrustChip tone="gold">{featured.charity.isVerified ? "Verified charity" : "Active appeal"}</TrustChip>
                <span className="text-sm font-semibold text-[color:var(--color-primary-dark)]">{featured.charity.name}</span>
              </div>

              <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">
                {featured.title}
              </h2>

              <div className="mt-6">
                <ProgressBar value={featuredPct} label="Raised so far" />
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-[color:var(--color-primary-dark)]">
                    {formatCurrency(featured.raisedAmount, featured.currency)}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
                    raised toward {formatCurrency(featuredGoal, featured.currency)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[color:var(--color-ink-soft)]">{featuredPct}% funded</p>
              </div>

              <Link href={`/appeals/${featured.slug}`} className="btn-primary mt-6 w-full">
                Open appeal
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <div className="section-panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">Browse by focus</p>
                <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">Start with the type of appeal you want to support.</p>
              </div>
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
            </div>
          </div>
        </div>
      </section>

      <section id="appeals" className="section-shell section-sandband">
        <div className="site-shell">
          <SectionIntro
            eyebrow={loadError ? "Curated fallback" : "Trending now"}
            title={searchParams.q ? `Results for “${searchParams.q}”` : "Appeals donors are backing right now"}
            description="Clear goals, verified charity context, and a direct route to donate."
            actions={
              <Link href="/charities" className="btn-secondary">
                Explore charities
              </Link>
            }
          />

          {loadError ? (
            <div className="surface-card mt-10 p-8 text-center">
              <p className="text-lg font-semibold text-[color:var(--color-ink)]">Live appeal data is temporarily unavailable.</p>
              <p className="mt-3 text-[color:var(--color-ink-soft)]">
                We&apos;re showing launch-ready examples while the live public directory reconnects.
              </p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {trending.map((appeal) => (
              <AppealCard key={appeal.id} appeal={appeal} raisedAmount={appeal.raisedAmount} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Why charities use GiveKhair"
            title="Charity operations and public giving in one place"
            description="Appeals, fundraiser pages, offline donations, Gift Aid, and payout reporting all connect back to the same charity setup."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title} className="trust-card">
                <h3 className="text-xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{benefit.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <div className="section-panel overflow-hidden bg-[linear-gradient(135deg,rgba(15,118,110,0.92),rgba(17,94,89,0.92))] p-8 text-white sm:p-10">
            <div className="max-w-3xl">
              <TrustChip tone="gold">For charities and fundraisers</TrustChip>
              <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                Build trust before asking for money.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-teal-50 sm:text-base">
                Open a verified charity profile, choose an appeal, or launch a fundraiser with a clearer route from first visit to completed donation.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/charities" className="btn-secondary border-white/20 bg-white text-[color:var(--color-primary-dark)]">
                Explore charities
              </Link>
              <Link href="/how-it-works" className="btn-secondary border-white/20 bg-transparent text-white">
                Learn how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <div className="grid gap-5 lg:grid-cols-4">
            {TRUST_BAND.map((item) => (
              <article key={item.title} className="trust-card">
                <h3 className="text-lg font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniTrustCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-card">
      <p className="stat-card-value">{value}</p>
      <p className="stat-card-label">{label}</p>
    </div>
  );
}
