# TEST MATRIX (Appendix F — rows)

## TEST MATRIX APPENDIX F (DT-1..G-1)

```yaml
test_matrix_appendix_F:
  - id: DT-1
    layer: design-tokens
    scenario: validate-design-tokens vs tokens.meta.json
    expect: PASS
    command: pnpm run validate-design-tokens
  - id: DT-2
    layer: design-tokens
    scenario: orphan --* in CSS without meta entry
    expect: FAIL guard
  - id: DT-3
    layer: design-tokens
    scenario: rg -i denali packages/design-tokens
    expect: 0
    guard: p2_no_denali
  - id: T-1
    layer: workspace-sdk
    scenario: theme without --ws- prefix after normalize
    expect: reject INVALID_THEME_CSS_KEY
  - id: T-2
    layer: workspace-sdk
    scenario: 65th cssVariable key
    expect: THEME_CSS_VARIABLE_LIMIT
  - id: T-3
    layer: workspace-sdk
    scenario: value with expression(
    expect: UNSAFE_THEME_CSS_VALUE
  - id: T-4
    layer: workspace-sdk
    scenario: parseWorkspacePluginFromStorage + valid theme
    expect: deep-freeze + pass
  - id: T-5
    layer: workspace-sdk
    scenario: 'optionalStylesheet: "../../../etc/passwd"'
    expect: reject INVALID_THEME_STYLESHEET
  - id: T-6
    layer: workspace-sdk
    scenario: plugin without theme
    expect: pass optional
  - id: T-7
    layer: workspace-sdk
    scenario: homoglyph in CSS key name
    expect: reject ASCII-only
  - id: UI-1
    layer: ui-primitives
    scenario: Button light/dark snapshot or RTL class
    expect: render
    command: pnpm --filter @app-tour/ui-primitives run test:visual
  - id: UI-2
    layer: ui-primitives
    scenario: FieldShell aria-invalid
    expect: a11y attrs present
  - id: TR-1
    layer: theme-react
    scenario: cascade platform → tenant mock → workspace
    expect: "--ws-* scoped"
  - id: TR-2
    layer: theme-react
    scenario: workspace override subtree only
    expect: sibling unchanged
  - id: PC-1
    layer: platform-core
    scenario: regression suite
    expect: "≥ 148 pass (phase-1 floor); no design-tokens import"
    command: pnpm --filter @app-tour/platform-core test
    guard: p2_platform_core_no_tokens
  - id: G-1
    layer: guards
    scenario: phase-2:guard all p2_* checks
    expect: PASS
    command: pnpm run phase-2:guard

gate_count_floors:
  source: scripts/guards/gate-thresholds.mjs
  workspace_sdk_phase2: 50
  ui_primitives_phase2: 12
  theme_react_phase2: 4
  ui_primitives_visual_phase2: 4
  design_tokens_guard_jobs: 1
  note: "Doc §13.1 backlog Select/Checkbox does NOT block G-1 unless PR declares otherwise"
```

---
