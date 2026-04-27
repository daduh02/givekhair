# Public Experience

Last updated: 2026-04-27

This document explains how the public-facing GiveKhair experience is currently structured, where the shared styling lives, and how to extend the marketing and donor-facing UI without reintroducing one-off styling drift.

## Current public shell

The public site now uses a dedicated App Router route group:

- `src/app/(public)/`

That route group owns:

- the global public header
- the global public footer
- homepage and public information pages
- appeal detail pages
- auth entry pages
- hosted test checkout and thank-you pages
- public error and content pages

This means public pages inherit a consistent shell automatically, while admin and dashboard routes stay outside that shell.

## Shared layout

### Public layout

- `src/app/(public)/layout.tsx`

Responsibilities:

- renders the shared public navbar
- renders the shared public footer
- wraps all public-facing pages in one consistent structure

### Shared public navigation

- `src/components/layout/Navbar.tsx`

Responsibilities:

- public nav links for appeals, charities, how it works, and Zakat/Gift Aid
- desktop and mobile `For charities` navigation to Products, Pricing, and Contact
- signed-out login plus fundraiser CTA
- signed-in account chip with name/email context
- role-aware account menu (`Admin` for admin-capable users, `Dashboard`, `Fundraise`, `Log out`)
- primary CTA for starting a fundraiser

### Shared public footer

- `src/components/layout/PublicFooter.tsx`

Responsibilities:

- brand block
- footer link columns
- regulatory micro-copy
- policy links
- social links

## Theme and styling architecture

### Global token source

- `src/app/globals.css`

The public refresh centralised palette and reusable UI rules into CSS variables and shared component classes. This is now the primary theme source for the app.

Core token groups:

- brand colours
- line and surface colours
- shadow tokens
- radius tokens
- site max width

Core reusable classes:

- `site-shell`
- `section-shell`
- `section-shell-tight`
- `section-panel`
- `surface-card`
- `surface-muted`
- `section-kicker`
- `section-heading`
- `section-copy`
- `btn-primary`
- `btn-secondary`
- `btn-outline`
- `btn-ghost`
- `trust-chip`
- `trust-chip-gold`
- `progress-bar`
- `progress-fill`
- `input`
- badge classes

### Tailwind alignment

- `tailwind.config.ts`

Tailwind was aligned to the refreshed brand direction so future component work can still use semantic theme values where appropriate, but the current public system intentionally leans on the shared CSS token layer for consistency.

## Reusable public UI components

### Section intro

- `src/components/ui/SectionIntro.tsx`

Use for:

- public page intros
- section headers with eyebrow + title + description
- sections that need optional right-side actions

### Trust chip

- `src/components/ui/TrustChip.tsx`

Use for:

- trust badges
- verification labels
- category/meta chips

### Progress bar

- `src/components/ui/ProgressBar.tsx`

Use for:

- fundraising progress
- featured appeal summaries
- appeal cards

### Appeal card

- `src/components/appeal/AppealCard.tsx`

The homepage trending cards now use the new shared public styling language instead of the older util-only card treatment.

### Donation checkout

- `src/components/donation/DonationCheckout.tsx`

The donation widget was restyled to match the premium public shell while preserving:

- amount selection
- fee preview
- donor covers fees toggle
- donor details
- Gift Aid capture
- donation intent creation

## Public route inventory

### Primary pages

- `/`
- `/appeals/[slug]`
- `/for-charities/products`
- `/fundraise/[shortName]`
- `/charities`
- `/charities/[slug]`
- `/how-it-works`
- `/zakat-gift-aid`

### Auth and donor support pages

- `/auth/signin`
- `/auth/error`
- `/checkout/test/[donationId]`
- `/donations/thank-you/[donationId]`
- `/403`

### Lightweight content placeholders

- `src/app/(public)/[slug]/page.tsx`

This dynamic content page currently provides stable destinations for:

- `/about`
- `/fees`
- `/pricing`
- `/contact`
- `/help`
- `/accessibility`
- `/cookies`
- `/terms`
- `/privacy`
- `/fundraising-rules`
- `/charity-verification`
- `/teams`

These routes are intentionally lightweight and should be replaced with richer content as policy and marketing copy matures.

## Homepage structure

- sticky shared header
- hero with trust pill, more product-specific headline/subcopy, CTA pair, mini proof cards, and an admin-controlled featured appeal
- category pill band
- paged trending appeals section
- charity-operations value section
- secondary CTA band
- trust/compliance band
- shared public footer

Homepage implementation:

- `src/app/(public)/page.tsx`

## Data usage on the homepage

The homepage still prefers live appeal data where available.

Current behavior:

- query active public appeals from Prisma
- aggregate online and offline raised totals per appeal
- use the explicit admin-selected featured appeal first when one is configured and valid
- fall back to the best available active/public appeal if no featured appeal is configured
- load a larger trending set and page it client-side in grouped views
- fall back to curated mock content if the live query fails or returns too little

Copy direction now intentionally avoids generic startup language. The page keeps the same visual architecture, but the wording is more specific about:

