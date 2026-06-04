# Test matrix §6

## TEST MATRIX (§6)

```yaml
exit_criteria_test_floor_doc: "≥ 30 historical PR plan"
exit_criteria_test_floor_gate:
  platform_core_full: 148
  platform_core_closure: 56
  workspace_sdk: 39
  facade_ratio: 0.6
  behavior_contracts: 14
source_threshold_file: scripts/guards/gate-thresholds.mjs

test_registry:
  - module: FieldRegistryEngine
    spec: test/unit/engine/field-registry.engine.spec.ts
    cases: 7
  - module: RuleEngine
    spec: test/unit/engine/rule.engine.spec.ts
    cases: 25
  - module: RuleCellIndex
    spec: test/unit/engine/rule-cell-index.spec.ts
    cases: 4
  - module: Rule concurrency
    spec: test/rule-engine-concurrency.spec.ts
    cases: 4
    gate: g10_adversarial_specs_execute
  - module: render-plan.steps
    spec: test/unit/engine/render-plan.steps.spec.ts
    cases: 6
  - module: buildRenderPlan
    spec: test/unit/engine/render-plan.spec.ts
    cases: 7
  - module: Phase 1 contract
    spec: test/phase-1.contract.spec.ts
    command: pnpm --filter @app-tour/platform-core run test:phase-1
    cases: 17
    guard: g11_phase1_contract_behaviors
    min_behavior_rows: 14
  - module: Facade integration
    spec: test/facade-integration.spec.ts
    cases: 5
    guard: g12_facade_integration_spec
  - module: PlatformWizardEngine
    spec: test/unit/engine/platform-wizard.engine.spec.ts
    cases: 15
  - module: canonical-path utils
    spec: test/unit/utils/canonical-path.spec.ts
    cases: 7
  - module: canonical-value utils
    spec: test/unit/utils/canonical-value.spec.ts
    cases: 7
  - module: Adversarial validation
    spec: test/adversarial-validation.spec.ts
    gate: g10
  - module: Runtime isolation
    spec: test/runtime-isolation.spec.ts
    gate: g10
  - module: Cold start
    spec: test/cold-start.contract.spec.ts
    cases: 6
  - module: Total
    command: pnpm --filter @app-tour/platform-core test
    enforced_floor: 148
    note: informational case count may exceed floor; gate uses parseTestCount

minimum_matrix_historical:
  FieldRegistryEngine: { min: 6, actual: 7 }
  RuleEngine: { min: 8, actual: 33 }
  render-plan.steps: { min: 5, actual: 6 }
  buildRenderPlan: { min: 6, actual: 8 }
  Facade: { min: 5, actual: 15 }

fixture_policy:
  path: test/fixtures/starter.fixture.ts
  factories: [createTestStarterPlugin, createFreshStarterPlugin]
  forbidden_production: import @app-tour/workspace-sdk/src/reference
  phase_6_note: denali.fixture only in workspace package tests

test_runner:
  full: 'NODE_ENV=test node --import tsx --test — pnpm --filter @app-tour/platform-core test'
  closure: pnpm --filter @app-tour/platform-core run test:closure
  unit_internal: pnpm --filter @app-tour/platform-core run test:unit:internal
  contract_only: pnpm --filter @app-tour/platform-core run test:phase-1

closure_suite_files:
  - test/purity-side-effects.spec.ts
  - test/facade-integration.spec.ts
  - test/cold-start.contract.spec.ts
  - test/runtime-isolation.spec.ts
  - test/phase-1.contract.spec.ts
  - test/adversarial-validation.spec.ts
  - test/rule-engine-concurrency.spec.ts
  - test/adversarial-plugin-ingress.spec.ts
```

---

