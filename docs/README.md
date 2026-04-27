# Documentation Hub

This folder is the working source of truth for delivery status and technical direction.

## Documents

- [Progress Tracker](./PROGRESS.md)
- [Architecture](./ARCHITECTURE.md)
- [Public Experience](./PUBLIC_EXPERIENCE.md)
- [Implementation Roadmap](./ROADMAP.md)
- [Database Schema](./DATABASE_SCHEMA.md)

## How to use this folder

- Update `PROGRESS.md` whenever a meaningful product slice lands.
- Update `ARCHITECTURE.md` when system boundaries, runtime assumptions, or key flows change.
- Update `PUBLIC_EXPERIENCE.md` when the public shell, design tokens, reusable UI primitives, or information architecture changes.
- Keep README verification/setup notes aligned when runtime requirements or quality gates change, such as linting or queue initialization behavior.
- Add or refresh verification helpers in README when new reproducible checks are introduced, such as browser/device smoke tests.
- Update `ROADMAP.md` when priorities move or a new delivery phase begins.
- Update `DATABASE_SCHEMA.md` when models, important relationships, enums, or finance/commercial flows materially change.
