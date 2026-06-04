# Phase 3 — Overview & phase detection

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "3"
phase_name: "Design System & App Integration"
north_star: "Platform shell = generic · Workspace = injectable plugin · Authority = CASL before ingress · Visual = subpath-only primitives"
document_status_claim: "Closed: Zero-Debt Verified — platform scaffold 3.0–3.5 — pnpm run phase-3:gate exit 0"
document_closure_claim: "Starter workspace + apps/api + apps/web prove engine, tokens, primitives, theme chain, CASL — no barrel, no dist leakage, no false Security Seal"
prerequisite_phase: "2"
prerequisite_gate: "pnpm run phase-2:gate — ALL exit criteria PASS (Closed: Zero-Debt Verified)"
legacy_truth: "First real consumer of @app-tour/ui-primitives + @app-tour/theme-react — NOT Denali until phase 6"
subphases:
  - id: "3.0"
    name: "CASL & authority layer"
    pr_label: "Phase: 3.0"
    max_lines_approx: 500
    ci_scope: workspace-sdk auth tests + theme-react provider CASL deny
    depends_on: ["phase_2_DONE"]
    enforcement_ids: [P3-E-CASL-01]
  - id: "3.1"
    name: "packages/workspaces/starter"
    pr_label: "Phase: 3.1"
    max_lines_approx: 600
    ci_scope: "@app-tour/workspace-starter build + test + depcruise P3-E-WS-01"
    depends_on: ["3.0"]
    docs_prerequisite: "pnpm run doc-gate green before merge (MAP §19)"
  - id: "3.2"
    name: "apps/api"
    pr_label: "Phase: 3.2"
    max_lines_approx: 800
    ci_scope: phase-3:api-gate
    depends_on: ["3.0", "3.1"]
    enforcement_ids: [P3-E-DB-01, P3-E-API-01]
  - id: "3.3"
    name: "apps/web"
    pr_label: "Phase: 3.3"
    max_lines_approx: 1000
    ci_scope: phase-3:web-gate + predev/prebuild/prelint guards
    depends_on: ["3.0", "3.1", "3.2"]
    enforcement_ids: [P3-E-BARREL, P3-E-APP-HOOK]
    note: "Split per app area if PR exceeds size — scaffold verified 2026-06-03"
  - id: "3.3.x"
    name: "Select/Checkbox primitives (optional)"
    pr_label: "Phase: 3.3.x"
    depends_on: ["3.3"]
    enforcement_ids: [P3-E-PRIM-NEW, P3-E-PRIM-BARREL, P3-E-CSS-01]
    gate_blocking: false
    invariants: [P3-UI-01, P3-UI-02]
  - id: "3.4"
    name: "canonical SoT only"
    pr_label: "Phase: 3.4"
    max_lines_approx: 400
    depends_on: ["3.2", "3.3"]
    enforcement_ids: [P3-E-CANONICAL-34]
  - id: "3.5"
    name: "observability + phase-3-gate"
    pr_label: "Phase: 3.5"
    depends_on: ["3.0", "3.1", "3.2", "3.3", "3.4"]
    enforcement_ids: [P3-E-GATE, P3-E-DOC-GATE]
    ci_scope: phase-3:gate + reports/phase-3-gate-*.json
phase_detection_blocker: null
```

---

## SECTION 1 — WHY PHASE 3 AFTER ZERO-DEBT PHASE 2 (§1)

```yaml
platform_order_law:
  phase_0: "workspace-sdk contract"
  phase_1: "platform-core headless"
  phase_2: "visual layer — Closed: Zero-Debt Verified"
  phase_3: "starter workspace + apps/* + CASL — THIS DOCUMENT"
  phase_4: "tenant-kernel RLS + subdomain"
  phase_6: "Denali plugin"

product_rule: "Phase 3 = first real consumer of @app-tour/ui-primitives and @app-tour/theme-react"
failure_if_skip_phase_2:
  - SB-01 mapper bypass in apps/web
  - SB-02 dist/ leakage in apps
  - barrel pollution in shell

phase_2_to_3_risk_mitigation:
  - risk: "Barrel @app-tour/ui-primitives for convenience"
    rule: "subpath only + AST guard from first line apps/*"
  - risk: "dist/tokens/ or mapper on disk"
    rule: "guard:artifact-surface + files whitelist"
  - risk: "CSS literal in primitive"
    rule: "wiring test + dist grep — P3-E-CSS-01"
  - risk: "Theme without CASL"
    rule: "ability.can before validateWorkspaceThemeIngress"
  - risk: "Denali in shell"
    rule: "static workspaces/denali FORBIDDEN until phase 6 — p3_no_denali"

phase_3_one_liner: >
  Starter workspace + thin web + api apps prove engine, tokens, primitives,
  theme chain, and CASL work together — no barrel, no dist leakage,
  no false Security Seal language.
