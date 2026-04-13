import type { Metadata } from "next";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";

export const metadata: Metadata = { title: "Zakat & Gift Aid" };

export default function ZakatGiftAidPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <SectionIntro
          eyebrow="Guidance"
          title="Zakat, Gift Aid, and better giving context"
          description="This page is the future home for clearer donor guidance on compliant giving, UK Gift Aid eligibility, and how charities can communicate restricted funds with confidence."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="surface-card p-7">
            <TrustChip tone="gold">Gift Aid ready</TrustChip>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Gift Aid should be clear, not hidden.</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
              GiveKhair surfaces Gift Aid prompts near the donor decision so eligible UK taxpayers can understand the boost before they complete checkout.
            </p>
          </article>
          <article className="surface-card p-7">
            <TrustChip>Zakat context</TrustChip>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Faith-sensitive giving deserves stronger cues.</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
              As the product matures, charities and appeals can communicate whether a campaign is suitable for Zakat, Sadaqah, or general giving with better supporting detail.
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}
