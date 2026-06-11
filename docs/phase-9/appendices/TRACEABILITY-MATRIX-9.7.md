# Phase 9.7 — Requirements traceability matrix (finance command center)

```yaml
matrix_version: "2026-06-08-v1"
subphase: "9.7"
authority: audits/verification-matrix.md · subphases/9.7-finance-denali.md
scope: "9.7 Finance — R1 parity required for 9.8; R2-R4 stretch"
prerequisite_rows: [REQ-P9-013, REQ-P9-050]
enforcement_rows: [INV-P9-006, TQ-P9-006, P9-F-008]
decision_rows: [DEC-P9-002, DEC-P9-016]
```

---

## Master traceability table

| Requirement ID | Design specification location                                                                                        | API / web handler                                                             | Action registry ID          | Smoke test ID | Target test file path                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------- | ------------- | ----------------------------------------------------------- |
| **REQ-P9-070** | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §6 · [`finance-api-dispatch-addendum.md`](finance-api-dispatch-addendum.md) | `denali-finance/*` adapters                                                   | **P9-7-A02**                | N/A           | `packages/workspaces/denali/test/finance-admin.spec.ts`     |
| **REQ-P9-071** | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §5                                                                          | `app/finance` command center (interim · DEC-P9-017)                           | **P9-7-A01**                | N/A           | `apps/web/test/finance-page.spec.ts`                        |
| **REQ-P9-072** | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §5.6 · reconciliation                                                       | `(app)/settings/reconciliation-triage`                                        | **P9-7-A03**                | SMK-P9-11     | `apps/web/test/reconciliation-triage.spec.ts`                |
| **REQ-P9-073** | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §3.3 · §5.4-5.5                                                             | prepayment + schedule APIs (R2+) · R1 manual/receipt in `finance-ops.spec.ts` | **P9-7-A04** · **P9-7-A05** | N/A           | `apps/api/test/finance-ops.spec.ts`                         |
| **INV-P9-006** | [`FINANCE-RISK-REGISTER-P9.md`](FINANCE-RISK-REGISTER-P9.md) R-P9-F04                                                | denali workspace gate                                                         | **P9-7-A01**                | SMK-P9-08     | CP-9.7-02                                                   |
| **TQ-P9-006**  | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §3.1                                                                        | outbox-only ledger                                                            | **P9-7-A02**                | N/A           | `finance-outbox-consumer.spec.ts`                           |
| **DEC-P9-016** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                         | progressive rounds R1-R4                                                      | **P9-7-A04**                | N/A           | CP-9.7-10..14                                               |
| **P9-F-008**   | [`verification-matrix.md`](../audits/verification-matrix.md)                                                         | no Nest finance tree                                                          | **P9-7-A02**                | N/A           | CP-9.7-03                                                   |

---

## Action registry cross-walk

| Action registry ID | Primary requirement IDs | Target path / test                                                                  |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| **P9-7-A01**       | REQ-P9-071              | `apps/web/app/finance/` (interim) → `(app)/finance/` (9.2) · `finance-page.spec.ts` |
| **P9-7-A02**       | REQ-P9-070 · TQ-P9-006  | `apps/api/src/denali-finance/` · `finance-admin.spec.ts` · `finance-ops.spec.ts`    |
| **P9-7-A03**       | REQ-P9-072              | reconciliation triage · `reconciliation-triage.spec.ts`                             |
| **P9-7-A04**       | REQ-P9-073 · DEC-P9-016 | prepayment handlers · CP-9.7-10..11                                                 |
| **P9-7-A05**       | REQ-P9-073              | schedule generator · installments tab · CP-9.7-12..14                               |

---

## Completion proof cross-walk

| Proof ID      | Requirement IDs                      | Round | Spec                                         |
| ------------- | ------------------------------------ | ----- | -------------------------------------------- |
| CP-9.7-01..09 | REQ-P9-070 · REQ-P9-071 · REQ-P9-072 | R1    | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §11 |
| CP-9.7-10..12 | REQ-P9-073                           | R2    | prepayment + schedule                        |
| CP-9.7-13..14 | REQ-P9-073                           | R3    | installments board                           |
| CP-9.7-15     | REQ-P9-071                           | R1    | mobile tabs                                  |

---

## ERIP / UX supplements

| Artifact                                                                                 | Binds to requirement IDs     |
| ---------------------------------------------------------------------------------------- | ---------------------------- |
| [`erip/9.7-cop-finance-denali.md`](erip/9.7-cop-finance-denali.md)                       | REQ-P9-070..073 · DEC-P9-016 |
| [`AGENT-STATE-MAP-9.7.yaml`](AGENT-STATE-MAP-9.7.yaml)                                   | ASM-9.7-001..020             |
| [`schemas/FINANCE-SUMMARY.schema.json`](schemas/FINANCE-SUMMARY.schema.json)             | REQ-P9-070                   |
| [`schemas/PAYMENT-SCHEDULE-ITEM.schema.json`](schemas/PAYMENT-SCHEDULE-ITEM.schema.json) | DEC-P9-016                   |

---

## 9.7 verification bundle

```bash
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/finance-admin.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-page.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/reconciliation-triage.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
pnpm run phase-9:guard
```