```

---

## SECTION 2 — ENTERPRISE STANDARDS AS RULES (§2)

```yaml
enterprise_integration_rules:
  monorepo_boundaries:
    - id: E-3.2-01
      rule: "pnpm-workspace.yaml + depcruise packages apps explicit graph"
      enforcement: [guard:architecture, P3-E-WS-01]
    - id: E-3.2-02
      rule: "dependency-cruiser.config.js + import-boundary-ast.mjs enforce import law"
      enforcement: P3-E-BARREL
    - id: E-3.2-03
      rule: "phase-3:gate on merge + phase-2:gate frozen baseline inside chain"
      ci: .github/workflows/phase-3-gate.yml
  design_system_packaging:
    - id: E-3.2-04
      rule: "NO root barrel export * for ui-primitives or theme-react mapper subpaths"
      decision: "REJECTED single-package barrel — SB-01/SB-03"
    - id: E-3.2-05
      rule: "subpath exports @app-tour/ui-primitives/{button,input,...} ONLY"
      status: REQUIRED
    - id: E-3.2-06
      rule: "sideEffects false + explicit *.module.css paths per primitive"
      status: REQUIRED
  apps_barrel_prevention:
    - id: E-3.2-07
      rule: "ESLint no-restricted-imports @app-tour/ui-primitives in apps/web"
      file: apps/web/.eslintrc.cjs
    - id: E-3.2-08
      rule: "import-boundary-ast ui-primitives-barrel-import = FAIL"
    - id: E-3.2-09
      rule: "audit-ui-primitives-boundary.mjs real import/require only"
    - id: E-3.2-10
      rule: "apps/web predev/prebuild/prelint run guards before Next.js"
      enforcement: P3-E-APP-HOOK
  ci_zero_debt:
    - id: E-3.2-11
      rule: "Per-PR phase-3:gate subset via workflow"
    - id: E-3.2-12
      rule: "Per-sub-phase PR label Phase: 3.x + enforcement row §13"
    - id: E-3.2-13
      rule: "postbuild prune-dist + guard:artifact-surface per publishable"
    - id: E-3.2-14
      rule: "Doc-Code: Phase Gate Audit Table update same PR when closing sub-phase"
      enforcement: P3-E-DOC-01
    - id: E-3.2-15
      rule: "Forensic audit archived docs/audits/ before phase close"
  esm_cjs_decision:
    - id: E-3.2-16
      rule: "Phase 3.3 default A — CJS dist via tsc; Next 15 transpilePackages"
      forbidden_until_eval: "ESM-only or dual-package without P3-PKG-02 PR"
    - id: E-3.2-17
      rule: "P3-PKG-02 evaluate ESM/dual in 3.4+ — must keep guard:artifact-surface + @apps/web build green"
      status: OPTIONAL_PR
```

---

## SECTION 4 — PHASE 2 DEBT → PHASE 3 INVARIANTS (§4)

```yaml
phase_3_invariants:
  invariant_vs_backlog: "Invariant = blocking in phase-3:gate or sub-gate; Backlog = optional/non-blocking"
  items:
    - phase2_id: Select_P1_9_2
      phase2_status: Backlog_not_Complete
      phase3_id: P3-UI-01
      requirement: "subpath ./select + tokenized CSS + wiring test"
      subphase: "3.3.x"
      enforcement: P3-E-PRIM-NEW
      gate: "p3_ui_select_checkbox_optional required:false"
    - phase2_id: Checkbox_P1_9_2
      phase3_id: P3-UI-02
      requirement: "subpath ./checkbox + a11y contract"
      subphase: "3.3.x"
      enforcement: P3-E-PRIM-NEW
      gate: optional
    - phase2_id: P2-005_CSS_literals
      phase3_id: P3-UI-00
      requirement: "zero literal in src and dist CSS"
      enforcement: P3-E-CSS-01
    - phase2_id: Badge_global
      phase3_id: P3-UI-03
      requirement: "FORBIDDEN :global(.theme-*) in primitives"
      enforcement: P3-E-CSS-02
    - phase2_id: SB-02
      phase3_id: P3-PKG-01
      requirement: "dist/ subset of files"
      enforcement: P3-E-ARTIFACT
    - phase2_id: Barrel_packages
      phase3_id: P3-APP-01
      requirement: "0 barrel in apps/**"
      enforcement: P3-E-BARREL
    - phase2_id: SB-01
      phase3_id: P3-THM-01
      requirement: "theme-react exports only ."
      enforcement: P3-E-L01
    - phase2_id: CASL_before_ingress
      phase3_id: P3-SEC-01
      requirement: "non-swappable handoff order §6.3"
      enforcement: P3-E-CASL-01
      status: Verified_3_0
    - phase2_id: Consumer_minus_3
      phase3_id: P3-APP-02
      requirement: "@apps/web guards from first line — predev hooks"
      enforcement: P3-E-APP-HOOK
    - phase2_id: Root_build_minus_3
      phase3_id: P3-CI-01
      requirement: "phase-3:gate includes artifact-surface"
      enforcement: P3-E-GATE
    - phase2_id: ESM_tree_shake
      phase3_id: P3-PKG-02
      requirement: "evaluate ESM/dual 3.4+"
      enforcement: optional_PR
