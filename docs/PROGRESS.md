# Progress Tracker

Last updated: 2026-04-13

This file tracks the current delivery state of the product against the working giveKhair specification.

## Status Legend

- `Done`: implemented and present in the repo
- `Partial`: some foundations or UI exist, but the full workflow is not complete
- `Not started`: not yet implemented in a usable way

## Current Summary

- Product foundation is in place: auth, core schema, public homepage, appeal pages, fee preview, donation intent creation, admin shell, and production deployment flow.
- Email/password login and Google login are both now available.
- Admin and homepage role-aware navigation are working.
- Charity setup, appeal management, moderation, offline donation operations, and donation management now have real admin workflows.
- Public-facing routes now use a shared shell with a reusable footer, centralized theme tokens, and cleaner reusable components.
- Commercial pricing is now contract-led for new donation writes, with donor-supported, charity-paid, and hybrid charging modes.
- Major reconciliation and advanced recovery workflows are still incomplete, but refunds, disputes, and finance/accounting exports now have a real operational starting point.
- Appeal and team leaderboard analytics are now live across public appeal pages and admin overview reporting.
- Reconciliation exports and finance exception reporting are now live across admin reports and a dedicated reconciliation queue.

## Completed

### Platform and deployment

- `Done` Next.js 14 app with App Router
- `Done` Prisma schema covering users, charities, appeals, teams, pages, donations, fees, payouts, Gift Aid, offline donations, ledger entities
- `Done` Vercel production deployment working on Node 20
- `Done` Production hardening so public pages do not crash on missing env or transient DB failures
- `Done` Public route-group layout for shared public navigation and footer

### Authentication and access

- `Done` NextAuth v4 integration
- `Done` Google sign-in flow
- `Done` Email/password sign-in flow
- `Done` Session role propagation into the app
- `Done` Admin route protection
- `Done` Platform-admin user management surface at `/admin/users` with user list/search/filter
- `Done` Server-side suspension enforcement across credentials sign-in, OAuth sign-in, middleware checks, and server `auth()` lookups
- `Done` One-time invite/password setup/reset token flow via `/auth/set-password`
- `Done` Access-control audit logging for invite, role, suspension, and password-access actions
- `Done` Homepage and navbar admin entrypoints after login
- `Done` Demo passwords populated for seeded users

### Public fundraising experience

- `Done` Homepage rewritten around a premium public shell, featured appeal, trust messaging, category pills, and reusable cards
- `Done` Homepage featured appeal is now admin-controlled rather than inferred from latest data
- `Done` Trending appeal section now pages horizontally in grouped sets instead of a fixed small grid
- `Done` Global public footer applied through shared layout rather than copied into individual pages
- `Done` Public information architecture for charities, how-it-works, Zakat/Gift Aid, and policy/support placeholder pages
- `Done` Centralized public theme tokens, button styles, chips, cards, and progress bar patterns
- `Done` Signed-in public navbar account menu with role-aware actions for admin, dashboard, fundraising, and logout
- `Done` Homepage tone refinement so the public landing experience reads more product-specific and less generic
- `Done` Appeal detail page with totals, teams, fundraiser list, and donation widget on every appeal page
- `Done` Dedicated public fundraiser page route at `/fundraise/[shortName]` with story, progress, updates, donor feed, and donation widget
- `Done` Protected fundraiser creation flow at `/fundraise/new`
- `Done` Protected fundraiser management flow at `/fundraise/[shortName]/edit`
- `Done` Dashboard entry points for creating and managing your fundraiser pages
- `Done` Owner-side fundraiser updates publishing
- `Done` Owner-side fundraiser media gallery management with reorder/remove controls
- `Done` Fundraiser moderation-state messaging for owners
- `Done` Lightweight fundraiser analytics in dashboard and owner management
- `Done` Fee preview in donation widget
- `Done` Donation intent creation flow in tRPC
- `Done` Gift Aid capture fields in donation intent flow
- `Done` Hosted test checkout route and thank-you flow
- `Done` Sign-in and auth error pages restyled into the same public design system

### Admin experience

