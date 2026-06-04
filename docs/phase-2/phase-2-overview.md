# Phase 2 — Overview

> Narrative: [`../phase-2-design-system.md`](../phase-2-design-system.md) · Markdoc: [`../phase-2-design-system.mdoc`](../phase-2-design-system.mdoc)

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "2"
phase_name: "Design System & Enterprise Visual Layer"
north_star: "Platform semantics = generic tokens · Workspace brand = injectable theme · Tenant = visual boundary hook (phase 4)"
document_status_claim: "Hard outputs §4.1 delivered; phase-2:gate green; Security Seal via restricted subpath exports (SB-01 remediated)"
document_closure_claim: "Phase 2 technical DoD met for tokens + primitives + theme contract + harness; Select/Checkbox backlog → phase 3"
prerequisite_phase: "1"
prerequisite_gate: "pnpm run phase-1:gate — ALL exit criteria PASS (platform-core ≥148, closure ≥56, g1–g8, g10–g13)"
legacy_truth: "@tour/ui tokens + subset components port to design-tokens / ui-primitives — NOT Denali widgets in core"
subphases:
  - id: "2.1"
    name: "packages/design-tokens"
    pr_label: "Phase: 2.1"
    max_lines_approx: 600
    ci_scope: build + validate-design-tokens
    depends_on: ["phase_1_DONE"]
  - id: "2.2"
    name: "WorkspaceThemeContract in workspace-sdk"
    pr_label: "Phase: 2.2"
    max_lines_approx: 400
    ci_scope: workspace-sdk test
    depends_on: ["2.1"]
  - id: "2.2.1"
    name: "Theme Ingress Security (nested under 2.2)"
    pr_label: "Phase: 2.2"
    parent_subphase: "2.2"
    max_lines_approx: 200
    ci_scope: workspace-sdk theme ingress tests T-1–T-7
    depends_on: ["2.2"]
    note: "Not a separate PR label — deliver with 2.2; rules T-1 through T-7 enforced in assertWorkspacePlugin + parseWorkspacePluginFromStorage"
  - id: "2.3"
    name: "packages/ui-primitives"
    pr_label: "Phase: 2.3"
    max_lines_approx: 800
    ci_scope: build + test + test:visual
    depends_on: ["2.1"]
    overlap_note: "May start after 2.1; must not block on 2.2 for primitive CSS work"
  - id: "2.4"
    name: "ThemeProvider chain (theme-react harness)"
    pr_label: "Phase: 2.4"
    max_lines_approx: 500
    ci_scope: theme-react build + test
    depends_on: ["2.2", "2.3"]
    implementation_path: "packages/theme-react (option A — recommended)"
  - id: "2.5"
    name: "Visual QA + phase-2-guard"
    pr_label: "Phase: 2.5"
    max_lines_approx: 300
    ci_scope: phase-2:gate + reports/phase-2-gate-*.json
    depends_on: ["2.1", "2.2", "2.3", "2.4"]
phase_detection_blocker: null
```

---

## SECTION 1 — WHY PHASE 2 BEFORE APPS AND DENALI (§1)

```yaml
platform_order_law:
  phase_0: "workspace-sdk contract"
  phase_1: "platform-core headless — RenderPlan without color"
  phase_2: "visual enterprise layer — THIS DOCUMENT"
  phase_3: "starter workspace + apps/web shell + CASL ability.ts"
  phase_4: "tenant-kernel RLS + TenantThemeProvider production"
  phase_6: "Denali plugin — widgets + theme/tokens.css in workspace"

product_rule: "Denali = first product workspace — NOT first visual layer"
failure_if_skip_phase_2:
  - DenaliFieldRenderer pattern returns
  - hardcoded colors in shell
  - shell cannot stay generic

