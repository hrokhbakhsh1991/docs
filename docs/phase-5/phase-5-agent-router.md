# AI-EXECUTION ROUTER — Phase 5 (SOLE ENTRY)

```yaml
document_meta:
  optimization_version: "2026-06-04"
  readability_target: "100_doc_pre_code"
  precision_doc_pack: appendices/PRECISION-DOC-INDEX.md
  gap_register: audits/PHASE-5-GAP-REGISTER.md
  closure_checklist: audits/CLOSURE-CHECKLIST.md
  phase_id: "5"
  phase_name: "Canonical Data Architecture — Data Layer Standard"
  sole_execution_entry: true
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-4:gate
  closure_gate: pnpm run phase-5:gate
  schema_deliverable: ../phase-5-canonical-schema.md
  binding: REPO_SCRIPTS_OVER_STALE_MD
  load_tiers: appendices/agent-load-tiers.md
  knowledge_index: appendices/knowledge-index.md
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  implementation_decisions: appendices/IMPLEMENTATION-DECISIONS.md
  anti_hollow: appendices/anti-hollow-contract.md
  blockers: appendices/blockers.md
  verification_commands: appendices/verification-commands.md
  completion_schema: appendices/subphase-completion-schema.md
  phase4_bridge: appendices/phase-4-bridge.md
  industry_alignment_2026: appendices/industry-alignment-2026.md
  platform_continuity_0_5_canonical: ../../appendices/PLATFORM-CONTINUITY-0-5.md
  platform_continuity_0_5: appendices/platform-continuity-0-5.md
  cross_phase_entry_map: appendices/CROSS-PHASE-ENTRY-MAP.md
  phase_0_3_bridge: appendices/phase-0-3-bridge.md
  workspace_data_layer: appendices/workspace-data-layer-model.md
  boot_manifest: appendices/BOOT-MANIFEST.yaml
  deprecated_entrypoints: appendices/DEPRECATED-ENTRYPOINTS.md
```

> **SOLE EXECUTION ENTRY** — implement Phase 5 **only** from this file + `subphases/*.md` + [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).  
> **Forbidden T0/T1:** See [`appendices/DEPRECATED-ENTRYPOINTS.md`](appendices/DEPRECATED-ENTRYPOINTS.md) — includes `phase-5-ai-exec.layer4.md`, `agent-contract.md`, research body, `*.skeleton.md`.  
> **Layer 4:** [`phase-5-ai-exec.layer4.md`](phase-5-ai-exec.layer4.md) — **ARCHIVE / T2 lookup only** (not canonical SoT)

---

## AGENT_START_SEQUENCE

