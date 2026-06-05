# Phase 5 — Subphase ready spec (DoR / DoD)

```yaml
spec_meta:
  date: "2026-06-04"
  commands: ../appendices/req-p5-command-atlas.md
  tests: ../appendices/test-inventory.md
  schema: ../../phase-5-canonical-schema.md
```

## 5.0 — Entry gate

|               |                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **DoR**       | Phase 4 modular docs + honest 4.x progress per [`phase-4-bridge.md`](../appendices/phase-4-bridge.md) |
| **DoD**       | `pnpm run phase-4:gate` exit 0 · `reports/phase-5-entry-verified.yaml` all required fields PASS       |
| **Forbidden** | 5.1 DDL while phase-4 red or in-memory production SoT                                                 |

## 5.1 — Canonical schema (scaffold)

|           |                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DoR**   | 5.0 DoD                                                                                                                                               |
| **DoD**   | DEL-P5-001 doc · `002_phase5_data_layer.sql` · Prisma models · `withCanonicalTransaction` file · `p5_*` scaffold guard PASS · outbox RLS live on 5434 |
| **Prove** | [`5.1-schema-scaffold.md`](../subphases/5.1-schema-scaffold.md) · `outbox-rls-forbidden-access.spec.ts`                                               |
| **Repo**  | **VERIFIED_SCAFFOLD 2026-06-04**                                                                                                                      |

## 5.2 — Plugin validate before persist

|               |                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **DoR**       | 5.1 scaffold DoD                                                                                                                  |
| **DoD**       | `ValidationFailure` before TX · `runPreTransactionValidation` in `CanonicalTourService` · 0 tour + 0 outbox on invalid (Postgres) |
| **Prove**     | `5.2-plugin-validation.spec.ts` · `canonical-validate-before-persist.spec.ts` · `validate-before-persist-ordering.spec.ts`        |
| **Repo**      | **VERIFIED_BEHAVIORAL 2026-06-04** — [`5.2-plugin-validation.md`](../subphases/5.2-plugin-validation.md)                          |
| **Forbidden** | parallel DTO tree · skip validation · `withCanonicalTransaction` without validation gate                                          |

## 5.3 — Projections sync

|               |                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| **DoR**       | 5.1 DoD                                                                                                          |
| **DoD**       | `title`, `schema_version` on `tours` row in **same TX** as outbox (RULE-008)                                     |
| **Prove**     | `canonical-projection-sync.spec.ts` · `outbox-transactional.integration.spec.ts` (rollback includes projections) |
| **Repo**      | **VERIFIED_BEHAVIORAL 2026-06-04** — unified in `atomic-canonical-tour-persist.ts`                               |
| **Forbidden** | hot list via `canonical_data @>` · separate projection table                                                     |

## 5.4 — Transactional outbox

|               |                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------- |
| **DoR**       | 5.1 + **5.2** DoD                                                                             |
| **DoD**       | **5.4-S1:** tour + projection columns + outbox same TX · no in-process publish on Prisma path |
| **Prove**     | `outbox-transactional.integration.spec.ts`                                                    |
| **Open**      | **5.6** phase gate                                                                            |
| **Prove S2**  | `5.4-S2-concurrent-tx-stress.spec.ts` — **PASS 2026-06-04**                                   |
| **Forbidden** | FORBIDDEN-006 in-process-only publish                                                         |

## 5.5 — audit_events

|               |                                            |
| ------------- | ------------------------------------------ |
| **DoR**       | 5.1 DoD (parallel with 5.2/5.3 after 5.1)  |
| **DoD**       | append-only `audit_events` with tenant RLS |
| **Forbidden** | cross-tenant audit read                    |

## 5.6 — Gate + forensic

|               |                                                                                  |
| ------------- | -------------------------------------------------------------------------------- |
| **DoR**       | 5.2, 5.3, 5.4, 5.5 all **behavioral** DoD                                        |
| **DoD**       | `phase-5:gate` ok · phase-4 nested ok · forensic mdoc · IMPLEMENTATION-TRUTH 7/7 |
| **Forbidden** | guard-only proof · layer4 as SoT                                                 |

## DAG

```text
5.0 → 5.1 → 5.2 → 5.4 ─┐
              ├→ 5.3 ∥ 5.5 ┴→ 5.6
```
