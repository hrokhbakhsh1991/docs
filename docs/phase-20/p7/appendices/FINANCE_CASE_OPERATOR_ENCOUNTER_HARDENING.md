# Finance Case Operator Encounter Production Hardening (PR12-B → PR13-B)

```yaml
doc_id: FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING
version: "2026-08-07-v4"
package: "@app-tour/finance-http" · finance-http-contracts · apps/api Host encounter · finance-case-encounter-ui
status: IMPLEMENTED (through PR13-B pilot activation + operational validation)
phase: PR12-B · PR12-C · PR13-A · PR13-B
authority: >
  FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING · PR12-A ·
  FINANCE_CASE_INTERPRETER_BOUNDARY · finance-http route ownership
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - packages/finance-http/
  - packages/finance-case-encounter-ui/
  - apps/api/src/workspace-finance/case/encounter/
```

## Purpose

Harden, operationalize, control enablement, and **pilot-activate** the Denali Finance Case **read-only** Encounter:

- PR12-B — HTTP ownership, fail-open telemetry, basic flags
- PR12-C — strategy states, timeout budgets, health evaluation, vendor-neutral emitter
- PR13-A — production decision reasons, operator feedback, recommendations, surface states
- PR13-B — pilot tenant activation, observation window reporting, Denali validation scenarios

**No new business capability.** Hardening must not change interpretation laws. **No auto-enable/disable.**

---

## Hard locks

| Lock | Meaning |
| ---- | ------- |
| Hardening ≠ reinterpretation | Same facts → same CaseOutput |
| Metrics / reports are telemetry only | Never business / Case state |
| Feature flags cannot bypass authz | Security first when enabled |
| Degradation fail-open | Encounter may degrade; FinanceService mutations unaffected |
| No hidden Case storage | Logs/metrics only |
| Health / recommendations report-only | Never auto-mutate flags; never block FinanceService |
| Rollout decisions remain manual | Operators set MODE / pilot / emergency / health_hold |
| UI presentation contract only | No CaseOutput / FactSnapshot |

---

## Production ownership

| Owner | Owns | Must not own |
| ----- | ---- | ------------ |
| finance-core | Case interpretation → EncounterView | HTTP, rollout, pilot reports |
| Host Encounter | Authz, pilot/strategy decision, timeouts, presentation, observation reports | FinanceService mutation |
| Operators | MODE / PILOT_TENANTS / emergency / health_hold | Auto-remediation |
| UI | Presentation + surface chrome | Interpretation / SoT writes |

---

## Rollout lifecycle (strategy + pilot)

```text
disabled → pilot → internal → sampled → full
```

| Mode | Who executes Case | Notes |
| ---- | ----------------- | ----- |
| `disabled` | Nobody | Emergency / default |
| `pilot` | `FINANCE_CASE_ENCOUNTER_PILOT_TENANTS` only | PR13-B activation |
| `internal` | Internal allowlist | Broader than pilot |
| `sampled` | Allowlist + sample rate | Gradual expand |
| `full` | All tenants (authz still required) | Production |

### Pilot procedure (PR13-B)

1. Set `FINANCE_CASE_ENCOUNTER_MODE=pilot`
2. Set `FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=<id,...>`
3. Confirm emergency disable is **off**
4. Observe via `EncounterRolloutReport` / observation window (report-only)
5. Apply recommendation **manually** (`continue` / `expand` / `hold` / `rollback`)
6. Never auto-flip MODE from health

### Emergency disable

`FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=1` → zero Case execution for all tenants. **Does not** affect FinanceService writes.

### Rollback procedure

1. Set `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE=1` **or** `MODE=disabled`
2. Confirm Encounter returns `CASE_ENCOUNTER_DISABLED` / zero Case execution
3. Finance mutation paths remain available
4. Investigate via observation report; re-enable only by manual MODE change

### Operational acceptance criteria (pilot)

| Criterion | Target (report-only) |
| --------- | -------------------- |
| Availability (HTTP ok / requests) | Stable for pilot tenants |
| Timeout rate | Below warn threshold |
| Provider degradation | Unknown/degraded preserved — no fabricated values |
| Incomplete coverage | Inspectable; not invented |
| Authz failures | Expected for non-operators only |
| p95 latency | Within encounter budget band |

---

## Observation window & dashboard contract (PR13-B)

Vendor-neutral Host model (no Datadog/Grafana implementation):

```text
EncounterRolloutReport
  tenantScope
  rolloutDecision
  healthSummary
  recommendation
  riskIndicators
  observationWindow (availability, successes, timeouts, degradation, incomplete, authz, avg/p95 latency)
```

Report-only. Never blocks FinanceService.

---

## Denali validation scenarios (PR13-B)

| Scenario | Expectation |
| -------- | ----------- |
| A Manual payment | Receipt + payment + lifecycle facts → normal Encounter presentation |
| B Online capability | Gateway facts; unknown/degraded settlement; recon attention ≠ ownership |
| C Provider failure | Timeout → unknown preserved; no fake paid/settled values |

---

## Proofs

| Suite | Coverage |
| ----- | -------- |
| `encounter-production-hardening.spec.ts` | PR12-B |
| `encounter-production-readiness.spec.ts` | PR12-C |
| `encounter-production-rollout-feedback.spec.ts` | PR13-A |
| `encounter-pilot-activation.spec.ts` | PR13-B proofs 1–8 + scenarios A/B/C |

## Remaining risks

- Pilot default still requires explicit MODE=`pilot` + allowlist
- Observation quality depends on telemetry volume
- Expand beyond pilot remains a **manual** operator decision
