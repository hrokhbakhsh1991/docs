# Appendix F — Test matrix

## TEST MATRIX APPENDIX F (A-1..G-3)

```yaml
test_matrix_appendix_F:
  - id: A-1
    layer: ability
    scenario: tenant A cannot access tenant B theme
    expect: deny
    path: packages/workspace-sdk/test/auth/
  - id: A-2
    layer: ability
    scenario: admin can access workspace theme
    expect: allow
    path: packages/workspace-sdk/test/auth/ability.spec.ts
  - id: W-1
    layer: apps/web
    scenario: prelint without guards hacked
    expect: PASS
    command: pnpm --filter @apps/web run lint
    guard: p3_apps_web_lint
  - id: W-2
    layer: apps/web
    scenario: import barrel in fixture
    expect: FAIL P3-E-BARREL
    verify: test/barrel-hunt.spec.ts + audit-boundary
  - id: W-3
    layer: apps/web
    scenario: Playwright create tour
    expect: pass
    status: SOFT_BACKLOG
    blocking: false
  - id: W-4
    layer: apps/web
    scenario: CASL deny → no --ws-* on DOM
    expect: pass
    status: SOFT_BACKLOG
    partial: test/workspace-wizard-host.security.spec.tsx unit-level
  - id: API-1
    layer: apps/api
    scenario: health
    expect: 200
    guard: p3_api_gate
  - id: API-2
    layer: apps/api
    scenario: cross-tenant read
    expect: 403
    guard: p3_api_gate
  - id: UI-3
    layer: ui-primitives
    scenario: Select subpath + wiring
    expect: PASS
    status: optional_3_3_x
  - id: UI-4
    layer: ui-primitives
    scenario: Checkbox a11y
    expect: PASS
    status: optional_3_3_x
  - id: PKG-1
    layer: guards
    scenario: artifact-surface
    expect: PASS
    command: pnpm run guard:artifact-surface
    guard: p3_artifact_surface
  - id: G-3
    layer: gate
    scenario: phase-3-gate
    expect: PASS
    command: pnpm run phase-3:gate

gate_count_floors:
  source: scripts/guards/gate-thresholds.mjs
  workspace_sdk_phase3: 100
  workspace_starter_phase3: 15
  apps_api_phase3: 20
  apps_web_phase3: 10
  note: "Select/Checkbox UI-3 UI-4 do NOT block G-3 when p3_ui_select_checkbox_optional ok"
```

---

