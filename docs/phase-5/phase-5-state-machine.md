# Phase 5 — State machine

> **SOURCE OF TRUTH:** state transitions, DAG nodes, rollback  
> **Actions:** subphases/\*.md · **Rules at transition:** [`phase-5-enforcement.md`](phase-5-enforcement.md)

## STATE MODEL

```yaml
execution_mode:
  type: enum
  allowed: [AI_EXEC, HUMAN_REVIEW]
  default: AI_EXEC
  rule: REPO_SCRIPTS_OVER_STALE_MD_WHEN_phase-5_gate_EXISTS

completion_state:
  type: enum
  allowed: [NOT_STARTED, READY, IN_PROGRESS, BLOCKED, VALIDATING, COMPLETED]
  phase_closed_when: current_subphase == DONE AND phase_dod hard ALL PASS

current_phase:
  type: enum
  allowed: ["5"]
  initial: "5"

current_subphase:
  type: enum
  allowed: ["5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "DONE"]
  initial: "5.0"
  closed_value: DONE

subphase_state_initial:
  "5.0": NOT_STARTED
  "5.1": NOT_STARTED
  "5.2": NOT_STARTED
  "5.3": NOT_STARTED
  "5.4": NOT_STARTED
  "5.5": NOT_STARTED
  "5.6": NOT_STARTED
```

---

## Allowed transitions

| From        | To          | Guard                                                                                                       |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| NOT_STARTED | READY       | Prerequisites for target subphase PASS — [`appendices/dependency-graph.md`](appendices/dependency-graph.md) |
| READY       | IN_PROGRESS | Agent sets `current_subphase`                                                                               |
| IN_PROGRESS | VALIDATING  | All actions in subphase file outputs produced                                                               |
| VALIDATING  | COMPLETED   | Subphase DoD hard items PASS — [`phase-5-enforcement.md`](phase-5-enforcement.md#subphase-dod)              |
| VALIDATING  | BLOCKED     | Validation FAIL or BLOCKER unresolved                                                                       |
| BLOCKED     | READY       | BLOCKER resolved; Architect sign-off if `requires_architect`                                                |
| IN_PROGRESS | BLOCKED     | FORBIDDEN-\* or prerequisite FAIL                                                                           |
| COMPLETED   | IN_PROGRESS | Rollback condition met — below                                                                              |

---

## Subphase progression

| From            | To   | Guard                                                                       |
| --------------- | ---- | --------------------------------------------------------------------------- |
| 5.0             | 5.1  | Node P5-0 completion_conditions ALL PASS                                    |
| 5.1             | 5.2  | Node P5-1 completion_conditions ALL PASS                                    |
| 5.1             | 5.3  | Node P5-1 completion_conditions ALL PASS                                    |
| 5.1             | 5.5  | Node P5-1 completion_conditions ALL PASS                                    |
| 5.2             | 5.4  | Node P5-2 **VERIFIED_BEHAVIORAL** — **5.4 must not start before 5.2**       |
| 5.2,5.3,5.4,5.5 | 5.6  | Nodes P5-2..P5-5 ALL **VERIFIED_BEHAVIORAL** (5.1 may be VERIFIED_SCAFFOLD) |
| 5.6             | DONE | `phase_dod` hard ALL PASS                                                   |

---

## Transition guards

| ID        | Condition                                               | on_fail                         |
| --------- | ------------------------------------------------------- | ------------------------------- |
| TG-P5-001 | `current_subphase != DONE` before claiming phase closed | reject DONE                     |
| TG-P5-002 | `pnpm run phase-4:gate` exit 0 before 5.0→5.1           | BLOCKED 5.0                     |
| TG-P5-003 | No `publishDomainEvent` before TX commit after 5.4      | BLOCKED 5.4 — RULE-012          |
| TG-P5-004 | DEL-P5-001 exists before 5.1 DDL (or Architect waiver)  | BLOCKED 5.1                     |
| TG-P5-005 | P5-2 VERIFIED_BEHAVIORAL before 5.4 READY               | BLOCKED 5.4 — see BOOT-MANIFEST |

---

## Rollback conditions

| ID        | Trigger                                   | Action                                          |
| --------- | ----------------------------------------- | ----------------------------------------------- |
| RB-P5-001 | Migration corrupts tours                  | DB restore; revert migration; 5.1 IN_PROGRESS   |
| RB-P5-002 | Outbox double-publish without idempotency | Halt relay; fix domain_event_id; BLOCKER-P5-010 |
| RB-P5-003 | Projection drift in contract test         | Run DEL-P5-009 rebuild; 5.3 VALIDATING          |
| RB-P5-004 | phase-5:gate breaks nested phase-4:gate   | Fix regression; re-run closure — BLOCKER-P5-012 |

---

## State invariants

- `platform-core` ↛ `tenant-kernel` — RULE-038
- Single write path `CanonicalTourService` — RULE-006, P5-X-A01
- RLS + CASL both active — RULE-021, RULE-022
- No Phase 6/7 scope in diff — [`appendices/phase-boundaries.md`](appendices/phase-boundaries.md)

---

## Execution DAG

> **SOURCE OF TRUTH:** node prerequisites and completion_conditions — full YAML in [`appendices/dependency-graph.md`](appendices/dependency-graph.md#execution-dag-nodes)

| node_id | subphase | prerequisites    | produces (DEL)         |
| ------- | -------- | ---------------- | ---------------------- |
| P5-0    | 5.0      | DEP-P5-EXT-04,05 | phase_5_entry_verified |
| P5-1    | 5.1      | P5-0, DEL-P5-001 | DEL-P5-002             |
| P5-2    | 5.2      | P5-1             | DEL-P5-003             |
| P5-3    | 5.3      | P5-1             | DEL-P5-004,009         |
| P5-4    | 5.4      | P5-1, P5-2       | DEL-P5-005,007,010     |
| P5-5    | 5.5      | P5-1             | DEL-P5-006             |
| P5-6    | 5.6      | P5-2..5          | DEL-P5-011,012,013     |

**Parent:** Phase 4 · **Children:** subphases 5.0–5.6 · **Validation:** [`audits/coverage-matrix.md`](audits/coverage-matrix.md)
