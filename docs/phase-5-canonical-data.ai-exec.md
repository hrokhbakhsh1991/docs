# AI-EXECUTION DOCUMENT — Phase 5 (cold start)

> **SOLE EXECUTION ENTRY:** [`phase-5/phase-5-agent-router.md`](phase-5/phase-5-agent-router.md)  
> **Hub:** [`phase-5/README.md`](phase-5/README.md) · **Repo map:** [`phase-5/appendices/IMPLEMENTATION-MAP.md`](phase-5/appendices/IMPLEMENTATION-MAP.md)  
> **Honest status:** [`phase-5/audits/IMPLEMENTATION-TRUTH.md`](phase-5/audits/IMPLEMENTATION-TRUTH.md)

```yaml
document_meta:
  phase_id: "5"
  phase_name: "Canonical Data Architecture — Data Layer Standard"
  north_star: "Document-centric canonical JSONB SoT + sync projections + transactional outbox + minimal audit"
  adr_id: ADR-005
  sole_execution_entry: phase-5/phase-5-agent-router.md
  schema_deliverable: phase-5-canonical-schema.md
  prerequisite_gate: pnpm run phase-4:gate
  closure_gate: pnpm run phase-5:gate
  scores_2026_06_04:
    doc_navigation: 100
    scaffold: 43
    behavioral: 29
  forbid_T0:
    - phase-5/phase-5-ai-exec.layer4.md
    - research/phase-5-data-architecture-research.md body
```

## Subphases

| ID  | Module                                                                                           | Repo status       |
| --- | ------------------------------------------------------------------------------------------------ | ----------------- |
| 5.0 | [`phase-5/subphases/5.0-entry-gate.md`](phase-5/subphases/5.0-entry-gate.md)                     | PARTIAL           |
| 5.1 | [`phase-5/subphases/5.1-canonical-schema.md`](phase-5/subphases/5.1-canonical-schema.md)         | VERIFIED scaffold |
| 5.2 | [`phase-5/subphases/5.2-plugin-validation.md`](phase-5/subphases/5.2-plugin-validation.md)       | **VERIFIED**      |
| 5.3 | [`phase-5/subphases/5.3-projections.md`](phase-5/subphases/5.3-projections.md)                   | SPEC_ONLY         |
| 5.4 | [`phase-5/subphases/5.4-transactional-outbox.md`](phase-5/subphases/5.4-transactional-outbox.md) | SPEC_ONLY         |
| 5.5 | [`phase-5/subphases/5.5-audit-events.md`](phase-5/subphases/5.5-audit-events.md)                 | SPEC_ONLY         |
| 5.6 | [`phase-5/subphases/5.6-phase-gate.md`](phase-5/subphases/5.6-phase-gate.md)                     | PARTIAL           |

## Agent boot (authoritative)

```yaml
AGENT_BOOT:
  manifest: phase-5/appendices/BOOT-MANIFEST.yaml
  deprecated: phase-5/appendices/DEPRECATED-ENTRYPOINTS.md
  router: phase-5/phase-5-agent-router.md
fail_token: FAIL
doc_execution_system_score: 96
composite_doc_score: 95
```

## Core modules

| Module         | File                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Precision pack | [`phase-5/appendices/PRECISION-DOC-INDEX.md`](phase-5/appendices/PRECISION-DOC-INDEX.md)           |
| RULE-\* · DoD  | [`phase-5/phase-5-enforcement.md`](phase-5/phase-5-enforcement.md)                                 |
| CI             | [`phase-5/ci.md`](phase-5/ci.md)                                                                   |
| Research (T3)  | [`research/phase-5-data-architecture-research.md`](research/phase-5-data-architecture-research.md) |
