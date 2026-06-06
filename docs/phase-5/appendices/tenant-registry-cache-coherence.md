# Tenant registry cache coherence — feature flags (DEC-090 / Wave D)

```yaml
status: implemented
phase: 4 resilience — Wave D
closes: FF-RC-02, PU-F-03 (partial)
related: tenant-registry-cache-invalidation.md, feature-flag-degradation.md
```

## Problem

`resolveRegisteredTenantById` and `resolveTenantThemeJsonById` share a **5s read-through theme cache** (DEC-053 / DEC-074). `resolveTenantFeatureFlags` bypassed that cache and issued a fresh admin `tenant.findUnique` on every `POST`/`PATCH` tour:

1. **Extra admin round-trips** on the hot write path (RL-DOS / tail latency).
2. **Split-brain (FF-RC-02):** workspace metadata from cache generation _N_ while validation variant read from DB generation _N+1_ when theme changed mid-request window.

Enterprise pattern: **one theme slice, one cache, one invalidation path** for all consumers of `tenants.theme`.

## Decision

| Item               | Choice                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Read path          | `resolveTenantFeatureFlags` → `resolveTenantThemeJsonById` → `parseFeatureFlagsFromTheme` |
| Direct admin query | **Forbidden** in `resolve-tenant-feature-flags.ts`                                        |
| Invalidation       | Same as DEC-074 — `updateTenantRegistryRow` / provisioning clears theme slot              |
| Static registry    | Unchanged — `findTenantById` when `isStaticTenantRegistryAllowed()`                       |
| Guard              | `guard:tenant-registry-cache-coherence`                                                   |
| Spec               | `test/4-integration/tenant-registry-cache-coherence.spec.ts`                              |

## Flow

```mermaid
sequenceDiagram
  participant TS as ToursService
  participant FF as resolveTenantFeatureFlags
  participant Theme as resolveTenantThemeJsonById
  participant Cache as tenant-registry-cache
  participant PG as tenants.theme

  TS->>FF: createTour / updateTour
  FF->>Theme: resolveTenantThemeJsonById(tenantId)
  Theme->>Cache: getCachedTenantThemeById
  alt cache hit
    Cache-->>Theme: theme JSON
  else cache miss
    Theme->>PG: findUnique (select theme)
    Theme->>Cache: setCachedTenantThemeById
  end
  Theme-->>FF: raw theme
  FF->>FF: parseFeatureFlagsFromTheme
  FF-->>TS: TenantFeatureFlags
```

## Verification

```bash
cd apps/api
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
NODE_ENV=test STORAGE_DRIVER=prisma \
  node --import tsx --test test/4-integration/tenant-registry-cache-coherence.spec.ts
pnpm run guard:tenant-registry-cache-coherence
```

| Assertion                                                                            | Proves                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Second `resolveTenantFeatureFlags` call → `getAdminThemeLookupCountForTests() === 1` | Cache reuse, no duplicate admin query              |
| After `updateTenantRegistryRow` + invalidation, flags reflect new `featureFlags`     | Coherent with tenant-config / rate-limit paths     |
| Concurrent POST burst after flag flip                                                | No 503; variant matches DB (extends DEC-014 proof) |

## Phase boundaries

| Capability                                             | Phase            |
| ------------------------------------------------------ | ---------------- |
| Unified theme cache for flags + rate limit + registry  | **5** (this doc) |
| Distributed cache (Redis) for multi-instance coherence | **6+**           |
