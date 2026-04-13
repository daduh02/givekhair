# Public Experience

Last updated: 2026-04-13

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
- auth-aware right-side action
- role-aware signed-in entry point (`Admin` for admins, `Dashboard` for other signed-in users)
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
- `/charities`
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
- hero with trust pill, main headline, CTA pair, mini trust cards, and featured appeal
- category pill band
- trending appeals section
- benefit cards section
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
- map the first result to the featured appeal
- map the next three into trending cards
- fall back to curated mock content if the live query fails or returns too little

This preserves real data wiring without making the homepage feel empty during transient data issues.

## Extension guidance

When adding new public-facing pages:

1. place them inside `src/app/(public)/`
2. reuse the shared layout instead of adding ad-hoc nav/footer
3. use existing public primitives before adding new styling patterns
4. extend `globals.css` tokens/classes carefully rather than scattering inline styles
5. document structural changes here if the public shell or design language changes

## Recommended next public-facing work

- build the missing `/fundraise/[shortName]` public route using the same shell and card system
- replace placeholder policy/info pages with approved content
- create richer public charity profile pages
- add a shared content-page template component if static informational pages keep growing
