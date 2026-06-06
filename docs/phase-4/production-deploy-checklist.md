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

1. Apply Prisma migrations with **owner** credentials (`DATABASE_URL_ADMIN` or `postgres` role): `pnpm --filter @apps/api run db:migrate:deploy` (DEC-124).
2. **Do not** run `infra/sql/001…004` in production — reference-only; all RLS/DDL is in Prisma migrations (`20260605180000_tours_rls`, etc.).
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

## Logging / observability pre-flight (FOF-LOG-03 / A3)

Before switching from stdout to a **remote or slow log driver** (Fluent Bit, CloudWatch, `pino.transport`, etc.):

1. Run **`pnpm --filter @apps/api run test:nightly:slow-sink`** on the release candidate (DEC-070).
2. Confirm **`guard:log-backpressure-contract`** and **`guard:fof-log-03-shutdown-tail`** pass in CI.
3. Scrape **`log_shutdown_flush_timed_out_total`** and **`log_sink_drop_total`** — alert on sustained growth ([`fof-log-03-shutdown-tail-acceptance.md`](../phase-5/appendices/fof-log-03-shutdown-tail-acceptance.md)).
4. Keep `LOG_SINK_FLUSH_TIMEOUT_MS` aligned with collector drain SLA (default **2000** ms).

Trunk fast-stdout probes (LOG-BP-01) alone are **insufficient** for production log driver changes.

## Post-deploy smoke

1. Health: process started without boot errors.
2. Unauthenticated `POST /tours` → **401** (`UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION`).
3. Valid JWT for seeded tenant → **201** on `POST /tours`.
4. Cross-tenant tour read → **404** or **403** (RLS + CASL).
5. `GET /api/v2/tenant-config` reflects Postgres `tenants.theme` (not static registry).

## Bad deployment rollback (DEC-098 / RB-GAP-01…04)

Prisma is **forward-only** — there is no `migrate down`. Coordinated revert spans code, cache, and outbox state.

### Three rollback levels

| Level | Scope | Feasible in ~30s? | Action |
| ----- | ----- | ----------------- | ------ |
| **Code only** | Image / Deployment | **Sometimes** (5–30s platform) | `kubectl rollout undo` or redeploy previous digest |
| **Single migration TX** | One failed `migration.sql` | **Yes** (Postgres rolls back the file) | Fix SQL; `migrate deploy` retries pending file |
| **Migration chain + cache** | Applied N migrations + Redis + outbox | **No** | Forward-fix or PITR; manual runbook |

### Code-only rollback checklist

1. **Stop new traffic** — readiness should fail when `shuttingDown` or migration head mismatch (DEC-097/101).
2. **Revert image** — previous Deployment revision; allow **≥ 30s** `terminationGracePeriodSeconds` for drain ([`graceful-shutdown-ingress-reject.md`](../phase-5/appendices/graceful-shutdown-ingress-reject.md)).
3. **Outbox reclaim** — ensure `OUTBOX_PROCESSING_RECLAIM_MS` job runs or relay tick reclaims stale `processing` before trusting delivery (DEC-071).
4. **Cache + rate keys** — `POST /internal/cache/invalidate` with service JWT (`ops_scope: cache:invalidate`, DEC-120) from cluster-internal automation; or manual `redis-cli SCAN` + `DEL` for `ratelimit:*`. Optional `freezeFeatureFlags: true` stops live DB feature-flag reads during revert (RB-GAP-11).
5. **Schema skew** — if migration **N** shipped with bad code, code rollback alone leaves DB at **N**; only safe when **N** is backward-compatible with **N-1** binary.

### Expand / contract discipline (MD-GAP mitigation)

1. Ship **schema expand** migrations **before** code that depends on new columns.
2. Revert **code** first on bad deploy; leave DB expanded until a forward migration removes obsolete columns.
3. Never hand-edit applied `migration.sql` — checksum mismatch blocks deploy (MD-GAP-11).

### Never

- `prisma migrate reset` or manual `DROP` on production tenant tables.
- `pnpm run db:test-reset` against production URLs (DEC-095).

## Backup / RPO / RTO (DEC-125 / CAE-GAP-14)

| Objective | Target | Notes |
| --------- | ------ | ----- |
| **RPO** | ≤ 15 minutes | Postgres WAL / PITR — configured at infrastructure provider |
| **RTO** | ≤ 60 minutes | Restore + `db:migrate:deploy` + health smoke |

**SoT tables:** `tenants`, `tours`, `outbox_events`, `audit_events`, `processed_domain_events`.

**Monthly drill:** `bash scripts/restore-drill-smoke.sh` (local) or GitHub Actions `restore-drill-monthly.yml`.

Full playbook: [`../phase-5/appendices/rpo-rto-production.md`](../phase-5/appendices/rpo-rto-production.md).

## JWT key rotation (F-18 / P2-7)

1. Generate new RS256 key pair; set **previous** PEM: `AUTH_JWT_PUBLIC_KEY_PREVIOUS=<old>` then deploy **new** as `AUTH_JWT_PUBLIC_KEY` (DEC-107).
2. Issue tokens from the **new** private key at the identity provider; old tokens verify via `AUTH_JWT_PUBLIC_KEY_PREVIOUS` during overlap.
3. Rolling restart `@apps/api` pods so `parse-jwt-bearer` reloads PEM from env (in-process cache invalidates on PEM string change).
4. Smoke: `POST /tours` with fresh JWT → **201**; expired/old-key tokens → **401**.
5. Record rotation date in ops log.

## PR compliance

Before merge, walk [`appendices/http-compliance-checklist.md`](appendices/http-compliance-checklist.md) for HTTP/auth/RLS diffs.

## Network / ops (Phase 6 follow-up)

- Isolate `/internal/*` from public ingress (mTLS or service JWT — DEC-GAP-02).
