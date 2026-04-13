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
- reporting/export audit and finance automation run tracking
- platform access administration controls

The schema is intentionally broader than the currently shipped UI in some areas. Where that is true, this document calls it out.

---

## Main entity relationship summary

At the highest level, the platform works like this:

1. A Charity exists on the platform.
2. A charity creates one or more Appeals.
3. An appeal can contain Teams and Fundraising Pages.
4. Donors give against a Fundraising Page, which rolls up into an appeal and charity.
5. A donation may have a Payment, FeeSet, GiftAidDeclaration, Refunds, Disputes, PayoutBatchItems, and JournalEntries.
6. Commercial behavior is contract-led via CommercialPlan, FeeSchedule, FeeRule, and CharityContract.
7. Funds are managed through BankAccount, PayoutBatch, PayoutBatchItem, GiftAidClaim, GiftAidClaimItem, and ledger entries.
8. Offline fundraising is captured through OfflineDonation and OfflineUploadBatch.
9. Moderation and governance are supported through ModerationItem and ModerationLog.
10. Reporting and finance operations are tracked through ReportExportLog, ReportExportArtifact, and FinanceAutomationRun.
11. Platform access changes are controlled and audited through UserAccessToken and UserAccessAuditLog.

---

## Domain overview

The schema can be read in these domains:

1. Auth and user accounts
2. Access administration
3. Charity structure
4. Appeals, teams, and fundraising pages
5. Donations, payments, refunds, and disputes
6. Offline donations
7. Gift Aid
8. Fees, plans, and contracts
9. Payouts and finance ledger
10. Moderation and governance
11. Reporting, export audit, and finance automation

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
- `emailVerified`
- `name`
- `image`
- `passwordHash`
- `role`
- `invitedAt`
- `suspendedAt`
- `suspendedReason`
- `lastAccessChangeAt`
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
- `ReportExportLog[]`
- `FinanceAutomationRun[]`
- access-token and access-audit relations

### Notes
- The role model is central to platform permissions.
- Email/password and Google sign-in are both supported.
- Invitation/suspension metadata is now first-class on the user record.

## `Account`
OAuth/provider account linkage for Auth.js / NextAuth.

### Key fields
- `userId`
- `provider`
- `providerAccountId`
- token fields

## `Session`
Active user sessions.

## `VerificationToken`
Verification/auth token support for Auth.js flows.

---

# 2. Access administration

## `UserAccessToken`
Stores one-time hashed tokens for invite and password setup/reset workflows.

### Key fields
- `userId`
- `tokenType`
- `tokenHash`
- `expiresAt`
- `usedAt`
- `createdById`
- `createdAt`

### Notes
- Raw token values are not stored.
- Used for `INVITE`, `PASSWORD_SETUP`, and `PASSWORD_RESET`.

## `UserAccessAuditLog`
Immutable access-control audit history for user administration actions.

### Key fields
- `actorUserId`
- `targetUserId`
- `action`
- `reason`
- `beforeJson`
- `afterJson`
- `createdAt`

### Notes
- Captures role changes, suspension changes, invites, and password access operations.

---

# 3. Charity structure

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
- `commercialAuditLogs`
- `moderationItems`
- `reportExports`

## `CharityAdmin`
Join model linking users to charities they administer.

### Key fields
- `userId`
- `charityId`

---

# 4. Appeals, teams, and fundraising pages

## `Category`
Appeal category used for public browsing and classification.

### Key fields
- `name`
- `slug`
- `iconUrl`

## `Appeal`
The fundraising campaign container for a charity.

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
- `donorSupportOverride`
- `isFeaturedHomepage`
- `visibility`
- `status`

### Relationships
An appeal belongs to a charity and can have:
- `teams`
- `fundraisingPages`
- `offlineUploads`
- `moderationItems`

### Notes
- `isFeaturedHomepage` supports admin-controlled homepage featuring.
- `donorSupportOverride` allows appeal-level donor-support behavior override.

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

## `TeamMember`
Join model linking users to teams.

### Key fields
- `teamId`
- `userId`
- `isLead`
- `joinedAt`

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

# 5. Donations, payments, refunds, and disputes

## `Donation`
Represents an online donation record against a fundraising page.

### Key fields
- core:
`pageId`, `userId`, `amount`, `currency`, `status`, `isAnonymous`, `isRecurring`, `donorName`, `donorEmail`, `receiptIssuedAt`, `message`, `externalRef`, `idempotencyKey`
- contract-led pricing:
`contractId`, `donationAmount`, `donorSupportAmount`, `grossCheckoutTotal`, `feeChargedToCharity`, `charityNetAmount`, `resolvedChargingMode`, `feeBreakdownSnapshot`, `donationKind`
- Gift Aid donation-level amounts:
`giftAidExpectedAmount`, `giftAidReceivedAmount`
- risk/ops:
`riskScore`, `riskReasons`, `holdState`

### Relationships
A donation can have:
- `feeSet`
- `payment`
- `giftAidDeclaration`
- `refunds`
- `disputes`
- `payoutItems`
- `journalEntries`
- optional `contract`

