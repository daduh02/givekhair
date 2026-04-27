import Link from "next/link";
import type { Metadata } from "next";
import {
  charityProducts,
  PRODUCT_CAPABILITY_COLUMNS,
  type CharityProduct,
  type CharityProductIcon,
} from "@/lib/charity-products";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { TrustChip } from "@/components/ui/TrustChip";

export const metadata: Metadata = {
  title: "Charity Fundraising Products",
  description:
    "Explore GiveKhair’s fundraising products for Muslim charities, including campaign pages, donation checkout, QR giving, Ramadan tools, team fundraising and reporting.",
};

const MUSLIM_CHARITY_BENEFITS = [
  {
    title: "Built around Islamic giving moments",
    copy:
      "Ramadan, Zakat, Sadaqah, mosque campaigns, emergency appeals, and community fundraising all need different rhythms. GiveKhair keeps those journeys under one trusted platform.",
  },
  {
    title: "Clear for donors, practical for teams",
    copy:
      "Charity teams need more than a donate button. GiveKhair connects appeals, fundraiser pages, offline giving, Gift Aid, reporting, and finance workflows without splitting the experience across separate tools.",
  },
  {
    title: "Designed for trust on every screen",
    copy:
      "Mobile-first donation journeys, warm presentation, and clear trust cues help Muslim charities meet supporters where they are, from mosque posters to event stages to personal fundraiser pages.",
  },
];

const FEATURED_PRODUCT_SLUGS = new Set([
  "campaign-pages",
  "donation-checkout",
  "reporting-insights",
  "fundraising-pages",
  "team-pages",
  "ramadan-toolkit",
]);

function ProductIcon({ icon }: { icon: CharityProductIcon }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    className: "h-6 w-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "campaign":
      return (
        <svg {...commonProps}>
          <path d="M4 6h16v12H4z" />
          <path d="M8 10h8" />
          <path d="M8 14h5" />
        </svg>
      );
    case "checkout":
      return (
        <svg {...commonProps}>
          <path d="M5 7h14" />
          <path d="M7 5v14" />
          <path d="M17 5v14" />
          <path d="M5 17h14" />
          <path d="M10 11h4" />
        </svg>
      );
    case "reporting":
      return (
        <svg {...commonProps}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
        </svg>
      );
    case "qr":
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="5" height="5" />
          <rect x="15" y="4" width="5" height="5" />
          <rect x="4" y="15" width="5" height="5" />
          <path d="M15 15h2v2h-2z" />
          <path d="M18 18h2v2h-2z" />
        </svg>
      );
    case "fundraiser":
      return (
        <svg {...commonProps}>
          <path d="M12 21s-6-4-6-9a4 4 0 0 1 6-3.4A4 4 0 0 1 18 12c0 5-6 9-6 9Z" />
          <path d="M12 9v6" />
          <path d="M9.5 12h5" />
        </svg>
      );
    case "team":
      return (
        <svg {...commonProps}>
          <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M16 11a2.5 2.5 0 1 0 0-5" />
          <path d="M3.5 19a5.5 5.5 0 0 1 9 0" />
          <path d="M14 19a4.5 4.5 0 0 1 6 0" />
        </svg>
      );
    case "ramadan":
      return (
        <svg {...commonProps}>
          <path d="M15.5 5.5a5.5 5.5 0 1 0 0 13A6.5 6.5 0 1 1 15.5 5.5Z" />
          <path d="M17.5 6.5 18 8l1.5.5L18 9l-.5 1.5L17 9l-1.5-.5L17 8Z" />
        </svg>
      );
    case "mosque":
      return (
        <svg {...commonProps}>
          <path d="M4 20h16" />
          <path d="M6 20v-6l6-5 6 5v6" />
          <path d="M12 9V4" />
          <path d="M14 4h3" />
        </svg>
      );
    case "event":
      return (
        <svg {...commonProps}>
          <path d="M7 5h10" />
          <path d="M7 3v4" />
          <path d="M17 3v4" />
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M8 12h8" />
        </svg>
      );
    case "crm":
      return (
        <svg {...commonProps}>
          <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M5 20a7 7 0 0 1 14 0" />
          <path d="M18 8h2" />
          <path d="M19 7v2" />
        </svg>
      );
    case "whiteLabel":
      return (
        <svg {...commonProps}>
          <path d="M5 19V7l7-3 7 3v12" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      );
  }
}

