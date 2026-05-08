# DB Tenant Binding Pattern

Runtime uses two complementary DB binding paths:

- HTTP request path: implicit binding via the `TenantSessionBindingService` QueryRunner patch.
- Worker/scheduler path: explicit binding via `TenantDbContextService.runInTenantScope(...)`.

## Explicit Pattern (Workers/Schedulers)

Use `TenantDbContextService`:

- `runInTenantScope(tenantId, fn)`
- opens a transaction
- applies `SELECT set_config('app.tenant_id', $1, true)` (transaction-local)
- runs all DB logic inside the scoped `EntityManager`

Primary usage:

- workers / schedulers
- outbox dispatch
- reconciliation jobs
- tenant-scoped timeout/failure jobs

This path does not depend on ALS.

## HTTP Implicit Path (QueryRunner Patch Layer)

`TenantSessionBindingService` patches each created `QueryRunner` interception point:

- `connect()`: performs early tenant-context eligibility validation.
- `startTransaction()`: blocks suppressed-mode transactions, then applies tenant GUC in tx scope.
- `query()`: enforces suppressed-mode query allow-list and ensures tx + tenant GUC for normal mode.
- `release()`: resets `app.tenant_id` before connection is returned to pool.

Behavior by execution context:

- ALS context present (typical HTTP): implicit tenant binding is enforced.
- ALS context absent (typical worker/scheduler): implicit patch intentionally skips binding (warn-once).

## Runtime Rules

- HTTP request path: tenant resolution + auth establish tenant context, then QueryRunner patch injects tenant GUC for DB work.
- Background jobs: tenant id must come from job envelope or scheduler tenant iteration and execute via `TenantDbContextService`.
- Do not add worker/scheduler code that depends on ALS-backed implicit tenant lookup.
