# AI-EXECUTION DOCUMENT — Phase 3 (central index)

> **Detailed modules:** [`phase-3/phase-3.ai-exec.index.md`](phase-3/phase-3.ai-exec.index.md) · **Hub:** [`phase-3/README.md`](phase-3/README.md)

```yaml
document_meta:
phase_id: "3"
phase_name: "Design System & App Integration"
  north_star: "Platform shell = generic · Workspace = injectable · CASL before ingress"
  canonical_markdoc: docs/phase-3-design-system.mdoc
  modular_index: docs/phase-3/phase-3.ai-exec.index.md
  quality_report: docs/phase-3/QUALITY-VALIDATION.md
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD
phase_detection_blocker: null
  prerequisite_phase: "2"
  prerequisite_gate: pnpm run phase-2:gate
  closure_gate: pnpm run phase-3:gate
  document_status_claim: "Closed: Zero-Debt Verified (platform scaffold 3.0–3.5)"
```

## Subphases (execution order)

| ID    | Module                                                                                       | PR label                |
| ----- | -------------------------------------------------------------------------------------------- | ----------------------- |
| 3.0   | [`phase-3/subphases/3.0-casl-authority.md`](phase-3/subphases/3.0-casl-authority.md)         | Phase: 3.0              |
| 3.1   | [`phase-3/subphases/3.1-workspace-starter.md`](phase-3/subphases/3.1-workspace-starter.md)   | Phase: 3.1              |
| 3.2   | [`phase-3/subphases/3.2-apps-api.md`](phase-3/subphases/3.2-apps-api.md)                     | Phase: 3.2              |
| 3.3   | [`phase-3/subphases/3.3-apps-web.md`](phase-3/subphases/3.3-apps-web.md)                     | Phase: 3.3              |
| 3.3.x | [`phase-3/subphases/3.3.x-select-checkbox.md`](phase-3/subphases/3.3.x-select-checkbox.md)   | Phase: 3.3.x (optional) |
| 3.4   | [`phase-3/subphases/3.4-canonical-sot.md`](phase-3/subphases/3.4-canonical-sot.md)           | Phase: 3.4              |
| 3.5   | [`phase-3/subphases/3.5-observability-gate.md`](phase-3/subphases/3.5-observability-gate.md) | Phase: 3.5              |

## Core modules

| Module                                | File                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Overview · STEP 1 · §1–§6             | [`phase-3/phase-3-overview.md`](phase-3/phase-3-overview.md)           |
| State machine · DAG                   | [`phase-3/phase-3-state-machine.md`](phase-3/phase-3-state-machine.md) |
| Guards p3\_\*                         | [`phase-3/phase-3-guards.md`](phase-3/phase-3-guards.md)               |
| CI · phase-3:gate                     | [`phase-3/phase-3-ci.md`](phase-3/phase-3-ci.md)                       |
| Enforcement · P3-E-\* · Phase 4 entry | [`phase-3/phase-3-enforcement.md`](phase-3/phase-3-enforcement.md)     |

## Audits

| Audit                | File                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| Forensic template §3 | [`phase-3/audits/forensic-template.md`](phase-3/audits/forensic-template.md)     |
| Verification matrix  | [`phase-3/audits/verification-matrix.md`](phase-3/audits/verification-matrix.md) |
| Quality validation   | [`phase-3/QUALITY-VALIDATION.md`](phase-3/QUALITY-VALIDATION.md)                 |
| Forensic (repo)      | docs/audits/phase-3-zero-debt-forensic-audit.mdoc                                |
| Integrity (repo)     | docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc                      |

## Appendices

| Appendix                  | File                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dependency graph          | [`phase-3/appendices/dependency-graph.md`](phase-3/appendices/dependency-graph.md)                   |
| Verification commands     | [`phase-3/appendices/verification-commands.md`](phase-3/appendices/verification-commands.md)         |
| PR template               | [`phase-3/appendices/pr-template.md`](phase-3/appendices/pr-template.md)                             |
| Test matrix               | [`phase-3/appendices/test-matrix.md`](phase-3/appendices/test-matrix.md)                             |
| Forensic baseline phase 2 | [`phase-3/appendices/forensic-baseline-phase-2.md`](phase-3/appendices/forensic-baseline-phase-2.md) |
| External references       | [`phase-3/appendices/external-references.md`](phase-3/appendices/external-references.md)             |
| MAP bridge                | [`phase-3/appendices/migration-map.md`](phase-3/appendices/migration-map.md)                         |

## Agent boot (deterministic)

```yaml
agent_boot:
  1: "READ phase-3-overview.md STEP 1 — phase_id must be 3; blocker must be null"
  2: "VERIFY pnpm run phase-2:gate exit 0"
  3: "SET current_subphase via exit_criteria 3.0 → 3.5"
  4: "FORBIDDEN barrel ui-primitives · denali static import · ingress before ability.can"
  5: "3.1+ code PRs REQUIRE pnpm run doc-gate + phase-3-design-system.mdoc update first"
  6: "RUN pnpm run phase-3:gate for closure — bind p3_* not §13.5 numbered table"
  7: "BIND thresholds sdk 100 starter 15 api 20 web 10 from gate-thresholds.mjs"
  8: "defineAbilityFor from packages/workspace-sdk/src/auth/casl/index.ts"
  9: "Ability tests under packages/workspace-sdk/test/auth/ only"
  10: "ON DONE READ phase-3-enforcement.md phase_4_entry"
  fail_token: FAIL
```

## Gate chain (package.json)

```yaml
phase_3_gate:
  step_1: pnpm build
  step_2: pnpm test
  step_3: pnpm run guard:architecture
  step_4: pnpm run guard:import-boundary
  step_5: pnpm run guard:artifact-surface
  step_6: pnpm run audit-boundary
  step_7: pnpm run phase-2:gate
  step_8: pnpm run doc-gate
  step_9: pnpm run phase-3:guard
  note_doc_gate_duplicate: "p3_doc_gate re-runs doc-gate inside phase-3:guard — DRIFT-P3-10 intentional"
pre_commit_note: "ci:integrity does NOT run phase-3:gate — DRIFT-P3-05"
soft_backlog:
  - Playwright W-3 W-4
  - Select/Checkbox p3_ui_select_checkbox_optional required false
```
