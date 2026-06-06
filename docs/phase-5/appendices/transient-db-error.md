# Transient DB error classifier + circuit breaker (DEC-094)

```yaml
status: implemented
phase: 5 evolution — P0 Phase 1
closes: SH-GAP-04, SH-GAP-05, SH-GAP-15
related: phase5-evolution-audit.md § Self-Heal recommendations #1 and #5
```

## Problem

Postgres blips (`P1001` can't reach server, `P1017` connection closed) surface as HTTP **500** `internal_error`. Clients retry without backoff; the pool keeps accepting work during total outage — no fast-fail gate ([SH-GAP-15](phase5-evolution-audit.md)).

## Decision

Centralize classification in `src/db/transient-db-error.ts`:

| Include                                             | Exclude                               |
| --------------------------------------------------- | ------------------------------------- |
| `P1001`, `P1002`, `P1017`                           | `P2002` uniqueness                    |
| Pool saturation regex (DEC-012)                     | Validation / business errors          |
| `ECONNRESET`, `ETIMEDOUT`, `EPIPE` in message chain | Multi-step TX without idempotency key |

Circuit breaker (`src/db/db-circuit-breaker.ts`):

| Constant                       | Value  |
| ------------------------------ | ------ |
| `DB_CIRCUIT_FAILURE_THRESHOLD` | 3      |
| `DB_CIRCUIT_OPEN_MS`           | 30_000 |

HTTP (`error-interceptor.ts`):

- `DbCircuitOpenError` → **503** + `Retry-After: 30`
- Transient Prisma / driver errors → **503** + `Retry-After: 1`
- Pool saturation (existing `DB_POOL_SATURATED`) → **503** + `Retry-After: 1`

## Integration

`withTenantRls` wraps the transaction in `withTransientDbGuard` (after circuit check, before pool mapping). Success clears consecutive failures; transient failure increments toward open.

**RLS note:** In-TX retry is **not** used inside `$transaction` callbacks. Canonical persist uses **whole-TX replay** via `withTransientTxRetry` in `withCanonicalTransaction` ([DEC-112](canonical-tx-transient-retry.md)). `withTenantRls` remains classify-only at the wrapper boundary.

## Verification

```bash
cd apps/api && pnpm run guard:transient-db-error
node --import tsx --test src/db/transient-db-error.spec.ts
```
