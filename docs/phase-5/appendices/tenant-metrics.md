# Tenant-scoped metrics (Phase 5 observability scaffold)

```yaml
agent_load_tier: T2_behavioral
scope: in-process labeled counters for canonical write path
deferred_full_stack: Phase 7 (Prometheus scrape, OTLP remote-write, cardinality budgets)
cross_ref:
  observability: docs/phase-4/appendices/observability.md
  trace_als: docs/phase-5/appendices/trace-request-context.md
```

## Purpose

Provide **tenant-labeled counters** on the canonical tour write path so reliability tests can prove metrics are not aggregated across tenants. This is the minimal in-process registry required before Phase 7 Prometheus/OTLP export.

## Registry API

| Export                                              | Role                                       |
| --------------------------------------------------- | ------------------------------------------ |
| `metricsRegistry.increment(name, labels?, amount?)` | Bump a labeled counter                     |
| `metricsRegistry.getMetric(name, labels?)`          | Read counter value (0 when absent)         |
| `metricsRegistry.reset()`                           | Clear all counters — **tests only**        |
| `resetMetricsRegistryForTests()`                    | Alias for `metricsRegistry.reset()`        |
| `recordTourCreated(tenantId)`                       | Increment `tour_creation_count{tenant_id}` |

Implementation: `apps/api/src/observability/metrics.ts` — single global registry (process lifetime).

## Metric catalog (Phase 5)

| Name                             | Labels      | When incremented                                                                         |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `tour_creation_count`            | `tenant_id` | After successful `CanonicalTourService.writeTour` persist (memory + atomic Prisma paths) |
| `projection_inconsistency_total` | `tenant_id` | `recordProjectionInconsistency` — downstream handler drift signal (DEC-008)              |

**Label contract (MET-API-01 / DEC-049):** Names in `TENANT_SCOPED_METRIC_NAMES` **require** non-empty `tenant_id` at `increment` time — runtime throws `METRIC_TENANT_LABEL_REQUIRED`. CI guard `guard:tenant-metrics-labels` locks direct call sites.

## Instrumentation point

```
ToursService.createTour
  → CanonicalTourService.writeTour
       → persist (memory or atomic TX)
       → recordTourCreated(record.tenantId)   ← metrics hook
       → publishTourCreatedEvent (memory path only; outbox on atomic path)
```

Metrics fire only on **successful** persist. Validation failures and TX rollbacks must not increment.

## Verification

| Spec           | Path                                                   | Proves                                                                            |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Tenant metrics | `apps/api/test/2-observability/tenant-metrics.spec.ts` | 50 creates tenant A + 10 tenant B → `tour_creation_count` labels match separately |

Run:

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/tenant-metrics.spec.ts
```

## Phase boundaries

| Capability                                    | Phase            |
| --------------------------------------------- | ---------------- |
| In-process labeled counters + test registry   | **5** (this doc) |
| `/metrics` Prometheus text endpoint           | **7**            |
| Per-tenant cardinality budgets / silo routing | **7**            |
| Outbox relay counters                         | **7**            |
