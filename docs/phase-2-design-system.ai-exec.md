# AI-EXECUTION DOCUMENT — Phase 2 (central index)

> **Detailed modules:** [`phase-2/phase-2.ai-exec.index.md`](phase-2/phase-2.ai-exec.index.md) · **Hub:** [`phase-2/README.md`](phase-2/README.md)

```yaml
document_meta:
  phase_id: "2"
  phase_name: "Design System & Enterprise Visual Layer"
  north_star: "Platform semantics = generic tokens · Workspace brand = injectable theme"
  canonical_markdoc: docs/phase-2-design-system.mdoc
  modular_index: docs/phase-2/phase-2.ai-exec.index.md
  quality_report: docs/phase-2/QUALITY-VALIDATION.md
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD
  phase_detection_blocker: null
  prerequisite_phase: "1"
  prerequisite_gate: pnpm run phase-1:gate
  closure_gate: pnpm run phase-2:gate
```

## Subphases (execution order)

| ID | Module | PR label |
|----|--------|----------|
| 2.1 | [`phase-2/subphases/2.1-design-tokens.md`](phase-2/subphases/2.1-design-tokens.md) | Phase: 2.1 |
| 2.2 | [`phase-2/subphases/2.2-workspace-theme-contract.md`](phase-2/subphases/2.2-workspace-theme-contract.md) | Phase: 2.2 |
| 2.2.1 | [`phase-2/subphases/2.2.1-theme-ingress-security.md`](phase-2/subphases/2.2.1-theme-ingress-security.md) | Phase: 2.2 (nested) |
| 2.3 | [`phase-2/subphases/2.3-ui-primitives.md`](phase-2/subphases/2.3-ui-primitives.md) | Phase: 2.3 |
| 2.4 | [`phase-2/subphases/2.4-theme-react.md`](phase-2/subphases/2.4-theme-react.md) | Phase: 2.4 |
| 2.5 | [`phase-2/subphases/2.5-visual-qa-gate.md`](phase-2/subphases/2.5-visual-qa-gate.md) | Phase: 2.5 |

## Core modules

| Module | File |
|--------|------|
| Overview · STEP 1 · §1–§5 | [`phase-2/phase-2-overview.md`](phase-2/phase-2-overview.md) |
| State machine · DAG | [`phase-2/phase-2-state-machine.md`](phase-2/phase-2-state-machine.md) |
| Guards p2_* | [`phase-2/phase-2-guards.md`](phase-2/phase-2-guards.md) |
| CI · phase-2:gate | [`phase-2/phase-2-ci.md`](phase-2/phase-2-ci.md) |
| Enforcement · DoD · Phase 3 entry | [`phase-2/phase-2-enforcement.md`](phase-2/phase-2-enforcement.md) |

## Audits

| Audit | File |
|-------|------|
| Forensic template §13 | [`phase-2/audits/forensic-template.md`](phase-2/audits/forensic-template.md) |
| Verification matrix | [`phase-2/audits/verification-matrix.md`](phase-2/audits/verification-matrix.md) |
| Quality validation | [`phase-2/QUALITY-VALIDATION.md`](phase-2/QUALITY-VALIDATION.md) |
| Forensic (repo) | docs/audits/phase-2-zero-debt-forensic-audit.mdoc |
| Integrity (repo) | docs/audits/phase-2-documentation-integrity-2026-06-03.mdoc |

## Appendices

| Appendix | File |
|----------|------|
| A — Dependency graph | [`phase-2/appendices/dependency-graph.md`](phase-2/appendices/dependency-graph.md) |
| B — Verification commands | [`phase-2/appendices/verification-commands.md`](phase-2/appendices/verification-commands.md) |
| C — PR template | [`phase-2/appendices/pr-template.md`](phase-2/appendices/pr-template.md) |
| E — Test matrix | [`phase-2/appendices/test-matrix.md`](phase-2/appendices/test-matrix.md) |
| MAP bridge | [`phase-2/appendices/migration-map.md`](phase-2/appendices/migration-map.md) |
| Denali phase 6 | [`phase-2/appendices/denali-phase-6.md`](phase-2/appendices/denali-phase-6.md) |
| External references | [`phase-2/appendices/external-references.md`](phase-2/appendices/external-references.md) |

## Agent boot (deterministic)

```yaml
agent_boot:
  1: "READ phase-2-overview.md STEP 1 — phase_id must be 2; blocker must be null"
  2: "VERIFY pnpm run phase-1:gate exit 0 — platform-core ≥148 closure ≥56"
  3: "SET current_subphase via exit_criteria 2.1 → 2.5; 2.2.1 T-1–T-7 ships with 2.2"
  4: "FORBIDDEN barrel @app-tour/ui-primitives · platform-core → design-tokens"
  5: "FORBIDDEN @app-tour/theme-react/internal export"
  6: "RUN pnpm run phase-2:gate for closure — bind p2_* not Appendix G numbered table"
  7: "BIND thresholds 50 / 12 / 4 / 4 from gate-thresholds.mjs"
  8: "ON DONE READ phase-2-enforcement.md phase_3_entry_checklist"
  fail_token: FAIL
```

## Gate chain (package.json)

```yaml
phase_2_gate:
  step_1: pnpm build
  step_2: pnpm test
  step_3: pnpm run guard:architecture
  step_4: pnpm run guard:import-boundary
  step_5: pnpm run validate-design-tokens
  step_6: pnpm run guard:artifact-surface
  step_7: pnpm run audit-boundary
  step_0: pnpm run check:node-engine
  step_3b: pnpm --filter @app-tour/platform-core run test:phase-2
  step_8: pnpm run phase-2:guard
  not_in_chain: guard:symlink
pre_commit_note: "ci:integrity runs phase-0:gate + phase-1:gate + phase-2:gate (DRIFT-P2-11 closed)"
```
