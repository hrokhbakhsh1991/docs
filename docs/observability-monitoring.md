# Observability & tenant-aware monitoring

This document describes **structured logging** and **security-oriented metrics** for the Tour-Ops API (`apps/api`), aligned with Prometheus scraping and OpenTelemetry-style JSON export.

**Last updated:** 2026-05-06

---

## Structured logging (Pino)

Every log line emitted via `LoggerService` merges **AsyncLocalStorage** context when an HTTP request is active:

| Field | Source |
|--------|--------|
| `request_id` | `RequestContextMiddleware` (`x-request-id` or generated UUID) |
| `trace_id` | OpenTelemetry trace id (hex) when tracing SDK is enabled |
| `span_id` | Current span id when tracing SDK is enabled |
| `route` | `req.path` (same store as context `path`) |
| `method` | HTTP method |
| `tenant_id` | JWT workspace (`tenantId`) **or**, if absent, Host-resolved tenant (`hostTenantId` from `TenantResolverMiddleware`) |
| `user_id` | JWT `sub` after `AuthMiddleware` |
| `role` | JWT role claim |

Additional fields on **failed requests** (`GlobalExceptionFilter`):

| Field | Meaning |
|--------|---------|
| `status_code` | HTTP status |
| `route` | Path (duplicate ok for JSON log processors) |
| `error_code` | Canonical API error code (e.g. `TENANT_HOST_UNKNOWN`) |

Successful responses emit a **debug**-level completion event via `HttpObservabilityInterceptor`:

- `http_request_completed` with `status_code`, `duration_ms`, `route`, `method` (plus merged ALS fields including `tenant_id` when known).

Set `LOG_LEVEL=debug` locally to see completion lines; production typically stays `info` / `error`.

---

## Metrics (in-process counters)

Implementation: `ObservabilityMetricsService` (`apps/api/src/common/observability/observability-metrics.service.ts`).

Counters are **per Node process**. In Kubernetes, scrape **each replica** or aggregate in your collector.

### Aggregates

| Metric | When incremented |
|--------|------------------|
| `tenant_resolution_failures_total{code}` | `TENANT_HOST_UNKNOWN`, `TENANT_HOST_INVALID`, `TENANT_HOST_RESERVED` |
| `auth_login_failures_total` | `AUTH_UNAUTHENTICATED` on `POST /api/v2/auth/web/session/otp` or `POST /api/v2/auth/telegram/session` |
| `tenant_mismatch_total` | `TENANT_HOST_TOKEN_MISMATCH`, `TENANT_HOST_MISMATCH` |

### Security events (`security_events_total{event}`)

| `event` label | Trigger |
|---------------|---------|
| `TENANT_HOST_UNKNOWN` | Same as resolution failure code |
| `TENANT_HOST_TOKEN_MISMATCH` | JWT tenant ≠ Host tenant |
| `AUTH_LOGIN_FAILURE` | Failed web OTP or Telegram session (`AUTH_UNAUTHENTICATED` on those POSTs) |
| `AUTH_MEMBERSHIP_DENIED` | `TENANT_SCOPE_FORBIDDEN` on any `/api/v2/auth/*` route (login + workspace exchange) |

---

## Export endpoints (internal)

Protected by **`X-Internal-Api-Key`** (same as other `/internal/ops/*` routes):

| GET | Content-Type | Purpose |
|-----|----------------|---------|
| `/internal/ops/metrics/prometheus` | `text/plain` | Prometheus exposition |
| `/internal/ops/metrics/security` | `application/json` | JSON snapshot for OTLP bridges / custom agents |

### Example Prometheus scrape fragment

```text
# HELP auth_login_failures_total Failed web OTP or telegram session login (AUTH_UNAUTHENTICATED on session endpoints).
# TYPE auth_login_failures_total counter
auth_login_failures_total 12

# HELP tenant_mismatch_total JWT tenant vs Host mismatch or workspace/host mismatch.
# TYPE tenant_mismatch_total counter
tenant_mismatch_total 3

tenant_resolution_failures_total{code="TENANT_HOST_UNKNOWN"} 8
security_events_total{event="AUTH_MEMBERSHIP_DENIED"} 5
```

### Example JSON (`/internal/ops/metrics/security`)

```json
{
  "tenant_resolution_failures_total": {
    "TENANT_HOST_UNKNOWN": 8,
    "TENANT_HOST_INVALID": 1
  },
  "auth_login_failures_total": 12,
  "tenant_mismatch_total": 3,
  "security_events_total": {
    "AUTH_LOGIN_FAILURE": 12,
    "AUTH_MEMBERSHIP_DENIED": 5,
    "TENANT_HOST_UNKNOWN": 8,
    "TENANT_HOST_TOKEN_MISMATCH": 3
  },
  "metric_alert_trace_hints": [
    { "error_code": "TENANT_HOST_UNKNOWN", "trace_id": "a1b2c3d4e5f6789012345678901234ab" }
  ]
}
```

Field **`metric_alert_trace_hints`** is a bounded FIFO (latest 32) of `{ error_code, trace_id }` captured when a security-oriented metric increments **and** an active OTEL trace exists — use it to pivot from alerts without adding high-cardinality `trace_id` labels on Prometheus counters.

---

## Distributed tracing (OpenTelemetry)

