# Finance Case Encounter Internal Rollout (PR16-A)

```yaml
doc_id: FINANCE_CASE_INTERNAL_ROLLOUT
version: "2026-08-07-v1"
status: ROLLOUT
phase: PR16-A
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_LEDGER_DEGRADATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SHADOW_COMPARISON.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md
  - apps/api/src/workspace-finance/case/encounter/finance-case-encounter-rollout.ts
  - apps/api/src/workspace-finance/case/encounter/encounter-internal-config.ts
  - apps/api/src/workspace-finance/case/encounter/commercial-meaning-rollout-health.ts
locks:
  finance-core: unchanged
  shadow: false  # PR16-A default; PR16-B enables observational shadow separately
  command_ui: false
  case_persistence: forbidden
  public_operators: forbidden
  classic_finance_ui_replacement: forbidden
```

## Purpose

Prepare **controlled internal** operator Encounter rollout after PR15 pilot closure — read-only, Host-owned, FinanceService mutations unchanged.

**PR16-B follow-on:** observational shadow comparison only — see [`FINANCE_CASE_SHADOW_COMPARISON.md`](./FINANCE_CASE_SHADOW_COMPARISON.md). Keep `FINANCE_CASE_SHADOW_ENABLED=false` until ops flips allowlisted tenants.

---

## Rollout strategy (modes)

| Mode | Allowlist | Empty allowlist | Emergency disable |
| ---- | --------- | --------------- | ----------------- |
| `disabled` | n/a | zero Case execution | MODE or `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE` |
| `pilot` | `FINANCE_CASE_ENCOUNTER_PILOT_TENANTS` | **fail closed** (nobody) | same |
| `internal` | `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` (fallback `FINANCE_CASE_ENCOUNTER_TENANTS`) | **fail closed** (nobody) | same |

Ladder (unchanged): `disabled → pilot → internal → sampled → full`.  
PR16-A **activates internal preparation only** — does not enable `sampled` / `full` / public operators.

### Env (internal)

```bash
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=<tenant-a>,<tenant-b>
FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=false   # or unset
FINANCE_CASE_SHADOW_ENABLED=false
# no command UI flags
```

### Decision order

1. Emergency disable / MODE=disabled → zero Case execution  
2. Strategy allowlist (pilot/internal fail closed)  
3. Operator `HEALTH_HOLD` (manual)  
4. Authz (never bypassed)

---

## Health report contract

`buildEncounterInternalRolloutHealthReport` / extended observation window includes:

| Metric | Source |
| ------ | ------ |
| Encounter availability | HTTP ok / total |
| Latency | avg + p95 execution/HTTP |
| Verdict distribution | sample matrix readings |
| Completeness distribution | completenessClass counts |
| Exception rate | `EXCEPTION` / samples |
| Provider degradation | execution `providerDegraded` + `provider_degradation` events |
| Auth failures | HTTP `authz_denied` rate |

Report-only — **never** mutates flags; **never** blocks FinanceService.

---

## Multi-tenant validation matrix

| Tenant role | Expectation |
| ----------- | ----------- |
| Normal (priced, healthy finance) | Encounter 200; useful reading; no leakage |
| Incomplete data | Fail-closed inspect/unknown where facts missing — not invented zeros |
| Payment edge (paid+remaining / conflict) | `EXCEPTION` or coherent unsettled — meaningConflict path |
| Non-allowlisted | 503 `tenant_not_allowed`; **zero** Case execution |
| Cross-tenant | Host deps tenant-bound; no foreign registration reads |

Hard checks: no gateway id leakage; no SoT mutation from Encounter GET; shadow remains false.

---

## Recommendation field

Operators choose manually (no auto-flag apply):

| Kind | Meaning |
| ---- | ------- |
| **READY_FOR_INTERNAL** | Flip MODE=internal with explicit multi-tenant allowlist |
| **CONTINUE_PILOT** | Stay on single-tenant pilot |
| **HOLD** | Pause; investigate health / auth / availability |

---

## PR16-A recommendation (this change)

### **READY_FOR_INTERNAL**

Strategy + health report + isolation proofs are in place. Live matrix (MODE=internal, allowlist `…000003` + `…000014`, shadow=false):

| Check | Result |
| ----- | ------ |
| Normal (`…0529`) | `AWAITING_FINANCE` / `act_complete` |
| Payment edge (`…0523`) | `EXCEPTION` / `escalate_forced` (meaningConflict) |
| Incomplete (missing reg) | `booking_not_found` — no invented facts |
| Second allowlisted Denali (`…0014`) | enabled; sparse/no regs (incomplete SoT) |
| Excluded urban (`…0004`) | `tenant_not_allowed`; zero Case execution |
| Cross-tenant / gateway leakage | none observed |
| Shadow / command UI | false |

**Activation (manual):** set `FINANCE_CASE_ENCOUNTER_MODE=internal` and an explicit multi-tenant `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` allowlist. Do **not** auto-apply from health. Keep shadow off; no command UI; no public/sampled/full in this step.

Not chosen: CONTINUE_PILOT (pilot already proven; internal gate ready), HOLD (no blocking defect).
