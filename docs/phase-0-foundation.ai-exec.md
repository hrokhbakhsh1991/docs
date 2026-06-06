# AI-EXECUTION DOCUMENT — Phase 0 (central index)

> **Detailed modules:** [`phase-0/phase-0.ai-exec.index.md`](phase-0/phase-0.ai-exec.index.md) · **Hub:** [`phase-0/README.md`](phase-0/README.md)

```yaml
document_meta:
phase_id: "0"
phase_name: "Foundation & Contract (workspace-sdk)"
north_star: "Platform logic = generic · Workspace logic = injectable"
  canonical_markdoc: docs/phase-0-foundation.mdoc
  modular_index: docs/phase-0/phase-0.ai-exec.index.md
  quality_report: docs/phase-0/QUALITY-VALIDATION.md
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD
phase_detection_blocker: null
  prerequisite_phase: none
  prerequisite_gate: none
  closure_gate: pnpm run phase-0:gate
```

## Subphases (execution order)

| ID  | Module                                                                                       | PR label   |
| --- | -------------------------------------------------------------------------------------------- | ---------- |
| 0.1 | [`phase-0/subphases/0.1-legacy-archive.md`](phase-0/subphases/0.1-legacy-archive.md)         | Phase: 0.1 |
| 0.2 | [`phase-0/subphases/0.2-workspace-sdk.md`](phase-0/subphases/0.2-workspace-sdk.md)           | Phase: 0.2 |
| 0.3 | [`phase-0/subphases/0.3-architecture-guard.md`](phase-0/subphases/0.3-architecture-guard.md) | Phase: 0.3 |
| 0.4 | [`phase-0/subphases/0.4-documentation.md`](phase-0/subphases/0.4-documentation.md)           | Phase: 0.4 |
| 0.5 | [`phase-0/subphases/0.5-ci-gate.md`](phase-0/subphases/0.5-ci-gate.md)                       | Phase: 0.5 |
| 0.6 | [`phase-0/subphases/0.6-baseline-metrics.md`](phase-0/subphases/0.6-baseline-metrics.md)     | Phase: 0.6 |

## Core modules

| Module                            | File                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| Overview · STEP 1 · L-1..L-10     | [`phase-0/phase-0-overview.md`](phase-0/phase-0-overview.md)           |
| State machine · DAG               | [`phase-0/phase-0-state-machine.md`](phase-0/phase-0-state-machine.md) |
| Guards · 10 covenant contracts    | [`phase-0/phase-0-guards.md`](phase-0/phase-0-guards.md)               |
| CI · phase-0:gate                 | [`phase-0/phase-0-ci.md`](phase-0/phase-0-ci.md)                       |
| Enforcement · DoD · Phase 1 entry | [`phase-0/phase-0-enforcement.md`](phase-0/phase-0-enforcement.md)     |

## Audits

| Audit                         | File                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Forensic template             | [`phase-0/audits/forensic-template.md`](phase-0/audits/forensic-template.md)     |
| Verification matrix (P0-E-\*) | [`phase-0/audits/verification-matrix.md`](phase-0/audits/verification-matrix.md) |
| Quality validation            | [`phase-0/QUALITY-VALIDATION.md`](phase-0/QUALITY-VALIDATION.md)                 |

## Appendices

| Appendix                  | File                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| A — SDK tree              | [`phase-0/appendices/sdk-tree.md`](phase-0/appendices/sdk-tree.md)                           |
| B — Verification commands | [`phase-0/appendices/verification-commands.md`](phase-0/appendices/verification-commands.md) |
| C — Export map            | [`phase-0/appendices/export-map.md`](phase-0/appendices/export-map.md)                       |
| D — Dependency graph      | [`phase-0/appendices/dependency-graph.md`](phase-0/appendices/dependency-graph.md)           |
| E — Test matrix           | [`phase-0/appendices/test-matrix.md`](phase-0/appendices/test-matrix.md)                     |
| Legacy mapping            | [`phase-0/appendices/legacy-mapping.md`](phase-0/appendices/legacy-mapping.md)               |
| Legacy references         | [`phase-0/appendices/legacy-references.md`](phase-0/appendices/legacy-references.md)         |
| MAP bridge                | [`phase-0/appendices/migration-map.md`](phase-0/appendices/migration-map.md)                 |

## Agent boot (deterministic)

```yaml
agent_boot:
  1: "READ phase-0-overview.md STEP 1 — phase_id must be 0; blocker must be null"
  2: "SET current_subphase via exit_criteria 0.1 → 0.6"
  3: "RUN pnpm run phase-0:gate for closure (foundation-gate + integration-gate)"
  4: "BIND covenant: pnpm run test:phase-0 (10 contracts) — NOT stale g1 g2 g3 g5"
  5: "BIND guards: g4 g4b g7 (foundation scope); g4 g4b g6 g7 (integration scope)"
  6: "ON DONE READ phase-0-enforcement.md phase_1_entry_checklist"
  fail_token: FAIL
```

## Gate chain (package.json)

```yaml
phase_0_gate:
  step_1: pnpm run phase-0:foundation-gate # alias test:phase-0
  step_2: pnpm run phase-0:integration-gate
  note: "ci:integrity also runs phase-1-guard delta after phase-0:gate"
```
