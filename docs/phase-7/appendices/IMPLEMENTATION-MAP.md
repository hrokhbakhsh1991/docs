# Phase 7 — Implementation map

```yaml
map_version: "2026-06-04-v1"
phase_id: "7"
truth_source: audits/IMPLEMENTATION-TRUTH.md
```

## Hot paths (hot_paths — REQ-P7-029)

| Path                                                  | Role                    | Phase 7 touch              |
| ----------------------------------------------------- | ----------------------- | -------------------------- |
| `packages/workspaces/urban/`                          | Second workspace plugin | **7.1** create             |
| `packages/platform-core/`                             | Generic engine          | **7.2** zero diff proof    |
| `apps/api/src/workspace/resolve-workspace-plugin.ts`  | Plugin resolver         | **7.3** urban registration |
| `apps/web/src/workspace/workspace-plugin-registry.ts` | Web plugin load         | **7.3**                    |
| `apps/api/src/common/logging/`                        | Structured logs         | **7.5** §10 complete       |
| `apps/api/src/common/rate-limit/`                     | Redis limits            | **7.6**                    |
| `packages/tenant-kernel/src/route.ts`                 | TenantRoute stub        | **7.7** router impl        |
| `infra/sql/*tenant_routes*`                           | Silo DDL                | **7.7**                    |
| `scripts/guards/phase-7-guard.mjs`                    | Doc + honesty gate      | **7.9**                    |

## Subphase → deliverable map

| Subphase | Primary artifact                      | Verification              |
| -------- | ------------------------------------- | ------------------------- |
| 7.0      | `reports/phase-7-entry-verified.yaml` | `phase-6:gate`            |
| 7.1      | `@app-tour/workspace-urban` shell     | package build             |
| 7.2      | platform-core diff baseline           | guard + contract          |
| 7.3      | api/web bootstrap                     | resolve tests             |
| 7.4      | E2E create→publish                    | HTTP/e2e spec             |
| 7.5      | OBSERVABILITY-RUNBOOK                 | log field audit           |
| 7.6      | rate limit middleware                 | Redis integration test    |
| 7.7      | TenantConnectionRouter                | tenant-kernel tests       |
| 7.8      | adversarial matrix                    | `ci:integrity`            |
| 7.9      | Platform DoD                          | `phase-7:gate` + forensic |

## Dependency graph

```text
7.0 → 7.1 → 7.2 → 7.3 → 7.4 → {7.5, 7.6} → 7.7 → 7.8 → 7.9
```

## Out of scope (explicit)

- `legacy/apps/web/.../urban/` full port
- WASM sandbox (MAP §9.2)
- CDC / warehouse (Phase 8+)
