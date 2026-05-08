# Rate Limiting Failure Modes

This service enforces tenant-aware limits using Redis as the primary store. To avoid a security blind spot during Redis outages, the limiter now supports configurable failure handling.

## Configuration

- `RATE_LIMIT_FAIL_MODE` (default: `degraded`)
  - `degraded`: use in-memory token bucket fallback.
  - `fail_closed`: deny requests when Redis is unavailable.
  - `fail_open`: allow requests when Redis is unavailable (legacy behavior, not recommended).

## Degraded fallback (default)

When Redis operations fail, `TenantRateLimitService` switches to an in-process token bucket per key. Keys are still scoped by the same dimensions:

- tenant (`tenant_id`)
- user (`user_id`) when available
- client IP

The same route groups are enforced:

- API limits (`api_tenant`, `api_user`, `api_ip`)
- login limits (`login_tenant`, `login_ip`)
- job limits (`job_tenant`)

This keeps throttling active during transient Redis failures instead of silently disabling protection.

## Metrics and logs

Two counters are exposed in tenant abuse metrics:

- `rate_limit_redis_failures` / Prometheus: `rate_limit_redis_failures_total`
- `rate_limit_fallback_activated` / Prometheus: `rate_limit_fallback_activated_total`

Warnings are logged when:

- Redis fails during rate-limit evaluation (`tenant_rate_limit_redis_error`)
- degraded fallback activates (`tenant_rate_limit_fallback_activated`)

## Operational guidance

- Production default should remain `degraded`.
- Use `fail_closed` only when strict blocking during outages is acceptable.
- Avoid `fail_open` except for controlled emergency scenarios.
