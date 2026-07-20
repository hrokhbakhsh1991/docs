# TODO-009 — Storage driver default with DATABASE_URL

```yaml
doc_id: BOOKING_REMEDIATION_TODO_009_STORAGE_DEFAULT
status: ACTIVE
date: "2026-07-20"
severity: P1
```

## Problem

`resolveStorageDriver()` defaulted to `memory` whenever `NODE_ENV !== production`, even when `DATABASE_URL` was set. Staging/dev mis-config could silently run memory repositories against a Postgres-backed deploy expectation.

## Fix

Resolution order in `apps/api/src/storage/production-storage-driver-assert.ts`:

1. Explicit `STORAGE_DRIVER=memory|prisma` wins
2. Else if `DATABASE_URL` is non-empty → **`prisma`**
3. Else if `NODE_ENV=production` → `prisma`
4. Else → `memory`

Production fail-closed (`assertProductionStorageDriver`) unchanged: memory still forbidden under `NODE_ENV=production`.

## Explicit memory

Unit/HTTP memory suites must set `STORAGE_DRIVER=memory` (see `installMemoryStorageDriverForDescribe`).
