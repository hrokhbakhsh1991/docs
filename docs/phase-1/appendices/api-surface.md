# API surface §5

## API SURFACE — PlatformWizardEngine (§5)

```yaml
error_model_layers:
  bootstrap_ingress: PlatformResult via tryFromPlugin tryInit tryCreate
  field_validation: ValidationResult via validateCanonical
  facade_throw: "init() and buildRenderPlan() throw PlatformCoreError — NOT exported unwrapPlatformResult"

usage_example_phase_3_shape:
  import_plugin: 'createStarterWorkspacePlugin from @app-tour/workspace-sdk/plugin'
  import_engine: 'PlatformWizardEngine from @app-tour/platform-core'
  bootstrap: |
    const loaded = PlatformWizardEngine.tryFromPlugin(createStarterWorkspacePlugin(preset));
    if (!loaded.ok) throw loaded.error;
    const engine = loaded.value;
  context:
    tenantId: required — missing → INVALID_RULE_CONTEXT
    dimensions: { variant: "default" }
  output: engine.buildRenderPlan(context)

lazy_alternative:
  flow: "PlatformWizardEngine.create(plugin) → tryInit() or first buildRenderPlan"
  init_failure: NOT sticky — tryInit may re-attempt

isolation_rules:
  one_engine_per_tenant_session: true
  LRU_keyed_by: tenantId + dimensions
  no_cross_tenant: "missing/blank tenantId → INVALID_RULE_CONTEXT"
  concurrent_api: "safe with distinct tenantId per request — rule-engine-concurrency.spec.ts"
  plugin_alias: "create() deep-clones immediately includeTheme:false"

consumer_law_apps:
  allowed_import: "@app-tour/platform-core → PlatformWizardEngine + exported types only"
  forbidden_import:
    - FieldRegistryEngine direct
    - RuleEngine direct
    - render-plan.steps direct from apps
    - "@app-tour/platform-core/engine/..."
```

---

