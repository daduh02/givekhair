# Implementation Roadmap

Last updated: 2026-04-12

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
- Admin appeal list and create flow

### Remaining in this phase

- Fundraising page public route `/fundraise/[shortName]`
- Fundraising page creation and edit UI
- Donation checkout completion with hosted checkout redirect
- Better admin charity resolution and switching for platform admins

## Phase 2: Charity Operations

### Recommended next

1. Offline donations management
2. CSV upload dry-run and commit
3. Donations admin list and detail views
4. Appeal moderation/visibility controls

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

### Ticket 1: Offline donations admin page

- Replace `/admin/offline` placeholder
- List offline donations by charity
- Add manual create/edit/delete flow
- Show impact on appeal/team/page totals

### Ticket 2: Offline CSV upload

- Create upload batch model workflow in UI
- Dry-run parser and row validation
- Commit flow to create offline donations and optional Gift Aid declarations
- Result summary and downloadable error report

### Ticket 3: Fundraising page public experience

- Add `/fundraise/[shortName]`
- Show totals, story, updates, media, donation feed
- Reuse donation widget where appropriate

### Ticket 4: Admin donations management

- Replace `/admin/donations` placeholder
- Add filters, statuses, donor view, Gift Aid marker, and refund hook points

## What to keep updating

Whenever a slice ships:

- mark it in `docs/PROGRESS.md`
- record any system boundary changes in `docs/ARCHITECTURE.md`
- move the next slice to the top of this file
