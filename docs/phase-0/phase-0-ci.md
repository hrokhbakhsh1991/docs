# Phase 0 — CI / phase-0:gate

```yaml
execution_priority: package.json scripts — not narrative §9 JSON blocks

phase_0_gate:
  name: pnpm run phase-0:gate
  package_json: "pnpm run phase-0:foundation-gate && pnpm run phase-0:integration-gate"
  aliases:
    covenant_gate: pnpm run phase-0:covenant-gate
    trunk_gate: pnpm run phase-0:trunk-gate
  steps_ordered:
    - step: 1
      name: phase-0:covenant-gate
      alias: phase-0:foundation-gate
      run: pnpm run test:phase-0
      validates: phase_0_zero_debt_covenant (10 contracts)
      note: H-06 — root script is test:phase-0 only; build runs inside workspace-sdk test:phase-0
    - step: 2
      name: phase-0:integration-gate
      substeps_ordered:
        - run: pnpm build
        - run: pnpm test
        - run: pnpm run test:contract:monorepo
        - run: pnpm run test:adversarial
        - run: DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync
        - run: PHASE_0_GUARD_REPORT=integration node scripts/guards/phase-0-guard.mjs
        - run: pnpm run guard:architecture
        - run: pnpm run guard:import-boundary
        - run: pnpm run baseline:metrics

phase_0_foundation_gate:
  package_json_exact: pnpm run test:phase-0
  must_not_include: [pnpm build at root, phase-0-guard.mjs, guard:doc-sync]
  enforced_by: scripts/guards/foundation-scope-assert.mjs

phase_0_integration_gate:
  package_json_exact: "pnpm build && pnpm test && pnpm run test:contract:monorepo && pnpm run test:adversarial && DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync && PHASE_0_GUARD_REPORT=integration node scripts/guards/phase-0-guard.mjs && pnpm run guard:architecture && pnpm run guard:import-boundary && pnpm run baseline:metrics"
  report_artifact: reports/phase-0-integration-gate-*.json

ci_integrity_pre_commit:
  script: bash scripts/ci-integrity-check.sh
  steps_ordered:
    - node scripts/guards/check-node-engine.mjs
    - pnpm run phase-0:gate
    - pnpm run guard:symlink
    - node scripts/guards/phase-1-guard.mjs
  note: ci:integrity is NOT identical to phase-0:gate alone — includes Phase 1 guard delta

github_workflow:
  file: .github/workflows/phase-0-gate.yml
  jobs:
    foundation_gate:
      extra_steps_vs_package_json:
        - node scripts/guards/foundation-scope-assert.mjs
      env:
        LEGACY_IMPORT_SCAN_SCOPE: foundation
      command: pnpm run phase-0:foundation-gate
    integration_gate:
      env:
        LEGACY_IMPORT_SCAN_SCOPE: monorepo
      command: pnpm run phase-0:integration-gate
      artifacts: [reports/phase-0-integration-gate-*.json, reports/phase-0-baseline-*.json]
  parity_rule: both jobs MUST pass — equivalent to local pnpm run phase-0:gate
```
