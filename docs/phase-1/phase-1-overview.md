# Phase 1 — Overview & phase detection

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "1"
phase_name: "Platform Core (Schema-Driven Engine)"
north_star: "Platform logic = generic · ZERO workspace imports"
document_status_claim: "Engine + tests + gate green; MAP §14.1 architect sign-off may remain human"
document_closure_claim: "Phase 1 technical DoD met; next = Phase 2 design-tokens"
prerequisite_phase: "0"
prerequisite_gate: "pnpm run phase-0:gate — ALL exit criteria PASS"
legacy_truth: "legacy platform-core MISSING — wizard was Denali-direct"
subphases:
  - id: "1.1"
    name: "Scaffold @app-tour/platform-core"
    pr_label: "Phase: 1.1"
    max_lines_approx: 200
    ci_scope: build
    depends_on: ["phase_0_DONE"]
  - id: "1.2"
    name: "FieldRegistryEngine"
    pr_label: "Phase: 1.2"
    max_lines_approx: 400
    ci_scope: build + test
    depends_on: ["1.1"]
  - id: "1.3"
    name: "RuleEngine + RuleEngineScope + RuleCellIndex"
    pr_label: "Phase: 1.3"
    max_lines_approx: 400
    ci_scope: build + test
    depends_on: ["1.2"]
  - id: "1.4"
    name: "Step ordering — render-plan.steps (NOT StepEngine class)"
    pr_label: "Phase: 1.4"
    max_lines_approx: 300
    ci_scope: build + test
    depends_on: ["1.3"]
    note: "Subphase 1.4 implements plain functions in render-plan.steps.ts — forbidden to introduce StepEngine class"
  - id: "1.5"
    name: "Renderer headless — buildRenderPlan"
    pr_label: "Phase: 1.5"
    max_lines_approx: 500
    ci_scope: build + test
    depends_on: ["1.4"]
  - id: "1.6"
    name: "Guardrails + PlatformWizardEngine facade"
    pr_label: "Phase: 1.6"
    max_lines_approx: 300
    ci_scope: build + test + phase-1:guard
    depends_on: ["1.5"]
phase_detection_blocker: null
```

---

## SECTION 1 — WHY PHASE 1 IS CRITICAL (§1)

```yaml
legacy_wrong_order:
  - "SDK contract → API adapter delegates ALL to legacy strategy"
  - "web still DenaliFieldRenderer + denali in features/tours"
  - "platform-core: MISSING"

app_tour_correct_order:
  - "SDK (phase 0) → platform-core engines (phase 1)"
  - "design-tokens (phase 2) → starter plugin + apps (phase 3)"
  - "denali plugin port (phase 6)"

phase_1_output_package: "@app-tour/platform-core"
inputs:
  - WorkspacePlugin from SDK
  - CanonicalDocument
  - context dimensions + tenantId
outputs:
  - resolved fields via FieldRegistryEngine
  - effective rules via RuleEngine + RuleEngineScope
  - active steps via render-plan.steps
  - RenderPlan headless via buildRenderPlan
constraints:
  - no React in phase 1
  - no Denali — tests use starter fixture only
  - no workspace package imports

enterprise_layers:
  schema_contract: WorkspacePlugin in SDK
  registry_rules: FieldRegistryEngine RuleEngine RuleEngineScope RuleCellIndex
  step_ordering: "render-plan.steps — listStepIds getStepVisibility listActiveSteps"
  render_plan: buildRenderPlan in render-plan.ts

fail_fast_bootstrap:
  eager: "PlatformWizardEngine.tryFromPlugin(plugin)"
  lazy: "PlatformWizardEngine.create(plugin) then tryInit/init or first buildRenderPlan"
  forbidden: "PlatformWizardEngine.fromPlugin"
  no_sticky_init_error: true

facade_only_consumption:
  apps_rule: "ONLY PlatformWizardEngine from @app-tour/platform-core barrel"
  test_exception: "direct engine construction in test/**/*.spec.ts — internal policy only"
