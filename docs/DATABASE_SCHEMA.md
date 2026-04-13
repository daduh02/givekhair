# Database Schema

This document describes the current implemented database schema for GiveKhair, based on the live Prisma schema and the product flows currently present in the repo.

It is intended to help:
- engineers understand the data model quickly
- product and ops teams understand how major entities connect
- future contributors see where the schema is ahead of delivered workflows

This is a practical reference, not a future-state wishlist.

---

## Purpose

GiveKhair is a UK-focused charity fundraising platform with:

- charities and charity admins
- appeals, teams, and fundraising pages
- online and offline donations
- Gift Aid workflows
- contract-led pricing and fee rules
- payout and finance operations
- moderation and governance foundations

The schema is intentionally broader than the currently shipped UI in some areas. Where that is true, this document calls it out.

---

## Main entity relationship summary

At the highest level, the platform works like this:

1. A Charity exists on the platform.
2. A charity creates one or more Appeals.
3. An appeal can contain:
- Teams
- Fundraising Pages
4. Donors give against a Fundraising Page, which rolls up into an appeal and charity.
5. A donation may have:
- a Payment
- a FeeSet
- a GiftAidDeclaration
- Refunds
- JournalEntries
6. Charities are governed commercially by:
- CommercialPlan
- FeeSchedule
- FeeRule
- CharityContract
7. Funds are operationally managed through:
- PayoutBatch
- BankAccount
- GiftAidClaim
- GiftAidClaimItem
- ledger entries
8. Offline fundraising is captured through:
- OfflineDonation
- OfflineUploadBatch
9. Moderation and governance are supported through:
- ModerationItem
- ModerationLog
- terms and acceptance records

---

## Domain overview

The schema can be read in these domains:

1. Auth and user accounts
2. Charity structure
3. Appeals, teams, and fundraising pages
4. Donations and payments
5. Offline donations
6. Gift Aid
7. Fees, plans, and contracts
8. Payouts and finance
9. Moderation and governance

---

# 1. Auth and user accounts

## `User`
Represents a platform user.

This includes:
- donors
- fundraisers
- team leads
- charity admins
- finance users
- platform admins

### Key fields
- `id`
- `email`
- `name`
- `image`
- `passwordHash`
- `role`
- `twoFactorEnabled`
- `createdAt`
- `updatedAt`

### Relationships
A user can be related to:
- `Account[]`
- `Session[]`
- `FundraisingPage[]`
- `Donation[]`
- `OfflineDonation[]` via created-by relation
- `GiftAidDeclaration[]`
- `CharityAdmin[]`
- `TeamMember[]`
- `OfflineUploadBatch[]`

### Notes
- The role model is central to platform permissions.
- Email/password and Google sign-in are both supported.
- Some governance and user-management workflows may still be expanding in the UI.

## `Account`
OAuth/provider account linkage for Auth.js / NextAuth.

### Key fields
- `userId`
- `provider`
- `providerAccountId`
- token fields

### Notes
- Used for provider-authenticated login such as Google.

## `Session`
Active user sessions.

## `VerificationToken`
Verification / auth token support for Auth.js flows.

---

# 2. Charity structure

## `Charity`
Represents a charity onboarded to the platform.

### Key fields
- `id`
- `name`
- `slug`
- `registrationNo`
- `charityNumber`
- `description`
- `shortDescription`
- `fullDescription`
- `logoUrl`
- `bannerUrl`
- `websiteUrl`
- `contactEmail`
- `countryCode`
- `defaultCurrency`
- `isVerified`
- `isActive`
- `verificationStatus`
- `status`

### Relationships
A charity can have:
- `admins`
- `appeals`
- `bankAccounts`
- `payoutBatches`
- `giftAidClaims`
- `feeSchedules`
- `contracts`
- `termsAcceptances`
- `moderationItems`

### Notes
- This is the root operational entity for fundraising, finance, and contracts.
- Charity-level visibility, verification, and admin scoping are important across the app.

## `CharityAdmin`
Join model linking users to charities they administer.

