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

| Subphase | Status              | Primary paths                                                                                                |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| **6.0**  | PARTIAL             | `reports/phase-6-entry-verified.yaml` · needs `phase-5:gate`                                                 |
| **6.1**  | VERIFIED_SCAFFOLD   | `packages/workspaces/denali` · `getDenaliWorkspacePlugin()`                                                  |
| **6.2**  | VERIFIED_BEHAVIORAL | `packages/workspaces/denali/src/field-registry/` · `registry-parity.spec.ts`                                 |
| **6.3**  | VERIFIED_BEHAVIORAL | `src/composites/` · `composites.contract.spec.ts`                                                            |
| **6.4**  | VERIFIED_BEHAVIORAL | `src/finance/` · `finance-outbox-consumer.spec.ts`                                                           |
| **6.5**  | VERIFIED_BEHAVIORAL | `resolve-workspace-plugin.ts` · `lazy-denali-plugin.ts` · binding contract                                   |
| **6.6**  | VERIFIED_BEHAVIORAL | `tests/smoke/denali-wizard.spec.ts` · golden fixtures                                                        |
| **6.7**  | VERIFIED_BEHAVIORAL | `src/photos/` · `minio-photo.spec.ts`                                                                        |
| **6.8**  | VERIFIED_BEHAVIORAL | `acl/migrateDenaliCanonical.ts` · `migrate-canonical-denali.service.ts` · `migrate-canonical-denali.spec.ts` |
| **6.9**  | IN_PROGRESS         | `phase-6.contract.spec.ts` behavioral · `phase-6:gate` · forensic                                            |

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
