/**
 * Seed script — run with: npm run db:seed
 * Creates realistic dev data: charities, appeals, teams, pages, donations, ledger entries
 */

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Fee schedule ────────────────────────────────────────────────────────────
  const schedule = await db.feeSchedule.upsert({
    where: { id: "default-schedule" },
    update: {},
    create: {
      id: "default-schedule",
      version: 1,
      name: "Platform default v1",
      isActive: true,
      validFrom: new Date("2024-01-01"),
      rules: {
        create: [
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            sortOrder: 1,
          },
        ],
      },
    },
  });
  console.log("  ✓ Fee schedule");

  // ── Categories ──────────────────────────────────────────────────────────────
  const categories = await Promise.all([
    db.category.upsert({ where: { slug: "emergency-relief" }, update: {}, create: { name: "Emergency relief", slug: "emergency-relief" } }),
    db.category.upsert({ where: { slug: "health" }, update: {}, create: { name: "Health", slug: "health" } }),
    db.category.upsert({ where: { slug: "education" }, update: {}, create: { name: "Education", slug: "education" } }),
    db.category.upsert({ where: { slug: "community" }, update: {}, create: { name: "Community", slug: "community" } }),
    db.category.upsert({ where: { slug: "environment" }, update: {}, create: { name: "Environment", slug: "environment" } }),
  ]);
  console.log("  ✓ Categories");

  // ── Charities ───────────────────────────────────────────────────────────────
  const islamicRelief = await db.charity.upsert({
    where: { slug: "islamic-relief-uk" },
    update: {},
    create: {
      name: "Islamic Relief UK",
      slug: "islamic-relief-uk",
      registrationNo: "328158",
      description: "Working to save and transform the lives of some of the world's most vulnerable people.",
      countryCode: "GB",
      isVerified: true,
    },
  });

  const saveChildren = await db.charity.upsert({
    where: { slug: "save-the-children" },
    update: {},
    create: {
      name: "Save the Children UK",
      slug: "save-the-children",
      registrationNo: "213890",
      description: "We believe every child deserves a future.",
      countryCode: "GB",
      isVerified: true,
    },
  });
  console.log("  ✓ Charities");

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminUser = await db.user.upsert({
    where: { email: "admin@givekhair.dev" },
    update: {},
    create: {
      email: "admin@givekhair.dev",
      name: "Platform Admin",
      role: "PLATFORM_ADMIN",
      emailVerified: new Date(),
    },
  });

  const charityAdmin = await db.user.upsert({
    where: { email: "charity@givekhair.dev" },
    update: {},
    create: {
      email: "charity@givekhair.dev",
      name: "Charity Manager",
      role: "CHARITY_ADMIN",
      emailVerified: new Date(),
    },
  });

  const amina = await db.user.upsert({
    where: { email: "amina@example.com" },
    update: {},
    create: { email: "amina@example.com", name: "Amina Abubakar", role: "FUNDRAISER", emailVerified: new Date() },
  });

  const yusuf = await db.user.upsert({
    where: { email: "yusuf@example.com" },
    update: {},
    create: { email: "yusuf@example.com", name: "Yusuf Khan", role: "FUNDRAISER", emailVerified: new Date() },
  });

  const fatima = await db.user.upsert({
    where: { email: "fatima@example.com" },
    update: {},
    create: { email: "fatima@example.com", name: "Fatima Hassan", role: "FUNDRAISER", emailVerified: new Date() },
  });

  await db.charityAdmin.upsert({
    where: { userId_charityId: { userId: charityAdmin.id, charityId: islamicRelief.id } },
    update: {},
    create: { userId: charityAdmin.id, charityId: islamicRelief.id },
  });
  console.log("  ✓ Users");

  // ── Bank account ────────────────────────────────────────────────────────────
  const bankAccount = await db.bankAccount.upsert({
    where: { id: "bank-ir-001" },
    update: {},
    create: {
      id: "bank-ir-001",
      charityId: islamicRelief.id,
      accountName: "Islamic Relief UK Main",
      maskedSortCode: "20-**-**",
      maskedAccount: "****5678",
      currency: "GBP",
      provider: "stripe_connect",
      isDefault: true,
      isVerified: true,
    },
  });
  console.log("  ✓ Bank account");

  // ── Appeal ──────────────────────────────────────────────────────────────────
  const appeal = await db.appeal.upsert({
    where: { slug: "gaza-emergency-medical-aid" },
    update: {},
    create: {
      charityId: islamicRelief.id,
      categoryId: categories[0].id,
      title: "Gaza Emergency Medical Aid",
      slug: "gaza-emergency-medical-aid",
      story: "Hospitals in Gaza are overwhelmed. Your donation funds emergency surgical kits, medicines, and field medics on the ground.",
      goalAmount: 100000,
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
      startsAt: new Date("2024-10-01"),
      endsAt: new Date("2025-06-30"),
    },
  });
  console.log("  ✓ Appeal");

  // ── Team ────────────────────────────────────────────────────────────────────
  const team = await db.team.upsert({
    where: { appealId_slug: { appealId: appeal.id, slug: "london-masjid-collective" } },
    update: {},
    create: {
      appealId: appeal.id,
      name: "London Masjid Collective",
      slug: "london-masjid-collective",
      goalAmount: 15000,
    },
  });

  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: amina.id } },
    update: {},
    create: { teamId: team.id, userId: amina.id, isLead: true },
  });
  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: yusuf.id } },
    update: {},
    create: { teamId: team.id, userId: yusuf.id },
  });
  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: fatima.id } },
    update: {},
    create: { teamId: team.id, userId: fatima.id },
  });
  console.log("  ✓ Team + members");

  // ── Fundraising pages ───────────────────────────────────────────────────────
  const aminaPage = await db.fundraisingPage.upsert({
    where: { shortName: "amina-for-gaza" },
    update: {},
    create: {
      userId: amina.id,
      appealId: appeal.id,
      teamId: team.id,
      title: "Amina's Gaza fundraiser",
      shortName: "amina-for-gaza",
      story: "I have been moved by what is happening in Gaza. Please donate whatever you can.",
      targetAmount: 5000,
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });

  const yusufPage = await db.fundraisingPage.upsert({
    where: { shortName: "yusuf-for-gaza" },
    update: {},
    create: {
      userId: yusuf.id,
      appealId: appeal.id,
      teamId: team.id,
      title: "Yusuf's Gaza fundraiser",
      shortName: "yusuf-for-gaza",
      story: "Every pound helps save lives. Please give generously.",
      targetAmount: 3000,
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });
  console.log("  ✓ Fundraising pages");

  // ── Donations + FeeSet + Ledger ─────────────────────────────────────────────
  const donationData = [
    { pageId: aminaPage.id, userId: amina.id, amount: "50.00", donorName: "Khalid M.", giftAid: true, coversFees: true },
    { pageId: aminaPage.id, userId: null, amount: "25.00", donorName: null, giftAid: false, coversFees: false },
    { pageId: aminaPage.id, userId: fatima.id, amount: "100.00", donorName: "Sarah T.", giftAid: true, coversFees: false },
    { pageId: yusufPage.id, userId: null, amount: "10.00", donorName: "Anonymous", giftAid: false, coversFees: true },
    { pageId: yusufPage.id, userId: yusuf.id, amount: "75.00", donorName: "Mohammed R.", giftAid: true, coversFees: false },
  ];

  for (const d of donationData) {
    const amount = new Decimal(d.amount);
    const platformFee = amount.times(0.015).toDecimalPlaces(2);
    const processingFee = amount.times(0.014).plus(0.2).toDecimalPlaces(2);
    const totalFees = platformFee.plus(processingFee);
    const netToCharity = d.coversFees ? amount : amount.minus(totalFees);
    const donorPays = d.coversFees ? amount.plus(totalFees) : amount;

    const donation = await db.donation.create({
      data: {
        pageId: d.pageId,
        userId: d.userId ?? undefined,
        amount: d.amount,
        currency: "GBP",
        status: "CAPTURED",
        isAnonymous: !d.donorName,
        donorName: d.donorName ?? undefined,
        externalRef: `pi_seed_${randomUUID().slice(0, 8)}`,
        idempotencyKey: randomUUID(),
      },
    });

    await db.feeSet.create({
      data: {
        scheduleId: schedule.id,
        donationId: donation.id,
        platformFeeAmount: platformFee.toFixed(2),
        processingFeeAmount: processingFee.toFixed(2),
        giftAidFeeAmount: "0.00",
        totalFees: totalFees.toFixed(2),
        donorCoversFees: d.coversFees,
        netToCharity: netToCharity.toFixed(2),
        snapshotJson: { scheduleId: schedule.id, version: 1 },
      },
    });

    await db.payment.create({
      data: {
        donationId: donation.id,
        provider: "stripe",
        providerRef: `pi_seed_${randomUUID().slice(0, 8)}`,
        amount: donorPays.toFixed(2),
        currency: "GBP",
        settledAt: new Date(),
      },
    });

    // Ledger: donation authorised
    const corId = randomUUID();
    await db.journalEntry.create({
      data: {
        correlationId: corId,
        donationId: donation.id,
        description: `Donation authorised £${amount.toFixed(2)}`,
        lines: {
          create: [
            { accountCode: "1100-DonorClearing", debit: amount.toFixed(2), credit: "0.00", currency: "GBP", fxRate: "1.000000" },
            { accountCode: "2100-CharityPayable", debit: "0.00", credit: amount.toFixed(2), currency: "GBP", fxRate: "1.000000" },
          ],
        },
      },
    });

    // Ledger: fees recognised
    await db.journalEntry.create({
      data: {
        correlationId: corId,
        donationId: donation.id,
        description: `Fees recognised £${totalFees.toFixed(2)}`,
        lines: {
          create: [
            { accountCode: "2100-CharityPayable", debit: totalFees.toFixed(2), credit: "0.00", currency: "GBP", fxRate: "1.000000" },
            { accountCode: "4100-PlatformRevenue", debit: "0.00", credit: platformFee.toFixed(2), currency: "GBP", fxRate: "1.000000" },
            { accountCode: "5200-ProcessingFees", debit: "0.00", credit: processingFee.toFixed(2), currency: "GBP", fxRate: "1.000000" },
          ],
        },
      },
    });

    // Gift Aid declarations
    if (d.giftAid) {
      await db.giftAidDeclaration.create({
        data: {
          donationId: donation.id,
          userId: d.userId ?? undefined,
          donorFullName: d.donorName ?? "Anonymous Donor",
          donorAddressLine1: "123 Example Street",
          donorCity: "London",
          donorPostcode: "E1 6RF",
          type: "SINGLE",
          statementVersion: "v1",
          statementText: "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
        },
      });
    }
  }
  console.log("  ✓ Donations + fee sets + ledger + Gift Aid declarations");

  // ── Offline donations ───────────────────────────────────────────────────────
  await db.offlineDonation.createMany({
    data: [
      { pageId: aminaPage.id, amount: "200.00", currency: "GBP", receivedDate: new Date("2024-11-01"), donorName: "Offline cash collection", notes: "Collected at Friday prayers", status: "APPROVED", createdById: charityAdmin.id },
      { pageId: aminaPage.id, amount: "500.00", currency: "GBP", receivedDate: new Date("2024-11-05"), donorName: "Mr Ahmed (cheque)", notes: "Bank transfer received", status: "APPROVED", createdById: charityAdmin.id },
      { pageId: yusufPage.id, amount: "150.00", currency: "GBP", receivedDate: new Date("2024-11-03"), donorName: "Community event collection", status: "APPROVED", createdById: charityAdmin.id },
    ],
    skipDuplicates: true,
  });
  console.log("  ✓ Offline donations");

  // ── Payout batch ────────────────────────────────────────────────────────────
  const payoutBatch = await db.payoutBatch.create({
    data: {
      charityId: islamicRelief.id,
      bankAccountId: bankAccount.id,
      currency: "GBP",
      grossAmount: "260.00",
      feesAmount: "14.35",
      netAmount: "245.65",
      status: "PAID",
      scheduledFor: new Date("2024-11-07"),
      processedAt: new Date("2024-11-07"),
      bankRef: "1-ABC-998",
      idempotencyKey: randomUUID(),
    },
  });

  // Ledger: payout paid
  await db.journalEntry.create({
    data: {
      correlationId: randomUUID(),
      payoutBatchId: payoutBatch.id,
      description: `Payout to Islamic Relief UK £245.65`,
      lines: {
        create: [
          { accountCode: "2100-CharityPayable", debit: "245.65", credit: "0.00", currency: "GBP", fxRate: "1.000000" },
          { accountCode: "1010-ExternalBank", debit: "0.00", credit: "245.65", currency: "GBP", fxRate: "1.000000" },
        ],
      },
    },
  });
  console.log("  ✓ Payout batch + ledger");

  // ── Gift Aid claim ──────────────────────────────────────────────────────────
  const declarations = await db.giftAidDeclaration.findMany({ take: 3 });
  const claim = await db.giftAidClaim.create({
    data: {
      charityId: islamicRelief.id,
      periodStart: new Date("2024-10-01"),
      periodEnd: new Date("2024-12-31"),
      status: "DRAFT",
      totalDonations: "225.00",
      reclaimAmount: "56.25",
    },
  });

  if (declarations.length > 0) {
    await db.giftAidClaimItem.createMany({
      data: declarations.map((dec) => ({
        claimId: claim.id,
        declarationId: dec.id,
        donationAmount: "75.00",
        reclaimAmount: "18.75",
      })),
    });
  }
  console.log("  ✓ Gift Aid claim");

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
