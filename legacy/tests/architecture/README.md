# Architecture boundary tests (Phase 4 / Phase 20)

Static analysis for Denali API modules under `apps/api/src/modules/`.

## Rules

| Layer | May import |
|-------|------------|
| **domain** | domain (same bounded context), shared kernel, packages |
| **app** | domain, app (same context), shared kernel, packages |
| **infra** | domain, app, infra (same context), shared kernel, packages |

**Forbidden:** cross–bounded-context relative imports (e.g. `registrations` → `../../tours/...`).

## Gated violations (Phase 20 — global)

The enforce gate fails on **any** module when:

- `domain-must-not-import-infra`
- `app-must-not-import-infra`

There is **no purified-module whitelist**. Report-only violations (`domain-must-not-import-app`, `cross-module-import`) still print to stderr but do not fail the suite unless extended in a future phase.

## Commands

```bash
# Included in pnpm test — report-only (stderr listing), suite passes
pnpm --filter @apps/api test

# Strict gate — fails on any global domain/app→infra violation
pnpm --filter @apps/api test:architecture:enforce
```

## Implementation

- `boundary-scanner.ts` — layer resolver (canonical `app/domain/infra` + legacy folder map) and import graph walk
- `architecture-boundaries.spec.ts` — 3 subtests: stats, global gated check, report/enforce

See **MAP.MD** (Phase 20).
