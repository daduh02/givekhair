export const runtime = "nodejs";
import { type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions, enforceCredentialsSignInRateLimit } from "@/lib/auth";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(request: NextRequest) {
  const pathname = new URL(request.url).pathname;

  if (pathname.endsWith("/callback/credentials")) {
    let email = "";

    try {
      const formData = await request.clone().formData();
      email = String(formData.get("email") ?? "").trim().toLowerCase();
    } catch {
      email = "";
    }

    const limited = await enforceCredentialsSignInRateLimit(request.headers, email);

    if (limited) {
      return limited;
    }
  }

  return handler(request);
}
