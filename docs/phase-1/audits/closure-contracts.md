# Phase 1 — Closure contracts (14 rows)

## PHASE_1_CLOSURE_CONTRACTS (14 rows — repo truth)

```yaml
closure_contracts_source: packages/platform-core/test/phase-1.contract.spec.ts
PHASE_1_MIN_BEHAVIOR_CONTRACTS: 14
contracts:
  - id: import-purity
    title: "platform-core entry does not load CASL or SDK theme/auth"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: no-starter-plugin
    title: "production src must not import workspace starter plugin (depcruise)"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: no-spec-under-src
    title: "unit specs live under test/ not src/"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: headless-plugin-ingress
    title: "plugin ingress uses includeTheme:false at create (sanitizePluginAtCreate)"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: sdk-subpath-imports
    title: "production and tests use SDK subpaths only"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: no-fromPlugin-api
    title: "removed deprecated PlatformWizardEngine.fromPlugin"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
    forbidden: PlatformWizardEngine.fromPlugin
    required: [tryFromPlugin, create]
  - id: no-test-policy-export
    title: "index.ts does not export RuleEngineScopePolicy"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: starter-fixture-location
    title: "starter fixture only under test/fixtures"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: dist-import-purity
    title: "dist/index.js does not load CASL or SDK theme/auth"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: field-validation-contract
    title: "canonical-field-validation-contract exists; passesHiddenFieldKindGate wired in validate-canonical-field"
    specRel: src/contracts/canonical-field-validation-contract.ts
    guardIds: [g11_phase1_contract_behaviors]
    behavioral_2026_06_03: "passesHiddenFieldKindGate delegates to isEmptyCanonicalValue; hidden composite values skip HIDDEN_FIELD_POISON; inactiveFieldGroups skip document validation"
  - id: adversarial-plugin-ingress
    title: "headless ingress skips invalid theme at platform init"
    specRel: test/adversarial-plugin-ingress.spec.ts
    guardIds: [g10_adversarial_specs_execute]
  - id: single-facade-export
    title: "package.json exports only root facade (no subpath wildcards)"
    specRel: test/phase-1.contract.spec.ts
    guardIds: [g11_phase1_contract_behaviors]
  - id: facade-integration-gate
    title: "facade-integration.spec.ts gates public PlatformWizardEngine API"
    specRel: test/facade-integration.spec.ts
    guardIds: [g12_facade_integration_spec]
  - id: fresh-starter-fixture
    title: "createFreshStarterPlugin alias uses per-call factory (no singleton)"
    specRel: test/fixtures/starter.fixture.ts
    guardIds: [g11_phase1_contract_behaviors]
enforcement_assertion: "PHASE_1_CLOSURE_CONTRACTS.length === 14 && every guardIds.length > 0"
```

---

