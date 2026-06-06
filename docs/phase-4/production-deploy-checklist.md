# Production deploy checklist (Phase 4 ops)

```yaml
decision: DEC-GAP-03
enforcement:
  - apps/api/src/storage/create-tour-storage.ts
  - apps/api/src/server/production-runtime-env.ts
  - apps/api/src/db/assert-production-database-integrity.ts
  - apps/api/src/db/prisma.ts
  - apps/api/src/tenant-kernel/auth-env.ts
  - apps/api/src/tenant/tenant-registry.ts
boot: apps/api/src/main.ts
related:
  - appendices/env-runtime-matrix.md
  - appendices/production-auth-policy.md
  - appendices/storage-driver-truth.md
  - subphases/4.3-provisioning.md
```

Use this checklist before exposing `@apps/api` on a public ingress. Boot fails closed when required variables are missing or unsafe (`assertAuthEnvironmentIntegrity` + `assertProductionRuntimeIntegrity`). The storage factory (`createTourStorageRepository`) repeats the same production storage guard so a misconfigured process cannot instantiate `InMemoryTourRepository` even if boot order regresses (Phase 1 **DM-CT-01** / **DI-MEM-01**).

## Required environment

| Variable              | Production rule                                 | Why                                                                                   |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`            | **`production`**                                | Enables JWT-only ingress and runtime integrity asserts                                |
| `AUTH_JWT_PUBLIC_KEY` | PEM RS256 public key                            | DEC-023 — no header-only or dev bearer                                                |
| `AUTH_JWT_ISSUER`     | string                                          | JWT verify                                                                            |
| `AUTH_JWT_AUDIENCE`   | string                                          | JWT verify                                                                            |
| `DATABASE_URL`        | Postgres URL (**app role**, `NOBYPASSRLS`)      | Tour SoT + tenant-scoped queries — must **not** use superuser or `BYPASSRLS` role     |
| `DATABASE_URL_ADMIN`  | **Distinct** Postgres URL (owner / bypass role) | Registry reads, outbox relay claim, CASL id probe — must **not** equal `DATABASE_URL` |
| `STORAGE_DRIVER`      | **`prisma`** (explicit recommended)             | Memory driver has no RLS Postgres SoT                                                 |

## Forbidden in production

| Setting                              | Boot / ingress behavior                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `AUTH_ALLOW_DEV_BEARER=true`         | Throws `AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST`                                                |
| `STORAGE_DRIVER=memory`              | Throws `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`                                                   |
| Missing `DATABASE_URL`               | Throws `PRODUCTION_DATABASE_URL_REQUIRED`                                                      |
| Missing or equal admin URL           | Throws `PRODUCTION_DATABASE_URL_ADMIN_REQUIRED` or `PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER` |
| `DATABASE_URL` role with `BYPASSRLS` | Throws `PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS` (live Postgres probe at boot)                  |
| Migrations not applied (RLS off)     | Throws `PRODUCTION_DATABASE_RLS_NOT_APPLIED` (boot probe on tenant tables)                     |
| Static `DEV_TENANTS` fallback        | Disabled — tenant metadata from Postgres only (`isStaticTenantRegistryAllowed()` false)        |
| `POST /internal/tenants/provision`   | Returns 403 — allowed only in `development` or `test`                                          |

## Database bootstrap order

1. Apply Prisma migrations with **owner** credentials (`DATABASE_URL_ADMIN` or `postgres` role) — includes `20260605180000_tours_rls` (DEC-024).
2. Optional legacy reference: `infra/sql/001_tenant_rls.sql` (bootstrap DDL documentation).
3. Seed tenant rows via controlled ops tooling — **not** via public `/internal/*` in production.
4. Runtime API uses `DATABASE_URL` (app role) for tour I/O with `set_config('app.current_tenant_id', …, true)` per transaction.

## Auth ingress verification

- All tour and tenant-config routes require `Authorization: Bearer <RS256 JWT>`.
- JWT `member` role must include non-empty `workspace_id` / `workspaceId` (F-10).
- Conflicting JWT claim aliases (`tenant_id` vs `tenantId`, etc.) are rejected (F-11).

```bash
# Unit — auth + production runtime (no Postgres)
pnpm --filter @apps/api exec node --import tsx --test \
  src/tenant-kernel/auth-env.spec.ts \
  src/server/production-runtime-env.spec.ts \
  src/db/assert-production-database-integrity.spec.ts

# Integration — app role RLS probe (requires Postgres)
pnpm --filter @apps/api exec node --import tsx --test \
  test/0-security/raw-sql-exposure.spec.ts

# Integration — JWT HTTP → POST /tours 201 (F-17)
pnpm --filter @apps/api exec node --import tsx --test \
  test/tenant-security.spec.ts
```

## Post-deploy smoke

1. Health: process started without boot errors.
2. Unauthenticated `POST /tours` → **401** (`UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION`).
3. Valid JWT for seeded tenant → **201** on `POST /tours`.
4. Cross-tenant tour read → **404** or **403** (RLS + CASL).
5. `GET /api/v2/tenant-config` reflects Postgres `tenants.theme` (not static registry).

## JWT key rotation (F-18 / P2-7)

1. Generate new RS256 key pair; deploy `AUTH_JWT_PUBLIC_KEY` (new PEM) to all API replicas.
2. Issue tokens from the **new** private key at the identity provider; keep old public key in config only if dual-verify is required during overlap (not implemented in trunk — plan a maintenance window).
3. Rolling restart `@apps/api` pods so `parse-jwt-bearer` reloads PEM from env (in-process cache invalidates on PEM string change).
4. Smoke: `POST /tours` with fresh JWT → **201**; expired/old-key tokens → **401**.
5. Record rotation date in ops log.

## PR compliance

Before merge, walk [`appendices/http-compliance-checklist.md`](appendices/http-compliance-checklist.md) for HTTP/auth/RLS diffs.

## Network / ops (Phase 6 follow-up)

- Isolate `/internal/*` from public ingress (mTLS or service JWT — DEC-GAP-02).
