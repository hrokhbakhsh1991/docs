# Subphase ↔ enforcement cross-reference

> **SOURCE OF TRUTH:** deterministic map for agents — one row per subphase

| Subphase | DAG  | Parallel | Prerequisites   | REQ IDs         | RULE IDs        | CI (primary)       | Exit criteria   | Module                                                                  |
| -------- | ---- | -------- | --------------- | --------------- | --------------- | ------------------ | --------------- | ----------------------------------------------------------------------- |
| 5.0      | P5-0 | no       | phase-4 gate    | 001–006         | 034             | `phase-4:gate`     | entry yaml PASS | [5.0-entry-gate.md](../subphases/5.0-entry-gate.md)                     |
| 5.1      | P5-1 | no       | 5.0, DEL-P5-001 | 007,008,033     | 001–004,019,030 | migration up       | MAP 5.1         | [5.1-canonical-schema.md](../subphases/5.1-canonical-schema.md)         |
| 5.2      | P5-2 | yes†     | 5.1             | 009–011,034     | 003,005         | api test           | MAP 5.2         | [5.2-plugin-validation.md](../subphases/5.2-plugin-validation.md)       |
| 5.3      | P5-3 | yes†     | 5.1             | 012–014,032     | 008–010,033     | query/EXPLAIN      | MAP 5.3         | [5.3-projections.md](../subphases/5.3-projections.md)                   |
| 5.4      | P5-4 | yes‡     | 5.1, **5.2**    | 015–022,035     | 011–018,035     | outbox integration | MAP 5.4 §6      | [5.4-transactional-outbox.md](../subphases/5.4-transactional-outbox.md) |
| 5.5      | P5-5 | yes†     | 5.1             | 023             | 036             | audit migration    | MAP 5.5         | [5.5-audit-events.md](../subphases/5.5-audit-events.md)                 |
| 5.6      | P5-6 | no       | 5.2–5.5         | 024–028,039,040 | 031–033         | phase-5:gate††     | phase_dod       | [5.6-phase-gate.md](../subphases/5.6-phase-gate.md)                     |

† Parallel after 5.1 complete  
‡ 5.4 also requires 5.2 (not parallel with 5.4 start)  
†† `pnpm run phase-5:gate` — **FAIL** if undefined without waiver (BLOCKER-P5-002)

## Forbidden transitions (global)

| Transition                       | Enforcement                        |
| -------------------------------- | ---------------------------------- |
| Any 5.x before 5.0 PASS          | TG-P5-002, FORBIDDEN-018           |
| 5.6 before 5.2–5.5               | state_machine subphase_progression |
| 5.4 before 5.2                   | P5-4 prerequisites                 |
| 5.1 DDL without DEL-P5-001       | TG-P5-004, BLOCKER-P5-001          |
| publish before commit (post-5.4) | FORBIDDEN-005, RULE-012            |
| DONE without contract spec       | FORBIDDEN-017, RULE-031            |

**See:** [`../phase-5-state-machine.md`](../phase-5-state-machine.md) · [`../phase-5-enforcement.md`](../phase-5-enforcement.md)
