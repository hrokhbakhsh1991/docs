# Prometheus metrics export scaffold (DEC-108 / SCAL-LIM-02)

```yaml
status: implemented
phase: 5 evolution — P2 Phase 3 (+ Platform 5.3 DEC-121)
closes: SCAL-LIM-02, SCAL-LIM-03 (partial)
related: prometheus-servicemonitor-adapter.md DEC-121
```

## Problem

`MetricsRegistry` is in-process only — HPA cannot scrape pool depth, validation queue, or outbox lag ([SCAL-LIM-02](phase5-evolution-audit.md)).

## Decision

| Item           | Choice                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format         | Prometheus text exposition 0.0.4                                                                                                                               |
| Route          | `GET /internal/metrics` — dev/test open; **production** requires JWT `ops_scope: metrics:read`                                                                 |
| Series         | All counters/gauges from `metricsRegistry.snapshot()` + runtime gauges                                                                                         |
| Runtime gauges | `http_requests_in_flight`, `outbox_pending_total`, `outbox_failed_total`, `validation_queue_depth_total`, `db_circuit_open`, `redis_rate_limiter_circuit_open` |

Production scrape: `ServiceMonitor` + bearer token secret — see [`prometheus-servicemonitor-adapter.md`](prometheus-servicemonitor-adapter.md).

## Verification

```bash
cd apps/api && pnpm run guard:metrics-prometheus-export
node --import tsx --test src/observability/prometheus-format.spec.ts
```
