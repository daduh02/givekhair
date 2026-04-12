# Architecture

Last updated: 2026-04-12

## Current shape

The codebase is currently a modular monolith built in Next.js. The UI, route handlers, server procedures, and persistence all live in one repo and one deployment target.

## Runtime layers

### Web app

- Framework: Next.js 14 App Router
- Rendering: mixed static and dynamic server rendering
- Hosting: Vercel
- Runtime target: Node 20

### Server layer

- UI-to-server calls use tRPC
- Auth uses NextAuth v4
- Route handlers exist for auth, webhooks, and debug endpoints
- Business logic currently lives in `src/server/lib` and `src/server/routers`

### Data layer

- Database: PostgreSQL via Prisma
- Primary schema includes fundraising, finance, payout, Gift Aid, team, and admin entities
- Some parts of the schema are ahead of the implemented UI

## Current module layout

### App routes

- `src/app/`
- Public pages, admin pages, auth pages, and route handlers

### Reusable UI

- `src/components/`
- Appeal cards, donation checkout, auth controls, navbar, providers

### Shared libraries

- `src/lib/`
- Database client, auth config, password utilities, admin-context helper, admin management helpers, offline donation import helpers, tRPC client helpers

### Server domain logic

- `src/server/lib/`
- Fee engine, ledger helpers, queue setup, donations API stub, donation processing helpers

- `src/server/routers/`
- tRPC procedures for appeals, pages, donations, fees, and admin-adjacent operations

## Architectural principles

### 1. Modular monolith first

The current implementation is intentionally monolithic so product slices can be shipped quickly without the operational cost of multiple deployables.

### 2. Schema-first product expansion

The schema already models much more of the target product than the UI currently exposes. This is good for future delivery, but it means we should build features in slices that fully connect schema, business logic, and UI before expanding wider.

### 3. Keep financial logic centralized

Fees, payout preparation, Gift Aid, and ledger logic should continue to live in explicit server modules rather than being spread across page components.

### 4. Prefer route-safe server rendering

Recent production fixes showed that shared providers in the root layout can create subtle deployment-only failures. Keep global layout concerns minimal and push client-only providers down to the narrowest route scope that needs them.

## Core flows

### Authentication flow

1. User signs in with credentials or Google
2. NextAuth creates session/JWT
3. JWT callback enriches token with `id` and `role`
4. Admin pages and role-aware UI derive authorization from session role

### Public appeal browsing

1. Homepage loads active, public appeals from Prisma
2. Appeals show charity details and aggregated raised amounts
3. Appeal detail page loads teams, fundraiser pages, and donation widget
4. If an appeal has no active checkout target yet, the app creates a hidden fallback fundraising page so the widget still renders

### Donation flow

1. User opens donation widget on an appeal page
2. Frontend previews fees through tRPC
3. Frontend creates donation intent through tRPC
4. Server resolves fee schedule, persists the donation intent, fee snapshot, and optional Gift Aid declaration
5. Hosted test checkout route simulates provider completion for development and staging-like testing
6. Shared donation-processing helpers capture or fail the donation, create payment records, update receipt state, write ledger entries, and attach Gift Aid declarations to a draft claim queue
7. Stripe webhook route reuses the same donation-processing helpers for provider-driven confirmation

### Admin appeal flow

1. Admin context resolves current user and managed charity
2. Platform admins can query across all charities, while charity admins stay scoped to their managed charity
3. Appeals list and edit routes expose teams, fundraiser pages, visibility, and moderation controls
4. Appeal create/update actions revalidate admin and public paths

### Admin charity and moderation flow

1. Charity admins manage charity profile fields from `/admin/charities`
2. Appeal edit routes manage team creation and team membership
3. Fundraiser page approval, rejection, hide, and ban actions are coordinated from the appeal admin route
4. `/admin/moderation` provides a queue view across moderation record types

### Offline donations flow

1. Admin visits `/admin/offline`
2. Manual entries create `OfflineDonation` records directly, with optional linked `GiftAidDeclaration`
3. CSV uploads run a dry-run parser and persist an `OfflineUploadBatch`
4. Only valid dry-run rows are committed into `OfflineDonation` records
5. Batch and record updates revalidate admin surfaces so totals stay fresh

### Donations operations flow

1. Admin visits `/admin/donations`
2. Charity admins see charity-scoped donation records, while platform admins can filter across charities
3. The screen exposes donation status, fee coverage, Gift Aid state, recurring flag, provider refs, and receipt state
4. Pending donations can be opened in the hosted test checkout route to complete or fail the payment loop manually

## Known architectural gaps

### 1. Public fundraising page route is missing

The schema and router support fundraiser pages, but the dedicated public route and management UX are still absent.

### 2. Admin workflows are still uneven

`Charities`, `Appeals`, `Moderation`, `Offline donations`, and `Donations` now have real workflows, but payouts, reports, Gift Aid operations, and settings are still mostly placeholders.

### 3. Payments integration is stubbed

The current donation flow supports an end-to-end hosted test checkout lifecycle, but a live payment provider still needs to replace the stubbed checkout session creation.

### 4. Background jobs are modeled but not operational

Queues exist conceptually, but operational workers and async processing flows are not yet part of the delivered app behavior.

### 5. Finance reconciliation exists more in schema than in workflows

The ledger and payout models are present, but finance operations still need real end-user surfaces and automated processing.

### 6. Offline ingestion is functional but not yet complete

The platform can now validate and import offline donations, but downloadable batch reports, richer audit tooling, and broader totals/reconciliation visibility still need to be added.

## Recommended future documentation

The following docs would be useful as the product grows:

- `docs/DOMAIN_MODEL.md`
- explain each major entity and its lifecycle

- `docs/OPERATIONS.md`
- environment variables, deploy flow, Vercel notes, DB workflows, incident steps

- `docs/API_SURFACE.md`
- document current tRPC procedures and route handlers

- `docs/FINANCE.md`
- explain fees, payouts, Gift Aid, ledger semantics, and reconciliation assumptions

- `docs/DECISIONS.md`
- lightweight architecture decision log for major tradeoffs

## Delivery strategy recommendation

Keep building vertically:

1. schema-backed admin workflow
2. public route or user workflow
3. production-safe deployment
4. docs update

That approach is safer than trying to finish the whole spec horizontally all at once.
