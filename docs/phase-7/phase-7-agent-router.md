# AI-EXECUTION ROUTER — Phase 7 (SOLE ENTRY)

```yaml
document_meta:
  phase_id: "7"
  phase_name: "Second workspace + platform hardening"
  sole_execution_entry: true
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-6:gate
  closure_gate: pnpm run phase-7:gate
  human_narrative: ../phase-7-platform-dod.md
  boot_manifest: appendices/BOOT-MANIFEST.yaml
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  implementation_decisions: appendices/IMPLEMENTATION-DECISIONS.md
  implementation_map: appendices/IMPLEMENTATION-MAP.md
  phase6_bridge: appendices/phase-6-bridge.md
  platform_continuity: ../../appendices/PLATFORM-CONTINUITY-0-7.md
  verification_matrix: audits/verification-matrix.md
  industry_alignment: appendices/industry-alignment-2026.md
  state_machine: phase-7-state-machine.md
  research_T3: ../../research/phase-7-workspace-hardening-research.md
```

> **SOLE EXECUTION ENTRY** — Phase 7 only from this file + `subphases/*.md` + [`BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  manifest: appendices/BOOT-MANIFEST.yaml
  0_truth: READ audits/IMPLEMENTATION-TRUTH.md
  1_decisions: READ appendices/IMPLEMENTATION-DECISIONS.md
  2_map: READ appendices/IMPLEMENTATION-MAP.md
  3_assert: ASSERT reading phase-7-agent-router.md
  4_prerequisite: run pnpm run phase-6:gate
  5_detect: detect_current_subphase per BOOT-MANIFEST
  6_execute: load subphases/{current}.md + phase-7-enforcement.md
  7_closure:
    when: "7.9"
    run: pnpm run phase-7:gate
```

## Architectural invariants (FAIL if violated)

```yaml
invariants:
  - "No URBAN_* constants in apps/api generic layer"
  - "No platform-core PR required for urban-only registry/widgets"
  - "urban resolves via WorkspacePlugin registry — not Denali rail"
  - "Observability + rate limits in generic API layer — not urban-only branches"
  - "TenantConnectionRouter in tenant-kernel — not apps/api ad-hoc URLs"
  - "legacy/ is read-only reference — no runtime import from legacy in trunk apps"
```

## Subphase index

| ID  | Doc                                                            | MAP          |
| --- | -------------------------------------------------------------- | ------------ |
| 7.0 | [`subphases/7.0-entry-gate.md`](subphases/7.0-entry-gate.md)   | phase-6:gate |
| 7.1 | [`7.1-urban-package.md`](subphases/7.1-urban-package.md)       | 7.1          |
| 7.2 | [`7.2-genericity-proof.md`](subphases/7.2-genericity-proof.md) | 7.2          |
| 7.3 | [`7.3-bootstrap.md`](subphases/7.3-bootstrap.md)               | 7.3          |
| 7.4 | [`7.4-urban-e2e.md`](subphases/7.4-urban-e2e.md)               | 7.4          |
| 7.5 | [`7.5-observability.md`](subphases/7.5-observability.md)       | 7.5          |
| 7.6 | [`7.6-rate-limits.md`](subphases/7.6-rate-limits.md)           | 7.6          |
| 7.7 | [`7.7-tenant-router.md`](subphases/7.7-tenant-router.md)       | 7.7          |
| 7.8 | [`7.8-adversarial.md`](subphases/7.8-adversarial.md)           | 7.8          |
| 7.9 | [`7.9-platform-gate.md`](subphases/7.9-platform-gate.md)       | closure      |
