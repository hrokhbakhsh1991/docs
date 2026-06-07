# Phase 1 — Guards (phase-1-guard.mjs)

```yaml
guard_entrypoint:
  script: scripts/guards/phase-1-guard.mjs
  alias: pnpm run phase-1:guard
  thresholds_file: scripts/guards/gate-thresholds.mjs
  report_glob: reports/phase-1-guard-*.json

thresholds_enforced:
  PLATFORM_CORE_TEST_MIN_phase1: 148
  PLATFORM_CORE_CLOSURE_TEST_MIN_phase1: 56
  WORKSPACE_SDK_TEST_MIN_phase1: 39
  PHASE_1_FACADE_TEST_RATIO_MIN: 0.6
  MIN_PHASE_1_BEHAVIOR_CONTRACTS: 14

phase_1_guard_execution_order:
  - id: g1_platform_core_dist
    enforcement_id: P1-E-DIST
    verification: packages/platform-core/dist/index.js exists after build
    fail_if: dist missing
  - id: g2b_workspace_sdk_test_count
    enforcement_id: P1-E-SDK-TESTS
    verification: pnpm --filter @app-tour/workspace-sdk test count ≥ 39
    fail_if: below WORKSPACE_SDK_TEST_MIN.phase1
  - id: g2_platform_core_test_count
    enforcement_id: P1-E-PC-TESTS
    verification: pnpm --filter @app-tour/platform-core test count ≥ 148
    fail_if: below PLATFORM_CORE_TEST_MIN.phase1
    note: includes closure + unit:internal suites
  - id: g2c_platform_core_closure_test_count
    enforcement_id: P1-E-CLOSURE
    verification: pnpm --filter @app-tour/platform-core run test:closure count ≥ 56
    fail_if: below PLATFORM_CORE_CLOSURE_TEST_MIN.phase1
    excludes: test/unit/**
  - id: g2d_unit_internal_tests
    enforcement_id: P1-E-UNIT-INTERNAL
    verification: pnpm --filter @app-tour/platform-core run test:unit:internal exit 0
    fail_if: failures or unparseable output
  - id: g11_phase1_contract_behaviors
    enforcement_id: P1-E-CONTRACT
    verification: pnpm --filter @app-tour/platform-core run test:phase-1
    spec: packages/platform-core/test/phase-1.contract.spec.ts
    fail_if: contract rows < 14 or behavioral failures
    contract_ids:
      - import-purity
      - no-starter-plugin
      - no-spec-under-src
      - headless-plugin-ingress
      - sdk-subpath-imports
      - no-fromPlugin-api
      - no-test-policy-export
      - starter-fixture-location
      - dist-import-purity
      - field-validation-contract
      - adversarial-plugin-ingress
      - single-facade-export
      - facade-integration-gate
      - fresh-starter-fixture
  - id: g12_facade_integration_spec
    enforcement_id: P1-E-FACADE-INT
    verification: pnpm --filter @app-tour/platform-core exec node --import tsx --test test/facade-integration.spec.ts
    fail_if: missing output strings tryFromPlugin golden snapshot or CANONICAL_TYPE_MISMATCH
  - id: g13_facade_test_ratio
    enforcement_id: P1-E-FACADE-RATIO
    verification: scripts/guards/lib/facade-test-ratio.mjs on closure specs ≥ 0.6
    fail_if: ratio below PHASE_1_FACADE_TEST_RATIO_MIN
    note: "PHASE_1_FACADE_TEST_RATIO_MIN = 0.6 (60% minimum) — gate-thresholds.mjs + mdoc §4.6"
  - id: g10_adversarial_specs_execute
    enforcement_id: P1-E-ADVERSARIAL
    verification: pnpm run test:adversarial
    fail_if: any listed adversarial spec fails
  - id: g3_no_denali_tokens
    enforcement_id: P1-E-NO-DENALI
    verification: rg -i denali packages/platform-core excl *.spec.ts → 0
  - id: g3b_denali_in_platform_core_test
    enforcement_id: P1-E-NO-DENALI-TEST
    verification: rg -i denali packages/platform-core/test → 0 (includes `it()` titles — use neutral labels like "registry UUID smoke", not workspace names)
  - id: g3c_denali_in_platform_core_dist
    enforcement_id: P1-E-NO-DENALI-DIST
    verification: rg -i denali packages/platform-core/dist → 0 after build
  - id: g4_no_react_imports
    enforcement_id: P1-E-NO-REACT
    verification: no react/react-dom imports in platform-core src
  - id: g5_depcruise_architecture
    enforcement_id: P1-E-ARCH
    verification: pnpm run guard:architecture
  - id: g6_import_boundary
    enforcement_id: P1-E-IMPORT
    verification: pnpm run guard:import-boundary
    note: NOT report-write — DRIFT-02
  - id: g8_symlink_guard
    enforcement_id: P1-E-SYMLINK
    verification: pnpm run guard:symlink

stale_doc_retired:
  g6_report_write:
    status: REMOVED — outdated
    replacement: g6_import_boundary
  test_floor_132_50:
    status: REMOVED — outdated in narrative md
    replacement: gate-thresholds.mjs 148 / 56
```
