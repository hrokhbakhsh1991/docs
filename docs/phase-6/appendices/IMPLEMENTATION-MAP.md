# Phase 6 — Implementation map (doc ↔ repo)

```yaml
map_meta:
  date: "2026-06-04"
  truth_ledger: ../audits/IMPLEMENTATION-TRUTH.md
  decisions: IMPLEMENTATION-DECISIONS.md
  verification: ../audits/verification-matrix.md
  enforcement_map: ../audits/subphase-enforcement-map.md
  doc_depth: "2026-06-04 PRECISION_DEPTH_v2_DOC_96"
  doc_execution_system_score: 96
```

## Subphase status

| Subphase | Status    | Primary paths                                                 |
| -------- | --------- | ------------------------------------------------------------- |
| **6.0**  | PARTIAL   | `reports/phase-6-entry-verified.yaml` · needs `phase-5:gate`  |
| **6.1**  | SPEC_ONLY | `packages/workspaces/denali` (probe only today)               |
| **6.2**  | SPEC_ONLY | `legacy/packages/denali-domain/` → port target                |
| **6.3**  | SPEC_ONLY | `denali/theme/tokens.css`, composites                         |
| **6.4**  | SPEC_ONLY | plugin finance hooks                                          |
| **6.5**  | SPEC_ONLY | `resolve-workspace-plugin.ts`, `workspace-plugin-registry.ts` |
| **6.6**  | SPEC_ONLY | smoke specs / Playwright                                      |
| **6.7**  | SPEC_ONLY | MinIO + photo e2e                                             |
| **6.8**  | SPEC_ONLY | `migrate-canonical-hook` execution                            |
| **6.9**  | PARTIAL   | `phase-6:guard` scaffold                                      |

## Reference implementation

| Pattern         | Path                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Starter plugin  | [`packages/workspaces/starter`](../../../packages/workspaces/starter)                                                 |
| API resolver    | [`apps/api/src/workspace/resolve-workspace-plugin.ts`](../../../apps/api/src/workspace/resolve-workspace-plugin.ts)   |
| Web registry    | [`apps/web/src/bootstrap/workspace-plugin-registry.ts`](../../../apps/web/src/bootstrap/workspace-plugin-registry.ts) |
| Canonical write | [`apps/api/src/canonical/canonical-tour.service.ts`](../../../apps/api/src/canonical/canonical-tour.service.ts)       |

## hot_paths (REQ-P6-029)

| Path                       | Expected complexity                            | Forbidden                 |
| -------------------------- | ---------------------------------------------- | ------------------------- |
| Tour list by tenant        | O(log n) index on `(tenant_id, …)` projections | full table scan           |
| Registry evaluateFormRules | O(fields) per request                          | O(n²) cross-field loops   |
| Plugin resolve             | O(1) map lookup                                | per-request legacy import |
| MinIO list prefix          | O(objects under prefix)                        | list entire bucket        |

Document in 6.6/6.9 audit; adversarial test if list path exceeds indexed plan.

## Forbidden paths (remain)

- `packages/platform-core/**` — Denali-only branches
- `apps/api/**/DENALI_*` constants
- Runtime `import from 'legacy/...'` in trunk apps
