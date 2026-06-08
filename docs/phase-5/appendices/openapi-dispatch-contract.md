# OpenAPI dispatch contract (DEC-099 / SHADOW-API)

```yaml
status: implemented
phase: 5 evolution — P1 Phase 2
closes: SHADOW-API-01..07
related: phase5-evolution-audit.md § OpenAPI
```

## Problem

All `dispatchRequest` routes are **undocumented** in machine-readable OpenAPI — 100% Shadow API. Legacy `openapi.json` describes the frozen Nest monolith, not the thin `@apps/api` stack.

## Decision

| Item            | Choice                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| Generator       | `scripts/generate-openapi.mjs` — no Nest; sources `src/openapi/dispatch-routes.ts` |
| Output          | `openapi/openapi.json` (committed)                                                 |
| Script          | `pnpm run openapi:generate`                                                        |
| Internal routes | `x-internal: true` on `/internal/*` and test hooks                                 |
| CI gate         | `guard:openapi-dispatch-parity` — inventory ↔ `app.ts` ↔ committed spec            |

Route inventory is the **single SoT** for shadow count; `app.ts` must wire every inventory entry (guard enforces).

### Phase 8 urban routes (8.1–8.2)

Inventory includes `/urban/settings`, `/urban/catalog`, `/urban/catalog/{tourId}`, `/urban/registrations`. Regenerate `openapi/openapi.json` in the same PR that adds dispatch wiring.

### Finance routes (Phase 9 — not in trunk inventory)

`/finance/*` handlers live in WIP `denali-finance/` and are **excluded** from `DISPATCH_ROUTES` until Phase 9 lands wired routes in `app.ts`. Adding finance rows to the inventory before dispatch wiring breaks `guard:openapi-dispatch-parity`.

## Verification

```bash
cd apps/api
pnpm run openapi:generate
pnpm run guard:openapi-dispatch-parity
```
