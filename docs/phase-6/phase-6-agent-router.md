# AI-EXECUTION ROUTER — Phase 6 (SOLE ENTRY)

```yaml
document_meta:
  phase_id: "6"
  phase_name: "Denali Workspace — first product workspace"
  sole_execution_entry: true
  fail_token: FAIL
  prerequisite_gate: pnpm run phase-5:gate
  closure_gate: pnpm run phase-6:gate
  human_narrative: ../phase-6-denali-workspace.md
  boot_manifest: appendices/BOOT-MANIFEST.yaml
  implementation_truth: audits/IMPLEMENTATION-TRUTH.md
  implementation_decisions: appendices/IMPLEMENTATION-DECISIONS.md
  implementation_map: appendices/IMPLEMENTATION-MAP.md
  deprecated_entrypoints: appendices/DEPRECATED-ENTRYPOINTS.md
  phase5_bridge: appendices/phase-5-bridge.md
  platform_continuity: ../../appendices/PLATFORM-CONTINUITY-0-6.md
  verification_matrix: audits/verification-matrix.md
  industry_alignment: appendices/industry-alignment-2026.md
  research_T3: ../../research/phase-6-denali-workspace-research.md
```

> **SOLE EXECUTION ENTRY** — Phase 6 only from this file + `subphases/*.md` + [`BOOT-MANIFEST.yaml`](appendices/BOOT-MANIFEST.yaml).

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  manifest: appendices/BOOT-MANIFEST.yaml
  0_truth: READ audits/IMPLEMENTATION-TRUTH.md
  1_decisions: READ appendices/IMPLEMENTATION-DECISIONS.md
  2_map: READ appendices/IMPLEMENTATION-MAP.md
  3_assert: ASSERT reading phase-6-agent-router.md
  4_prerequisite: run pnpm run phase-5:gate
  5_detect: detect_current_subphase per BOOT-MANIFEST
  6_execute: load subphases/{current}.md + phase-6-enforcement.md
  7_closure:
    when: "6.9"
    run: pnpm run phase-6:gate
```

## Architectural invariants (FAIL if violated)

```yaml
invariants:
  - "No DENALI_* constants in apps/api generic layer"
  - "No platform-core PR required for Denali-only registry/widgets"
  - "denali resolves via WorkspacePlugin registry — not hard-coded starter"
  - "Finance/outbox consumers live in plugin or legacy port — not new core tables in apps/api"
  - "legacy/ is read-only reference — no runtime import from legacy in trunk apps"
```

## Subphase index

| ID  | Doc                                                              | MAP          |
| --- | ---------------------------------------------------------------- | ------------ |
| 6.0 | [`subphases/6.0-entry-gate.md`](subphases/6.0-entry-gate.md)     | phase-5:gate |
| 6.1 | [`6.1-denali-package.md`](subphases/6.1-denali-package.md)       | 6.1          |
| 6.2 | [`6.2-registry-rules.md`](subphases/6.2-registry-rules.md)       | 6.2          |
| 6.3 | [`6.3-widgets-theme.md`](subphases/6.3-widgets-theme.md)         | 6.3          |
| 6.4 | [`6.4-finance-slice.md`](subphases/6.4-finance-slice.md)         | 6.4          |
| 6.5 | [`6.5-bootstrap.md`](subphases/6.5-bootstrap.md)                 | 6.5          |
| 6.6 | [`6.6-smoke-parity.md`](subphases/6.6-smoke-parity.md)           | 6.6          |
| 6.7 | [`6.7-minio-photos.md`](subphases/6.7-minio-photos.md)           | 6.7          |
| 6.8 | [`6.8-migrate-canonical.md`](subphases/6.8-migrate-canonical.md) | 6.8          |
| 6.9 | [`6.9-phase-gate.md`](subphases/6.9-phase-gate.md)               | closure      |
