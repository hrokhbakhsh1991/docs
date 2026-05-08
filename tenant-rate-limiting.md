# Tenant-level rate limiting & abuse protection

The API enforces **Redis-backed sliding windows** keyed by **tenant**, **user** (authenticated API), and **client IP** (`TenantRateLimitMiddleware` + `TenantRateLimitService`).

## Middleware placement

Order matches production (`main.ts` / E2E `bootstrap.ts`):

`RequestContext` → `TenantResolver` → `Auth` → `TenantMiddleware` → **`TenantRateLimitMiddleware`**

## Scopes

| Scope | Keys | Typical env knobs |
|--------|------|-------------------|
| **API** (`/api/v2/*` except `/health`, `/internal`, `/api/docs`) | Per-tenant ceiling, per-user within tenant, per-IP within tenant | `TENANT_RATE_LIMIT_API_*` |
| **Login** (`POST .../auth/web/session/otp`, `.../auth/telegram/session`) | Per resolved workspace tenant + per IP | `TENANT_RATE_LIMIT_LOGIN_*` |
| **Background jobs** (reconciliation worker per tenant) | Per-tenant job budget | `TENANT_RATE_LIMIT_JOB_*` |

## Environment variables

See `apps/api/src/config/env.schema.ts` and `apps/api/.env.example`.

- **`TENANT_RATE_LIMIT_ENABLED`**: In **`NODE_ENV=test`**, limits apply **only** when set to `true` (see `ConfigService.isTenantRateLimitEnabled()`).
- Redis errors **fail open** (request allowed, error logged) to avoid total outage if Redis is down.

## Monitoring

- **Prometheus** (`GET /internal/ops/metrics/prometheus`):  
  - `tenant_rate_limit_exceeded_total{limit_scope="api_tenant|api_user|api_ip|login_tenant|login_ip|job_tenant"}`  
  - `tenant_request_volume_total` (global counter of observed `/api/v2` requests)
- **JSON** (`GET /internal/ops/metrics/tenant-abuse`): sampled top tenants by request volume (not suitable as Prometheus labels — cardinality).

## Abuse logs

`LoggerService.warn("tenant_rate_limit_exceeded", { tenant_id, user_id, endpoint, rate_limit, client_ip })`  
`LoggerService.warn("tenant_job_rate_limit_exceeded", { ... })` for reconciliation skips.

## Files

- `apps/api/src/common/tenant-abuse/tenant-rate-limit.service.ts`
- `apps/api/src/common/tenant-abuse/tenant-rate-limit.middleware.ts`
- `apps/api/src/common/tenant-abuse/tenant-abuse-metrics.service.ts`
- `apps/api/src/common/tenant-abuse/tenant-abuse.module.ts`