### Notes
- `amount` is retained for backward compatibility.
- New pricing writes are contract-led and capture richer financial fields.

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

## `Refund`
Refund record linked to a donation.

### Key fields
- `donationId`
- `amount`
- `status`
- `reason`
- `providerRef`
- `initiatedBy`
- `processedAt`
- `createdAt`

## `Dispute`
Dispute/chargeback record linked to a donation.

### Key fields
- `donationId`
- `providerRef`
- `status`
- `amount`
- `currency`
- `reason`
- `evidenceDueAt`
- `openedAt`
- `closedAt`
- `outcome`
- `notes`
- `metadataJson`
- `recordedById`
- `financialImpactRecordedAt`

### Notes
- Designed as a practical operational layer, not a full correspondence/case-management system.

---

# 6. Offline donations

## `OfflineDonation`
Donation recorded outside online checkout.

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
- optional `giftAidDeclaration`
- optional `page`
- optional `batch`

## `OfflineUploadBatch`
Tracks CSV import batches for offline donations.

### Key fields
- `appealId`
- `uploadedById`
- `fileName`
- `rowCount`
- `errorCount`
- `status`
- `resultJson`
- `committedAt`

---

# 7. Gift Aid

## `GiftAidDeclaration`
Donor Gift Aid declaration for online or offline donation records.

### Key fields
- links:
`userId`, `donationId`, `offlineDonationId`
- donor details:
`donorFullName`, address fields, `donorCountry`
- declaration:
`type`, `statementVersion`, `statementText`
- audit:
`ipAddress`, `userAgent`, `createdById`, `createdAt`, `revokedAt`

## `GiftAidClaim`
Gift Aid claim batch per charity.

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

## `GiftAidClaimItem`
Links a declaration into a specific claim.

### Key fields
- `claimId`
- `declarationId`
- `donationAmount`
- `reclaimAmount`

---

# 8. Fees, plans, and contracts

Pricing is contract-led, with schedules/rules still driving fee calculation inputs.

## `CommercialPlan`
Reusable commercial package.

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

## `FeeSchedule`
Versioned fee schedule.

### Key fields
- `charityId` (nullable for platform-default schedules)
- `commercialPlanId`
- `version`
- `name`
- `isActive`
- `validFrom`
- `validTo`

### Relationships
- has `rules`, `feeSets`, `contracts`, `auditLogs`

## `FeeRule`
Individual rule under a fee schedule.

### Key fields
- targeting:
`countryCode`, `fundraisingModel`, `paymentMethod`, `subscriptionTier`, `donationKind`, `chargingMode`
- fee shape:
`ruleType`, `platformFeePct`, `platformFeeFixed`, `processingFeePct`, `processingFeeFixed`, `giftAidFeePct`, `capAmount`, `promoCode`
- lifecycle:
`isActive`, `effectiveFrom`, `effectiveTo`, `sortOrder`

## `FeeSet`
Donation-time fee snapshot.

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

## `CharityContract`
Operational commercial agreement for a charity.

### Key fields
- linkage/status:
`charityId`, `commercialPlanId`, `feeScheduleId`, `status`
- charging and donor support:
`chargingMode`, `region`, `productType`, `donorSupportEnabled`, `donorSupportPromptStyle`, `donorSupportSuggestedPresets`
- payout/settlement:
`payoutFrequency`, `payoutMethod`, `settlementDelayDays`, `reserveRule`, `autoPauseAppealsOnExpiry`, `blockPayoutsOnExpiry`
- lifecycle/legal:
`effectiveFrom`, `effectiveTo`, `signedAt`, `signedByName`, `signedByEmail`, `termsVersion`, `payoutTerms`, `reservePolicy`, `autoRenew`, `notes`, `internalNotes`

### Relationships
- has `acceptances`, `documents`, `donations`, and `auditLogs`

## `TermsAcceptance`
Legal/commercial acceptance records.

### Key fields
- `contractId`
- `charityId`
- `documentType`
- `version`
- `acceptedByName`
- `acceptedByEmail`
- `acceptedAt`
- `notes`

## `ContractDocument`
Uploaded contract-supporting document.

### Key fields
- `contractId`
- `name`
- `fileUrl`
- `mimeType`
- `documentType`
- `uploadedByName`
- `uploadedByEmail`
- `createdAt`

## `CommercialAuditLog`
Audit records for commercial/configuration changes.

### Key fields
- linkages:
`contractId`, `feeScheduleId`, `feeRuleId`, `charityId`
- event:
`action`, `entityType`, `summary`, `metadata`
- actor/time:
`changedByName`, `changedByEmail`, `createdAt`

---

# 9. Payouts and finance ledger

## `BankAccount`
Charity payout destination.

### Key fields
- `charityId`
- `accountName`
- masked account fields
- `currency`
- `provider`
- `providerRef`
- `isDefault`
- `isVerified`

## `PayoutBatch`
Batch payout run for a charity.

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
- has `items` (`PayoutBatchItem[]`)
- has `journalEntries`

## `PayoutBatchItem`
Itemized payout linkage record for donation/Gift Aid allocations.

