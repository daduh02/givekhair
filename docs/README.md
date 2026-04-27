# Documentation Hub

Last updated: 2026-04-27

This folder is the working source of truth for delivery status and technical direction.

## Documents

- [Progress Tracker](./PROGRESS.md)
- [Architecture](./ARCHITECTURE.md)
- [Feature Flow Diagrams](./FLOW_DIAGRAMS.md)
- [Public Experience](./PUBLIC_EXPERIENCE.md)
- [Implementation Roadmap](./ROADMAP.md)
- [Database Schema](./DATABASE_SCHEMA.md)

## How to use this folder

- Update `PROGRESS.md` whenever a meaningful product slice lands.
- Update `ARCHITECTURE.md` when system boundaries, runtime assumptions, or key flows change.
- Update `FLOW_DIAGRAMS.md` when a role boundary, feature handoff, or route family changes for users, charity admins, or platform admins.
- Update `PUBLIC_EXPERIENCE.md` when the public shell, design tokens, reusable UI primitives, or information architecture changes.
- Keep charity-facing marketing routes and product-positioning docs aligned when public navigation, `/for-charities/*` routes, or inclusive brand language change.
- Keep README verification/setup notes aligned when runtime requirements or quality gates change, such as linting or queue initialization behavior.
- Add or refresh verification helpers in README when new reproducible checks are introduced, such as browser/device smoke tests.
- Update README, `ARCHITECTURE.md`, and `PROGRESS.md` together when security posture changes, including webhook verification, authorization scope rules, public-visibility gating, rate limiting, or response headers.
- Keep appeal-page documentation aligned when sharing UX, donation-summary cards, or headline total-calculation rules change.
- Update `ROADMAP.md` when priorities move or a new delivery phase begins.
- Update `DATABASE_SCHEMA.md` when models, important relationships, enums, or finance/commercial flows materially change.