**Bootstrap:** `apps/api/src/tracing.ts` — started from `main.ts` via `startTracing()` before Nest creates the HTTP server. Auto-instrumentation covers **incoming HTTP**, outbound **HTTP(S)**, and **`pg`** (used by TypeORM).

### Required span attributes (SaaS)

Every span created while `AsyncLocalStorage` request context is active receives:

| Attribute | Meaning |
|-----------|---------|
| `tenant_id` | JWT tenant or Host-resolved tenant |
| `user_id` | Authenticated user (`sub`) when present |
| `request_id` | Same as `x-request-id` |
| `route` | Request path from context (`req.path` early; interceptor may refine `http.route`) |

The Nest **`HttpObservabilityInterceptor`** also sets **`http.route`** from Express route templates when available.

### Manual spans (services)

Inject **`TracingService`** (`apps/api/src/common/observability/tracing.service.ts`) and wrap work with **`withSpan(name, fn, attributes?)`** so controllers/services emit nested spans under the same trace.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `OTEL_SDK_DISABLED` | Set `true` / `1` to disable the SDK entirely |
| `OTEL_SERVICE_NAME` | Defaults to `tour-ops-api` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base URL; traces POST to `{base}/v1/traces` |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Full traces URL (overrides path derivation from base) |
| `OTEL_ENABLE_IN_TEST` | Set `true` to enable tracing when `NODE_ENV=test` |
| `npm_package_version` | Sets resource `service.version` when present |

**Tests:** tracing is **off** under `NODE_ENV=test` unless `OTEL_ENABLE_IN_TEST=true`.

### Backends (OTLP HTTP)

Point **`OTEL_EXPORTER_OTLP_ENDPOINT`** at:

- **OpenTelemetry Collector:** e.g. `http://otel-collector:4318` (receiver `otlp` HTTP).
- **Jaeger:** OTLP HTTP ingest (Jaeger 1.35+), typically `:4318`.
- **Grafana Tempo:** OTLP HTTP distributor port (often `4318`).
- **Datadog:** Agent OTLP ingest, e.g. `http://datadog-agent:4318` (see Datadog docs for your region).

If **no** OTLP URL is set, spans still run through the SDK with a no-op exporter (trace ids remain available for logs); configure an endpoint in production to export.

### Example trace shape (conceptual)

```
trace tour-ops-api
└── GET /api/v2/tours                    [http.server]  attrs: tenant_id, user_id, request_id, route, http.route
    └── pg.query                         [db]           parent trace context propagated
    └── (optional) tours.list           [custom]       via TracingService.withSpan
```

Incoming **`traceparent`** is honored (W3C); responses follow OTEL defaults for trace propagation.

### Logs + metrics correlation

- **Logs:** `trace_id` and `span_id` are merged by `LoggerService` from the active OTEL span.
- **Metrics:** Prometheus output includes comments referencing OTLP; JSON **`metric_alert_trace_hints`** lists recent `trace_id` values tied to security metric bumps.

---

## OpenTelemetry integration (recommended pattern)

1. **Logs:** Forward stdout JSON from Pino to the OTEL Collector `filelog` / `otlp` logs exporter; map fields `tenant_id`, `request_id`, `trace_id`, `route`, `status_code`, `error_code` to resource/log attributes.
2. **Metrics:** Either  
   - scrape **`/internal/ops/metrics/prometheus`** with a Prometheus receiver and remote-write to your backend, or  
   - run a sidecar that polls **`/internal/ops/metrics/security`** and emits OTLP metrics from the JSON counters.
3. **Traces:** Export OTLP HTTP from the API process using the variables above; correlate alerts via **`metric_alert_trace_hints`** and log **`trace_id`**.

---

## Alerting ideas

- **Spike** `tenant_resolution_failures_total{code="TENANT_HOST_UNKNOWN"}` → DNS / provisioning / typo subdomain.
- **Spike** `tenant_mismatch_total` → clients mixing Host and JWT workspace (or proxy misconfiguration).
- **Spike** `AUTH_LOGIN_FAILURE` → OTP brute-force, wrong workspace host, or misconfigured auth (combine with rate-limit metrics).
- **Spike** `AUTH_MEMBERSHIP_DENIED` → users hitting wrong workspace URL.

---

## Files touched (reference)

- `apps/api/src/tracing.ts` — OTEL `NodeSDK` bootstrap + request-context span processor
- `apps/api/src/common/observability/tracing.service.ts` — manual `withSpan` helper
- `apps/api/src/common/observability/active-trace-log-fields.ts` — log correlation fields
- `apps/api/src/common/observability/observability-metrics.service.ts`
- `apps/api/src/common/observability/observability.module.ts`
- `apps/api/src/common/observability/http-observability.interceptor.ts`
- `apps/api/src/common/request-context/request-context.ts` — `hostTenantId`
- `apps/api/src/common/request-context/request-context.service.ts` — structured context + `setHostTenantId`
- `apps/api/src/common/logger/logger.service.ts` — merge order (context then explicit meta)
- `apps/api/src/common/errors/global-exception.filter.ts` — metrics + structured error logs
- `apps/api/src/common/tenant/tenant-resolver.middleware.ts` — `setHostTenantId`
- `apps/api/src/modules/ops/ops.controller.ts` — metrics endpoints
