import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

const NAV = [
  { href: "/admin",          label: "Overview",         icon: "▦" },
  { href: "/admin/appeals",  label: "Appeals",          icon: "📣" },
  { href: "/admin/donations",label: "Donations",        icon: "💷" },
  { href: "/admin/payouts",  label: "Payouts",          icon: "🏦" },
  { href: "/admin/gift-aid", label: "Gift Aid",         icon: "🎁" },
  { href: "/admin/offline",  label: "Offline uploads",  icon: "📋" },
  { href: "/admin/reports",  label: "Reports",          icon: "📊" },
  { href: "/admin/settings", label: "Settings",         icon: "⚙️"  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/auth/signin?callbackUrl=/admin");

  const role = (session.user as { role?: string } | undefined)?.role ?? "DONOR";
  const allowed = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];
  if (!allowed.includes(role)) redirect("/403");

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{ background: "#124E40", color: "#F6F1E8" }} className="sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "rgba(246,241,232,0.15)" }}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#F6F1E8" strokeWidth="2">
                  <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
                </svg>
              </span>
              <span className="font-bold text-base" style={{ color: "#F6F1E8" }}>GiveKhair</span>
            </Link>
            <span style={{ color: "rgba(246,241,232,0.4)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "rgba(246,241,232,0.8)" }}>Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm" style={{ color: "rgba(246,241,232,0.8)" }}>
            <span>{session.user?.name ?? session.user?.email ?? "Admin user"}</span>
            <Link href="/api/auth/signout" className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: "rgba(246,241,232,0.12)", color: "#F6F1E8" }}>
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-0 px-6 py-6">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 pr-4">
          <nav className="sticky top-20 space-y-0.5">
            {NAV.map((item) => (
              <AdminNavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
      style={{ color: "#3A4A42" }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "rgba(30,140,110,0.1)";
        e.currentTarget.style.color = "#124E40";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#3A4A42";
      }}>
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
    </Link>
  );
}
