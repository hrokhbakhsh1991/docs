# Phase 4 — Storage driver truth (apps/api)

```yaml
agent_load_tier: T0_execution
owner: apps/api/src/storage/create-tour-storage.ts
corrects_doc_drift: "TOUR_STORAGE env name in older subphase drafts"
```

| Env / condition                   | Driver   | Notes                                                                                                                                                                      |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER=memory`           | InMemory | Unit tests, local without DB — **non-forensic** for tenant isolation (no Postgres RLS; shared process singleton — **DI-MEM-01**). **Forbidden** when `NODE_ENV=production` |
| `STORAGE_DRIVER=prisma`           | Prisma   | Requires `DATABASE_URL`                                                                                                                                                    |
| _(unset)_ + `NODE_ENV=production` | prisma   | Fail-closed if no `DATABASE_URL`; boot + factory both throw                                                                                                                |
| _(unset)_ + non-production        | memory   | **Not** Postgres SoT — 4.2 must set explicit prisma for dev SoT                                                                                                            |

## Production fail-closed (DM-CT-01 / DM-CT-02)

`assertProductionStorageDriver()` in `create-tour-storage.ts` runs from boot and the storage factory.

`assertProductionDatabaseIntegrity()` in `assert-production-database-integrity.ts` runs at boot **after** env checks when `NODE_ENV=production` and `STORAGE_DRIVER=prisma`:

| Production misconfig           | Error                                    |
| ------------------------------ | ---------------------------------------- |
| Missing / empty `DATABASE_URL` | `PRODUCTION_DATABASE_URL_REQUIRED`       |
| `STORAGE_DRIVER=memory`        | `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`    |
| Missing / equal admin URL      | `PRODUCTION_DATABASE_URL_ADMIN_*`        |
| App role has `BYPASSRLS`       | `PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS` |
| Tenant table missing RLS       | `PRODUCTION_DATABASE_RLS_NOT_APPLIED`    |

Memory driver partitions reads by `tenantId` argument but does **not** provide Postgres RLS, audit append-only tables, or outbox SoT — never use on public ingress.

**Role split:** `DATABASE_URL` → `app_tour` (or equivalent `NOBYPASSRLS` role); `DATABASE_URL_ADMIN` → owner/postgres for migrations, outbox claim, registry reads. Never point `DATABASE_URL` at a superuser or bypass role (**DM-CT-02**).

**Phase 4.2 exit (P4-E-DATA-01):** document and CI prove tours survive restart with `STORAGE_DRIVER=prisma` + migrations applied.

**Phase 5:** Postgres column `canonical_data` (JSONB SoT); Prisma client field `Tour.canonical` with `@map("canonical_data")` per RULE-001 — see [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) and [`phase-5/appendices/REPO-PROJECT-ALIGNMENT.md`](../../phase-5/appendices/REPO-PROJECT-ALIGNMENT.md).

**Tour reads (DM-CT-03 / DI-RAW-01):** No admin id-only `resolveById`. HTTP GET uses `ScopedTourRepository.findFirst` → tenant-scoped storage only; foreign UUID → **404** (no canonical leak).
