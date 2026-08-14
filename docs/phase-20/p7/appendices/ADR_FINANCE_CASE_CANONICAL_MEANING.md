# ADR — Finance Case Canonical Meaning (PR16-E)

```yaml
doc_id: ADR_FINANCE_CASE_CANONICAL_MEANING
version: "2026-08-07-v1"
status: ACCEPTED
phase: PR16-E
decision: A
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SEMANTIC_CALIBRATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_DECISION_REPORT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md
locks:
  code: unchanged
  interpreter: unchanged
  finance_service: unchanged
  rollout_flags: unchanged
  command_ui: false
```

## Purpose

Decide whether **Finance Case** (portable facts → interpreter → ephemeral `CaseOutput` / EncounterView) is the **canonical business interpretation** for future operator experiences, or whether Case must forever **mirror** classic FinanceService / finance-panel heuristics.

This ADR is architecture-only. It does not change code, interpreter laws, FinanceService mutations, or rollout flags.

---

## Context

Program locks already separate:

| Authority | Role |
| --------- | ---- |
| **FinanceService / SoTs** | Mutation authority (payments, receipts, booking projections, ledger) |
| **Finance Case interpreter** | Read-time commercial **meaning** from portable facts (ephemeral; no Case DB) |

PR16-C held shadow rollout at **HOLD_FOR_CALIBRATION** (verdict parity 66.7%). PR16-D calibrated residuals without assuming Case or Finance UI correct a priori.

---

## Evidence

| Signal | Result |
| ------ | ------ |
| Required fact coverage | Complete (post PR15-E / PR15-H) |
| Ownership boundaries | Stable (shadow ownership match **100%**) |
| Interpreter behavior | Deterministic; same facts → same reading |
| Shadow verdict parity | **66.7%** on internal matrix (3 comparable) |
| Residual mismatches | Two only — classified in PR16-D |

### Remaining mismatch review

| Case | Shadow taxonomy | What diverges | Classification |
| ---- | --------------- | ------------- | -------------- |
| `…0529` pending receipt | `SIGNAL_MISMATCH` | Host **compare** treats `decisionReady` + pending review as conflict; Case `AWAITING_FINANCE` and ops `awaiting_review` **agree** commercially | **Architecture defect** in Host shadow compare mapping — **not** Case meaning defect, **not** FinanceService defect |
| `…0523` paid + remaining `900000` | `EXCEPTION_MISMATCH` | Case `EXCEPTION` (meaningConflict); classic ops `settled` because booking `paymentStatus=paid` | **Business policy defect** (SoT write: booking marked paid while invoice still owes) + **legacy behavior** in classic panels that trust booking paid; Case reading matches expected commercial meaning |

| Label | Applies? |
| ----- | -------- |
| Architecture defect (Case / interpreter) | **No** for either residual |
| Architecture defect (Host compare) | **Yes** — `…0529` only |
| Business policy defect | **Yes** — `…0523` booking `paid` vs remaining |
| Legacy behavior | **Yes** — classic finance UI following booking projection |
| Intentional divergence | **Temporary** for `…0523` until SoT/policy evolves; not a permanent dual-truth design |

Parity &lt; 85% is therefore **not** evidence that Case meaning is wrong. It is evidence that (1) shadow compare over-flags, and (2) legacy SoT policy can disagree with commercial balance.

---

## Evaluation

### Question

Should Case continue to model **commercial meaning** from portable facts, or should Case **imitate** current FinanceService / panel behavior?

### Option A — Case is canonical interpreter

- Case states what the business **means** given obligation, settlement, evidence, and conflict cues.
- FinanceService remains the only **mutator** of SoTs.
- Legacy Finance UI and booking projections may **evolve toward** Case meaning (e.g. not treating underpaid-as-paid as settled).
- Shadow mismatches against legacy heuristics are calibration / policy work — not a mandate to weaken Case.

### Option B — Case must always mirror FinanceService behavior

- Interpreter (or Host facts) would be bent so Case readings match classic panels even when commercial balance conflicts (e.g. suppress `EXCEPTION` when booking says `paid`).
- Makes FinanceService workflow projections the meaning authority.
- Violates portable A/B/C fact laws and PR15-G **KEEP_CASE** evidence.
- Couples meaning to Denali booking quirks; blocks workspace portability.

### Tradeoffs

