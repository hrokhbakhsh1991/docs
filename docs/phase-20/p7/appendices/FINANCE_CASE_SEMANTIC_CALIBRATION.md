# Finance Case Semantic Calibration (PR16-D)

```yaml
doc_id: FINANCE_CASE_SEMANTIC_CALIBRATION
version: "2026-08-07-v1"
status: CALIBRATION
phase: PR16-D
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_DECISION_REPORT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_COMPARISON.md
  - docs/phase-20/p7/appendices/ADR_FINANCE_CASE_CANONICAL_MEANING.md
  - apps/api/src/workspace-finance/case/comparison/compare-finance-case-observation.ts
  - apps/api/src/workspace-finance/case/comparison/operational-observation.ts
  - apps/api/src/workspace-finance/case/host-denali-case-read-source.ts
locks:
  finance-core: unchanged
  interpreter: unchanged
  finance_service_mutations: unchanged
  ui: unchanged
  command_bridge: unchanged
  rollout_expand: forbidden
  shadow_tenant_expand: forbidden
  command_ui: false
prior_decision: HOLD_FOR_CALIBRATION
```

## Purpose

Calibrate the two residual PR16-C shadow mismatches with **evidence**, without assuming Case or classic Finance UI is correct a priori.

Out of scope (explicit): finance-core redesign, new readings, UI, command bridge, rollout expansion, FinanceService mutation changes.

---

## Current parity (from PR16-C live matrix)

| Metric | Value |
| ------ | ----- |
| Verdict match % | **66.7%** (2 mismatch / 3 comparable) |
| Ownership match % | **100%** |
| Required fact coverage | **100%** |
| Residual taxonomy | `SIGNAL_MISMATCH` (`…0529`), `EXCEPTION_MISMATCH` (`…0523`) |
| Aligned control | `…0536` |

---

## Method

For each mismatch:

```text
Current operator meaning
  → Portable facts (live Host SoT reads)
  → Interpreter reasoning (CaseOutput)
  → Finance UI / ops heuristic reasoning
  → Expected business meaning
  → Root cause (exactly one class)
  → Decision (exactly one action)
```

Live probe (tenant `…000003`, 2026-08-07): sequential Host reads + `executeFinanceCase` + `compareFinanceCaseObservation`. No SoT writes.

---

## Mismatch A — `…0529` (`SIGNAL_MISMATCH`)

### Live evidence

| Layer | Observation |
| ----- | ----------- |
| Booking | `approved` / `unpaid` — Aida Hashemi |
| Obligation / remaining | `2500000` / `2500000` IRR |
| Payment | Manual `Pending` `2500000` |
| Evidence | Receipt `Pending` (file present) |
| Lifecycle | `meaningConflictProven: false` |
| Pending receipt queue | **hit** |
| Ops observation | `pendingReceiptQueue=true`, `financeCategory=awaiting_review`, `followUpOwner=finance_queue` |
| CaseOutput | `AWAITING_FINANCE` / owner `finance` / `act_complete` / **`decisionReady=true`** / posture `act` |
| Sentence | “Evidence and obligation are available for a finance decision.” |
| Compare notes | `confidence_decision_ready_vs_ops_pending_review` → taxonomy `SIGNAL_MISMATCH` |

### Chain

| Step | Finding |
| ---- | ------- |
| Operator meaning (classic) | Receipt sits in **pending review** — finance should approve/reject |
| Portable facts | Unpaid booking + pending manual payment + pending receipt + full remaining |
| Interpreter | `AWAITING_FINANCE` + `decisionReady` = finance **may act now** on evidence |
| Finance UI / ops | `awaiting_review` / `finance_queue` — same commercial job |
| Expected business meaning | Finance reviews the pending receipt before money is settled |
| Compare engine | Treats `decisionReady=true` **while** ops still has pending review as a **signal conflict** |

### Layer analysis (not assumed)

