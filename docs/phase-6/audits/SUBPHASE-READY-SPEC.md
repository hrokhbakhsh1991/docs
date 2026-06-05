# Phase 6 — Subphase ready spec (DoR / DoD)

```yaml
spec_meta:
  date: "2026-06-04"
  verification: verification-matrix.md
  tests: ../appendices/test-inventory.md
  research: ../../research/phase-6-denali-workspace-research.md
```

## 6.0 — Entry gate

|               |                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **DoR**       | Phase 5 doc pack + `phase-5:gate` runnable                                                     |
| **DoD**       | `phase-5:gate` exit 0 · `reports/phase-6-entry-verified.yaml` PASS · no legacy runtime imports |
| **Waiver**    | `phase_5_behavioral_minimum` documents 5.3–5.5 if open                                         |
| **Forbidden** | 6.1 while yaml PENDING                                                                         |

## 6.1 — Denali package shell

|           |                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------- |
| **DoR**   | 6.0 DoD                                                                                            |
| **DoD**   | `@app-tour/workspace-denali` builds · `getDenaliWorkspacePlugin` · probe removed from product path |
| **Prove** | `pnpm --filter @app-tour/workspace-denali build` · contract scaffold                               |

## 6.2 — Registry and rules

|               |                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **DoR**       | 6.1 DoD                                                                                        |
| **DoD**       | Port from `legacy/packages/denali-domain/` · ACL folder only for legacy shapes · codegen clean |
| **Prove**     | `registry-parity.spec.ts` · `validateCanonical` on golden fixtures                             |
| **Forbidden** | copy web `wizard/denali` registry                                                              |

## 6.3 — Widgets and theme

|           |                                                    |
| --------- | -------------------------------------------------- |
| **DoR**   | 6.2 VERIFIED_BEHAVIORAL                            |
| **DoD**   | composites registered · `theme/tokens.css` ingress |
| **Prove** | component tests · Phase 2 theme guards             |

## 6.4 — Finance slice

|               |                                                                             |
| ------------- | --------------------------------------------------------------------------- |
| **DoR**       | 6.2 · outbox stub or 5.4 VERIFIED                                           |
| **DoD**       | handlers in `packages/workspaces/denali/src/finance/` · idempotent consumer |
| **Prove**     | `finance-outbox-consumer.spec.ts`                                           |
| **Forbidden** | new finance tables in `apps/api`                                            |

## 6.5 — Bootstrap

|           |                                                                   |
| --------- | ----------------------------------------------------------------- |
| **DoR**   | 6.2 + 6.3 + 6.4                                                   |
| **DoD**   | API + web resolve denali · no starter fallback for denali tenants |
| **Prove** | `denali-workspace-plugin.spec.ts`                                 |

## 6.6 — Smoke parity

|           |                                     |
| --------- | ----------------------------------- |
| **DoR**   | 6.5                                 |
| **DoD**   | golden fixtures · smoke suite green |
| **Prove** | Playwright / HTTP smoke             |

## 6.7 — MinIO photos

|           |                                                  |
| --------- | ------------------------------------------------ |
| **DoR**   | 6.5                                              |
| **DoD**   | tenant-prefixed keys · presigned flow documented |
| **Prove** | `minio-photo.spec.ts`                            |

## 6.8 — migrateCanonical

|           |                                      |
| --------- | ------------------------------------ |
| **DoR**   | 6.5 · 6.6 recommended                |
| **DoD**   | controlled migration · no dual-write |
| **Prove** | migration integration spec           |

## 6.9 — Phase gate

|               |                                                            |
| ------------- | ---------------------------------------------------------- |
| **DoR**       | 6.2–6.8 VERIFIED\_\* per TRUTH                             |
| **DoD**       | `phase-6:gate` exit 0 · forensic ≥ 8 · contract behavioral |
| **Forbidden** | closure from build-only                                    |
