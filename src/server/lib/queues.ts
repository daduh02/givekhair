/**
 * BullMQ queues
 * Replaces SNS/SQS for MVP. Three queues:
 *   - email       receipt dispatch, admin alerts
 *   - payouts     batch creation and provider submission
 *   - gift-aid    claim builder and HMRC submission
 */

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ── Queue definitions ─────────────────────────────────────────────────────────

export const emailQueue = new Queue("email", { connection });
export const payoutsQueue = new Queue("payouts", { connection });
export const giftAidQueue = new Queue("gift-aid", { connection });

// ── Job type definitions ──────────────────────────────────────────────────────

export type EmailJobData =
  | { type: "DONATION_RECEIPT"; donationId: string }
  | { type: "PAYOUT_NOTIFICATION"; payoutBatchId: string }
  | { type: "GIFT_AID_CLAIM_SUBMITTED"; claimId: string }
  | { type: "FINANCE_EXCEPTION_ALERT"; charityId?: string | null; summary: string };

export type PayoutsJobData =
  | { type: "SCHEDULE_BATCH"; charityId: string }
  | { type: "PROCESS_BATCH"; payoutBatchId: string };

export type GiftAidJobData =
  | { type: "BUILD_CLAIM"; charityId: string; periodStart: string; periodEnd: string }
  | { type: "SUBMIT_CLAIM"; claimId: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function enqueueEmail(data: EmailJobData) {
  return emailQueue.add(data.type, data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  });
}

export async function enqueueFinanceExceptionAlert(input: {
  charityId?: string | null;
  summary: string;
}) {
  return enqueueEmail({
    type: "FINANCE_EXCEPTION_ALERT",
    charityId: input.charityId ?? null,
    summary: input.summary,
  });
}

export async function enqueuePayoutBatch(charityId: string) {
  return payoutsQueue.add("SCHEDULE_BATCH", { type: "SCHEDULE_BATCH", charityId } satisfies PayoutsJobData, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}

export async function enqueueGiftAidClaim(
  charityId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return giftAidQueue.add(
    "BUILD_CLAIM",
    {
      type: "BUILD_CLAIM",
      charityId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    } satisfies GiftAidJobData,
    { attempts: 3 }
  );
}

// ── Workers (run in a separate process in production) ─────────────────────────

export function startWorkers() {
  const emailWorker = new Worker<EmailJobData>(
    "email",
    async (job: Job<EmailJobData>) => {
      console.log(`[email worker] processing ${job.data.type}`, job.data);
      // TODO: import and call resend/sendgrid
      switch (job.data.type) {
        case "DONATION_RECEIPT":
          // await sendDonationReceipt(job.data.donationId)
          break;
        case "PAYOUT_NOTIFICATION":
          // await sendPayoutNotification(job.data.payoutBatchId)
          break;
        case "FINANCE_EXCEPTION_ALERT":
          // TODO: send finance alert email/slack once channel integration is configured.
          break;
      }
    },
    { connection }
  );

  const payoutsWorker = new Worker<PayoutsJobData>(
    "payouts",
    async (job: Job<PayoutsJobData>) => {
      console.log(`[payouts worker] processing ${job.data.type}`, job.data);
      // TODO: Implement payout batch creation and provider submission
    },
    { connection }
  );

  const giftAidWorker = new Worker<GiftAidJobData>(
    "gift-aid",
    async (job: Job<GiftAidJobData>) => {
      console.log(`[gift-aid worker] processing ${job.data.type}`, job.data);
      // TODO: Implement HMRC claim building and submission
    },
    { connection }
  );

  return { emailWorker, payoutsWorker, giftAidWorker };
}