### Key fields
- `userId`
- `charityId`

### Notes
- A single user can administer more than one charity if needed.
- Charity scoping in admin uses this relationship.

---

# 3. Appeals, teams, and fundraising pages

## `Category`
Appeal category used for public browsing and appeal classification.

### Key fields
- `name`
- `slug`
- `iconUrl`

## `Appeal`
The main fundraising campaign container for a charity.

### Key fields
- `charityId`
- `categoryId`
- `title`
- `slug`
- `story`
- `impact`
- `goalAmount`
- `currency`
- `startsAt`
- `endsAt`
- `bannerUrl`
- `mediaGallery`
- `visibility`
- `status`

### Relationships
An appeal belongs to a charity and can have:
- `teams`
- `fundraisingPages`
- `offlineUploads`
- `moderationItems`

### Notes
- Appeals are central to public fundraising discovery.
- Public homepage and campaign surfaces pull from active/public appeals.
- Teams and fundraiser pages are grouped under appeals.

## `Team`
A group inside an appeal.

### Key fields
- `appealId`
- `name`
- `slug`
- `description`
- `goalAmount`
- `visibility`
- `status`

### Relationships
A team has:
- `members`
- `pages`
- `moderationItems`

### Notes
- Teams support group fundraising and campaign structure.
- Analytics/leaderboards may continue to expand around this model.

## `TeamMember`
Join model linking users to teams.

### Key fields
- `teamId`
- `userId`
- `isLead`
- `joinedAt`

### Notes
- Used for team membership and lead designation.

## `FundraisingPage`
A personal or team-linked fundraising page created under an appeal.

### Key fields
- `userId`
- `appealId`
- `teamId`
- `title`
- `shortName`
- `story`
- `targetAmount`
- `currency`
- `status`
- `visibility`
- `coverImageUrl`
- `externalPageId`

### Relationships
A page has:
- `donations`
- `offlineDonations`
- `mediaItems`
- `updates`
- `moderationItems`

### Notes
- This is the main donor-facing fundraising unit under an appeal.
- Public fundraiser pages, updates, media, and owner-side management all use this model.

## `PageMedia`
Media attached to a fundraising page.

### Key fields
- `pageId`
- `url`
- `type`
- `sortOrder`

## `PageUpdate`
Owner-authored updates published to a fundraising page.

### Key fields
- `pageId`
- `body`
- `createdAt`

---

# 4. Donations and payments

## `Donation`
Represents an online donation attempt/record against a fundraising page.

### Key fields
- `pageId`
- `userId`
- `amount`
- `currency`
- `status`
- `isAnonymous`
- `isRecurring`
- `donorName`
- `donorEmail`
- `receiptIssuedAt`
- `message`
- `externalRef`
- `idempotencyKey`
- `riskScore`
- `riskReasons`
- `holdState`

### Relationships
A donation can have:
- `feeSet`
- `payment`
- `giftAidDeclaration`
- `journalEntries`
- `refunds`

### Notes
- Donation is the operational center of the online giving flow.
- In current product terms, donations also connect into fee snapshots, payouts, refunds, disputes, and Gift Aid.
- Newer pricing behavior is contract-led, with donation pricing fields/snapshots preserved for audit and finance operations.

## `Payment`
Provider-side payment record linked 1:1 with a donation.

### Key fields
- `donationId`
- `provider`
- `providerRef`
- `amount`
- `currency`
- `settledAt`
- `failureReason`

### Notes
- Supports provider settlement and payment lifecycle tracking.

## `Refund`
Refund record linked to a donation.

### Key fields
- `donationId`
- `amount`
- `reason`
- `providerRef`
- `initiatedBy`
- `processedAt`
- `createdAt`

### Notes
- Refund and dispute operations now exist operationally in admin.
- Recovery and provider automation may still be evolving.

---

# 5. Offline donations

## `OfflineDonation`
Represents a donation recorded outside the online checkout flow.