```

---

## SECTION 2 — NEGATIVE REQUIREMENTS — ANTI-PATTERNS A1–A10 (§2)

```yaml
anti_patterns_pre_pr_check_ALL_must_be_false:
  - id: A1
    pattern: "Denali import in platform-core"
    detect: 'rg -i denali packages/platform-core -g "!**/*.spec.ts"'
    expect: 0 lines
    guard: g3_no_denali_tokens
    action: revert
  - id: A2
    pattern: "Import packages/workspaces/*"
    detect: pnpm run guard:architecture
    rule: platform-core-no-workspaces
    action: revert
  - id: A3
    pattern: "Import legacy/"
    detect: pnpm run guard:architecture
    rule: no-legacy-imports
    action: revert
  - id: A4
    pattern: "React/DOM in platform-core"
    detect: 'rg react packages/platform-core'
    guard: g4_no_react_imports
    action: "move to ui-primitives phase 2+"
  - id: A5
    pattern: "if (workspaceType === 'denali')"
    detect: code review
    enforcement: none in depcruise
    action: "policy in plugin not core"
  - id: A6
    pattern: "copy DenaliFieldRenderer"
    detect: path/name grep + A1
    action: "widget in workspace phase 6"
  - id: A7
    pattern: "dual state form + canonical"
    detect: architecture
    action: "immutable canonical ingress; scope LRU per §3.3"
  - id: A8
    pattern: "engine test with denali-domain fixture"
    detect: import path review
    required_fixture: test/fixtures/starter.fixture.ts
    forbidden: denali.fixture in platform-core
  - id: A9
    pattern: "oversized PR 1.2–1.5 combined"
    detect: "diff > ~800 lines"
    action: split per subphase DAG
  - id: A10
    pattern: "merge without green CI"
    detect: phase-1-gate.yml
    command: pnpm run phase-1:gate
    action: block merge

additional_depcruise_rules:
  - name: platform-core-only-sdk
    meaning: "platform-core may depend only on workspace-sdk, config, and internal platform-core src (regex allows platform-core in negative lookahead — see dependency-cruiser.config.js)"
  - name: platform-core-no-apps
    meaning: "platform-core must not import apps/*"
  - name: platform-core-no-workspace-starter-plugin
    meaning: "production src must not import starter plugin paths"
    contract: no-starter-plugin in PHASE_1_CLOSURE_CONTRACTS
```

---

## SECTION 3 — PLATFORM-CORE DEFINITION (§3)

### 3.1 Module responsibilities

```yaml
modules:
  FieldRegistryEngine:
    file: packages/platform-core/src/engine/field-registry.engine.ts
    responsibility: "lookup field by id/path; list by step"
    not: "Denali validation business"
  RuleEngine:
    files:
      - packages/platform-core/src/engine/rule.engine.ts
      - packages/platform-core/src/engine/rule-cell-index.ts
      - packages/platform-core/src/engine/rule-engine.scope.ts
      - packages/platform-core/src/engine/rule-resolution.ts
    responsibility: "resolve cell; merge overrides"
    not: "API persist"
  render_plan_steps:
    file: packages/platform-core/src/engine/render-plan.steps.ts
    type: "plain functions — NOT a StepEngine class"
    apis: [listStepIds, getStepVisibility, listActiveSteps]
    consumes: RuleEngineScope
    not: "Next.js routing"
  buildRenderPlan:
    file: packages/platform-core/src/engine/render-plan.ts
    responsibility: "headless plan kind + path + props hints"
    not: JSX
  PlatformWizardEngine:
    file: packages/platform-core/src/engine/platform-wizard.engine.ts
    responsibility: "facade orchestrating above"
    not: HTTP
  validateCanonical:
    file: packages/platform-core/src/engine/validate-canonical-document.ts
    ingress: parseCanonicalDocumentFromStorage via SDK
