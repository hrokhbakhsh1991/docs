# Phase 9.7 — Finance risk register

```yaml
register_id: FINANCE-RISK-REGISTER-P9
version: "2026-06-08-v1"
subphase: "9.7"
authority: FINANCE-OPS-UX.md · DEC-P9-016
severity_scale: [S1 Critical, S2 High, S3 Medium, S4 Low]
```

## Severity definitions

| Tier            | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| **S1 Critical** | Money loss · cross-tenant leak · ledger/outbox divergence          |
| **S2 High**     | Wrong balance shown · unauthorized adjust · urban finance exposure |
| **S3 Medium**   | UX confusion · performance · partial feature                       |
| **S4 Low**      | Copy · non-blocking polish                                         |

---

## Risk catalog

| ID           | Risk                                                                     | Sev | Mitigation                                                                | Proof                                         |
| ------------ | ------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------- | --------------------------------------------- |
| **R-P9-F01** | Ledger write outside outbox                                              | S1  | All journals via `enqueueOutboxEvent` · no direct GL insert in handlers   | `finance-outbox-consumer.spec.ts` · AH-9.7-03 |
| **R-P9-F02** | Float rounding in installments                                           | S1  | Integer minor only · schedule generator uses BigInt                       | CP-9.7-14 · unit                              |
| **R-P9-F03** | Cross-tenant payment/receipt read                                        | S1  | RLS on all finance tables · tenant kernel                                 | CP-9.7-07                                     |
| **R-P9-F04** | Urban tenant finance routes                                              | S2  | Workspace gate · nav hidden · 404                                         | CP-9.7-02 · P9-F-008                          |
| **R-P9-F05** | Reconciliation adjust without audit                                      | S2  | `reconciliation.ledger.adjustment_applied` outbox mandatory               | reconciliation-triage spec                    |
| **R-P9-F06** | Prepayment double-credit                                                 | S2  | Idempotent prepayment keys · ledger authority single writer               | CP-9.7-10                                     |
| **R-P9-F07** | Manual debt after settlement                                             | S2  | Port `assertManualPaymentDebtAllowed` policy                              | legacy parity test                            |
| **R-P9-F08** | Installment schedule drift from invoice                                  | S2  | Generate from immutable snapshot · reject if sum mismatch                 | CP-9.7-12 · CP-9.7-14                         |
| **R-P9-F09** | Member uploads receipt for others                                        | S2  | Phone/ownership assert on upload                                          | legacy receipt.service                        |
| **R-P9-F10** | Nest finance module creep                                                | S2  | Tree audit · P9-F-008 guard                                               | CP-9.7-03                                     |
| **R-P9-F11** | Finance hub scope creep blocks 9.8                                       | S3  | R1 parity required for gate · R2-R4 stretch flagged                       | DEC-P9-016 rounds                             |
| **R-P9-F12** | Redis summary cache stale                                                | S4  | TTL 30s · invalidate on mutation (legacy pattern)                         | finance-ops.spec                              |
| **R-P9-F13** | Outbox relay invokes Denali finance consumer without workspace-type gate | S3  | Gate relay dispatch on `workspaceType === denali` (code PR) · doc tracked | IMPLEMENTATION-TRUTH · outbox-relay audit     |

---

## Pre-implementation checklist (9.7-R1)

- [ ] Confirm `enabled_modules` includes `finance` for test tenant
- [ ] Port `finance.schemas.ts` contracts to trunk shared path (doc-first note)
- [ ] Wire dashboard widget to reports summary API
- [ ] Reconciliation triage uses workspace findings adapter — not duplicate job runner
- [ ] Receipt storage adapter documented (S3/local) in env matrix

---

## Stretch goal gates (R2-R3)

Installments and prepayment UI **must not** ship without:

1. `PaymentScheduleItem` schema validation at API boundary
2. Invoice read model integration test (paid + due)
3. Architect COP sign-off on `008_finance_schedule_delta.sql`
