# Per-tenant connection budget (P2-5 — design)

```yaml
status: design_closed
sprint: enterprise-gap TEMP closed 2026-06-05
implementation: deferred_post_phase_6_main
related: DEC-012 (pool saturation 503), DEC-015 (HTTP rate limit)
gap: P2-5 — code not in Phase 4–5 / Phase 6 main scope
```

## Problem

HTTP rate limits (50 rps default) bound **request rate**, not **concurrent DB sessions** per tenant. A single tenant can still hold multiple Prisma pool connections during long transactions or parallel integration tests.

## Proposed model

| Layer      | Knob                                    | Behavior                                                                 |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------ |
| Pool       | `DATABASE_URL` `connection_limit`       | Global ceiling (existing)                                                |
| Per-tenant | `TENANT_MAX_CONCURRENT_DB_OPS` (future) | Semaphore in `withTenantRls` / `withCanonicalTransaction` before TX open |
| Saturation | DEC-012                                 | When global pool exhausted → HTTP 503 `DB_POOL_SATURATED`                |

## Semantics (target)

1. Acquire tenant slot before `prisma.$transaction` (non-blocking try; 503 if tenant at cap).
2. Release in `finally` on commit/rollback.
3. Nightly probe: two tenants × N parallel TX — tenant A at cap must not block tenant B below its cap.

## Out of scope (this sprint)

- Redis-backed distributed semaphore (multi-replica) — Phase 7.
- Replacing Prisma pool — use URL `connection_limit` + app semaphore.

## Verification (when implemented)

- `apps/api/test/3-performance/tenant-connection-budget.spec.ts` (planned)
- Doc cross-link from [`rate-limiting.md`](rate-limiting.md)
