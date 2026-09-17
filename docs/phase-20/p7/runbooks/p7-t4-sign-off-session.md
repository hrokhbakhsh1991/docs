# P7 — T4 customer sign-off session (30 min)

```yaml
runbook_id: P7-T4-SIGNOFF
nano: P7-3-N-004
tier: T4
authority: p7-customer-sign-off.md
evidence: ../evidence/2026-06-23-operator/
prerequisite: [P7-3-N-001, P7-3-N-002, P7-3-N-005]
```

> **Goal:** Customer operator walks VS-01..08 on staging **without developer assistance**. Architect witnesses and records exceptions only.

---

## Before the meeting (developer — 5 min)

```bash
pnpm run p7:t4-day
```

Equivalent steps:

```bash
pnpm run p7:t4-ready             # GO/NO-GO (schedule anytime)
pnpm run p7:t4-prep              # reset VPS smoke rows (day-of)
pnpm run p7:t4-session-brief     # print URLs + OTP
```

Optional full regression (requires SSH tunnel on runner machine):

```bash
pnpm run p7:staging-e2e-probe
# or architect witness bundle (gate + infra + VS-01/02 curl + T2):
pnpm run p7:t4-architect-dry-run
# skip gate if already green this session:
P7_T4_SKIP_GATE=1 pnpm run p7:t4-architect-dry-run
```

---

## Staging URLs (Profile B-staging · operator smoke)

| Surface | URL |
| ------- | --- |
| Admin | http://89.42.210.252:23000/auth/login |
| Marketing | http://89.42.210.252:23002/tours |
| Portal | http://89.42.210.252:23003 |
| API health | http://89.42.210.252:23001/health |

**Operator OTP (staging):** `09174070937` / `1234`

**Smoke tour:** North Ridge Trek · id `00000000-0000-4000-8000-000000000210`

---

## Session script (customer-led)

| Step | VS | Customer action | Pass when |
| ---- | -- | --------------- | --------- |
| 1 | VS-01 | Login admin · open tour · confirm **active** / published | Tour visible in catalog API |
| 2 | VS-02 | Open marketing `/tours` · see North Ridge Trek | Card on list |
| 3 | VS-03 | Marketing → Register CTA · OTP on portal · complete intake | Success screen |
| 4 | VS-04 | Portal `/me/registrations` | New row for tour |
| 5 | VS-05 | Registration detail · upload receipt image | Upload succeeds |
| 6 | VS-06 | Admin · bookings/workspace · **approve** pending guest | Status approved |
| 7 | VS-07 | Admin · Finance → Receipts · approve pending receipt | Receipt cleared |
| 8 | VS-08 | (Architect) confirm CI/local `p7:gate` green on deploy SHA | Token in manifest |

Use a **fresh guest phone** for VS-03..05 if Ali Rezaei row (`…0310`) is already consumed. Suggested: `+15550002002` / `1234`.

---

## Record results

Edit [walkthrough-results.md](../evidence/2026-06-23-operator/walkthrough-results.md) — check VS manual column · add names/dates.

Update [manifest.yaml](../evidence/2026-06-23-operator/manifest.yaml):

```yaml
architect: "<name>"
operator: "<customer name>"
```

Re-run:

```bash
pnpm run p7:evidence-pack-verify
```

---

## After T4 PASS

```bash
export P7_T4_ARCHITECT="Architect Name"
export P7_T4_OPERATOR="Customer Operator Name"
pnpm run p7:t4-closeout
```

This updates manifest, `IMPLEMENTATION-TRUTH-P7`, `AGENT-CURRENT-PHASE.yaml`, and exit checklist to `BEHAVIORAL_COMPLETE`.

Manual alternative:

1. `IMPLEMENTATION-TRUTH-P7.md` → `status: BEHAVIORAL_COMPLETE`
2. `p7-exit-checklist.md` → manual column ✅ for VS-01..08
3. `AGENT-CURRENT-PHASE.yaml` → `status: COMPLETE` · `current_task: none`
4. See [POST-P7-HORIZON.md](../appendices/POST-P7-HORIZON.md) for Z4 / P8+ tracks

---

## References

- [p7-customer-sign-off.md](p7-customer-sign-off.md)
- [p7-staging-e2e.md](p7-staging-e2e.md)
- [P7-EVIDENCE-PACK.md](../appendices/P7-EVIDENCE-PACK.md)
