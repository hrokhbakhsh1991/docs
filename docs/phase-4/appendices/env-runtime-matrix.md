# Phase 4 — Environment & runtime matrix

```yaml
source_of_truth: apps/api/.env.example
storage_factory: apps/api/src/storage/create-tour-storage.ts
docker: infra/docker-compose.yml
```

## Required for subphases

| Subphase | Variables / infra | Default pitfall |
|----------|-------------------|-----------------|
| **4.0** | `NODE_ENV=test` for AUTH tests; optional `AUTH_ALLOW_DEV_BEARER` | bearer enabled in prod |
| **4.1** | none beyond workspace build | — |
| **4.2** | `STORAGE_DRIVER=prisma`, `DATABASE_URL`, Docker Postgres **5433** | unset driver → memory SoT |
| **4.3** | tenant headers / JWT per [`tenant-security.spec.ts`](../../../apps/api/test/tenant-security.spec.ts) | missing `x-authenticated-tenant-id` |
| **4.4** | seeded `tenants.theme` JSON; host labels `tenant-a` / `tenant-b` | mock theme only |
| **4.5** | none beyond platform-events package | — |
| **4.6** | Node 24, full monorepo build | Node 22 → engines FAIL |

## apps/api variables

| Variable | Values | Phase 4 role |
|----------|--------|--------------|
| `PORT` | 3001 | API listen |
| `AUTH_ALLOW_DEV_BEARER` | `true` only in test | P4-E-AUTH-01 |
| `AUTH_JWT_PUBLIC_KEY` | PEM | prod-like auth |
| `AUTH_JWT_ISSUER` / `AUDIENCE` | strings | JWT verify |
| `STORAGE_DRIVER` | `memory` \| `prisma` | P4-E-DATA-01 |
| `DATABASE_URL` | postgres URL | required if prisma |
| `MAX_TOURS_PER_TENANT` | int | RF-SCALE-3 cap |
| `MAX_TOURS_GLOBAL` | int | RF-SCALE-3 cap |

## Docker (4.2)

```yaml
postgres:
  host_port: 5433
  database: app_tour_dev
  sql_order:
    - infra/sql/001_tenant_rls.sql
    - infra/sql/002_phase5_data_layer.sql  # after Phase 5 start only
```

## Session variable (RLS)

```sql
-- First statement in transaction (Phase 4+5)
SELECT set_config('app.current_tenant_id', '<tenant-uuid>', true);
```

See [`storage-driver-truth.md`](storage-driver-truth.md).
