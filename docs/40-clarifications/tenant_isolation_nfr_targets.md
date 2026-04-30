# Tenant Isolation NFR Targets v1 (Draft)

## Context
Defines tenant-isolation NFR targets derived from current KPI and release-gate baselines.
Implements CLAR-006.

## Scope & Out-of-Scope
### Scope
- Tenant-isolation target linkage to existing KPI/event catalog.
- Observation windows and violation definitions.
- Explicit OPEN decisions where thresholds are not fully derivable.

### Out-of-Scope
- Creation of new KPI IDs.
- Monitoring implementation details.
- Full domain-integrity NFR ownership outside tenant isolation.

## Normative Basis
- `docs/30-analysis/step_03_system_requirements.md` (`SR-NFR-001`, `SR-NFR-001-AC`)
- `docs/30-analysis/step_07_test_strategy.md` (Gate B tenant safety)
- `docs/30-analysis/step_09_kpi_monitoring.md` (`KPI-10`, `KPI-06`, `KPI-07`, alerts)

## Target Catalog

| Target ID | KPI ID | Observation Window | Target Statement | Violation Definition | Status |
|---|---|---|---|---|---|
| TEN-NFR-TGT-001 | `KPI-10` | Per release + rolling operational window | Confirmed cross-tenant access incidents MUST be zero | Any confirmed cross-tenant access/leakage (`KPI-10 > 0`) | Derived from Step-09 target and alert policy |
| TEN-NFR-TGT-002 | `KPI-10` + Gate B | Release gate window | Tenant safety gate MUST pass before release | Any failing cross-tenant denial suite or known leakage defect | Derived from Step-07 Gate B |
| TEN-NFR-TGT-003 | `KPI-07` | Weekly review | Waitlist ordering violations SHOULD be zero within tenant operations | Any detected FIFO ordering deviation | Integrity-within-tenant reference (not direct cross-tenant breach) |
| TEN-NFR-TGT-004 | `KPI-06` | Weekly review | Capacity violation incidents SHOULD be zero within tenant operations | Any accepted-capacity violation event | Integrity-within-tenant reference (not direct cross-tenant breach) |
| TEN-NFR-TGT-005 | `tenant_scope_violation_blocked` event | Weekly + per release | Boundary violations MUST be blocked and observable | Boundary attempt without blocked-event observability | Partially derived; threshold tuning OPEN |

## Clarification on KPI-06 and KPI-07
`KPI-06` and `KPI-07` are primarily domain integrity metrics. In this file they are referenced only as integrity-within-tenant controls, not as direct cross-tenant isolation breach indicators.

## Relationship to Domain Integrity NFRs
This document references `KPI-06` and `KPI-07` because they are operationally critical inside tenant scope, but canonical ownership of their full semantics may belong to a domain-integrity NFR artifact.

OPEN: Decide whether `KPI-06` and `KPI-07` should move to a dedicated domain integrity NFR spec as canonical owner (PM/Architect decision).

## Violation Semantics
- Confirmed cross-tenant incident: verified exposure/leakage outcome.
- Blocked tenant-scope violation: denied attempt, counted for operational monitoring but not itself a confirmed leakage incident.

OPEN: Threshold to be defined by PM/Architect for acceptable blocked-attempt trend escalation structure (e.g., baseline-relative spike policy already referenced in Step-09 `ALERT-03`).
OPEN: Define authoritative confirmation workflow owner and SLA for classifying a “confirmed cross-tenant incident”.
