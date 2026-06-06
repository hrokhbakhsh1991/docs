# ServiceMonitor + Prometheus Adapter (DEC-121)

```yaml
status: implemented
phase: 5 evolution — Platform 5.3
closes: SCAL-LIM-01, SCAL-LIM-02, SCAL-LIM-15 (partial)
extends: DEC-108
related: metrics-prometheus-export.md, api-hpa-custom-metrics.md DEC-122
```

## Problem

| Gap             | Issue                                             |
| --------------- | ------------------------------------------------- |
| **SCAL-LIM-01** | No custom metrics for K8s HPA — CPU-only scaling  |
| **SCAL-LIM-02** | Pool/queue/outbox depth not visible to Prometheus |
| **SCAL-LIM-15** | No in-repo scrape contract for production         |

DEC-108 exported Prometheus text on `GET /internal/metrics` but **dev/test only**.

## Decision

| Item        | Choice                                                                        |
| ----------- | ----------------------------------------------------------------------------- |
| Scrape      | `ServiceMonitor` → `GET /internal/metrics` every 15s                          |
| Auth (prod) | Bearer service JWT with `ops_scope: metrics:read` (DEC-107 dual-key)          |
| HPA series  | `http_requests_in_flight`, `outbox_pending_total` (+ existing runtime gauges) |
| Adapter     | `prometheus-adapter` ConfigMap rules map PromQL → `custom.metrics.k8s.io`     |

### Manifest layout

| Path                                        | Kind                                     |
| ------------------------------------------- | ---------------------------------------- |
| `deploy/prometheus/api-servicemonitor.yaml` | `ServiceMonitor`                         |
| `deploy/prometheus/adapter-rules.yaml`      | `ConfigMap` (`prometheus-adapter` rules) |

### Application gauges (DEC-121)

| Metric                         | Source                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `http_requests_in_flight`      | `withRequestLogging` — all HTTP requests                      |
| `outbox_pending_total`         | Refreshed each outbox relay tick via `countPendingOutboxRows` |
| `validation_queue_depth_total` | Existing (DEC-108)                                            |
| `db_circuit_open`              | Existing (DEC-108)                                            |

### Prometheus Adapter rules

Expose pod-level sums for HPA:

```text
custom.metrics.k8s.io/v1beta1
  → pods/http_requests_in_flight
  → pods/outbox_pending_total
```

`adapter-rules.yaml` uses `seriesQuery` / `metricsQuery` for `http_requests_in_flight` and `outbox_pending_total` with `namespace` + `pod` resource mapping.

### Ops prerequisites

1. Prometheus Operator + `ServiceMonitor` CRD installed.
2. `prometheus-adapter` deployed; mount `adapter-rules` ConfigMap.
3. Secret `api-metrics-scrape-jwt` in `app-tour` — long-lived JWT with `ops_scope: metrics:read` for Prometheus bearer scrape.
4. `api-active` Service selects Rollout pods (`app: api`).

## Verification

```bash
cd apps/api
pnpm run guard:deploy-prometheus-adapter
pnpm run guard:metrics-prometheus-export
pnpm run phase-5:evolution-gate
```

Cluster smoke:

```bash
kubectl apply -f deploy/prometheus/api-servicemonitor.yaml
kubectl get servicemonitor api -n app-tour
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1/namespaces/app-tour/pods/*/http_requests_in_flight"
```
