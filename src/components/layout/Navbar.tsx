import Link from "next/link";
import { auth } from "@/lib/auth";

export async function Navbar() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "DONOR";
  const isAdmin = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(role);

  return (
    <nav style={{ background: "#F6F1E8", borderBottom: "1px solid rgba(18,78,64,0.12)" }}
      className="sticky top-0 z-50">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "#124E40" }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#F6F1E8" strokeWidth="2">
              <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight" style={{ color: "#233029" }}>GiveKhair</span>
        </Link>

        <div className="hidden max-w-xs flex-1 px-8 sm:block">
          <input type="search" placeholder="Search appeals or charities..." className="input h-9 text-sm" aria-label="Search appeals" />
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="btn-ghost text-sm">Admin panel</Link>
              )}
              <Link href="/dashboard" className="btn-ghost text-sm">Dashboard</Link>
            </>
          ) : (
            <Link href="/auth/signin?callbackUrl=%2Fdashboard" className="btn-ghost text-sm">Log in</Link>
          )}
          <Link href={session ? "/fundraise/new" : "/auth/signin?callbackUrl=%2Ffundraise%2Fnew"} className="btn-primary hidden sm:inline-flex" style={{ fontSize: "0.875rem", padding: "0.5rem 1.25rem" }}>Start fundraising</Link>
        </div>
      </div>
    </nav>
  );
}
