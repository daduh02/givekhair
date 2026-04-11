import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { AppealCard } from "@/components/appeal/AppealCard";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

const CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Emergency relief", slug: "emergency-relief" },
  { label: "Health", slug: "health" },
  { label: "Education", slug: "education" },
  { label: "Community", slug: "community" },
  { label: "Environment", slug: "environment" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const appeals = await db.appeal.findMany({
    where: {
      status: "ACTIVE",
      visibility: "PUBLIC",
      ...(searchParams.category && { category: { slug: searchParams.category } }),
      ...(searchParams.q && { title: { contains: searchParams.q, mode: "insensitive" } }),
    },
    include: {
      charity: { select: { name: true, logoUrl: true, isVerified: true } },
      _count: { select: { fundraisingPages: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  // Aggregate raised amounts (online + offline) for each appeal
  const raisedMap: Record<string, number> = {};
  for (const appeal of appeals) {
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
    raisedMap[appeal.id] =
      parseFloat(online._sum.amount?.toString() ?? "0") +
      parseFloat(offline._sum.amount?.toString() ?? "0");
  }

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-green-50 px-4 py-16 text-center sm:px-6">
          <h1 className="mb-3 text-3xl font-semibold text-green-900 sm:text-4xl">
            Give charity, give khair
          </h1>
          <p className="mb-8 text-base text-green-700">
            Create a fundraising page, support a cause, or run your charity appeal.
            Gift Aid eligible and completely fee-transparent.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/fundraise/new" className="btn-primary px-7 py-3 text-base">
              Start fundraising
            </Link>
            <Link href="#appeals" className="btn-outline px-7 py-3 text-base">
              Browse appeals
            </Link>
          </div>
        </section>

        {/* Trust bar */}
        <div className="border-y border-gray-100 bg-white px-4 py-4">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <span>🔒 PCI-DSS Level 1</span>
            <span>🇬🇧 UK Gift Aid eligible</span>
            <span>💸 Full fee transparency</span>
            <span>♿ WCAG 2.2 AA</span>
          </div>
        </div>

        {/* Appeals grid */}
        <section id="appeals" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Category filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.slug ? `/?category=${cat.slug}` : "/"}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  (searchParams.category ?? "") === cat.slug
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-green-400"
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <h2 className="mb-5 text-lg font-medium text-gray-900">
            {searchParams.q
              ? `Results for "${searchParams.q}"`
              : searchParams.category
              ? CATEGORIES.find((c) => c.slug === searchParams.category)?.label ?? "Appeals"
              : "Featured appeals"}
          </h2>

          {appeals.length === 0 ? (
            <p className="py-16 text-center text-gray-400">No appeals found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {appeals.map((appeal) => (
                <AppealCard
                  key={appeal.id}
                  appeal={{ ...appeal, goalAmount: appeal.goalAmount.toString() }}
                  raisedAmount={raisedMap[appeal.id] ?? 0}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
