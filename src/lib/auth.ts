import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

export const authOptions: NextAuthOptions = {
  ...(process.env.DATABASE_URL ? { adapter: PrismaAdapter(db) } : {}),
  secret: authSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers:
    googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : [],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        token.role = user.role ?? "DONOR";
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role ?? "DONOR";
      }
      return session;
    },
  },
};

// v4 compatibility: export auth() as a drop-in for server components
export async function auth() {
  if (!authSecret) {
    return null;
  }
  return getServerSession(authOptions);
}
