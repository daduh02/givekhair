# giveKhair

Peer-to-peer fundraising platform. Gift Aid eligible, fee-transparent, UK-focused.

## Project Docs

- [Documentation Hub](./docs/README.md)
- [Progress Tracker](./docs/PROGRESS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Public Experience](./docs/PUBLIC_EXPERIENCE.md)
- [Implementation Roadmap](./docs/ROADMAP.md)

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Type-safe API | tRPC v11 |
| Auth | NextAuth v4 |
| Database | PostgreSQL + Prisma |
| Background jobs | BullMQ + Redis |
| Payments | Stripe (hosted checkout) |
| File uploads | UploadThing |
| Email | Resend |
| Observability | Datadog |

## Prerequisites

- Node 20+
- PostgreSQL 15+
- Redis 7+

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, NEXTAUTH_URL at minimum

# 3. Generate NEXTAUTH_SECRET
openssl rand -base64 32

# 4. Run database migrations
npm run db:migrate

# 5. Seed dev data
npm run db:seed

# 6. Start dev server
npm run dev
```

## Dev accounts (after seeding)

| Email | Role |
|---|---|
| admin@givekhair.dev | PLATFORM_ADMIN |
| charity@givekhair.dev | CHARITY_ADMIN |
| amina@example.com | FUNDRAISER |

> No passwords set — use OAuth or add passwordHash via Prisma Studio (`npm run db:studio`)
> Demo password for seeded accounts in the current environment: `GiveKhair123!`

## Key routes

| Route | Description |
|---|---|
| `/` | Public homepage — shared shell, admin-controlled featured appeal, and paged trending appeals |
| `/appeals/[slug]` | Appeal detail + donation widget |
| `/charities` | Public charity directory |
| `/charities/[slug]` | Public charity profile page |
| `/how-it-works` | Public explainer page |
| `/zakat-gift-aid` | Public giving guidance page |
| `/fundraise/[shortName]` | Public fundraising page route with updates, gallery, and donation widget |
| `/fundraise/[shortName]/edit` | Owner-side fundraiser management for story, updates, gallery, and status guidance |
| `/admin` | Charity admin dashboard |
| `/admin/disputes` | Dispute and chargeback operations workspace |
| `/admin/settings` | Contract-led fees, plans, contracts, renewal, and commercial audit |
| `/admin/payouts` | Payout batch management and contract-aware payout operations |
| `/admin/gift-aid` | Gift Aid claim queue and settlement workflow |
| `/admin/reports` | CSV exports and operational previews for donations, refunds/disputes, offline donations, payouts, Gift Aid, and GL rows |
| `/api/trpc/[trpc]` | tRPC endpoint |
| `/api/webhooks/stripe` | Stripe webhook receiver |
| `/api/admin/reports/export` | Access-controlled CSV export endpoint for admin and accounting reports |
| `/api/auth/[...nextauth]` | Auth.js handlers |

## Production deploy notes

- Set `DATABASE_URL` to the production Postgres database used by Prisma
- Set `NEXTAUTH_URL` to the deployed app URL, for example `https://givekhair.vercel.app`
- Set `NEXTAUTH_SECRET` to a long random value
- Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` before enabling Google sign-in
- Run Prisma migrations or `prisma db push` against the production database before expecting the public site to load data

## Architecture notes

### Modular monolith
All services (auth, donations, fees, ledger, Gift Aid) live in `src/server/` as
distinct modules with clear boundaries. Extract to microservices later when traffic
data shows where the seams should be.

### Fee Engine (`src/server/lib/fee-engine.ts`)
- Resolves the active `CharityContract` first, then the applicable `FeeSchedule`
- Supports `CHARITY_PAID`, `DONOR_SUPPORTED`, and `HYBRID` charging modes
- Matches `FeeRule`s by country, payment method, subscription tier, donation kind, charging mode, and effective dates
- All arithmetic via `Decimal.js` to avoid floating-point drift
- Persists pricing snapshots across both `Donation` and `FeeSet` so legacy reads keep working while new writes use the richer contract-led fields

### Commercial layer (`src/server/lib/commercials.ts`)
- Resolves active contracts by charity, region, product scope, and date
- Applies appeal-level donor-support overrides without bypassing the rest of the contract
- Validates overlapping contracts in application logic
- Stores contract documents and commercial audit events for pricing and status changes

### Double-entry ledger (`src/server/lib/ledger.ts`)
Immutable journal entries per spec §7.1:
- Donation authorised → Dr DonorClearing / Cr CharityPayable
- Fees recognised → Dr CharityPayable / Cr PlatformRevenue + ProcessingFees
- Payout paid → Dr CharityPayable / Cr ExternalBank
- Gift Aid paid → Dr GiftAidReceivable / Cr CharityPayable
- Refund → reversal entries + optional fee clawback

### Background queues (`src/server/lib/queues.ts`)
Three BullMQ queues:
- `email` — receipts, payout notifications
- `payouts` — batch creation, provider submission
- `gift-aid` — HMRC claim building and submission

### Donations API stub (`src/server/lib/donations-api-stub.ts`)
All external API calls return stub data by default.
Set `DONATIONS_API_REAL=1` + `DONATIONS_API_URL` + `DONATIONS_API_KEY` to switch to live.

## Next steps (build order)

1. **Wire Stripe** — add `STRIPE_SECRET_KEY`, implement `createCheckout` in donations router
2. **Appeal and team analytics** — leaderboards and clearer combined fundraising views
3. **Payout batch processor** — async queue worker and reconciliation automation on top of the new manual payout-batch operations
4. **Reconciliation exports** — settlement-oriented downloads and finance exception reporting
5. **Commercial approvals** — richer signature/approval workflow for contracts
6. **Risk engine** — velocity, device fingerprint, IP reputation signals
7. **Accessibility audit** — axe-core CI checks + NVDA/VoiceOver passes
8. **Async finance automation** — payout provider submission, HMRC automation, and exception recovery tooling

## Verification helpers

- `npm run verify:contract-pricing`
- Verifies donor-supported, charity-paid, hybrid, recurring, payout-blocking, and appeal-override pricing cases against the current database

## Data retention (spec §10.1)

| Data | Retention |
|---|---|
| Donations, payments, ledger | 7 years |
| Gift Aid declarations | 6+ years post-claim |
| KYC/KYB documents | 5 years post-relationship |
| Application logs | 90 days |
