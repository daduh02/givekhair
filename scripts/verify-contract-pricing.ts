import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { previewFees } from "../src/server/lib/fee-engine";
import { resolvePayoutPolicy } from "../src/server/lib/commercials";
import { createScheduledPayoutBatch, markPayoutBatchPaid } from "../src/server/lib/payouts";
import { markGiftAidClaimPaid, queueEligibleGiftAidDeclarations, submitGiftAidClaim } from "../src/server/lib/gift-aid";

const db = new PrismaClient();

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function money(value: { toString(): string }) {
  return new Decimal(value.toString()).toFixed(2);
}

async function createSchedule(input: {
  id: string;
  name: string;
  commercialPlanId: string;
}) {
  return db.feeSchedule.upsert({
    where: { id: input.id },
    update: {
      commercialPlanId: input.commercialPlanId,
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: null,
      rules: {
        deleteMany: {},
        create: [
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "CHARITY_PAID",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            isActive: true,
            sortOrder: 1,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "CHARITY_PAID",
            platformFeePct: 0.01,
            processingFeePct: 0.01,
            processingFeeFixed: 0.1,
            isActive: true,
            sortOrder: 2,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "DONOR_SUPPORTED",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            isActive: true,
            sortOrder: 3,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "DONOR_SUPPORTED",
            platformFeePct: 0.01,
            processingFeePct: 0.01,
            processingFeeFixed: 0.1,
            isActive: true,
            sortOrder: 4,
          },
        ],
      },
    },
    create: {
      id: input.id,
      version: 1,
      name: input.name,
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      commercialPlanId: input.commercialPlanId,
      rules: {
        create: [
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "CHARITY_PAID",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            isActive: true,
            sortOrder: 1,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "CHARITY_PAID",
            platformFeePct: 0.01,
            processingFeePct: 0.01,
            processingFeeFixed: 0.1,
            isActive: true,
            sortOrder: 2,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "DONOR_SUPPORTED",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            isActive: true,
            sortOrder: 3,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "DONOR_SUPPORTED",
            platformFeePct: 0.01,
            processingFeePct: 0.01,
            processingFeeFixed: 0.1,
            isActive: true,
            sortOrder: 4,
          },
        ],
      },
    },
  });
}

async function setupCharityFixture(input: {
  slug: string;
  name: string;
  planId: string;
  scheduleId: string;
  chargingMode: "CHARITY_PAID" | "DONOR_SUPPORTED" | "HYBRID";
  donorSupportEnabled: boolean;
  contractStatus?: "ACTIVE" | "EXPIRED" | "SUSPENDED";
  blockPayoutsOnExpiry?: boolean;
}) {
  const charity = await db.charity.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      isVerified: true,
    },
    create: {
      name: input.name,
      slug: input.slug,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      isVerified: true,
      defaultCurrency: "GBP",
    },
  });

  const appeal = await db.appeal.upsert({
    where: { slug: `${input.slug}-appeal` },
    update: {
      charityId: charity.id,
      title: `${input.name} Appeal`,
      status: "ACTIVE",
      visibility: "PUBLIC",
      donorSupportOverride: null,
      goalAmount: "1000.00",
      currency: "GBP",
    },
    create: {
      charityId: charity.id,
      title: `${input.name} Appeal`,
      slug: `${input.slug}-appeal`,
      goalAmount: "1000.00",
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });

  await db.charityContract.upsert({
    where: { id: `${input.slug}-contract` },
    update: {
      charityId: charity.id,
      commercialPlanId: input.planId,
      feeScheduleId: input.scheduleId,
      status: input.contractStatus ?? "ACTIVE",
      chargingMode: input.chargingMode,
      donorSupportEnabled: input.donorSupportEnabled,
      donorSupportPromptStyle: "TOGGLE",
      donorSupportSuggestedPresets: [1, 2, 5],
      payoutFrequency: "MONTHLY",
      payoutMethod: "BACS",
      settlementDelayDays: 7,
      reserveRule: "none",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
      blockPayoutsOnExpiry: input.blockPayoutsOnExpiry ?? true,
      autoPauseAppealsOnExpiry: false,
      termsVersion: `${input.slug}-2026.1`,
    },
    create: {
      id: `${input.slug}-contract`,
      charityId: charity.id,
      commercialPlanId: input.planId,
      feeScheduleId: input.scheduleId,
      status: input.contractStatus ?? "ACTIVE",
      chargingMode: input.chargingMode,
      donorSupportEnabled: input.donorSupportEnabled,
      donorSupportPromptStyle: "TOGGLE",
      donorSupportSuggestedPresets: [1, 2, 5],
      payoutFrequency: "MONTHLY",
      payoutMethod: "BACS",
      settlementDelayDays: 7,
      reserveRule: "none",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
      blockPayoutsOnExpiry: input.blockPayoutsOnExpiry ?? true,
      autoPauseAppealsOnExpiry: false,
      termsVersion: `${input.slug}-2026.1`,
    },
  });

  return { charity, appeal };
}

