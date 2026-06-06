# Cross-reference map

## Parent → child

| Parent                                         | Children                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| docs/phase-5-canonical-data.ai-exec.md         | phase-5-agent-router.md, README.md, IMPLEMENTATION-MAP.md |
| phase-5-agent-router.md                        | SOLE T0 — subphases/, IMPLEMENTATION-TRUTH.md             |
| appendices/IMPLEMENTATION-MAP.md               | repo paths per subphase                                   |
| phase-5-ai-exec.md                             | Layer 1 initiator skeleton (historical — do not boot)     |
| phase-5-ai-exec.layer4.md                      | ARCHIVE stub — T2 lookup only                             |
| phase-5.ai-exec.md                             | redirect → phase-5-agent-router.md                        |
| phase-5.ai-exec.index.md                       | all phase-5/\*.md                                         |
| phase-5-overview.md                            | subphases/, appendices/phase-boundaries.md                |
| phase-5-state-machine.md                       | subphases/\*, appendices/dependency-graph.md              |
| phase-5-enforcement.md                         | phase-5-guards.md, audits/verification-matrix.md          |
| research/phase-5-data-architecture-research.md | ADR-005, all phase-5 modules                              |

## Dependency edges

| From          | To                | Type                                                |
| ------------- | ----------------- | --------------------------------------------------- |
| Phase 4       | Phase 5.0         | hard — phase-4:gate                                 |
| Phase 5.0     | Phase 5.1         | hard                                                |
| Phase 5.1     | Phase 5.2,5.3,5.5 | hard parallel                                       |
| Phase 5.2     | Phase 5.4         | hard — 5.4 start only after 5.2 VERIFIED_BEHAVIORAL |
| Phase 5.2     | Phase 5.4         | hard                                                |
| Phase 5.2–5.5 | Phase 5.6         | hard                                                |
| DEL-P5-001    | Phase 5.1 DDL     | hard — BLOCKER-P5-001                               |
| Phase 5       | Phase 6           | boundary — appendices/phase-boundaries.md           |

## Validation edges

| Action   | REQ            | RULE     |
| -------- | -------------- | -------- |
| P5-4-A11 | REQ-P5-018,035 | RULE-035 |
| P5-6-A01 | REQ-P5-024     | RULE-031 |

**Depends on:** [`dependency-graph.md`](dependency-graph.md) · [`../audits/traceability-map.md`](../audits/traceability-map.md)
