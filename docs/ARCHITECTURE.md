# Architecture

Last updated: 2026-04-13

## Current shape

The codebase is currently a modular monolith built in Next.js. The UI, route handlers, server procedures, and persistence all live in one repo and one deployment target.

One important structural change is now in place: public pages are no longer a loose collection of standalone routes with duplicated framing. They are grouped under a shared public route layout and design system.

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
- `src/app/(public)/` now owns the public shell, homepage, appeal pages, auth entry pages, and shared informational pages

### Reusable UI

- `src/components/`
- Appeal cards, donation checkout, auth controls, navbar, footer, providers, and small UI primitives

### Shared libraries

- `src/lib/`
- Database client, auth config, password utilities, admin-context helper, admin management helpers, offline donation import helpers, tRPC client helpers

### Server domain logic

- `src/server/lib/`
- Fee engine, commercial helpers, payout policy helpers, ledger helpers, queue setup, donations API stub, donation processing helpers

- `src/server/routers/`
- tRPC procedures for appeals, pages, donations, fees, and admin-adjacent operations

## Architectural principles

### 1. Modular monolith first

The current implementation is intentionally monolithic so product slices can be shipped quickly without the operational cost of multiple deployables.

### 2. Schema-first product expansion

The schema already models much more of the target product than the UI currently exposes. This is good for future delivery, but it means we should build features in slices that fully connect schema, business logic, and UI before expanding wider.

### 3. Keep financial logic centralized

Fees, contracts, payout preparation, Gift Aid, and ledger logic should continue to live in explicit server modules rather than being spread across page components.

### 4. Prefer route-safe server rendering

Recent production fixes showed that shared providers in the root layout can create subtle deployment-only failures. Keep global layout concerns minimal and push client-only providers down to the narrowest route scope that needs them.

### 5. Keep public styling centralized

The public site now has a dedicated token layer and reusable component classes in `src/app/globals.css`. New public pages should extend that system instead of introducing new inline-style islands.

## Core flows

### Authentication flow

1. User signs in with credentials or Google
2. NextAuth creates session/JWT
3. JWT callback enriches token with `id` and `role`
4. Admin pages and role-aware UI derive authorization from session role

### Public appeal browsing

1. Public routes render through `src/app/(public)/layout.tsx`
2. Shared navbar and shared footer are applied automatically to all public pages in that route group
3. The navbar resolves the server session and shows either signed-out auth actions or a signed-in account menu with role-aware destinations
4. Homepage loads active, public appeals from Prisma
5. The homepage first attempts to use an explicitly featured appeal selected by platform admin, falling back to the best available active/public appeal if none is set
6. Trending appeals are loaded in a larger set, then paged client-side in grouped views while preserving the shared appeal card design
7. Appeal detail page loads teams, fundraiser pages, and donation widget
8. If an appeal has no active checkout target yet, the app creates a hidden fallback fundraising page so the widget still renders

### Public fundraiser page flow

1. Public fundraiser pages now live at `/fundraise/[shortName]`
2. Middleware protects only `/fundraise/new`, allowing fundraiser detail pages to stay publicly accessible
3. The page loads fundraiser owner, team, appeal, donations, offline donations, updates, and media from Prisma
4. Visibility and moderation states are enforced server-side before rendering
5. Owner-managed updates now render in chronological order and optional gallery items are presented as a lightweight public strip/grid
6. The page reuses the shared donation widget and public design system

### Fundraiser creation and edit flow

1. Authenticated users can create pages at `/fundraise/new`
2. Existing page owners can edit at `/fundraise/[shortName]/edit`
3. The shared `FundraisingPageForm` component is used for both routes
4. Server actions validate appeal/team relationships, short-name uniqueness, and target amount rules
5. New pages are created as `PENDING_APPROVAL` and `UNLISTED`
6. Creation writes a `ModerationItem` so charity/admin moderation has a review trail
7. The owner management route now also handles update publishing, media gallery changes, and moderation-state messaging
8. Media management intentionally stays lightweight by using URL-backed page media plus reorder/remove server actions instead of a separate upload studio
9. Dashboard now surfaces the user’s fundraiser pages with status guidance, lightweight analytics, and direct management links

### Donation flow

