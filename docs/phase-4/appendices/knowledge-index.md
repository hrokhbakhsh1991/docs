# Phase 4 — Knowledge ownership index

> **RULE:** Each fact has exactly one **SOURCE OF TRUTH** file. Do not duplicate; link instead.

```yaml
knowledge_ownership:
  phase_detection:
    owner: phase-4-overview.md#step-1--phase-detection-complete
    agent_mirror: phase-4-ai-exec.md#phase-detection
  dag_edges:
    owner: phase-4-state-machine.md#subphase-dag
    agent_mirror: audits/subphase-enforcement-map.md
  forbidden_actions:
    owner: phase-4-enforcement.md#forbidden-actions
  p4_e_claims:
    owner: phase-4-enforcement.md#verification-table
  p4_e_to_p4_guard:
    owner: audits/verification-matrix.md
  p4_guard_scripts:
    owner: phase-4-guard.md
  ci_pipeline:
    owner: ci.md
  subphase_steps:
    owner: subphases/{id}.md
  action_id_index:
    owner: audits/execution-action-index.md
  enterprise_rules:
    owner: phase-4-overview.md#section-2
    agent_rule: "load only T2 — not for daily execution"
  dependency_edges:
    owner: appendices/dependency-graph.md
  test_scenarios:
    owner: appendices/test-matrix.md
  observability_scaffold:
    owner: appendices/observability.md
  phase_5_handoff:
    owner: phase-4-enforcement.md#phase-5-entry-checklist
  doc_drift_retired:
    owner: phase-4.ai-exec.index.md#doc_drift_register
  workspace_interoperability:
    owner: appendices/workspace-interoperability-model.md
    agent_rule: "T0 — tenant vs workspace axes before any 4.x implementation"
  industry_alignment_2026:
    owner: appendices/industry-alignment-2026.md
    agent_rule: "T2 — external pattern justification"
  phase_5_entry_modular:
    owner: phase-4-enforcement.md phase_5_entry_requires_modular
  traceability_chain:
    owner: audits/TRACEABILITY-MATRIX.md
  consistency_audit:
    owner: audits/CONSISTENCY-REPORT.md
  future_architecture_review:
    owner: FUTURE-PROOFING-REPORT.md
  future_risk_signals:
    owner: appendices/future-risk-signals.md
    agent_rule: "scan before 4.6 per phase-4-ai-exec.md P4-R-RISK-01"
  sole_execution_entry:
    owner: phase-4-ai-exec.md
    agent_rule: "index and tenant-kernel.ai-exec are link-only — FAIL if boot duplicated"
  verification_commands:
    owner: appendices/verification-commands.md
  legacy_structure_bridge:
    owner: appendices/legacy-structure-bridge.md
  subphase_completion_proof:
    owner: appendices/subphase-completion-schema.md
    per_subphase: subphases/{id}.md completion_proof block
  implementation_truth:
    owner: audits/IMPLEMENTATION-TRUTH.md
    agent_rule: "READ before any implementation — score 100 when all VERIFIED"
  gap_register:
    owner: audits/PHASE-4-GAP-REGISTER.md
    agent_rule: "7 gaps — doc vs repo; honest scores"
  closure_checklist:
    owner: audits/CLOSURE-CHECKLIST.md
    agent_rule: "4.6 mandatory read before phase-4:gate claim"
  storage_driver:
    owner: appendices/storage-driver-truth.md
    agent_rule: "STORAGE_DRIVER=prisma — not TOUR_STORAGE"
  precision_doc_pack:
    owner: appendices/PRECISION-DOC-INDEX.md
    agent_rule: "Pre-code doc 100 — load before implementation"
  subphase_ready_spec:
    owner: audits/SUBPHASE-READY-SPEC.md
  p4_e_command_atlas:
    owner: appendices/p4-e-command-atlas.md
  test_inventory:
    owner: appendices/test-inventory.md
  env_runtime_matrix:
    owner: appendices/env-runtime-matrix.md
  agent_faq:
    owner: appendices/agent-faq.md
  phase_handoff_3_4_5:
    owner: appendices/phase-handoff-3-4-5.md
  forensic_scaffold:
    owner: audits/phase-4-zero-debt-forensic-audit.mdoc
    agent_rule: "PENDING until 4.6 — do not claim Closed"
  anti_hollow_contract:
    owner: appendices/anti-hollow-contract.md
  anti_hollow_guard:
    owner: scripts/guards/lib/anti-hollow-phase4.mjs
```

## Duplicate knowledge retired

| Retired duplicate | Canonical owner |
|-------------------|-----------------|
| §14.2 numbered guard table | phase-4-guard.md p4_* |
| CI steps in guard.md body | ci.md |
| Subphase DAG in overview only | state-machine + subphase-enforcement-map |
| Agent boot in 3 files | agent-load-tiers.md T0 |
