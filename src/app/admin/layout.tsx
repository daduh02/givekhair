import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export const metadata: Metadata = { title: "Admin" };

const NAV = [
  { href: "/admin",          label: "Overview",         icon: "▦" },
  { href: "/admin/users",    label: "Users",            icon: "👤", platformOnly: true },
  { href: "/admin/charities",label: "Charities",        icon: "🏛️" },
  { href: "/admin/appeals",  label: "Appeals",          icon: "📣" },
  { href: "/admin/moderation",label: "Moderation",      icon: "🛡️" },
  { href: "/admin/donations",label: "Donations",        icon: "💷" },
  { href: "/admin/disputes", label: "Disputes",         icon: "⚠️" },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: "🧾" },
  { href: "/admin/analytics",label: "Analytics",        icon: "🏁" },
  { href: "/admin/payouts",  label: "Payouts",          icon: "🏦" },
  { href: "/admin/gift-aid", label: "Gift Aid",         icon: "🎁" },
  { href: "/admin/offline",  label: "Offline uploads",  icon: "📋" },
  { href: "/admin/reports",  label: "Reports",          icon: "📊" },
  { href: "/admin/settings", label: "Fees & contracts", icon: "⚙️"  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/auth/signin?callbackUrl=/admin");

  const role = (session.user as { role?: string } | undefined)?.role ?? "DONOR";
  const allowed = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];
  if (!allowed.includes(role)) redirect("/403");

  const navItems = NAV.filter((item) => !(item as { platformOnly?: boolean }).platformOnly || role === "PLATFORM_ADMIN");

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#124E40", color: "#F6F1E8" }} className="sticky top-0 z-50 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "rgba(246,241,232,0.15)" }}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#F6F1E8" strokeWidth="2">
                  <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
                </svg>
              </span>
              <span className="font-bold text-base" style={{ color: "#F6F1E8" }}>GiveKhair</span>
            </Link>
            <span className="hidden sm:block" style={{ color: "rgba(246,241,232,0.4)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "rgba(246,241,232,0.8)" }}>Admin panel</span>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end" style={{ color: "rgba(246,241,232,0.8)" }}>
            <span className="min-w-0 truncate text-sm">{session.user?.name ?? session.user?.email ?? "Admin user"}</span>
            <Link href="/api/auth/signout" className="rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap"
              style={{ background: "rgba(246,241,232,0.12)", color: "#F6F1E8" }}>
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <AdminNavigation items={navItems} />
        <div className="lg:flex lg:gap-6">
          <AdminNavigation items={navItems} desktop />
          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
