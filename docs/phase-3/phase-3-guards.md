# Phase 3 — Guards (p3\_\*)

> **Split (2026-08-01):** static foundation = `phase-3:guard`; apps certification = `phase-3:apps-cert`. Full DoD = `phase-3:gate` (both). Residual (wired into `phase-6:gate` only): `phase-3:apps-cert:post-test`, `phase-3:apps-cert:floors`. See [`phase-3-guard-apps-cert-split.mdoc`](./phase-3-guard-apps-cert-split.mdoc).

## GUARDS — STATIC (`phase-3-guard.mjs`)

```yaml
phase_3_guard_entrypoint:
  package_json: "node scripts/guards/phase-3-guard.mjs"
  alias: pnpm run phase-3:guard
  report: reports/phase-3-guard-YYYY-MM-DD.json
  env: "PHASE_3_GATE_REPORT=YYYY-MM-DD optional slug"
  anti_hollow: "PASS ≠ apps DoD — run phase-3:apps-cert or phase-3:gate for release"

thresholds_file: scripts/guards/gate-thresholds.mjs
WORKSPACE_SDK_TEST_MIN_phase3: 100
WORKSPACE_STARTER_TEST_MIN_phase3: 15
APPS_API_TEST_MIN_phase3: 20
APPS_WEB_TEST_MIN_phase3: 10
note: "Sdk/starter floors enforced by phase-3:apps-cert. API/Web mins enforced inside phase-3:api-gate / phase-3:web-gate (invoked by apps-cert)."

phase_3_guard_checks_execution_order:
  - id: p3_doc_gate
    enforcementId: P3-E-DOC-GATE
    command: pnpm run doc-gate
  - id: p3_apps_web_exists
    enforcementId: P3-E-APP-HOOK
    check: apps/web/package.json exists
  - id: p3_apps_api_exists
    enforcementId: P3-E-DB-01
    check: apps/api/package.json exists
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
  - id: p3_theme_react_verify_exports
    enforcementId: P3-E-L01
    command: pnpm --filter @app-tour/theme-react run verify:exports
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

guard_ids_static:
  - p3_doc_gate
  - p3_apps_web_exists
  - p3_apps_api_exists
  - p3_audit_boundary
  - p3_import_boundary
  - p3_guard_architecture
  - p3_artifact_surface
  - p3_theme_react_verify_exports
  - p3_canonical_sync
  - p3_ui_select_checkbox_optional
  - p3_no_denali
```

## APPS CERT — (`phase-3-apps-cert.mjs`)

```yaml
phase_3_apps_cert_entrypoint:
  package_json: "node scripts/guards/phase-3-apps-cert.mjs"
  alias: pnpm run phase-3:apps-cert
  report: reports/phase-3-apps-cert-YYYY-MM-DD.json
  env: "PHASE_3_APPS_CERT_REPORT=YYYY-MM-DD optional slug (falls back to PHASE_3_GATE_REPORT)"

phase_3_apps_cert_checks_execution_order:
  - id: p3_apps_web_lint
    enforcementId: P3-E-APP-HOOK
    command: pnpm --filter @apps/web run lint
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
  - id: p3_api_gate
    enforcementId: P3-E-DB-01
    command: pnpm --filter @apps/api run phase-3:api-gate
  - id: p3_web_gate
    enforcementId: P3-E-APP-HOOK
    command: pnpm --filter @apps/web run phase-3:web-gate

guard_ids_apps_cert:
  - p3_apps_web_lint
  - p3_workspace_sdk_tests
  - p3_starter_build
  - p3_starter_tests
  - p3_api_gate
  - p3_web_gate
```

## APPS CERT POST-TEST — residual (`phase-3-apps-cert-post-test.mjs`)

```yaml
phase_3_apps_cert_post_test_entrypoint:
  package_json: "node scripts/guards/phase-3-apps-cert-post-test.mjs"
  alias: pnpm run phase-3:apps-cert:post-test
  report: reports/phase-3-apps-cert-post-test-YYYY-MM-DD.json
  require_env: "PHASE_3_APPS_CERT_INHERIT_ROOT=1 (fail closed)"
  anti_hollow: "PASS ≠ full phase-3:apps-cert — floors and api/web gate composites not claimed"
  note: "Use only after pnpm build && pnpm test. Full apps-cert remains floor authority."

executed:
  - id: p3_apps_web_lint
    command: pnpm --filter @apps/web run lint
  - id: p3_canonical_sync
    command: pnpm --filter @apps/api run validate:canonical-sync
  - id: p3_apps_web_next_build
    command: WEB_SKIP_GUARD_PREBUILD=1 pnpm --filter @apps/web run build

inherited_by_contract:
  - root pnpm build
  - root pnpm test (sdk, starter, api+pretest, web suites)

skipped_by_contract:
  - sdk/starter suites and starter build
  - phase-3:api-gate / phase-3:web-gate composites
  - api build/test/guards re-run
  - web unit suite re-run

not_enforced_in_this_mode:
  - sdk/starter count floors (full phase-3:apps-cert authority)
  - api-gate PASS / web-gate PASS composites
```

## APPS CERT FLOORS — sdk/starter count probe (`phase-3-apps-cert-floors.mjs`)

```yaml
phase_3_apps_cert_floors_entrypoint:
  package_json: "node scripts/guards/phase-3-apps-cert-floors.mjs"
  alias: pnpm run phase-3:apps-cert:floors
  report: reports/phase-3-apps-cert-floors-YYYY-MM-DD.json
  require_env: "PHASE_3_APPS_CERT_INHERIT_ROOT=1 (fail closed)"
  anti_hollow: "PASS ≠ full phase-3:apps-cert — api/web floors and leaf-gate composites not claimed"
  note: "Use only after root monorepo build && test. Thresholds from gate-thresholds.mjs (no duplicated literals)."

executed:
  - id: workspace_sdk_test_floor
    filter: "./packages/workspace-sdk"
    package_name: "@app-tour/workspace-sdk"
    threshold_source: WORKSPACE_SDK_TEST_MIN.phase3
    evaluate: evaluatePackageTestRun
  - id: starter_test_floor
    filter: "./packages/workspaces/starter"
    package_name: "@app-tour/workspace-starter"
    threshold_source: WORKSPACE_STARTER_TEST_MIN.phase3
    evaluate: evaluatePackageTestRun
  note: "Path filters avoid @app-cloud typo scope; canonical package scope is @app-tour"

inherited_by_contract:
  - root_build (detail: not re-executed)
  - root_test (detail: not re-executed)

not_enforced_in_this_mode:
  - api test count docs
  - web test count docs
  - api-gate composite
  - web-gate composite
```

## OUTER GATE

```yaml
not_in_either_script:
  - pnpm build
  - pnpm test
  - phase-2:guard
  - platform-core test:phase-2
  note: "These run in outer phase-3:gate BEFORE phase-3:guard && phase-3:apps-cert"

phase_3_gate: "pnpm build && pnpm test && platform-core test:phase-2 && phase-2:guard && phase-3:guard && phase-3:apps-cert"
```