```

---

## SECTION 5 — HARD / SOFT OUTPUTS (§5)

```yaml
hard_outputs:
  - id: H1
    artifact: "ability layer + tests"
    paths:
      - packages/workspace-sdk/src/auth/ability.ts
      - packages/workspace-sdk/src/auth/casl/index.ts
      - packages/workspace-sdk/test/auth/
    note: "defineAbilityFor in casl/index.ts — NOT legacy src/auth/ability.spec.ts path in stale md"
  - id: H2
    artifact: "@app-tour/workspace-starter plugin"
    path: packages/workspaces/starter/
  - id: H3
    artifact: "@apps/api health + POST /tours + CASL queries"
    path: apps/api/
    sot: "in_memory.tour_records — NOT Postgres Prisma accessibleBy runtime in 3.2"
  - id: H4
    artifact: "@apps/web ThemeProviderChain + wizard host + subpath primitives"
    path: apps/web/
  - id: H5
    artifact: "canonical-only write path"
    rule: "no dual-write — LegacyCanonicalAdapter.write throws DUAL_WRITE_FORBIDDEN"
  - id: H6
    artifact: "phase-3:gate + phase-3-guard report JSON"
    script: scripts/guards/phase-3-guard.mjs
    report: reports/phase-3-gate-YYYY-MM-DD.json
  - id: H7
    artifact: "Phase Gate Audit Table row Closed"
    location: MIGRATION-MAP.md §18

soft_outputs:
  - Playwright_create_tour_happy_path
  - Playwright_theme_denied_when_CASL_fails
  - ESLint_no_restricted_imports_apps_web: "implemented — blocking via lint"
  - optional_root_build_artifact_guard: "covered by phase-3:gate not bare pre-commit ci:integrity"

dod_one_liner: >
  Starter on real engine with web/api shells proving CASL, ingress, subpath primitives,
  canonical SoT — Phase Gate Audit Table metrics 0 for blocking columns.
```

---

## SECTION 6 — INTEGRATION ARCHITECTURE (§6)

```yaml
layer_stack:
  apps:
    packages: [apps/web, apps/api]
    pre_hooks: [guard:import-boundary, audit-boundary]
    web_additional: guard:no-raw-wizard-input
    features: [ThemeProviderChain, WorkspaceWizardHost, routes]
  workspaces_starter:
    path: packages/workspaces/starter
    role: "first-party plugin — theme/tokens.css fieldRegistry ruleSet"
  platform_packages:
    platform_core: "← workspace-sdk"
    theme_react: "← design-tokens"
    ui_primitives: "← design-tokens subpaths only"

apps_web_target_structure:
  app/: "Next.js App Router"
  src/shell/: "layout nav — NO Denali"
  src/wizard/: "WorkspaceWizardHost loader"
  src/providers/: "AppProviders ThemeProviderChain"
  src/bootstrap/: "listBootstrapWorkspacePlugins() — NO static workspaces/*"
  package_json_hooks:
    predev: "guard:import-boundary && audit-boundary && guard:no-raw-wizard-input"
    prebuild: same
    prelint: same

verified_scaffold_2026_06_03:
  - app/layout.tsx
  - src/providers/app-providers.tsx
  - src/shell/home-shell.tsx
  - src/wizard/workspace-wizard-host.tsx
  - route: /tours/new
  - src/bootstrap/workspace-plugins.ts
  - src/session/dev-app-session.ts

security_handoff_non_swappable:
  order:
    - step: 1
      action: "Resolve actor + tenant context"
    - step: 2
      action: "ability.can('access', WorkspaceTheme) OR TenantAuthz equivalent"
      subphase: "3.0"
      repo: "defineAbilityFor in packages/workspace-sdk/src/auth/casl/index.ts"
    - step: 3
      action: "validateWorkspaceThemeIngress(...)"
      phase: "2.2.1 ingress rules"
    - step: 4
      action: "snapshotWorkspaceTheme → Provider → DOM"
  forbidden_order: "ingress before CASL"
  theme_react: "WorkspaceThemeProvider CASL gate before useThemeIngressGuard"

import_law_apps:
  allowed:
    - "@app-tour/ui-primitives/button"
    - "@app-tour/ui-primitives/input"
    - "@app-tour/ui-primitives/field-shell"
    - "@app-tour/ui-primitives/alert"
    - "@app-tour/ui-primitives/badge"
    - "@app-tour/theme-react"
    - "@app-tour/workspace-sdk"
    - "@app-tour/design-tokens/styles.css"
  forbidden:
    - "@app-tour/ui-primitives"
    - "@app-tour/theme-react/internal"
    - "packages/workspaces/denali static"
    - "legacy/*"
```

---

