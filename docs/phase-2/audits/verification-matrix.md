# Phase 2 — Verification matrix

> Guard IDs are **p2_*** from `scripts/guards/phase-2-guard.mjs`. Optional narrative aliases **P2-E-*** map 1:1 — scripts use p2_* only.

```yaml
enforcement_matrix:
  - enforcement_id: P2-E-DT-DIST
    guard_id: p2_design_tokens_dist
    verification: packages/design-tokens/dist/index.css exists
    failure_condition: build artifact missing
  - enforcement_id: P2-E-DT-VALIDATE
    guard_id: p2_validate_design_tokens
    verification: pnpm run validate-design-tokens exit 0
    failure_condition: tokens.meta.json / CSS drift
  - enforcement_id: P2-E-UI-DIST
    guard_id: p2_ui_primitives_dist
    verification: packages/ui-primitives/dist/Button/Button.js exists
    failure_condition: subpath build missing
  - enforcement_id: P2-E-UI-NO-BARREL
    guard_id: p2_ui_primitives_no_barrel
    verification: no "." export; no dist/index.js; audit-boundary PASS
    failure_condition: barrel export or boundary violation
  - enforcement_id: P2-E-ARTIFACT
    guard_id: p2_artifact_surface_guard
    verification: node scripts/guards/artifact-surface-guard.mjs exit 0
    failure_condition: dist/files mismatch allowlist (SB-02)
  - enforcement_id: P2-E-TR-DIST
    guard_id: p2_theme_react_dist
    verification: packages/theme-react/dist/index.js exists
    failure_condition: theme-react build missing
  - enforcement_id: P2-E-SDK-TESTS
    guard_id: p2_workspace_sdk_tests
    verification: workspace-sdk tests ≥ 50
    failure_condition: count below WORKSPACE_SDK_TEST_MIN.phase2
  - enforcement_id: P2-E-UI-TESTS
    guard_id: p2_ui_primitives_tests
    verification: ui-primitives tests ≥ 12
    failure_condition: count below UI_PRIMITIVES_TEST_MIN.phase2
  - enforcement_id: P2-E-TR-TESTS
    guard_id: p2_theme_react_tests
    verification: theme-react tests ≥ 4
    failure_condition: count below THEME_REACT_TEST_MIN.phase2
  - enforcement_id: P2-E-VISUAL
    guard_id: p2_visual_regression
    verification: ui-primitives test:visual ≥ 4
    failure_condition: count below UI_PRIMITIVES_VISUAL_TEST_MIN.phase2
  - enforcement_id: P2-E-NO-DENALI
    guard_id: p2_no_denali
    verification: rg -i denali phase-2 package src → 0
    failure_condition: denali reference in design-tokens/ui-primitives/theme-react src
  - enforcement_id: P2-E-TR-L01
    guard_id: p2_theme_react_export_allowlist_l01
    verification: exports only "." + files whitelist + verify-export-allowlist.mjs
    failure_condition: extra export keys or harness in files (L-01)
  - enforcement_id: P2-E-TR-NO-INTERNAL
    guard_id: p2_theme_react_no_internal_export
    verification: no ./internal export; no @app-tour/theme-react/internal imports
    failure_condition: SB-01 breach
  - enforcement_id: P2-E-PC-NO-TOKENS
    guard_id: p2_platform_core_no_tokens
    verification: rg design-tokens platform-core package.json src → 0
    failure_condition: platform-core depends on design-tokens
  - enforcement_id: P2-E-ARCH
    verification: pnpm run guard:architecture exit 0
    failure_condition: depcruise violations on phase-2 packages
    note: phase-2:gate step 3 — not inside phase-2:guard
  - enforcement_id: P2-E-IMPORT
    verification: pnpm run guard:import-boundary exit 0
    failure_condition: barrel import @app-tour/ui-primitives
    note: phase-2:gate step 4
  - enforcement_id: P2-E-AUDIT
    verification: pnpm run audit-boundary exit 0
    failure_condition: ui-primitives boundary audit fail
    note: phase-2:gate step 7; also inside p2_ui_primitives_no_barrel
  - enforcement_id: P2-E-GATE
    verification: pnpm run phase-2:gate exit 0
    failure_condition: any of 8 outer steps or p2_* guard fails

appendix_F_row_binding:
  DT-1_DT-2: p2_validate_design_tokens
  DT-3: p2_no_denali
  T-1_T-7: p2_workspace_sdk_tests
  UI-1: p2_visual_regression
  UI-2: p2_ui_primitives_tests
  TR-1_TR-2: p2_theme_react_tests
  PC-1: "pnpm test platform-core ≥148; p2_platform_core_no_tokens"
  G-1: all p2_* in reports/phase-2-gate-*.json
```
