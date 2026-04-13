import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  charityAdminProcedure,
  financeProcedure,
} from "@/server/trpc";
import { previewFees } from "@/server/lib/fee-engine";
import {
  recordDonationAuthorised,
  recordFeesRecognised,
  recordPayoutPaid,
  recordRefund,
} from "@/server/lib/ledger";
import { createDonationIntent, markDonationCaptured } from "@/server/lib/donation-processing";
import { TRPCError } from "@trpc/server";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";

// ── Fees router ───────────────────────────────────────────────────────────────

export const feesRouter = createTRPCRouter({
  preview: publicProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        charityId: z.string(),
        appealId: z.string().optional(),
        countryCode: z.string().default("GB"),
        paymentMethod: z.string().optional(),
        donationKind: z.enum(["ONE_OFF", "RECURRING"]).default("ONE_OFF"),
        donorSupportAmount: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const result = await previewFees(input.amount, {
        charityId: input.charityId,
        appealId: input.appealId,
        countryCode: input.countryCode,
        paymentMethod: input.paymentMethod,
        donationKind: input.donationKind,
        donorSupportAmount: input.donorSupportAmount,
      });
      // Serialize Decimals to strings for transport
      return {
        donationAmount: result.donationAmount.toFixed(2),
        donorSupportAmount: result.donorSupportAmount.toFixed(2),
        grossCheckoutTotal: result.grossCheckoutTotal.toFixed(2),
        platformFeeAmount: result.platformFeeAmount.toFixed(2),
        processingFeeAmount: result.processingFeeAmount.toFixed(2),
        giftAidFeeAmount: result.giftAidFeeAmount.toFixed(2),
        totalFees: result.totalFees.toFixed(2),
        feeChargedToCharity: result.feeChargedToCharity.toFixed(2),
        charityNetAmount: result.charityNetAmount.toFixed(2),
        chargingMode: result.chargingMode,
        donorSupportEnabled: result.donorSupportEnabled,
        donorSupportSuggestedPresets: result.donorSupportSuggestedPresets,
        feeBreakdown: result.feeBreakdown,
        scheduleId: result.scheduleId,
        contractId: result.contractId,
      };
    }),
});

// ── Appeals router ────────────────────────────────────────────────────────────

export const appealsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        categorySlug: z.string().optional(),
        search: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.appeal.findMany({
        where: {
          status: "ACTIVE",
          visibility: "PUBLIC",
          ...(input.categorySlug && {
            category: { slug: input.categorySlug },
          }),
          ...(input.search && {
            title: { contains: input.search, mode: "insensitive" },
          }),
        },
        include: {
          charity: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
          category: true,
          _count: { select: { fundraisingPages: true } },
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }

      return { items, nextCursor };
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const appeal = await ctx.db.appeal.findUnique({
        where: { slug: input.slug },
        include: {
          charity: true,
          category: true,
          teams: {
            include: {
              members: { include: { user: { select: { id: true, name: true, image: true } } } },
            },
          },
        },
      });
      if (!appeal) throw new TRPCError({ code: "NOT_FOUND" });
      return appeal;
    }),

  create: charityAdminProcedure
    .input(
      z.object({
        charityId: z.string(),
        categoryId: z.string().optional(),
        title: z.string().min(5).max(200),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        story: z.string().optional(),
        goalAmount: z.number().positive(),
        currency: z.string().default("GBP"),
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),
        bannerUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.appeal.create({ data: { ...input, goalAmount: input.goalAmount } });
    }),
});

// ── Fundraising Pages router ──────────────────────────────────────────────────

