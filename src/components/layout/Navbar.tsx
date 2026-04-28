import Link from "next/link";
import { auth } from "@/lib/auth";
import { forCharitiesNavLinks } from "@/lib/charity-products";
import { AccountMenu } from "@/components/layout/AccountMenu";

const PRIMARY_NAV_LINKS = [
  { href: "/#appeals", label: "Appeals" },
  { href: "/charities", label: "Charities" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/zakat-gift-aid", label: "Zakat" },
];

export async function Navbar() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "DONOR";
  const isAdmin = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role);
  const currentUser = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

  const startFundraisingHref = session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew";
  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-line)] bg-[rgba(248,245,239,0.92)] backdrop-blur-xl">
      <div className="site-shell flex min-h-[4.5rem] items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--color-primary),var(--color-primary-dark))] text-white shadow-[0_10px_22px_rgba(15,118,110,0.22)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold tracking-[-0.03em] text-[color:var(--color-ink)] sm:text-lg">GiveKhair</p>
              <p className="hidden text-xs text-[color:var(--color-ink-muted)] sm:block">Trust-first giving</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex">
            {PRIMARY_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="btn-ghost">
                {link.label}
              </Link>
            ))}

            <details className="group relative">
              <summary className="btn-ghost list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                For charities
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m5 8 5 5 5-5" />
                </svg>
              </summary>
              <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-48 rounded-[1.1rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.98)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                {forCharitiesNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-[0.9rem] px-3 py-2.5 text-sm font-medium text-[color:var(--color-ink-soft)] transition hover:bg-[rgba(204,251,241,0.42)] hover:text-[color:var(--color-primary-dark)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <AccountMenu
              name={currentUser?.name}
              email={currentUser?.email}
              image={currentUser?.image}
              isAdmin={isAdmin}
            />
          ) : (
            <Link href="/auth/signin?callbackUrl=%2Fdashboard" className="btn-ghost">
              Log in
            </Link>
          )}

          <Link href={startFundraisingHref} className="btn-primary whitespace-nowrap">
            Start fundraising
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Link href={startFundraisingHref} className="btn-primary whitespace-nowrap px-4">
            Start fundraising
          </Link>

          <details className="relative">
            <summary className="btn-outline list-none px-3 [&::-webkit-details-marker]:hidden" aria-label="Open navigation menu">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(21rem,calc(100vw-2rem))] rounded-[1.2rem] border border-[color:var(--color-line)] bg-[rgba(255,255,255,0.99)] p-3 shadow-[0_22px_46px_rgba(15,23,42,0.14)]">
              <nav className="grid gap-1">
                {PRIMARY_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-[0.95rem] px-3 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:bg-[rgba(204,251,241,0.38)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">For charities</p>
                <div className="mt-2 grid gap-1">
                  {forCharitiesNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-[0.95rem] px-3 py-3 text-sm font-medium text-[color:var(--color-ink-soft)] transition hover:bg-[rgba(204,251,241,0.32)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-3 border-t border-[color:var(--color-line)] pt-3">
                {session ? (
                  <div className="grid gap-1">
                    <Link href={dashboardHref} className="rounded-[0.95rem] px-3 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:bg-[rgba(204,251,241,0.38)]">
                      {isAdmin ? "Admin" : "Dashboard"}
                    </Link>
                    <Link href={startFundraisingHref} className="rounded-[0.95rem] px-3 py-3 text-sm font-medium text-[color:var(--color-ink-soft)] transition hover:bg-[rgba(204,251,241,0.32)]">
                      Start fundraising
                    </Link>
                  </div>
                ) : (
                  <Link href="/auth/signin?callbackUrl=%2Fdashboard" className="rounded-[0.95rem] px-3 py-3 text-sm font-semibold text-[color:var(--color-ink)] transition hover:bg-[rgba(204,251,241,0.38)]">
                    Log in
                  </Link>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
