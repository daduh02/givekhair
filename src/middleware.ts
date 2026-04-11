import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/admin", "/account", "/fundraise"];

const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"],
  "/admin/finance": ["FINANCE", "PLATFORM_ADMIN"],
  "/admin/platform": ["PLATFORM_ADMIN"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token) {
    // Always redirect to /admin after sign-in for protected routes
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", "/admin");
    return NextResponse.redirect(signInUrl);
  }

  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && !roles.includes(token.role as string)) {
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth).*)"],
};
