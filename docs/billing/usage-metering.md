# Tenant Usage Metering

This document describes the tenant usage metering layer used for billing, quota enforcement, and fairness controls.

## Data model

### `tenant_usage_daily`

Daily per-tenant usage rollup.

Columns:

- `tenant_id` (uuid)
- `date` (date, UTC day)
- `api_requests` (bigint)
- `background_jobs` (bigint)
- `storage_bytes` (bigint)
- `login_attempts` (bigint)

Primary key:

- (`tenant_id`, `date`)

### `tenant_plan_limits`

Per-tenant quota configuration.

Columns:

- `tenant_id` (uuid, PK)
- `api_requests_per_day` (bigint, nullable = unlimited)
- `jobs_per_day` (bigint, nullable = unlimited)
- `storage_limit` (bigint, nullable = unlimited)

## Request metering

`TenantUsageMiddleware` runs on API requests and records usage in `tenant_usage_daily`:

- increments `api_requests` for `/api/v2/*`
- increments `login_attempts` for:
  - `POST /api/v2/auth/web/session/otp`
  - `POST /api/v2/auth/telegram/session`

If the tenant exceeds `api_requests_per_day`, request handling fails with HTTP 429 (`TENANT_QUOTA_EXCEEDED`).

## Background job metering

`ReconciliationService` consumes one `background_jobs` unit per tenant run via `TenantUsageMeteringService.tryConsumeBackgroundJob`.

If `jobs_per_day` is exceeded, that tenant is skipped for the cycle.

## Observability

Prometheus/internal ops metrics include:

- `tenant_usage_updates_total`
- `tenant_quota_exceeded_total`
- per-scope `tenant_quota_exceeded_total{scope="..."}`

Internal JSON snapshot:

- `GET /internal/ops/metrics/tenant-usage`

## Notes

- Counters are maintained per UTC day.
- `storage_bytes` column is present for future storage metering integration (currently not auto-updated by middleware/jobs).
