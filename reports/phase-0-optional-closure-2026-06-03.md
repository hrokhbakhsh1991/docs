# Phase 0 — Optional / P2 closure (execution phase 6)

| Field | Value |
|-------|--------|
| **Date** | 2026-06-03 |
| **Policy** | No breaking trunk changes; document deferrals where architecture blocks |

## Disposition

| ID | Action | Status |
|----|--------|--------|
| **P0-GATE-04** | Root barrel **runtime allowlist** in [`contract.spec.ts`](../packages/workspace-sdk/test/contract.spec.ts) — new exports fail CI until allowlist updated | **Closed (guard)** |
| **P0-SDK-01** | `@casl/ability` remains **peerOptional** — documented in SDK README (publish strategy deferred) | **Closed (documented deferral)** |
| **P0-SDK-02** | `TourClient` / `buildTourAuthHeaders` stay on root barrel for Phase 3 apps — contract test asserts transitional surface; subpath migration = Phase 2+ PR | **Closed (documented deferral)** |
| **P0-STRICT-04** | Remove `apps/` from root | **Won't fix** — incompatible with Integration Foundation (REM-013) |
| **§8.2** | PR template presence check in `doc-gate` (`Exit criteria` section required in template file) | **Closed (template guard)** |

## Verification

```bash
pnpm --filter @app-tour/workspace-sdk run test:phase-0
pnpm run doc-gate
```

## Follow-up (outside Phase 0)

- **P0-OPS-03** — GitHub branch protection: required check **Phase 0 foundation gate** ([`GITHUB_BRANCH_PROTECTION.md`](GITHUB_BRANCH_PROTECTION.md))
- **P0-SDK-02** — move `tours/*` to dedicated export path when apps/web imports are migrated
- **P0-SDK-01** — move CASL to `dependencies` when publishing `@app-tour/workspace-sdk` to npm
