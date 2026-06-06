# Subphase ↔ enforcement cross-reference (Phase 4)

> **SOURCE OF TRUTH:** deterministic map for agents and PR reviewers

| Subphase | DAG | Parallel | Prerequisites | P4-E IDs | p4_* guards | CI (primary) | Exit module |
|----------|-----|----------|---------------|----------|-------------|--------------|-------------|
| 4.0 | P4-0 | no | phase-3:gate | P4-E-RF-40, P4-E-AUTH-01, P4-E-SCALE-01 | p4_red_flag_prerequisite | phase-3:gate | [4.0-gate-of-gates.md](../subphases/4.0-gate-of-gates.md) |
| 4.1 | P4-1 | no | 4.0 | P4-E-HOST-01, P4-E-RLS-02 | p4_tenant_kernel_*, p4_contract_spec | tenant-kernel test:phase-4 | [4.1-tenant-kernel.md](../subphases/4.1-tenant-kernel.md) |
| 4.2 | P4-2 | no | 4.1 | P4-E-RLS-01, P4-E-DATA-01, P4-E-SCALE-01 | — (integration tests) | migration, rls-isolation | [4.2-postgres-rls.md](../subphases/4.2-postgres-rls.md) |
| 4.3 | P4-3 | no | 4.2 | P4-E-TENANT-01 | — | two-tenant e2e | [4.3-provisioning.md](../subphases/4.3-provisioning.md) |
| 4.4 | P4-4 | yes† | 4.2 | TH-1 (→ DOD-7) | — | tenant-config + TH-1 | [4.4-tenant-theme.md](../subphases/4.4-tenant-theme.md) |
| 4.5 | P4-5 | yes† | 4.2 | P4-E-EVT-01 | p4_platform_events_* | platform-events test | [4.5-platform-events.md](../subphases/4.5-platform-events.md) |
| 4.6 | P4-6 | no | 4.3–4.5 | P4-E-GATE, P4-E-REG-03 | all p4_* | phase-4:gate | [4.6-phase-gate.md](../subphases/4.6-phase-gate.md) |

† 4.4 and 4.5 may proceed after 4.2 without waiting for 4.3

## Forbidden transitions

| Transition | Enforcement |
|------------|-------------|
| 4.1+ before 4.0 PASS | P4-E-RF-40, FS-P4-RF-OPEN |
| 4.2 before 4.0 | transition_rules |
| Closure grep-only | grep_only_rule |
| outbox table in Phase 4 | forbidden_phase_4 → Phase 5 |
| denali in kernel packages | p4_no_denali_in_kernel |

**State machine:** [`../phase-4-state-machine.md`](../phase-4-state-machine.md)