async function main() {
  const plan = await db.commercialPlan.upsert({
    where: { slug: "pricing-verification-plan" },
    update: {
      name: "Pricing verification plan",
      status: "ACTIVE",
      fundraisingModel: "CHARITY",
    },
    create: {
      name: "Pricing verification plan",
      slug: "pricing-verification-plan",
      status: "ACTIVE",
      fundraisingModel: "CHARITY",
    },
  });

  const schedule = await createSchedule({
    id: "pricing-verification-schedule",
    name: "Pricing verification schedule",
    commercialPlanId: plan.id,
  });

  const donorSupportedFixture = await setupCharityFixture({
    slug: "pricing-donor-supported",
    name: "Pricing Donor Supported",
    planId: plan.id,
    scheduleId: schedule.id,
    chargingMode: "DONOR_SUPPORTED",
    donorSupportEnabled: true,
  });

  const charityPaidFixture = await setupCharityFixture({
    slug: "pricing-charity-paid",
    name: "Pricing Charity Paid",
    planId: plan.id,
    scheduleId: schedule.id,
    chargingMode: "CHARITY_PAID",
    donorSupportEnabled: false,
  });

  const hybridFixture = await setupCharityFixture({
    slug: "pricing-hybrid",
    name: "Pricing Hybrid",
    planId: plan.id,
    scheduleId: schedule.id,
    chargingMode: "HYBRID",
    donorSupportEnabled: true,
  });

  const expiredFixture = await setupCharityFixture({
    slug: "pricing-expired",
    name: "Pricing Expired",
    planId: plan.id,
    scheduleId: schedule.id,
    chargingMode: "CHARITY_PAID",
    donorSupportEnabled: false,
    contractStatus: "EXPIRED",
    blockPayoutsOnExpiry: true,
  });

  const donorSupported = await previewFees(10, {
    charityId: donorSupportedFixture.charity.id,
    appealId: donorSupportedFixture.appeal.id,
    donorSupportAmount: 0.49,
    donationKind: "ONE_OFF",
    paymentMethod: "card",
  });
  assert(donorSupported.chargingMode === "DONOR_SUPPORTED", "Donor-supported mode should resolve.");
  assert(money(donorSupported.charityNetAmount) === "10.00", "Donor-supported charity net should equal donation amount.");
  assert(money(donorSupported.feeChargedToCharity) === "0.00", "Donor-supported charity fee should be zero.");
  assert(money(donorSupported.grossCheckoutTotal) === "10.49", "Donor-supported gross checkout total should include donor support.");

  const charityPaid = await previewFees(10, {
    charityId: charityPaidFixture.charity.id,
    appealId: charityPaidFixture.appeal.id,
    donorSupportAmount: 0,
    donationKind: "ONE_OFF",
    paymentMethod: "card",
  });
  assert(charityPaid.chargingMode === "CHARITY_PAID", "Charity-paid mode should resolve.");
  assert(money(charityPaid.grossCheckoutTotal) === "10.00", "Charity-paid gross checkout should equal donation amount.");
  assert(money(charityPaid.feeChargedToCharity) === "0.49", "Charity-paid fee should apply to the charity.");
  assert(money(charityPaid.charityNetAmount) === "9.51", "Charity-paid net should deduct fees.");

  const hybridWithSupport = await previewFees(10, {
    charityId: hybridFixture.charity.id,
    appealId: hybridFixture.appeal.id,
    donorSupportAmount: 0.49,
    donationKind: "ONE_OFF",
    paymentMethod: "card",
  });
  assert(hybridWithSupport.chargingMode === "DONOR_SUPPORTED", "Hybrid with support should resolve as donor-supported.");
  assert(money(hybridWithSupport.charityNetAmount) === "10.00", "Hybrid with support should keep charity net whole.");

  const hybridWithoutSupport = await previewFees(10, {
    charityId: hybridFixture.charity.id,
    appealId: hybridFixture.appeal.id,
    donorSupportAmount: 0,
    donationKind: "ONE_OFF",
    paymentMethod: "card",
  });
  assert(hybridWithoutSupport.chargingMode === "CHARITY_PAID", "Hybrid without support should resolve as charity-paid.");
  assert(money(hybridWithoutSupport.charityNetAmount) === "9.51", "Hybrid without support should use charity-paid fee logic.");

  const recurringPreview = await previewFees(10, {
    charityId: charityPaidFixture.charity.id,
    appealId: charityPaidFixture.appeal.id,
    donorSupportAmount: 0,
    donationKind: "RECURRING",
    paymentMethod: "card_recurring",
  });
  assert(money(recurringPreview.totalFees) === "0.30", "Recurring rules should resolve a different fee set.");

  await db.appeal.update({
    where: { id: hybridFixture.appeal.id },
    data: { donorSupportOverride: false },
  });

  const overrideDisabled = await previewFees(10, {
    charityId: hybridFixture.charity.id,
    appealId: hybridFixture.appeal.id,
    donorSupportAmount: 0.49,
    donationKind: "ONE_OFF",
    paymentMethod: "card",
  });
  assert(overrideDisabled.chargingMode === "CHARITY_PAID", "Appeal override should disable donor support behavior.");
  assert(money(overrideDisabled.grossCheckoutTotal) === "10.00", "Appeal override should stop donor support from increasing checkout total.");

  const payoutPolicy = await resolvePayoutPolicy(expiredFixture.charity.id, new Date("2026-06-01T00:00:00.000Z"));
  assert(payoutPolicy.blocked === true, "Expired contract should block payouts when configured.");

  const bankAccount = await db.bankAccount.upsert({
    where: { id: "pricing-verification-bank" },
    update: {
      charityId: hybridFixture.charity.id,
      accountName: "Verification payout account",
      currency: "GBP",
      provider: "bacs",
      isDefault: true,
      isVerified: true,
    },
    create: {
      id: "pricing-verification-bank",
      charityId: hybridFixture.charity.id,
      accountName: "Verification payout account",
      currency: "GBP",
      provider: "bacs",
      isDefault: true,
      isVerified: true,
    },
  });

  await db.donation.create({
    data: {
      pageId: await (async () => {
        const page = await db.fundraisingPage.upsert({
          where: { shortName: "pricing-hybrid-page" },
          update: {
            userId: (await db.user.findFirstOrThrow({ where: { email: "admin@givekhair.dev" } })).id,
            appealId: hybridFixture.appeal.id,
            title: "Pricing hybrid page",
            currency: "GBP",
            status: "ACTIVE",
            visibility: "PUBLIC",
          },
          create: {
            userId: (await db.user.findFirstOrThrow({ where: { email: "admin@givekhair.dev" } })).id,
            appealId: hybridFixture.appeal.id,
            title: "Pricing hybrid page",
            shortName: "pricing-hybrid-page",
            currency: "GBP",
            status: "ACTIVE",
            visibility: "PUBLIC",
          },
        });
        return page.id;
      })(),
      contractId: `${hybridFixture.charity.slug}-contract`,
      amount: "10.00",
      donationAmount: "10.00",
      donorSupportAmount: "0.00",
      grossCheckoutTotal: "10.00",
      feeChargedToCharity: "0.49",
      charityNetAmount: "9.51",
      resolvedChargingMode: "CHARITY_PAID",
      donationKind: "ONE_OFF",
      giftAidExpectedAmount: "0.00",
      giftAidReceivedAmount: "1.25",
      currency: "GBP",
      status: "CAPTURED",
      donorEmail: "pricing-payout@example.com",
      idempotencyKey: `pricing-payout-${Date.now()}`,
    },
  });

  const payoutBatch = await createScheduledPayoutBatch(hybridFixture.charity.id);
  assert(payoutBatch.bankAccountId === bankAccount.id, "Payout batch should use the default bank account.");
  assert(money(payoutBatch.netAmount) === "10.76", "Payout batch should include charity net plus received Gift Aid.");
  assert(payoutBatch.items.length >= 2, "Payout batch should include donation and Gift Aid line items.");

  const paidBatch = await markPayoutBatchPaid({
    payoutBatchId: payoutBatch.id,
    providerRef: "verification-provider-ref",
    bankRef: "verification-bank-ref",
  });
  assert(paidBatch.status === "PAID", "Payout batch should transition to paid.");

  const giftAidDonation = await db.donation.create({
    data: {
      pageId: await (async () => {
        const page = await db.fundraisingPage.findUniqueOrThrow({ where: { shortName: "pricing-hybrid-page" } });
        return page.id;
      })(),
      contractId: `${hybridFixture.charity.slug}-contract`,
      amount: "20.00",
      donationAmount: "20.00",
      donorSupportAmount: "0.00",
      grossCheckoutTotal: "20.00",
      feeChargedToCharity: "0.00",
      charityNetAmount: "20.00",
      resolvedChargingMode: "DONOR_SUPPORTED",
      donationKind: "ONE_OFF",
      giftAidExpectedAmount: "5.00",
      giftAidReceivedAmount: "0.00",
      currency: "GBP",
      status: "CAPTURED",
      donorEmail: "pricing-giftaid@example.com",
      idempotencyKey: `pricing-giftaid-${Date.now()}`,
    },
  });

  const declaration = await db.giftAidDeclaration.create({
    data: {
      donationId: giftAidDonation.id,
      donorFullName: "Gift Aid Donor",
      donorAddressLine1: "1 High Street",
      donorCity: "London",
      donorPostcode: "E1 1AA",
      statementVersion: "v1",
      statementText: "Gift Aid statement",
    },
  });

  const queuedClaims = await queueEligibleGiftAidDeclarations(hybridFixture.charity.id);
  assert(queuedClaims.createdItems >= 1, "Gift Aid queueing should create claim items for eligible declarations.");

  const claimItem = await db.giftAidClaimItem.findFirstOrThrow({
    where: { declarationId: declaration.id },
    include: { claim: true },
  });

  await submitGiftAidClaim(claimItem.claimId, "HMRC-VERIFY-001");
  await markGiftAidClaimPaid(claimItem.claimId);

  const settledDonation = await db.donation.findUniqueOrThrow({
    where: { id: giftAidDonation.id },
    select: { giftAidReceivedAmount: true },
  });
  assert(money(settledDonation.giftAidReceivedAmount!) === "5.00", "Paid Gift Aid claims should update linked donations with received reclaim amounts.");

  console.log("Verified contract-led pricing cases:");
  console.log(" - donor-supported with donor support added");
  console.log(" - charity-paid");
  console.log(" - hybrid with donor support");
  console.log(" - hybrid without donor support");
  console.log(" - recurring vs one-off fee selection");
  console.log(" - expired contract blocks payout");
  console.log(" - appeal override disables donor support");
  console.log(" - payout batch creation and paid transition");
  console.log(" - Gift Aid claim settlement updates linked donations");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