- `Done` Admin dashboard shell and overview page
- `Done` Platform-level admin overview across all charities
- `Done` Charity-specific overview pages
- `Done` Admin charities list and dedicated create/edit pages
- `Done` Admin appeals list page
- `Done` Admin appeal creation page
- `Done` Admin appeal edit page
- `Done` Platform-admin homepage featured appeal control inside appeal management
- `Done` Team creation and membership management within appeal admin
- `Done` Moderation queue page
- `Done` Donations admin page
- `Done` Disputes and chargebacks admin page
- `Done` Offline donations admin page
- `Done` Offline CSV dry-run and commit flow
- `Done` Reports center with scoped CSV exports for donations, offline donations, payouts, and Gift Aid
- `Done` General-ledger CSV export in spec-style journal row format
- `Done` Reconciliation CSV exports for payouts, Gift Aid, and finance exceptions
- `Done` Admin reconciliation queue with payout readiness, blocked reasons, and Gift Aid allocation visibility
- `Done` Platform-admin-only user management workflow with role updates, suspend/unsuspend, invite, password setup/reset triggers, and recent access audit feed
- `Done` Export history persistence for CSV generation with status, row-count, scope, filters, and error metadata
- `Done` Immutable export artifact storage with checksum metadata and controlled re-download endpoint
- `Done` Reconciliation stale-age visibility and queued finance alert notifications
- `Done` Gated finance automation runner (dry-run by default, execution behind env flag) for payout and Gift Aid settlement actions
- `Done` Public appeal leaderboards for fundraiser-page and team rankings with online/offline combined totals
- `Done` Admin campaign-performance leaderboards for top appeals, teams, and fundraiser pages
- `Done` Leaderboard timeframe filters (`30d`, `90d`, `all-time`) and tie-aware ranking labels
- `Done` Full leaderboard drill-down pages for public appeals and admin analytics
- `Done` Shared admin context helper for resolving current charity/admin scope
- `Done` Platform-admin appeal visibility across all charities

## Partially Implemented

### Fundraising pages

- `Partial` Page data model exists
- `Partial` Page create and update tRPC mutations exist
- `Done` Public fundraiser page detail route exists
- `Done` Dedicated fundraiser page creation/edit UI exists
- `Done` Ongoing page-update tools now include owner-side media management and richer update publishing

### Donations

- `Done` Donation intent creation exists
- `Done` Fee snapshot is stored per donation
- `Done` Hosted test checkout handoff exists for end-to-end development
- `Done` Webhook route reuses donation capture and failure processing
- `Partial` Live payment-provider checkout is not yet wired
- `Done` Refund records and dispute operations now exist in admin

### Fees and finance

- `Done` Contract-led fee engine now resolves active charity contracts before fee schedules
- `Done` Charging modes now support `DONOR_SUPPORTED`, `CHARITY_PAID`, and `HYBRID`
- `Done` Donation pricing now persists contract linkage, donation amount, donor-support amount, gross checkout total, charity fee, charity net, charging mode, Gift Aid expectations, and pricing snapshots
- `Done` Starter admin settings area now stores commercial plans, fee schedules, charity contracts, contract documents, and commercial audit entries
- `Done` Contract edit and renewal/versioning routes now exist on top of the admin settings surface
- `Done` Fee rules can now vary by donation kind, charging mode, active state, and effective dates
- `Done` Appeal-level donor-support override exists and only overrides donor-support behavior
- `Done` Manual payout batches can now be created, itemized, and advanced through scheduled, processing, and paid states
- `Partial` Ledger helper code exists
- `Partial` Finance UI is still incomplete, but fees/contracts now have a working contract-led foundation

### Gift Aid

- `Partial` Data model exists
- `Partial` Donation flow captures Gift Aid fields
- `Partial` Offline donation flow can create Gift Aid declarations
- `Partial` Online donations are linked into a draft claim queue on capture
- `Done` Admin Gift Aid page now supports draft claim building, submission, and paid settlement
- `Done` Paid Gift Aid claims now update linked donations so payout batches can include reclaim amounts
- `Partial` HMRC integration and automated claim submission are still not built

### Offline donations

- `Done` Offline donation schema exists
- `Done` Admin manual offline donation workflow
- `Done` CSV dry-run validation and commit flow
- `Done` Duplicate detection and Gift Aid validation for offline imports
- `Partial` Offline totals are included in some aggregate views
- `Partial` Downloadable error/result exports are not built

## Not Started

### Spec-critical product slices

- `Done` Donations management and operational visibility
- `Done` Refunds, disputes, and chargeback workflows
- `Not started` Payout batching lifecycle and reconciliation UI
- `Done` First-pass reconciliation UI and exports
- `Partial` GL export and finance CSV exports per accounting structure
- `Done` Gift Aid claim queue, submission, and paid-state workflow
- `Done` Team leaderboards and first-pass campaign analytics
- `Done` Public charity directory now links into rich public charity profile pages
- `Done` Reporting center with downloadable exports
- `Not started` Risk scoring, hold states, and moderation logs
- `Not started` DSAR/governance workflows
- `Not started` Accessibility audit automation and CI gates