### Key fields
- `pageId`
- `batchId`
- `amount`
- `currency`
- `receivedDate`
- `donorName`
- `notes`
- `status`
- `createdById`

### Relationships
An offline donation can have:
- `giftAidDeclaration`

### Notes
- Offline donations are included in the platform because real fundraising often happens outside direct checkout.
- These records can be entered manually or created via CSV import.
- Only approved offline donations should be treated as part of live fundraising totals.

## `OfflineUploadBatch`
Tracks a CSV import batch for offline donations.

### Key fields
- `appealId`
- `uploadedById`
- `fileName`
- `rowCount`
- `errorCount`
- `status`
- `resultJson`
- `committedAt`

### Notes
- Supports dry-run validation before commit.
- Useful for auditability of bulk offline donation ingestion.

---

# 6. Gift Aid

## `GiftAidDeclaration`
Represents the donor's Gift Aid declaration.

### Key fields
- `userId`
- `donationId`
- `offlineDonationId`
- `donorFullName`
- address fields
- `type`
- `statementVersion`
- `statementText`
- `ipAddress`
- `userAgent`
- `createdById`
- `createdAt`
- `revokedAt`

### Relationships
A declaration can link to:
- an online donation
- an offline donation
- `GiftAidClaimItem[]`

### Notes
- This is the legal/audit entity for Gift Aid eligibility and claim support.

## `GiftAidClaim`
Represents a Gift Aid claim batch for a charity.

### Key fields
- `charityId`
- `periodStart`
- `periodEnd`
- `status`
- `totalDonations`
- `reclaimAmount`
- `submittedAt`
- `paidAt`
- `hmrcRef`

### Relationships
- belongs to a charity
- has `items`

### Notes
- Supports draft, submission, and paid-state workflow.
- HMRC automation may still be incomplete even though manual claim lifecycle is present.

## `GiftAidClaimItem`
Links a declaration into a specific claim.

### Key fields
- `claimId`
- `declarationId`
- `donationAmount`
- `reclaimAmount`

### Notes
- Provides item-level traceability inside a Gift Aid claim.

---

# 7. Fees, plans, and contracts

This is one of the most important parts of the schema because pricing is now contract-led.

## `CommercialPlan`
Represents a reusable commercial package or plan.

### Key fields
- `name`
- `slug`
- `description`
- `fundraisingModel`
- `billingInterval`
- `platformFlatFee`
- `platformFlatFeeCurrency`
- `featureSummary`
- `status`

### Relationships
- `feeSchedules`
- `contracts`

### Notes
- A plan is a reusable commercial package.
- Runtime pricing should not rely on plans alone; contracts and fee schedules are more operationally important.

## `FeeSchedule`
Represents a versioned schedule of fee rules.

### Key fields
- `charityId`
- `commercialPlanId`
- `version`
- `name`
- `isActive`
- `validFrom`
- `validTo`

### Relationships
- belongs optionally to a charity
- belongs optionally to a commercial plan
- has `rules`
- has `feeSets`
- links to `contracts`

### Notes
- Fee schedules are versioned pricing inputs.
- A charity may have a specific schedule, while a null-charity schedule can act as platform default.

## `FeeRule`
Represents an individual pricing rule inside a fee schedule.

### Key fields
- `scheduleId`
- `countryCode`
- `fundraisingModel`
- `paymentMethod`
- `subscriptionTier`
- `ruleType`
- `platformFeePct`
- `platformFeeFixed`
- `processingFeePct`
- `processingFeeFixed`
- `giftAidFeePct`
- `capAmount`
- `promoCode`
- `sortOrder`

### Notes
- Fee rules power pricing logic.
- Newer pricing flows also depend on contract and charging-mode context.

## `FeeSet`
Represents a fee snapshot applied to a donation.

### Key fields
- `scheduleId`
- `donationId`
- `platformFeeAmount`
- `processingFeeAmount`
- `giftAidFeeAmount`
- `totalFees`
- `donorCoversFees`
- `netToCharity`
- `snapshotJson`

