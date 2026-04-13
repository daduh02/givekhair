/**
 * Seed script — run with: npm run db:seed
 * Creates realistic dev data: charities, appeals, teams, pages, donations, ledger entries
 */

import { PrismaClient, type ChargingMode, type DonationKind } from "@prisma/client";
import Decimal from "decimal.js";
import { randomUUID } from "crypto";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");
  const defaultPasswordHash = hashPassword("GiveKhair123!");

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
            donationKind: "ONE_OFF",
            chargingMode: "CHARITY_PAID",
            isActive: true,
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            sortOrder: 1,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "CHARITY_PAID",
            isActive: true,
            platformFeePct: 0.0125,
            processingFeePct: 0.012,
            processingFeeFixed: 0.2,
            sortOrder: 2,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "ONE_OFF",
            chargingMode: "DONOR_SUPPORTED",
            isActive: true,
            platformFeePct: 0.015,
            processingFeePct: 0.014,
            processingFeeFixed: 0.2,
            sortOrder: 3,
          },
          {
            countryCode: "GB",
            ruleType: "PERCENTAGE",
            donationKind: "RECURRING",
            chargingMode: "DONOR_SUPPORTED",
            isActive: true,
            platformFeePct: 0.0125,
            processingFeePct: 0.012,
            processingFeeFixed: 0.2,
            sortOrder: 4,
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
    update: {
      charityNumber: "328158",
      registrationNo: "328158",
      verificationStatus: "VERIFIED",
      status: "ACTIVE",
      logoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
      websiteUrl: "https://www.islamic-relief.org.uk",
      shortDescription: "Emergency relief, health, and long-term development programmes across the world.",
      fullDescription: "Islamic Relief UK works with communities affected by conflict, disaster, and poverty. The charity supports emergency response, health services, livelihoods, and resilient local infrastructure.",
      contactEmail: "hello@islamic-relief.org.uk",
      defaultCurrency: "GBP",
      description: "Working to save and transform the lives of some of the world's most vulnerable people.",
      countryCode: "GB",
      isVerified: true,
      isActive: true,
    },
    create: {
      name: "Islamic Relief UK",
      slug: "islamic-relief-uk",
      charityNumber: "328158",
      registrationNo: "328158",
      description: "Working to save and transform the lives of some of the world's most vulnerable people.",
      shortDescription: "Emergency relief, health, and long-term development programmes across the world.",
      fullDescription: "Islamic Relief UK works with communities affected by conflict, disaster, and poverty. The charity supports emergency response, health services, livelihoods, and resilient local infrastructure.",
      logoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
      websiteUrl: "https://www.islamic-relief.org.uk",
      contactEmail: "hello@islamic-relief.org.uk",
      countryCode: "GB",
      defaultCurrency: "GBP",
      isVerified: true,
      verificationStatus: "VERIFIED",
      status: "ACTIVE",
    },
  });

  const saveChildren = await db.charity.upsert({
    where: { slug: "save-the-children" },
    update: {
      charityNumber: "213890",
      registrationNo: "213890",
      verificationStatus: "VERIFIED",
      status: "ACTIVE",
      logoUrl: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80",
      websiteUrl: "https://www.savethechildren.org.uk",
      shortDescription: "Helping children stay safe, healthy, and learning in crises and beyond.",
      fullDescription: "Save the Children UK supports children through emergencies, education programmes, health access, and advocacy work that protects children's rights and futures.",
      contactEmail: "support@savethechildren.org.uk",
      defaultCurrency: "GBP",
      description: "We believe every child deserves a future.",
      countryCode: "GB",
      isVerified: true,
      isActive: true,
    },
    create: {
      name: "Save the Children UK",
      slug: "save-the-children",
      charityNumber: "213890",
      registrationNo: "213890",
      description: "We believe every child deserves a future.",
      shortDescription: "Helping children stay safe, healthy, and learning in crises and beyond.",
      fullDescription: "Save the Children UK supports children through emergencies, education programmes, health access, and advocacy work that protects children's rights and futures.",
      logoUrl: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80",
      websiteUrl: "https://www.savethechildren.org.uk",
      contactEmail: "support@savethechildren.org.uk",
      countryCode: "GB",
      defaultCurrency: "GBP",
      isVerified: true,
      verificationStatus: "VERIFIED",
      status: "ACTIVE",
    },
  });
  console.log("  ✓ Charities");

  // ── Commercial plans & contracts foundation ────────────────────────────────
  const starterPlan = await db.commercialPlan.upsert({
    where: { slug: "starter-charity" },
    update: {
      name: "Starter charity",
      description: "Entry plan for charities onboarding to GiveKhair with the default public fundraising stack.",
      fundraisingModel: "CHARITY",
      billingInterval: "MONTHLY",
      platformFlatFee: "0.00",
      status: "ACTIVE",
      featureSummary: {
        donor_cover_fees: true,
        public_charity_profile: true,
        fundraiser_pages: true,
      },
    },
    create: {
      name: "Starter charity",
      slug: "starter-charity",
      description: "Entry plan for charities onboarding to GiveKhair with the default public fundraising stack.",
      fundraisingModel: "CHARITY",
      billingInterval: "MONTHLY",
      platformFlatFee: "0.00",
      status: "ACTIVE",
      featureSummary: {
        donor_cover_fees: true,
        public_charity_profile: true,
        fundraiser_pages: true,
      },
    },
  });

  const growthPlan = await db.commercialPlan.upsert({
    where: { slug: "growth-charity" },
    update: {
      name: "Growth charity",
      description: "Operational plan for charities needing reporting, admin oversight, and managed fundraising growth.",
      fundraisingModel: "CHARITY",
      billingInterval: "MONTHLY",
      platformFlatFee: "149.00",
      status: "ACTIVE",
      featureSummary: {
        reporting_exports: true,
        moderation_queue: true,
        charity_contracts: true,
      },
    },
    create: {
      name: "Growth charity",
      slug: "growth-charity",
      description: "Operational plan for charities needing reporting, admin oversight, and managed fundraising growth.",
      fundraisingModel: "CHARITY",
      billingInterval: "MONTHLY",
      platformFlatFee: "149.00",
      status: "ACTIVE",
      featureSummary: {
        reporting_exports: true,
        moderation_queue: true,
        charity_contracts: true,
      },
    },
  });

  await db.feeSchedule.update({
    where: { id: schedule.id },
    data: { commercialPlanId: starterPlan.id },
  });
  console.log("  ✓ Commercial plans");

  // ── Users ───────────────────────────────────────────────────────────────────
  const adminUser = await db.user.upsert({
    where: { email: "admin@givekhair.dev" },
    update: {
      passwordHash: defaultPasswordHash,
      role: "PLATFORM_ADMIN",
      emailVerified: new Date(),
    },
    create: {
      email: "admin@givekhair.dev",
      name: "Platform Admin",
      passwordHash: defaultPasswordHash,
      role: "PLATFORM_ADMIN",
      emailVerified: new Date(),
    },
  });

  const charityAdmin = await db.user.upsert({
    where: { email: "charity@givekhair.dev" },
    update: {
      passwordHash: defaultPasswordHash,
      role: "CHARITY_ADMIN",
      emailVerified: new Date(),
    },
    create: {
      email: "charity@givekhair.dev",
      name: "Charity Manager",
      passwordHash: defaultPasswordHash,
      role: "CHARITY_ADMIN",
      emailVerified: new Date(),
    },
  });

  const amina = await db.user.upsert({
    where: { email: "amina@example.com" },
    update: { passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
    create: { email: "amina@example.com", name: "Amina Abubakar", passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
  });

  const yusuf = await db.user.upsert({
    where: { email: "yusuf@example.com" },
    update: { passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
    create: { email: "yusuf@example.com", name: "Yusuf Khan", passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
  });

  const fatima = await db.user.upsert({
    where: { email: "fatima@example.com" },
    update: { passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
    create: { email: "fatima@example.com", name: "Fatima Hassan", passwordHash: defaultPasswordHash, role: "FUNDRAISER", emailVerified: new Date() },
  });

  await db.charityAdmin.upsert({
    where: { userId_charityId: { userId: charityAdmin.id, charityId: islamicRelief.id } },
    update: {},
    create: { userId: charityAdmin.id, charityId: islamicRelief.id },
  });
  console.log("  ✓ Users");

  const islamicReliefContract = await db.charityContract.upsert({
    where: { id: "contract-islamic-relief-2026" },
    update: {
      charityId: islamicRelief.id,
      commercialPlanId: growthPlan.id,
      feeScheduleId: schedule.id,
      status: "ACTIVE",
      chargingMode: "HYBRID",
      region: "GB",
      productType: "general-fundraising",
      donorSupportEnabled: true,
      donorSupportPromptStyle: "TOGGLE",
      donorSupportSuggestedPresets: [1, 2, 5],
      payoutFrequency: "MONTHLY",
      payoutMethod: "BACS",
      settlementDelayDays: 7,
      reserveRule: "none",
      autoPauseAppealsOnExpiry: false,
      blockPayoutsOnExpiry: true,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: new Date("2026-12-31"),
      signedAt: new Date("2026-01-03"),
      signedByName: "Platform Admin",
      signedByEmail: "admin@givekhair.dev",
      termsVersion: "2026.1",
      payoutTerms: "Monthly payouts in GBP, subject to compliance review and operational holds.",
      reservePolicy: "No rolling reserve in the starter contract baseline unless risk review changes the account state.",
      autoRenew: true,
      notes: "Seeded commercial contract for admin/testing flows.",
      internalNotes: "Hybrid donor-support enabled contract used for platform verification flows.",
    },
    create: {
      id: "contract-islamic-relief-2026",
      charityId: islamicRelief.id,
      commercialPlanId: growthPlan.id,
      feeScheduleId: schedule.id,
      status: "ACTIVE",
      chargingMode: "HYBRID",
      region: "GB",
      productType: "general-fundraising",
      donorSupportEnabled: true,
      donorSupportPromptStyle: "TOGGLE",
      donorSupportSuggestedPresets: [1, 2, 5],
      payoutFrequency: "MONTHLY",
      payoutMethod: "BACS",
      settlementDelayDays: 7,
      reserveRule: "none",
      autoPauseAppealsOnExpiry: false,
      blockPayoutsOnExpiry: true,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: new Date("2026-12-31"),
      signedAt: new Date("2026-01-03"),
      signedByName: "Platform Admin",
      signedByEmail: "admin@givekhair.dev",
      termsVersion: "2026.1",
      payoutTerms: "Monthly payouts in GBP, subject to compliance review and operational holds.",
      reservePolicy: "No rolling reserve in the starter contract baseline unless risk review changes the account state.",
      autoRenew: true,
      notes: "Seeded commercial contract for admin/testing flows.",
      internalNotes: "Hybrid donor-support enabled contract used for platform verification flows.",
    },
  });

  await db.termsAcceptance.upsert({
    where: { id: "terms-islamic-relief-platform-2026-1" },
    update: {
      contractId: islamicReliefContract.id,
      charityId: islamicRelief.id,
      documentType: "PLATFORM_TERMS",
      version: "2026.1",
      acceptedByName: "Platform Admin",
      acceptedByEmail: "admin@givekhair.dev",
      acceptedAt: new Date("2026-01-03"),
      notes: "Seeded acceptance for baseline contract setup.",
    },
    create: {
      id: "terms-islamic-relief-platform-2026-1",
      contractId: islamicReliefContract.id,
      charityId: islamicRelief.id,
      documentType: "PLATFORM_TERMS",
      version: "2026.1",
      acceptedByName: "Platform Admin",
      acceptedByEmail: "admin@givekhair.dev",
      acceptedAt: new Date("2026-01-03"),
      notes: "Seeded acceptance for baseline contract setup.",
    },
  });

  await db.contractDocument.upsert({
    where: { id: "contract-document-islamic-relief-msa" },
    update: {
      contractId: islamicReliefContract.id,
      name: "MSA 2026.1",
      fileUrl: "https://example.com/contracts/islamic-relief-msa-2026-1.pdf",
      mimeType: "application/pdf",
      documentType: "MASTER_SERVICE_AGREEMENT",
      uploadedByName: "Platform Admin",
      uploadedByEmail: "admin@givekhair.dev",
    },
    create: {
      id: "contract-document-islamic-relief-msa",
      contractId: islamicReliefContract.id,
      name: "MSA 2026.1",
      fileUrl: "https://example.com/contracts/islamic-relief-msa-2026-1.pdf",
      mimeType: "application/pdf",
      documentType: "MASTER_SERVICE_AGREEMENT",
      uploadedByName: "Platform Admin",
      uploadedByEmail: "admin@givekhair.dev",
    },
  });

  await db.commercialAuditLog.upsert({
    where: { id: "audit-contract-islamic-relief-created" },
    update: {
      contractId: islamicReliefContract.id,
      charityId: islamicRelief.id,
      action: "CREATE",
      entityType: "CHARITY_CONTRACT",
      summary: "Seeded baseline hybrid contract for Islamic Relief UK",
      metadata: {
        chargingMode: "HYBRID",
        donorSupportEnabled: true,
        payoutFrequency: "MONTHLY",
        payoutMethod: "BACS",
      },
      changedByName: "Platform Admin",
      changedByEmail: "admin@givekhair.dev",
    },
    create: {
      id: "audit-contract-islamic-relief-created",
      contractId: islamicReliefContract.id,
      charityId: islamicRelief.id,
      action: "CREATE",
      entityType: "CHARITY_CONTRACT",
      summary: "Seeded baseline hybrid contract for Islamic Relief UK",
      metadata: {
        chargingMode: "HYBRID",
        donorSupportEnabled: true,
        payoutFrequency: "MONTHLY",
        payoutMethod: "BACS",
      },
      changedByName: "Platform Admin",
      changedByEmail: "admin@givekhair.dev",
    },
  });
  console.log("  ✓ Contracts foundation");

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
    update: {
      charityId: islamicRelief.id,
      categoryId: categories[0].id,
      title: "Gaza Emergency Medical Aid",
      story: "Hospitals in Gaza are overwhelmed. Your donation funds emergency surgical kits, medicines, and field medics on the ground.",
      impact: "Funds emergency surgery packs, fuel for ambulances, frontline medicines, and trauma care for families affected by the crisis.",
      goalAmount: 100000,
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
      startsAt: new Date("2024-10-01"),
      endsAt: new Date("2025-06-30"),
      bannerUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
      mediaGallery: [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
        "https://images.unsplash.com/photo-1518398046578-8cca57782e17?auto=format&fit=crop&w=1400&q=80",
      ],
    },
    create: {
      charityId: islamicRelief.id,
      categoryId: categories[0].id,
      title: "Gaza Emergency Medical Aid",
      slug: "gaza-emergency-medical-aid",
      story: "Hospitals in Gaza are overwhelmed. Your donation funds emergency surgical kits, medicines, and field medics on the ground.",
      impact: "Funds emergency surgery packs, fuel for ambulances, frontline medicines, and trauma care for families affected by the crisis.",
      goalAmount: 100000,
      currency: "GBP",
      status: "ACTIVE",
      visibility: "PUBLIC",
      startsAt: new Date("2024-10-01"),
      endsAt: new Date("2025-06-30"),
      bannerUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
      mediaGallery: [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
        "https://images.unsplash.com/photo-1518398046578-8cca57782e17?auto=format&fit=crop&w=1400&q=80",
      ],
    },
  });
  console.log("  ✓ Appeal");

  // ── Team ────────────────────────────────────────────────────────────────────
  const team = await db.team.upsert({
    where: { appealId_slug: { appealId: appeal.id, slug: "london-masjid-collective" } },
    update: {
      name: "London Masjid Collective",
      description: "Mosques and community organisers across London fundraising together for urgent medical relief.",
      goalAmount: 15000,
      visibility: "PUBLIC",
      status: "ACTIVE",
    },
    create: {
      appealId: appeal.id,
      name: "London Masjid Collective",
      slug: "london-masjid-collective",
      description: "Mosques and community organisers across London fundraising together for urgent medical relief.",
      goalAmount: 15000,
      visibility: "PUBLIC",
      status: "ACTIVE",
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

  await db.moderationItem.upsert({
    where: { id: "seed-charity-review" },
    update: {
      title: "Charity profile refresh pending review",
      summary: "Islamic Relief UK updated the organisation profile, descriptions, and contact details.",
      status: "PENDING",
    },
    create: {
      id: "seed-charity-review",
      entityType: "CHARITY",
      entityId: islamicRelief.id,
      charityId: islamicRelief.id,
      title: "Charity profile refresh pending review",
      summary: "Islamic Relief UK updated the organisation profile, descriptions, and contact details.",
      status: "PENDING",
      submittedById: charityAdmin.id,
    },
  });

  await db.moderationItem.upsert({
    where: { id: "seed-reported-content" },
    update: {
      title: "Reported fundraiser comment awaiting moderation",
      summary: "A donor reported a comment on a fundraiser page as inappropriate and misleading.",
      status: "PENDING",
    },
    create: {
      id: "seed-reported-content",
      entityType: "REPORTED_CONTENT",
      charityId: islamicRelief.id,
      title: "Reported fundraiser comment awaiting moderation",
      summary: "A donor reported a comment on a fundraiser page as inappropriate and misleading.",
      status: "PENDING",
      submittedById: adminUser.id,
    },
  });
  console.log("  ✓ Moderation queue seeds");

  // ── Donations + FeeSet + Ledger ─────────────────────────────────────────────
  const donationData: Array<{
    pageId: string;
    userId: string | null;
    amount: string;
    donorName: string | null;
    donorEmail: string;
    giftAid: boolean;
    donorSupportAmount: string;
    chargingMode: ChargingMode;
    donationKind: DonationKind;
  }> = [
    { pageId: aminaPage.id, userId: amina.id, amount: "50.00", donorName: "Khalid M.", donorEmail: "khalid@example.com", giftAid: true, donorSupportAmount: "0.95", chargingMode: "DONOR_SUPPORTED", donationKind: "ONE_OFF" },
    { pageId: aminaPage.id, userId: null, amount: "25.00", donorName: null, donorEmail: "anonymous@example.com", giftAid: false, donorSupportAmount: "0.00", chargingMode: "CHARITY_PAID", donationKind: "ONE_OFF" },
    { pageId: aminaPage.id, userId: fatima.id, amount: "100.00", donorName: "Sarah T.", donorEmail: "sarah@example.com", giftAid: true, donorSupportAmount: "0.00", chargingMode: "CHARITY_PAID", donationKind: "RECURRING" },
    { pageId: yusufPage.id, userId: null, amount: "10.00", donorName: "Anonymous", donorEmail: "anon2@example.com", giftAid: false, donorSupportAmount: "0.34", chargingMode: "DONOR_SUPPORTED", donationKind: "ONE_OFF" },
    { pageId: yusufPage.id, userId: yusuf.id, amount: "75.00", donorName: "Mohammed R.", donorEmail: "mohammed@example.com", giftAid: true, donorSupportAmount: "0.00", chargingMode: "CHARITY_PAID", donationKind: "ONE_OFF" },
  ];

  for (const d of donationData) {
    const amount = new Decimal(d.amount);
    const donorSupportAmount = new Decimal(d.donorSupportAmount);
    const platformFee = amount.times(0.015).toDecimalPlaces(2);
    const processingFee = amount.times(0.014).plus(0.2).toDecimalPlaces(2);
    const totalFees = platformFee.plus(processingFee);
    const netToCharity = d.chargingMode === "DONOR_SUPPORTED" ? amount : amount.minus(totalFees);
    const donorPays = d.chargingMode === "DONOR_SUPPORTED" ? amount.plus(donorSupportAmount) : amount;
    const giftAidExpectedAmount = d.giftAid ? amount.times(0.25).toDecimalPlaces(2) : new Decimal(0);

    const donation = await db.donation.create({
      data: {
        pageId: d.pageId,
        userId: d.userId ?? undefined,
        amount: d.amount,
        contractId: islamicReliefContract.id,
        donationAmount: d.amount,
        donorSupportAmount: donorSupportAmount.toFixed(2),
        grossCheckoutTotal: donorPays.toFixed(2),
        feeChargedToCharity: d.chargingMode === "DONOR_SUPPORTED" ? "0.00" : totalFees.toFixed(2),
        charityNetAmount: netToCharity.toFixed(2),
        resolvedChargingMode: d.chargingMode,
        feeBreakdownSnapshot: {
          platformFeeAmount: platformFee.toFixed(2),
          processingFeeAmount: processingFee.toFixed(2),
          totalFees: totalFees.toFixed(2),
        },
        donationKind: d.donationKind,
        giftAidExpectedAmount: giftAidExpectedAmount.toFixed(2),
        giftAidReceivedAmount: "0.00",
        currency: "GBP",
        status: "CAPTURED",
        isAnonymous: !d.donorName,
        isRecurring: d.donationKind === "RECURRING",
        donorName: d.donorName ?? undefined,
        donorEmail: d.donorEmail,
        receiptIssuedAt: new Date(),
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
        donorCoversFees: d.chargingMode === "DONOR_SUPPORTED",
        netToCharity: netToCharity.toFixed(2),
        snapshotJson: { scheduleId: schedule.id, version: 1, chargingMode: d.chargingMode, donorSupportAmount: donorSupportAmount.toFixed(2) },
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
