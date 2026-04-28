import Link from "next/link";
import type { Metadata } from "next";
import { SectionIntro } from "@/components/ui/SectionIntro";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "Choose a verified cause",
    copy: "Browse appeals that help explain the charity, the goal, and what support has already been given.",
  },
  {
    title: "See the giving details clearly",
    copy: "Fee and Gift Aid cues are shown before checkout so donors can understand the next step with confidence.",
  },
  {
    title: "Donate securely or start fundraising",
    copy: "Support the cause directly or create a fundraiser that helps more people take part.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <SectionIntro
          eyebrow="How it works"
          title="A clearer path from trust signal to completed donation"
          description="GiveKhair is designed to help donors understand the cause, the charity, and the giving journey before they ever reach the hosted payment page."
        />

        <div className="relative mt-10 grid gap-5 lg:grid-cols-3">
          <div className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-10 hidden h-px bg-[linear-gradient(90deg,rgba(15,118,110,0.08),rgba(15,118,110,0.28),rgba(15,118,110,0.08))] lg:block" />
          {STEPS.map((step, index) => (
            <article key={step.title} className="surface-card relative p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(204,251,241,0.82)] text-base font-bold text-[color:var(--color-primary-dark)]">
                {index + 1}
              </div>
              <h2 className="mt-5 text-[1.4rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{step.copy}</p>
            </article>
          ))}
        </div>

        <div className="section-panel mt-10 p-7 sm:p-8">
          <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Ready to support a cause?</h2>
          <p className="mt-3 max-w-[40rem] text-sm leading-7 text-[color:var(--color-ink-soft)]">
            Explore public appeals or create a fundraiser for a cause you care about.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/#appeals" className="btn-primary">
              Explore appeals
            </Link>
            <Link href="/auth/signin?callbackUrl=%2Ffundraise%2Fnew" className="btn-outline">
              Start fundraising
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
