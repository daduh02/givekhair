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
    title: "Why donors will trust this",
    copy: "Verified charities, clear fee breakdowns, Gift Aid prompts, and strong trust signals reduce hesitation before checkout.",
  },
  {
    title: "Why fundraisers will convert",
    copy: "Appeal pages are built to explain the cause quickly, show progress clearly, and get donors to a hosted checkout in minutes.",
  },
  {
    title: "Why charities will join",
    copy: "Charities get visibility, fundraiser oversight, donation reporting, and a more credible public presence without building this stack alone.",
  },
];

const TRUST_BAND = [
  {
    title: "Registered charity details",
    copy: "Charity profiles can surface verification status, registration references, and governance cues before donors give.",
  },
  {
    title: "Gift Aid information",
    copy: "UK taxpayers can see Gift Aid eligibility and declaration guidance at the point of intent, not buried after checkout.",
  },
  {
    title: "Payment security",
    copy: "Hosted checkout keeps payment handling secure while the platform still shows a transparent preview of fees and charity net amount.",
  },
  {
    title: "Accessibility commitment",
    copy: "GiveKhair is being designed for WCAG-aware giving flows, readable structure, and clearer decision-making on mobile and desktop.",
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
  const role = (session?.user as { role?: string } | undefined)?.role ?? "DONOR";
  const isAdmin = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role);
  const signedInHref = isAdmin ? "/admin" : session ? "/dashboard" : "/auth/signin?callbackUrl=%2Fdashboard";
  const signedInLabel = isAdmin ? "Open admin" : session ? "Open dashboard" : "Donate now";

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
        <div className="site-shell grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <TrustChip>UK Gift Aid eligible • Verified charities • Fee transparent</TrustChip>

            <h1 className="section-heading mt-6 max-w-4xl font-bold">
              Every act of <span className="text-[color:var(--color-primary)]">Khair</span> is an act of care.
            </h1>

            <p className="section-copy mt-6">
              Give to verified charities in minutes, preview exactly where fees go, and support appeals that feel credible from the first scroll to the final checkout step.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={featured ? `/appeals/${featured.slug}` : signedInHref} className="btn-primary">
                Donate now
              </Link>
              <Link href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"} className="btn-secondary">
                Start fundraising
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MiniTrustCard value="100%" label="fee clarity" />
              <MiniTrustCard value="UK" label="Gift Aid ready" />
              <MiniTrustCard value="✓" label="verified charities" />
            </div>
          </div>

          {/* The featured card mirrors the donation journey we want users to trust:
              verified charity, visible progress, and one clear CTA. */}
          <aside className="surface-card overflow-hidden p-6 sm:p-8">
            <div className="section-kicker">Featured Appeal</div>
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
                    of {formatCurrency(featuredGoal, featured.currency)} goal
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

      <section id="appeals" className="section-shell">
        <div className="site-shell">
          <SectionIntro
            eyebrow={loadError ? "Curated fallback" : "Trending now"}
            title={searchParams.q ? `Results for “${searchParams.q}”` : "Appeals people can trust quickly"}
            description="These appeal cards blend live fundraising data with clear charity context, so a donor can decide whether to give without hunting for the basics."
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
            eyebrow="Platform fit"
            title="A public experience designed for trust on every side"
            description="GiveKhair needs to reassure donors, help fundraisers convert, and show charities that the platform respects governance and transparency from day one."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title} className="surface-card p-7">
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
              <TrustChip tone="gold">Conversion with credibility</TrustChip>
              <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                Build trust before asking for money.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-teal-50 sm:text-base">
                GiveKhair is strongest when charities and fundraisers can explain the cause clearly, show verification cues early, and remove uncertainty before the donor reaches payment.
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
              <article key={item.title} className="surface-card p-6">
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
    <div className="surface-card p-5">
      <p className="text-2xl font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--color-ink-soft)]">{label}</p>
    </div>
  );
}
