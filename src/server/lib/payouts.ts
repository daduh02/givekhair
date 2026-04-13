import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { resolvePayoutPolicy } from "@/server/lib/commercials";

export async function getCharityPayoutOverview(charityId: string) {
  const policy = await resolvePayoutPolicy(charityId);
  const [captured, paidGiftAid, existingBatches] = await Promise.all([
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId } },
      },
      _sum: {
        charityNetAmount: true,
      },
    }),
    db.donation.aggregate({
      where: {
        status: "CAPTURED",
        page: { appeal: { charityId } },
      },
      _sum: {
        giftAidReceivedAmount: true,
      },
    }),
    db.payoutBatch.aggregate({
      where: {
        charityId,
        status: { in: ["SCHEDULED", "PROCESSING", "PAID"] },
      },
      _sum: {
        netAmount: true,
      },
    }),
  ]);

  const donationNet = new Decimal(captured._sum.charityNetAmount?.toString() ?? "0");
  const giftAidReceived = new Decimal(paidGiftAid._sum.giftAidReceivedAmount?.toString() ?? "0");
  const alreadyBatched = new Decimal(existingBatches._sum.netAmount?.toString() ?? "0");
  const eligibleBeforeBlock = donationNet.plus(giftAidReceived);

  return {
    contract: policy.contract,
    payoutsBlocked: policy.blocked,
    blockReason: policy.reason,
    donationNetAmount: donationNet,
    giftAidReceivedAmount: giftAidReceived,
    eligiblePayoutAmount: policy.blocked ? new Decimal(0) : Decimal.max(eligibleBeforeBlock.minus(alreadyBatched), 0),
    existingBatchedAmount: alreadyBatched,
  };
}
