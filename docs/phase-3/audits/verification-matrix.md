# Phase 3 — Verification matrix

> Guards: **p3_*** split across `phase-3-guard.mjs` (static) and `phase-3-apps-cert.mjs` (apps). Enforcement: **P3-E-*** (`phase-3-enforcement.md`). Split doc: [`phase-3-guard-apps-cert-split.mdoc`](../phase-3-guard-apps-cert-split.mdoc).

```yaml
enforcement_matrix:
  - enforcement_id: P3-E-DOC-GATE
    guard_id: p3_doc_gate
    runner: phase-3:guard
    verification: pnpm run doc-gate exit 0
    failure_condition: documentation-sync / markdoc / PR template / audit-boundary fail
  - enforcement_id: P3-E-APP-HOOK
    guard_id: p3_apps_web_exists
    runner: phase-3:guard
    verification: apps/web/package.json exists
    failure_condition: apps/web scaffold missing
  - enforcement_id: P3-E-DB-01
    guard_id: p3_apps_api_exists
    runner: phase-3:guard
    verification: apps/api/package.json exists
    failure_condition: apps/api scaffold missing
  - enforcement_id: P3-E-APP-HOOK
    guard_id: p3_apps_web_lint
    runner: phase-3:apps-cert
    verification: pnpm --filter @apps/web run lint exit 0
    failure_condition: prelint guards or ESLint fail
  - enforcement_id: P3-E-BARREL
    guard_id: p3_audit_boundary
    runner: phase-3:guard
    verification: pnpm run audit-boundary exit 0
    failure_condition: ui-primitives boundary violation
  - enforcement_id: P3-E-BARREL
    guard_id: p3_import_boundary
    runner: phase-3:guard
    verification: pnpm run guard:import-boundary exit 0
    failure_condition: barrel import @app-cloud/ui-primitives
  - enforcement_id: P3-E-WS-01
    guard_id: p3_guard_architecture
    runner: phase-3:guard
    verification: pnpm run guard:architecture exit 0
    failure_condition: depcruise / no-legacy-imports violation
  - enforcement_id: P3-E-ARTIFACT
    guard_id: p3_artifact_surface
    runner: phase-3:guard
    verification: pnpm run guard:artifact-surface exit 0
    failure_condition: dist/files mismatch allowlist (SB-02)
  - enforcement_id: P3-E-CASL-01
    guard_id: p3_workspace_sdk_tests
    runner: phase-3:apps-cert
    verification: workspace-sdk tests ≥ 100
    failure_condition: count below WORKSPACE_SDK_TEST_MIN.phase3
  - enforcement_id: P3-E-WS-01
    guard_id: p3_starter_build
    runner: phase-3:apps-cert
    verification: pnpm --filter @app-cloud/workspace-starter build exit 0
    failure_condition: starter build fail
  - enforcement_id: P3-E-WS-01
    guard_id: p3_starter_tests
    runner: phase-3:apps-cert
    verification: workspace-starter tests ≥ 15
    failure_condition: count below WORKSPACE_STARTER_TEST_MIN.phase3
  - enforcement_id: P3-E-L01
    guard_id: p3_theme_react_verify_exports
    runner: phase-3:guard
    verification: pnpm --filter @app-cloud/theme-react run verify:exports exit 0
    failure_condition: L-01 export allowlist breach
  - enforcement_id: P3-E-DB-01
    guard_id: p3_api_gate
    runner: phase-3:apps-cert
    verification: pnpm --filter @apps/api run phase-3:api-gate exit 0
    failure_condition: API tests or canonical gate below APPS_API_TEST_MIN.phase3
  - enforcement_id: P3-E-APP-HOOK
    guard_id: p3_web_gate
    runner: phase-3:apps-cert
    verification: pnpm --filter @apps/web run phase-3:web-gate exit 0
    failure_condition: web tests below APPS_WEB_TEST_MIN.phase3 or hook guards fail
  - enforcement_id: P3-E-CANONICAL-34
    guard_id: p3_canonical_sync
    runner: phase-3:guard
    verification: pnpm --filter @apps/api run validate:canonical-sync exit 0
    failure_condition: dual-write or canonical drift
  - enforcement_id: P3-UI-01/02
    guard_id: p3_ui_select_checkbox_optional
    runner: phase-3:guard
    verification: "./select ./checkbox exports optional"
    required: false
    failure_condition: none — not merge blocker per DRIFT-P3-08
  - enforcement_id: P3-E-WS-01
    guard_id: p3_no_denali
    runner: phase-3:guard
    verification: denali-free scan on kernel/design src
    failure_condition: denali reference in scoped src
  - enforcement_id: P3-E-GATE-OUTER
    verification: pnpm run phase-3:gate exit 0
    failure_condition: any outer step fails
    outer_steps: [build, test, platform-core test:phase-2, phase-2:guard, phase-3:guard, phase-3:apps-cert]

appendix_F_row_binding:
  A-1_A-2: p3_workspace_sdk_tests + test/auth/
  W-1: p3_apps_web_lint
  W-2: p3_import_boundary + p3_audit_boundary
  W-3_W-4: SOFT_BACKLOG — not in phase-3-guard
  API-1_API-2: p3_api_gate
  UI-3_UI-4: p3_ui_select_checkbox_optional
  PKG-1: p3_artifact_surface
  G-3: phase-3:gate all steps
```
