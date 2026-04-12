# Progress Tracker

Last updated: 2026-04-12

This file tracks the current delivery state of the product against the working giveKhair specification.

## Status Legend

- `Done`: implemented and present in the repo
- `Partial`: some foundations or UI exist, but the full workflow is not complete
- `Not started`: not yet implemented in a usable way

## Current Summary

- Product foundation is in place: auth, core schema, homepage, appeal pages, fee preview, donation intent creation, admin shell, and production deployment flow.
- Email/password login and Google login are both now available.
- Admin and homepage role-aware navigation are working.
- Appeals management is now started with a real admin list and create flow.
- Major finance, offline, payout, reporting, moderation, and reconciliation workflows are still incomplete.

## Completed

### Platform and deployment

- `Done` Next.js 14 app with App Router
- `Done` Prisma schema covering users, charities, appeals, teams, pages, donations, fees, payouts, Gift Aid, offline donations, ledger entities
- `Done` Vercel production deployment working on Node 20
- `Done` Production hardening so public pages do not crash on missing env or transient DB failures

### Authentication and access

- `Done` NextAuth v4 integration
- `Done` Google sign-in flow
- `Done` Email/password sign-in flow
- `Done` Session role propagation into the app
- `Done` Admin route protection
- `Done` Homepage and navbar admin entrypoints after login
- `Done` Demo passwords populated for seeded users

### Public fundraising experience

- `Done` Homepage with featured appeals and category filtering
- `Done` Appeal detail page with totals, teams, fundraiser list, and donation widget
- `Done` Fee preview in donation widget
- `Done` Donation intent creation flow in tRPC
- `Done` Gift Aid capture fields in donation intent flow

### Admin experience

- `Done` Admin dashboard shell and overview page
- `Done` Admin appeals list page
- `Done` Admin appeal creation page
- `Done` Shared admin context helper for resolving current charity/admin scope

## Partially Implemented

### Fundraising pages

- `Partial` Page data model exists
- `Partial` Page create and update tRPC mutations exist
- `Partial` Public page detail rendering exists for appeals, but the dedicated `/fundraise/[shortName]` experience is still missing

### Donations

- `Partial` Donation intent creation exists
- `Partial` Fee snapshot and ledger hooks exist in code
- `Partial` Hosted checkout handoff is not fully wired to a real provider
- `Partial` Webhook route exists, but the end-to-end provider integration is not complete

### Fees and finance

- `Partial` Fee engine exists with schedule/rule resolution
- `Partial` Ledger helper code exists
- `Partial` Finance UI is mostly placeholder pages

### Gift Aid

- `Partial` Data model exists
- `Partial` Donation flow captures Gift Aid fields
- `Partial` Claim building, submission, and admin operations are not complete

### Offline donations

- `Partial` Offline donation schema exists
- `Partial` Offline totals are included in some aggregate views
- `Partial` Admin workflow and CSV upload flow are not built

## Not Started

### Spec-critical product slices

- `Not started` Offline donation bulk upload dry-run and commit flow
- `Not started` Full donations management and case handling
- `Not started` Refunds, disputes, and chargeback workflows
- `Not started` Payout batching lifecycle and reconciliation UI
- `Not started` GL export and finance CSV exports per accounting structure
- `Not started` Gift Aid claim queue, submission, and paid-state workflow
- `Not started` Page moderation queue and visibility management tooling
- `Not started` Team management UI and leaderboards
- `Not started` Charity directory and richer public charity profiles
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

- `Partial` appeal creation
- `Partial` charity-admin scope
- `Not started` moderation queue
- `Not started` visibility/moderation ops UI beyond appeal create form

### 5.3 Fundraising Pages

- `Partial` schema and mutations
- `Not started` dedicated fundraiser page management UI

### 5.4 Donations

- `Partial` donation intent and hosted-checkout preparation
- `Not started` real checkout completion flow and robust receipt workflow

### 5.5 Fee & Pricing Model

- `Partial` fee schedule + runtime preview
- `Not started` admin fee configuration UX

### 5.6 Bank Accounts & Payouts

- `Partial` schema and overview aggregates
- `Not started` working payout operations

### 5.7 Gift Aid

- `Partial` declaration capture
- `Not started` claims lifecycle

### 5.8 Reporting

- `Not started` usable exports center

### 5.9 Risk, Trust & Moderation

- `Not started`

### 5.10 Offline Donations & Teams

- `Partial` schema
- `Not started` management workflows

### 5.11 Bulk Upload

- `Not started`

### 5.12 Refunds, Disputes & Chargebacks

- `Not started`

## Immediate Next Recommendations

1. Build `Offline donations + CSV upload` because the schema is already there and it unlocks both charity operations and team/appeal totals.
2. Build `Fundraising page public route + page management UI` because it is a core product promise already referenced by the schema and homepage.
3. Build `Admin donations management` so finance and support workflows have a real home.
4. Build `Payouts + Gift Aid workflows` after the above operational flows are stable.
