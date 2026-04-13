# Implementation Roadmap

Last updated: 2026-04-13

This roadmap turns the broader product specification into a practical delivery order for the current codebase.

## Guiding rule

Prioritise slices that:

- already have schema support
- already have some domain logic in place
- unlock a real user or admin workflow
- reduce the number of placeholder admin pages

## Phase 1: Stabilised Core

### Completed

- Production deployment fixed on Vercel
- Credentials and Google sign-in
- Role-aware homepage and admin entrypoints
- Public route-group layout with shared footer and shared header
- Homepage redesign with centralized theme tokens and reusable public UI primitives
- Public support/information routes for charities, how-it-works, Zakat/Gift Aid, and policy placeholders
- Platform overview and charity-overview split in admin
- Charity setup and appeal management
- Moderation queue
- Offline donations admin workflow
- Donations admin workflow and hosted test checkout
- Appeal pages now guarantee a donation widget even when no public fundraiser page exists yet

### Remaining in this phase

- Fundraising page public route `/fundraise/[shortName]`
- Fundraising page creation and edit UI
- Rich public charity profile pages
- Live payment-provider checkout beyond the hosted test flow
- Better admin charity resolution and switching for platform admins

## Phase 2: Charity Operations

### Recommended next

1. Fundraising page public route and page management UI
2. Public charity profile pages
3. Reports and exports
4. Payouts and Gift Aid workflows
5. Appeal/team analytics and leaderboards

### Why this phase matters

This is the shortest path to matching the operational needs in the spec for real charity teams.

## Phase 3: Finance Operations

- Payout batch generation
- Payout history and statements
- Gift Aid claims queue and lifecycle
- Ledger visibility and GL export
- Finance exception and reconciliation views

## Phase 4: Risk and Governance

- Risk signals and hold states
- Moderation logs
- Refunds and dispute handling
- DSAR and retention tooling

## Phase 5: Scale and quality

- Accessibility audit automation
- Reporting center and exports
- Observability dashboards and alerting
- Feature flags and rollout controls

## Candidate next tickets

### Ticket 1: Fundraising page public experience

- Add `/fundraise/[shortName]`
- Show totals, story, updates, media, donation feed
- Reuse donation widget where appropriate

### Ticket 2: Public charity profiles

- Add a public charity detail route
- Show charity verification, story, active appeals, and trust/support information
- Reuse the public shell and shared section/card components

### Ticket 3: Reports and exports

- Replace `/admin/reports` placeholder
- Add donations, offline, Gift Aid, and payout export actions
- Add charity-scoped filters and export history

### Ticket 4: Finance workflows

- Build payout batches and history
- Build Gift Aid claim queue
- Add finance summaries and reconciliation hooks

### Ticket 5: Refunds and disputes

- Add refund records and admin actions from the donations workflow
- Add dispute ingestion and case visibility
- Show reversal/recovery state alongside donation status

## What to keep updating

Whenever a slice ships:

- mark it in `docs/PROGRESS.md`
- record any system boundary changes in `docs/ARCHITECTURE.md`
- move the next slice to the top of this file
