# AI-EXECUTION DOCUMENT — Phase 4 (agent router)

```yaml
document_meta:
  optimization_version: "2026-06-04"
  readability_target: "100_doc_pre_code"
  precision_doc_pack: appendices/PRECISION-DOC-INDEX.md
  closure_checklist: audits/CLOSURE-CHECKLIST.md
  workspace_interop: appendices/workspace-interoperability-model.md
  industry_alignment: appendices/industry-alignment-2026.md
  phase_id: "4"
  phase_name: "Tenant Kernel & Multi-Tenant Enterprise Boundary"
  phase_detection_blocker: null
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-3:gate
  closure_gate: pnpm run phase-4:gate
  binding: REPO_SCRIPTS_OVER_STALE_MD
  sole_execution_entry: true
  load_tiers: appendices/agent-load-tiers.md
  knowledge_index: appendices/knowledge-index.md
  legacy_bridge: appendices/legacy-structure-bridge.md
  verification_commands: appendices/verification-commands.md
  completion_schema: appendices/subphase-completion-schema.md
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  gap_register: audits/PHASE-4-GAP-REGISTER.md
  closure_checklist: audits/CLOSURE-CHECKLIST.md
  storage_driver_truth: appendices/storage-driver-truth.md
  subphase_ready_spec: audits/SUBPHASE-READY-SPEC.md
  p4_e_command_atlas: appendices/p4-e-command-atlas.md
  test_inventory: appendices/test-inventory.md
  env_matrix: appendices/env-runtime-matrix.md
  agent_faq: appendices/agent-faq.md
  anti_hollow: appendices/anti-hollow-contract.md
```

> **SOLE EXECUTION ENTRY** — agents implement Phase 4 **only** from this file + current `subphases/*.md`.  
> **Index / stub:** link tables only — [`phase-4.ai-exec.index.md`](phase-4.ai-exec.index.md) · [`../phase-4-tenant-kernel.ai-exec.md`](../phase-4-tenant-kernel.ai-exec.md)  
> **Human only (T3):** [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md) — **non-authoritative for execution**

---

## AGENT_START_SEQUENCE (canonical — do not duplicate elsewhere)

```yaml
AGENT_START_SEQUENCE:
  0_implementation_truth:
    action: READ audits/IMPLEMENTATION-TRUTH.md
    rule: "Pick FIRST subphase not VERIFIED — no repo-wide analysis before this"
  0a_precision_pack:
    action: READ appendices/PRECISION-DOC-INDEX.md
    action2: READ audits/SUBPHASE-READY-SPEC.md#current_subphase
    rule: "Pre-code doc complete — then subphase md"
  0b_gap_register:
    action: READ audits/PHASE-4-GAP-REGISTER.md
    when: "architecture dispute or score confusion"
  1_sole_entry:
    action: ASSERT reading phase-4-ai-exec.md
    forbid_load: [phase-4-overview.md, phase-4-tenant-kernel.md]
  2_phase_detection:
    assert: { phase_id: "4", phase_detection_blocker: null }
    rules: [P4-R-DET-01, P4-R-DET-02]
  3_prerequisite:
    run: pnpm run phase-3:gate
    expect_exit: 0
    rule: P4-R-DET-03
  4_legacy_guard:
    action: READ appendices/legacy-structure-bridge.md
    rule: "implement in app-tour root — legacy/ reference only"
  4b_workspace_interop:
    action: READ appendices/workspace-interoperability-model.md
    rule: "tenant boundary Phase 4 ≠ workspace plugin Phase 3/6 — do not merge specs"
  5_detect_subphase:
    action: EVALUATE completion_proof per subphases/4.0→4.6
    algorithm: detect_current_subphase
    default_if_all_unknown: "4.0"
  6_execute:
    load: subphases/{current_subphase}.md
    commands: appendices/verification-commands.md
    validate: audits/verification-matrix.md + completion_proof in subphase file
  7_closure:
    when: current_subphase == "4.6"
    read: audits/CLOSURE-CHECKLIST.md
    run: pnpm run phase-4:gate
    scan: appendices/future-risk-signals.md
    rule: P4-R-RISK-01
```

```yaml
detect_current_subphase:
  order: ["4.0", "4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]
  rule: "FIRST subphase where completion_proof.all_required != PASS"
  notes:
    - "4.4 and 4.5 may be in progress in parallel after 4.2 — 4.6 requires 4.3 AND 4.4 AND 4.5"
    - "4.0 uses track mode — see subphase-completion-schema.md"
  proofs_ref: "subphases/{id}.md → completion_proof"
  before_4_1:
    require: reports/phase-3.2-red-flag-status-*.md
    rule: P4-R-DET-04
```

---

## RULE — Phase detection

```yaml
rules:
  - id: P4-R-DET-01
    assert: phase_id == "4"
    on_fail: FAIL
  - id: P4-R-DET-02
    assert: phase_detection_blocker == null
    on_fail: FAIL
  - id: P4-R-DET-03
    run: pnpm run phase-3:gate
    expect_exit: 0
    on_fail: FAIL
  - id: P4-R-DET-04
    before_subphase: "4.1"
    require: reports/phase-3.2-red-flag-status-*.md exists
    enforcement: P4-E-RF-40
    on_fail: FAIL
```