function ProductCard({ product }: { product: CharityProduct }) {
  return (
    <article className="surface-card relative overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(204,251,241,0.55),rgba(254,243,199,0.45),transparent)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[1.2rem] bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_14px_28px_rgba(15,118,110,0.2)]">
            <ProductIcon icon={product.icon} />
          </div>
          <TrustChip>{product.category}</TrustChip>
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">{product.title}</h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{product.shortDescription}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {product.features.map((feature) => (
            <span key={feature} className="trust-chip">
              {feature}
            </span>
          ))}
        </div>

        <div className="mt-6">
          <Link href={product.href} className="btn-outline">
            {product.primaryCta}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProductFeatureSection({ product, index }: { product: CharityProduct; index: number }) {
  const reverse = index % 2 === 1;

  return (
    <section
      id={product.slug}
      className={`grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""}`}
    >
      <article className="section-panel overflow-hidden p-7 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_16px_30px_rgba(15,118,110,0.22)]">
            <ProductIcon icon={product.icon} />
          </div>
          <div>
            <p className="section-kicker">{product.category}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">{product.title}</h2>
          </div>
        </div>

        <p className="mt-6 text-base leading-8 text-[color:var(--color-ink-soft)]">{product.longDescription}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={product.href} className="btn-primary">
            {product.primaryCta}
          </Link>
          <Link href="#speak-to-us" className="btn-outline">
            Speak to us
          </Link>
        </div>
      </article>

      <article className="surface-card p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]">What charities get</p>
        <div className="mt-5 grid gap-3">
          {product.features.map((feature) => (
            <div
              key={feature}
              className="rounded-[1.2rem] border border-[rgba(15,118,110,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,245,239,0.9))] px-4 py-4 text-sm font-semibold text-[color:var(--color-ink-soft)] shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
            >
              {feature}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export default function CharityProductsPage() {
  const featuredProducts = charityProducts.filter((product) => FEATURED_PRODUCT_SLUGS.has(product.slug));

  return (
    <main>
      <section className="section-shell">
        <div className="site-shell">
          <div className="hero-frame overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="relative z-[1]">
                <span className="section-kicker">For charities</span>
                <h1 className="mt-6 font-serif text-5xl font-semibold tracking-[-0.05em] text-[color:var(--color-ink)] sm:text-6xl">
                  Everything Muslim charities need to raise more with GiveKhair
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-[color:var(--color-ink-soft)]">
                  Campaign pages, donation checkout, QR giving, team fundraising, Ramadan tools and reporting —
                  all built for modern Islamic giving.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/fundraise/new" className="btn-primary">
                    Start fundraising
                  </Link>
                  <Link href="#speak-to-us" className="btn-outline">
                    Speak to us
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  <TrustChip>Ramadan-ready journeys</TrustChip>
                  <TrustChip>Appeals, teams, and fundraising pages</TrustChip>
                  <TrustChip>Reporting and offline giving visibility</TrustChip>
                </div>
              </div>

              <div className="relative z-[1] grid gap-4 sm:grid-cols-2">
                {featuredProducts.map((product, index) => (
                  <article
                    key={product.slug}
                    className={`rounded-[1.6rem] border border-[rgba(15,23,42,0.08)] p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ${
                      index % 2 === 0
                        ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(204,251,241,0.55))]"
                        : "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,243,199,0.52))]"
                    }`}
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-[1rem] bg-white text-[color:var(--color-primary-dark)] shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                      <ProductIcon icon={product.icon} />
                    </div>
                    <h2 className="mt-5 text-xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{product.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">{product.shortDescription}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell-tight">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Product suite"
            title="A connected product stack for Muslim charities"
            description="Every product below is designed to work with the giving surfaces GiveKhair already offers today, or to route interested charities safely to the right conversation when a tailored setup makes more sense."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {charityProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell section-sandband">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Built for Muslim charities"
            title="Designed around how Islamic fundraising actually happens"
            description="From Ramadan calendars and Jummah collections to emergency appeals and community challenge events, GiveKhair is shaped around the fundraising realities Muslim charities face every year."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {MUSLIM_CHARITY_BENEFITS.map((benefit) => (
              <article key={benefit.title} className="trust-card p-6">
                <h2 className="text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">{benefit.title}</h2>
                <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">{benefit.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Deep dive"
            title="What each product does best"
            description="The product set below shows how GiveKhair can support campaign launches, operational visibility, supporter-led fundraising, and tailored charity setups without fragmenting the donor journey."
          />

          <div className="mt-10 grid gap-6">
            {charityProducts.map((product, index) => (
              <ProductFeatureSection key={product.slug} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell section-sandband">
        <div className="site-shell">
          <SectionIntro
            eyebrow="Comparison"
            title="Which GiveKhair products help with what"
            description="Use this view to see where each product supports donations, fundraising, reporting, QR-led giving, Ramadan activity, mosque campaigns, and event fundraising."
          />

          <div className="mt-10 overflow-hidden rounded-[1.7rem] border border-[color:var(--color-line)] bg-white shadow-[var(--shadow-card)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-[linear-gradient(180deg,rgba(248,245,239,0.95),rgba(255,255,255,0.96))] text-left">
                    <th className="px-5 py-4 text-sm font-semibold text-[color:var(--color-ink)]">Product</th>
                    {PRODUCT_CAPABILITY_COLUMNS.map((column) => (
                      <th key={column.key} className="px-4 py-4 text-sm font-semibold text-[color:var(--color-ink)]">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charityProducts.map((product) => (
                    <tr key={product.slug} className="border-t border-[color:var(--color-line)]">
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-[color:var(--color-ink)]">{product.title}</div>
                        <div className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{product.category}</div>
                      </td>
                      {PRODUCT_CAPABILITY_COLUMNS.map((column) => {
                        const active = product.capabilities.includes(column.key);
                        return (
                          <td key={column.key} className="px-4 py-4 align-middle">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                active
                                  ? "bg-[rgba(15,118,110,0.12)] text-[color:var(--color-primary-dark)]"
                                  : "bg-[rgba(15,23,42,0.06)] text-[color:var(--color-ink-muted)]"
                              }`}
                              aria-label={active ? `${product.title} supports ${column.label}` : `${product.title} does not focus on ${column.label}`}
                            >
                              {active ? "✓" : "–"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="speak-to-us" className="section-shell">
        <div className="site-shell">
          <div className="hero-frame px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <span className="section-kicker">Next step</span>
                <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-5xl">
                  Ready to grow your charity&apos;s giving?
                </h2>
                <p className="mt-5 text-base leading-8 text-[color:var(--color-ink-soft)]">
                  GiveKhair brings together the tools Muslim charities need to raise more, manage campaigns and build
                  lasting donor relationships.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/fundraise/new" className="btn-primary">
                  Start fundraising
                </Link>
                <Link href="/contact" className="btn-outline">
                  Speak to us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
