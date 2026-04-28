import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AppealCard } from "@/components/appeal/AppealCard";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";
import { getPublicCharityProfile } from "@/lib/public-charities";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  params: { slug: string };
}

function formatCurrency(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getAppealRaisedAmounts(appealIds: string[]) {
  // The cards on this page should reflect real totals instead of placeholder
  // percentages, so we map the appeal ids to explicit online/offline totals.
  const values = await Promise.all(
    appealIds.map(async (appealId) => {
      const [online, offline] = await Promise.all([
        db.donation.aggregate({
          where: { status: "CAPTURED", page: { appealId } },
          _sum: { amount: true },
        }),
        db.offlineDonation.aggregate({
          where: { status: "APPROVED", page: { appealId } },
          _sum: { amount: true },
        }),
      ]);

      return [
        appealId,
        parseFloat(online._sum.amount?.toString() ?? "0") + parseFloat(offline._sum.amount?.toString() ?? "0"),
      ] as const;
    })
  );

  return new Map(values);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await db.charity.findFirst({
    where: { slug: params.slug, status: "ACTIVE" },
    select: { name: true, shortDescription: true, fullDescription: true },
  });

  return {
    title: profile?.name ?? "Charity profile",
    description:
      profile?.shortDescription ??
      profile?.fullDescription ??
      "Public GiveKhair charity profile with verification, live appeals, and public trust information.",
  };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-3 text-[1.85rem] font-bold tracking-[-0.04em] text-[color:var(--color-primary-dark)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-ink-soft)]">{hint}</p>
    </div>
  );
}

export default async function CharityProfilePage({ params }: Props) {
  const profile = await getPublicCharityProfile(params.slug);
  const raisedByAppeal = await getAppealRaisedAmounts(profile.charity.appeals.map((appeal) => appeal.id));

  return (
    <main>
      <section className="section-shell">
        <div className="site-shell">
          <div className="hero-frame overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div>
                <div className="flex flex-wrap gap-3">
                  <TrustChip tone="gold">
                    {profile.charity.isVerified ? "Verified charity profile" : "Public charity profile"}
                  </TrustChip>
                  <TrustChip>{profile.charity.defaultCurrency}</TrustChip>
                  {profile.charity.charityNumber ? <TrustChip>Charity no. {profile.charity.charityNumber}</TrustChip> : null}
                </div>

                <div className="mt-8 flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-[1.1rem] border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-card)]">
                    {profile.charity.logoUrl ? (
                      <Image src={profile.charity.logoUrl} alt={profile.charity.name} fill className="object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[color:var(--color-primary-soft)] text-xl font-bold text-[color:var(--color-primary-dark)]">
                        {profile.charity.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="section-kicker">Public charity profile</p>
                    <h1 className="section-heading mt-3 max-w-[14ch] text-[clamp(2.2rem,5vw,3.5rem)]">{profile.charity.name}</h1>
                  </div>
                </div>

                <p className="section-copy mt-6 max-w-[42rem]">
                  {profile.charity.fullDescription ||
                    profile.charity.shortDescription ||
                    "This charity profile is being expanded with a clearer public narrative, governance detail, and stronger context around why donors should trust the appeals published here."}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  {profile.charity.websiteUrl ? (
                    <a href={profile.charity.websiteUrl} target="_blank" rel="noreferrer" className="btn-outline">
                      Visit charity website
                    </a>
                  ) : null}
                  <Link href="/charities" className="btn-primary">
                    Back to directory
                  </Link>
                </div>
              </div>

              {/* This trust panel gives a donor the "why trust them?" answer fast,
                  while the lower sections carry the richer narrative and appeals. */}
              <aside className="surface-card p-6 sm:p-7">
                <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Trust and profile summary</h2>
                <div className="mt-5 grid gap-4">
                  <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Verification</p>
                    <p className="mt-2 text-lg font-bold text-[color:var(--color-ink)]">
                      {profile.charity.isVerified ? "Verified on GiveKhair" : profile.charity.verificationStatus}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Registered details</p>
                    <p className="mt-2 text-lg font-bold text-[color:var(--color-ink)]">
                      {profile.charity.charityNumber ? `Charity no. ${profile.charity.charityNumber}` : "Registration details pending"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Public contact</p>
                    <p className="mt-2 text-lg font-bold break-all text-[color:var(--color-ink)]">
                      {profile.charity.contactEmail ?? "Contact email coming soon"}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Raised"
            value={formatCurrency(profile.raisedTotal, profile.charity.defaultCurrency)}
            hint="Includes online donations and approved offline entries across this charity's public appeals."
          />
          <StatCard
            label="Live appeals"
            value={String(profile.charity.appeals.length)}
            hint="Public campaigns donors can review and support right now."
          />
          <StatCard
            label="Fundraisers"
            value={String(profile.fundraiserCount)}
            hint="Recent public fundraiser pages connected to this charity's active appeal portfolio."
          />
          <StatCard
            label="Teams"
            value={String(profile.teamsCount)}
            hint="Active public fundraising teams helping expand reach beyond the main appeal page."
          />
        </div>
      </section>

      <section className="section-shell-tight section-sandband">
        <div className="site-shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card p-6 sm:p-7">
            <SectionIntro
              eyebrow="About this charity"
              title="A clearer public story before the donation ask"
              description={
                profile.charity.shortDescription ||
                "This public charity profile is designed to carry the story, trust detail, and campaign context donors need before they commit."
              }
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Default currency</p>
                <p className="mt-2 text-lg font-bold text-[color:var(--color-ink)]">{profile.charity.defaultCurrency}</p>
              </div>
              <div className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">Status</p>
                <p className="mt-2 text-lg font-bold text-[color:var(--color-ink)]">{profile.charity.status}</p>
              </div>
            </div>
          </div>

          <div className="surface-card p-6 sm:p-7">
            <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Recent fundraiser pages</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
              These public fundraiser pages help donors see who is amplifying the cause and how the appeal is spreading through teams and supporters.
            </p>

            <div className="mt-6 grid gap-4">
              {profile.fundraiserPages.length > 0 ? (
                profile.fundraiserPages.map((page) => (
                  <Link key={page.id} href={`/fundraise/${page.shortName}`} className="rounded-[1rem] border border-[color:var(--color-line)] bg-white p-4 transition-transform duration-200 hover:-translate-y-0.5">
                    <p className="font-semibold text-[color:var(--color-ink)]">{page.title}</p>
                    <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
                      {page.user.name ?? "Fundraiser"} · {page.appeal.title}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[color:var(--color-line)] bg-white p-4 text-sm leading-7 text-[color:var(--color-ink-muted)]">
                  No public fundraiser pages are live yet, but the charity profile is ready to support them as campaigns launch.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Active appeals"
            title={`Support ${profile.charity.name} through live campaigns`}
            description="The profile page should naturally flow into active appeals, so the donor can move from trust and context into a specific cause without losing confidence."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {profile.charity.appeals.length > 0 ? (
              profile.charity.appeals.map((appeal) => (
                <AppealCard
                  key={appeal.id}
                  appeal={{
                    ...appeal,
                    goalAmount: appeal.goalAmount.toString(),
                  }}
                  raisedAmount={raisedByAppeal.get(appeal.id) ?? 0}
                />
              ))
            ) : (
              <EmptyState
                title="This charity does not have any public active appeals right now."
                description="The charity profile is live, but there are no active public appeal pages to show at the moment."
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
