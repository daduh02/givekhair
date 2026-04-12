import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { z } from "zod";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@prisma/client";

// ── Context ──────────────────────────────────────────────────────────────────

export async function createTRPCContext(opts: { req: NextRequest }) {
  const session = await auth();
  return {
    db,
    session,
    req: opts.req,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// ── Init ─────────────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// ── Middleware ────────────────────────────────────────────────────────────────

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { session: ctx.session } });
});

const enforceRole = (allowed: UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const role = (ctx.session.user as { role?: typeof allowed[number] }).role;
    if (!role || !allowed.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { session: ctx.session } });
  });

// ── Procedures ────────────────────────────────────────────────────────────────

/** Public — no auth required */
export const publicProcedure = t.procedure;

/** Any authenticated user */
export const protectedProcedure = t.procedure.use(enforceAuth);

/** Charity admin or above */
export const charityAdminProcedure = t.procedure.use(
  enforceRole(["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"])
);

/** Finance or platform admin only */
export const financeProcedure = t.procedure.use(
  enforceRole(["FINANCE", "PLATFORM_ADMIN"])
);

/** Platform admin only */
export const platformAdminProcedure = t.procedure.use(
  enforceRole(["PLATFORM_ADMIN"])
);
