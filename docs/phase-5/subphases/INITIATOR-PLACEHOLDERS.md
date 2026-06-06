# Phase 5 — Subphase initiator placeholders (Layer 1)

> **SOLE execution:** [`../phase-5-agent-router.md`](../phase-5-agent-router.md) · **Populated:** sibling `5.*.md` · **Do not boot `*.skeleton.md`**

| ID  | Skeleton (L1)                                                                | Populated (L2+)                                            | DAG  | Goal                         | Artifact               |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ---- | ---------------------------- | ---------------------- |
| 5.0 | [5.0-entry-gate.skeleton.md](5.0-entry-gate.skeleton.md)                     | [5.0-entry-gate.md](5.0-entry-gate.md)                     | P5-0 | Phase 4 entry + Postgres SoT | checklist yaml         |
| 5.1 | [5.1-canonical-schema.skeleton.md](5.1-canonical-schema.skeleton.md)         | [5.1-canonical-schema.md](5.1-canonical-schema.md)         | P5-1 | JSONB SoT + migrations       | migration + schema doc |
| 5.2 | [5.2-plugin-validation.skeleton.md](5.2-plugin-validation.skeleton.md)       | [5.2-plugin-validation.md](5.2-plugin-validation.md)       | P5-2 | Plugin validate before TX    | API test               |
| 5.3 | [5.3-projections.skeleton.md](5.3-projections.skeleton.md)                   | [5.3-projections.md](5.3-projections.md)                   | P5-3 | Sync projections same TX     | query + rebuild script |
| 5.4 | [5.4-transactional-outbox.skeleton.md](5.4-transactional-outbox.skeleton.md) | [5.4-transactional-outbox.md](5.4-transactional-outbox.md) | P5-4 | Outbox + relay TourCreated   | integration test       |
| 5.5 | [5.5-audit-events.skeleton.md](5.5-audit-events.skeleton.md)                 | [5.5-audit-events.md](5.5-audit-events.md)                 | P5-5 | Minimal audit_events         | migration              |
| 5.6 | [5.6-phase-gate.skeleton.md](5.6-phase-gate.skeleton.md)                     | [5.6-phase-gate.md](5.6-phase-gate.md)                     | P5-6 | Contract + forensic + gate   | spec + report          |

## DAG reminder

```text
5.0 → 5.1 → {5.2 ∥ 5.3 ∥ 5.5} ; 5.4 after 5.2 → 5.6
```

## Forbidden (skeleton)

- Any 5.x before 5.0 PASS
- 5.4 before 5.2
- 5.6 before 5.2–5.5
- 5.1 DDL without DEL-P5-001 (BLOCKER-P5-001)

**Populated:** [`../audits/subphase-enforcement-map.md`](../audits/subphase-enforcement-map.md)
