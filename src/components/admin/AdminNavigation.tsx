"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type AdminNavigationProps = {
  items: NavItem[];
  desktop?: boolean;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavigation({ items, desktop = false }: AdminNavigationProps) {
  const pathname = usePathname();

  if (desktop) {
    return (
      <aside className="hidden w-60 flex-shrink-0 lg:block">
        <nav className="sticky top-24 space-y-1" aria-label="Admin navigation">
          {items.map((item) => (
            <AdminNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActivePath(pathname, item.href)}
            />
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <div className="admin-mobile-nav lg:hidden">
      <nav className="admin-mobile-nav-track" aria-label="Admin navigation">
        {items.map((item) => (
          <AdminNavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActivePath(pathname, item.href)}
            compact
          />
        ))}
      </nav>
    </div>
  );
}

function AdminNavLink({
  href,
  icon,
  label,
  active,
  compact = false,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={compact ? "admin-nav-chip" : "admin-nav-link"}
      data-active={active ? "true" : "false"}
    >
      <span className={compact ? "admin-nav-chip-icon" : "admin-nav-link-icon"} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
