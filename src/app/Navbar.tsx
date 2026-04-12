"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

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
              <Link href="/fundraise/new" className="btn-primary hidden sm:inline-flex" style={{ fontSize: "0.875rem", padding: "0.5rem 1.25rem" }}>
                Start fundraising
              </Link>
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-sm"
                  style={{ background: "#1E8C6E22", color: "#124E40" }} aria-label="User menu">
                  {session.user?.name?.charAt(0) ?? session.user?.email?.charAt(0)?.toUpperCase() ?? "U"}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white py-1 shadow-lg" style={{ border: "1px solid rgba(18,78,64,0.12)" }}>
                    <div className="border-b px-4 py-2" style={{ borderColor: "rgba(18,78,64,0.1)" }}>
                      <p className="text-sm font-semibold truncate" style={{ color: "#233029" }}>{session.user?.name ?? "User"}</p>
                      <p className="text-xs truncate" style={{ color: "#3A4A42" }}>{session.user?.email ?? ""}</p>
                    </div>
                    <Link href="/dashboard" className="block px-4 py-2 text-sm hover:bg-[#F6F1E8]" style={{ color: "#233029" }} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                    {(["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"] as const).includes(((session.user as { role?: string } | undefined)?.role ?? "") as any) && (
                      <Link href="/admin" className="block px-4 py-2 text-sm hover:bg-[#F6F1E8]" style={{ color: "#233029" }} onClick={() => setMenuOpen(false)}>Admin</Link>
                    )}
                    <Link href="/account" className="block px-4 py-2 text-sm hover:bg-[#F6F1E8]" style={{ color: "#233029" }} onClick={() => setMenuOpen(false)}>Account settings</Link>
                    <button onClick={() => signOut({ callbackUrl: "/" })} className="block w-full px-4 py-2 text-left text-sm hover:bg-[#F6F1E8]" style={{ color: "#c0392b" }}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="btn-ghost text-sm">Log in</Link>
              <Link href="/auth/signin" className="btn-primary hidden sm:inline-flex" style={{ fontSize: "0.875rem", padding: "0.5rem 1.25rem" }}>Start fundraising</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
