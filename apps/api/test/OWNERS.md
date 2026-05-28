# Centralized API test ownership

Tests under `apps/api/test/` are **not** co-located with `apps/api/src/`. This file maps each module in `src/` to the centralized tests that exercise it.

Pre-commit (`scripts/precommit-jest-staged.mjs`) reads the machine block below via `scripts/test-owners-core.mjs`. When you change a file under a `src` glob, the listed `tests` run in addition to co-located `*.spec.ts` siblings.

## Conventions

| Field | Meaning |
|--------|---------|
| `module` | Logical owner name (documentation only). |
| `src` | Globs relative to `apps/api/` (usually `src/...`). |
| `tests` | Globs relative to `apps/api/test/`. |
| `precommit` | `true` = run on pre-commit when `src` matches; `false` = manual/CI only. |
| `runner` | `node` = `node --test`; `jest` = Jest project. |

Helpers under `test/helpers/`, `test/e2e/bootstrap.ts`, and similar are not listed; they are pulled in by the suites below.

## Module index (human)

| Module | Primary `src` | Centralized tests |
|--------|----------------|-------------------|
| app-core | `src/app.*`, `src/main.ts` | `api.e2e-spec.ts`, `api.e2e-spec.jest.ts` |
| config | `src/config/` | `config/` |
| database-tenant | `src/database/`, `src/common/tenant/` | `tenant-isolation.spec.ts`, `rls-guardrail.spec.ts`, `common/tenant/`, `modules/tenant/` |
| auth | `src/common/auth/`, `src/modules/auth/` | `e2e/jwt-membership-guard.e2e-spec.ts`, `e2e/jwt-test-keys.ts` (helper), `security/tenant-jwt-scope.unit-spec.ts` |
| identity | `src/modules/identity/` | `modules/identity/`, `e2e/me-profile.e2e-spec.ts`, `e2e/users-*.e2e-spec.ts`, `e2e/invite-*.e2e-spec.ts`, `e2e/ownership-transfer.e2e-spec.ts`, `e2e/workspace-users-mutations.e2e-spec.ts` |
| rbac | `src/common/rbac/` | `modules/rbac/` |
| tours | `src/modules/tours/` | `modules/tours/`, `e2e/tours-*.e2e-spec.ts`, `e2e/tour-wizard-template-isolation.e2e-spec.ts`, `e2e/denali-negative-invariants.e2e-spec.ts` |
| settings-locations | `src/modules/settings-locations/` | `e2e/tour-presets-tenant-isolation.e2e-spec.ts`, `e2e/tour-wizard-template-isolation.e2e-spec.ts` |
| registrations | `src/modules/registrations/` | `registrations/`, `e2e/registrations.e2e-spec.ts`, `e2e/load-concurrency-registration.e2e-spec.ts`, `e2e/tenant-context-leak.e2e-spec.ts` |
| payments | `src/modules/payments/` | `payments/`, `guards/payments-*.ts`, `guards/link-telegram.guard.spec.ts`, `e2e/payments-*.e2e-spec.ts`, `e2e/manual-receipt-flow.e2e-spec.ts`, `e2e/receipt-upload-ownership.e2e-spec.ts` |
| finance | `src/modules/finance/` | `finance/`, `e2e/finance-cutover-integrity.e2e-spec.ts` |
| pricing | `src/modules/pricing/` | `pricing/` |
| reconciliation | `src/modules/reconciliation/` | `reconciliation/` |
| draft-engine | `src/modules/draft-engine/` | `draft-engine/` |
| outbox | `src/modules/outbox/`, `src/common/outbox/` | `outbox/`, `common/audit/financial-outbox-event-types.unit-spec.ts` |
| idempotency | `src/modules/idempotency/` | `idempotency/`, `jobs/idempotency-cleanup.job.spec.ts` |
| ops | `src/modules/ops/` | _(co-located specs only)_ |
| infra | `src/infra/` | `infra/` |
| security | `src/common/security/` | `security/` |
| jobs | `src/jobs/` | `jobs/` |
| platform-e2e | cross-cutting | `e2e/subdomain-*.e2e-spec.ts`, `e2e/tenant-isolation.e2e-spec.ts`, `e2e/release-gate-journeys.e2e-spec.ts` |

Co-located unit specs under `src/**` are discovered separately; this file only covers `test/`.

