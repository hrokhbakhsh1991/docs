# Outbox projection lag + reconcile job (DEC-088 / Wave C)

```yaml
status: implemented
phase: 4 resilience — Wave C
closes: F-04, OZ-D (partial)
related: projection-reconciliation.ts, projection-sync.ts
```

## Problem

When idempotent handler fails after outbox `done`, `projection_inconsistency_total` increments but ops lacked **time-since-done** signal for backlog triage. Projections live on `tours.title` / `tours.schema_version` (DEC-003) — drift is detectable by comparing canonical JSON to derived columns.

## Decision

| Item    | Choice                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Metric  | `outbox_projection_lag_seconds{tenant_id}` — gauge (seconds since outbox `processed_at` for mismatched tour) |
| Emit on | `recordProjectionInconsistency` when `lagSeconds` provided; reconcile job on scan                            |
| Job     | `pnpm run reconcile:tour-projection -- --tenant=<uuid>`                                                      |
| Module  | `reconcile-tour-projection.ts`                                                                               |
| Guard   | `guard:outbox-projection-lag`                                                                                |

### Reconcile algorithm

1. Load tours for tenant (batch limit 100).
2. `deriveTourProjections(canonical)` vs stored `title` / `schemaVersion`.
3. On mismatch: find latest `TourCreated` outbox `done` row; `lag = now - processed_at`.
4. `observe(outbox_projection_lag_seconds, lag, { tenant_id })`.

**Auto-repair** added in DEC-115 — see [projection-auto-reconcile.md](projection-auto-reconcile.md). CLI scan without `--repair` remains metric-only.

## Verification

```bash
cd apps/api && pnpm run guard:outbox-projection-lag
node --import tsx --test src/events/projection-reconciliation.spec.ts
```