legacy_visual_failures:
  - problem: "@tour/ui + feature CSS var(--color-*) without platform/workspace split"
    phase_2_rule: "three token levels §5"
  - problem: "Denali widgets inside feature tree"
    phase_2_rule: "composite only in packages/workspaces/* phase 6"
  - problem: "tenant + workspace theme merged"
    phase_2_rule: "TenantThemeConfig phase 4 vs WorkspaceThemeContract phase 2"
  - problem: "no WorkspacePlugin.theme in new contract"
    phase_2_rule: "optional theme on WorkspacePlugin in SDK"

phase_2_one_liner: >
  Every generic component and every workspace plugin can have enterprise appearance
  without Denali import and without color in platform-core —
  only semantic CSS variables and theme contract.

visual_layer_architecture:
  design_tokens: "platform CSS source of truth"
  workspace_sdk: "WorkspaceThemeContract + validation — no design-tokens dep"
  ui_primitives: "semantic-only CSS Modules — subpath exports"
  theme_react: "PlatformThemeProvider → TenantThemeProvider → WorkspaceThemeProvider"
  apps_web: "phase 3+ consumes above"
```

---

## SECTION 2 — ENTERPRISE STANDARDS AS RULES (§2)

```yaml
enterprise_design_rules:
  microkernel_contribution:
    - id: E-2.1-01
      rule: "Stable core platform-core + WorkspacePlugin; capabilities swappable"
      source: "VS Code / Shopify embedded apps pattern"
    - id: E-2.1-02
      rule: "Plugins do not wire directly to plugins — host props + future event bus"
      phase: "4–5 for events"
    - id: E-2.1-03
      rule: "Manifest contract before loader — WorkspacePlugin + contractVersion MAP §8"
  multi_tenant_visual:
    - id: E-2.2-01
      rule: "SaaS pool: shared bundle + per-tenant CSS variables on subtree"
      phase: 4
    - id: E-2.2-02
      rule: "Workspace brand: plugin theme.cssVariables + optional stylesheet"
      phase: "2–3"
    - id: E-2.2-03
      rule: "Enterprise silo: dedicated DB/schema — NOT UI fork"
      phase: 7
    - id: E-2.2-04
      rule: "Tenant A must not load Tenant B stylesheet — scope [data-tenant-id] or provider subtree"
      phase: 4
    - id: E-2.2-05
      rule: "tenantId in phase 2 ONLY harness/test simulation — production enforcement phase 4"
  trust_model_ui:
    - id: E-2.3-01
      rule: "Phase 2 first-party only: @app-tour/design-tokens, @app-tour/ui-primitives"
    - id: E-2.3-02
      rule: "NO runtime npm marketplace plugins in phase 2"
    - id: E-2.3-03
      rule: "Third-party iframe/postMessage or signed manifest — after platform DoD MAP §9"
  design_tokens_w3c_practice:
    - id: E-2.4-01
      rule: "Primitives: spacing, radius, font-size, raw palette — stable names mutable values"
    - id: E-2.4-02
      rule: "Semantics: --color-surface, --color-text-primary — components read semantics ONLY"
    - id: E-2.4-03
      rule: "Workspace brand: --ws-color-accent, --ws-font-display — prefix --ws-"
    - id: E-2.4-04
      rule: "Dark mode: html class theme-light / theme-dark — legacy port pattern"
  accessibility_i18n_minimum:
    - id: E-2.5-01
      rule: "Focus ring via semantic --color-focus-ring"
    - id: E-2.5-02
      rule: "Contrast AA text/primary light AND dark — document in playground"
    - id: E-2.5-03
      rule: "RTL: logical properties margin-inline in primitives; Persian font phase 3 next/font"
    - id: E-2.5-04
      rule: "Motion: respect prefers-reduced-motion in token/harness"
  performance_budget_baseline:
    - id: E-2.6-01
      metric: "CSS tokens bundle gzip"
      target: "≤ 15 KB"
      note: "CSS only — no fonts in package"
    - id: E-2.6-02
      metric: "ui-primitives tree-shake"
      target: "each primitive separate package.json export subpath"
    - id: E-2.6-03
      metric: "First paint harness"
      target: "no network — Storybook/playground static"
