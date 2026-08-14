# Finance Case Shadow Comparison (PR16-B / PR16-C)

```yaml
doc_id: FINANCE_CASE_SHADOW_COMPARISON
version: "2026-08-07-v2"
status: SHADOW_VALIDATION
phase: PR16-C
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERNAL_ROLLOUT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_DECISION_REPORT.md
  - apps/api/src/workspace-finance/case/schedule-denali-finance-case-shadow.ts
  - apps/api/src/workspace-finance/case/comparison/compare-finance-case-observation.ts
  - apps/api/src/workspace-finance/case/shadow/shadow-mismatch-taxonomy.ts
  - apps/api/src/workspace-finance/case/shadow/build-finance-case-shadow-validation-report.ts
  - apps/api/src/workspace-finance/case/shadow/resolve-finance-case-shadow-decision.ts
  - apps/api/src/workspace-finance/case/shadow/validate-internal-shadow.ts
locks:
  finance-core: unchanged
  primary_response: unaffected
  sot_mutation: forbidden
  case_persistence: forbidden
  fail_open: true
  command_ui: false
  default_shadow: false
  auto_remediation: forbidden
```

## Purpose

**PR16-B:** Enable observational shadow comparison for internal rollout.  
**PR16-C:** Validate internal shadow on Denali allowlisted tenants and emit a **READY / HOLD** decision gate — without UI mutation, commands, finance-core changes, or Case persistence.

---

## Pipeline

```text
FinanceService success (primary)
        │
        ├─► return to caller (unchanged)
        │
        └─► scheduleDenaliFinanceCaseShadow (async, fail-open)
                 │
                 ├─► executeFinanceCase → CaseOutput / Encounter projection
                 ├─► loadOperationalObservation (ops SoT cues)
                 └─► compareFinanceCaseObservation → taxonomy + validation report
```

Hard locks: never blocks primary; never writes SoT; never persists Case; sink failures swallowed.

---

## Rollout controls

| Env | Default | Behavior |
| --- | ------- | -------- |
| `FINANCE_CASE_SHADOW_ENABLED` | **false** / unset | Zero shadow |
| `FINANCE_CASE_SHADOW_TENANTS` | empty | **Fail closed** when shadow ON (nobody) |
| Internal intersection | when `MODE=internal` | Tenant must also be on `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` |
| Sample / triggers | existing | Cost controls unchanged |

Recommended internal enable (validation / ops flip only):

```bash
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=<a>,<b>
FINANCE_CASE_SHADOW_ENABLED=true
FINANCE_CASE_SHADOW_TENANTS=<a>,<b>   # same allowlist; never omit
```

---

## Mismatch taxonomy

| Code | Maps from (engine category / notes) |
| ---- | ----------------------------------- |
| `ALIGNED` | `aligned` |
| `VERDICT_MISMATCH` | `reading_disagreement` |
| `OWNERSHIP_MISMATCH` | `owner_disagreement` |
| `EXCEPTION_MISMATCH` | `exception_disagreement` |
| `ELIGIBILITY_MISMATCH` | `eligibility_disagreement` |
| `COMPLETENESS_MISMATCH` | completeness class vs ops settled/idle disagreement |
| `SIGNAL_MISMATCH` | attention / pending-receipt queue disagreement |
| `MISSING_FACT_COVERAGE` | required-provider degrade / inspect-forced incomplete |
| `UNCOMPARABLE` | other `uncomparable` (shadow failed, ops unavailable, cost skip) |

**PR16-C / PR15-H:** optional `ledger` / `signal` degradation **does not** force `uncomparable` — comparison continues with an observational note.

---

## Reports

### Shadow report (PR16-B)

`buildFinanceCaseShadowReport` — totals, match %, taxonomy, tenants, case keys.

### Validation report (PR16-C)

`buildFinanceCaseShadowValidationReport` adds:

- comparable cases
- verdict / completeness / ownership / signal match %
- taxonomy distribution (incl. `UNCOMPARABLE`)
- `caseKeysByTenant` isolation partition
- missing-required-fact / critical-ownership / unexplained-verdict counters

### Decision gate (PR16-C)

`resolveFinanceCaseShadowDecision` → `READY_FOR_NEXT_STAGE` | `HOLD_FOR_CALIBRATION`

| READY | HOLD |
| ----- | ---- |
| Verdict parity ≥ 85% | Unknown ownership / critical `OWNERSHIP_MISMATCH` |
| No critical ownership mismatch | Missing **required** fact coverage |
| No missing required facts | Unexplained verdict divergence (empty notes) |
| Mismatch causes understood | Verdict parity below threshold |

Live artifact: [`FINANCE_CASE_SHADOW_DECISION_REPORT.md`](./FINANCE_CASE_SHADOW_DECISION_REPORT.md).

Live runner:

```bash
cd apps/api && node --import tsx --env-file=.env --env-file=.env.local \
  src/workspace-finance/case/shadow/validate-internal-shadow.ts
```

---

## Scenario expectations (no finance behavior change)

| ID | Scenario | Expect |
| -- | -------- | ------ |
| A | Normal settled payment | Primary unchanged; shadow comparable or aligned |
| B | Pending receipt | Primary unchanged; Case may `AWAITING_FINANCE` |
| C | Paid with remaining conflict | Primary unchanged; Case `EXCEPTION` via meaningConflict |
| D | Missing optional provider (ledger) | Primary unchanged; compare continues (optional note) |
| D2 | Missing required provider | `MISSING_FACT_COVERAGE` — not a primary failure |

---

## Tenant isolation (PR16-C)

| Case | Expect |
| ---- | ------ |
| Allowlisted internal tenant | Shadow may execute |
| Excluded tenant | Zero shadow |
| Empty `SHADOW_TENANTS` | Fail closed |
| Tenant A vs B report partition | No cross-tenant case-key leakage |

---

## Explicitly deferred

UI Case actions · replacing classic receipt review · command buttons · public rollout · auto remediation.

---

## Recommendation

See decision report: current live gate is **HOLD_FOR_CALIBRATION** (parity). Keep default shadow **OFF** until ops re-runs after calibration follow-ups.
