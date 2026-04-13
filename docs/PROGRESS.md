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
- Major finance, payout, reporting, reconciliation, refund, and dispute workflows are still incomplete.

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
- `Done` Homepage and navbar admin entrypoints after login
- `Done` Demo passwords populated for seeded users

### Public fundraising experience

- `Done` Homepage rewritten around a premium public shell, featured appeal, trust messaging, category pills, and reusable cards
- `Done` Global public footer applied through shared layout rather than copied into individual pages
- `Done` Public information architecture for charities, how-it-works, Zakat/Gift Aid, and policy/support placeholder pages
- `Done` Centralized public theme tokens, button styles, chips, cards, and progress bar patterns
- `Done` Appeal detail page with totals, teams, fundraiser list, and donation widget on every appeal page
- `Done` Dedicated public fundraiser page route at `/fundraise/[shortName]` with story, progress, updates, donor feed, and donation widget
- `Done` Protected fundraiser creation flow at `/fundraise/new`
- `Done` Protected fundraiser edit flow at `/fundraise/[shortName]/edit`
- `Done` Dashboard entry points for creating and managing your fundraiser pages
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
- `Done` Team creation and membership management within appeal admin
- `Done` Moderation queue page
- `Done` Donations admin page
- `Done` Offline donations admin page
- `Done` Offline CSV dry-run and commit flow
- `Done` Shared admin context helper for resolving current charity/admin scope
- `Done` Platform-admin appeal visibility across all charities

## Partially Implemented

### Fundraising pages

- `Partial` Page data model exists
- `Partial` Page create and update tRPC mutations exist
- `Done` Public fundraiser page detail route exists
- `Done` Dedicated fundraiser page creation/edit UI exists
- `Partial` Ongoing page-update tools like media management and richer update publishing are still missing

### Donations

- `Done` Donation intent creation exists
- `Done` Fee snapshot is stored per donation
- `Done` Hosted test checkout handoff exists for end-to-end development
- `Done` Webhook route reuses donation capture and failure processing
- `Partial` Live payment-provider checkout is not yet wired
- `Partial` Refund and dispute operations are not yet built

### Fees and finance

- `Partial` Fee engine exists with schedule/rule resolution
- `Partial` Ledger helper code exists
- `Partial` Finance UI is mostly placeholder pages

### Gift Aid

- `Partial` Data model exists
- `Partial` Donation flow captures Gift Aid fields
- `Partial` Offline donation flow can create Gift Aid declarations
- `Partial` Online donations are linked into a draft claim queue on capture
- `Partial` Claim building, submission, and admin operations are not complete

### Offline donations

- `Done` Offline donation schema exists
- `Done` Admin manual offline donation workflow
- `Done` CSV dry-run validation and commit flow
- `Done` Duplicate detection and Gift Aid validation for offline imports
- `Partial` Offline totals are included in some aggregate views
- `Partial` Downloadable error/result exports are not built

## Not Started

### Spec-critical product slices

- `Partial` Donations management and operational visibility
- `Not started` Refunds, disputes, and chargeback workflows
- `Not started` Payout batching lifecycle and reconciliation UI
- `Not started` GL export and finance CSV exports per accounting structure
- `Not started` Gift Aid claim queue, submission, and paid-state workflow
- `Not started` Team leaderboards
- `Done` Public charity directory now links into rich public charity profile pages
- `Not started` Reporting center with downloadable exports
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
- `Partial` richer fundraiser self-serve management remains limited to the current core form

### 5.4 Donations

- `Done` donation intent, fee snapshot, and hosted test-checkout completion flow
- `Done` webhook-driven payment confirmation and failure handling foundation
- `Done` appeal pages guarantee a donation widget via a hidden fallback checkout page when needed
- `Partial` robust receipt delivery, provider-specific recurring billing, and refund operations

### 5.5 Fee & Pricing Model

- `Partial` fee schedule + runtime preview
- `Not started` admin fee configuration UX

### 5.6 Bank Accounts & Payouts

- `Partial` schema and overview aggregates
- `Not started` working payout operations

### 5.7 Gift Aid

- `Partial` declaration capture
- `Partial` offline declaration creation
- `Partial` online capture adds declarations into a draft claim queue
- `Not started` claims lifecycle

### 5.8 Reporting

- `Not started` usable exports center

### 5.9 Risk, Trust & Moderation

- `Partial` moderation queue and page status controls
- `Partial` public trust messaging and compliance cues now exist in the marketing surface
- `Not started` risk scoring, hold states, and immutable moderation log workflow

### 5.10 Offline Donations & Teams

- `Done` schema
- `Done` team creation and member management in appeal admin
- `Done` offline donation management workflow
- `Partial` leaderboards and richer team analytics

### 5.11 Bulk Upload

- `Done` dry-run and commit flow for offline donations
- `Not started` downloadable result CSV and batch audit exports

### 5.12 Refunds, Disputes & Chargebacks

- `Not started`

## Immediate Next Recommendations

1. Build `Reports and exports` so charity teams can actually extract and use the data they are entering.
2. Build `Payouts + Gift Aid workflows` after the public fundraising surface is now in place.
3. Build `Richer fundraiser self-serve tools` such as updates, media management, and moderation-state messaging.
4. Build `Refunds, disputes, and chargeback handling` on top of the new donation operations foundation.
5. Build `Team analytics and leaderboards` to strengthen the appeal/team fundraising side of the product.
