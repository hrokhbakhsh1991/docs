# Local Development Runbook

Document-ID: MKT-DOC-OPS-LOCAL-RUNBOOK
Version: v1.0
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1. Purpose

Provide a deterministic local run sequence for end-to-end development aligned with approved contracts and flows.

## 2. Local Architecture Expectations

Minimum local components inferred from active contracts:

- API backend serving `/api/v2/*`
- Frontend application for leader/participant/identity surfaces
- Primary data store (tenant-scoped records)
- Optional cache/queue service if required by runtime

Reference:
- `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`

## 3. Startup Order

1. Start data dependencies:
   - `[REQUIRED_FILL: start_db_command]`
   - `[REQUIRED_FILL: start_cache_queue_command_if_any]`
2. Apply migrations and baseline seed:
   - `[REQUIRED_FILL: migrate_command]`
   - `[REQUIRED_FILL: seed_command]`
3. Start backend API:
   - `[REQUIRED_FILL: backend_dev_command]`
4. Start frontend:
   - `[REQUIRED_FILL: frontend_dev_command]`
5. Run initial smoke tests:
   - `[REQUIRED_FILL: smoke_command]`

## 4. Health Checks

Backend healthy when:

- process starts without fatal config errors
- health endpoint responds (`[REQUIRED_FILL: health_url]`)
- required API routes are reachable

Frontend healthy when:

- app shell loads
- primary routes for leader and participant render
- identity entry screens are reachable

Data services healthy when:

- connection checks pass
- read/write test on a local dev tenant succeeds

## 5. PostgreSQL RLS Smoke Checks

After migrations that enable Row Level Security on tenant-scoped tables, validate session binding manually.

Prerequisites:

- Connect as a role that matches local dev (for example `psql` against `DATABASE_URL` or equivalent).
- Replace `your_tenant_table` with a table that has a `tenant_id` column and RLS policies applied.

Example (`psql`):

```sql
SET app.tenant_id = '11111111-1111-4111-8111-111111111111';
SELECT * FROM your_tenant_table;

RESET app.tenant_id;
SELECT * FROM your_tenant_table;
```

Expected behavior:

- With `app.tenant_id` set to a UUID string that matches stored rows’ `tenant_id`, `SELECT` returns only rows for that tenant (policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`).
- After `RESET app.tenant_id`, `current_setting('app.tenant_id', true)` is unset; under forced RLS, qualifying policies typically yield **no rows** for tenant-scoped tables (fail-closed), not a mix of tenants.

Use real UUIDs that exist in your seed data when testing; invalid or malformed `app.tenant_id` values should not grant cross-tenant visibility.

## 6. Quick Smoke Test (Behavioral)

Run in this order:

1. Participant registration path:
   - create registration (`POST /api/v2/registrations`)
2. Accepted-only communication access:
   - update status to accepted
   - verify communication view access gating (`S-PART-05` expectations)
3. Payment status update:
   - patch payment status (`PATCH /api/v2/registrations/{registrationId}/payment`)
4. Reconciliation export:
   - export CSV (`GET /api/v2/reconciliation/export.csv`)

All checks must follow canonical error envelope and tenant fail-closed constraints.

## 7. Watch/Hot Reload Modes

- Backend watch mode: `[REQUIRED_FILL: backend_watch_command]`
- Frontend watch mode: `[REQUIRED_FILL: frontend_watch_command]`
- Contract test watch mode (optional): `[REQUIRED_FILL]`

## 8. Stop and Reset

Safe stop:

- stop frontend
- stop backend
- stop dependent services

Reset options:

- soft reset (keep schema, clear transient state): `[REQUIRED_FILL]`
- hard reset (drop and rebuild local db): `[REQUIRED_FILL]`

Warning: hard reset destroys local data. Use only in local environment.

## 9. Known Local Limits vs Higher Environments

- local data volume may hide performance and lock behavior
- local auth/session shortcuts may differ from production identity providers
- export and concurrency behavior must be validated by integration/contract tests

## 10. Operational Handoff Rules

- Any divergence between runbook and runtime behavior must be logged as `DOC-SYNC-*`.
- Do not silently adjust behavior outside approved contracts.

## 11. Scheduler Deployment Contract (API vs Worker)

For in-process jobs (`OutboxProcessor`, `PaymentsProcessor`, `ReconciliationProcessor`, `IdempotencyCleanupJob`), runtime role separation is mandatory in shared environments.

Required environment flags:

- `ENABLE_SCHEDULERS=true|false`
- `APP_RUNTIME_ROLE=api|worker|all`
- `JOB_SCHEDULER_JITTER_MS=<non-negative integer>`

Recommended deployment model:

1. API deployment (horizontal):
   - `APP_RUNTIME_ROLE=api`
   - `ENABLE_SCHEDULERS=true` (safe because role blocks scheduler startup)
   - replicas `> 1` allowed
2. Worker deployment (singleton for MVP):
   - `APP_RUNTIME_ROLE=worker`
   - `ENABLE_SCHEDULERS=true`
   - replicas `= 1` for deterministic scheduling

Behavior notes:

- Jobs use PostgreSQL advisory locks; competing workers that fail to acquire lock emit `job_skipped_due_lock`.
- Startup jitter (`JOB_SCHEDULER_JITTER_MS`) reduces synchronized bursts after restart.
- Runtime visibility is exposed from `GET /internal/ops/health` under `schedulers`.
