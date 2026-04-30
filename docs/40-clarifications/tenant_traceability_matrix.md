# Tenant Traceability Matrix v1 (Draft)

## Context
Maps tenant-related requirements to specification artifacts, flow evidence, test baseline references, and KPI/event catalog links.
Implements CLAR-004 and CLAR-006.

## Scope & Out-of-Scope
### Scope
- Tenant-focused traceability for requirements and P0 clarification artifacts.
- Explicit marking of conceptual vs finalized KPI/event links.

### Out-of-Scope
- Non-tenant requirement families.
- Detailed test-case implementation IDs not present in Step-07.

## Sources
- `docs/30-analysis/step_03_system_requirements.md`
- `docs/30-analysis/step_07_test_strategy.md`
- `docs/30-analysis/step_09_kpi_monitoring.md`
- `docs/20-architecture/technical_spec.md`
- `docs/50-validation/flow_consistency_validation.md`
- `docs/20-architecture/flows/registration.md`

## Matrix

| Requirement / Clarification | Spec Artifact(s) | Flow Evidence | Test Baseline (Step-07) | KPI/Event Link (Step-09) | Traceability Status |
|---|---|---|---|---|---|
| `SR-NFR-001` | `docs/40-clarifications/tenant_boundary_policy.md`, `docs/40-clarifications/data_access_tenant_invariants.md`, `docs/40-clarifications/tenant_fail_closed_policy.md` | Tenant scope criterion across validated flows | Matrix row `SR-NFR-001`; Gate B Tenant Safety Gate | `KPI-10`; event `tenant_scope_violation_blocked` | Finalized anchor |
| `SR-FR-003` | `docs/40-clarifications/tenant_boundary_policy.md` | Registration/capacity/payment tenant-scoped validations | Matrix row `SR-FR-003` | OPEN: exact KPI ID/name to be synchronized with KPI catalog | Conceptual |
| `SR-FR-008` | `docs/40-clarifications/participant_context_resolution_contract.md`, `docs/40-clarifications/tenant_boundary_policy.md` | Dual-mode consistency criterion | Matrix row `SR-FR-008` | OPEN: exact KPI ID/name to be synchronized with KPI catalog | Conceptual |
| `SR-FR-009` | `docs/40-clarifications/participant_context_resolution_contract.md`, `docs/40-clarifications/tenant_boundary_policy.md` | Telegram identity required | Matrix row `SR-FR-009` | Event `unauthorized_link_access_blocked`; OPEN: exact KPI ID/name to be synchronized with KPI catalog | Partially finalized |
| `SR-FR-010` | `docs/40-clarifications/participant_context_resolution_contract.md` | Web post-onboarding connect path | Matrix row `SR-FR-010` | OPEN: exact KPI ID/name to be synchronized with KPI catalog | Conceptual |
| `SR-NFR-001-AC` | `docs/40-clarifications/tenant_fail_closed_policy.md` | Applies to all tenant-scoped operational flows | Gate B + cross-tenant denial suite | `KPI-10`; `ALERT-01` | Finalized anchor |
| CLAR-001 | `docs/40-clarifications/tenant_boundary_policy.md` | Entry validation + tenant context checks | OPEN: Test/KPI ID to be assigned | OPEN: exact event name / contract to be aligned with event catalog | Pending final IDs |
| CLAR-002 | `docs/40-clarifications/data_access_tenant_invariants.md` | Tenant-bound query model across flow domains | OPEN: Test/KPI ID to be assigned | `KPI-10` (incident outcome); OPEN: exact KPI ID/name to be synchronized with KPI catalog | Partially finalized |
| CLAR-003 | `docs/40-clarifications/participant_context_resolution_contract.md` | Dual-mode context rules | OPEN: Test/KPI ID to be assigned | OPEN: exact event name / contract to be aligned with event catalog | Pending |
| CLAR-004 | `docs/40-clarifications/tenant_traceability_matrix.md` | N/A (traceability artifact) | OPEN: Test/KPI ID to be assigned | OPEN: exact KPI ID/name to be synchronized with KPI catalog | Pending |
| CLAR-005 | `docs/40-clarifications/tenant_fail_closed_policy.md` | Fail-closed handling across channels | Gate B + security negative paths | `KPI-10`; event `tenant_scope_violation_blocked` | Finalized anchor |
| CLAR-006 | `docs/40-clarifications/tenant_isolation_nfr_targets.md` | Tenant safety across all operational flows | OPEN: Test/KPI ID to be assigned | `KPI-10`; reference integrity-within-tenant (`KPI-06`,`KPI-07`) | Partially finalized |

## Notes
- Step-07 provides requirement-level test mapping, but not stable per-test unique IDs.
- KPI and event catalog names are taken from Step-09 where explicit; unresolved names are marked OPEN.