### Notes
- This is the audit snapshot of pricing used at donation time.
- Even as pricing becomes more contract-led, donation-time fee snapshots remain important for audit and reporting.

## `CharityContract`
Represents the actual commercial agreement for a charity.

### Key fields
- `charityId`
- `commercialPlanId`
- `feeScheduleId`
- `status`
- `effectiveFrom`
- `effectiveTo`
- `signedAt`
- `signedByName`
- `signedByEmail`
- `termsVersion`
- `payoutTerms`
- `reservePolicy`
- `autoRenew`
- `notes`

### Relationships
- belongs to a charity
- belongs to a commercial plan
- optionally links to a fee schedule
- has `acceptances`

### Notes
- Contracts are the operational commercial layer for charities.
- The platform now uses contract-led pricing for new donation writes.
- Contract renewal/versioning exists to preserve historic commercial periods.

## `TermsAcceptance`
Tracks legal/commercial acceptance records.

### Key fields
- `contractId`
- `charityId`
- `documentType`
- `version`
- `acceptedByName`
- `acceptedByEmail`
- `acceptedAt`
- `notes`

### Notes
- Useful for legal traceability.
- Separate from contracts so history is preserved cleanly.

---

# 8. Payouts and finance

## `BankAccount`
Represents a charity payout destination.

### Key fields
- `charityId`
- `accountName`
- masked account/sort code/IBAN fields
- `currency`
- `provider`
- `providerRef`
- `isDefault`
- `isVerified`

### Notes
- Used by payout operations.

## `PayoutBatch`
Represents a payout batch for a charity.

### Key fields
- `charityId`
- `bankAccountId`
- `currency`
- `grossAmount`
- `feesAmount`
- `netAmount`
- `status`
- `scheduledFor`
- `processedAt`
- `bankRef`
- `providerRef`
- `idempotencyKey`

### Relationships
- belongs to a charity
- belongs to a bank account
- has `journalEntries`

### Notes
- Manual payout batch operations exist.
- Payout readiness respects contract expiry/suspension logic.
- Donor-support revenue should not be included in charity payout totals.
- Async provider processing and reconciliation workflows may still be incomplete.

## `JournalEntry`
Represents a ledger journal entry.

### Key fields
- `correlationId`
- `donationId`
- `refundId`
- `payoutBatchId`
- `description`
- `createdAt`

### Relationships
- has `lines`

### Notes
- Used for accounting-style financial traceability.
- GL export is based on this ledger direction.

## `LedgerLine`
A debit/credit line inside a journal entry.

### Key fields
- `entryId`
- `accountCode`
- `debit`
- `credit`
- `currency`
- `fxRate`
- `description`

### Notes
- This is the line-level accounting representation.
- Useful for finance exports and reconciliation work.

---

# 9. Moderation and governance

## `ModerationItem`
Represents a moderation review item.

### Key fields
- `entityType`
- `entityId`
- `charityId`
- `appealId`
- `teamId`
- `pageId`
- `title`
- `summary`
- `status`
- `submittedById`
- `reviewedById`
- `reviewNotes`
- `createdAt`
- `reviewedAt`

### Notes
- Used to support moderation and content review workflows.

## `ModerationLog`
Immutable moderation action log.

### Key fields
- `entityType`
- `entityId`
- `action`
- `reason`
- `actorId`
- `createdAt`

### Notes
- Supports governance and risk/moderation traceability.
- Broader risk/hold-state workflows may still be evolving.

---

# Important enums and status groups

## User roles
`UserRole`
- `DONOR`
- `FUNDRAISER`
- `TEAM_LEAD`
- `CHARITY_ADMIN`
- `FINANCE`
- `PLATFORM_ADMIN`

## Charity
`CharityVerificationStatus`
- `UNVERIFIED`
- `PENDING`
- `VERIFIED`
- `REJECTED`

`CharityStatus`
- `DRAFT`
- `ACTIVE`
- `PAUSED`
- `ARCHIVED`

## Appeal
`AppealVisibility`
- `PUBLIC`
- `UNLISTED`
- `HIDDEN`

