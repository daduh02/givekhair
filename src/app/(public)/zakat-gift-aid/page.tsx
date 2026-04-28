import Link from "next/link";
import type { Metadata } from "next";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";

export const metadata: Metadata = { title: "Zakat & Gift Aid" };

const SECTIONS = [
  {
    kicker: "Gift Aid made simple",
    title: "Gift Aid should be clear, not hidden.",
    copy:
      "GiveKhair surfaces Gift Aid prompts close to the donation decision so eligible UK taxpayers can understand the extra impact before they complete checkout.",
  },
  {
    kicker: "Zakat giving guidance",
    title: "Zakat giving deserves careful context.",
    copy:
      "Charities can provide campaign-specific guidance where appropriate. Donors should check with a qualified adviser where needed before making a decision about Zakat eligibility.",
  },
  {
    kicker: "Restricted funds and donor intent",
    title: "Donor intent should be respected and explained clearly.",
    copy:
      "Campaign pages can help explain what a donation is intended for, whether a fund is restricted, and how the charity is framing the appeal publicly.",
  },
  {
    kicker: "What charities can explain on GiveKhair",
    title: "Better giving pages start with better explanation.",
    copy:
      "Charities can use public pages to give supporters clearer context around the cause, the appeal, and how donations are being positioned before checkout.",
  },
];

export default function ZakatGiftAidPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <SectionIntro
          eyebrow="Guidance"
          title="Zakat, Gift Aid, and clearer giving context"
          description="This page is here to make the public giving journey easier to understand. It does not provide formal religious or legal rulings, but it can help charities and donors frame the right questions clearly."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {SECTIONS.map((section, index) => (
            <article key={section.title} className="surface-card p-6">
              <TrustChip tone={index === 0 ? "gold" : "default"}>{section.kicker}</TrustChip>
              <h2 className="mt-5 text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{section.copy}</p>
            </article>
          ))}
        </div>

        <div className="section-panel mt-10 p-7 sm:p-8">
          <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Ready to support an appeal?</h2>
          <p className="mt-3 max-w-[40rem] text-sm leading-7 text-[color:var(--color-ink-soft)]">
            Explore live public appeals and look for the guidance each charity provides on its campaign pages.
          </p>
          <div className="mt-6">
            <Link href="/#appeals" className="btn-primary">
              Explore appeals
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