export const pagesRouter = createTRPCRouter({
  byShortName: publicProcedure
    .input(z.object({ shortName: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.fundraisingPage.findUnique({
        where: { shortName: input.shortName },
        include: {
          user: { select: { id: true, name: true, image: true } },
          appeal: { include: { charity: true } },
          team: true,
          donations: {
            where: { status: "CAPTURED" },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true, amount: true, currency: true, donorName: true,
              isAnonymous: true, message: true, createdAt: true,
            },
          },
          offlineDonations: {
            where: { status: "APPROVED" },
            select: { id: true, amount: true, currency: true, donorName: true, receivedDate: true },
          },
          updates: { orderBy: { createdAt: "desc" } },
          mediaItems: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  create: protectedProcedure
    .input(
      z.object({
        appealId: z.string(),
        teamId: z.string().optional(),
        title: z.string().min(5).max(200),
        shortName: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
        story: z.string().optional(),
        targetAmount: z.number().positive().optional(),
        currency: z.string().default("GBP"),
        coverImageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id?: string } | undefined)?.id;
      if (!userId) {
        throw new Error("Unauthenticated");
      }

      return ctx.db.fundraisingPage.create({
        data: { ...input, userId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(5).max(200).optional(),
        story: z.string().optional(),
        targetAmount: z.number().positive().optional(),
        coverImageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const page = await ctx.db.fundraisingPage.findUnique({ where: { id } });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      const sessionUser = ctx.session.user as { id?: string; role?: string } | undefined;
      const sessionUserId = sessionUser?.id;
      const sessionUserRole = sessionUser?.role;

      if (page.userId !== sessionUserId && sessionUserRole !== "PLATFORM_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.fundraisingPage.update({ where: { id }, data });
    }),
});

// ── Donations router ──────────────────────────────────────────────────────────

export const donationsRouter = createTRPCRouter({
  createIntent: publicProcedure
    .input(
      z.object({
        pageId: z.string(),
        amount: z.number().positive(),
        currency: z.string().default("GBP"),
        donorSupportAmount: z.number().min(0).default(0),
        isAnonymous: z.boolean().default(false),
        isRecurring: z.boolean().default(false),
        donorName: z.string().max(120).optional(),
        donorEmail: z.string().email(),
        message: z.string().max(500).optional(),
        giftAid: z
          .object({
            donorFullName: z.string(),
            addressLine1: z.string(),
            addressLine2: z.string().optional(),
            city: z.string(),
            postcode: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const sessionUserId = (ctx.session?.user as { id?: string } | undefined)?.id;
        return await createDonationIntent({
          pageId: input.pageId,
          amount: input.amount,
          currency: input.currency,
          donorSupportAmount: input.donorSupportAmount,
          isAnonymous: input.isAnonymous,
          isRecurring: input.isRecurring,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          message: input.message,
          giftAid: input.giftAid,
          userId: sessionUserId,
          ipAddress: ctx.req.headers.get("x-forwarded-for"),
          userAgent: ctx.req.headers.get("user-agent"),
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Unable to create donation intent.",
        });
      }
    }),

  // Called by webhook handler after payment confirmed
  confirm: financeProcedure
    .input(
      z.object({
        donationId: z.string(),
        providerRef: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await markDonationCaptured({
        donationId: input.donationId,
        provider: "stripe",
        providerRef: input.providerRef,
      });
      return { ok: true };
    }),
});

// ── Admin / Payouts router ────────────────────────────────────────────────────

export const adminRouter = createTRPCRouter({
  charityStats: charityAdminProcedure
    .input(z.object({ charityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [onlineTotal, offlineTotal, donationCount, pendingPayout] =
        await Promise.all([
          ctx.db.donation.aggregate({
            where: { page: { appeal: { charityId: input.charityId } }, status: "CAPTURED" },
            _sum: { amount: true },
            _count: true,
          }),
          ctx.db.offlineDonation.aggregate({
            where: { page: { appeal: { charityId: input.charityId } }, status: "APPROVED" },
            _sum: { amount: true },
          }),
          ctx.db.donation.count({
            where: { page: { appeal: { charityId: input.charityId } }, status: "CAPTURED" },
          }),
          ctx.db.payoutBatch.aggregate({
            where: { charityId: input.charityId, status: { in: ["SCHEDULED", "PROCESSING"] } },
            _sum: { netAmount: true },
          }),
        ]);

      return {
        totalOnline: onlineTotal._sum.amount?.toString() ?? "0",
        totalOffline: offlineTotal._sum.amount?.toString() ?? "0",
        donationCount,
        pendingPayout: pendingPayout._sum.netAmount?.toString() ?? "0",
      };
    }),

  recentDonations: charityAdminProcedure
    .input(
      z.object({
        charityId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.donation.findMany({
        where: { page: { appeal: { charityId: input.charityId } } },
        include: {
          feeSet: true,
          giftAidDeclaration: { select: { id: true } },
          page: { select: { shortName: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });
    }),
});

// ── Root router ───────────────────────────────────────────────────────────────

export const appRouter = createTRPCRouter({
  fees: feesRouter,
  appeals: appealsRouter,
  pages: pagesRouter,
  donations: donationsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
