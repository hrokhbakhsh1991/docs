# Phase 7 — Subphase ready spec (DoR / DoD)

```yaml
spec_meta:
  date: "2026-06-04"
  verification: verification-matrix.md
  tests: ../appendices/test-inventory.md
  research: ../../research/phase-7-workspace-hardening-research.md
```

## 7.0 — Entry gate

|               |                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **DoR**       | Phase 6 doc pack + `phase-6:gate` runnable                                                     |
| **DoD**       | `phase-6:gate` exit 0 · `reports/phase-7-entry-verified.yaml` PASS · no legacy runtime imports |
| **Prove**     | [`req-p7-command-atlas.md`](../appendices/req-p7-command-atlas.md) 7.0 row                     |
| **Forbidden** | 7.1 while yaml `phase_6_gate` PENDING                                                          |

## 7.1 — Urban package shell

|           |                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------ |
| **DoR**   | 7.0 DoD                                                                                                |
| **DoD**   | `@app-tour/workspace-urban` builds · `getUrbanWorkspacePlugin` · slim registry per URBAN-MINIMAL-SCOPE |
| **Prove** | `pnpm --filter @app-tour/workspace-urban build` · golden fixtures                                      |

## 7.2 — Genericity proof

|               |                                                                                         |
| ------------- | --------------------------------------------------------------------------------------- |
| **DoR**       | 7.1 DoD                                                                                 |
| **DoD**       | Baseline SHA recorded · `phase-7.contract.spec.ts` · zero urban-only platform-core diff |
| **Prove**     | `git diff ${baseline} -- packages/platform-core` empty                                  |
| **Forbidden** | 7.3 before 7.2 VERIFIED_BEHAVIORAL                                                      |

## 7.3 — Bootstrap

|           |                                                                                  |
| --------- | -------------------------------------------------------------------------------- |
| **DoR**   | 7.2 DoD                                                                          |
| **DoD**   | API + web resolve urban · no denali rail · no starter fallback for urban tenants |
| **Prove** | `urban-workspace-plugin.spec.ts`                                                 |

## 7.4 — Urban E2E

|           |                                                                 |
| --------- | --------------------------------------------------------------- |
| **DoR**   | 7.3 DoD                                                         |
| **DoD**   | create→publish HTTP/integration · slim validation               |
| **Prove** | `urban-create-publish.integration.spec.ts` · SMOKE-SCENARIO-MAP |

## 7.5 — Observability

|           |                                 |
| --------- | ------------------------------- |
| **DoR**   | 7.4 DoD                         |
| **DoD**   | §10.2 fields · runbook complete |
| **Prove** | `audit-log-fields.mjs`          |

## 7.6 — Rate limits

|           |                                                 |
| --------- | ----------------------------------------------- |
| **DoR**   | 7.4 DoD                                         |
| **DoD**   | Redis per-tenant keys · tier caps               |
| **Prove** | `rate-limit-tenant.spec.ts` or BLOCKER in TRUTH |

## 7.7 — Tenant router

|           |                                                        |
| --------- | ------------------------------------------------------ |
| **DoR**   | 7.5 + 7.6 DoD (TG-P7-005)                              |
| **DoD**   | `tenant_routes` DDL · TenantConnectionRouter pool+silo |
| **Prove** | `tenant-connection-router.spec.ts`                     |

## 7.8 — Adversarial

|           |                                                                |
| --------- | -------------------------------------------------------------- |
| **DoR**   | 7.7 DoD                                                        |
| **DoD**   | ADVERSARIAL-MATRIX P0 green · `ci:integrity`                   |
| **Prove** | [`ADVERSARIAL-MATRIX.md`](../appendices/ADVERSARIAL-MATRIX.md) |

## 7.9 — Platform gate

|               |                                                        |
| ------------- | ------------------------------------------------------ |
| **DoR**       | merge_7_9_requires all VERIFIED_BEHAVIORAL             |
| **DoD**       | `phase-7:gate` · forensic ≥ 8 · Platform DoD MAP row 7 |
| **Forbidden** | doc-guard-only closure (P7-F-005)                      |