```

### 3.2 Allowed dependencies

```yaml
import_law_phase_1:
  allowed:
    - "@app-tour/workspace-sdk"
    - "@app-tour/config dev/tsconfig only"
  forbidden:
    - packages/workspaces/*
    - legacy/*
    - apps/*
    - react react-dom
    - "@app-tour/design-tokens"
    - "@app-tour/ui-primitives"
  phase_2_plus_note: "design-tokens types/CSS names only — never workspace imports"
```

### 3.3 Computational model

```yaml
computational_rules:
  no_document_mutation:
    rule: "CanonicalDocument and WorkspacePlugin ingress clones are deep-frozen"
    meaning: "resolution does not write caller-owned data"
  instance_scope_cache:
    rule: "RuleEngine LRU scopeCacheByTenant + RuleEngineScope memo mutate engine instance"
    safe_when: "every call passes tenantId + dimensions in RuleContext"
    forbidden: "RuleEngine as global singleton across tenants without RuleContext"
  pure_resolution_per_call:
    rule: "Same frozen inputs + RuleContext → deterministic resolveCellId / buildRenderPlan"
  facade_session_state:
    create: "clones plugin immediately via parseWorkspacePluginFromStorage includeTheme:false"
    runtime: "field/rule engines on first tryInit or plan/validate"
    one_engine_per_tenant_session: true
  immutable_outputs: "readonly arrays/objects in API surface"
  no_io: "DB HTTP filesystem forbidden in platform-core"
```

### 3.4 Folder structure (repo truth)

```yaml
required_tree:
  - packages/platform-core/package.json
  - packages/platform-core/tsconfig.json
  - packages/platform-core/src/index.ts
  - packages/platform-core/src/contracts/canonical-field-validation-contract.ts
  - packages/platform-core/src/engine/platform-wizard.engine.ts
  - packages/platform-core/src/engine/field-registry.engine.ts
  - packages/platform-core/src/engine/rule.engine.ts
  - packages/platform-core/src/engine/rule-engine.scope.ts
  - packages/platform-core/src/engine/rule-cell-index.ts
  - packages/platform-core/src/engine/rule-resolution.ts
  - packages/platform-core/src/engine/render-plan.steps.ts
  - packages/platform-core/src/engine/render-plan.ts
  - packages/platform-core/src/engine/validate-canonical-document.ts
  - packages/platform-core/src/types/
  - packages/platform-core/src/errors/
  - packages/platform-core/src/utils/canonical-path.ts
  - packages/platform-core/src/utils/canonical-value*.ts
  - packages/platform-core/test/fixtures/starter.fixture.ts
  - packages/platform-core/test/phase-1.contract.spec.ts
  - packages/platform-core/test/facade-integration.spec.ts
  - packages/platform-core/test/unit/engine/*.spec.ts

forbidden_under_src:
  - __fixtures__/
  - field-resolution.ts
  - step.engine.ts
  - render-plan.builder.ts
  - StepEngine class
```

### 3.5 Engine API bindings

```yaml
FieldRegistryEngine_api:
  static_tryCreate: "tryCreate(registry) → PlatformResult"
  static_create: "create(registry) → throws on duplicate"
  getById: "O(1) Map lookup"
  listByStep: "frozen per-step arrays at bootstrap"
  tryAssertKnownFieldIds: "UNKNOWN_FIELD_ID on orphan override"
  min_tests: 7
  spec: packages/platform-core/test/unit/engine/field-registry.engine.spec.ts

RuleEngine_api:
  RuleContext_public:
    tenantId: string required
    dimensions: Readonly<Record<string, string>>
  forceCellId: "ONLY RuleContextResolution + test factory — NOT public RuleContext"
  createScope: "→ RuleEngineScope cached per tenant+dimensions"
  resolveCellId: "scope.resolveCellId()"
  resolveEffectiveField: "scope.resolveEffectiveField(fieldId)"
  EffectiveFieldState: [fieldId, entry, hidden, required]
  min_tests: 33
  specs:
    - packages/platform-core/test/unit/engine/rule.engine.spec.ts
    - packages/platform-core/test/unit/engine/rule-cell-index.spec.ts
    - packages/platform-core/test/rule-engine-concurrency.spec.ts

render_plan_steps_api:
  listStepIds: "(wizard, fieldEngine) → readonly string[]"
  getStepVisibility: "(wizard, fieldEngine, stepId, scope) → StepVisibility"
  listActiveSteps: "(wizard, fieldEngine, scope) → readonly string[]"
  StepVisibility_enum: [active, hidden, empty]
  min_tests: 6
  spec: packages/platform-core/test/unit/engine/render-plan.steps.spec.ts
  not: "StepEngine class"

buildRenderPlan_api:
  signature: "buildRenderPlan(wizard, fieldEngine, ruleEngine, context, options?) → readonly RenderStepPlan[]"
  RenderFieldPlan: [fieldId, kind, canonicalPath, required, hidden, stepId, uiHints?]
  composite_kind: 'uiHints.compositeId — no widget resolve in phase 1'
  min_tests: 7
  spec: packages/platform-core/test/unit/engine/render-plan.spec.ts
```

---

