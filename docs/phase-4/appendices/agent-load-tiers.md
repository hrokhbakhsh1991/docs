# Phase 4 — Agent load tiers (deterministic)

> **SOLE EXECUTION ENTRY:** [`../phase-4-ai-exec.md`](../phase-4-ai-exec.md) — index/stub files are **link-only**.  
> **RULE:** Load only the tier required for the current task. **FAIL** if loading narrative overview for code execution.

```yaml
load_tiers:
  T0_execution:
    when: "implementing or validating a subphase"
    files:
      - docs/phase-4/phase-4-ai-exec.md
      - docs/phase-4/subphases/{current_subphase}.md
      - docs/phase-4/phase-4-enforcement.md#forbidden-actions
      - docs/phase-4/audits/verification-matrix.md
      - docs/phase-4/appendices/verification-commands.md
      - docs/phase-4/appendices/legacy-structure-bridge.md
      - docs/phase-4/appendices/subphase-completion-schema.md
      - docs/phase-4/appendices/workspace-interoperability-model.md
      - docs/phase-4/audits/IMPLEMENTATION-TRUTH.md
      - docs/phase-4/appendices/anti-hollow-contract.md
      - docs/phase-4/appendices/PRECISION-DOC-INDEX.md
      - docs/phase-4/audits/SUBPHASE-READY-SPEC.md
      - docs/phase-4/appendices/p4-e-command-atlas.md
      - docs/phase-4/appendices/test-inventory.md
    forbid:
      - docs/phase-4/phase-4-overview.md
      - docs/phase-4-tenant-kernel.md
  T1_gate:
    when: "debugging CI or closure 4.6"
    add:
      - docs/phase-4/audits/CLOSURE-CHECKLIST.md
      - docs/phase-4/audits/PHASE-4-GAP-REGISTER.md
      - docs/phase-4/ci.md
      - docs/phase-4/phase-4-guard.md
      - docs/phase-4/subphases/4.6-phase-gate.md
  T2_context:
    when: "architecture dispute or enterprise rules only"
    add:
      - docs/phase-4/phase-4-overview.md
      - docs/phase-4/phase-4-state-machine.md
      - docs/phase-4/appendices/dependency-graph.md
  T3_human:
    when: "product narrative for humans — never for agent execution"
    files:
      - docs/phase-4-tenant-kernel.md
      - docs/phase-4-tenant-kernel.mdoc

fail_token: FAIL
fail_if:
  - "T0 task loads phase-4-overview.md"
  - "closure uses grep without P4-E-* tests"
  - "merge 4.1+ without reports/phase-3.2-red-flag-status-*.md"
```

## Boot sequence (T0)

```yaml
agent_boot_T0:
  - action: READ audits/IMPLEMENTATION-TRUTH.md
    rule: "step 0 — pick first non-VERIFIED subphase"
  - action: ASSERT phase_id == "4"
    source: phase-4-ai-exec.md document_meta
  - action: ASSERT phase_detection_blocker == null
  - action: RUN pnpm run phase-3:gate
    expect_exit: 0
  - action: SET current_subphase from state or default "4.0"
  - action: LOAD subphases/{current_subphase}.md
  - action: READ forbidden_phase_4
  - action: RUN tests per p4_e_ids in subphase header
  - action: ON subphase 4.2 READ appendices/storage-driver-truth.md
  - action: ON 4.6 READ audits/CLOSURE-CHECKLIST.md
  - action: ON 4.6 RUN pnpm run phase-4:gate
    expect_exit: 0
  - action: SCAN appendices/future-risk-signals.md
    when: "subphase >= 4.2"
    rule: P4-R-RISK-01
```
