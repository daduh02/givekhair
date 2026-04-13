import type { Metadata } from "next";
import { SectionIntro } from "@/components/ui/SectionIntro";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "1. Choose a verified cause",
    copy: "Donors arrive on appeal pages that explain who the charity is, what the goal funds, and how much has already been raised.",
  },
  {
    title: "2. Preview the numbers clearly",
    copy: "Fee transparency and Gift Aid cues appear before checkout so donors understand what they pay and what the charity receives.",
  },
  {
    title: "3. Give securely or start fundraising",
    copy: "Hosted checkout keeps payment handling secure while fundraisers and charities manage activity in their own operational dashboards.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <SectionIntro
          eyebrow="How it works"
          title="A clearer path from trust signal to completed donation"
          description="GiveKhair is designed to reduce uncertainty. Donors should understand the cause, the charity, the fee model, and the next step before they ever reach the hosted payment page."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.title} className="surface-card p-7">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{step.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">{step.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
