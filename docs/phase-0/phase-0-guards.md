# Phase 0 — Guards (covenant + phase-0-guard.mjs)

```yaml
guard_entrypoint:
  script: scripts/guards/phase-0-guard.mjs
  alias: pnpm run phase-0:guard
  env_foundation: PHASE_0_GUARD_SCOPE=foundation
  env_doc_sync: DOC_SYNC_SCOPE=foundation

phase_0_zero_debt_covenant:
  command: pnpm run test:phase-0
  expands_to: pnpm --filter @app-tour/workspace-sdk run test:phase-0
  aggregator: packages/workspace-sdk/test/phase-0.contract.spec.ts
  count: 10
  enforcement_id: P0-E-COVENANT
  contracts:
    - id: dist-surface
      spec: packages/workspace-sdk/test/contract.spec.ts
    - id: denali-coupling
      spec: packages/workspace-sdk/test/denali-coupling.contract.spec.ts
    - id: legacy-import
      spec: packages/workspace-sdk/test/legacy-import.contract.spec.ts
    - id: invariant-manifest
      spec: packages/workspace-sdk/test/invariant-manifest.contract.spec.ts
    - id: import-purity
      spec: packages/workspace-sdk/test/import-purity.spec.ts
    - id: ingress-error
      spec: packages/workspace-sdk/test/ingress-error.contract.spec.ts
    - id: theme-safety-seal
      spec: packages/workspace-sdk/test/theme-safety-seal.contract.spec.ts
    - id: foundation-import-purity
      spec: packages/workspace-sdk/test/foundation-import-purity.contract.spec.ts
    - id: denali-workspace-binding
      spec: packages/workspace-sdk/test/denali-workspace-binding.contract.spec.ts
    - id: supplemental-behavior
      spec: packages/workspace-sdk/test/phase-0-supplemental.contract.spec.ts

phase_0_guard_script_checks:
  foundation_scope:
    when: PHASE_0_GUARD_SCOPE=foundation
    checks:
      - id: g4_depcruise_architecture
        enforcement_id: P0-E-ARCH-SCOPED
        verification: depcruise packages/workspace-sdk packages/config
        fail_if: forbidden dependency edges
      - id: g4b_import_boundary
        enforcement_id: P0-E-IMPORT-SCOPED
        verification: pnpm run guard:import-boundary (foundation scan roots)
        fail_if: barrel or forbidden path imports
      - id: g7_doc_sync
        enforcement_id: P0-E-DOC
        verification: DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync
        fail_if: markdoc/registry/package README drift
    skips: [g6_runtime_deps_honesty]
    report_glob: reports/phase-0-foundation-gate-*.json
  integration_scope:
    when: default (no PHASE_0_GUARD_SCOPE)
    checks:
      - id: g4_depcruise_architecture
        enforcement_id: P0-E-ARCH
        verification: pnpm run guard:architecture
        fail_if: monorepo depcruise violations
      - id: g4b_import_boundary
        enforcement_id: P0-E-IMPORT
        verification: pnpm run guard:import-boundary (full IMPORT_BOUNDARY_SCAN_ROOTS)
        fail_if: barrel or forbidden imports
      - id: g6_runtime_deps_honesty
        enforcement_id: P0-E-RUNTIME
        verification: ui-primitives src/ imports declared in package.json dependencies
        fail_if: react/react-dom/@app-tour/* used but not in dependencies
      - id: g7_doc_sync
        enforcement_id: P0-E-DOC-FULL
        verification: pnpm run guard:doc-sync
        fail_if: documentation-sync fail
    report_glob: reports/phase-0-gate-*.json

retired_stale_doc_ids:
  g1_sdk_dist:
    status: REMOVED — outdated
    replacement: dist-surface covenant
  g2_denali_rg:
    status: REMOVED — outdated
    replacement: denali-coupling.contract.spec.ts
  g3_legacy_rg:
    status: REMOVED — outdated
    replacement: legacy-import.contract.spec.ts
  g5_test_count_103:
    status: REMOVED — outdated as gate floor
    replacement: test:phase-0 behavioral contracts (DRIFT-03)

script_notes:
  g_invariant_manifest: enforced via invariant-manifest covenant in test:phase-0 (not separate main() check)
  foundation_gate_script_exact: pnpm run test:phase-0
  foundation_scope_assert: node scripts/guards/foundation-scope-assert.mjs (CI foundation job only)
```
