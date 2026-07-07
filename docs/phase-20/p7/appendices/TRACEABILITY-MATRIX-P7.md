# P7 — Traceability matrix (27 nanos → code → verify)

```yaml
matrix_id: TRACEABILITY-MATRIX-P7
version: "2026-06-22-v1.6"
pack_version: "1.6"
status: COMPLETE
gate: pnpm run p7:gate
discipline: P7-EXECUTION-DISCIPLINE.md
verification_canonical: P7-VERIFICATION-COMMANDS.yaml
```

> **Agents:** Canonical verify commands live in [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml). This matrix is T2 human summary.

---

## P7-0 — Live infra

| Nano | Requirement | Handler / surface | verify_ref | VS |
| ---- | ----------- | ----------------- | ---------- | -- |
| N-001 | Staging walkthrough | `runbooks/p7-0-staging-walkthrough.md` | `#P7-0-N-001` | — |
| N-002 | Env matrix A/B/C | `runbooks/p7-0-env-matrix.md` | `#P7-0-N-002` | — |
| N-003 | Customer seed | `first-customer-seed.md` · `db-seed.ts` | `#P7-0-N-003` | — |
| N-004 | Four-process deploy | `deploy/vps/README.md` | `#P7-0-N-004` | SMK-P7-INFRA-01 |
| N-005 | Operator staging login | `smoke-operator-login.sh` | `#P7-0-N-005` | SMK-P7-INFRA-03 |

---

## P7-1 — Wizard completion (9)

| Nano | Requirement | Handler / surface | verify_ref | VS |
| ---- | ----------- | ----------------- | ---------- | -- |
| N-001 | Blocker walkthrough | `runbooks/p7-wizard-blocker-walkthrough.md` | `#P7-1-N-001` | — |
| N-002 | Preservation | wizard specs | `#P7-1-N-002` | — |
| N-003 | Save PATCH Postgres | `apps/web/app/tours/new/` | `#P7-1-N-003` | VS-01 |
| N-004 | Settings seed | `db-seed.ts` · settings | `#P7-1-N-004` | — |
| N-005 | Publish violations UI | `wizard-validation` | `#P7-1-N-005` | — |
| N-006 | Publish → catalog | revalidate hook | `#P7-1-N-006` | VS-01/02 |
| N-007 | Draft persistence | `tour-wizard-draft.ts` | `#P7-1-N-007` | — |
| N-008 | Terms on tour | canonical terms paths | `#P7-1-N-008` | — |
| N-009 | VS-01 staging | admin publish | `#P7-1-N-009` | VS-01 |

---

## P7-2 — Workspace ops

| Nano | Requirement | Handler / surface | verify_ref | VS |
| ---- | ----------- | ----------------- | ---------- | -- |
| N-001 | tourId preset | `tour-workspace-registrations-client.tsx` | `#P7-2-N-001` | — |
| N-002 | Portal pending row | bookings service | `#P7-2-N-002` | — |
| N-003 | Approve booking | `bookings.service.ts` | `#P7-2-N-003` | VS-06 |
| N-004 | Waitlist promote | `tour-workspace-waitlist-logic.ts` | `#P7-2-N-004` | — |
| N-005 | Transport roster | workspace transport tab | `#P7-2-N-005` | **CONDITIONAL** |
| N-006 | Operator register | `tours/[id]/register/` | `#P7-2-N-006` | **CONDITIONAL** |
| N-007 | Finance link | `(app)/finance/` | `#P7-2-N-007` | VS-07 prep |
| N-008 | Operator runbook staging | `first-customer-operator.md` | `#P7-2-N-008` | VS-06 |

---

## P7-3 — Delivery exit

| Nano | Requirement | Handler / surface | verify_ref | VS |
| ---- | ----------- | ----------------- | ---------- | -- |
| N-001 | T2 E2E staging | `runbooks/p7-staging-e2e.md` | `#P7-3-N-001` | VS-01..07 |
| N-002 | T3 finance-ops | `finance-ops.spec.ts` | `#P7-3-N-002` | VS-07 |
| N-003 | p7:gate | `p7-denali-delivery-gate.sh` | `#P7-3-N-003` | VS-08 |
| N-004 | Sign-off runbook | `p7-customer-sign-off.md` | `#P7-3-N-004` | all |
| N-005 | Exit nano | exit checklist | `#P7-3-N-005` | VS-01..08 |

---

## References

- [P7-EXIT-CRITERIA-98.md](P7-EXIT-CRITERIA-98.md)
- [P7-VERIFICATION-COMMANDS.yaml](P7-VERIFICATION-COMMANDS.yaml)
- [P7-EVIDENCE-PACK.md](P7-EVIDENCE-PACK.md)
- [P7-PORT-MATRIX.md](P7-PORT-MATRIX.md)
- [p7-staging-e2e.md](../runbooks/p7-staging-e2e.md)
- [SMOKE-SCENARIO-MAP-P7.md](SMOKE-SCENARIO-MAP-P7.md)
