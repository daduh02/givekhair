# Feature Flow Diagrams

Last updated: 2026-04-27

This document turns the main product flows into role-based diagrams so public, fundraiser, charity-admin, and platform-admin responsibilities are easier to scan.

## Role map

| Role | Main area | Core permissions |
|---|---|---|
| Visitor / donor | Public site | Browse appeals, charities, and fundraiser pages; start donation flow |
| Signed-in fundraiser | Public site + dashboard | Create fundraiser pages, edit own page, publish updates, manage gallery |
| Charity admin | Admin panel | Manage charity profile, appeals, teams, moderation, offline donations, finance views for their charity |
| Platform admin | Admin panel | Cross-charity visibility, homepage featuring, user administration, broad moderation, platform analytics |
| Finance / operations admin | Admin panel | Donations operations, refunds, disputes, Gift Aid, payouts, reconciliation, exports |

## Public and donor flows

### Public discovery

```mermaid
flowchart TD
    A["Visitor lands on public site"] --> B["Browse homepage or public nav"]
    B --> C["Open appeals directory or featured appeal"]
    B --> D["Open charities directory"]
    B --> E["Open how-it-works / support pages"]
    C --> F["Appeal detail page"]
    D --> G["Charity profile page"]
    F --> H["Fundraiser page or donation widget"]
    G --> I["Active appeals and recent fundraisers"]
    H --> J["Donation intent flow"]
```

### Donation flow

```mermaid
flowchart TD
    A["Donor opens donation widget"] --> B["Select amount and fee preference"]
    B --> C["Enter donor details"]
    C --> D["Optional Gift Aid declaration"]
    D --> E["tRPC creates donation intent"]
    E --> F["Server resolves contract + fee rules"]
    F --> G["Hosted checkout / payment confirmation"]
    G --> H["Donation processed and receipt state updated"]
    H --> I["Thank-you page"]
```

### Public fundraiser page

```mermaid
flowchart TD
    A["Visitor opens /fundraise/[shortName]"] --> B["Server checks visibility and moderation state"]
    B --> C["Load story, progress, team, updates, gallery"]
    C --> D["Visitor reads fundraiser narrative"]
    D --> E["Optional jump to appeal context"]
    D --> F["Optional donate on fundraiser page"]
```

## Fundraiser owner flows

### Create a fundraiser page

```mermaid
flowchart TD
    A["Signed-in user chooses Fundraise"] --> B["Open /fundraise/new"]
    B --> C["Complete shared fundraiser form"]
    C --> D["Server validates appeal, team, target, short name"]
    D --> E["Create page as PENDING_APPROVAL + UNLISTED"]
    E --> F["Moderation item recorded"]
    F --> G["Owner sees status guidance in dashboard"]
```

### Manage an existing fundraiser page

```mermaid
flowchart TD
    A["Owner opens /fundraise/[shortName]/edit"] --> B["Update story, target, and page settings"]
    B --> C["Publish updates"]
    B --> D["Manage gallery order / removals"]
    C --> E["Changes saved through server actions"]
    D --> E
    E --> F["Dashboard reflects analytics and moderation state"]
```

### Auth and dashboard journey

```mermaid
flowchart TD
    A["User signs in"] --> B["NextAuth session created"]
    B --> C["Navbar resolves role-aware actions"]
    C --> D["Dashboard entry point"]
    D --> E["Manage existing pages"]
    D --> F["Create new fundraiser page"]
    D --> G["Review approval / visibility messaging"]
```

## Charity admin flows

### Charity and appeal management

```mermaid
flowchart TD
    A["Charity admin opens /admin"] --> B["Charity-scoped overview"]
    B --> C["Manage charity profile"]
    B --> D["Manage appeals"]
    D --> E["Create or edit appeal"]
    E --> F["Manage teams and memberships"]
    E --> G["Review fundraiser pages linked to appeal"]
    G --> H["Approve, reject, hide, or ban"]
```

### Offline donations and reports

```mermaid
flowchart TD
    A["Charity admin opens finance tools"] --> B["Offline donations workspace"]
    B --> C["Manual entry or CSV dry-run"]
    C --> D["Commit valid rows"]
    D --> E["Totals refresh across admin views"]
    A --> F["Reports workspace"]
    F --> G["Choose scope + date range"]
    G --> H["Preview data"]
    H --> I["Export CSV and log artifact"]
```

## Platform admin flows

### Platform oversight and user administration

```mermaid
flowchart TD
    A["Platform admin opens /admin"] --> B["Cross-charity overview"]
    B --> C["Homepage featured appeal control"]
    B --> D["Charities list and detail routes"]
    B --> E["Moderation queue"]
    B --> F["User administration"]
    F --> G["Search / filter users"]
    G --> H["Change role or suspend state"]
    H --> I["Audit row recorded"]
```

### Analytics and leaderboard oversight

```mermaid
flowchart TD
    A["Platform admin opens /admin/analytics"] --> B["Pick timeframe"]
    B --> C["View appeal rankings"]
    B --> D["View team rankings"]
    B --> E["View fundraiser-page rankings"]
    C --> F["Compare campaign performance"]
    D --> F
    E --> F
```

## Finance and operations admin flows

### Donations, refunds, and disputes

```mermaid
flowchart TD
    A["Admin opens /admin/donations"] --> B["Filter donation records"]
    B --> C["Inspect payment, fee, Gift Aid, payout state"]
    C --> D["Record refund request or success"]
    C --> E["Open or update dispute case"]
    D --> F["Write ledger reversal when refund succeeds"]
    E --> G["Donation operational state updated"]
```

### Gift Aid, payouts, and reconciliation

```mermaid
flowchart TD
    A["Finance admin opens /admin/gift-aid"] --> B["Build or submit claim"]
    B --> C["Mark claim paid"]
    C --> D["Linked donations become payout-ready with reclaim context"]
    A --> E["Open /admin/payouts"]
    E --> F["Create or advance payout batch"]
    A --> G["Open /admin/reconciliation"]
    G --> H["Review finance exceptions"]
    H --> I["Drill back to donations, claims, payouts, or contracts"]
```

## Area separation

### Public and user-owned surfaces

- Public marketing and donor routes: `/`, `/appeals/[slug]`, `/appeals/[slug]/leaderboard`, `/charities`, `/charities/[slug]`, `/how-it-works`, `/zakat-gift-aid`
- Auth and donor support routes: `/auth/signin`, `/auth/error`, `/checkout/test/[donationId]`, `/donations/thank-you/[donationId]`
- Fundraiser owner routes: `/fundraise/new`, `/fundraise/[shortName]`, `/fundraise/[shortName]/edit`

### Admin-only surfaces

- Core admin: `/admin`, `/admin/charities`, `/admin/appeals`, `/admin/moderation`, `/admin/users`
- Finance and operations: `/admin/donations`, `/admin/disputes`, `/admin/offline`, `/admin/gift-aid`, `/admin/payouts`, `/admin/reports`, `/admin/reconciliation`
- Analytics and settings: `/admin/analytics`, `/admin/settings`

## When to update this file

- Add or revise a diagram when a new route family, role boundary, or approval step is introduced
- Keep route names aligned with the current product surface
- Update role separation if admin permissions or self-serve fundraiser capabilities expand
