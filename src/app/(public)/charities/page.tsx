import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";

export const metadata: Metadata = { title: "Charities" };

export default async function CharitiesPage() {
  const charities = await db.charity.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { _count: { select: { appeals: true } } },
  });

  return (
    <main className="section-shell">
      <div className="site-shell">
        <SectionIntro
          eyebrow="Charity directory"
          title="Explore verified charities building trust before the ask"
          description="This public directory is still early, but the goal is clear: each charity profile should make governance, purpose, and active appeals easy to understand."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {charities.map((charity) => (
            <article key={charity.id} className="surface-card p-7">
              <div className="flex flex-wrap gap-2">
                <TrustChip>{charity.defaultCurrency}</TrustChip>
                {charity.isVerified ? <TrustChip tone="gold">Verified</TrustChip> : null}
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{charity.name}</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
                {charity.shortDescription || "This charity profile is being expanded with more public-facing trust and impact details."}
              </p>
              <p className="mt-5 text-sm font-semibold text-[color:var(--color-ink-muted)]">
                {charity._count.appeals} active or draft appeals
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/?q=${encodeURIComponent(charity.name)}`} className="btn-secondary">View related appeals</Link>
                {charity.websiteUrl ? (
                  <a href={charity.websiteUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                    Visit website
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
