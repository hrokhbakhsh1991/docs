# Pool leak post-storm monitor (A4)

```yaml
status: accepted
phase: 3 scalability audit — § Pool 500 stress
closes: A4 checklist — connection leak residual after 503 storm
mitigated_by: DEC-012
related: connection-budget.md, phase5-slo-alerting.md
```

## Problem

Phase 3 gate proves **500 parallel** long-TX holds return **460×503** without hang and **`connectionLeakSuspected=false`** after cooldown ([`pool-stress-500-parallel.ts`](../../../apps/api/scripts/pool-stress-500-parallel.ts)). A regression that leaves **`idle in transaction`** backends or active count above `connection_limit` would be a **hard-fail** risk (pool leak without recovery) — not graceful 503.

Trunk gate covers **100 concurrent** (`db-pool-saturation.spec.ts`); 500× is **nightly / manual** only. Operators need runtime visibility when storms occur and a recurring leak check when Postgres is available.

## Decision

| Layer            | Behavior                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Runtime counter  | Each HTTP **503** `DB_POOL_SATURATED` increments `db_pool_saturated_total`                                             |
| Prometheus alert | `AppTourDbPoolSaturationStorm` when storm rate exceeds budget                                                          |
| Nightly probe    | `pool-stress-500-nightly-probe.mjs` — runs 500× script when `DATABASE_URL` set; **fails** on `connectionLeakSuspected` |
| Trunk guard      | Static contract lock — no 500× on PR path (monitor only)                                                               |

### Leak definition (unchanged from audit)

Post-cooldown `pg_stat_activity` for `app_tour` role:

- `idleInTransaction > 0` → leak suspected
- `active > connection_limit` → leak suspected
- High **idle** count alone is **not** leak — Prisma pool cache

### Metrics

| Metric                    | Type    | Meaning                                                              |
| ------------------------- | ------- | -------------------------------------------------------------------- |
| `db_pool_saturated_total` | counter | HTTP 503 responses with code `DB_POOL_SATURATED` since process start |

### Alert rules (DEC-123 extension)

| Alert                          | Expr                                         | `for` | Severity |
| ------------------------------ | -------------------------------------------- | ----- | -------- |
| `AppTourDbPoolSaturationStorm` | `increase(db_pool_saturated_total[5m]) > 50` | 2m    | warning  |

Label `slo: pool_storm` — expected during traffic spikes; sustained growth with elevated `db_circuit_open` or error logs warrants scale-out or pool tuning. **Not** a trunk gate blocker.

```mermaid
sequenceDiagram
  participant Client
  participant API as error-interceptor
  participant M as pool-saturation-monitor
  participant Prom as Prometheus
  participant Nightly as pool-stress-500-nightly

  Client->>API: long TX storm
  API->>M: recordDbPoolSaturatedResponse
  M->>M: db_pool_saturated_total++
  Prom->>M: scrape /internal/metrics
  Prom-->>Client: alert if storm rate high
  Nightly->>Nightly: 500 parallel + cooldown
  alt connectionLeakSuspected
    Nightly-->>Nightly: FAIL nightly job
  else clean recovery
    Nightly-->>Nightly: PASS artifact
  end
```

## Residual (accepted)

| Scenario                          | Outcome                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| 500× probe without Postgres in CI | **Skipped** — artifact `verdict: skipped`; trunk guard still green |
| Prisma idle cache after storm     | **Not** leak — documented in probe                                 |
| Per-tenant budget 503             | **Not** counted — `tenant_db_budget_exceeded` is separate          |

## Verification

```bash
cd apps/api
pnpm run guard:pool-leak-post-storm
node --import tsx --test src/db/pool-saturation-monitor.spec.ts
node --import tsx --test src/middleware/error-interceptor-pool-saturation.spec.ts
pnpm run guard:deploy-phase5-slo-alerts

# With local Postgres (optional):
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=10&pool_timeout=1' \
  DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
  pnpm run test:nightly:pool-stress-500
```
