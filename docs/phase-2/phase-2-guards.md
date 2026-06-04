# Phase 2 — Guards (p2_*)

## GUARDS — FULL p2_* LIST (phase-2-guard.mjs)

```yaml
phase_2_guard_entrypoint:
  package_json: "node scripts/phase-2-guard.mjs"
  delegates_to: scripts/guards/phase-2-guard.mjs
  report: reports/phase-2-gate-YYYY-MM-DD.json

thresholds_file: scripts/guards/gate-thresholds.mjs
WORKSPACE_SDK_TEST_MIN_phase2: 50
UI_PRIMITIVES_TEST_MIN_phase2: 12
THEME_REACT_TEST_MIN_phase2: 4
UI_PRIMITIVES_VISUAL_TEST_MIN_phase2: 4

phase_2_guard_checks_execution_order:
  - id: p2_design_tokens_dist
    description: design-tokens dist/index.css exists
    prerequisite: pnpm build
    artifact: packages/design-tokens/dist/index.css
    fail_detail: "run pnpm --filter @app-tour/design-tokens build"
  - id: p2_validate_design_tokens
    description: pnpm run validate-design-tokens
    command: pnpm run validate-design-tokens
    script: scripts/guards/validate-design-tokens.mjs
  - id: p2_ui_primitives_dist
    description: ui-primitives dist/Button/Button.js exists (subpath build; no barrel)
    artifact: packages/ui-primitives/dist/Button/Button.js
  - id: p2_ui_primitives_no_barrel
    description: "ui-primitives: no barrel export; apps use subpaths only (audit-boundary)"
    checks:
      - 'package.json exports must not include "."'
      - "package.json must not set main/types barrel fields"
      - "dist/index.js must not exist"
      - scripts/guards/audit-ui-primitives-boundary.mjs PASS
  - id: p2_artifact_surface_guard
    description: theme-react + ui-primitives dist matches files/exports allowlist
    command: node scripts/guards/artifact-surface-guard.mjs
    note: "also runs on postbuild — duplicated in gate step 6"
  - id: p2_theme_react_dist
    description: theme-react dist/index.js exists
    artifact: packages/theme-react/dist/index.js
  - id: p2_workspace_sdk_tests
    description: workspace-sdk tests ≥ 50 (enforced count)
    command: pnpm --filter @app-tour/workspace-sdk run test
    threshold: 50
  - id: p2_ui_primitives_tests
    description: ui-primitives tests ≥ 12 (enforced count)
    command: pnpm --filter @app-tour/ui-primitives run test
    threshold: 12
  - id: p2_theme_react_tests
    description: theme-react tests ≥ 4 (includes theme ingress guard)
    command: pnpm --filter @app-tour/theme-react run test
    threshold: 4
  - id: p2_visual_regression
    description: ui-primitives test:visual ≥ 4 (enforced count)
    command: pnpm --filter @app-tour/ui-primitives run test:visual
    threshold: 4
  - id: p2_no_denali
    description: rg -i denali phase-2 package src/ → 0
    scan_dirs:
      - packages/design-tokens/src
      - packages/ui-primitives/src
      - packages/theme-react/src
  - id: p2_theme_react_export_allowlist_l01
    description: "theme-react strict exports (.) + files whitelist + blocked subpaths (L-01)"
    checks:
      - 'exports keys only "."'
      - "files array present non-empty"
      - "files must not include dist/harness"
      - packages/theme-react/scripts/verify-export-allowlist.mjs PASS
  - id: p2_theme_react_no_internal_export
    description: no @app-tour/theme-react/internal export or imports
    checks:
      - 'package.json must not export ./internal'
      - 'rg @app-tour/theme-react/internal in packages apps → 0 (excl guard scripts)'
    remediation: SB-01
  - id: p2_platform_core_no_tokens
    description: platform-core must not depend on design-tokens
    command: 'rg design-tokens packages/platform-core/package.json packages/platform-core/src'
    expect: 0

guard_ids_binding_summary:
  - p2_design_tokens_dist
  - p2_validate_design_tokens
  - p2_ui_primitives_dist
  - p2_ui_primitives_no_barrel
  - p2_artifact_surface_guard
  - p2_theme_react_dist
  - p2_workspace_sdk_tests
  - p2_ui_primitives_tests
  - p2_theme_react_tests
  - p2_visual_regression
  - p2_no_denali
  - p2_theme_react_export_allowlist_l01
  - p2_theme_react_no_internal_export
  - p2_platform_core_no_tokens

not_in_phase_2_guard_script:
  - guard:architecture
  - guard:import-boundary
  note: "These run in phase-2:gate outer chain BEFORE phase-2:guard"
```
