# AI-EXECUTION DOCUMENT — Phase 5 (canonical index)

**Modular layout:** [`README.md`](README.md) · **SOLE ENTRY:** [`phase-5-agent-router.md`](phase-5-agent-router.md) · **Do not load** research monolith at T0.

```yaml
document_meta:
  source_monolith: docs/research/phase-5-data-architecture-research.ai-exec.md
  source_research: docs/research/phase-5-data-architecture-research.md
  ai_exec_modules: docs/phase-5/
  central_stub: docs/phase-5-canonical-data.ai-exec.md
  transformation_version: "2026-06-04"
  modular_split_version: "2026-06-04"
  quality_report: docs/phase-5/QUALITY-VALIDATION.md
  structure_report: docs/phase-5/STRUCTURE-REPORT.md
  finalization_report: docs/phase-5/FINALIZATION-REPORT.md
  layer_1_initiator: docs/phase-5/phase-5-ai-exec.md
  sole_execution_entry: docs/phase-5/phase-5-agent-router.md
  boot_manifest: docs/phase-5/appendices/BOOT-MANIFEST.yaml
  layer_4_archive_stub: docs/phase-5/phase-5-ai-exec.layer4.md
  initiator_report: docs/phase-5/INITIATOR-REPORT.md
  phase_id: "5"
  phase_name: "Canonical Data Architecture — Data Layer Standard"
  phase_slug: phase-5-data-layer
  subphases: ["5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6"]
  phase_detection_blocker: null
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHEN_phase-5_gate_EXISTS
  architecture_change_allowed: false
  feature_invention_allowed: false
  adr_id: ADR-005
  adr_status: Proposed
  prerequisite_phase_id: "4"
  prerequisite_gate_command: pnpm run phase-4:gate
  closure_gate_command: pnpm run phase-5:gate
  closure_gate_chain: "pnpm build && pnpm test && pnpm run phase-4:gate && pnpm run phase-5:guard"
  canonical_markdoc: docs/phase-5-canonical-schema.mdoc
  schema_human_spec: docs/phase-5-canonical-schema.md
  alignment_appendices:
    - docs/phase-5/appendices/industry-alignment-2026.md
    - docs/phase-5/appendices/platform-continuity-0-5.md
    - docs/phase-5/appendices/workspace-data-layer-model.md
  implementation_map: docs/phase-5/appendices/IMPLEMENTATION-MAP.md
  precision_pack: docs/phase-5/appendices/PRECISION-DOC-INDEX.md
  map_refs:
    - docs/MIGRATION-MAP.md §6
    - docs/MIGRATION-MAP.md §10
    - docs/MIGRATION-MAP.md §11 Phase 5
    - docs/MIGRATION-MAP.md §12 Phase 5 checklist
  prerequisite_hubs_modular:
    - docs/phase-4/phase-4.ai-exec.index.md
    - docs/phase-3/phase-3.ai-exec.index.md
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "5"
phase_name: "Canonical Data Architecture — Data Layer Standard"
execution_domains:
  - id: DOM-P5-SCHEMA
    subphases: ["5.1"]
    focus: canonical_data JSONB migrations RLS extension
  - id: DOM-P5-VALIDATION
    subphases: ["5.2"]
    focus: plugin registry validate-before-persist
  - id: DOM-P5-PROJECTION
    subphases: ["5.3"]
    focus: sync projection columns indexed queries
  - id: DOM-P5-OUTBOX
    subphases: ["5.4"]
    focus: transactional outbox relay TourCreated
  - id: DOM-P5-AUDIT
    subphases: ["5.5"]
    focus: audit_events minimal
  - id: DOM-P5-GATE
    subphases: ["5.6"]
    focus: contract spec forensic closure
validation_domains:
  - id: VAL-P5-REQ
    source: audits/verification-matrix.md
  - id: VAL-P5-RULE
    source: phase-5-enforcement.md hard_rules
  - id: VAL-P5-SUBPHASE
    source: phase-5-enforcement.md subphase_dod
governance_domains:
  - id: GOV-P5-ADR
    source: appendices/adr-005.md
  - id: GOV-P5-BOUNDARY
    source: appendices/phase-boundaries.md
  - id: GOV-P5-BLOCKER
    source: appendices/blockers.md
  - id: GOV-P5-FORBIDDEN
    source: phase-5-enforcement.md forbidden_actions
phase_detection_blocker: null
```

---

## Module map (load by reference)

