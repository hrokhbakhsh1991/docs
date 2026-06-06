# Phase 5 — Agent load tiers

> **SOLE ENTRY:** [`../phase-5-agent-router.md`](../phase-5-agent-router.md)

```yaml
load_tiers:
  T0_execution:
    when: "implementing or validating a subphase"
    files:
      - docs/phase-5/phase-5-agent-router.md
      - docs/phase-5/subphases/{current_subphase}.md
      - docs/phase-5/phase-5-enforcement.md
      - docs/phase-5/audits/verification-matrix.md
      - docs/phase-5/audits/IMPLEMENTATION-TRUTH.md
      - docs/phase-5/appendices/blockers.md
      - docs/phase-5/appendices/verification-commands.md
      - docs/phase-5/appendices/anti-hollow-contract.md
      - docs/phase-5/appendices/phase-4-bridge.md
      - docs/phase-5/appendices/industry-alignment-2026.md
      - docs/phase-5/appendices/platform-continuity-0-5.md
      - docs/phase-5/appendices/workspace-data-layer-model.md
      - docs/phase-5/appendices/PRECISION-DOC-INDEX.md
      - docs/phase-5/audits/SUBPHASE-READY-SPEC.md
      - docs/phase-5/appendices/test-inventory.md
    forbid:
      - docs/phase-5/phase-5-ai-exec.layer4.md
      - docs/research/phase-5-data-architecture-research.md
      - docs/phase-5/phase-5-overview.md
  T1_gate:
    when: "5.6 closure or CI debug"
    add:
      - docs/phase-5/audits/CLOSURE-CHECKLIST.md
      - docs/phase-5/audits/PHASE-5-GAP-REGISTER.md
      - docs/phase-5/ci.md
      - docs/phase-5/phase-5-guards.md
      - docs/phase-5/subphases/5.6-phase-gate.md
  T2_context:
    when: "architecture dispute or action lookup bulk"
    add:
      - docs/phase-5/phase-5-overview.md
      - docs/phase-5/phase-5-state-machine.md
      - docs/phase-5/phase-5-ai-exec.layer4.md
      - docs/research/phase-5-data-architecture-research.md
  T3_human:
    when: "product narrative — never for agent execution"
    files:
      - docs/research/phase-5-data-architecture-research.md

fail_if:
  - "T0 loads layer4 monolith"
  - "T0 marks PASS while IMPLEMENTATION-TRUTH is BLOCKER or HOLLOW"
```

```yaml
agent_boot_T0:
  include: appendices/BOOT-MANIFEST.yaml#boot_sequence_T0
  note: "Do not duplicate boot steps here — edit BOOT-MANIFEST only"
```
