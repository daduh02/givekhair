import { db } from "@/lib/db";
import { Navbar } from "@/components/layout/Navbar";
import { AppealCard, type AppealCardAppeal } from "@/components/appeal/AppealCard";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Emergency relief", slug: "emergency-relief" },
  { label: "Health", slug: "health" },
  { label: "Education", slug: "education" },
  { label: "Community", slug: "community" },
  { label: "Environment", slug: "environment" },
];

export default async function HomePage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  let appeals: AppealCardAppeal[] = [];
  const raisedMap: Record<string, number> = {};
  let loadError = false;

  try {
    const dbAppeals = await db.appeal.findMany({
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

    appeals = dbAppeals.map((appeal) => ({
      ...appeal,
      goalAmount: appeal.goalAmount.toString(),
    }));

    for (const appeal of dbAppeals) {
      const [online, offline] = await Promise.all([
        db.donation.aggregate({ where: { page: { appealId: appeal.id }, status: "CAPTURED" }, _sum: { amount: true } }),
        db.offlineDonation.aggregate({ where: { page: { appealId: appeal.id }, status: "APPROVED" }, _sum: { amount: true } }),
      ]);
      raisedMap[appeal.id] =
        parseFloat(online._sum.amount?.toString() ?? "0") +
        parseFloat(offline._sum.amount?.toString() ?? "0");
    }
  } catch (error) {
    loadError = true;
    console.error("Failed to load homepage appeals", error);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8" }}>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6">

        {/* Hero */}
        <section className="py-14">
          <span className="inline-block rounded-full px-3 py-1 text-sm font-semibold mb-4"
            style={{ background: "rgba(30,140,110,0.1)", color: "#124E40" }}>
            A world that cares.
          </span>
          <h1 className="text-4xl font-bold leading-tight mb-4 md:text-5xl" style={{ color: "#233029", maxWidth: "620px" }}>
            Every act of <span style={{ color: "#1E8C6E" }}>Khair</span> is an act of care.
          </h1>
          <p className="text-lg mb-8" style={{ color: "#3A4A42", maxWidth: "560px" }}>
            Create a fundraising page, support a cause, or run your charity appeal.
            Gift Aid eligible and completely fee-transparent.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/fundraise/new" className="btn-primary">Start fundraising</Link>
            <Link href="#appeals" className="btn-outline">Browse appeals</Link>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "linear-gradient(135deg,#D4A24C,#EBCB86)", color: "#2B210E" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#2B210E" }} />
              UK Gift Aid eligible
            </span>
          </div>
        </section>

        {/* Trust bar */}
        <div className="flex flex-wrap gap-6 text-sm mb-10 pb-8" style={{ borderBottom: "1px solid rgba(18,78,64,0.12)", color: "#3A4A42" }}>
          <span>🔒 PCI-DSS Level 1</span>
          <span>🇬🇧 UK Gift Aid</span>
          <span>💸 Full fee transparency</span>
          <span>♿ WCAG 2.2 AA</span>
        </div>

        {/* Appeals */}
        <section id="appeals" className="pb-16">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => (
              <Link key={cat.slug} href={cat.slug ? `/?category=${cat.slug}` : "/"}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: (searchParams.category ?? "") === cat.slug ? "#124E40" : "white",
                  color: (searchParams.category ?? "") === cat.slug ? "#F6F1E8" : "#3A4A42",
                  border: "1px solid rgba(18,78,64,0.18)",
                }}>
                {cat.label}
              </Link>
            ))}
          </div>

          <h2 className="text-xl font-bold mb-5" style={{ color: "#233029" }}>
            {searchParams.q ? `Results for "${searchParams.q}"` : searchParams.category
              ? CATEGORIES.find((c) => c.slug === searchParams.category)?.label ?? "Appeals"
              : "Featured appeals"}
          </h2>

          {loadError ? (
            <div className="rounded-3xl border px-6 py-10 text-center" style={{ borderColor: "rgba(18,78,64,0.12)", background: "white" }}>
              <p className="text-lg font-semibold" style={{ color: "#233029" }}>We&apos;re getting GiveKhair ready.</p>
              <p className="mt-3" style={{ color: "#3A4A42" }}>
                The public appeal directory is temporarily unavailable while the platform finishes connecting to its live services.
              </p>
              <p className="mt-2 text-sm" style={{ color: "#8A9E94" }}>
                Please try again shortly, or contact hello@givekhair.com if you need help right away.
              </p>
            </div>
          ) : appeals.length === 0 ? (
            <p className="py-16 text-center" style={{ color: "#3A4A42" }}>No appeals found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {appeals.map((appeal) => (
                <AppealCard key={appeal.id}
                  appeal={appeal}
                  raisedAmount={raisedMap[appeal.id] ?? 0} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "rgba(18,78,64,0.12)", color: "#3A4A42" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm md:flex-row">
          <span>© {new Date().getFullYear()} GiveKhair. All rights reserved.</span>
          <div className="flex gap-2">
            {["instagram.com/givekhair", "twitter.com/givekhair"].map((href) => (
              <a key={href} href={`https://${href}`}
                className="grid h-9 w-9 place-items-center rounded-lg"
                style={{ background: "#124E40", color: "#F6F1E8" }}>
                <span className="text-xs">↗</span>
              </a>
            ))}
            <a href="mailto:hello@givekhair.com"
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{ background: "#124E40", color: "#F6F1E8" }}>✉</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
