# P7 exit checklist

```yaml
phase: 20
pack: P7
pack_version: "1.2"
status: IN_PROGRESS
current_task: P7-0-N-002
nano_spec_total: 27
nano_staging_done: 1
nano_total: 27
exit_nano: P7-3-N-005
prerequisite: P6 complete
p6_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
p7_staging_verify: pnpm run p7:staging-verify
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/IMPLEMENTATION-TRUTH-P7.md
discipline: appendices/P7-EXECUTION-DISCIPLINE.md
```

Legend:

- **spec** = nano written in EPIC doc (not progress)
- **staging** = proven on staging (counts toward exit)
- **manual** = T4 sign-off

---

## Milestones

| ID | EPIC | spec | staging |
| -- | ---- | ---- | ------- |
| M0 | P7-0 Live infra | ✅ | 🔄 N-002 |
| M1 | P7-1 Wizard complete | ✅ | ⬜ |
| M2 | P7-2 Workspace ops | ✅ | ⬜ |
| M3 | P7-3 Customer sign-off | ✅ | ⬜ |

## Vertical slice (live on staging)

| VS | spec | staging | manual |
| -- | ---- | ------- | ------ |
| VS-01 | ✅ | ⬜ | ⬜ |
| VS-02 | ✅ | ⬜ | ⬜ |
| VS-03 | ✅ | ⬜ | ⬜ |
| VS-04 | ✅ | ⬜ | ⬜ |
| VS-05 | ✅ | ⬜ | ⬜ |
| VS-06 | ✅ | ⬜ | ⬜ |
| VS-07 | ✅ | ⬜ | ⬜ |
| VS-08 | ✅ dev gate | ⬜ | ⬜ |

---

## P7-0 — Live infra (5)

- [x] P7-0-N-001 Staging walkthrough + `p7:staging-verify` (staging: doc/runbook only)
- [ ] P7-0-N-002 Env matrix A/B/C verified
- [ ] P7-0-N-003 Customer seed on staging Postgres
- [ ] P7-0-N-004 Four-process deploy + host smoke
- [ ] P7-0-N-005 Operator staging login exit

---

## P7-1 — Wizard completion (9)

- [x] P7-1-N-001 Walkthrough runbook exists (spec)
- [x] P7-1-N-002 Preservation gate documented (spec)
- [ ] P7-1-N-003 Staging tour create/save PATCH round-trip
- [ ] P7-1-N-004 Customer settings seed (pickers + prefill)
- [ ] P7-1-N-005 Publish violations visible in UI
- [ ] P7-1-N-006 publishStatus active → marketing catalog
- [ ] P7-1-N-007 Wizard draft session persistence
- [ ] P7-1-N-008 Terms/conditions on real tour
- [ ] P7-1-N-009 VS-01 live on staging

---

## P7-2 — Workspace ops (8)

- [x] P7-2-N-001 Registrations tab tourId preset (P6 trunk — re-prove on staging)
- [ ] P7-2-N-002 Pending row from portal on staging
- [ ] P7-2-N-003 Approve booking from workspace (VS-06 staging)
- [ ] P7-2-N-004 Waitlist promote on staging
- [ ] P7-2-N-005 Transport roster — **SKIP** unless walkthrough requires
- [ ] P7-2-N-006 Operator register — **SKIP** unless walkthrough requires
- [ ] P7-2-N-007 Finance hub link for receipts
- [ ] P7-2-N-008 Operator runbook on staging (T4 VS-06)

---

## P7-3 — Delivery exit (5)

- [x] P7-3-N-001 T2 E2E staging plan (spec — p6-e2e-smoke carryover)
- [ ] P7-3-N-002 T3 finance-ops staging Postgres
- [x] P7-3-N-003 p7:gate composition documented (spec)
- [x] P7-3-N-004 Customer sign-off runbook (spec)
- [ ] P7-3-N-005 Exit — VS-01..08 staging + sign-off

---

## Gate

```bash
pnpm run p7:gate
pnpm run p7:staging-verify
```
