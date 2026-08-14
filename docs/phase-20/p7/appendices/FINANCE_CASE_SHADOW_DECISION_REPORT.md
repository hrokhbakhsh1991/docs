# Finance Case Shadow Decision Report (PR16-C)

```yaml
doc_id: FINANCE_CASE_SHADOW_DECISION_REPORT
version: "2026-08-07-v1"
status: DECISION
phase: PR16-C
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_COMPARISON.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERNAL_ROLLOUT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SEMANTIC_CALIBRATION.md
  - apps/api/src/workspace-finance/case/shadow/validate-internal-shadow.ts
  - apps/api/src/workspace-finance/case/shadow/resolve-finance-case-shadow-decision.ts
locks:
  finance-core: unchanged
  ui_mutation: forbidden
  command_actions: forbidden
  case_persistence: forbidden
  auto_remediation: forbidden
  public_rollout: deferred
decision: HOLD_FOR_CALIBRATION
```

## Decision

### **HOLD_FOR_CALIBRATION**

Internal shadow validation ran on allowlisted Denali tenants. Isolation and operational safety passed. Verdict parity on the live matrix is **below** the READY threshold (85%) because known edge cues still diverge from classic ops heuristics — not because ownership is unknown or required facts are missing.

---

## Enablement (process-local validation only)

```bash
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014
FINANCE_CASE_SHADOW_ENABLED=true
FINANCE_CASE_SHADOW_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014
```

Default product config remains **shadow OFF**. This report does **not** mutate flags.

Shadow properties confirmed: read-only · fail-open · non-blocking · independent of FinanceService mutations.

---

## Lifecycle proof

| Check | Result |
| ----- | ------ |
| Primary FinanceService / classic UI path | Unchanged (`primaryUnchanged: true` on all samples) |
| Shadow path | Host compose → `executeFinanceCase` → compare → telemetry/report |
| Shadow sink / compare failure | Fail-open; never affects finance operations |
| Mutation wrap with shadow disabled | Returns primary result; zero Case reads |

---

## Shadow validation report (live matrix)

| Metric | Value |
| ------ | ----- |
| Total comparisons | 3 |
| Comparable cases | 3 |
| Verdict match % | **66.7%** (threshold 85%) |
| Completeness match % | 100% |
| Ownership match % | **100%** |
| Signal match % | 66.7% (1 `SIGNAL_MISMATCH`) |
| Missing required facts | **0** |
| Critical ownership mismatches | **0** |
| Unexplained verdict divergence | **0** (all mismatches noted) |

### Taxonomy distribution

| Code | Count | Sample |
| ---- | ----- | ------ |
| `ALIGNED` | 1 | `…0536` unpaid + pending manual — Case ↔ ops agree |
| `SIGNAL_MISMATCH` | 1 | `…0529` pending receipt queue vs Case attention cue |
| `EXCEPTION_MISMATCH` | 1 | `…0523` paid+remaining `EXCEPTION` vs ops settled (PR15-G meaningConflict) |
| `VERDICT_MISMATCH` | 0 | — |
| `COMPLETENESS_MISMATCH` | 0 | — |
| `OWNERSHIP_MISMATCH` | 0 | — |
| `MISSING_FACT_COVERAGE` | 0 | optional ledger degrade no longer blocks compare (PR15-H) |
| `UNCOMPARABLE` | 0 | — |

---

## Tenant isolation

| Case | Result |
| ---- | ------ |
| Internal allowlisted (`…000003`) | Shadow executes |
| Internal excluded (`…000004` urban) | Zero shadow (`tenant_excluded`) |
| Empty `SHADOW_TENANTS` | Fail closed |
| Cross-tenant case-key leak | **None** |

---

## Operational safety

| Check | Result |
| ----- | ------ |
| CaseOutput outside Case boundary | Comparison uses projection fields only |
| FactSnapshot persistence | None |
| Gateway identifier leakage | None in shadow modules |
| Shadow writes / SoT mutation | None |
| Command bridge execution | None |

---

## Criteria → decision

| READY criterion | Met? |
| --------------- | ---- |
| High verdict parity (≥ 85%) | **No** (66.7%) |
| No critical ownership mismatch | Yes |
| No missing required facts | Yes |
| Mismatch causes understood | Yes (`SIGNAL_MISMATCH`, `EXCEPTION_MISMATCH` mapped to known PR15 cues) |

| HOLD trigger | Present? |
| ------------ | -------- |
| Unknown ownership | No |
| Missing adapter coverage (required) | No |
| Unexplained verdict divergence | No |
| Verdict parity below threshold | **Yes** → HOLD |

---

## Explicitly deferred

- UI Case actions
- Replacing classic receipt review
- Command buttons
- Public rollout
- Auto remediation

---

## Calibration follow-ups (before READY)

1. **`…0529` SIGNAL_MISMATCH** — tighten pending-receipt ↔ `AWAITING_FINANCE` signal alignment (or accept as known ops/Case attention skew with documented exception).
2. **`…0523` EXCEPTION_MISMATCH** — ops still classifies booking-paid as settled while Case emits `EXCEPTION` for paid+remaining; either teach ops observation the meaningConflict cue or keep as understood residual until classic panels catch up.
3. Expand live window (more tenants / registrations) once the two residual classes stabilize.

Not chosen: **READY_FOR_NEXT_STAGE** (parity gate not met).

---

## How to re-run

```bash
cd apps/api && \
FINANCE_CASE_ENCOUNTER_MODE=internal \
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014 \
FINANCE_CASE_SHADOW_ENABLED=true \
FINANCE_CASE_SHADOW_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014 \
PR16C_OUT=/tmp/pr16c-shadow-validation.json \
node --import tsx --env-file=.env --env-file=.env.local \
  src/workspace-finance/case/shadow/validate-internal-shadow.ts
```
