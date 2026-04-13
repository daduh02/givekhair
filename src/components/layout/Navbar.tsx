import Link from "next/link";
import { auth } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/#appeals", label: "Appeals" },
  { href: "/charities", label: "Charities" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/zakat-gift-aid", label: "Zakat & Gift Aid" },
];

/**
 * The public header is intentionally data-driven so navigation updates stay in
 * one place as the marketing surface grows.
 */
export async function Navbar() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "DONOR";
  const isAdmin = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role);
  const signedInHref = isAdmin ? "/admin" : "/dashboard";
  const signedInLabel = isAdmin ? "Admin" : "Dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-line)] bg-[rgba(248,245,239,0.88)] backdrop-blur-xl">
      <div className="site-shell flex min-h-[4.75rem] items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
              </svg>
            </span>
            <div>
              <p className="text-lg font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">GiveKhair</p>
              <p className="hidden text-xs text-[color:var(--color-ink-muted)] sm:block">Trust-first giving</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="btn-ghost">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
            <Link href={signedInHref} className="btn-ghost">
              {signedInLabel}
            </Link>
          ) : (
            <Link href="/auth/signin?callbackUrl=%2Fdashboard" className="btn-ghost">
              Log in
            </Link>
          )}

          <Link
            href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"}
            className="btn-primary px-4 py-3 text-sm sm:px-5"
          >
            Start fundraising
          </Link>
        </div>
      </div>
    </header>
  );
}
