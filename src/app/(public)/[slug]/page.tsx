import type { Metadata } from "next";
import { notFound } from "next/navigation";

const CONTENT: Record<string, { title: string; intro: string; body: string[] }> = {
  about: {
    title: "About GiveKhair",
    intro: "GiveKhair is being shaped as a premium, trust-first fundraising platform for verified charities, clear fee communication, and stronger public credibility.",
    body: [
      "The product direction is simple: help donors feel safe, help fundraisers convert, and help charities present themselves credibly before they ask for money.",
      "These supporting content pages are intentionally lightweight for now, but they provide clean routes for future legal, brand, and support content without breaking the public information architecture.",
    ],
  },
  fees: {
    title: "Fees",
    intro: "Fee transparency is a core GiveKhair principle, so donors should understand what they pay and what the charity receives before checkout.",
    body: [
      "Appeal pages and checkout preview cards are designed to show platform fees, processing fees, donor fee coverage, and net amount to charity without hidden surprises.",
      "As fee schedules become more advanced, this page can expand into a fuller explanation of pricing, tiers, and donor fee coverage logic.",
    ],
  },
  contact: {
    title: "Contact",
    intro: "For support, partnerships, or charity onboarding questions, the GiveKhair team can be reached through the main support channels.",
    body: [
      "The current platform copy points users toward hello@givekhair.com while the help and support experience continues to mature.",
      "This route gives the public site a stable contact destination today and a clean place for richer support details later.",
    ],
  },
  help: {
    title: "Help centre",
    intro: "The help centre will expand into donor, fundraiser, and charity guidance as the platform grows.",
    body: [
      "For now, this route acts as the foundation for practical support content covering donations, sign-in, Gift Aid, fundraiser management, and charity operations.",
    ],
  },
  accessibility: {
    title: "Accessibility Statement",
    intro: "GiveKhair aims to create a charity fundraising experience that is easier to understand, easier to navigate, and more inclusive across devices.",
    body: [
      "The current design refresh prioritises readable hierarchy, strong colour contrast, clearer buttons, and calmer, more structured surfaces.",
      "As the product evolves, this page should document standards, testing practices, and any known gaps with transparency.",
    ],
  },
  cookies: {
    title: "Cookie Policy",
    intro: "This page is the reserved route for cookie and tracking disclosures as the public policy set matures.",
    body: [
      "Right now it provides a stable legal destination for the footer while the policy content is formalised.",
    ],
  },
  terms: {
    title: "Terms of Use",
    intro: "GiveKhair needs clear, platform-appropriate terms for donors, fundraisers, and charities.",
    body: [
      "This route exists so the public footer can point at a real policy destination now, with detailed legal copy to follow.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "Privacy and donor trust are central to a credible fundraising product.",
    body: [
      "This page will house the platform's formal privacy position, covering data handling, payment-related integrations, Gift Aid information, and user rights.",
    ],
  },
  "fundraising-rules": {
    title: "Fundraising Rules",
    intro: "Fundraising on GiveKhair should be credible, compliant, and consistent with charity and donor expectations.",
    body: [
      "This route is reserved for fundraiser conduct, content expectations, moderation rules, and escalation policies as they are formalised.",
    ],
  },
  "charity-verification": {
    title: "Charity Verification",
    intro: "Charity verification is one of the most visible trust signals on the public site.",
    body: [
      "This page can expand into a fuller explanation of verification checks, publication standards, and how profile status is maintained over time.",
    ],
  },
  teams: {
    title: "Teams",
    intro: "Team fundraising lets multiple supporters raise together under one appeal while still keeping individual pages and accountability.",
    body: [
      "This route gives the public footer a home for future team-fundraising guidance and examples without waiting for the full feature surface to land.",
    ],
  },
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const entry = CONTENT[params.slug];
  return {
    title: entry?.title ?? "Page",
    description: entry?.intro,
  };
}

export function generateStaticParams() {
  return Object.keys(CONTENT).map((slug) => ({ slug }));
}

export default function PublicInfoPage({ params }: { params: { slug: string } }) {
  const entry = CONTENT[params.slug];

  if (!entry) {
    notFound();
  }

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-3xl surface-card p-8 sm:p-10">
          <span className="section-kicker">Information</span>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">{entry.title}</h1>
          <p className="mt-5 text-base leading-8 text-[color:var(--color-ink-soft)]">{entry.intro}</p>
          <div className="mt-8 grid gap-5">
            {entry.body.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-[color:var(--color-ink-soft)]">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