## Spec Mapping

### 5.1 Accounts & Auth

- `Done` email/password
- `Done` Google OAuth
- `Partial` 2FA for admins
- `Done` role model

### 5.2 Charity & Appeal Management

- `Done` charity setup and edit workflow
- `Done` charity create flow on its own page
- `Done` charity overview pages linked from the charities list
- `Done` appeal creation and edit workflow
- `Done` charity-admin scope
- `Done` moderation queue
- `Done` visibility/moderation ops UI for appeals and fundraiser pages

### 5.3 Fundraising Pages

- `Partial` schema and mutations
- `Partial` moderation controls exist in admin appeal flows
- `Done` protected create/edit routes for fundraiser owners
- `Done` public fundraiser detail route
- `Done` richer fundraiser self-serve management now supports updates, media, moderation guidance, and lightweight analytics

### 5.4 Donations

- `Done` donation intent, fee snapshot, and hosted test-checkout completion flow
- `Done` webhook-driven payment confirmation and failure handling foundation
- `Done` appeal pages guarantee a donation widget via a hidden fallback checkout page when needed
- `Done` admin refund records, partial/full refund tracking, and dispute visibility
- `Partial` robust receipt delivery and provider-specific recurring billing

### 5.5 Fee & Pricing Model

- `Done` contract-led runtime pricing preview
- `Done` donor-supported, charity-paid, and hybrid charging behavior
- `Done` recurring vs one-off fee rule selection
- `Done` pricing snapshot persistence on both `Donation` and `FeeSet`
- `Done` contract renewal/versioning flow for creating a fresh commercial period without mutating historic records
- `Partial` starter admin fee configuration UX now exists in `/admin/settings`
- `Partial` richer rule editing and final legal/commercial workflows still need expansion

### 5.6 Bank Accounts & Payouts

- `Done` payout overview and manual payout batch operations
- `Done` payout items now link batches back to donation and Gift Aid allocations
- `Done` payout readiness now respects contract expiry/suspension policy and excludes donor-support revenue from charity payout totals
- `Partial` async payout provider processing and reconciliation are still not built

### 5.7 Gift Aid

- `Partial` declaration capture
- `Partial` offline declaration creation
- `Partial` online capture adds declarations into a draft claim queue
- `Done` manual claim lifecycle and settlement flow
- `Partial` HMRC submission and exception handling

### 5.8 Reporting

- `Done` admin reports center with scoped export cards and operational previews
- `Done` CSV exports for donations, refunds/disputes fields, offline donations, payouts, and Gift Aid claims
- `Done` general-ledger export matching the journal-row direction from the spec appendix
- `Partial` PDF exports, reconciliation-specific downloads, and accounting-system-specific formats remain unbuilt

### 5.9 Risk, Trust & Moderation

- `Partial` moderation queue and page status controls
- `Partial` public trust messaging and compliance cues now exist in the marketing surface
- `Not started` risk scoring, hold states, and immutable moderation log workflow

### 5.10 Offline Donations & Teams

- `Done` schema
- `Done` team creation and member management in appeal admin
- `Done` offline donation management workflow
- `Done` public and admin leaderboard layer with consistent online + approved-offline aggregation rules
- `Done` leaderboard aggregation helper reuse across public/admin with period scoping

### 5.11 Bulk Upload

- `Done` dry-run and commit flow for offline donations
- `Not started` downloadable result CSV and batch audit exports

### 5.12 Refunds, Disputes & Chargebacks

- `Done` refund records and admin actions
- `Done` dispute and chargeback records with admin visibility
- `Done` donation exports now include refund/dispute exception fields
- `Partial` provider-side refund automation, dispute evidence workflows, and recovery automation

## Immediate Next Recommendations

1. Build `Async finance automation` for payout processing, refund provider submission, and HMRC submission flows.
2. Build `Commercial approval/signature workflow` on top of the shipped contract management foundation.
3. Build `Risk scoring and hold-state operations` on top of the current moderation and donation foundations.
4. Build `Moderation audit trails and DSAR/governance operations` to close compliance gaps.
5. Build `Export replay/download tracking` if finance needs file-level retention beyond current export-event metadata.
