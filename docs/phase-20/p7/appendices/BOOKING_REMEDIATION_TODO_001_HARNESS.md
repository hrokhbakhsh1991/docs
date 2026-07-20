# TODO-001 — Production auth harness fail-closed

```yaml
doc_id: BOOKING_REMEDIATION_TODO_001_HARNESS
status: ACTIVE
date: "2026-07-20"
severity: P0
security: fail-closed
```

## Problem

`APPS_API_PRODUCTION_AUTH_HARNESS=1` previously relaxed production storage, OTP, Redis rate-limit, and tenant-registry invariants even when `NODE_ENV=production`. A mis-set env var could ship memory storage under a production process.

## Fix (fail-closed)

1. **`isProductionAuthHarnessActive()`** is true **only** when `APPS_API_PRODUCTION_AUTH_HARNESS=1` **and** `NODE_ENV=test`.
2. **`assertProductionAuthHarnessAbsent()`** — if `NODE_ENV=production` and the harness flag is set, boot throws `PRODUCTION_AUTH_HARNESS_FORBIDDEN` (reject, do not ignore).
3. Production never opens DEV_TENANTS fallback (`canResolveDevTenantRegistryFallback` → false).
4. Dead harness early-returns removed from storage / auth OTP / Redis production asserts.

## Proof

```bash
pnpm --filter @apps/api exec node --import tsx --test \
  src/test/production-auth-harness.spec.ts \
  src/server/production-runtime-env.spec.ts
```

| Case | Env | Expected |
| ---- | --- | -------- |
| 1 | `NODE_ENV=production` + harness=`1` | Boot fails (`PRODUCTION_AUTH_HARNESS_FORBIDDEN`) |
| 2 | `NODE_ENV=production` + `STORAGE_DRIVER=memory` | Boot fails (`PRODUCTION_STORAGE_DRIVER_FORBIDDEN`) |
| 3 | `NODE_ENV=test` + harness=`1` | Harness active |

## Consumers (harness active ⇒ `NODE_ENV=test` only)

| Module | Effect |
| ------ | ------ |
| Rate limiter | May force memory store in tests |
| All production asserts | Harness never skips — flag present in production aborts boot |
