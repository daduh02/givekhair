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
| `/` | Public homepage — shared shell, featured appeal, trust sections |
| `/appeals/[slug]` | Appeal detail + donation widget |
| `/charities` | Public charity directory |
| `/how-it-works` | Public explainer page |
| `/zakat-gift-aid` | Public giving guidance page |
| `/fundraise/[shortName]` | Planned fundraising page route |
| `/admin` | Charity admin dashboard |
| `/admin/payouts` | Payout management |
| `/admin/gift-aid` | Gift Aid claims |
| `/api/trpc/[trpc]` | tRPC endpoint |
| `/api/webhooks/stripe` | Stripe webhook receiver |
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
- Resolves active `FeeSchedule` for a charity (falls back to platform default)
- Matches `FeeRule`s by country, payment method, subscription tier
- All arithmetic via `Decimal.js` — no floating-point drift
- `snapshotJson` on `FeeSet` preserves the exact schedule used at donation time

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
2. **Fundraising page UI** — `/fundraise/[shortName]` page component
3. **Public charity profiles** — individual charity detail pages using the new public shell
4. **Gift Aid claim builder** — BullMQ worker + HMRC submission
5. **Payout batch processor** — nightly BullMQ job + reconciliation report
6. **GL export** — CSV download matching spec appendix 16.A format
7. **Risk engine** — velocity, device fingerprint, IP reputation signals
8. **Accessibility audit** — axe-core CI checks + NVDA/VoiceOver passes

## Data retention (spec §10.1)

| Data | Retention |
|---|---|
| Donations, payments, ledger | 7 years |
| Gift Aid declarations | 6+ years post-claim |
| KYC/KYB documents | 5 years post-relationship |
| Application logs | 90 days |