### Key fields
- `payoutBatchId`
- `donationId`
- `itemType` (`DONATION` or `GIFT_AID`)
- `grossAmount`
- `feesAmount`
- `netAmount`
- `notes`

## `JournalEntry`
Double-entry journal header.

### Key fields
- `correlationId`
- optional links:
`donationId`, `refundId`, `disputeId`, `payoutBatchId`
- `description`
- `createdAt`

## `LedgerLine`
Debit/credit line under a journal entry.

### Key fields
- `entryId`
- `accountCode`
- `debit`
- `credit`
- `currency`
- `fxRate`
- `description`
- `createdAt`

---

# 10. Moderation and governance

## `ModerationItem`
Moderation queue item.

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

## `ModerationLog`
Immutable moderation action log.

### Key fields
- `entityType`
- `entityId`
- `action`
- `reason`
- `actorId`
- `createdAt`

---

# 11. Reporting, export audit, and finance automation

## `ReportExportLog`
Audit row for report/export generation.

### Key fields
- `reportType`
- `status`
- `exportedById`
- `charityId`
- `requestedCharityId`
- `filtersJson`
- `fileName`
- `contentType`
- `checksumSha256`
- `byteSize`
- `rowCount`
- `errorMessage`
- `createdAt`

### Notes
- Captures operational visibility for export attempts and results.

## `ReportExportArtifact`
Stores immutable generated export content linked 1:1 to an export log.

### Key fields
- `exportLogId`
- `content`
- `createdAt`

## `FinanceAutomationRun`
Records finance automation runs (dry-run, executed, failed).

### Key fields
- `runType`
- `status`
- `requestedById`
- `summary`
- `detailsJson`
- `startedAt`
- `finishedAt`

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

## Access administration
`UserAccessTokenType`
- `INVITE`
- `PASSWORD_SETUP`
- `PASSWORD_RESET`

`UserAccessAuditAction`
- `USER_INVITED`
- `USER_ROLE_CHANGED`
- `USER_SUSPENDED`
- `USER_UNSUSPENDED`
- `PASSWORD_SETUP_TRIGGERED`
- `PASSWORD_RESET_TRIGGERED`

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

## Fees and contracts
`FundrasingModel`
- `CHARITY`
- `CROWDFUNDING`

`FeeRuleType`
- `PERCENTAGE`
- `FIXED`
- `TIERED`

`ChargingMode`
- `CHARITY_PAID`
- `DONOR_SUPPORTED`
- `HYBRID`

`DonationKind`
- `ONE_OFF`
- `RECURRING`

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

`DonorSupportPromptStyle`
- `TOGGLE`
- `CHECKBOX`
- `PRESET`

`PayoutFrequency`
- `DAILY`
- `WEEKLY`
- `MONTHLY`
- `MANUAL`

`PayoutMethod`
- `STRIPE_CONNECT`
- `GOCARDLESS`
- `BACS`
- `MANUAL`

`TermsDocumentType`
- `MASTER_SERVICE_AGREEMENT`
- `FEE_SCHEDULE`
- `DATA_PROCESSING`
- `FUNDRAISING_RULES`
- `GIFT_AID_TERMS`
- `PLATFORM_TERMS`

## Donations and exceptions
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

`RefundStatus`
- `REQUESTED`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

`DisputeStatus`
- `OPEN`
- `UNDER_REVIEW`
- `WON`
- `LOST`
- `CLOSED`

`DisputeOutcome`
- `WON`
- `LOST`
- `WRITTEN_OFF`

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

`PayoutBatchItemType`
- `DONATION`
- `GIFT_AID`

## Reporting and automation
`ReportExportType`
- `DONATIONS`
- `OFFLINE`
- `PAYOUTS`
- `GIFT_AID`
- `GL`
- `PAYOUT_RECONCILIATION`
- `GIFT_AID_RECONCILIATION`
- `FINANCE_EXCEPTIONS`

`ReportExportStatus`
- `SUCCEEDED`
- `FAILED`

`FinanceAutomationRunType`
- `AUTO_RECONCILIATION`
- `PAYOUT_PROVIDER_SYNC`
- `HMRC_CLAIM_SYNC`

`FinanceAutomationRunStatus`
- `DRY_RUN`
- `EXECUTED`
- `FAILED`

---

# Current-state notes and caveats

## 1. Schema vs delivered UI
Some parts of the schema are broader than the currently delivered UI. This is intentional.

Examples:
- ledger and reconciliation entities are present with growing operational UI
- Gift Aid and payout lifecycle models support more automation than currently wired
- access-admin, reporting-artifact, and automation-run models are in place for safe operations and auditability

## 2. Pricing is contract-led, but snapshots still matter
The system resolves pricing from active contracts and fee rules for new donation writes, while fee snapshots remain critical for:
- audit
- finance reporting
- historical consistency

## 3. Offline donations are first-class records
Offline donations are modeled entities with approval status, optional Gift Aid linkage, and bulk import batch tracking.

## 4. Payout readiness is policy-aware
Payout behavior depends on donation/payment state, contract terms, and payout-item allocation logic rather than simple balance arithmetic.

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
- contract/fee/payout/Gift Aid/reporting/access flows change materially
- a previously partial workflow becomes fully operational
