import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = ["/admin", "/account"];
const PROTECTED_EXACT_PATHS = new Set(["/fundraise/new"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PROTECTED_EXACT_PATHS.has(pathname);
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
    );
  }

  if ((token as { suspended?: boolean }).suspended) {
    return NextResponse.redirect(
      new URL(`/auth/signin?error=AccountSuspended&callbackUrl=${encodeURIComponent(pathname)}`, req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/fundraise/new"],
};
