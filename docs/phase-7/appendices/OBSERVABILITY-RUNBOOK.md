# Observability runbook (MAP §10)

```yaml
runbook_version: "2026-06-07-v2"
decision: DEC-P7-005
map_ref: docs/MIGRATION-MAP.md §10
implementation: apps/api/src/observability/logger.ts · apps/api/src/http/request-logging.ts
```

## Required log fields (§10.2)

Emitted on every completed HTTP request via `event: http.request` (pino `info`).

| Field           | JSON key        | Source                                        | Required when           |
| --------------- | --------------- | --------------------------------------------- | ----------------------- |
| `requestId`     | `requestId`     | trace ALS (`getActiveTraceId`)                | always when trace bound |
| `tenantId`      | `tenantId`      | tenant ALS (`getActiveTenantId`)              | tenant-bound routes     |
| `workspaceType` | `workspaceType` | tenant ALS (resolved at HTTP bind)            | tenant-bound routes     |
| `tenantTier`    | `tenantTier`    | `resolveTenantConnectionTier` (pool stub 7.7) | tenant-bound routes     |
| `durationMs`    | `durationMs`    | request lifecycle                             | always                  |
| `level`         | pino level      | logger                                        | always                  |
| `message`       | pino msg        | `"request completed"`                         | always                  |

**Backward compat:** `correlation_id` duplicates `requestId` when trace ALS is bound (DEC-048).

**Health / unauthenticated routes:** omit `tenantId`, `workspaceType`, `tenantTier` — no fake tenant context.

## Alert matrix

| Alert                  | Signal                              | Severity | Threshold                       | Window   |
| ---------------------- | ----------------------------------- | -------- | ------------------------------- | -------- |
| High 5xx rate          | `http.request` `statusCode >= 500`  | P1       | > 1% of requests                | 5m roll  |
| Rate limit spike       | HTTP 429 or `RATE_LIMIT_EXCEEDED`   | P2       | > 50 events per `tenantId`      | 1m       |
| Silo connection fail   | `tenantTier=silo` + DB errors       | P1       | any occurrence                  | 1m       |
| Missing tenant context | tenant route without `tenantId` log | P0       | any in audit sample             | per gate |
| Missing workspaceType  | tenant route without field          | P1       | > 0.1% of tenant-bound requests | 15m roll |
| Log queue drop         | `event: http.log_queue_drop`        | P2       | any `dropped > 0`               | 5m       |

## On-call steps

1. Collect `requestId` from user report, support ticket, or `x-correlation-id` response header.
2. Filter structured logs: `requestId` OR `tenantId` + `durationMs` + time window (±15m).
3. Inspect `workspaceType` — confirms which plugin validation path ran.
4. Check `tenantTier`:
   - `pool` — shared `DATABASE_URL` + RLS; check pool saturation / `DB_POOL_SATURATED`.
   - `silo` — dedicated URL (7.7+); verify `tenant_routes` row and connectivity.
5. For 429 storms: correlate with `retryAfterMs` in response body and `rate_limiter_redis_fallback_total` metric.
6. Escalate to Phase 4 adversarial subset if cross-tenant data suspected.

## Optional OTel (DEC-P7-012)

| Variable                      | Purpose                      |
| ----------------------------- | ---------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP/gRPC collector URL |
| `OTEL_SERVICE_NAME`           | defaults to `@apps/api`      |

- Ingress accepts W3C `traceparent`; outbound propagation not required for 7.9 minimal DoD.
- When unset: logs-only observability — acceptable through Phase 7.9.

## Verification

```bash
node scripts/guards/audit-log-fields.mjs --phase 7
```

- REQ-P7-015..017 — subphase 7.5
