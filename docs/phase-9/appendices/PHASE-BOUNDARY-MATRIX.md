# Phase 9 — PR boundary matrix (machine enforcement)

```yaml
contract_id: PHASE-BOUNDARY-MATRIX-P9
matrix_version: "2026-06-08-v2"
authority:
  - docs/phase-9/subphases/9.1-identity-session.md
  - docs/phase-9/subphases/9.2-admin-shell.md
  - docs/phase-9/phase-9-agent-router.md
purpose: Machine-readable PR boundary — block cross-subphase leaks inside release trains
ci_hook:
  script: scripts/guards/p9-boundary-diff.mjs
  npm_script: guard:p9-boundary-diff
  subphase_default: "9.1"
  usage: "pnpm run guard:p9-boundary-diff"
```

## Rules — subphase 9.1 (identity train)

```yaml
rules:
  - subphase: "9.1"
    allowed_write_paths:
      - apps/api/src/identity/**
      - apps/api/prisma/**
      - apps/api/test/identity-*.spec.ts
      - apps/web/app/auth/**
      - apps/web/app/login/**
      - apps/web/app/api/auth/**
      - apps/web/middleware.ts
      - apps/web/lib/auth/**
      - apps/web/test/auth-*.spec.ts
      - apps/web/src/admin/require-operator-session.ts
      - infra/sql/005_identity_production_delta.sql
      - packages/workspace-sdk/src/auth/**
      - packages/workspace-sdk/test/operator-ability.spec.ts
      - docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md
      - docs/phase-9/appendices/identity-web-bff-addendum.md
      - docs/phase-9/**
      - reports/phase-9-entry-verified.yaml
    forbidden_write_paths:
      - apps/web/app/(app)/tours/**
      - apps/web/app/(app)/finance/**
      - apps/web/app/(app)/users/**
      - apps/web/app/(app)/bookings/**
      - packages/platform-core/**
      - packages/workspaces/urban/**
      - legacy/**
    action_on_violation: REJECT_PR_IMMEDIATELY
```

## Subphase 9.2 — admin shell extension

```yaml
subphase_9_2_boundaries:
  allowed_write_paths:
    - apps/web/app/(app)/layout.tsx
    - apps/web/app/(app)/dashboard/**
    - apps/web/src/admin/operator-nav.tsx
    - apps/web/src/admin/**
    - apps/web/test/admin-shell-access.spec.ts
    - apps/web/test/dashboard-smoke.spec.ts
  forbidden_write_paths:
    - apps/web/app/(app)/tours/**
    - apps/api/src/tours/**
    - packages/platform-core/**
  forbidden_patterns_in_9_2_pr:
    - "static import from @app-tour/workspace-denali in layout"
```

## Subphase 9.3 — tours operator

```yaml
subphase_9_3_boundaries:
  allowed_write_paths:
    - apps/web/app/(app)/tours/**
    - apps/api/src/tours/**
    - apps/api/test/tours-operator.spec.ts
    - apps/web/test/tours-list.spec.ts
    - apps/web/test/tours-operator.spec.ts
    - packages/workspaces/denali/src/composites/**
  forbidden_write_paths:
    - apps/web/app/(app)/tours/new/**
    - packages/platform-core/**
  forbidden_route_paths:
    - "(app)/tours/new"
  note: "Wizard remains /tours/new root — DEC-P9-007"
```

## Subphase 9.4 — users RBAC

```yaml
subphase_9_4_boundaries:
  allowed_write_paths:
    - apps/api/src/identity/users*.ts
    - apps/api/src/identity/invites*.ts
    - apps/api/test/identity-users.spec.ts
    - apps/web/app/(app)/users/**
    - apps/web/app/auth/invite/**
    - apps/web/test/users-directory.spec.ts
```

## Subphase 9.5 — bookings ops (Registration Command Center)

```yaml
subphase_9_5_boundaries:
  allowed_write_paths:
    - apps/web/app/(app)/bookings/**
    - apps/web/app/(app)/leader/review/**
    - apps/web/src/features/bookings/**
    - apps/api/src/bookings/**
    - packages/workspace-sdk/src/operator/bookings/**
    - packages/workspaces/denali/src/bookings/**
    - infra/sql/006_operator_bookings_delta.sql
    - apps/api/test/bookings-ops.spec.ts
    - apps/api/test/bookings-create.spec.ts
    - apps/web/test/bookings-approve.spec.ts
    - apps/web/test/bookings-command-center.spec.ts
    - packages/workspace-sdk/test/bookings-ops-manifest.spec.ts
    - packages/workspaces/denali/test/bookings-ops-manifest.spec.ts
    - docs/phase-9/appendices/BOOKINGS-OPS-UX.md
    - docs/phase-9/appendices/TRACEABILITY-MATRIX-9.5.md
  forbidden_write_paths:
    - apps/web/app/(app)/leader/review/**/duplicate-approve-ui/**
```

## Subphase 9.6 — settings registry (DEC-P9-009 · DEC-P9-010)

```yaml
subphase_9_6_boundaries:
  allowed_write_paths:
    - apps/web/app/(app)/settings/**
    - apps/web/src/features/settings/**
    - apps/api/src/settings/**
    - packages/workspace-sdk/src/operator/settings/**
    - packages/workspaces/denali/src/settings/**
    - infra/sql/007_operator_settings_delta.sql
    - apps/api/test/settings-modules.spec.ts
    - apps/api/test/settings-resources.spec.ts
    - apps/api/test/settings-config-version.spec.ts
    - apps/api/test/settings-audit-trail.spec.ts
    - apps/web/test/settings-template.spec.ts
    - apps/web/test/settings-generic-crud.spec.ts
    - packages/workspace-sdk/test/settings-manifest.spec.ts
    - packages/workspaces/denali/test/settings-manifest.spec.ts
    - docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md
    - docs/phase-9/appendices/SETTINGS-RISK-REGISTER-P9.md
    - docs/phase-9/appendices/TRACEABILITY-MATRIX-9.6.md
  forbidden_write_paths:
    - packages/workspaces/urban/**/settings-owner-widen/**
    - packages/platform-core/**/settings/**
    - apps/api/src/modules/settings-locations/**
```

## Subphase 9.7 — finance Denali

```yaml
subphase_9_7_boundaries:
  allowed_write_paths:
    - apps/web/app/finance/** # R1 interim until 9.2 (DEC-P9-017)
    - apps/web/app/(app)/finance/** # target admin shell path
    - apps/api/src/denali-finance/**
    - apps/api/test/finance-ops.spec.ts
    - packages/workspaces/denali/test/finance-admin.spec.ts
    - packages/workspaces/denali/src/finance/**
    - apps/web/test/finance-page.spec.ts
  forbidden_write_paths:
    - apps/api/src/modules/finance/**
    - packages/workspaces/urban/**/finance/**
```

## Global forbidden (all 9.x PRs)

```yaml
global_forbidden:
  - packages/platform-core/**
  - legacy/**
  - runtime import from legacy/
```

## ci_hook manifest

```json
{
  "script": "guard:p9-boundary-diff",
  "documented_in": "docs/phase-9/phase-9-guards.md",
  "guard_check": "p9_boundary_matrix_depth"
}
```
