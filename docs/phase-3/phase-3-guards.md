# Phase 3 — Guards (p3\_\*)

## GUARDS — FULL p3\_\* LIST (phase-3-guard.mjs)

```yaml
phase_3_guard_entrypoint:
  package_json: "node scripts/guards/phase-3-guard.mjs"
  alias: pnpm run phase-3:guard
  report: reports/phase-3-gate-YYYY-MM-DD.json
  env: "PHASE_3_GATE_REPORT=YYYY-MM-DD optional slug"

thresholds_file: scripts/guards/gate-thresholds.mjs
WORKSPACE_SDK_TEST_MIN_phase3: 100
WORKSPACE_STARTER_TEST_MIN_phase3: 15
APPS_API_TEST_MIN_phase3: 20
APPS_WEB_TEST_MIN_phase3: 10
note: "API/Web mins enforced inside phase-3:api-gate / phase-3:web-gate test runs invoked by guard — not separate p3_* count parsers for api/web"

phase_3_guard_checks_execution_order:
  - id: p3_doc_gate
    enforcementId: P3-E-DOC-GATE
    command: pnpm run doc-gate
    steps: [documentation-sync, markdoc-validate, PR template, audit-boundary]
    note: "Duplicated in phase-3:gate step 8 before phase-3:guard — intentional"
  - id: p3_apps_web_exists
    enforcementId: P3-E-APP-HOOK
    check: apps/web/package.json exists
  - id: p3_apps_api_exists
    enforcementId: P3-E-DB-01
    check: apps/api/package.json exists
  - id: p3_apps_web_lint
    enforcementId: P3-E-APP-HOOK
    command: pnpm --filter @apps/web run lint
    note: "runs prelint guards"
  - id: p3_audit_boundary
    enforcementId: P3-E-BARREL
    command: pnpm run audit-boundary
  - id: p3_import_boundary
    enforcementId: P3-E-BARREL
    command: pnpm run guard:import-boundary
  - id: p3_guard_architecture
    enforcementId: P3-E-WS-01
    command: pnpm run guard:architecture
  - id: p3_artifact_surface
    enforcementId: P3-E-ARTIFACT
    command: pnpm run guard:artifact-surface
  - id: p3_workspace_sdk_tests
    enforcementId: P3-E-CASL-01
    command: pnpm --filter @app-tour/workspace-sdk test
    threshold: 100
  - id: p3_starter_build
    enforcementId: P3-E-WS-01
    command: pnpm --filter @app-tour/workspace-starter build
  - id: p3_starter_tests
    enforcementId: P3-E-WS-01
    command: pnpm --filter @app-tour/workspace-starter test
    threshold: 15
  - id: p3_theme_react_verify_exports
    enforcementId: P3-E-L01
    command: pnpm --filter @app-tour/theme-react run verify:exports
  - id: p3_api_gate
    enforcementId: P3-E-DB-01
    command: pnpm --filter @apps/api run phase-3:api-gate
  - id: p3_web_gate
    enforcementId: P3-E-APP-HOOK
    command: pnpm --filter @apps/web run phase-3:web-gate
  - id: p3_canonical_sync
    enforcementId: P3-E-CANONICAL-34
    command: pnpm --filter @apps/api run validate:canonical-sync
  - id: p3_ui_select_checkbox_optional
    enforcementId: P3-UI-01/02
    required: false
    check: "./select and ./checkbox in ui-primitives exports"
  - id: p3_no_denali
    enforcementId: P3-E-WS-01
    scan: "AST walk — denali in kernel/design package src only (Phase 6+ apps/sdk exempt; no rg)"
    paths:
      - packages/platform-core/src
      - packages/workspaces/starter/src
      - packages/theme-react/src
      - packages/ui-primitives/src
    phase_6_note: "Denali wiring allowed in apps/web lazy loader, apps/api workspace-plugins, workspace-sdk exports — see phase-6 entry gate"

guard_ids_binding_summary:
  - p3_doc_gate
  - p3_apps_web_exists
  - p3_apps_api_exists
  - p3_apps_web_lint
  - p3_audit_boundary
  - p3_import_boundary
  - p3_guard_architecture
  - p3_artifact_surface
  - p3_workspace_sdk_tests
  - p3_starter_build
  - p3_starter_tests
  - p3_theme_react_verify_exports
  - p3_api_gate
  - p3_web_gate
  - p3_canonical_sync
  - p3_ui_select_checkbox_optional
  - p3_no_denali

not_in_phase_3_guard_script:
  - pnpm build
  - pnpm test
  - phase-2:gate
  note: "These run in outer phase-3:gate chain BEFORE phase-3:guard"
```

---
