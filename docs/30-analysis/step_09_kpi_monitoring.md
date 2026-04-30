Document-ID: MKT-DOC-ANALYSIS-STEP-09
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 09: KPI and Operational Monitoring Baseline

## 1. Purpose

Define measurable operational KPIs, monitoring events, and alert thresholds to evaluate whether the released MVP solves the target leader pain points.

---

## 2. Inputs

- `docs/30-analysis/step_01_business_mission.md`
- `docs/30-analysis/step_03_system_requirements.md`
- `docs/30-analysis/step_07_test_strategy.md`
- `docs/30-analysis/step_08_execution_plan.md`

---

## 3. KPI Framework

KPIs are grouped into four dimensions:

1. Workflow Efficiency
2. State Clarity and Data Quality
3. Capacity/Waitlist Reliability
4. Reconciliation and Operational Safety

---

## 4. KPI Definitions

## 4.1 Workflow Efficiency KPIs

- `KPI-01` Registration Decision Lead Time  
  Definition: median time from registration creation to final decision (`Accepted`/`Rejected`/`Cancelled`).  
  Target: downward trend sprint-over-sprint.

- `KPI-02` Manual Follow-Up Rate  
  Definition: count of leader follow-up actions per tour cycle.  
  Target: reduced against pre-MVP baseline.

## 4.2 State Clarity and Data Quality KPIs

- `KPI-03` Missing Field Rejection Rate  
  Definition: rejected intake requests due to missing mandatory fields / total intake attempts.  
  Target: decreases after first onboarding cycles.

- `KPI-04` Ambiguous Payment Evidence Rate  
  Definition: payment reviews requiring manual clarification / total payment review attempts.  
  Target: reduced via structured flow and guidance.

- `KPI-05` Status Completeness Ratio  
  Definition: participants with explicit registration + payment state / total participants in scope.  
  Target: >= 95% for active tours.

## 4.3 Capacity and Waitlist Reliability KPIs

- `KPI-06` Capacity Violation Count  
  Definition: incidents where acceptance attempted beyond available capacity.  
  Target: zero accepted-capacity violations.

- `KPI-07` Waitlist Ordering Violation Count  
  Definition: detected deviations from FIFO conversion order.  
  Target: zero.

## 4.4 Reconciliation and Operational Safety KPIs

- `KPI-08` Reconciliation Completion Time  
  Definition: time required to produce final per-tour reconciliation output.  
  Target: reduced vs baseline.

- `KPI-09` Reconciliation Correction Count  
  Definition: number of manual corrections after first reconciliation export.  
  Target: downward trend.

- `KPI-10` Cross-Tenant Access Incident Count  
  Definition: confirmed cross-tenant access or leakage events.  
  Target: zero.

---

## 5. Monitoring Events (Minimum Instrumentation)

KPI trust note:
- KPI trust for release-critical reporting depends on finalized transition-to-event mapping and policy freeze outcomes (`CLAR-029`, `CLAR-028`, `CLAR-030`).
- Until transition-to-event mapping is finalized, KPI values are operationally useful but not release-authoritative.
- Payment and intake quality KPI interpretation depends on resolved policy decisions for payment source-of-truth and intake unknown-field handling (`CLAR-017`, `CLAR-034`).
- Payment record is authoritative source-of-truth for read/export operations; registration is preliminary, and mismatch policy is: `Retry (up to 3x) then Reject and create reconciliations task`.
- Transition-to-event mapping must include non-happy paths, and composite transitions MAY map to multiple events when explicitly documented.
- Decision Source: CLAR-017/CLAR-029/CLAR-034 — 2026-04-28

## 5.1 Registration Events

- `registration_created`
- `registration_status_changed`
- `registration_rejected_validation`
- Mapping requirement: every release-critical registration transition must map deterministically to one canonical event (`CLAR-029`).

## 5.2 Payment Events

- `payment_status_changed`
- `payment_proof_reviewed`
- `payment_proof_flagged_ambiguous`
- Mapping requirement: payment state transitions and reconciliation-relevant actions must have complete event coverage for KPI inputs (`CLAR-028`, `CLAR-029`).

## 5.3 Capacity/Waitlist Events

- `capacity_check_failed`
- `waitlist_item_created`
- `waitlist_item_converted`
- `waitlist_order_anomaly_detected`
- Mapping requirement: capacity/waitlist transition events must be complete enough to support deterministic KPI formulas and anomaly detection (`CLAR-029`, `CLAR-030`).

## 5.4 Security/Boundary Events

- `tenant_scope_violation_blocked`
- `unauthorized_link_access_blocked`
- Mapping requirement: tenant-boundary/security events must remain canonical inputs for isolation and policy-compliance KPIs (`CLAR-028`, `CLAR-030`).

---

## 6. Dashboard Baseline Views

## 6.1 Leader Operations Dashboard

Must show:
- pending queue size
- median decision lead time
- payment state distribution
- accepted vs total capacity
- waitlist queue status

## 6.2 Platform Health Dashboard

Must show:
- tenant-scope violation attempts
- reconciliation completion trend
- contract-export failure rate
- critical flow failure trend

---

## 7. Alert Thresholds (Initial)

- `ALERT-01`: any confirmed cross-tenant incident (`KPI-10 > 0`) -> immediate critical alert.
- `ALERT-02`: waitlist ordering violation (`KPI-07 > 0`) -> high severity alert.
- `ALERT-03`: capacity violation attempt spikes above baseline -> high severity alert.
- `ALERT-04`: reconciliation export failures above agreed threshold -> medium severity alert.

Threshold values SHOULD be tuned after first two release cycles.

---

## 8. Operational Review Cadence

- Weekly:
  - review `KPI-01` to `KPI-07`
  - triage emerging operational friction

- Per release:
  - review `KPI-08` to `KPI-10`
  - approve/adjust threshold policies

- Monthly:
  - evaluate long-term adoption and process simplification impact

---

## 9. Reporting Format (Minimum)

Each KPI report SHOULD include:

- current value
- prior period value
- target direction
- delta interpretation
- action owner
- action deadline

---

## 10. Step-09 Completion Criteria

Step 09 is complete when:

- KPI catalog is approved
- monitoring events are defined for all critical flows
- initial alert thresholds are documented
- dashboard views and review cadence are agreed

---

## Changelog

- 2026-04-28: Extended KPI trust dependency note to include `CLAR-017` and `CLAR-034` decision impact.
- 2026-04-28: Updated KPI trust semantics with resolved payment truth policy, strict intake reject dependency, and non-happy-path event mapping requirement. — Decision Source: CLAR-017/CLAR-029/CLAR-034 — 2026-04-28
