# Centralized Web test ownership

Tests under `apps/web/tests/` are **not** co-located with `apps/web/src/`. This file maps `src/` modules to those suites.

Tour wizard Playwright smoke/integration lives under `apps/web/src/features/tours/__tests__/` (co-located with the feature) and is **not** listed here.

Pre-commit uses `scripts/test-owners-core.mjs` for entries with `precommit: true` and `runner: node`. Playwright suites (`runner: playwright`) are documented for CI and local `pnpm test:vrt` but are **not** run on pre-commit.

## Conventions

| Field | Meaning |
|--------|---------|
| `src` | Globs relative to `apps/web/`. |
| `tests` | Globs relative to `apps/web/tests/`. |
| `precommit` | Whether staged `src` changes trigger the suite in pre-commit. |
| `runner` | `playwright` or `node`. |

## Module index (human)

| Module | Primary `src` | Centralized tests |
|--------|----------------|-------------------|
| auth | `lib/auth/`, `app/api/auth/`, login routes | `auth/**`, `smoke/auth-bff-smoke-routes.ts` |
| identity-users | `src/features/identity/`, `app/(app)/users/`, leader review | `users-optimistic-role.spec.ts`, `leader_review_*.test.ts` |
| registrations-bookings | bookings UI, registrations feature | `bookings.spec.ts` |
| tours | `src/features/tours/`, tour pages | `tours-crud.spec.ts`, `e2e/denali-ux-integrity.spec.ts` |
| tenant-host | tenant middleware, workspace hosts | `tenant/workspace-host-rsc.spec.ts` |
| app-shell | global routes, dashboard | `smoke/routes.spec.ts`, `smoke/pre-release-flow.spec.ts` |
| audit | corruption guardrails | `audit/corruption-test.spec.ts` |
| visual | UI playground / VRT | `visual/**` |

```owners
app: web
testDir: tests
srcRoot: src
owners:
  - module: auth
    src:
      - lib/auth/**
      - app/api/auth/**
      - app/auth/**
      - app/login/**
      - src/**/auth/**
    tests:
      - auth/**
      - smoke/auth-bff-smoke-routes.ts
    precommit: false
    runner: playwright

  - module: identity-users
    src:
      - src/features/identity/**
      - app/(app)/users/**
      - app/(app)/leader/**
    tests:
      - users-optimistic-role.spec.ts
      - leader_review_access.test.ts
      - leader_review_rbac.test.ts
    precommit: false
    runner: playwright

  - module: registrations-bookings
    src:
      - src/features/registrations/**
      - app/(app)/bookings/**
    tests:
      - bookings.spec.ts
    precommit: false
    runner: playwright

  - module: tours
    src:
      - src/features/tours/**
      - app/(app)/tours/**
      - lib/services/tours.service.ts
    tests:
      - tours-crud.spec.ts
      - e2e/denali-ux-integrity.spec.ts
    precommit: false
    runner: playwright

  - module: tenant-host
    src:
      - lib/tenant/**
      - middleware.ts
      - src/middleware/**
    tests:
      - tenant/**
    precommit: false
    runner: playwright

  - module: app-shell
    src:
      - app/(app)/dashboard/**
      - app/layout.tsx
      - app/page.tsx
    tests:
      - smoke/routes.spec.ts
      - smoke/pre-release-flow.spec.ts
    precommit: false
    runner: playwright

  - module: audit
    src:
      - src/**
    tests:
      - audit/**
    precommit: false
    runner: playwright

  - module: visual
    src:
      - app/ui-playground/**
      - packages/ui/**
    tests:
      - visual/**
    precommit: false
    runner: playwright
```
