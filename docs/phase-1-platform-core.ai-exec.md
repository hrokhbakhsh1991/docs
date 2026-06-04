# AI-EXECUTION DOCUMENT — Phase 1 (central index)

> **Detailed modules:** [`phase-1/phase-1.ai-exec.index.md`](phase-1/phase-1.ai-exec.index.md) · **Hub:** [`phase-1/README.md`](phase-1/README.md)

```yaml
document_meta:
  phase_id: "1"
  phase_name: "Platform Core (Schema-Driven Engine)"
  north_star: "Platform logic = generic · ZERO workspace imports"
  canonical_markdoc: docs/phase-1-platform-core.mdoc
  modular_index: docs/phase-1/phase-1.ai-exec.index.md
  quality_report: docs/phase-1/QUALITY-VALIDATION.md
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD
  phase_detection_blocker: null
  prerequisite_phase: "0"
  prerequisite_gate: pnpm run phase-0:gate
  closure_gate: pnpm run phase-1:gate
```

## Subphases (execution order)

| ID | Module | PR label |
|----|--------|----------|
| 1.1 | [`phase-1/subphases/1.1-scaffold.md`](phase-1/subphases/1.1-scaffold.md) | Phase: 1.1 |
| 1.2 | [`phase-1/subphases/1.2-field-registry.md`](phase-1/subphases/1.2-field-registry.md) | Phase: 1.2 |
| 1.3 | [`phase-1/subphases/1.3-rule-engine.md`](phase-1/subphases/1.3-rule-engine.md) | Phase: 1.3 |
| 1.4 | [`phase-1/subphases/1.4-render-plan-steps.md`](phase-1/subphases/1.4-render-plan-steps.md) | Phase: 1.4 |
| 1.5 | [`phase-1/subphases/1.5-renderer-headless.md`](phase-1/subphases/1.5-renderer-headless.md) | Phase: 1.5 |
| 1.6 | [`phase-1/subphases/1.6-guardrails-facade.md`](phase-1/subphases/1.6-guardrails-facade.md) | Phase: 1.6 |

## Core modules

| Module | File |
|--------|------|
| Overview · STEP 1 · A1–A10 | [`phase-1/phase-1-overview.md`](phase-1/phase-1-overview.md) |
| State machine · DAG | [`phase-1/phase-1-state-machine.md`](phase-1/phase-1-state-machine.md) |
| Guards g1–g13 | [`phase-1/phase-1-guards.md`](phase-1/phase-1-guards.md) |
| CI · phase-1:gate | [`phase-1/phase-1-ci.md`](phase-1/phase-1-ci.md) |
| Enforcement · DoD · Phase 2 entry | [`phase-1/phase-1-enforcement.md`](phase-1/phase-1-enforcement.md) |

## Audits

| Audit | File |
|-------|------|
| Forensic template §9.4 | [`phase-1/audits/forensic-template.md`](phase-1/audits/forensic-template.md) |
| Closure contracts (14) | [`phase-1/audits/closure-contracts.md`](phase-1/audits/closure-contracts.md) |
| Verification matrix | [`phase-1/audits/verification-matrix.md`](phase-1/audits/verification-matrix.md) |
| Quality validation | [`phase-1/QUALITY-VALIDATION.md`](phase-1/QUALITY-VALIDATION.md) |

## Appendices

| Appendix | File |
|----------|------|
| API surface §5 | [`phase-1/appendices/api-surface.md`](phase-1/appendices/api-surface.md) |
| Test matrix §6 | [`phase-1/appendices/test-matrix.md`](phase-1/appendices/test-matrix.md) |
| Verification commands | [`phase-1/appendices/verification-commands.md`](phase-1/appendices/verification-commands.md) |
| PR template | [`phase-1/appendices/pr-template.md`](phase-1/appendices/pr-template.md) |
| Canonical utils | [`phase-1/appendices/canonical-utils.md`](phase-1/appendices/canonical-utils.md) |
| Error codes | [`phase-1/appendices/error-codes.md`](phase-1/appendices/error-codes.md) |
| Legacy renderer | [`phase-1/appendices/legacy-renderer.md`](phase-1/appendices/legacy-renderer.md) |
| Denali phase 6 | [`phase-1/appendices/denali-phase-6.md`](phase-1/appendices/denali-phase-6.md) |
| MAP bridge | [`phase-1/appendices/migration-map.md`](phase-1/appendices/migration-map.md) |

## Agent boot (deterministic)

```yaml
agent_boot:
  1: "READ phase-1-overview.md STEP 1 — phase_id must be 1; blocker must be null"
  2: "VERIFY pnpm run phase-0:gate exit 0"
  3: "SET current_subphase via exit_criteria 1.1 → 1.6"
  4: "FORBIDDEN StepEngine class · fromPlugin · design-tokens in platform-core"
  5: "RUN pnpm run phase-1:gate for closure — includes test:phase-1 step 3"
  6: "BIND guards g1 g2b g2 g2c g2d g11 g12 g13 g10 g3 g3b g3c g4 g5 g6 g8 — g6=import-boundary NOT report-write"
  7: "BIND thresholds 148 / 56 / 39 / 0.6 / 14 from gate-thresholds.mjs"
  8: "ON DONE READ phase-1-enforcement.md phase_2_entry_checklist"
  fail_token: FAIL
```

## Gate chain (package.json)

```yaml
phase_1_gate:
  step_1: pnpm build
  step_2: pnpm test
  step_3: pnpm --filter @app-tour/platform-core run test:phase-1
  step_4: pnpm run guard:architecture
  step_5: pnpm run guard:import-boundary
  step_6: pnpm run guard:symlink
  step_7: pnpm run phase-1:guard
pre_commit_note: "ci:integrity runs phase-1-guard.mjs only — NOT full phase-1:gate (DRIFT-08)"
```
