import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { cache } from "react";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const KNOWN_ROLES = ["DONOR", "FUNDRAISER", "TEAM_LEAD", "CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"] as const;

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

function normalizeRole(role: unknown) {
  return typeof role === "string" && KNOWN_ROLES.includes(role as (typeof KNOWN_ROLES)[number])
    ? role
    : "DONOR";
}

export const authOptions: NextAuthOptions = {
  ...(process.env.DATABASE_URL ? { adapter: PrismaAdapter(db) } : {}),
  secret: authSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers:
    [
      CredentialsProvider({
        name: "Email and password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email?.trim().toLowerCase();
          const password = credentials?.password;

          if (!email || !password) {
            return null;
          }

          const user = await db.user.findUnique({
            where: { email },
          });

          if (!user || user.suspendedAt || !verifyPassword(password, user.passwordHash)) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: normalizeRole(user.role),
          };
        },
      }),
      ...(googleClientId && googleClientSecret
        ? [
            GoogleProvider({
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            }),
          ]
        : []),
    ],
  callbacks: {
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      if (!email) {
        return false;
      }

      const dbUser = await db.user.findUnique({
        where: { email },
        select: { suspendedAt: true },
      });

      if (dbUser?.suspendedAt) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        token.role = normalizeRole(user.role);
        token.id = user.id;
        return token;
      }

      if (token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, role: true, suspendedAt: true },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = normalizeRole(dbUser.role);
          token.suspended = Boolean(dbUser.suspendedAt);
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = normalizeRole(token.role);
        (session.user as any).suspended = Boolean((token as any).suspended);
      }
      return session;
    },
  },
};

// v4 compatibility: export auth() as a drop-in for server components
export const auth = cache(async function auth() {
  if (!authSecret) {
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return session;
  }

  if ((session.user as { suspended?: boolean } | undefined)?.suspended) {
    return null;
  }

  return session;
});