```owners
app: api
testDir: test
srcRoot: src
owners:
  - module: app-core
    src:
      - src/app.module.ts
      - src/app.controller.ts
      - src/main.ts
    tests:
      - api.e2e-spec.ts
      - api.e2e-spec.jest.ts
    precommit: false
    runner: node

  - module: config
    src:
      - src/config/**
    tests:
      - config/**
    precommit: true
    runner: node

  - module: database-tenant
    src:
      - src/database/**
    tests:
      - tenant-isolation.spec.ts
      - rls-guardrail.spec.ts
    precommit: false
    runner: node

  - module: tenant-runtime
    src:
      - src/common/tenant/**
      - src/database/tenant-*.ts
      - src/database/runtime-schema-guard.service.ts
    tests:
      - common/tenant/**
      - modules/tenant/**
      - tenant-isolation.spec.ts
      - rls-guardrail.spec.ts
    precommit: true
    runner: node

  - module: auth
    src:
      - src/common/auth/**
      - src/modules/auth/**
    tests:
      - e2e/jwt-membership-guard.e2e-spec.ts
      - security/tenant-jwt-scope.unit-spec.ts
      - security/ownership-access.unit-spec.ts
    precommit: false
    runner: node

  - module: identity
    src:
      - src/modules/identity/**
    tests:
      - modules/identity/**
      - e2e/me-profile.e2e-spec.ts
      - e2e/users-role-rbac.e2e-spec.ts
      - e2e/users-cursor-bulk.e2e-spec.ts
      - e2e/invite-accept-function.e2e-spec.ts
      - e2e/invite-accept-parallel.e2e-spec.ts
      - e2e/invite-role-hierarchy.e2e-spec.ts
      - e2e/ownership-transfer.e2e-spec.ts
      - e2e/workspace-users-mutations.e2e-spec.ts
    precommit: false
    runner: node

  - module: rbac
    src:
      - src/common/rbac/**
    tests:
      - modules/rbac/**
    precommit: true
    runner: node

  - module: tours
    src:
      - src/modules/tours/**
    tests:
      - modules/tours/**
      - e2e/tours-create.e2e-spec.ts
      - e2e/tours-create-profile-authority.e2e-spec.ts
      - e2e/tours-rbac-parity.e2e-spec.ts
      - e2e/tours-leader-integrity.e2e-spec.ts
      - e2e/denali-negative-invariants.e2e-spec.ts
    precommit: false
    runner: node

  - module: settings-locations
    src:
      - src/modules/settings-locations/**
    tests:
      - e2e/tour-presets-tenant-isolation.e2e-spec.ts
      - e2e/tour-wizard-template-isolation.e2e-spec.ts
    precommit: false
    runner: node

  - module: registrations
    src:
      - src/modules/registrations/**
    tests:
      - registrations/**
      - e2e/registrations.e2e-spec.ts
      - e2e/load-concurrency-registration.e2e-spec.ts
      - e2e/tenant-context-leak.e2e-spec.ts
      - guards/public-registration-throttle.spec.ts
    precommit: true
    runner: node

  - module: payments
    src:
      - src/modules/payments/**
    tests:
      - payments/**
      - guards/payments-webhook-signature.guard.unit-spec.ts
      - guards/payments-webhook-skip-throttle.unit-spec.ts
      - guards/link-telegram.guard.spec.ts
      - e2e/payments-webhook-wrong-tenant.e2e-spec.ts
      - e2e/payments-coexistence.e2e-spec.ts
      - e2e/manual-receipt-flow.e2e-spec.ts
      - e2e/receipt-upload-ownership.e2e-spec.ts
    precommit: true
    runner: node

  - module: finance
    src:
      - src/modules/finance/**
    tests:
      - finance/**
      - e2e/finance-cutover-integrity.e2e-spec.ts
    precommit: true
    runner: node

  - module: pricing
    src:
      - src/modules/pricing/**
    tests:
      - pricing/**
    precommit: true
    runner: node

  - module: reconciliation
    src:
      - src/modules/reconciliation/**
    tests:
      - reconciliation/**
    precommit: true
    runner: node

  - module: draft-engine
    src:
      - src/modules/draft-engine/**
    tests:
      - draft-engine/**
    precommit: true
    runner: node

  - module: outbox
    src:
      - src/modules/outbox/**
      - src/common/outbox/**
    tests:
      - outbox/**
      - common/audit/financial-outbox-event-types.unit-spec.ts
    precommit: true
    runner: node

  - module: idempotency
    src:
      - src/modules/idempotency/**
      - src/jobs/idempotency-cleanup.job.ts
    tests:
      - idempotency/**
      - jobs/idempotency-cleanup.job.spec.ts
    precommit: true
    runner: node

  - module: infra
    src:
      - src/infra/**
    tests:
      - infra/**
    precommit: true
    runner: node

  - module: security
    src:
      - src/common/security/**
    tests:
      - security/**
    precommit: true
    runner: node

  - module: platform-e2e
    src:
      - src/common/middleware/**
      - src/common/request-context/**
    tests:
      - e2e/subdomain-multi-tenant.e2e-spec.ts
      - e2e/subdomain-comprehensive.e2e-spec.ts
      - e2e/tenant-isolation.e2e-spec.ts
      - e2e/release-gate-journeys.e2e-spec.ts
    precommit: false
    runner: node
```
