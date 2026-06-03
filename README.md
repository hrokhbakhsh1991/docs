# app-tour

Enterprise tour-operations platform — **workspace plugins** on a generic core.

| Path | Purpose |
|------|---------|
| [`packages/workspace-sdk`](packages/workspace-sdk) | Plugin contract (no workspace-specific imports) |
| [`legacy/`](legacy/) | Previous monorepo (reference only) |
| [`docs/MIGRATION-MAP.md`](docs/MIGRATION-MAP.md) | نقشهٔ کل — ۷ فاز + frontend tokens |
| [`docs/phase-0-foundation.md`](docs/phase-0-foundation.md) | **فاز ۰** — SDK، legacy، guards (کامل) |
| [`docs/phase-1-platform-core.md`](docs/phase-1-platform-core.md) | **فاز ۱** — engine، tests، anti-patterns |
| [`docs/MIGRATION.md`](docs/MIGRATION.md) | فهرست کوتاه |

**North star:** Platform logic = generic · Workspace logic = injectable

## Prerequisites

- Node.js 24 (`nvm use`)
- pnpm 9.12 (`corepack enable`)

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm run guard:architecture
```