`AppealStatus`
- `DRAFT`
- `ACTIVE`
- `PAUSED`
- `ENDED`

## Team
`TeamStatus`
- `DRAFT`
- `ACTIVE`
- `HIDDEN`
- `BANNED`

## Fundraising pages
`PageStatus`
- `DRAFT`
- `PENDING_APPROVAL`
- `ACTIVE`
- `REJECTED`
- `SUSPENDED`
- `BANNED`
- `ENDED`

`PageVisibility`
- `PUBLIC`
- `UNLISTED`
- `HIDDEN`

## Fees and contracts
`FundrasingModel`
- `CHARITY`
- `CROWDFUNDING`

`FeeRuleType`
- `PERCENTAGE`
- `FIXED`
- `TIERED`

`BillingInterval`
- `MONTHLY`
- `QUARTERLY`
- `ANNUALLY`
- `CUSTOM`

`CommercialPlanStatus`
- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

`ContractStatus`
- `DRAFT`
- `ACTIVE`
- `SUSPENDED`
- `EXPIRED`
- `TERMINATED`

`TermsDocumentType`
- `MASTER_SERVICE_AGREEMENT`
- `FEE_SCHEDULE`
- `DATA_PROCESSING`
- `FUNDRAISING_RULES`
- `GIFT_AID_TERMS`
- `PLATFORM_TERMS`

## Donations
`DonationStatus`
- `PENDING`
- `AUTHORISED`
- `CAPTURED`
- `REFUNDED`
- `PARTIALLY_REFUNDED`
- `DISPUTED`
- `FAILED`
- `CANCELLED`

`HoldState`
- `NONE`
- `SOFT_HOLD`
- `HARD_HOLD`

## Offline donations
`OfflineDonationStatus`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`

## Gift Aid
`GiftAidDeclarationType`
- `SINGLE`
- `ENDURING`

`GiftAidClaimStatus`
- `DRAFT`
- `SUBMITTED`
- `ACCEPTED`
- `REJECTED`
- `PAID`

## Payouts
`PayoutStatus`
- `SCHEDULED`
- `PROCESSING`
- `PAID`
- `FAILED`

## Moderation
`ModerationEntityType`
- `CHARITY`
- `APPEAL`
- `TEAM`
- `FUNDRAISING_PAGE`
- `REPORTED_CONTENT`

`ModerationReviewStatus`
- `PENDING`
- `APPROVED`
- `REJECTED`
- `HIDDEN`
- `BANNED`

---

# Current-state notes and caveats

## 1. Schema vs delivered UI
Some parts of the schema are broader than the currently delivered UI. This is intentional.

Examples:
- the ledger layer exists and supports exports, but finance/reconciliation UI may still be expanding
- Gift Aid claim lifecycle exists, while some automation may still be partial
- some moderation and governance foundations exist ahead of full operational tooling

## 2. Pricing is contract-led, but snapshots still matter
The product now uses contract-led pricing for new donation writes, but fee snapshot entities remain important for:
- audit
- reporting
- finance review
- historical consistency

## 3. Offline donations are first-class operational records
Offline donations are not just notes or manual totals. They are modeled records with:
- approval status
- batch import support
- optional Gift Aid declaration linkage

## 4. Payouts depend on finance and contract state
Payout readiness is not just a balance calculation. It depends on:
- charity contract state
- payout logic
- linked donation and Gift Aid allocations

## 5. Risk/governance can grow further
The schema already includes moderation log and hold-state concepts, but broader risk workflows may still be incomplete in the operational UI.

---

# Suggested companion docs

This schema document works best alongside:
- `docs/ARCHITECTURE.md`
- `docs/PROGRESS.md`
- `docs/ROADMAP.md`
- `docs/PUBLIC_EXPERIENCE.md`

---

# Maintenance notes

Update this document when:
- a major model is added or removed
- important relationships change
- enum values change
- contract/fee/payout/Gift Aid logic changes materially
- a previously partial workflow becomes fully operational
