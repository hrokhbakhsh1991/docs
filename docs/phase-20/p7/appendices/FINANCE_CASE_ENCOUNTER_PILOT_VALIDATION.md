# Finance Case Encounter Pilot Validation (PR15-F)

```yaml
doc_id: FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION
version: "2026-08-07-v1"
status: VALIDATION
phase: PR15-F
pilot_tenant: "00000000-0000-4000-8000-000000000003"
flags:
  FINANCE_CASE_ENCOUNTER_MODE: pilot
  FINANCE_CASE_ENCOUNTER_PILOT_TENANTS: "00000000-0000-4000-8000-000000000003"
  FINANCE_CASE_SHADOW_ENABLED: "false"
  command_ui: false
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md
  - apps/api/src/workspace-finance/case/observation/calibrate-live-encounter-coverage.ts
artifacts:
  - /tmp/pr15f-coverage.json
  - /tmp/pr15f-refresh.json
  - /tmp/pr15f-residual-0523.json
```

## Purpose

Continue single-tenant Denali Encounter **observation** after PR15-E obligation envelope fix. Report-only: no finance-core changes, no tenant expand, no shadow, no UI mutations.

## Method

1. Re-run live fact coverage calibrator (`executeFinanceCase` + Denali Host providers) on the PR15-D/E sample matrix (n=9).
2. HTTP Encounter GET ×2 per registration (operator session) — refresh stability.
3. Deep-dive residual `INCOMPLETE_INSPECT` (`…0523`) at FactSnapshot / CaseOutput level.

Hard locks honored: finance-core unchanged; FinanceService not mutated; Case ephemeral; Encounter read-only; pilot tenant only.

---

## Verdict distribution (n=9)

| Reading | Count | % | Notes |
| ------- | ----- | - | ----- |
| `SETTLED_CAPTURED` | 3 | 33% | paid / receipt_approved |
| `INTENT_OPEN_NO_PROOF` | 2 | 22% | pending payment / receipt_rejected |
| `AWAITING_FINANCE` | 1 | 11% | receipt_submitted (`…0529`), `decisionReady=true` |
| `CLOSED_IDLE` | 1 | 11% | cancelled |
| `AWAITING_COUNTERPARTY` | 1 | 11% | waitlisted |
| `INCOMPLETE_INSPECT` | 1 | 11% | residual `…0523` only |

Contrast PR15-D (pre-adapter fix): **100%** `INCOMPLETE_INSPECT`.

---

## Completeness distribution

| Class | Count | % |
| ----- | ----- | - |
| `wait_complete` | 8 | 89% |
| `act_complete` | 1 | 11% (`…0529` AWAITING_FINANCE) |
| `inspect_forced` | **0** | 0% |

Required-unknown inventory: **empty** across all samples (no `obligation_amount_unread`).

---

## Missing / degraded fact categories

### Required

None observed.

### Optional (all 9 samples)

| Path | Reason | Provider |
| ---- | ------ | -------- |
| `auditCues.ledgerRefsPresent` | `ledger_read_failed` | ledger |
| `auditCues.reconFinding` | `ledger_read_failed` | ledger |

Signal provider also degraded on all samples. Optional ledger/signal gaps **do not** force `inspect_forced` completeness.

---

## Residual INCOMPLETE_INSPECT

| Field | `…0523` |
| ----- | ------- |
| Completeness | `wait_complete` (not inspect_forced) |
| Required unknowns | none |
| Booking SoT | `status=approved`, `paymentStatus=paid`, tour `…0220`, partySize=1 |
| Money | amountDue=`2500000`, remaining=`900000`, partialScopeDeclared=`false` |
| Evidence | proofProgress=`accepted` |
| Intent | intentSet=`one`, intentOpen=`false` |
| Settlement | settlementMeaning=`captured` |

### Cause (interpreter-correct)

`SETTLED_CAPTURED` requires `captured` **and** remaining **not** a known positive minor. Here settlement is captured while remaining stays `900000`, and `partialScopeDeclared=false` blocks `PARTIAL_SCOPED`. No other reading rule matches → **`no_rule_matched` → `INCOMPLETE_INSPECT`**.

This is **not** the PR15-D obligation-envelope defect (money facts are fully known).

### Follow-up (PR15-G)

Ownership + Host `meaningConflictProven` coherence — see [`FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md`](./FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md). Live post-fix `…0523` → **`EXCEPTION`** / `escalate_forced` (existing portable conflict category). No fabricated partial; no interpreter law change.

---

## Refresh stability (HTTP Encounter, n=9 × 2 GETs)

| Check | Result |
| ----- | ------ |
| HTTP | **200/200** all |
| `executionId` changes | **Yes** all (ephemeral Case) |
| `meaningFingerprint` stable | **Yes** all |
| `encounter.reading` stable | **Yes** all |
| Leakage (CaseOutput / FactSnapshot / `facts` / `pi_*`) | **None** |
| Surface | `normal` for all (including residual inspect reading) |

---

## Sample matrix (live)

| Kind | Registration | Reading | Completeness | `decisionReady` |
| ---- | ------------ | ------- | ------------ | --------------- |
| receipt_submitted | `…0529` | AWAITING_FINANCE | act_complete | true |
| paid | `b0142f15-…` | SETTLED_CAPTURED | wait_complete | false |
| paid | `…0544` | SETTLED_CAPTURED | wait_complete | false |
| receipt_approved | `…0527` | SETTLED_CAPTURED | wait_complete | false |
| receipt_rejected | `…0528` | INTENT_OPEN_NO_PROOF | wait_complete | false |
| pending_payment | `…0536` | INTENT_OPEN_NO_PROOF | wait_complete | false |
| edge_cancelled | `…0550` | CLOSED_IDLE | wait_complete | false |
| edge_waitlisted | `8d1b3275-…` | AWAITING_COUNTERPARTY | wait_complete | false |
| residual | `…0523` | INCOMPLETE_INSPECT | wait_complete | false |

---

## Remaining gaps (adapters / ops — not interpreter)

1. **Paid + positive remaining** (`…0523`) — settlement/remaining (or partial-scope) Host mapping coherence.
2. **Universal ledger/signal degradation** — `ledger_read_failed` on every sample (optional; observe; do not invent ledger facts).
3. **Telemetry sink** — still unset at boot (fail-open); optional for internal readiness.

No obligation envelope regression. No allowlist / shadow / command UI work in this PR.

---

## Recommendation

### **CONTINUE**

Keep single-tenant pilot (`…000003`). Pilot is operationally useful post-PR15-E: diverse real readings, refresh-stable, obligation coverage green.

Not chosen:

- **HOLD** — no pilot wiring failure; residual inspect is a narrow adapter coherence case.
- **READY_FOR_INTERNAL** — defer until (a) paid/remaining residual class understood or fixed in Host adapters, (b) optional ledger degradation rate characterized, (c) internal-tenant allowlist + telemetry plan exist. Still **no** shadow / command UI / multi-tenant expand in the same step.

### Exit criteria toward READY_FOR_INTERNAL

1. Residual `no_rule_matched` paid+remaining cohort explained or adapter-fixed (without finance-core law changes).
2. Ledger optional degradation either fixed or explicitly accepted as non-blocking with documented rate.
3. Internal mode plan (tenants + observation window) without enabling shadow or command UI prematurely.