- verified charities
- Gift Aid-aware giving
- offline donations contributing to totals
- fee visibility and donor-supported giving

This preserves real data wiring without making the homepage feel empty during transient data issues.

## Public fundraiser page

Implementation:

- `src/app/(public)/fundraise/[shortName]/page.tsx`

Current sections:

- fundraiser hero
- owner/team/charity context
- progress and supporter stats
- fundraiser story
- optional cover image hero treatment
- optional media gallery
- fundraiser-authored updates
- donor feed combining online and offline support
- shared donation widget

Access rules:

- public for allowed fundraiser pages
- hidden, banned, rejected, suspended, draft, and pending-approval pages do not render publicly
- middleware now reserves `/fundraise/new` for future authenticated creation, while `/fundraise/[shortName]` stays public

## Public appeal leaderboard layer

Implementation:

- `src/app/(public)/appeals/[slug]/page.tsx`
- `src/lib/leaderboards.ts`
- `src/components/appeal/ShareCause.tsx`
- `src/components/appeal/DonationSummary.tsx`

Current behavior:

- each appeal page now includes a fundraiser leaderboard ranked by total raised
- where teams exist, the same page includes team standings and top fundraiser pages per team
- totals combine successful online donations with approved offline donations
- headline appeal totals now also include direct appeal donations routed through the hidden checkout page, so the raised amount and donor-count summary do not stay at zero when direct giving exists
- period filters are available for `30d`, `90d`, and `all-time`
- tied totals render as `Tied #N` for clearer ranking context
- empty-state handling keeps the page usable when no fundraiser/team data exists yet
- full ranking drill-down is available at `/appeals/[slug]/leaderboard`
- each appeal page now includes a reusable `Share this cause` section with real route-based share URLs, copy-link support, print, and safe fallbacks for secondary channels
- each appeal page now includes a reusable donation summary section that surfaces `Total`, `Online`, `Offline`, and `Fundraisers`

Aggregation rules:

- online totals use `Donation.status = CAPTURED`
- offline totals use `OfflineDonation.status = APPROVED`
- donor count is a practical record count proxy (online donation rows + approved offline rows)
- public fundraiser rankings still only list public fundraiser pages, while hidden direct-checkout totals are included only in the headline appeal totals and summary figures

## Charity products and marketing route

Implementation:

- `src/app/(public)/for-charities/products/page.tsx`
- `src/lib/charity-products.ts`

Current behavior:

- the public site now has a dedicated `/for-charities/products` landing page rendered from a reusable product config
- the page includes a hero, product cards, alternating feature sections, a comparison grid, and a closing charity CTA
- product links point to real GiveKhair routes where functionality already exists, and fall back to stable contact/pricing destinations where a sales or onboarding conversation is more appropriate
- the copy keeps the fundraising ethos clearly Islamic while positioning the platform as open to all charities

## Fundraiser creation and editing

Implementation:

- `src/app/fundraise/new/page.tsx`
- `src/app/fundraise/[shortName]/edit/page.tsx`
- `src/components/fundraise/FundraisingPageForm.tsx`

Current behavior:

- authenticated users can create a fundraiser linked to an active appeal
- optional team selection is supported
- short name and target validation are enforced server-side
- new pages are created as `PENDING_APPROVAL` and `UNLISTED`
- page edits are restricted to the page owner or platform admin
- the edit route now acts as a lightweight owner management surface, not just a plain content form
- owners can publish updates, add/remove/reorder media URLs, and see moderation-state guidance plus lightweight fundraising analytics
- rejected pages can be updated and resubmitted into review from the same owner flow

## Public charity directory and profiles

Implementation:

- `src/app/(public)/charities/page.tsx`
- `src/app/(public)/charities/[slug]/page.tsx`
- `src/components/charity/CharityDirectoryCard.tsx`
- `src/lib/public-charities.ts`

Current behavior:

- `/charities` now works as a richer discovery directory instead of a placeholder
- directory cards show verification, raised totals, fundraiser counts, and active appeal previews
- clicking a card opens `/charities/[slug]`
- the public charity profile shows trust and registration context, raised totals, live appeal inventory, and recent fundraiser pages
- active appeals on the profile reuse the same appeal-card presentation used elsewhere in the public experience
- dashboard surfaces the user’s fundraiser pages with create/edit links
- directory summary metrics are now loaded through batched data reads so the page stays stable as more charities appear

## Extension guidance

When adding new public-facing pages:

1. place them inside `src/app/(public)/`
2. reuse the shared layout instead of adding ad-hoc nav/footer
3. use existing public primitives before adding new styling patterns
4. extend `globals.css` tokens/classes carefully rather than scattering inline styles
5. document structural changes here if the public shell or design language changes

## Recommended next public-facing work

- replace placeholder policy/info pages with approved content
- deepen fundraiser storytelling with milestones or supporter comments if the product wants community features later
- add richer public team pages and appeal/team leaderboards
- add a shared content-page template component if static informational pages keep growing
