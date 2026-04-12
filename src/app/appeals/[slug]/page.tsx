import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { DonationCheckout } from "@/components/donation/DonationCheckout";
import { TRPCProvider } from "@/components/providers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getOrCreateAppealCheckoutPage } from "@/lib/appeal-checkout";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const appeal = await db.appeal.findUnique({ where: { slug: params.slug }, select: { title: true } });
  return { title: appeal?.title ?? "Appeal" };
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

  if (!appeal || appeal.visibility === "HIDDEN") notFound();

  // Aggregate totals
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
  const pct = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: appeal.currency, maximumFractionDigits: 0 }).format(n);

  // Every appeal page needs a donation target, even if no public fundraiser page exists yet.
  const firstPage =
    appeal.fundraisingPages[0] ??
    appeal.teams.flatMap((team) => team.pages)[0] ??
    await getOrCreateAppealCheckoutPage({
      appealId: appeal.id,
      appealTitle: appeal.title,
      appealSlug: appeal.slug,
      charityId: appeal.charityId,
      currency: appeal.currency,
    });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">

          {/* Left col — appeal info */}
          <div className="lg:col-span-2">
            {/* Banner */}
            <div className="relative mb-6 h-52 overflow-hidden rounded-xl bg-green-100 sm:h-64">
              {appeal.bannerUrl ? (
                <Image src={appeal.bannerUrl} alt={appeal.title} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-6xl">🌿</div>
              )}
            </div>

            {/* Charity badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="font-medium text-gray-800">{appeal.charity.name}</span>
              {appeal.charity.isVerified && <span className="text-green-600">✓ Verified</span>}
            </div>

            <h1 className="mb-2 text-2xl font-semibold text-gray-900">{appeal.title}</h1>

            {/* Progress */}
            <p className="mb-1 text-2xl font-semibold text-green-700">{formatCurrency(raised)}</p>
            <p className="mb-2 text-sm text-gray-500">raised of {formatCurrency(goal)} goal · includes offline donations</p>
            <div className="progress-bar mb-2 h-3">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mb-6 flex flex-wrap gap-6 text-sm text-gray-500">
              <span><strong className="text-gray-900">{donorCount.length}</strong> donors</span>
              <span><strong className="text-gray-900">{pct}%</strong> of goal</span>
              {appeal.endsAt && (
                <span>
                  <strong className="text-gray-900">
                    {Math.max(0, Math.ceil((appeal.endsAt.getTime() - Date.now()) / 86_400_000))}
                  </strong>{" "}
                  days left
                </span>
              )}
              <span className="badge-green">Gift Aid eligible</span>
            </div>

            {/* Story */}
            {appeal.story && (
              <div className="prose prose-sm max-w-none mb-8">
                <h2 className="text-base font-medium">About this appeal</h2>
                <p className="text-gray-700 whitespace-pre-line">{appeal.story}</p>
              </div>
            )}

            {/* Fundraising pages */}
            {appeal.fundraisingPages.length > 0 && (
              <section>
                <h2 className="mb-4 text-base font-medium text-gray-900">Fundraisers</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {appeal.fundraisingPages.map((page) => (
                    <a
                      key={page.id}
                      href={`/fundraise/${page.shortName}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:border-green-300 transition-colors"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-800">
                        {page.user.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{page.title}</p>
                        <p className="text-xs text-gray-400">{page.user.name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right col — donation widget */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            {firstPage ? (
              <TRPCProvider>
                <DonationCheckout
                  pageId={firstPage.id}
                  charityId={appeal.charityId}
                  charityName={appeal.charity.name}
                  pageName={appeal.title}
                />
              </TRPCProvider>
            ) : (
              <div className="card text-center text-sm text-gray-500">
                <p className="mb-3">No fundraising pages yet.</p>
                <a href={`/fundraise/new?appealId=${appeal.id}`} className="btn-primary">
                  Start fundraising
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