| Hypothesis | Evidence |
| ---------- | -------- |
| Operator UX semantics wrong? | **No** — pending review queue is the right classic surface |
| Host Case mapping wrong? | **No** — facts and `AWAITING_FINANCE` match SoT |
| Interpreter vocabulary wrong? | **No** — `decisionReady` means “ready for finance decision,” not “already settled” |
| FinanceService behavior wrong? | **No** — unpaid + pending receipt is coherent primary state |
| Shadow compare wrong? | **Yes** — Host compare rule `confidence_decision_ready_vs_ops_pending_review` conflates readiness with conflict |

### Root cause (exactly one)

**`HOST_MAPPING`**

Shadow comparison Host mapping over-flags a compatible pair (`AWAITING_FINANCE` + `decisionReady` ↔ ops `awaiting_review`).

### Decision (exactly one)

**`CHANGE_HOST_MAPPING`**

Remove or narrow the compare rule that emits `SIGNAL_MISMATCH` when `decisionReady && (pendingReceiptQueue || awaiting_review)` **and** Case reading is already `AWAITING_FINANCE` with matching finance owner/category. Do **not** change interpreter, FinanceService, or UI in this program step.

---

## Mismatch B — `…0523` (`EXCEPTION_MISMATCH`)

### Live evidence

| Layer | Observation |
| ----- | ----------- |
| Booking | `approved` / **`paid`** — Nazanin Hosseini |
| Obligation / remaining | `2500000` / **`900000`** IRR |
| Payment | Manual `Paid` `1600000` only |
| Evidence | Receipt `Approved` |
| Lifecycle | **`meaningConflictProven: true`** (PR15-G Host coherence) |
| Pending receipt queue | miss |
| Ops observation | `financeCategory=settled`, `followUpOwner=idle`, `closedWithPossibleLeftovers=false` |
| CaseOutput | **`EXCEPTION`** / `exception_policy` / `escalate_forced` / `decisionReady=false` |
| Sentence | “Product meaning conflicts with financial artifacts — routine review paused.” |
| Compare notes | `exception_cue_mismatch` → `EXCEPTION_MISMATCH` |

### Chain

| Step | Finding |
| ---- | ------- |
| Operator meaning (classic) | Booking shows **paid** → finance panels treat as **settled** / idle |
| Portable facts | Obligation `2500000`, paid sum `1600000`, remaining **`900000`**, booking projection **`paid`**, receipt approved |
| Interpreter | Existing `meaning_conflict` → **`EXCEPTION`** (no new reading) |
| Finance UI / ops | Keys off booking `paymentStatus=paid` (+ no pending queue) → **settled** |
| Expected business meaning | **Not settled** — `900000` still due; receipt approve did not clear obligation |

### Layer analysis (not assumed)

| Hypothesis | Evidence |
| ---------- | -------- |
| Operator UX copy alone? | Insufficient — UI follows booking projection that claims paid |
| Host Case mapping wrong? | **No** — PR15-G Host `meaningConflictProven` correctly surfaces paid∩remaining>0 |
| Interpreter vocabulary wrong? | **No** — `EXCEPTION` is the portable conflict reading; laws unchanged |
| FinanceService / SoT write policy? | **Yes** — receipt-approve workflow set booking `paid` while invoice remaining stayed `900000` |
| Intentional Case vs classic gap? | Temporary until SoT policy or classic panels consume remaining |

### Root cause (exactly one)

**`SOT_POLICY`**

Classic FinanceService / booking payment projection writes **`paid`** on receipt approval even when compiled invoice remaining is still positive. Case Host correctly declares meaning conflict; classic ops heuristics do not see remaining.

### Decision (exactly one)

**`KEEP_CASE`**

Case `EXCEPTION` matches expected commercial meaning (underpaid / conflict). Do **not** weaken Host conflict cue or invent a new reading to match classic “settled.”

FinanceService booking `paid` vs `partial` policy change was **deferred** under PR16-D locks. **PR20-B** re-opens that thread with code-path evidence: approve always calls `raisePaidInTx` → `"paid"` while prepayment correctly uses `"partial"`. Decision: **KEEP_CASE** + **CHANGE_SOT_POLICY** (implement in a follow-up SoT PR). See [`FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md`](./FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md). Not chosen: weaken Case, fabricate `partialScopeDeclared`, or expand tenants.