| | **A — Case canonical** | **B — Mirror FinanceService** |
| - | ---------------------- | ----------------------------- |
| Commercial honesty | High (remaining + conflict visible) | Low when booking paid lies relative to invoice |
| Operator transition cost | Medium — classic panels lag until SoT/UI evolve | Low short-term — Case looks like today |
| Portability | Preserved (portable facts + laws) | Denali-workflow-shaped meaning |
| Shadow parity near-term | May stay &lt; 100% until legacy evolves | Artificial high parity by copying defects |
| Mutation safety | Unchanged — FinanceService still mutates | Unchanged, but meaning authority collapses into mutator |
| Risk | Temporary dual display (Encounter vs classic) | Permanent encoding of SoT policy bugs into Case |

---

## Decision

### **A — Finance Case becomes the canonical interpreter.**

Legacy Finance may evolve toward it.

**Why not B:** The only commercially material residual (`…0523`) shows Case already matching **expected business meaning** (underpaid / conflict) while FinanceService booking policy and classic heuristics report **settled**. Choosing B would require the interpreter to **imitate a known SoT policy defect**, contradicting PR16-D **KEEP_CASE**, PR15-G meaningConflict ownership, and the interpreter-as-meaning / FinanceService-as-mutation split.

The other residual (`…0529`) is a Host compare false positive — fix compare mapping; do not change Case laws to “match” a broken shadow signal.

---

## Consequences

### Immediate (this ADR)

- No code, interpreter, FinanceService, or rollout flag changes.
- Shadow may remain **HOLD_FOR_CALIBRATION** until Host compare fix and/or legacy SoT policy work improve measured parity — **HOLD does not reverse Decision A**.
- Classic finance panels remain authoritative for **mutations** and current operator workflows until explicitly migrated.

### Meaning vs mutation (unchanged split, now explicit)

```text
Portable facts (Host adapters)
        → interpretFinanceCase → CaseOutput / EncounterView   ⟵ CANONICAL MEANING
FinanceService / SoT writes                               ⟵ CANONICAL MUTATION
Classic finance UI                                        ⟵ LEGACY SURFACE (may lag meaning)
```

### Forbidden under Decision A

- Weakening Case readings to match booking `paid` when remaining &gt; 0
- Teaching the interpreter Denali workflow enums as verdict authority
- Treating shadow disagreement with legacy heuristics as automatic Case bugs

### Allowed under Decision A

- Host compare / ops-observation calibration (parity tooling)
- Future FinanceService policy changes (e.g. `paid` vs `partial` when balance remains) so SoTs align with commercial meaning
- Future operator experiences consuming EncounterView as primary meaning surface

---

## Rollout impact

| Path | Impact |
| ---- | ------ |
| **Decision A (chosen)** | **PR17** may begin **operator read integration** (Encounter / Case meaning as the read-side interpretation for operators), still without replacing mutation paths or enabling command UI unless separately gated |
| Decision B (rejected) | Additional semantic convergence (Case → FinanceService behavior) would be required before any operator Case rollout |

### PR17 entry conditions (under A)

- Decision A accepted (this ADR)
- Host compare false `SIGNAL_MISMATCH` addressed or explicitly waived for read integration scope
- Encounter read path remains fail-closed allowlist; FinanceService mutations unchanged
- Command buttons / public rollout still deferred unless a later ADR opens them

### Still deferred

- Replacing classic receipt review wholesale
- Command Bridge UI / auto remediation
- Expanding shadow tenants solely to chase parity against legacy defects
- Interpreting Decision A as “turn off classic finance”

---

## Future implications

1. **Product:** New operator chrome should prefer EncounterView / Case meaning over inventing panel-local verdicts.
2. **Platform:** finance-core Case laws stay workspace-portable; Denali Host adapters remain translation-only.
3. **Ops:** Booking payment projection and invoice remaining must eventually reconcile in SoT policy — tracked as FinanceService work, not Case law changes.
4. **Metrics:** Shadow parity remains a **legacy convergence** metric, not a veto on Case correctness when residuals are classified `SOT_POLICY` / Host compare defects.
5. **Supersedure:** Later ADRs may refine operator read rollout (PR17+) but must not silently revert to Decision B without a new ADR.

---

## Status

**ACCEPTED** — Decision **A**.

Architect, documentation status: Updated. Link to docs: docs/phase-20/p7/appendices/ADR_FINANCE_CASE_CANONICAL_MEANING.md
