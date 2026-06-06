# ALS Context Security Report

**Spec:** `apps/api/test/0-security/async-context-leak.spec.ts`  
**Related:** [TENANT-KERNEL-LOAD-REPORT](./TENANT-KERNEL-LOAD-REPORT.md) (HTTP + RLS load under mixed tenants)

## Scenario

- `Promise.all` with **50** concurrent tasks: **25× tenant A** + **25× tenant B**
- Each task binds `runWithTenantContext(tenantId, …)` at the **top** of its async function
- Deep chain: nested `await`, `setImmediate`, `setTimeout(0)`, then `withTenantRls` + Prisma
- Assertions per task:
  - `getActiveTenantId()` === bound tenant (never the other tenant)
  - `requireActiveTenantId()` === bound tenant
  - `SELECT current_setting('app.current_tenant_id', true)` === bound tenant UUID
  - Lightweight `tx.tour.count` under RLS

## Environment

```bash
export DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db
export DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
export STORAGE_DRIVER=prisma
```

## Result

| Field               | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Status**          | **PASS**                                                                                              |
| **Iteration count** | 50 (25× tenant A + 25× tenant B)                                                                      |
| **Assertions**      | ALS (`getActiveTenantId`, `requireActiveTenantId`), Postgres `app.current_tenant_id`, `tx.tour.count` |
| **Duration**        | ~579 ms (probe test)                                                                                  |
| **Postgres**        | 127.0.0.1:5434                                                                                        |
| **Node**            | 24.16.0                                                                                               |
| **Date**            | 2026-06-05                                                                                            |

No cross-tenant context leaks observed. Zero tasks reported `ALS_CROSS_TENANT_LEAK` or `PG_SETTING_CROSS_TENANT_LEAK`.

## Run command

```bash
cd apps/api
NODE_ENV=test node --import tsx --test test/0-security/async-context-leak.spec.ts
```

Any `ALS_CROSS_TENANT_LEAK` or `PG_SETTING_CROSS_TENANT_LEAK` failure is treated as a **critical** tenant isolation bug.
