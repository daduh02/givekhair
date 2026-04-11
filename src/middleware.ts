import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/fundraise",
  "/account",
  "/admin",
];

// Routes that require specific roles
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["PLATFORM_ADMIN", "CHARITY_ADMIN", "FINANCE"],
  "/admin/finance": ["FINANCE", "PLATFORM_ADMIN"],
  "/admin/platform": ["PLATFORM_ADMIN"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !session) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (session) {
    for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
      if (pathname.startsWith(route) && !roles.includes(session.user.role)) {
        return NextResponse.redirect(new URL("/403", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth).*)",
  ],
};
