export const runtime = "nodejs";
import { type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceRateLimitResponse } from "@/server/lib/rate-limit";
import { getClientIp } from "@/server/lib/request-identity";

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

    const limited = await enforceRateLimitResponse(
      {
        namespace: "auth:credentials",
        key: `${getClientIp(request.headers)}:${email || "unknown"}`,
        limit: 5,
        windowSec: 15 * 60,
      },
      "Too many requests. Please try again later.",
    );

    if (limited) {
      return limited;
    }
  }

  return handler(request);
}
