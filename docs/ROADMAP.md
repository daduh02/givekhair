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
- Homepage refinement with admin-controlled featured appeal and paged trending carousel
- Public support/information routes for charities, how-it-works, Zakat/Gift Aid, and policy placeholders
- Platform overview and charity-overview split in admin
- Charity setup and appeal management
- Moderation queue
- Offline donations admin workflow
- Donations admin workflow and hosted test checkout
- Appeal pages now guarantee a donation widget even when no public fundraiser page exists yet
- Contract-led pricing foundation with donor-supported, charity-paid, and hybrid charging modes
- Manual payout batch operations with linked payout items and contract-aware payout gating
- Manual Gift Aid claim queue and settlement flow
- First real fundraiser self-serve layer with owner updates, media management, moderation-state messaging, and lightweight analytics
- Refund records, dispute visibility, dispute admin workspace, and exception-aware donation exports
- Appeal and team leaderboard analytics across public appeal pages and admin campaign summaries
- Leaderboard follow-up slice: period filters, tie-aware rank display, and full ranking drill-down routes
- Reconciliation-focused exports and finance exception queue with payout/Gift Aid mismatch visibility
- Export-history persistence for finance/reporting CSV operations
- Immutable export artifacts, stale exception alerting, and gated auto-reconciliation runs
- Platform-admin user management with role administration, suspension controls, invite/setup/reset actions, and access audit history

### Remaining in this phase

- Live payment-provider checkout beyond the hosted test flow
- Better admin charity resolution and switching for platform admins
- Richer fee-rule builder and final contract approval/signature workflows
- Invite/reset email delivery wiring on top of the shipped secure token workflow

## Phase 2: Charity Operations

### Recommended next

1. Commercial approval/signature workflow
2. Async finance automation
3. Risk and hold-state operations
4. Moderation/DSAR governance workflows
5. Provider-integrated invite/reset email delivery

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
- Advanced reporting center and PDF/accounting exports
- Observability dashboards and alerting
- Feature flags and rollout controls

## Candidate next tickets

### Ticket 1: Finance workflows

- Add HMRC-facing claim automation on top of the manual Gift Aid workflow
- Add automatic payout queue processing on top of manual payout batches
- Add finance summaries and reconciliation hooks
- Add provider submission and failure handling for payout batches

### Ticket 2: Accounting exports and reconciliation

- Extend the shipped GL export with reconciliation-oriented CSV exports beyond the current admin report set
- Add export history or audit trail if finance needs evidence of generated files

### Ticket 3: Commercial ops hardening

- Add approval/signature workflow for contracts
- Add explicit contract renewal history/timeline
- Add safer document storage and download handling

### Ticket 4: Team analytics and leaderboards

- Completed: team-level public and admin summaries
- Completed: ranking/leaderboard views for appeals, teams, and fundraiser pages
- Completed: consistent combined totals across online plus approved offline donations

## What to keep updating

Whenever a slice ships:

- mark it in `docs/PROGRESS.md`
- record any system boundary changes in `docs/ARCHITECTURE.md`
- move the next slice to the top of this file
