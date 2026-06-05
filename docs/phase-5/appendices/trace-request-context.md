# Trace request context (Phase 5 observability scaffold)

```yaml
agent_load_tier: T2_behavioral
scope: trace_id ALS + Postgres session binding
deferred_full_stack: Phase 7 (OpenTelemetry traceparent)
cross_ref:
  tenant_als: apps/api/src/tenant/tenant-request-context.ts
  observability: docs/phase-4/appendices/observability.md
```

## Purpose

Correlate HTTP requests with downstream service and repository work using a **request-scoped trace id** carried in AsyncLocalStorage (ALS), separate from tenant ALS. This is the minimal scaffold required before Phase 7 distributed tracing (W3C `traceparent`, OTLP exporters).

## Ingress resolution

| Header (priority)  | Behavior                                                  |
| ------------------ | --------------------------------------------------------- |
| `x-trace-id`       | Use as trace id when non-empty                            |
| `x-correlation-id` | Support-ticket correlation id (echoed on error responses) |
| `x-request-id`     | Fallback correlation id                                   |
| _(none)_           | Generate `randomUUID()` at HTTP bind time                 |

Resolution lives in `apps/api/src/observability/resolve-trace-id.ts`. `createRequestListener` binds trace ALS at the outer HTTP entry (`apps/api/src/app.ts`) **before** route dispatch; per-route handlers may nest `runWithHttpRequestContext` with the same header resolution.

## HTTP error envelope (OBS-ERR)

`apps/api/src/middleware/error-interceptor.ts` is the global mapper for thrown errors and uncaught route failures:

| Field / header                       | Behavior                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| `correlationId` (JSON)               | Active trace ALS id, or `randomUUID()` when ALS is missing    |
| `x-correlation-id` (response header) | Same value as `correlationId` on every **4xx/5xx** JSON error |
| `error`                              | Client-safe message; `internal_error` for opaque 500          |
| `code`                               | Present for `VALIDATION_FAILURE`, `RATE_LIMIT_EXCEEDED`, etc. |

Mapping rules:

| Error source                   | HTTP | `code` / `error`                                                                                                                           |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ValidationFailure`            | 400  | `VALIDATION_FAILURE` + validation message (no class/stack leak)                                                                            |
| `TenantRateLimitExceededError` | 429  | `RATE_LIMIT_EXCEEDED`                                                                                                                      |
| `DB_POOL_SATURATED` prefix     | 503  | `service_unavailable`                                                                                                                      |
| Unhandled / mapped 500         | 500  | `internal_error` — structured **pino** log with `correlation_id`, `tenant_id`, sanitized stack; body never includes stack/SQL/engine paths |

Service-layer `ValidationFailure` instances are enriched with `tenant_id` and `correlation_id` from active ALS before rethrow (`enrichValidationFailure` in `validation-failure.ts`).

Verification: `apps/api/test/2-observability/error-enrichment.spec.ts`.

## ALS API

| Export                              | Role                                         |
| ----------------------------------- | -------------------------------------------- |
| `runWithTraceContext(traceId, run)` | Bind trace id for async subtree              |
| `getActiveTraceId()`                | Read active trace — `undefined` outside bind |
| `requireActiveTraceId()`            | Fail-closed read for instrumentation         |

Store shape: `{ traceId: string }` — one dedicated `AsyncLocalStorage` instance (not merged into tenant store) so trace and tenant contexts compose via nesting.

## Postgres session binding

`withTenantRls` and `withCanonicalTransaction` set a transaction-local GUC when trace ALS is active:

```sql
SELECT set_config('app.current_trace_id', $traceId, true);
```

This lets integration tests (and future DB audit triggers) read `current_setting('app.current_trace_id', true)` on the **same connection** as tenant RLS queries. The GUC is cleared automatically when the Prisma transaction ends.

## Verification

| Spec             | Path                                                     | Proves                                                                                                                       |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Trace isolation  | `apps/api/test/2-observability/trace-isolation.spec.ts`  | HTTP → service → repo ALS propagation; concurrent tenant A/B trace separation; optional Postgres GUC when `DATABASE_URL` set |
| Error enrichment | `apps/api/test/2-observability/error-enrichment.spec.ts` | Correlation echo on 4xx/5xx; no engine leak; enriched `ValidationFailure`                                                    |
| Tenant metrics   | `apps/api/test/2-observability/tenant-metrics.spec.ts`   | `tour_creation_count{tenant_id}` separation after multi-tenant creates                                                       |

Run (memory — ALS chain only):

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/trace-isolation.spec.ts
```

Run (memory — error envelope):

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/error-enrichment.spec.ts
```

Run (Postgres — includes GUC assertion):

```bash
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  NODE_ENV=test STORAGE_DRIVER=prisma node --import tsx --test test/2-observability/trace-isolation.spec.ts
```

## Phase boundaries

| Capability                                       | Phase            |
| ------------------------------------------------ | ---------------- |
| Trace ALS + `app.current_trace_id` GUC           | **5** (this doc) |
| Structured log `traceId` on every `http.request` | 4+ recommended   |
| W3C `traceparent` + OTel spans                   | **7**            |
| Outbox relay trace continuation                  | **7**            |
