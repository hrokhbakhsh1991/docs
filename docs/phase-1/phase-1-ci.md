# Phase 1 — CI / phase-1:gate

```yaml
execution_priority: package.json scripts — not mdoc §4.6 JSON alone

thresholds_file: scripts/guards/gate-thresholds.mjs
PLATFORM_CORE_TEST_MIN_phase1: 148
PLATFORM_CORE_CLOSURE_TEST_MIN_phase1: 56
WORKSPACE_SDK_TEST_MIN_phase1: 39
PHASE_1_FACADE_TEST_RATIO_MIN: 0.6
MIN_PHASE_1_BEHAVIOR_CONTRACTS: 14

phase_1_gate:
  name: pnpm run phase-1:gate
  package_json_exact: "pnpm build && pnpm test && pnpm --filter @app-tour/platform-core run test:phase-1 && pnpm run guard:architecture && pnpm run guard:import-boundary && pnpm run guard:symlink && pnpm run phase-1:guard"
  steps_ordered:
    - step: 1
      run: pnpm build
    - step: 2
      run: pnpm test
    - step: 3
      run: pnpm --filter @app-tour/platform-core run test:phase-1
      guard_id: g11_phase1_contract_behaviors
      note: REQUIRED — omitted in stale mdoc §4.6 JSON (DRIFT-01)
    - step: 4
      run: pnpm run guard:architecture
      guard_id: g5_depcruise_architecture
    - step: 5
      run: pnpm run guard:import-boundary
      guard_id: g6_import_boundary
    - step: 6
      run: pnpm run guard:symlink
      guard_id: g8_symlink_guard
    - step: 7
      run: pnpm run phase-1:guard
      expands_to: node scripts/guards/phase-1-guard.mjs
      runs_all: [g1, g2b, g2, g2c, g2d, g11, g12, g13, g10, g3, g3b, g3c, g4, g5, g6, g8]

phase_1_guard_script:
  path: scripts/guards/phase-1-guard.mjs
  reports: [reports/phase-1-guard-YYYY-MM-DD.json, reports/phase-1-guard-YYYY-MM-DD.md]

github_workflow:
  file: .github/workflows/phase-1-gate.yml
  command: pnpm run phase-1:gate
  node: "24 from .nvmrc"
  artifact: reports/phase-1-guard-*.json

ci_integrity_pre_commit:
  script: scripts/ci-integrity-check.sh
  steps_ordered:
    - node scripts/guards/check-node-engine.mjs
    - pnpm run phase-0:gate
    - pnpm run guard:symlink
    - node scripts/guards/phase-1-guard.mjs
  note: NOT full phase-1:gate — PR 1.6+ requires pnpm run phase-1:gate locally and in CI

pr_policy:
  label: "Phase: 1.x"
  one_subphase_per_pr: true
  merge_blocked_when: [phase-1-guard FAIL, any anti-pattern A1–A10 true]
```