| Monolith section          | Classification | Module file                                                                                    |
| ------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| Phase Metadata            | INDEX          | this file `document_meta`                                                                      |
| Objectives · Deliverables | OVERVIEW       | [`phase-5-overview.md`](phase-5-overview.md)                                                   |
| Dependency Graph          | APPENDIX       | [`appendices/dependency-graph.md`](appendices/dependency-graph.md)                             |
| State Machine             | STATE          | [`phase-5-state-machine.md`](phase-5-state-machine.md)                                         |
| Execution DAG             | STATE          | [`phase-5-state-machine.md`](phase-5-state-machine.md#execution-dag)                           |
| Actions 5.0               | SUBPHASE       | [`subphases/5.0-entry-gate.md`](subphases/5.0-entry-gate.md)                                   |
| Actions 5.1               | SUBPHASE       | [`subphases/5.1-canonical-schema.md`](subphases/5.1-canonical-schema.md)                       |
| Actions 5.2               | SUBPHASE       | [`subphases/5.2-plugin-validation.md`](subphases/5.2-plugin-validation.md)                     |
| Actions 5.3               | SUBPHASE       | [`subphases/5.3-projections.md`](subphases/5.3-projections.md)                                 |
| Actions 5.4               | SUBPHASE       | [`subphases/5.4-transactional-outbox.md`](subphases/5.4-transactional-outbox.md)               |
| Actions 5.5               | SUBPHASE       | [`subphases/5.5-audit-events.md`](subphases/5.5-audit-events.md)                               |
| Actions 5.6               | SUBPHASE       | [`subphases/5.6-phase-gate.md`](subphases/5.6-phase-gate.md)                                   |
| Actions P5-X-\*           | EXECUTION      | [`appendices/cross-cutting-actions.md`](appendices/cross-cutting-actions.md)                   |
| Hard Rules                | ENFORCEMENT    | [`phase-5-enforcement.md`](phase-5-enforcement.md)                                             |
| Forbidden Actions         | ENFORCEMENT    | [`phase-5-enforcement.md`](phase-5-enforcement.md#forbidden-actions)                           |
| Validation Matrix         | AUDIT          | [`audits/verification-matrix.md`](audits/verification-matrix.md)                               |
| Definition of Done        | ENFORCEMENT    | [`phase-5-enforcement.md`](phase-5-enforcement.md#definition-of-done)                          |
| Agent Execution Contract  | INDEX          | [`phase-5-enforcement.md`](phase-5-enforcement.md#agent-failure-and-escalation) + central stub |
| Blockers                  | REFERENCE      | [`appendices/blockers.md`](appendices/blockers.md)                                             |
| Guards (derived)          | GUARDS         | [`phase-5-guards.md`](phase-5-guards.md)                                                       |
| Guards · CI               | GUARDS · CI    | [`phase-5-guards.md`](phase-5-guards.md) · [`ci.md`](ci.md)                                    |

---

## Subphase registry

| ID  | Name                           | DAG node | MAP item               |
| --- | ------------------------------ | -------- | ---------------------- |
| 5.0 | Entry gate                     | P5-0     | phase_5_entry_requires |
| 5.1 | canonical_data JSONB           | P5-1     | 5.1                    |
| 5.2 | Plugin validate before persist | P5-2     | 5.2                    |
| 5.3 | Sync projections               | P5-3     | 5.3                    |
| 5.4 | Transactional outbox           | P5-4     | 5.4 · §6 exit          |
| 5.5 | audit_events minimal           | P5-5     | 5.5                    |
| 5.6 | Phase gate + forensic          | P5-6     | §12 checklist          |

---

## Dependency registry

| ID                | Requires               | Module                                                                   |
| ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| DEP-P5-EXT-00..03 | Phases 0–3 closed      | [`appendices/dependency-graph.md`](appendices/dependency-graph.md)       |
| DEP-P5-EXT-04     | phase-4:gate           | [`../phase-4/phase-4-enforcement.md`](../phase-4/phase-4-enforcement.md) |
| DEP-P5-EXT-05     | phase_5_entry_requires | [`subphases/5.0-entry-gate.md`](subphases/5.0-entry-gate.md)             |
| P5-1              | P5-0                   | state-machine                                                            |
| P5-2,3,4,5        | P5-1                   | state-machine                                                            |
| P5-4              | P5-2                   | state-machine                                                            |
| P5-6              | P5-2,3,4,5             | state-machine                                                            |

---

## Traceability map

| Artifact      | Traces to                                                                    |
| ------------- | ---------------------------------------------------------------------------- |
| OBJ-P5-\*     | [`phase-5-overview.md`](phase-5-overview.md)                                 |
| DEL-P5-\*     | [`phase-5-overview.md`](phase-5-overview.md)                                 |
| P5-_-_-A\*    | subphases + [`appendices/action-registry.md`](appendices/action-registry.md) |
| RULE-\*       | [`phase-5-enforcement.md`](phase-5-enforcement.md)                           |
| FORBIDDEN-\*  | [`phase-5-enforcement.md`](phase-5-enforcement.md)                           |
| REQ-P5-\*     | [`audits/verification-matrix.md`](audits/verification-matrix.md)             |
| BLOCKER-P5-\* | [`appendices/blockers.md`](appendices/blockers.md)                           |

Full matrix: [`audits/traceability-map.md`](audits/traceability-map.md)

---

## Quality report

[`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md)

---

## AGENT START SEQUENCE

```yaml
agent_boot:
  include: appendices/BOOT-MANIFEST.yaml#boot_sequence_T0
  scorecard: audits/DOC-EXECUTION-SCORECARD.md
  fail_token: FAIL
```

**SOLE entry:** [`phase-5-agent-router.md`](phase-5-agent-router.md) · **Layer 4:** ARCHIVE stub only · **Scores:** [`audits/DOC-EXECUTION-SCORECARD.md`](audits/DOC-EXECUTION-SCORECARD.md)

See also: [`../phase-5-canonical-data.ai-exec.md`](../phase-5-canonical-data.ai-exec.md)
