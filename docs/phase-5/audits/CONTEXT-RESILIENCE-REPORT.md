# Context resilience report — TenantContext / ALS after failures

**Date:** 2026-06-05  
**Spec:** [`apps/api/test/0-security/context-resilience.spec.ts`](../../../apps/api/test/0-security/context-resilience.spec.ts)  
**Implementation:** [`apps/api/src/tenant/tenant-request-context.ts`](../../../apps/api/src/tenant/tenant-request-context.ts)

## Executive summary

| Question                      | Result                                                               |
| ----------------------------- | -------------------------------------------------------------------- |
| Context persists after error? | **No** (ALS clears when `runWithTenantContext` rejects or completes) |
| Leak location                 | **None observed** — no `enterWith`, no global tenant id              |
| Spec verdict                  | **PASS** (see test run section below)                                |

## Scope

Two isolation mechanisms must not be conflated:

| Layer            | Mechanism                                                                            | Lifetime                                                       |
| ---------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **ALS**          | `AsyncLocalStorage.run` in `runWithTenantContext`                                    | Request / job callback — restored when `run`'s promise settles |
| **Postgres RLS** | `set_config('app.current_tenant_id', …, true)` inside `withTenantRls` `$transaction` | **Transaction-local** on the connection used for that TX       |

The spec exercises both: ALS via `getActiveTenantId()`, Postgres via `current_setting('app.current_tenant_id', true)` under `withTenantRls`.

## Trace — ALS binding

```mermaid
flowchart TD
  HTTP[HTTP createRequestListener] --> Routes[tours.routes handleCreateTour]
  Routes --> Kernel[resolveTenantContextFromRequest tenant-kernel]
  Kernel --> Svc[ToursService.createTour]
  Svc --> Canon[CanonicalTourService.writeTour]
  Canon --> ALS[runWithTenantContext tenantId]
  ALS --> Persist[persistNewTourAtomically / withTenantRls in TX]
```

- **ALS store:** single module-level `tenantRequestStorage` (`AsyncLocalStorage<TenantRequestStore>`).
- **Binding API:** only `tenantRequestStorage.run(store, run)` — no `enterWith`, no process-global `tenantId`.
- **Reads:** `getActiveTenantId()` → `getStore()?.tenantId`; outside `run`, store is `undefined`.

On throw or rejected promise, Node restores the parent async context when the `run` callback's returned promise settles; the implementation does not need an extra `try/finally` for store teardown (unlike manual `enterWith` patterns).

## Middleware / HTTP chain

[`apps/api/src/app.ts`](../../../apps/api/src/app.ts) does **not** wrap the listener in ALS middleware. Tenant for HTTP is resolved per handler via [`resolveTenantContextFromRequest`](../../../apps/api/src/tenant-kernel/tenant-kernel.ts) and passed explicitly into `ToursService`; ALS is entered in [`CanonicalTourService.writeTour`](../../../apps/api/src/canonical/canonical-tour.service.ts).

Implication for resilience: a crashed HTTP handler does not leave ALS bound **unless** work was inside an active `runWithTenantContext` (or a nested `run`). Errors in route `try/catch` do not touch ALS unless the canonical write path was entered.

## Nested / re-entrant context

[`persistNewTourAtomically`](../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts) may call `runWithTenantContext` only when `getActiveTenantId()` is already `undefined`; otherwise it requires `input.tenantId` to match the active store. Nested `run` for the same tenant is safe; mismatched tenant throws `ATOMIC_PERSIST_TENANT_CONTEXT_MISMATCH`.

## Cross-links

| Artifact                                | Path                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| This spec                               | `apps/api/test/0-security/context-resilience.spec.ts`                                                                           |
| `async-context-leak.spec.ts`            | **Not present** in `app-tour` — no file to link                                                                                 |
| Legacy e2e (Nest ALS / request context) | [`legacy/apps/api/test/e2e/tenant-context-leak.e2e-spec.ts`](../../../legacy/apps/api/test/e2e/tenant-context-leak.e2e-spec.ts) |
| Concurrent ALS stress                   | [`apps/api/test/security-isolation-stress.spec.ts`](../../../apps/api/test/security-isolation-stress.spec.ts)                   |
| PG RLS helper                           | [`apps/api/src/db/with-tenant-rls.ts`](../../../apps/api/src/db/with-tenant-rls.ts)                                             |

## Scenarios covered

1. **ALS-01** — async rejection after `await` inside `runWithTenantContext`; ALS cleared outside.
2. **ALS-02** — synchronous throw inside wrapped block; ALS cleared outside.
3. **ALS-03** — direct `Promise.reject` from async fn; ALS cleared outside.
4. **ALS-04** — 10 iterations, alternating tenants, half throw / half succeed; ALS cleared after each.
5. **PG-01** — simulate "next request": A crashes, then B on same process; ALS = B only in B's run; `current_setting` = B under B's `withTenantRls`.
6. **PG-02** — interleaved fail/success rounds with PG reads.
7. **PG-03** — documents PG TX scope vs ALS (no cross-layer bleed).

## Fix proposal

**Not required** for current code: `runWithTenantContext` correctly delegates to `AsyncLocalStorage.run`, which auto-exits on throw/rejection.

If a future leak appears:

1. Grep for `enterWith` or a module-level mutable `currentTenantId`.
2. Ensure background jobs always wrap body in `runWithTenantContext` (same as `writeTour`).
3. Do **not** rely on `set_config` without `true` (session-level) on pooled connections — keep `withTenantRls` transaction pattern.

## Test execution

Run (Node 24, live Postgres e.g. port **5434**):

```bash
cd apps/api
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db'
NODE_ENV=test node --import tsx --test test/0-security/context-resilience.spec.ts
```

## Sync throw note (non-leak)

`runWithTenantContext` types `run` as `() => Promise<T>`. A **synchronous** throw in a non-async callback propagates from `AsyncLocalStorage.run` immediately (not always as `assert.rejects(() => runWithTenantContext(...))`). ALS still clears; the spec uses `try/catch` around `await` for ALS-02. Optional hardening: wrap `run()` in `Promise.resolve().then(run)` inside `tenant-request-context.ts` — not required for isolation.

## Test run (2026-06-05)

| Run         | `DATABASE_URL`                                          | Result         |
| ----------- | ------------------------------------------------------- | -------------- |
| Local agent | `postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db` | **PASS** (7/7) |

## Return to parent

- **Context persists after error?** **N**
- **Leak location?** **N/A** (no leak; ALS `run` only)
- **PASS/FAIL:** **PASS**
