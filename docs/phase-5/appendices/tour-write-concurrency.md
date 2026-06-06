# Tour write concurrency cap (DEC-064 / SCAL-DEBT-09)

```yaml
status: implemented
phase: 3 scalability audit — closure step 13
closes: SCAL-DEBT-09, NN-05 (partial)
related: DEC-015 (RPS limit), DEC-055 (DB TX cap)
```

## Problem

`POST /tours` has per-tenant **RPS** limits (DEC-015) and per-tenant **DB TX** caps (DEC-055), but no limit on **concurrent in-flight creates**. A bulk-import storm can queue many parallel persists (validation + pre-TX work) before DB budget engages — noisy-neighbor risk for other tenants ([NN-05](../../../apps/api/docs/phase3-scalability-stress-audit.md)).

There is no dedicated `/bulk-import` route; sustained concurrent `POST /tours` is the realistic attack surface.

## Decision

| Knob                                | Default                                        | Behavior                                                              |
| ----------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `TENANT_MAX_CONCURRENT_TOUR_WRITES` | **8**                                          | Max in-flight `POST /tours` per tenant                                |
| Over cap                            | HTTP **429**                                   | `tour_write_concurrency_exceeded` / `TOUR_WRITE_CONCURRENCY_EXCEEDED` |
| Metric                              | `tour_write_concurrency_shed_total{tenant_id}` | Increment on reject                                                   |

## Semantics

1. Acquire at HTTP boundary (`runWithHttpRequestContext` when `tourWriteConcurrency: true`).
2. Hold for full handler duration (parse → validate → persist → response).
3. Release in `finally` — including idempotency replay paths.
4. In-process only — multi-replica fairness deferred to Phase 7.

## Implementation map

| File                                                 | Role                                 |
| ---------------------------------------------------- | ------------------------------------ |
| `apps/api/src/http/tour-write-concurrency-budget.ts` | Semaphore + error type               |
| `apps/api/src/http/bind-request-context.ts`          | Optional `tourWriteConcurrency` flag |
| `apps/api/src/tours/tours.routes.ts`                 | `handleCreateTour` enables cap       |
| `apps/api/src/middleware/error-interceptor.ts`       | Map to 429                           |
| `apps/api/scripts/guard-tour-write-concurrency.mjs`  | CI lock                              |

## Monitoring (B3 / NN-05)

In-flight gauges and shed burst alerts: [`tour-write-concurrency-monitor.md`](tour-write-concurrency-monitor.md). Pair with DEC-069 victim SLO spec when investigating neighbor latency under bulk `POST /tours`.

## Verification

```bash
cd apps/api && pnpm run guard:tour-write-concurrency
cd apps/api && pnpm run guard:tour-write-concurrency-monitor
node --import tsx --test test/3-performance/tour-write-concurrency.spec.ts
node --import tsx --test src/http/tour-write-concurrency-monitor.spec.ts
```
