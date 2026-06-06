# Phase 4 — Environment & runtime matrix

```yaml
source_of_truth: apps/api/.env.example
storage_factory: apps/api/src/storage/create-tour-storage.ts
docker: infra/docker-compose.yml
```

## Required for subphases

| Subphase | Variables / infra                                                                                    | Default pitfall                     |
| -------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **4.0**  | `NODE_ENV=test` for AUTH tests; optional `AUTH_ALLOW_DEV_BEARER`                                     | bearer enabled in prod              |
| **4.1**  | none beyond workspace build                                                                          | —                                   |
| **4.2**  | `STORAGE_DRIVER=prisma`, `DATABASE_URL`, Docker Postgres **5433**                                    | unset driver → memory SoT           |
| **4.3**  | tenant headers / JWT per [`tenant-security.spec.ts`](../../../apps/api/test/tenant-security.spec.ts) | missing `x-authenticated-tenant-id` |
| **4.4**  | seeded `tenants.theme` JSON; host labels `tenant-a` / `tenant-b`                                     | mock theme only                     |
| **4.5**  | none beyond platform-events package                                                                  | —                                   |
| **4.6**  | Node 24, full monorepo build                                                                         | Node 22 → engines FAIL              |

## apps/api variables

| Variable                       | Values                        | Phase 4 role                                                             |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------ |
| `PORT`                         | 3001                          | API listen                                                               |
| `AUTH_ALLOW_DEV_BEARER`        | `true` only in test           | P4-E-AUTH-01                                                             |
| `AUTH_JWT_PUBLIC_KEY`          | PEM                           | **required** in production (DEC-023)                                     |
| `AUTH_JWT_ISSUER` / `AUDIENCE` | strings                       | JWT verify                                                               |
| `AUTH_DEV_BEARER_TTL_SECONDS`  | int                           | dev bearer `exp` minting in test (default 3600)                          |
| `STORAGE_DRIVER`               | `memory` \| `prisma`          | P4-E-DATA-01; **production must be `prisma`**                            |
| `DATABASE_URL`                 | postgres URL (app role, RLS)  | required if prisma; **required in production**                           |
| `DATABASE_URL_ADMIN`           | postgres URL (owner / bypass) | **required in production**; must differ from `DATABASE_URL` (DEC-GAP-03) |
| `MAX_TOURS_PER_TENANT`         | int                           | RF-SCALE-3 cap                                                           |
| `MAX_TOURS_GLOBAL`             | int                           | RF-SCALE-3 cap                                                           |

## Production runtime integrity (DEC-GAP-03)

Boot calls `assertProductionRuntimeIntegrity()` from `apps/api/src/server/production-runtime-env.ts` alongside `assertAuthEnvironmentIntegrity()`. Storage rules are also enforced in `assertProductionStorageDriver()` inside `create-tour-storage.ts` (factory defense in depth — DM-CT-01):

| Check                                             | Failure code                              | Enforced at              |
| ------------------------------------------------- | ----------------------------------------- | ------------------------ |
| `DATABASE_URL` set                                | `PRODUCTION_DATABASE_URL_REQUIRED`        | Boot + storage factory   |
| `DATABASE_URL_ADMIN` set and ≠ `DATABASE_URL`     | `PRODUCTION_DATABASE_URL_ADMIN_*`         | Boot only                |
| `STORAGE_DRIVER` not `memory`                     | `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`     | Boot + storage factory   |
| App DB role without `BYPASSRLS`                   | `PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS`  | Boot DB probe (DM-CT-02) |
| Tenant RLS tables enabled + forced                | `PRODUCTION_DATABASE_RLS_NOT_APPLIED`     | Boot DB probe            |
| `getPrismaAdmin()` no silent fallback to app pool | throws if admin URL missing in production | Prisma admin client      |

Deploy checklist: [`../production-deploy-checklist.md`](../production-deploy-checklist.md).

## Static tenant registry (HT-01)

`apps/api/src/tenant/tenant-registry.ts` exposes dev seed UUIDs (`DEV_TENANTS`). Resolution policy via `isStaticTenantRegistryAllowed()`:

| Environment                          | Static registry                         |
| ------------------------------------ | --------------------------------------- |
| `production`                         | **Forbidden** — Postgres `tenants` only |
| `test`                               | Allowed (unit / integration without DB) |
| `development` + `DATABASE_URL`       | **Forbidden** — DB-first                |
| `development` without `DATABASE_URL` | Allowed (local memory stack)            |

Call sites: `resolve-registered-tenant.ts`, `resolve-tenant-feature-flags.ts`, `tenant-rate-limiter.ts`. Module-load production warn for `DEV_TENANTS` is gated — no warn when static registry is disabled.

## Docker (4.2)

```yaml
postgres:
  host_port: 5433
  database: app_tour_dev
  migrate_track:
    - "cd apps/api && DATABASE_URL=postgresql://postgres:...@host/tour_db pnpm exec prisma migrate deploy  # owner role for RLS DDL (DEC-024)"
    - "runtime DATABASE_URL=app_tour for API and integration tests"
  sql_order_legacy:
    - infra/sql/001_tenant_rls.sql
    - infra/sql/002_phase5_data_layer.sql
  note: "Migrate-only deploys do not need 001 for tours RLS after 20260605180000_tours_rls; 001 still documents bootstrap DDL"
```

## ALS ↔ RLS alignment (DEC-028)

When tenant ALS is bound, `withTenantRls` / `withCanonicalTransaction` throw `TENANT_RLS_ALS_TENANT_MISMATCH` if the explicit tenant argument differs. Unbound ALS (explicit tenant only) is allowed for admin/relay paths.

CI: `pnpm --filter @apps/api run guard:tenant-isolation` (includes `guard:rls-session-local`) rejects `set_config(..., false)` under `apps/api/src/`.

## Session variable (RLS)

```sql
-- First statement in transaction (Phase 4+5)
SELECT set_config('app.current_tenant_id', '<tenant-uuid>', true);
```

See [`storage-driver-truth.md`](storage-driver-truth.md).
