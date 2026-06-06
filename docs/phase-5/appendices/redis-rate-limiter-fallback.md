# Redis rate limiter runtime fallback (DEC-083 / Wave B)

```yaml
status: implemented
phase: 4 resilience — Wave B
closes: SH-GAP-13, RL-DOS-04 (partial)
related: rate-limiting.md, phase5-evolution-audit.md
```

## Problem

When `REDIS_URL` is set, `RedisRateLimiterStore` uses `maxRetriesPerRequest: 1` and `enableOfflineQueue: false`. A **runtime** Redis blip surfaces as an unhandled store error → HTTP **500** on rate-limited routes (worse than 429 shed).

## Decision — tiered failure policy

| Policy        | Behavior on Redis error                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| `fail_closed` | Throw `RateLimiterRedisUnavailableError` → HTTP **503** `RATE_LIMITER_REDIS_UNAVAILABLE` |
| `fail_local`  | Fall back to in-process `MemoryRateLimiterStore` for same `(points, duration)`           |
| `fail_open`   | Allow request (no consume) — read-tier default                                           |

| Env                                      | Default when unset                                             |
| ---------------------------------------- | -------------------------------------------------------------- |
| `TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY` | Tier default: **write → `fail_local`**, **read → `fail_open`** |

Explicit env overrides tier defaults for all routes.

## Circuit breaker

| Constant          | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Failure threshold | 3 consecutive Redis errors                           |
| Open duration     | 30s — skip Redis, use policy path directly           |
| Metric            | `rate_limiter_redis_fallback_total` on each fallback |

## Implementation

| Module                             | Role                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `redis-rate-limiter-resilience.ts` | Policy resolver, circuit state, `isRedisInfrastructureError`                                                        |
| `redis-rate-limiter-store.ts`      | Wraps Redis + memory fallback; `retryStrategy: () => null` (no background reconnect); `disconnect()` closes ioredis |
| `tenant-rate-limiter.ts`           | `RateLimiterRedisUnavailableError`, store factory; `resetTenantRateLimiterStoreForTests()` awaits Redis `quit()`    |
| `error-interceptor.ts`             | Maps unavailable → 503                                                                                              |

Consumer key format `{tenantId}:{read|write}` selects tier for policy when env unset.

## Verification

```bash
cd apps/api && pnpm run guard:redis-rate-limiter-fallback
STORAGE_DRIVER=memory REDIS_URL='redis://127.0.0.1:59999' TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY=fail_local \
  node --import tsx --test test/4-integration/redis-rate-limiter-fallback.spec.ts
```

Memory-only spec clears `DATABASE_URL` in `before` so theme lookup does not open Prisma (open pool would hang exit without `disconnectPrisma`). Suite teardown uses `after(..., { scope: "suite" })` so the HTTP server is not closed between subtests. CI / `pnpm test` pass `--test-force-exit` for tsx `MessagePort` handles.

Acceptance: Redis down + `fail_local` → `POST /tours` returns **201** or **429**, never **500**.