1. User opens donation widget on an appeal page
2. Frontend previews fees through tRPC
3. Frontend creates donation intent through tRPC
4. Server resolves the active charity contract, then the applicable fee schedule and fee rules
5. Donation pricing is calculated under the resolved charging mode (`CHARITY_PAID`, `DONOR_SUPPORTED`, or `HYBRID`)
6. Server persists the donation intent, contract linkage, pricing snapshot, and optional Gift Aid declaration
7. `Donation.amount` is still populated for compatibility, while richer pricing fields are stored separately for all new writes
8. Hosted test checkout route simulates provider completion for development and staging-like testing
9. Shared donation-processing helpers capture or fail the donation, create payment records, update receipt state, write ledger entries, and attach Gift Aid declarations to a draft claim queue
10. Stripe webhook route reuses the same donation-processing helpers for provider-driven confirmation

### Public content and support flow

1. Lightweight public content pages live under `src/app/(public)/[slug]/page.tsx`
2. Stable routes now exist for about, fees, contact, help, accessibility, privacy, terms, and related policy/support destinations
3. These pages currently act as structured placeholders until full content is approved and expanded

### Admin appeal flow

1. Admin context resolves current user and managed charity
2. Platform admins can query across all charities, while charity admins stay scoped to their managed charity
3. Appeals list and edit routes expose teams, fundraiser pages, visibility, moderation controls, and homepage-feature state
4. Platform admins can feature exactly one active/public appeal for the homepage at a time
5. Appeal create/update actions revalidate admin and public paths

### Admin charity and moderation flow

1. `/admin` shows a platform-wide overview for platform admins and a charity-scoped overview for charity admins
2. `/admin/charities` lists available charities and links into charity-specific overview pages
3. Charity creation and charity editing live on dedicated routes rather than inline on the list page
4. Appeal edit routes manage team creation and team membership
5. Fundraiser page approval, rejection, hide, and ban actions are coordinated from the appeal admin route
6. `/admin/moderation` provides a queue view across moderation record types

### Public charity discovery flow

1. `/charities` now acts as a real discovery directory rather than a placeholder listing
2. Directory cards combine profile data, live raised totals, fundraiser counts, and active appeal previews
3. `/charities/[slug]` provides a dedicated public charity profile with trust context, summary metrics, recent fundraiser pages, and active appeals
4. Charity discovery and profile pages both reuse the shared public shell and card primitives

### Offline donations flow

1. Admin visits `/admin/offline`
2. Manual entries create `OfflineDonation` records directly, with optional linked `GiftAidDeclaration`
3. CSV uploads run a dry-run parser and persist an `OfflineUploadBatch`
4. Only valid dry-run rows are committed into `OfflineDonation` records
5. Batch and record updates revalidate admin surfaces so totals stay fresh

## Public design system

### Token source

- `src/app/globals.css`

The app now uses a shared token layer for:

- primary brand colours
- sand/neutral backgrounds
- gold trust accents
- ink text colours
- shadows
- radii
- max-width/layout constraints

### Shared public primitives

- `Navbar`
- `PublicFooter`
- `SectionIntro`
- `TrustChip`
- `ProgressBar`
- rewritten `AppealCard`
- rewritten `DonationCheckout`

### Why this matters

Before the refresh, public styling was fragmented and heavily inline-driven. The new structure makes it easier to:

- extend the homepage without duplicating patterns
- keep appeal, auth, and content pages visually coherent
- apply future marketing or charity-profile work through a known design system

### Donations operations flow

1. Admin visits `/admin/donations`
2. Charity admins see charity-scoped donation records, while platform admins can filter across charities
3. The screen now exposes donation status, fee coverage, Gift Aid state, recurring flag, provider refs, receipt state, refund history, dispute history, payout exposure, and ledger-reversal visibility
4. Admins can record refund requests, progress refund records through workflow statuses, and mark succeeded refunds so the ledger reversal is written
5. Admins can record disputes from the donation screen and then manage them in a dedicated `/admin/disputes` workspace
6. Pending donations can still be opened in the hosted test checkout route to complete or fail the payment loop manually

### Refund and dispute operations flow

1. Refunds are now first-class operational records with their own workflow status rather than a bare historic amount row
2. Successful refunds write a reversal-style ledger entry through the existing refund ledger helper
3. Disputes are stored as lightweight operational case records tied to a donation
4. Open disputes push the donation into a `DISPUTED` operational state for visibility
5. Lost disputes can record a separate dispute-linked ledger impact without pretending that payout recovery automation already exists
6. The dedicated disputes page provides scoped list, filter, and update actions for finance/admin users

### Reports and exports flow

