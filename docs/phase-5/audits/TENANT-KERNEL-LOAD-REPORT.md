# Tenant-kernel load + RLS verification report

**Date:** 2026-06-05  
**Spec:** [`apps/api/test/security/tenant-kernel-load-rls.spec.ts`](../../../apps/api/test/security/tenant-kernel-load-rls.spec.ts)  
**Stack:** Postgres `127.0.0.1:5434`, `STORAGE_DRIVER=prisma`, `app_tour` + RLS (`tours`, `outbox_events`, `audit_events`)

## Verdict

| Check                                 | Result   | Notes                                                                                                                  |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant leakage                  | **PASS** | No HTTP tenant mismatch; no `SECURITY_RLS_LEAK_*` on tours/outbox/audit under `set_config('app.current_tenant_id', …)` |
| Race / partial writes                 | **PASS** | No orphan tour/outbox pairs; no non-transient op failures after pool sizing + one retry                                |
| Latency isolation (A read vs B burst) | **PASS** | Met **absolute** p95 cap; **ratio** vs baseline exceeded 2× (see metrics)                                              |
| 50 concurrent ops / 20 tenants        | **PASS** | `Promise.allSettled` burst completed; post-load RLS matrix clean                                                       |

**Overall: PASS** (local run with `connection_limit=64` on `DATABASE_URL`)

## Run command

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
cd apps/api
DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=64" \
DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db" \
STORAGE_DRIVER=prisma NODE_ENV=test \
node --import tsx --test --test-concurrency=1 test/security/tenant-kernel-load-rls.spec.ts
```

Emit JSON metrics: append `TENANT_KERNEL_LOAD_EMIT=1` and grep `TENANT_KERNEL_LOAD_JSON`.

## Load pattern

| Parameter           | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Distinct tenants    | 20 (`integrationTenantId()`)                                                                              |
| Concurrent HTTP ops | 50 (25 POST `/tours`, 25 GET `/tours/:id` seed)                                                           |
| Ingress             | `createRequestListener` + `authHeaders` (TenantKernel headers)                                            |
| Latency probe       | Tenant **A** GET seed tour; tenant **B** **32** concurrent POST while **25** A reads (before 50-op storm) |

## Thresholds (latency isolation)

| Metric                     | Threshold                               | Observed (last local run)               |
| -------------------------- | --------------------------------------- | --------------------------------------- |
| Tenant A baseline p95      | —                                       | **28.94 ms**                            |
| Tenant A p95 under B burst | **&lt; 2× baseline** OR **&lt; 800 ms** | **671.03 ms** (ratio **23.18×**)        |
| Pass rule                  | OR of ratio and absolute cap            | **PASS** via absolute cap (&lt; 800 ms) |

**Interpretation:** Under dedicated B-write burst, tenant A reads remain sub-800 ms p95 but are **not** within 2× a cold baseline (~29 ms). Shared Prisma pool / Postgres contention is visible; production should size pool and separate read replicas if stricter ratio SLO is required.

## Timing (50-op mixed load, post-isolation probe)

| Stat         | ms     |
| ------------ | ------ |
| Ops recorded | 50     |
| p50          | 585.28 |
| p95          | 616.55 |
| max          | 619.50 |

## Leakage

None observed. Verification layers:

1. HTTP response `tenantId` matches ALS/header tenant on 200/201.
2. Per-tenant `app_tour` session: `tour.findMany`, cross `findUnique` / outbox / audit by foreign `entityId`.
3. Full **viewer × owner** matrix on foreign tour ids (post-load).
4. Admin `groupBy` tenant integrity on fixture ids.

**If leakage recurs:** inspect transaction-scoped tenant binding in `apps/api/src/db/with-canonical-transaction.ts` and `apps/api/src/db/with-tenant-rls.ts` (`set_config(..., true)` scope).

## Races / transient errors

None after:

- `connection_limit=64` on app DB URL (test `before` hook + env).
- One retry for `Unable to start a transaction` pool timeouts.
- RLS checks deferred until after concurrent HTTP (avoids nested transaction pile-up).

## Recommendation

1. **Keep** `tenant-kernel-load-rls.spec.ts` in Phase 5 / security gate when `DATABASE_URL` is set (same tier as `security-isolation-stress.spec.ts`).
2. **CI:** pass `?connection_limit=64` (or higher) for this spec only; document in `docs/phase-5/appendices/env-runtime-matrix.md` if promoted to gate.
3. **SLO tightening:** if product requires &lt;2× read latency under neighbor write burst, add read connection pool or throttle burst writes; current data fails ratio but passes 800 ms absolute cap.
4. **No RLS defect** indicated in this run — isolation holds under load.

## Architect note

Test-only + audit artifact; no production code changes in this verification pass.
