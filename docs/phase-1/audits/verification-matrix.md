# Phase 1 — Verification matrix

```yaml
enforcement_matrix:
  - enforcement_id: P1-E-DIST
    guard_id: g1_platform_core_dist
    verification: dist/index.js exists
    failure_condition: build artifact missing
  - enforcement_id: P1-E-SDK-TESTS
    guard_id: g2b_workspace_sdk_test_count
    verification: workspace-sdk tests ≥ 39
    failure_condition: count below gate-thresholds.mjs
  - enforcement_id: P1-E-PC-TESTS
    guard_id: g2_platform_core_test_count
    verification: platform-core full test ≥ 148
    failure_condition: count below PLATFORM_CORE_TEST_MIN.phase1
  - enforcement_id: P1-E-CLOSURE
    guard_id: g2c_platform_core_closure_test_count
    verification: test:closure ≥ 56 excluding test/unit/**
    failure_condition: count below PLATFORM_CORE_CLOSURE_TEST_MIN.phase1
  - enforcement_id: P1-E-UNIT-INTERNAL
    guard_id: g2d_unit_internal_tests
    verification: test:unit:internal exit 0
    failure_condition: unit internal failures
  - enforcement_id: P1-E-CONTRACT
    guard_id: g11_phase1_contract_behaviors
    verification: test:phase-1 ≥ 14 behavioral rows
    failure_condition: phase-1.contract.spec.ts fail
  - enforcement_id: P1-E-FACADE-INT
    guard_id: g12_facade_integration_spec
    verification: facade-integration.spec.ts with tsx runner
    failure_condition: missing required stdout markers
  - enforcement_id: P1-E-FACADE-RATIO
    guard_id: g13_facade_test_ratio
    verification: facade ratio ≥ 0.6 on closure specs
    failure_condition: ratio below PHASE_1_FACADE_TEST_RATIO_MIN
  - enforcement_id: P1-E-ADVERSARIAL
    guard_id: g10_adversarial_specs_execute
    verification: pnpm run test:adversarial
    failure_condition: any adversarial spec fails
  - enforcement_id: P1-E-NO-DENALI
    guard_id: g3_no_denali_tokens
    verification: rg denali src excl specs
    failure_condition: denali token in src
  - enforcement_id: P1-E-NO-DENALI-TEST
    guard_id: g3b_denali_in_platform_core_test
    verification: rg denali test → 0
  - enforcement_id: P1-E-NO-DENALI-DIST
    guard_id: g3c_denali_in_platform_core_dist
    verification: rg denali dist → 0
  - enforcement_id: P1-E-NO-REACT
    guard_id: g4_no_react_imports
    verification: no react in platform-core
    failure_condition: react import detected
  - enforcement_id: P1-E-ARCH
    guard_id: g5_depcruise_architecture
    verification: pnpm run guard:architecture
    failure_condition: depcruise violations
  - enforcement_id: P1-E-IMPORT
    guard_id: g6_import_boundary
    verification: pnpm run guard:import-boundary
    failure_condition: import boundary violation
  - enforcement_id: P1-E-SYMLINK
    guard_id: g8_symlink_guard
    verification: pnpm run guard:symlink
    failure_condition: symlink guard fail
  - enforcement_id: P1-E-GATE
    verification: pnpm run phase-1:gate exit 0
    failure_condition: any outer or guard step fails
```
