# Per-tenant HTTP rate limiting (DEC-015)

> **Implementation:** `apps/api/src/middleware/tenant-rate-limiter.ts`  
> **HTTP bind order:** `apps/api/src/http/bind-request-context.ts` (`rateLimit: true` after auth + tenant ALS)  
> **Phase 7.6 target:** Redis tier keys — [`docs/phase-7/subphases/7.6-rate-limits.md`](../../phase-7/subphases/7.6-rate-limits.md)

## Problem

Without per-tenant request throttling, one tenant’s burst on `POST /tours` can saturate the Node event loop and deny service to others (`noise-neighbor.spec.ts`, `noisy-neighbor-latency.spec.ts`, `tenant-rate-limiting.spec.ts`).

## Algorithm

| Property  | Value                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Model     | **Token bucket** via [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible) `RateLimiterMemory` |
| Key       | `tenant_id` from ALS (`requireActiveTenantId()` after HTTP bind)                                                         |
| Isolation | One bucket **per tenant** — not a global shared bucket                                                                   |
| Blocking  | `consume()` is async; does not block the event loop synchronously                                                        |

Each accepted request consumes **one point**. When the bucket is empty, the library rejects with `RateLimiterRes` and the API returns HTTP **429**.

## Store port (Redis migration)

```typescript
export interface RateLimiterStore {
  consume(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void>;
}
```

| Phase                  | Store                    | Notes                                                                                                                                      |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.6 interim (trunk)    | `MemoryRateLimiterStore` | In-process; one `RateLimiterMemory` per distinct `(points, durationSec)` config                                                            |
| 7.6 / P1-1             | `RedisRateLimiterStore`  | When `REDIS_URL` is set — [`redis-rate-limiter-store.ts`](../../../apps/api/src/middleware/redis-rate-limiter-store.ts) + `ioredis` client |
| 5.6 interim (no Redis) | `MemoryRateLimiterStore` | Default when `REDIS_URL` unset                                                                                                             |

**Redis activation:** set `REDIS_URL=redis://127.0.0.1:6379` (or managed URL). Without it, trunk stays in-memory (documented BLOCKER for multi-replica fairness in 7.6 until Redis is provisioned).

## HTTP pipeline order

```mermaid
sequenceDiagram
  participant R as POST /tours
  participant Auth as resolveTenantContextFromRequest
  participant ALS as runWithHttpRequestContext
  participant RL as consumeTenantRateLimit
  participant Svc as ToursService.createTour

  R->>Auth: headers / JWT
  Auth->>ALS: runWithTraceContext + runWithTenantContext
  ALS->>RL: requireActiveTenantId + consume (rateLimit: true)
  alt over limit
    RL-->>R: 429 RATE_LIMIT_EXCEEDED
  else allowed
    RL->>Svc: business logic
  end
```

Rate limiting runs **after** tenant authentication and ALS bind, **before** `ToursService.createTour`.

### `GET /tours/:id` (P0-8)

Reads and writes use **independent token buckets** per tenant (`{tenantId}:read` vs `{tenantId}:write`). `TENANT_RATE_LIMIT_READ_POINTS` defaults to `TENANT_RATE_LIMIT_POINTS` when unset. `handleGetTour` uses `rateLimit: 'read'` so a neighbor’s read storm is throttled without consuming the write bucket used by victim `POST /tours`.

| Route            | `rateLimit` | Module                                 |
| ---------------- | ----------- | -------------------------------------- |
| `POST /tours`    | `true`      | `tours.routes.ts` → `handleCreateTour` |
| `GET /tours/:id` | `true`      | `tours.routes.ts` → `handleGetTour`    |

Probe: `apps/api/test/2-observability/noise-neighbor.spec.ts` (500 parallel GET tenant A + POST tenant B).

## Environment variables

| Variable                         | Default            | Role                                       |
| -------------------------------- | ------------------ | ------------------------------------------ |
| `TENANT_RATE_LIMIT_ENABLED`      | `true`             | Set `false` to disable                     |
| `TENANT_RATE_LIMIT_POINTS`       | `50`               | Default max requests per tenant per window |
| `TENANT_RATE_LIMIT_DURATION_SEC` | `1`                | Window length (seconds)                    |
| `TENANT_RATE_LIMIT_READ_POINTS`  | _(same as points)_ | Optional separate cap for `GET /tours/:id` |

Effective default: **50 req/s** per tenant when env vars are unset.

## Per-tenant override (`tenants.theme`)

Overrides apply **per tenant** without changing the global env default.

| Store                         | JSON path                   | Example                                     |
| ----------------------------- | --------------------------- | ------------------------------------------- |
| Postgres `tenants.theme`      | `rateLimitRps`              | `{ "rateLimitRps": 200 }`                   |
| Same                          | `featureFlags.rateLimitRps` | `{ "featureFlags": { "rateLimitRps": 5 } }` |
| Static `DEV_TENANTS` registry | same keys on `theme`        | integration / local probes                  |

**Precedence:** `theme.rateLimitRps` → `theme.featureFlags.rateLimitRps` → env `TENANT_RATE_LIMIT_POINTS`.

Resolution mirrors `resolveTenantFeatureFlags`: registry first, then Postgres when `DATABASE_URL` is set. With `STORAGE_DRIVER=memory` and no `DATABASE_URL`, HTTP probes use env defaults only (random `integrationTenantId` rows are not required).

## 429 contract

**Header:** `Retry-After` (seconds, RFC 7231)

**Body:**

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": "1"
}
```

`retryAfter` is seconds as a string. Distinct from tour capacity 429 (`TOUR_CAPACITY_EXCEEDED_*`).

## Performance probes

| Spec                           | Scenario                                     | SLO                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant-rate-limiter.spec.ts`  | 20 concurrent A + 5 concurrent B, limit 10/s | Exactly `LIMIT`×201 and remainder `RATE_LIMIT_EXCEEDED` for A; all B succeed                                                                                         |
| `tenant-rate-limiting.spec.ts` | A flooded, B concurrent                      | A: mix of 201 + `RATE_LIMIT_EXCEEDED`; B: 2xx and latency ≤ `max(p50 × TENANT_B_LATENCY_RATIO_MAX, TENANT_B_LATENCY_MIN_BUDGET_MS)` (defaults **2.0** and **500ms**) |
| `noise-neighbor.spec.ts`       | 500× GET A + POST B (Postgres)               | B write p95 ≤ baseline × `RATIO_THRESHOLD` (default **4**)                                                                                                           |

CPU-only fairness (no HTTP) uses **10%** slack in `noisy-neighbor-latency.spec.ts` (`BASELINE_RATIO_MAX=1.10`). HTTP probes use a **ratio plus floor** because solo baseline p50 understates event-loop scheduling under a concurrent burst on the same listener.

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory \
  node --import tsx --test test/3-performance/tenant-rate-limiting.spec.ts \
  test/3-performance/tenant-rate-limiter.spec.ts
```

## Cross-references

- **DEC-015** — [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)
- Trace ALS order — [`trace-request-context.md`](trace-request-context.md)
- Feature flags (same theme JSON) — [`feature-flag-degradation.md`](feature-flag-degradation.md)
