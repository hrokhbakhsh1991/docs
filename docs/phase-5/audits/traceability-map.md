# Traceability map

> **SOURCE OF TRUTH:** cross-links OBJ · DEL · P5-\* · RULE · REQ · FORBIDDEN · BLOCKER

| Source ID           | Module file                           | Validates via          |
| ------------------- | ------------------------------------- | ---------------------- |
| OBJ-P5-001..008     | phase-5-overview.md                   | phase_dod              |
| DEL-P5-001..013     | phase-5-overview.md                   | subphase DoD           |
| P5-0-A01..A07       | subphases/5.0-entry-gate.md           | REQ-P5-001–006         |
| P5-1-A01..A08       | subphases/5.1-canonical-schema.md     | REQ-P5-007,008,033     |
| P5-2-A01..A05       | subphases/5.2-plugin-validation.md    | REQ-P5-009–011,034     |
| P5-3-A01..A06       | subphases/5.3-projections.md          | REQ-P5-012–014,032     |
| P5-4-A01..A13       | subphases/5.4-transactional-outbox.md | REQ-P5-015–022,035     |
| P5-5-A01..A03       | subphases/5.5-audit-events.md         | REQ-P5-023,036         |
| P5-6-A01..A07       | subphases/5.6-phase-gate.md           | REQ-P5-024–028,039,040 |
| P5-X-A01..A12       | appendices/cross-cutting-actions.md   | REQ-P5-029–031         |
| RULE-001..040       | phase-5-enforcement.md                | guards + tests         |
| FORBIDDEN-001..030  | phase-5-enforcement.md                | PR review              |
| REQ-P5-001..040     | verification-matrix.md                | actions                |
| BLOCKER-P5-001..012 | appendices/blockers.md                | gate                   |
| ADR-005             | appendices/adr-005.md                 | architecture           |
| MAP 5.1–5.5         | appendices/map-bridge.md              | exit criteria          |

**Parent:** [`../phase-5.ai-exec.index.md`](../phase-5.ai-exec.index.md)
