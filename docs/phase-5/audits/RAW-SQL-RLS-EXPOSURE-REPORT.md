# Raw SQL / Prisma RLS Exposure Audit

**Date:** 2026-06-05  
**Scope:** `apps/api/src`, `apps/api/test`, `packages/` (platform)  
**Live test:** `apps/api/test/0-security/raw-sql-exposure.spec.ts`  
**Postgres:** `127.0.0.1:5434` (`app_tour` + `postgres` admin)

---

## Executive summary

| Metric                                               | Result                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| **HIGH-risk unmitigated production bypasses**        | **0**                                                  |
| **Risky call sites (tenant RLS tables, no session)** | **5** — all documented allowed admin/ops paths         |
| **Live enforcement test**                            | **PASS** (5/5)                                         |
| **app_tour leakage without `set_config`**            | **None** (0 rows Prisma + raw `count(*)`)              |
| **Admin leakage on app role**                        | **None** — admin sees seeded rows; `app_tour` does not |

---

## Part 1 — Repository scan inventory

### Raw SQL (`$queryRaw` / `$executeRaw` / `*Unsafe`)

| File                                                  | Pattern                                                 | Connection               | RLS risk              | Mitigation                                                |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------ | --------------------- | --------------------------------------------------------- |
| `src/db/with-tenant-rls.ts`                           | `$executeRaw` `set_config('app.current_tenant_id', …)`  | `getPrisma()` (app_tour) | **None**              | Establishes RLS session inside `$transaction`             |
| `src/db/with-canonical-transaction.ts`                | `$executeRaw` `set_config`                              | `getPrisma()`            | **None**              | Same as above; canonical write boundary                   |
| `src/outbox/outbox-relay.ts`                          | `$queryRaw` `FOR UPDATE SKIP LOCKED` on `outbox_events` | `getPrismaAdmin()`       | **Low (intentional)** | Documented relay claim; publish path uses `withTenantRls` |
| `src/canonical/canonical-tour.service.events.spec.ts` | `$executeRawUnsafe` (trigger disable)                   | admin                    | **N/A**               | Unit/integration spec only                                |
| `src/storage/prisma-tour.repository.spec.ts`          | `$executeRaw` cleanup                                   | `getPrisma()`            | **N/A**               | Spec only                                                 |
| `packages/*`                                          | —                                                       | —                        | **None**              | No raw SQL in workspace packages                          |

**Production raw SQL count:** 3 sites — all set RLS session or admin outbox claim.

### Tenant-scoped models (`tour`, `outboxEvent`, `auditEvent`, `processedDomainEvent`)

| File                                             | Pattern                                    | Connection                         | RLS risk              | Mitigation                                                                                                       |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/storage/prisma-tour.repository.ts`          | `findMany` / `create` / `update` / `count` | `getPrisma()` via `withTenantRls`  | **None**              | All I/O wrapped; compound `tenantId` keys; **no** id-only admin tour read (DM-CT-03)                             |
| `src/canonical/atomic-canonical-tour-persist.ts` | `tour.create`                              | `tx` in `withCanonicalTransaction` | **None**              | RLS set on same TX                                                                                               |
| `src/outbox/enqueue-domain-event.ts`             | `outboxEvent.create`                       | `tx` (canonical TX)                | **None**              | Same connection as domain persist                                                                                |
| `src/audit/audit-logger.ts`                      | `auditEvent.create`                        | `tx` (canonical TX)                | **None**              | Append-only; ALS tenant required                                                                                 |
| `src/events/processed-domain-event-log.ts`       | `processedDomainEvent.create`              | `withTenantRls`                    | **None**              | Idempotency claim per tenant                                                                                     |
| `src/outbox/outbox-relay.ts`                     | `outboxEvent.updateMany` / `update`        | admin in claim + mark done/failed  | **Low (intentional)** | Claim `updateMany` uses compound `(id, tenantId)` (DEC-032); publish visibility under `withTenantRls` before bus |
| `src/outbox/outbox-relay.ts`                     | `outboxEvent.findUnique`                   | `withTenantRls(row.tenantId)`      | **None**              | Verifies row visible under tenant session                                                                        |
| `src/internal/provisioning.service.ts`           | `tenant.*` only                            | `getPrismaAdmin()`                 | **None**              | `tenants` not RLS-scoped; dev/internal route                                                                     |

**Unwrapped tenant-table access on request paths:** **0** in `src/` (handlers use storage/canonical services only).

### `getPrisma()` vs `getPrismaAdmin()`

| File                                   | Usage                                                                      | Justified?                                       |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/db/prisma.ts`                     | Admin singleton; falls back to `getPrisma()` if `DATABASE_URL_ADMIN` unset | **Config risk** — ops must set admin URL in prod |
| `src/outbox/outbox-relay.ts`           | Claim + status updates                                                     | **Yes** — SKIP LOCKED batch                      |
| `src/internal/provisioning.service.ts` | Tenant bootstrap                                                           | **Yes** — internal dev provisioning              |