```

---

## SECTION 3 — LEGACY PORT TABLE + ANTI-PATTERNS V1–V7 (§3)

```yaml
legacy_port_table:
  - asset: "Token CSS light/dark"
    legacy_path: legacy/packages/ui/src/tokens/*.css
    phase_2: port
    destination: packages/design-tokens
  - asset: validate-design-tokens
    legacy_path: legacy/scripts/validate-design-tokens.js
    phase_2: rewrite
    destination: scripts/guards/validate-design-tokens.mjs + tokens.meta.json
    forbidden_source: [legacy/scripts/validate-design-tokens.js, docs/10-product/design_system.md]
  - asset: "Button, Input, FormField, Alert, Badge, Card"
    legacy_path: legacy/packages/ui/src/components/*
    phase_2: subset
    destination: packages/ui-primitives
  - asset: TenantThemeConfig shape
    legacy_path: legacy/libs/core/.../tenant-config.ts
    phase_2: types_only
    destination: "WorkspaceThemeContract inspiration + phase 4 tenant"
  - asset: build-tenant-theme-style
    legacy_path: legacy/apps/web/lib/tenant/
    phase_2: defer_algorithm
    destination: "phase 4 TenantThemeProvider"
  - asset: "ThemeProvider / ThemeInjector"
    legacy_path: "legacy/apps/web/lib/theme, lib/tenant"
    phase_2: defer
    destination: "phase 3–4 apps/web"
  - asset: "AppLayout, WorkspaceShell"
    legacy_path: "legacy/apps/web, @tour/ui/layout"
    phase_2: defer
    destination: "phase 3 shell"
  - asset: JalaliDatePicker
    legacy_path: "@tour/ui"
    phase_2: defer
    destination: "phase 6 Denali or phase 3 if starter needs"
  - asset: Tailwind
    legacy_path: none
    phase_2: forbidden
    destination: "CSS Modules + vars"
  - asset: Tour catalog themes
    legacy_path: settings/tour-themes
    phase_2: forbidden
    destination: "domain data phase 6"

anti_patterns_pre_pr_check_ALL_must_be_false:
  - id: V1
    pattern: "--denali-* or denali-green in new packages"
    detect: 'rg -i denali packages/design-tokens packages/ui-primitives packages/theme-react/src'
    expect: 0 lines
    guard: p2_no_denali
    action: revert
  - id: V2
    pattern: "import @tour/ui from app-tour"
    detect: pnpm run guard:architecture
    action: forbidden
  - id: V3
    pattern: "hex color in platform-core"
    detect: 'rg "#[0-9a-fA-F]{3,8}" packages/platform-core'
    expect: 0
    action: revert
  - id: V4
    pattern: "primitive without semantic token"
    detect: code review
    rule: "only var(--color-*) in component modules"
    action: fix
  - id: V5
    pattern: "static import workspaces/denali in ui-primitives"
    detect: pnpm run guard:architecture
    rule: ui-primitives-no-workspaces
    action: revert
  - id: V6
    pattern: "WorkspacePlugin theme without validation"
    detect: "assertWorkspacePlugin extended + SDK tests"
    action: extend validation
  - id: V7
    pattern: "contrast break in dark — token removed"
    detect: visual QA Storybook light/dark
    action: block merge

barrel_ban_P3_E_BARREL:
  forbidden_import: '@app-tour/ui-primitives'
  allowed_subpaths: [button, input, field-shell, alert, badge]
  scripts:
    - pnpm run guard:import-boundary
    - pnpm run audit-boundary
  guard: p2_ui_primitives_no_barrel
  forensic: SB-02 leakage risk from barrel pulling undeclared dist/**
```

---

## SECTION 4 — HARD / SOFT OUTPUTS (§4)

```yaml
hard_outputs_delivered:
  - packages/design-tokens: "build + export CSS + tokens.meta.json"
  - packages/ui-primitives: "Button, Input, FieldShell, Alert — Complete §13"
  - packages/ui-primitives_backlog: "Select, Checkbox — phase 3 NOT Complete"
  - WorkspaceThemeContract: "on WorkspacePlugin optional theme"
  - assertWorkspacePlugin: "validates theme when present"
  - packages/theme-react: "provider chain path A — NOT apps/web-harness required"
  - phase-2-guard: "p2_* checks + reports/phase-2-gate-*.json"
  - dependency-cruiser: "design-tokens / ui-primitives / theme-react rules"
  - forbidden_in_phase_2: [apps/api, Postgres, packages/workspaces/denali]

soft_outputs:
  - Storybook_or_playground: "Storybook in ui-primitives — sanity visual"
  - render_plan_mapping_table: "§5.4 in doc — process may remain open"
  - reports: "reports/phase-2-gate-YYYY-MM-DD.json after phase-2:gate"

dod_one_liner: >
  Starter can render in phase 3 with semantic tokens and primitives
  without workspace-specific color in core;
  workspace theme injects only from plugin.
```

---

## SECTION 5 — MULTI-LAYER THEME ARCHITECTURE (§5)

```yaml
token_levels:
  level_1_platform:
    package: "@app-tour/design-tokens"
    variables: ["--spacing-*", "--font-size-*", "--color-surface", "--color-text-*"]
  level_2_tenant:
    phase: 4
    variables: ["logo", "accent override", "--color-primary* from TenantThemeConfig"]
    phase_2_role: "types stub only — mock TenantThemeProvider in harness"
  level_3_workspace:
    contract: WorkspaceThemeContract
    variables: ["--ws-color-accent", "--ws-font-display", optionalStylesheet]
    owner: WorkspacePlugin.theme

provider_chain_target:
  PlatformThemeProvider:
    imports: '@app-tour/design-tokens/styles.css'
    props: { mode: "light" | "dark" }
  TenantThemeProvider:
    props: TenantThemeConfig
    phase_2: "static test props — no BFF"
  WorkspaceThemeProvider:
    props: WorkspaceThemeContract
    dom: 'div data-workspace-theme={theme.id} + normalized cssVariables style'
    phase_3: "optionalStylesheet link tag"
    phase_3_security: "ability.can(access) BEFORE validateWorkspaceThemeIngress"

render_plan_to_ui_mapping:
  - kind: text
    primitive: "Input / Textarea"
    uiHints: "multiline?: boolean"
  - kind: number
    primitive: "Input type number"
    uiHints: [min, max]
  - kind: date
    primitive: "placeholder Input"
    uiHints: "Jalali phase 6"
  - kind: enum
    primitive: Select
    uiHints: options from registry
    backlog: "Select component phase 3"
  - kind: boolean
    primitive: Checkbox
    backlog: "Checkbox component phase 3"
  - kind: composite
    primitive: "FieldShell + slot"
    uiHints: "compositeId → plugin widget phase 6"

platform_core_rule: "platform-core does not know color; uiHints opaque for web renderer registry"

theme_ingress_two_layers:
  contract_validation:
    package: workspace-sdk
    when: "plugin load / parseWorkspacePluginFromStorage"
    rules: T-1 through T-7
  runtime_ingress:
    package: theme-react
    when: "before DOM"
    flow: validateWorkspaceThemeIngress → snapshotWorkspaceTheme
  handoff_order_phase_3:
    - defineAbilityFor(context)
    - ability.can(access, workspaceThemeSubject) — deny skips ingress
    - validateWorkspaceThemeIngress
    - snapshotWorkspaceTheme → WorkspaceThemeProvider
  forbidden_order: "ingress before CASL"
```
