# CW5-01 — `@app-tour/tour-core` architecture contract

**Status:** APPROVED (DEC-CW-07) · **Closure:** CW5-01 Wave 5A  
**Ledger:** [`composable-workspace-refactor-plan.md`](composable-workspace-refactor-plan.md)

## Dependency direction (binding)

```text
workspace-sdk → tour-core → booking-http-contracts
platform-core → workspace-sdk
workspaces/* → workspace-sdk | platform-core | tour-core
apps/* → all package public APIs
```

### Allowed

| From | To |
|------|-----|
| `workspace-sdk` | `tour-core` (compatibility re-exports) |
| `tour-core` | `booking-http-contracts`, Node stdlib |
| `apps/api` | `tour-core` |

### Forbidden (tour-core)

| Target | Rationale |
|--------|-----------|
| `@app-tour/workspace-sdk` | Cycle risk (CW5-02 compat re-exports) |
| `@app-tour/platform-core` | Engine layer above SDK |
| `@app-tour/workspace-*` | Workspace implementations |
| `packages/workspaces/*` | Workspace implementations |
| `apps/*` | Application surfaces |
| `@app-tour/finance-core` | Finance vertical |
| `@prisma/*` | Persistence |

Enforcement: `dependency-cruiser.config.js` (`tour-core-*` rules), `packages/tour-core/scripts/guard-boundary.mjs`, `guard:tour-core-boundary`, import-boundary AST scan of `packages/tour-core/src`.

## Ownership — tour-core OWNS

- Proven generic tour/registration **math** (`computeSpotsRemaining`, `atCreateCapacityStrategy`, …)
- Neutral **port interfaces** (publish visibility, capacity definition/occupancy, registration orchestration predicates)
- Generic **transition-table infrastructure** (`TransitionTable<S>`, assert helpers)
- Structural domain types (not SDK `CanonicalDocument`)

## Ownership — tour-core does NOT own

- Workspace vocabulary strings as product constants (except documented DEC-CW-01 persistence contract rows)
- Canonical field **paths** (`capacityMax` vs `tour.capacity` — workspace adapters)
- Workspace policy, UI, persistence implementation
- Finance implementation
- Denali/Urban/Harbor product rules

## Public API policy (CW5-01+)

- All runtime exports surface through `packages/tour-core/src/index.ts` (coordinator-owned barrel).
- Workers add isolated modules under `src/{capacity,registration,publish,transition}/`.
- `workspace-sdk` old paths remain **one-way** re-exports until CW5-09 census retires them.
- No consumer import path is removed before zero-consumer proof.

## Compatibility strategy

1. Implementation moves to `tour-core`.
2. `workspace-sdk` (or API compat shim) re-exports from `@app-tour/tour-core`.
3. Direct `tour-core` imports allowed for new consumers (Denali catalog, API capacity service).
4. Reversal before CW5-09: restore implementation in original owner, repoint exports, migrate consumers back.

## Verification (CW5-01 gate)

```bash
pnpm --filter @app-tour/tour-core run build
pnpm --filter @app-tour/tour-core run lint
pnpm --filter @app-tour/tour-core run test
pnpm run guard:tour-core-boundary
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run test:parity
```