---

## RULE — DAG (no narrative)

```yaml
dag:
  nodes: [P4-0, P4-1, P4-2, P4-3, P4-4, P4-5, P4-6]
  edges:
    - { from: "4.0", to: "4.1", type: hard }
    - { from: "4.1", to: "4.2", type: hard }
    - { from: "4.2", to: "4.3", type: hard }
    - { from: "4.2", to: "4.4", type: hard, parallel: true }
    - { from: "4.2", to: "4.5", type: hard, parallel: true }
    - { from: "4.3", to: "4.6", type: hard }
    - { from: "4.4", to: "4.6", type: hard }
    - { from: "4.5", to: "4.6", type: hard }
forbidden_transitions:
  - { action: start_4.2, before: 4.0 PASS, enforcement: P4-E-RF-40 }
  - { action: start_4.1, before: 4.0 PASS, enforcement: P4-E-RF-40 }
  - { action: merge_4.6, before: [4.3, 4.4, 4.5] PASS }
  - { action: outbox_table, phase: 4, enforcement: forbidden_phase_4 }
```

```text
4.0 → 4.1 → 4.2 → 4.3 → 4.6
              ├→ 4.4 ∥ 4.5
```

**Map:** [`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md)

---

## ACTION — Subphase execution

```yaml
actions:
  - action: LOAD_CURRENT_SUBPHASE
    path: subphases/{current_subphase}.md
  - action: EXECUTE_STEPS
    index: audits/execution-action-index.md
    order: sequential per subphase
  - action: VALIDATE
    matrix: audits/verification-matrix.md
    ids: p4_e_ids from subphase header
  - action: CLOSURE
    when: current_subphase == "4.6"
    run: pnpm run phase-4:gate
    expect_exit: 0
    enforcement: P4-E-GATE
```

| Subphase | Module | DAG |
|----------|--------|-----|
| 4.0 | [4.0-gate-of-gates.md](subphases/4.0-gate-of-gates.md) | P4-0 |
| 4.1 | [4.1-tenant-kernel.md](subphases/4.1-tenant-kernel.md) | P4-1 |
| 4.2 | [4.2-postgres-rls.md](subphases/4.2-postgres-rls.md) | P4-2 |
| 4.3 | [4.3-provisioning.md](subphases/4.3-provisioning.md) | P4-3 |
| 4.4 | [4.4-tenant-theme.md](subphases/4.4-tenant-theme.md) | P4-4 |
| 4.5 | [4.5-platform-events.md](subphases/4.5-platform-events.md) | P4-5 |
| 4.6 | [4.6-phase-gate.md](subphases/4.6-phase-gate.md) | P4-6 |

---

## CONSTRAINT — Enforcement modules

| Constraint set | File |
|----------------|------|
| P4-E-* | [phase-4-enforcement.md](phase-4-enforcement.md) |
| p4_* | [phase-4-guard.md](phase-4-guard.md) |
| CI | [ci.md](ci.md) |
| Forbidden | [phase-4-enforcement.md](phase-4-enforcement.md) `forbidden_phase_4` |
| Phase 5 entry | [phase-4-enforcement.md](phase-4-enforcement.md) `phase_5_entry_requires` |

---

## RULE — Anti-hollow (mandatory)

```yaml
rules:
  - id: P4-R-HOLLOW-01
    action: READ appendices/anti-hollow-contract.md
    workflow: AGENT_WORKFLOW_LINEAR
    on_fail: FAIL
  - id: P4-R-HOLLOW-02
    forbid: "mark subphase PASS without RUN prove_with exit 0"
  - id: P4-R-HOLLOW-03
    forbid: "tests with empty body or assert-less it() for P4-E-*"
  - id: P4-R-HOLLOW-04
    guard: p4_anti_hollow_tests
    when: "phase-4:guard or phase-4:gate"
  - id: P4-R-SCORE-100
    claim: "execution score 100"
    require: "IMPLEMENTATION-TRUTH all subphases VERIFIED + phase-4:gate green"
```

---

## RULE — Pre-closure risk scan (advisory)

```yaml
rules:
  - id: P4-R-RISK-01
    when: "current_subphase == 4.6 OR PR touches tenant-kernel | platform-events | rls | tenant-security"
    action: SCAN
    module: appendices/future-risk-signals.md
    expect: "no unmitigated critical signals in diff"
    on_fail: "annotate PR — do not skip P4-E-* validation"
    note: "Signals are advisory; P4-E-* remains sole merge proof"
```

---

## Reports

- [MODERNIZATION-REPORT.md](MODERNIZATION-REPORT.md)
- [AI-READABILITY-REPORT.md](AI-READABILITY-REPORT.md)
- [FUTURE-PROOFING-REPORT.md](FUTURE-PROOFING-REPORT.md)
