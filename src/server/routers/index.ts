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
        countryCode: z.string().default("GB"),
        paymentMethod: z.string().optional(),
        donorCoversFees: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const result = await previewFees(input.amount, {
        charityId: input.charityId,
        countryCode: input.countryCode,
        paymentMethod: input.paymentMethod,
        donorCoversFees: input.donorCoversFees,
      });
      // Serialize Decimals to strings for transport
      return {
        donationAmount: result.donationAmount.toFixed(2),
        platformFeeAmount: result.platformFeeAmount.toFixed(2),
        processingFeeAmount: result.processingFeeAmount.toFixed(2),
        giftAidFeeAmount: result.giftAidFeeAmount.toFixed(2),
        totalFees: result.totalFees.toFixed(2),
        netToCharity: result.netToCharity.toFixed(2),
        donorPays: result.donorPays.toFixed(2),
        donorCoversFees: result.donorCoversFees,
        scheduleId: result.scheduleId,
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
      return ctx.db.fundraisingPage.create({
        data: { ...input, userId: ctx.session.user.id },
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
      if (page.userId !== ctx.session.user.id && ctx.session.user.role !== "PLATFORM_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.fundraisingPage.update({ where: { id }, data });
    }),
});

// ── Donations router ──────────────────────────────────────────────────────────

export const donationsRouter = createTRPCRouter({
  createIntent: protectedProcedure
    .input(
      z.object({
        pageId: z.string(),
        amount: z.number().positive(),
        currency: z.string().default("GBP"),
        donorCoversFees: z.boolean().default(false),
        isAnonymous: z.boolean().default(false),
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
      const page = await ctx.db.fundraisingPage.findUnique({
        where: { id: input.pageId },
        include: { appeal: { include: { charity: true } } },
      });
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      const feePreview = await previewFees(input.amount, {
        charityId: page.appeal.charityId,
        donorCoversFees: input.donorCoversFees,
      });

      const idempotencyKey = randomUUID();

      // Create donation + FeeSet in a transaction
      const donation = await ctx.db.$transaction(async (tx) => {
        const don = await tx.donation.create({
          data: {
            pageId: input.pageId,
            userId: ctx.session.user.id,
            amount: new Decimal(input.amount).toFixed(2),
            currency: input.currency,
            status: "PENDING",
            isAnonymous: input.isAnonymous,
            message: input.message,
            idempotencyKey,
          },
        });

        await tx.feeSet.create({
          data: {
            scheduleId: feePreview.scheduleId === "none" ? await getOrCreateDefaultScheduleId(tx) : feePreview.scheduleId,
            donationId: don.id,
            platformFeeAmount: feePreview.platformFeeAmount.toFixed(2),
            processingFeeAmount: feePreview.processingFeeAmount.toFixed(2),
            giftAidFeeAmount: feePreview.giftAidFeeAmount.toFixed(2),
            totalFees: feePreview.totalFees.toFixed(2),
            donorCoversFees: input.donorCoversFees,
            netToCharity: feePreview.netToCharity.toFixed(2),
            snapshotJson: feePreview.snapshotJson,
          },
        });

        if (input.giftAid) {
          await tx.giftAidDeclaration.create({
            data: {
              donationId: don.id,
              userId: ctx.session.user.id,
              donorFullName: input.giftAid.donorFullName,
              donorAddressLine1: input.giftAid.addressLine1,
              donorAddressLine2: input.giftAid.addressLine2,
              donorCity: input.giftAid.city,
              donorPostcode: input.giftAid.postcode,
              type: "SINGLE",
              statementVersion: "v1",
              statementText:
                "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
              ipAddress: ctx.req.headers.get("x-forwarded-for") ?? undefined,
            },
          });
        }

        return don;
      });

      // TODO: Call Donations API stub / Stripe to create checkout session
      // const checkoutUrl = await donationsApiStub.createCheckout({ donationId: donation.id, amount: feePreview.donorPays, ... })

      return {
        donationId: donation.id,
        idempotencyKey,
        donorPays: feePreview.donorPays.toFixed(2),
        netToCharity: feePreview.netToCharity.toFixed(2),
        // checkoutUrl  ← returned once Donations API is wired
      };
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
      const donation = await ctx.db.donation.findUnique({
        where: { id: input.donationId },
        include: { feeSet: true },
      });
      if (!donation) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.$transaction(async (tx) => {
        await tx.donation.update({
          where: { id: input.donationId },
          data: { status: "CAPTURED" },
        });
        await tx.payment.create({
          data: {
            donationId: input.donationId,
            provider: "stripe",
            providerRef: input.providerRef,
            amount: donation.amount,
            currency: donation.currency,
            settledAt: new Date(),
          },
        });
      });

      // Write ledger entries
      const amount = new Decimal(donation.amount.toString());
      await recordDonationAuthorised({ donationId: input.donationId, amount });
      if (donation.feeSet) {
        await recordFeesRecognised({
          donationId: input.donationId,
          platformFee: new Decimal(donation.feeSet.platformFeeAmount.toString()),
          processingFee: new Decimal(donation.feeSet.processingFeeAmount.toString()),
        });
      }

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateDefaultScheduleId(tx: Parameters<Parameters<typeof import("@/lib/db")["db"]["$transaction"]>[0]>[0]) {
  const s = await tx.feeSchedule.findFirst({ where: { charityId: null, isActive: true } });
  return s?.id ?? "default";
}
