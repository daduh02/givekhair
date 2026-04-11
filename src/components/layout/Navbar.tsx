"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-green-700">giveKhair</span>
          <span className="hidden rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600 sm:block">beta</span>
        </Link>

        {/* Search */}
        <div className="hidden max-w-xs flex-1 px-8 sm:block">
          <input
            type="search"
            placeholder="Search appeals or charities..."
            className="input h-9 text-sm"
            aria-label="Search appeals"
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Link href="/fundraise/new" className="btn-primary hidden sm:inline-flex">
                Start fundraising
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-800"
                  aria-label="User menu"
                  aria-expanded={menuOpen}
                >
                  {session.user.name?.charAt(0) ?? session.user.email.charAt(0).toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-gray-100 px-4 py-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                    </div>
                    <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                    {["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"].includes(session.user.role) && (
                      <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Admin</Link>
                    )}
                    <Link href="/account" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Account settings</Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="btn-ghost text-sm">Log in</Link>
              <Link href="/auth/signin" className="btn-primary hidden sm:inline-flex">Start fundraising</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
