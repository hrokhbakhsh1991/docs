# Pool saturation 503 + Retry-After (DEC-113 / evolution Phase 4.4)

```yaml
status: implemented
phase: 5 evolution — Phase 4.4
closes: SH-GAP-05 (complete), SCAL-LIM-10 (partial)
related: transient-db-error.md, IMPLEMENTATION-DECISIONS.md DEC-012
```

## Problem

Pool acquire timeouts mapped to `DB_POOL_SATURATED` → HTTP **503**, but clients only received a generic `service_unavailable` body. DEC-094 added `Retry-After: 1` on the **generic** 503 fallback — not a **typed** pool-saturation signal with configurable delay ([SH-GAP-05](phase5-evolution-audit.md)).

`TENANT_DB_BUDGET_EXCEEDED` (per-tenant app-pool semaphore) returned **503** with **no** `Retry-After` — same client blind-retry risk under noisy-neighbor load.

## Decision

| Item            | Choice                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Typed error     | `DbPoolSaturatedError` in `pool-saturation.ts`                                                 |
| Code            | `DB_POOL_SATURATED`                                                                            |
| Retry-After     | `resolvePoolSaturationRetryAfterSec()` — env `DB_POOL_SATURATED_RETRY_AFTER_SEC` default **2** |
| HTTP            | `error-interceptor.ts` explicit handler before generic message map                             |
| Tenant budget   | `TenantDbBudgetExceededError` → **503** + same `Retry-After`                                   |
| Backward compat | `isDbPoolSaturatedError` accepts legacy `Error` message prefix                                 |

## Verification

```bash
cd apps/api
pnpm run guard:pool-saturation-retry-after
node --import tsx --test src/db/pool-saturation.spec.ts src/middleware/error-interceptor-pool-saturation.spec.ts
pnpm run phase-5:evolution-gate
```
