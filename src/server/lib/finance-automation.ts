import { db } from "@/lib/db";
import { markGiftAidClaimPaid } from "@/server/lib/gift-aid";
import { markPayoutBatchPaid, markPayoutBatchProcessing } from "@/server/lib/payouts";
import { getFinanceExceptionRows } from "@/server/lib/reconciliation";

const EXECUTION_ENABLED = process.env.FINANCE_AUTOMATION_EXECUTE === "1";

export async function runFinanceAutomation(input: {
  scopedCharityIds: string[];
  requestedById?: string;
  execute?: boolean;
}) {
  const executeRequested = Boolean(input.execute);
  const shouldExecute = EXECUTION_ENABLED && executeRequested;
  const scoped = input.scopedCharityIds.length ? input.scopedCharityIds : ["__none__"];

  const [payoutCandidates, giftAidCandidates, staleExceptions] = await Promise.all([
    db.payoutBatch.findMany({
      where: {
        charityId: { in: scoped },
        status: { in: ["SCHEDULED", "PROCESSING"] },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.giftAidClaim.findMany({
      where: {
        charityId: { in: scoped },
        status: { in: ["SUBMITTED", "ACCEPTED"] },
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    getFinanceExceptionRows({
      scopedCharityIds: scoped,
      filters: {},
    }),
  ]);

  let processedPayouts = 0;
  let processedClaims = 0;
  const errors: string[] = [];

  if (shouldExecute) {
    for (const batch of payoutCandidates) {
      try {
        if (batch.status === "SCHEDULED") {
          await markPayoutBatchProcessing(batch.id);
        }
        await markPayoutBatchPaid({
          payoutBatchId: batch.id,
          providerRef: `auto-prov-${batch.id.slice(-8)}`,
          bankRef: `auto-bank-${batch.id.slice(-8)}`,
        });
        processedPayouts += 1;
      } catch (error) {
        errors.push(`Payout ${batch.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    for (const claim of giftAidCandidates) {
      try {
        await markGiftAidClaimPaid(claim.id);
        processedClaims += 1;
      } catch (error) {
        errors.push(`GiftAid ${claim.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  const status = shouldExecute
    ? (errors.length > 0 ? "FAILED" : "EXECUTED")
    : "DRY_RUN";

  const summary = shouldExecute
    ? `Executed automation: ${processedPayouts} payout batch(es), ${processedClaims} Gift Aid claim(s).`
    : `Dry run: ${payoutCandidates.length} payout candidate(s), ${giftAidCandidates.length} Gift Aid candidate(s), ${staleExceptions.length} open exception row(s).`;

  const run = await db.financeAutomationRun.create({
    data: {
      runType: "AUTO_RECONCILIATION",
      status,
      requestedById: input.requestedById ?? null,
      summary,
      detailsJson: {
        executionEnabled: EXECUTION_ENABLED,
        executeRequested,
        shouldExecute,
        payoutCandidateCount: payoutCandidates.length,
        giftAidCandidateCount: giftAidCandidates.length,
        staleExceptionCount: staleExceptions.length,
        processedPayouts,
        processedClaims,
        errors,
      },
      finishedAt: new Date(),
    },
  });

  return {
    run,
    summary,
    executionEnabled: EXECUTION_ENABLED,
    shouldExecute,
    payoutCandidateCount: payoutCandidates.length,
    giftAidCandidateCount: giftAidCandidates.length,
    staleExceptionCount: staleExceptions.length,
    processedPayouts,
    processedClaims,
    errors,
  };
}
