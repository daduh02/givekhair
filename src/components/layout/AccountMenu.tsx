"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";

type AccountMenuProps = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin: boolean;
};

type MenuItem = {
  href?: string;
  label: string;
  description: string;
  tone?: "default" | "danger";
  onSelect?: () => void;
};

function getInitials(input: string) {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "GK";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AccountMenu({ name, email, image, isAdmin }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const displayName = name?.trim() || email?.trim() || "GiveKhair account";
  const detail = name?.trim() && email?.trim() ? email : isAdmin ? "Admin access enabled" : "Signed in";

  // The menu supports both hover and click so it feels lightweight on desktop
  // without becoming inaccessible on touch devices or for keyboard users.
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const menuItems: MenuItem[] = [
    ...(isAdmin
      ? [{ href: "/admin", label: "Admin", description: "Open charity and finance tools" }]
      : []),
    { href: "/dashboard", label: "Dashboard", description: "See your signed-in workspace" },
    { href: "/fundraise/new", label: "Fundraise", description: "Create a new fundraiser page" },
    {
      label: "Log out",
      description: "End this session securely",
      tone: "danger",
      onSelect: () => {
        setOpen(false);
        void signOut({ callbackUrl: "/" });
      },
    },
  ];

  const initials = getInitials(displayName);

  return (
    <div
      ref={containerRef}
      className="account-menu-shell"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Open account menu for ${displayName}`}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
      >
        {image ? (
          // We deliberately keep the avatar optional so the menu still feels
          // finished even when providers do not supply profile images.
          <img src={image} alt="" className="account-avatar" />
        ) : (
          <span className="account-avatar account-avatar-fallback">{initials}</span>
        )}

        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-semibold text-[color:var(--color-ink)]">{displayName}</span>
          <span className="block truncate text-xs text-[color:var(--color-ink-muted)]">{detail}</span>
        </span>

        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-[color:var(--color-ink-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open ? (
        <div id={menuId} role="menu" aria-label="Account actions" className="account-dropdown">
          <div className="border-b border-[color:var(--color-line)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[color:var(--color-ink)]">{displayName}</p>
            <p className="truncate text-xs text-[color:var(--color-ink-muted)]">{detail}</p>
          </div>

          <div className="p-2">
            {menuItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className="account-menu-item"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-sm font-semibold text-[color:var(--color-ink)]">{item.label}</span>
                  <span className="text-xs text-[color:var(--color-ink-muted)]">{item.description}</span>
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`account-menu-item w-full text-left ${item.tone === "danger" ? "account-menu-item-danger" : ""}`}
                  onClick={item.onSelect}
                >
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-xs">{item.description}</span>
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
