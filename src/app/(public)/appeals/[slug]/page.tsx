import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DonationCheckout } from "@/components/donation/DonationCheckout";
import { TRPCProvider } from "@/components/providers";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrustChip } from "@/components/ui/TrustChip";
import { getOrCreateAppealCheckoutPage } from "@/lib/appeal-checkout";

interface Props {
  params: { slug: string };
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

export default async function AppealPage({ params }: Props) {
  const appeal = await db.appeal.findUnique({
    where: { slug: params.slug },
    include: {
      charity: true,
      category: true,
      teams: {
        include: {
          pages: {
            where: { status: "ACTIVE" },
            include: { user: { select: { name: true, image: true } } },
          },
        },
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

  const [onlineAgg, offlineAgg, donorCount] = await Promise.all([
    db.donation.aggregate({
      where: { page: { appealId: appeal.id }, status: "CAPTURED" },
      _sum: { amount: true },
    }),
    db.offlineDonation.aggregate({
      where: { page: { appealId: appeal.id }, status: "APPROVED" },
      _sum: { amount: true },
    }),
    db.donation.groupBy({
      by: ["userId"],
      where: { page: { appealId: appeal.id }, status: "CAPTURED" },
    }),
  ]);

  const raised =
    parseFloat(onlineAgg._sum.amount?.toString() ?? "0") +
    parseFloat(offlineAgg._sum.amount?.toString() ?? "0");
  const goal = parseFloat(appeal.goalAmount.toString());
  const progress = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  const checkoutPage =
    appeal.fundraisingPages[0] ??
    appeal.teams.flatMap((team) => team.pages)[0] ??
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
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-5xl">
            {appeal.title}
          </h1>

          <div className="mt-6 max-w-3xl">
            <p className="text-4xl font-bold tracking-[-0.05em] text-[color:var(--color-primary-dark)]">
              {formatCurrency(raised, appeal.currency)}
            </p>
            <p className="mt-2 text-base text-[color:var(--color-ink-muted)]">
              raised of {formatCurrency(goal, appeal.currency)} goal · includes offline donations
            </p>
            <ProgressBar value={progress} className="mt-5" />
          </div>

          <div className="mt-6 flex flex-wrap gap-6 text-sm font-semibold text-[color:var(--color-ink-soft)]">
            <span>{donorCount.length} donors</span>
            <span>{progress}% of goal</span>
            {appeal.endsAt ? (
              <span>{Math.max(0, Math.ceil((appeal.endsAt.getTime() - Date.now()) / 86_400_000))} days left</span>
            ) : null}
            <span>Gift Aid eligible</span>
          </div>

          {appeal.story ? (
            <section className="mt-10 surface-card p-7 sm:p-8">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">About this appeal</h2>
              <p className="mt-5 whitespace-pre-line text-base leading-8 text-[color:var(--color-ink-soft)]">{appeal.story}</p>
            </section>
          ) : null}

          {appeal.fundraisingPages.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Fundraiser pages</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {appeal.fundraisingPages.map((page) => (
                  <a key={page.id} href={`/fundraise/${page.shortName}`} className="surface-card flex items-center gap-4 p-5">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-[color:var(--color-primary-soft)] font-bold text-[color:var(--color-primary-dark)]">
                      {page.user.name?.charAt(0) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[color:var(--color-ink)]">{page.title}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{page.user.name}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
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
