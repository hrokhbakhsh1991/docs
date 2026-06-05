# Phase 6 — Test inventory

```yaml
rule: "Build green is not Phase 6 closure"
verification_matrix: ../audits/verification-matrix.md
research_fixtures: ../../research/phase-6-denali-workspace-research.md#بخش-۴
```

## Target specs (by subphase)

| Subphase | Path                                                              | REQ                | Proves                 |
| -------- | ----------------------------------------------------------------- | ------------------ | ---------------------- |
| 6.1      | `packages/workspaces/denali/test/phase-6.contract.spec.ts`        | REQ-P6-005,018     | Plugin export surface  |
| 6.2      | `packages/workspaces/denali/test/registry-parity.spec.ts`         | REQ-P6-006,023     | Rules vs legacy domain |
| 6.2      | `packages/workspaces/denali/test/fixtures/golden/*.json`          | REQ-P6-023         | Golden tours           |
| 6.4      | `packages/workspaces/denali/test/finance-outbox-consumer.spec.ts` | REQ-P6-011,012,028 | Finance hooks + stub   |
| 6.5      | `apps/api/test/denali-workspace-plugin.spec.ts`                   | REQ-P6-013,026     | API resolves denali    |
| 6.5      | shadow validate (non-prod)                                        | REQ-P6-024         | Dual validate diff log |
| 6.6      | Playwright / smoke suite                                          | REQ-P6-015         | HTTP wizard parity     |
| 6.7      | `apps/api/test/minio-photo.spec.ts`                               | REQ-P6-016         | Photo e2e              |
| 6.8      | `apps/api/test/migrate-canonical-denali.spec.ts`                  | REQ-P6-017         | trip_details migration |
| 6.9      | `pnpm run phase-6:gate`                                           | REQ-P6-022         | Closure                |

## Existing guards

| Check                        | File                                                  | REQ        |
| ---------------------------- | ----------------------------------------------------- | ---------- |
| No Denali in product imports | `workspace-sdk/test/denali-coupling.contract.spec.ts` | REQ-P6-021 |
| denali binding               | `denali-workspace-binding.contract.spec.ts`           | REQ-P6-026 |
| Doc hardening                | `scripts/guards/lib/phase-6-doc-hardening.mjs`        | —          |

## Scripts (to add in 6.2)

| Script           | Package                      | Purpose                                    |
| ---------------- | ---------------------------- | ------------------------------------------ |
| `denali:codegen` | `@app-tour/workspace-denali` | Regenerate `rules/generated/` — REQ-P6-009 |

## pending_behavioral_gate

| Gate                        | Until                                                    |
| --------------------------- | -------------------------------------------------------- |
| 6.4 full outbox integration | Phase 5.4 VERIFIED_BEHAVIORAL or waiver in `blockers.md` |
| 6.7 MinIO e2e               | `MINIO_*` env in CI matrix                               |
