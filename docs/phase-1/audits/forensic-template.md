# Phase 1 — Forensic truth

## FORENSIC TRUTH — ENFORCEABLE CONSTRAINTS (§9.4)

```yaml
forensic_truth_rules:
  - id: FT-P1-01
    claim: "Headless platform — no theme in engine"
    repo: "buildRuntime uses includeTheme:false; theme SDK codes → PLUGIN_INVALID_SHAPE at boundary"
    enforcement: "phase-1.contract headless-plugin-ingress + adversarial-plugin-ingress"
    guard_ids: [g11_phase1_contract_behaviors, g10_adversarial_specs_execute]
  - id: FT-P1-02
    claim: "Fail-fast fromPlugin"
    repo: "fromPlugin REMOVED — use create + init OR tryFromPlugin"
    enforcement: "no-fromPlugin-api contract; rg fromPlugin in src/ → 0"
    guard_ids: [g11_phase1_contract_behaviors]
    forbidden_api: "PlatformWizardEngine.fromPlugin"
  - id: FT-P1-03
    claim: "Test count alone proves full behavioral closure"
    repo_truth: "g2 ≥148 AND g11 ≥14 contracts AND g12 facade-integration required (FT-P1-03)"
    repo: "g2 count floor only; g11 + g12 prove behaviors"
    enforcement: "g2_platform_core_test_count + g11 + g12"
    guard_ids: [g2_platform_core_test_count, g11_phase1_contract_behaviors, g12_facade_integration_spec]
  - id: FT-P1-04
    claim: "plugin.validation hooks at platform runtime"
    repo: "platform-core does NOT invoke plugin.validation in Phase 1"
    status: DEFERRED Phase 3+ API
  - id: FT-P1-05
    claim: "Public RuleEngine / internal engines on barrel"
    repo: "index.ts exports PlatformWizardEngine facade only"
    enforcement: "single-facade-export + no-test-policy-export contracts"
    guard_ids: [g11_phase1_contract_behaviors]
  - id: FT-P1-06
    claim: "unwrapPlatformResult on barrel"
    repo: "NOT exported — apps use tryFromPlugin + PlatformResult"
    enforcement: phase-1.contract.spec.ts
    guard_ids: [g11_phase1_contract_behaviors]
  - id: FT-P1-07
    claim: "Sticky initError on failed bootstrap"
    repo: "REMOVED — tryInit re-attempts; tryFromPlugin eager"
    enforcement: cold-start.contract.spec.ts
  - id: FT-P1-08
    claim: "Single facade package.json export"
    repo: 'exports["."] only; "./*": null'
    enforcement: single-facade-export contract
    guard_ids: [g11_phase1_contract_behaviors]
  - id: FT-P1-09
    claim: "forceCellId production-safe"
    repo: "Only via createPlatformWizardEngineForTests scope policy — NOT public RuleContext"
    enforcement: phase-1.contract + rule.engine tests
  - id: FT-P1-10
    claim: "IngressSanitizationError → platform codes"
    repo: "ingress-sanitization-map.ts → SANITIZE_* PlatformCoreErrorCode"
    enforcement: adversarial + contract tests
  - id: FT-P1-11
    claim: "Facade test share g13"
    repo: "PHASE_1_FACADE_TEST_RATIO_MIN = 0.6 on closure specs excl test/unit/**"
    enforcement: g13_facade_test_ratio
    guard_ids: [g13_facade_test_ratio]
    stale_doc_warning: "mdoc §4.6 lists conflicting 30% package policy — REPO uses 60% closure ratio"
  - id: FT-P1-12
    claim: "Subphase 1.4 = StepEngine class"
    repo: "render-plan.steps plain functions only — step.engine.ts removed from src/"
    enforcement: file layout §3.4 + subphase_1_4_naming_law
  - id: FT-P1-13
    claim: "MAP §14.1 architect sign-off"
    repo: "Human checkbox may remain open while technical gate green"
    status: OPEN_HUMAN unless reports/phase-1-closure-readiness signed
```

---