> **Canonical list:** [`appendices/BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml) `boot_sequence_T0` — do not use alternate boot orders in other files.

```yaml
AGENT_START_SEQUENCE:
  manifest: appendices/BOOT-MANIFEST.yaml
  0_implementation_truth:
    action: READ audits/IMPLEMENTATION-TRUTH.md
    rule: "Use repo_status enum VERIFIED_SCAFFOLD | VERIFIED_BEHAVIORAL; doc_navigation_100 != phase closed"
  1_implementation_decisions:
    action: READ appendices/IMPLEMENTATION-DECISIONS.md
    when: before_subphase_gte "5.3"
  1_implementation_map:
    action: READ appendices/IMPLEMENTATION-MAP.md
  2_precision_pack:
    action: READ appendices/PRECISION-DOC-INDEX.md
    action2: READ audits/SUBPHASE-READY-SPEC.md
    action3: READ appendices/test-inventory.md
  3_sole_entry:
    action: ASSERT reading phase-5-agent-router.md
    forbid_load: appendices/DEPRECATED-ENTRYPOINTS.md#forbidden
  4_phase_detection:
    assert: { phase_id: "5", phase_detection_blocker: null }
  5_blocker_scan:
    action: READ appendices/blockers.md
  6_prerequisite:
    run: pnpm run phase-4:gate
    expect_exit: 0
  7_continuity:
    action: READ ../../appendices/PLATFORM-CONTINUITY-0-5.md
    action2: READ appendices/platform-continuity-0-5.md
    action3: READ appendices/workspace-data-layer-model.md
    when_subphase_5_0: READ appendices/CROSS-PHASE-ENTRY-MAP.md
  8_detect_subphase:
    algorithm: detect_current_subphase
    manifest_ref: BOOT-MANIFEST.yaml#detect_current_subphase
  9_execute:
    load: subphases/{current_subphase}.md
    commands: appendices/verification-commands.md
    validate: audits/verification-matrix.md
  9b_cross_cutting:
    action: READ appendices/cross-cutting-actions.md
    when: once_per_pr
  10_closure:
    when: current_subphase == "5.6"
    read: audits/CLOSURE-CHECKLIST.md
    run: pnpm run phase-5:gate
```

```yaml
detect_current_subphase:
  # Deterministic — two agents with same IMPLEMENTATION-TRUTH get same current_subphase
  pick_rule: min_numeric_id_among_eligible
  steps:
    - if: "5.0 or 5.1 not in {VERIFIED_SCAFFOLD, VERIFIED_BEHAVIORAL}"
      then: "current = lowest among {5.0,5.1} not verified"
    - if: "5.2 != VERIFIED_BEHAVIORAL"
      then: "current = 5.2"
    - if: "eligible = {5.3,5.5} not VERIFIED_BEHAVIORAL; eligible non-empty"
      then: "current = min(eligible)"
    - if: "5.4 != VERIFIED_BEHAVIORAL and 5.2 == VERIFIED_BEHAVIORAL"
      then: "current = 5.4"
    - if: "5.2..5.5 all VERIFIED_BEHAVIORAL"
      then: "current = 5.6"
  parallel_after_5_1: ["5.2", "5.3", "5.5"]
  serial_after_5_2: ["5.4"]
  multi_agent: "PR label Phase:5.N must match current; FAIL on concurrent same subphase"
```

---

## RULE — DAG

```yaml
dag:
  nodes: [P5-0, P5-1, P5-2, P5-3, P5-4, P5-5, P5-6]
  edges:
    - { from: "5.0", to: "5.1", type: hard }
    - { from: "5.1", to: "5.2", type: hard }
    - { from: "5.1", to: "5.3", type: hard, parallel: true }
    - { from: "5.1", to: "5.5", type: hard, parallel: true }
    - { from: "5.2", to: "5.4", type: hard, note: "5.4 START requires 5.2 VERIFIED_BEHAVIORAL" }
    - { from: "5.1", to: "5.4", type: prereq_only, note: "DDL only — do not start 5.4 until 5.2 behavioral PASS" }
    - { from: "5.2", to: "5.6", type: hard }
    - { from: "5.3", to: "5.6", type: hard }
    - { from: "5.4", to: "5.6", type: hard }
    - { from: "5.5", to: "5.6", type: hard }
forbidden_transitions:
  - { action: start_5.1, before: 5.0 PASS }
  - { action: start_5.4, before: 5.2 PASS }
  - { action: in_process_bus_only, enforcement: FORBIDDEN-006 }
  - { action: merge_5.6, before: [5.2, 5.3, 5.4, 5.5] PASS }
```

```text
5.0 → 5.1 → 5.2 → 5.4 ─┐
              ├→ 5.3 ∥ 5.5 ┴→ 5.6
```

**Map:** [`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md)

---

## ACTION — Subphases

