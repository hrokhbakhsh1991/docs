# Architecture boundary tests (Phase 4)

Static analysis for Denali API modules under `apps/api/src/modules/`.

## Rules

| Layer | May import |
|-------|------------|
| **domain** | domain (same bounded context), shared kernel, packages |
| **app** | domain, app (same context), shared kernel, packages |
| **infra** | domain, app, infra (same context), shared kernel, packages |

**Forbidden:** cross–bounded-context relative imports (e.g. `registrations` → `../../tours/...`).

## Commands

```bash
# Included in pnpm test — report-only (stderr listing), suite passes
pnpm --filter @apps/api test

# Strict gate — fails until violation count is zero
pnpm --filter @apps/api test:architecture:enforce
```

## Implementation

- `boundary-scanner.ts` — layer resolver (canonical `app/domain/infra` + legacy folder map) and import graph walk
- `architecture-boundaries.spec.ts` — node:test suite

See **MAP §62**.
