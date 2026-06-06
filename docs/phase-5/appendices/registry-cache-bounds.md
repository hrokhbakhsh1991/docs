# Tenant registry cache bounds (DEC-068 / SCAL-DEBT-12)

```yaml
status: implemented
phase: 3 scalability audit — closure step 17
closes: SCAL-DEBT-12, RL-DOS-03 (partial — complements DEC-053 theme cache)
related: DEC-053, DEC-074, tenant-registry-cache.ts
```

## Problem

`tenant-registry-cache.ts` used **5s TTL** with lazy expiry only. Under rotating tenant UUID floods, `byId`, `bySubdomain`, and `themeById` Maps could grow without bound until TTL — admin-read amplification risk ([RL-DOS-03](../../../apps/api/docs/phase3-scalability-stress-audit.md)).

## Decision

| Knob                                | Default     | Behavior                                                   |
| ----------------------------------- | ----------- | ---------------------------------------------------------- |
| `TENANT_REGISTRY_CACHE_MAX_ENTRIES` | **1024**    | Max keys **per map** (`byId`, `bySubdomain`, `themeById`)  |
| TTL                                 | **5000 ms** | Unchanged — lazy expiry on read + proactive sweep on write |
| Eviction                            | LRU         | Oldest key removed when over cap after expired purge       |

## Semantics

1. Every cache write calls `enforceMapBounds` for that map.
2. Expired entries purged before LRU eviction.
3. `processing` N/A — all entries are cache rows; negative `null` entries count toward cap.

## Implementation map

| File                                                      | Role                          |
| --------------------------------------------------------- | ----------------------------- |
| `apps/api/src/tenant/tenant-registry-cache.ts`            | TTL + max entries + LRU sweep |
| `apps/api/scripts/guard-tenant-registry-cache-bounds.mjs` | CI lock                       |
| `apps/api/src/tenant/tenant-registry-cache.spec.ts`       | Unit bounds tests             |

## Write-path invalidation (DEC-074)

Admin tenant writes call `invalidateTenantRegistryCache` — see [`tenant-registry-cache-invalidation.md`](tenant-registry-cache-invalidation.md).

## Verification

```bash
cd apps/api && pnpm run guard:tenant-registry-cache-bounds
pnpm run guard:tenant-registry-cache-invalidation
node --import tsx --test src/tenant/tenant-registry-cache.spec.ts
node --import tsx --test src/tenant/tenant-registry-cache-invalidation.spec.ts
```