---

## Calibration table

| case | current finance meaning | case meaning | expected meaning | owner | recommended action |
| ---- | ----------------------- | ------------ | ---------------- | ----- | ------------------ |
| `…0529` pending receipt | Ops `awaiting_review` / finance queue | `AWAITING_FINANCE` + `decisionReady` | Finance reviews pending receipt | Host shadow **compare** mapping | **CHANGE_HOST_MAPPING** |
| `…0523` paid + remaining | Ops `settled` / idle (booking `paid`) | `EXCEPTION` / escalate | Underpaid conflict — not settled | FinanceService / booking **paymentStatus** write policy | **KEEP_CASE** |
| `…0536` (control) | Ops awaiting receipt / counterparty | Aligned with Case | Unpaid pending collection | — | **NO_ACTION** |

---

## Root-cause / decision summary

| case | taxonomy | root cause (one) | decision (one) |
| ---- | -------- | ---------------- | -------------- |
| `…0529` | `SIGNAL_MISMATCH` | `HOST_MAPPING` | `CHANGE_HOST_MAPPING` |
| `…0523` | `EXCEPTION_MISMATCH` | `SOT_POLICY` | `KEEP_CASE` |

Unused classes this round: `FACT_TIMING`, `VOCABULARY`, `OPERATOR_EXPECTATION`, `INTENTIONAL_DIFFERENCE`.  
Unused decisions this round: `KEEP_FINANCE`, `CHANGE_OPERATOR_COPY`, `CHANGE_FINANCE_POLICY`, `NO_ACTION` (except control).

---

## Expected parity after calibration

| Scenario | Expected verdict match (this 3-case matrix) |
| -------- | --------------------------------------------- |
| **Now** (PR16-C) | **66.7%** |
| After Host compare fix for `…0529` only | Still **~66.7%** (`…0523` remains `EXCEPTION_MISMATCH`) |
| After Host compare fix **and** future SoT `paid`/`partial` policy for remaining>0 | **~100%** on this matrix |
| After Host compare fix **and** teaching ops observation remaining/conflict (parity-only; does not fix classic UI) | **~100%** shadow parity; classic panels still misleading until SoT policy |

PR16-D itself ships **documentation only** — no Host compare patch in this change set.

---

## Risk

| Risk | Level | Note |
| ---- | ----- | ---- |
| False SIGNAL rule hides real attention bugs | Low if narrowed to `AWAITING_FINANCE`+matching ops category only | |
| Keeping Case EXCEPTION while classic shows settled | **Medium** operator confusion until SoT policy or classic remaining cue | Documented in PR15-G |
| Changing FinanceService `paid` write now | Out of scope — high blast radius | Deferred |
| Expanding shadow tenants before Host compare fix | Would amplify false `SIGNAL_MISMATCH` noise | Forbidden |

---

## Recommended next rollout decision

### **HOLD_FOR_CALIBRATION** (unchanged)

Reasons:

1. `…0529` is a **false** shadow signal (Host compare) — fix is `CHANGE_HOST_MAPPING`, not yet applied.
2. `…0523` is a **true** commercial conflict — Case correct (`KEEP_CASE`); classic “settled” is SoT-policy drift — FinanceService policy change deferred.
3. Verdict parity stays below READY (≥85%) until (1) lands **and** either SoT policy or an explicit ops-observation remaining cue addresses (2).

Do **not**: enable shadow for more tenants, enable command UI, change interpreter, change FinanceService in this step.

Suggested follow-on order (separate PRs):

1. Host compare: drop false `decisionReady` vs pending-review `SIGNAL_MISMATCH` when Case∩ops already agree on finance review.
2. Re-run `validate-internal-shadow.ts`.
3. Open FinanceService policy thread for booking `paid` vs remaining (not Case).

---

## Explicit non-actions

- No finance-core / interpreter change  
- No new Case readings  
- No UI / command bridge / command UI  
- No rollout or shadow-tenant expansion  
- No FinanceService mutation in PR16-D  
