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

## Forensic vs non-forensic (AUDIT-GAP-01 / DEC-045)

| Driver                    | `isForensicStorageDriver()` | `audit_events` on `POST /tours`            | `audit_events` on `PATCH /tours`                | Boot in `NODE_ENV=production`                    |
| ------------------------- | --------------------------- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| `memory`                  | **false**                   | **No** — `persistViaScopedRepository` only | **No** — scoped repo update only                | **Fail** — `PRODUCTION_STORAGE_DRIVER_FORBIDDEN` |
| `prisma` + `DATABASE_URL` | **true**                    | **Yes** — `TOUR_CREATED` in atomic TX      | **Yes** — `TOUR_UPDATED` in atomic TX (DEC-047) | **Pass** when admin URL + RLS checks succeed     |

**Invariant:** `appendAuditEvent` is reachable only on the Prisma atomic path (`useAtomicCanonicalPersist()`). CI guard `guard:forensic-storage` locks boot chain (`main.ts` → `assertProductionRuntimeIntegrity` → `assertProductionStorageDriver`) and forbids stray `appendAuditEvent` call sites outside `atomic-canonical-tour-persist.ts`.

**Phase 3 regression lock (DEC-060 / SCAL-DEBT-05):** `guard:production-storage-driver` asserts the boot chain and that `phase-3:regression-gate` runs `create-tour-storage.spec.ts` + `forensic-storage-driver.spec.ts`. Run: `pnpm run guard:production-storage-driver` from `apps/api`.

**Deploy checklist:** Production must set `STORAGE_DRIVER=prisma`, non-empty `DATABASE_URL`, and distinct `DATABASE_URL_ADMIN`. Running integration tests with `memory` is valid for speed but is **non-forensic** — do not treat green CI as audit coverage unless Postgres tier ran.

**Role split:** `DATABASE_URL` → `app_tour` (or equivalent `NOBYPASSRLS` role); `DATABASE_URL_ADMIN` → owner/postgres for migrations, outbox claim, registry reads. Never point `DATABASE_URL` at a superuser or bypass role (**DM-CT-02**).

**Phase 4.2 exit (P4-E-DATA-01):** document and CI prove tours survive restart with `STORAGE_DRIVER=prisma` + migrations applied.

**Phase 5:** Postgres column `canonical_data` (JSONB SoT); Prisma client field `Tour.canonical` with `@map("canonical_data")` per RULE-001 — see [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) and [`phase-5/appendices/REPO-PROJECT-ALIGNMENT.md`](../../phase-5/appendices/REPO-PROJECT-ALIGNMENT.md).

**Tour reads (DM-CT-03 / DI-RAW-01):** No admin id-only `resolveById`. HTTP GET uses `ScopedTourRepository.findFirst` → tenant-scoped storage only; foreign UUID → **404** (no canonical leak).
