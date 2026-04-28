import Link from "next/link";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const FOOTER_COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/#appeals", label: "Appeals" },
      { href: "/charities", label: "Charities" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/zakat-gift-aid", label: "Zakat" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/for-charities/products", label: "Products" },
      { href: "/pricing", label: "Pricing" },
      { href: "/fees", label: "Fees" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/accessibility", label: "Accessibility" },
      { href: "/cookies", label: "Cookie Policy" },
      { href: "/charity-verification", label: "Charity Verification" },
    ],
  },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/accessibility", label: "Accessibility Statement" },
  { href: "/fundraising-rules", label: "Fundraising Rules" },
];

const SOCIAL_LINKS = [
  { href: "https://instagram.com/givekhair", label: "Instagram", icon: FaInstagram },
  { href: "https://x.com/givekhair", label: "X", icon: FaXTwitter },
  { href: "https://linkedin.com/company/givekhair", label: "LinkedIn", icon: FaLinkedinIn },
];

export function PublicFooter() {
  return (
    <footer className="mt-14 bg-[color:var(--color-ink)] text-white">
      <div className="site-shell py-11">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))]">
          <div className="footer-column max-w-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_10px_22px_rgba(15,118,110,0.22)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
                </svg>
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-[-0.03em]">GiveKhair</h2>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Trust-first giving</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Give with confidence to verified causes, support meaningful appeals, and help charities turn generosity into real impact.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="trust-chip border-white/10 bg-white/8 text-white">Verified charities</span>
              <span className="trust-chip border-white/10 bg-white/8 text-white">Gift Aid ready</span>
              <span className="trust-chip border-white/10 bg-white/8 text-white">Transparent fees</span>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="footer-column">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">{column.title}</h3>
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

        <div className="border-b border-white/10 py-6">
          <p className="max-w-4xl text-sm leading-7 text-slate-300">
            GiveKhair verifies charity profiles before publication. Payment processing, Gift Aid handling, fundraiser compliance, and donor protections remain subject to platform checks, charity status, and the relevant terms and policies.
          </p>
        </div>

        <div className="flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            {SOCIAL_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 hover:text-white"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 text-sm text-slate-400">
          © 2026 GiveKhair. Every act of Khair is an act of care.
        </div>
      </div>
    </footer>
  );
}
