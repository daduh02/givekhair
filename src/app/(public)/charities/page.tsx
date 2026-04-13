import type { Metadata } from "next";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";
import { CharityDirectoryCard } from "@/components/charity/CharityDirectoryCard";
import { getPublicCharityDirectory } from "@/lib/public-charities";

export const metadata: Metadata = {
  title: "Charities",
  description: "Browse public GiveKhair charity profiles with verification cues, active appeals, and live trust signals.",
};

export default async function CharitiesPage() {
  const charities = await getPublicCharityDirectory();
  const verifiedCount = charities.filter((charity) => charity.isVerified).length;

  return (
    <main>
      <section className="section-shell">
        <div className="site-shell">
          <div className="hero-frame px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <TrustChip tone="gold">Public charity profiles</TrustChip>

            <SectionIntro
              eyebrow="Charity directory"
              title="Explore charities with stronger public trust signals"
              description="Each profile is designed to help donors understand who the charity is, what it is fundraising for, and whether the public campaign surface feels credible before they ever reach checkout."
              actions={
                <>
                  <span className="trust-chip bg-white text-[color:var(--color-ink-soft)]">{charities.length} listed charities</span>
                  <span className="trust-chip bg-white text-[color:var(--color-ink-soft)]">{verifiedCount} verified</span>
                </>
              }
            />
          </div>
        </div>
      </section>

      <section className="section-shell-tight section-sandband">
        <div className="site-shell">
          <div className="grid gap-5 lg:grid-cols-3">
            {charities.map((charity) => (
              <CharityDirectoryCard key={charity.id} charity={charity} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
