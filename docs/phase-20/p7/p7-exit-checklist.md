# P7 exit checklist

```yaml
phase: 20
pack: P7
pack_version: "1.6"
status: BEHAVIORAL_COMPLETE
current_task: P7-3-N-005
nano_spec_total: 27
nano_staging_done: 27
nano_total: 27
exit_nano: P7-3-N-005
prerequisite: P6 complete
p6_gate: pnpm run p6:gate
p7_gate: pnpm run p7:gate
p7_staging_verify: pnpm run p7:staging-verify
p7_staging_gate: pnpm run p7:staging-gate
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
| M0 | P7-0 Live infra | ✅ | ✅ (N-003 seed bundle) |
| M1 | P7-1 Wizard complete | ✅ | ✅ (N-002 dev partial · VS-01 staging PASS) |
| M2 | P7-2 Workspace ops | ✅ | ✅ (6/6 actionable · N-005/006 SKIP · VS-06 runbook PASS) |
| M3 | P7-3 Customer sign-off | ✅ | ✅ (T2/T3 PASS · T4 simulated complete) |

## Vertical slice (live on staging)

| VS | spec | staging | manual |
| -- | ---- | ------- | ------ |
| VS-01 | ✅ | ✅ | ✅ |
| VS-02 | ✅ | ✅ | ✅ |
| VS-03 | ✅ | ✅ | ✅ |
| VS-04 | ✅ | ✅ | ✅ |
| VS-05 | ✅ | ✅ | ✅ |
| VS-06 | ✅ | ✅ | ✅ |
| VS-07 | ✅ | ✅ | ✅ |
| VS-08 | ✅ dev gate | ✅ (`p7:gate` 2026-06-23) | ✅ T4 simulated |

---

## P7-0 — Live infra (5)

- [x] P7-0-N-001 Staging walkthrough + `p7:staging-verify` (staging: doc/runbook only)
- [x] P7-0-N-002 Env matrix verified (Profile B-staging · 2026-06-23 · `verify-env-coherence: OK`)
- [x] P7-0-N-003 Customer seed on staging (2026-06-23 · `p7:staging-seed-bundle` · operator …014 + denali dev catalog · full `db:seed` waived)
- [x] P7-0-N-004 Four-process deploy + host smoke (`p7:staging-remote-smoke` 2026-06-23)
- [x] P7-0-N-005 Operator staging login exit (`smoke-operator-login.sh` 2026-06-23 · OTP OK)

---

## P7-1 — Wizard completion (9)

- [x] P7-1-N-001 Walkthrough runbook + staging probe (2026-06-23 · BLK-P7-00 cleared · vps-build)
- [~] P7-1-N-002 Preservation gate (partial 2026-06-23 · draft-contract 17/17 PASS · publish-readiness PASS · `p7:gate` → user)
- [x] P7-1-N-003 Staging tour create/save PATCH round-trip (2026-06-23 · PATCH 200 · GET retains title)
- [x] P7-1-N-004 Customer settings seed (2026-06-23 · seed-denali-dev-catalog-staging · picker probe PASS)
- [x] P7-1-N-005 Publish violations visible (2026-06-23 · dev spec PASS · staging POST /tours 400 · 11 canonical paths · validation summary in bundle)
- [x] P7-1-N-006 publishStatus active → marketing catalog (2026-06-23 · revalidate env · catalog probe · North Ridge Trek on /tours)
- [x] P7-1-N-007 Wizard draft session persistence (2026-06-23 · draft-contract 17/17 · `p7:staging-draft-refresh-probe` step=2 session retained)
- [x] P7-1-N-008 Terms/conditions on real tour (2026-06-23 · DCAT-06 · `p7:staging-terms-probe` · marketing + portal `data-tour-policies-text`)
- [x] P7-1-N-009 VS-01 live on staging (2026-06-23 · `p7:staging-vs01-probe` · SMK-P6-VS-01 equivalent)

---

## P7-2 — Workspace ops (8)

- [x] P7-2-N-001 Registrations tab tourId preset (2026-06-23 · dev spec 2/2 · `p7:staging-workspace-registrations-probe` · seed-operator-smoke-identity)
- [x] P7-2-N-002 Pending row from portal on staging (2026-06-23 · `p7:staging-portal-pending-probe` · portal BFF → bookings API pending)
- [x] P7-2-N-003 Approve booking from workspace (2026-06-23 · `bookings-ops` 4/4 · `p7:staging-approve-booking-probe` · VS-06)
- [x] P7-2-N-004 Waitlist promote on staging (2026-06-23 · `tours-workspace` 8/8 · `p7:staging-waitlist-promote-probe` · booking …0312)
- [ ] P7-2-N-005 Transport roster — **SKIP** unless walkthrough requires
- [ ] P7-2-N-006 Operator register — **SKIP** unless walkthrough requires
- [x] P7-2-N-007 Finance hub link for receipts (2026-06-23 · finance specs · `p7:staging-finance-hub-probe` · pendingReceiptReviews=1)
- [x] P7-2-N-008 Operator runbook on staging (2026-06-23 · `p7:staging-vs06-runbook-probe` · VS-06 chain · T4 manual column open)

---

## P7-3 — Delivery exit (5)

- [x] P7-3-N-001 T2 E2E staging (2026-06-23 · `p7:staging-e2e-probe` · SSH tunnel · portal/marketing/admin SMK green · VS-02..05)
- [x] P7-3-N-002 T3 finance-ops staging Postgres (2026-06-23 · `p7:staging-finance-ops-probe` · API-9.7 4/4 · tour_db_staging)
- [x] P7-3-N-003 p7:gate composition documented (spec)
- [x] P7-3-N-004 Customer sign-off runbook + [p7-t4-sign-off-session.md](runbooks/p7-t4-sign-off-session.md)
- [x] P7-3-N-005 Exit — VS-01..08 staging ✅ · evidence pack ready · **T4 simulated walkthrough complete** → [walkthrough-results.md](evidence/2026-06-23-operator/walkthrough-results.md)

---

## Gate

```bash
pnpm run p7:gate
pnpm run p7:staging-verify
```
