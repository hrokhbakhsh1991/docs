# Booking Tenant Workspace Resolution (Phase B1.5)

```yaml
doc_id: BOOKING_TENANT_RESOLUTION_B1_5
phase: B1.5
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.5 — resolveFinanceServiceForTenant / Map<workspaceType, FinanceService>
  - BOOKING_DEPENDENCY_REGISTRY_B1_1 / BOOKING_PUBLIC_PORT_B1_4
constraints:
  - preserve Denali default behavior for tenants whose workspaceType is not booking-registered
  - NO lifecycle / repository / Prisma schema changes
  - cache keyed by workspaceType only (never tenantId)
  - single shared BookingRepositoryPort + host authz/clock across runtimes
```

## Composition chain

```text
tenantId
  → resolveBookingWorkspaceTypeForTenant
  → resolveBookingWorkspaceDependencies(workspaceType)   # generated SoT
  → BookingRuntime { service, dependencies }
  → Map<workspaceType, BookingRuntime> cache
```

## APIs

| API | Role |
| --- | ---- |
| `resolveBookingWorkspaceTypeForTenant(tenantId)` | Tenant → type; **unregistered types fall back to `denali`** |
| `resolveBookingDependenciesForTenant(tenantId)` | Tenant → workspace dependency bag (cached via runtime) |
| `resolveBookingsServiceForTenant(tenantId)` | Tenant → cached `BookingsService` |
| `resolveBookingsService()` | Boot path → denali runtime (legacy façades / tests) |
| `getOrCreateBookingRuntimeForWorkspaceType(type)` | Direct A/B / registry proof |

## Cache policy

- Key: `workspaceType` (normalized lower-case)
- Value: `BookingRuntime` = `{ workspaceType, service, dependencies }`
- Shared across types: `getBookingsRepository()`, host authorization, host clock
- **Not** keyed by `tenantId`; **no** per-tenant repo or DB pool

## Denali default

When `resolveWorkspaceTypeForTenant` yields a type absent from booking dependency
bindings (e.g. `starter`, `urban`), composition uses **`denali`**. Existing call sites
that never checked workspace type keep working.

Empty `tenantId` → `BOOKING_WORKSPACE_UNSUPPORTED`.

## HTTP façades

Operator / public façades in `create-bookings-service.ts` resolve via
`resolveBookingsServiceForTenant(auth.tenantId)` (or explicit `tenantId` for guest helpers).

## Proof

`booking-tenant-resolution.spec.ts` — A/B denali vs booking-ws2 cache reuse + policy isolation + shared repo.

## Architecture report (B1.5)

### Files changed

| Area | Files |
| ---- | ----- |
| Doc | `BOOKING_TENANT_RESOLUTION_B1_5.md` |
| Resolve | `resolve-booking-workspace-type-for-tenant.ts` |
| Composition | `create-bookings-service.ts` (`BookingRuntime` cache, tenant façades) |
| Tests | `booking-tenant-resolution.spec.ts` |

### Runtime impact

- Denali tenants: same cached service as boot (behavior preserved)
- Unregistered workspace types: fall back to denali deps/service
- booking-ws2: available when workspaceType resolves to `booking-ws2` (no product tenant yet)
- Repository / DB connections: still one singleton

### Gap to B1.6

Ops UI capability bindings (`opsManifest` / hub) — not tenant service cache.