| Subphase | Module                                                               | DAG  |
| -------- | -------------------------------------------------------------------- | ---- |
| 5.0      | [5.0-entry-gate.md](subphases/5.0-entry-gate.md)                     | P5-0 |
| 5.1      | [5.1-canonical-schema.md](subphases/5.1-canonical-schema.md)         | P5-1 |
| 5.2      | [5.2-plugin-validation.md](subphases/5.2-plugin-validation.md)       | P5-2 |
| 5.3      | [5.3-projections.md](subphases/5.3-projections.md)                   | P5-3 |
| 5.4      | [5.4-transactional-outbox.md](subphases/5.4-transactional-outbox.md) | P5-4 |
| 5.5      | [5.5-audit-events.md](subphases/5.5-audit-events.md)                 | P5-5 |
| 5.6      | [5.6-phase-gate.md](subphases/5.6-phase-gate.md)                     | P5-6 |

```yaml
actions:
  - action: LOAD_CURRENT_SUBPHASE
    path: subphases/{current_subphase}.md
  - action: EXECUTE_STEPS
    index: audits/execution-action-index.md
  - action: VALIDATE
    matrix: audits/verification-matrix.md
  - action: UPDATE_TRUTH
    ledger: audits/IMPLEMENTATION-TRUTH.md
```

---

## RULE — Anti-hollow & blockers (mandatory)

```yaml
rules:
  - id: P5-R-HOLLOW-01
    doc: appendices/anti-hollow-contract.md
    workflow: AGENT_WORKFLOW_LINEAR
  - id: P5-R-BLOCKER-01
    forbid: "mark 5.1 DDL PASS while docs/phase-5-canonical-schema.md missing"
    blocker: BLOCKER-P5-001
  - id: P5-R-BLOCKER-02
    forbid: "claim phase-5:gate PASS while 5.2–5.5 not VERIFIED or phase-4:gate fails"
  - id: P5-R-SCORE-100
    require: "IMPLEMENTATION-TRUTH all VERIFIED + real phase-5:gate + contract spec"
```

---

## Constraint modules

| Set                  | File                                             |
| -------------------- | ------------------------------------------------ |
| REQ-P5-\*            | [phase-5-enforcement.md](phase-5-enforcement.md) |
| p5\_\* (when exists) | [phase-5-guards.md](phase-5-guards.md)           |
| CI                   | [ci.md](ci.md)                                   |
| ADR-005              | [appendices/adr-005.md](appendices/adr-005.md)   |

**Reports:** [AI-READABILITY-REPORT.md](AI-READABILITY-REPORT.md) · [IMPLEMENTATION-TRUTH](audits/IMPLEMENTATION-TRUTH.md) · [IMPLEMENTATION-MAP](appendices/IMPLEMENTATION-MAP.md)

---

## Implementation status (repo snapshot)

| Subphase | Status              | Doc module                                                                                                     |
| -------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| 5.0      | PARTIAL             | [5.0-entry-gate.md](subphases/5.0-entry-gate.md)                                                               |
| 5.1      | VERIFIED (scaffold) | [5.1-canonical-schema.md](subphases/5.1-canonical-schema.md)                                                   |
| 5.2      | **VERIFIED**        | [5.2-plugin-validation.md](subphases/5.2-plugin-validation.md) · [schema §4.1](../phase-5-canonical-schema.md) |
| 5.3      | SPEC_ONLY           | [5.3-projections.md](subphases/5.3-projections.md)                                                             |
| 5.4      | SPEC_ONLY           | [5.4-transactional-outbox.md](subphases/5.4-transactional-outbox.md)                                           |
| 5.5      | SPEC_ONLY           | [5.5-audit-events.md](subphases/5.5-audit-events.md)                                                           |
| 5.6      | PARTIAL             | [5.6-phase-gate.md](subphases/5.6-phase-gate.md)                                                               |

```yaml
next_typical_work: "detect_current_subphase → typically 5.3 or 5.5 (parallel) then 5.4"
doc_system_score_2026_06_04_v2: 96
scores:
  { doc_navigation: 100, doc_execution_system: 96, composite_doc: 95, scaffold: 43, behavioral: 29 }
```
