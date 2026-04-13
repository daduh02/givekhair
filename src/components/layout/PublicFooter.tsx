import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/#appeals", label: "Appeals" },
      { href: "/charities", label: "Charities" },
      { href: "/teams", label: "Teams" },
      { href: "/?category=emergency-relief", label: "Urgent causes" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/fees", label: "Fees" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/zakat-gift-aid", label: "Zakat & Gift Aid" },
      { href: "/accessibility", label: "Accessibility Statement" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/accessibility", label: "Accessibility Statement" },
  { href: "/fundraising-rules", label: "Fundraising Rules" },
  { href: "/charity-verification", label: "Charity Verification" },
];

const SOCIAL_LINKS = [
  { href: "https://instagram.com/givekhair", label: "Instagram" },
  { href: "https://x.com/givekhair", label: "X" },
  { href: "https://linkedin.com/company/givekhair", label: "LinkedIn" },
];

export function PublicFooter() {
  return (
    <footer className="mt-16 bg-[color:var(--color-ink)] text-white">
      <div className="site-shell py-14">
        <div className="grid gap-10 border-b border-white/10 pb-10 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="footer-column max-w-md">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_10px_26px_rgba(15,118,110,0.25)]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.03em]">GiveKhair</h2>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trust-first giving</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                A warm, trust-first fundraising platform built to help donors give with confidence,
                fundraisers convert with clarity, and charities present impact credibly.
              </p>
            </div>

            {/* Footer trust chips mirror the homepage trust language so the brand
                feels consistent from first impression to last scroll. */}
            <div className="flex flex-wrap gap-2">
              <span className="trust-chip bg-white/8 text-white border-white/10">Verified charities</span>
              <span className="trust-chip bg-white/8 text-white border-white/10">Gift Aid ready</span>
              <span className="trust-chip bg-white/8 text-white border-white/10">Transparent fees</span>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="footer-column">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{column.title}</h3>
              <div className="footer-link-list">
                {column.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-white/10 py-8">
          <p className="max-w-4xl text-sm leading-7 text-slate-300">
            GiveKhair verifies charity profiles before publication. Payment processing, Gift Aid handling,
            fundraiser compliance, and donor protections are subject to platform checks, charity status, and
            the applicable terms and policies.
          </p>
        </div>

        <div className="flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-4 py-2 hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 GiveKhair. Every act of Khair is an act of care.</p>
        </div>
      </div>
    </footer>
  );
}