### Request-path context wrappers

All production tour/outbox/audit/processed writes flow through:

- `runWithTenantContext` → `CanonicalTourService` / `PrismaTourRepository`
- `withCanonicalTransaction` → atomic persist + outbox + audit
- `withTenantRls` → repository reads, idempotency log, relay visibility probe

`guard-no-raw-queries.mjs` blocks unscoped `findMany`/`findFirst` in route layers (excludes `db/`, `storage/`, `canonical/`).

### Allowed admin patterns (confirmed OK)

1. **`outbox-relay.ts`** — admin `SKIP LOCKED` claim + admin status update; publish visibility under `withTenantRls`.
2. **Provisioning** — `getPrismaAdmin()` for `tenants` only (`provisioning.service.ts`, internal routes).
3. **Tests / seeds** — admin clients in `test/**`; append-only audit cleanup disables trigger (same as `5.5-audit-events.spec.ts`).

**Removed (DM-CT-03):** admin `resolveById` / id-only `tour.findUnique({ id })` — cross-tenant GET uses tenant-scoped RLS only → **404** when row not visible.

### Risky call site count (parent summary)

| Category                                                       | Count |
| -------------------------------------------------------------- | ----- |
| HIGH (app role, tenant table, no RLS session)                  | **0** |
| MEDIUM (admin tenant table without `withTenantRls`, by design) | **5** |
| Config (`DATABASE_URL_ADMIN` missing → admin = app)            | **1** |

The five MEDIUM entries: outbox relay claim (1 raw + 1 updateMany), mark done/failed (2), provisioning tenant lookups/writes (3) — **tenant table only for provisioning; outbox admin ops documented.**

---

## Part 2 — Live enforcement test

**File:** `apps/api/test/0-security/raw-sql-exposure.spec.ts`  
**Run:**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db
export DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
cd apps/api && node --import tsx --test --test-concurrency=1 test/0-security/raw-sql-exposure.spec.ts
```

| Scenario                                                                                             | Result                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| `app_tour` `findMany` on `tour`, `outboxEvent`, `auditEvent`, `processedDomainEvent` without session | **PASS** — 0 rows              |
| `app_tour` `findUnique` on seeded ids                                                                | **PASS** — `null`              |
| Raw `SELECT count(*) FROM outbox_events` without session                                             | **PASS** — 0                   |
| `getPrismaAdmin()` reads seeded rows                                                                 | **PASS** — expected ops bypass |
| `withTenantRls(tenantA)` isolation vs `tenantB`                                                      | **PASS** — scoped rows only    |

**Overall:** **PASS** (5/5, 2026-06-05)  
**CRITICAL FAIL:** None — `app_tour` never observed tenant data without `set_config`.

---

## Part 3 — Recommendations

1. **Keep `DATABASE_URL_ADMIN` required in production** — `getPrismaAdmin()` silently aliasing `getPrisma()` would collapse relay/CASL separation (document in deploy checklist).
2. **Do not add handler-layer Prisma** — continue routing through `withTenantRls` / `withCanonicalTransaction`; `guard-no-raw-queries` already enforces this.
3. **Relay admin updates** — acceptable; optional hardening: mark `done`/`failed` via `withTenantRls(row.tenantId)` if relay principal gains only `app_tour` (not required while admin URL is ops-only).
4. **Tour reads** — tenant-scoped `getById(id, tenantId)` under `withTenantRls` only; `guard:id-only-tour-read` blocks `resolveById` and admin id-only probes in `src/`.
5. **CI** — add `test/0-security/raw-sql-exposure.spec.ts` to Phase 5 gate when `DATABASE_URL` points at RLS-enabled Postgres (5434).

---

## References

- Prior pattern: `apps/api/test/outbox-rls-forbidden-access.spec.ts`
- RLS session helpers: `apps/api/src/db/with-tenant-rls.ts`, `with-canonical-transaction.ts`
- Phase 5 SQL: `infra/sql/002_phase5_data_layer.sql` (migrations on 5434)