1. Admin visits `/admin/reports`
2. The page resolves the same charity scope rules used elsewhere in admin, including platform-wide access and charity-admin restrictions
3. Shared report helpers load donations, offline donations, payout batches, and Gift Aid claims for the selected date range and charity filter
4. The page renders summary cards plus lightweight operational previews so admins can sanity-check scope before exporting
5. A single access-controlled route handler at `/api/admin/reports/export` returns CSV exports for each report type
6. Export URLs are built from the active UI filters so the preview state and download scope stay aligned
7. General-ledger export rows are assembled from immutable journal entries plus their ledger lines, with charity scoping inferred through donations, payouts, disputes, and Gift Aid claim correlation IDs

### Fees and contracts flow

1. `/admin/settings` now acts as the starter commercial control surface
2. Commercial plans classify the package a charity is on
3. Charity contracts are now the first-class pricing entry point
4. Active contracts resolve by charity, date, region, and optional product scope
5. Contracts store charging mode, donor-support defaults, payout settings, settlement delay, reserve rules, and expiry behavior
6. Appeal-level donor-support override can force donor-support on or off without replacing the rest of the contract
7. Fee schedules remain the detailed pricing input used by the fee engine, but they are now resolved through the active contract
8. Fee rules can now vary by donation kind, charging mode, active state, and effective dates
9. Contract documents and commercial audit logs are stored alongside the commercial records
10. Dedicated edit and renewal routes now sit on top of the settings overview so contract updates and new versions do not overload the list page
11. Terms acceptances are stored separately so legal version history can grow without mutating the contract record

### Payout policy flow

1. Payout readiness resolves the charity’s commercial contract first
2. Suspended contracts block payouts immediately
3. Expired contracts block payouts only when the contract says to
4. Donor-support revenue is excluded from charity payout totals
5. Gift Aid actually received is added to the payout pool in full
6. Manual batch creation links payout batches to concrete donation and Gift Aid allocations through payout-batch items
7. Paid batches write the payout ledger entry once, when the batch is marked paid

### Gift Aid claim flow

1. Captured online donations create or append to a draft claim queue when Gift Aid is declared
2. Admins can build draft claims for eligible declarations that are not yet attached to any claim
3. Draft claims can be submitted with an HMRC reference
4. Paid claims update linked donations with `giftAidReceivedAmount`
5. Once updated, those reclaim amounts become eligible for payout batching
6. Gift Aid paid is recorded in the ledger once per claim settlement

## Known architectural gaps

### 1. Fundraiser self-serve tooling is still intentionally lightweight

The first real self-serve layer now exists for updates, media, moderation guidance, and lightweight analytics, but richer collaboration, notifications, and milestone tooling still need future work.

### 2. Admin workflows are still uneven

`Charities`, `Appeals`, `Moderation`, `Offline donations`, `Donations`, `Disputes`, `Reports`, `Fees & contracts`, manual `Payouts`, and manual `Gift Aid` claim operations now have real workflows, but async finance operations are still only partially operational.

### 3. Payments integration is stubbed

The current donation flow supports an end-to-end hosted test checkout lifecycle, but a live payment provider still needs to replace the stubbed checkout session creation.

### 4. Background jobs are modeled but not operational

Queues exist conceptually, but operational workers and async processing flows are not yet part of the delivered app behavior.

### 5. Finance reconciliation exists more in schema than in workflows

The ledger, payout, Gift Aid settlement, refund, and dispute models are present, and manual finance workflows now exist, but reconciliation, provider submission, payout recovery, and finance exception automation still need deeper workflows.

### 6. Contract lifecycle is still intentionally light

The commercial admin surface can now create, edit, renew, attach documents, and log key commercial events, but richer approval/signature flows and automated renewal mechanics still need to be built.

### 7. Offline ingestion is functional but not yet complete

The platform can now validate and import offline donations, but downloadable batch reports, richer audit tooling, and broader totals/reconciliation visibility still need to be added.

## Recommended future documentation

The following docs would be useful as the product grows:

- `docs/DOMAIN_MODEL.md`
- explain each major entity and its lifecycle

- `docs/OPERATIONS.md`
- environment variables, deploy flow, Vercel notes, DB workflows, incident steps

- `docs/PUBLIC_EXPERIENCE.md`
- public shell, route group, design tokens, reusable UI primitives, and content architecture

- `docs/API_SURFACE.md`
- document current tRPC procedures and route handlers

- `docs/FINANCE.md`
- explain contract-led pricing, charging modes, payouts, Gift Aid, ledger semantics, and reconciliation assumptions

- `docs/DECISIONS.md`
- lightweight architecture decision log for major tradeoffs

## Delivery strategy recommendation

Keep building vertically:

1. schema-backed admin workflow
2. public route or user workflow
3. production-safe deployment
4. docs update

That approach is safer than trying to finish the whole spec horizontally all at once.
