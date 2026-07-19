# Booking Tenant Workspace Resolution (Phase B1.5)

```yaml
doc_id: BOOKING_TENANT_RESOLUTION_B1_5
phase: B1.5
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.5 — resolveFinanceServiceForTenant / Map<workspaceType, FinanceService>
  - BOOKING_DEPENDENCY_REGISTRY_B1_1 / BOOKING_CAPABILITY_GATE_B2_1
constraints:
  - capability registry is live (injected into BookingsService)
  - unsupported / unknown workspaceType FAILS CLOSED (no Denali silent fallback)
  - cache keyed by workspaceType only (never tenantId)
  - single shared BookingRepositoryPort + host authz/clock across runtimes
  - do not split repository / do not create booking-core
```

## Composition chain

```text
tenantId
  → resolveBookingWorkspaceTypeForTenant   # fail-closed if not booking-supported
  → resolveBookingWorkspaceDependencies(workspaceType)   # generated SoT
  → inject validationPolicy + capacityPolicy (+ eventReaction)
  → BookingRuntime { service, dependencies }
  → Map<workspaceType, BookingRuntime> cache
```

## APIs

| API | Role |
| --- | ---- |
| `resolveBookingWorkspaceTypeForTenant(tenantId)` | Tenant → type; **unsupported → `BookingWorkspaceUnsupportedError`** |
| `resolveBookingDependenciesForTenant(tenantId)` | Tenant → workspace dependency bag (cached via runtime) |
| `resolveBookingsServiceForTenant(tenantId)` | **Only** public service entry — tenant → cached `BookingsService` |
| `getOrCreateBookingRuntimeForWorkspaceType(type)` | Internal/cache helper for A/B proofs (not a tenant entry) |

`resolveBookingsService()` (tenant-less Denali boot) was **removed**. HTTP façades
(`createBooking`, `createPublicGuestBooking`, …) all resolve via
`resolveBookingsServiceForTenant`.

## Cache policy

- Key: `workspaceType` (normalized lower-case)
- Value: `BookingRuntime` = `{ workspaceType, service, dependencies }`
- Shared across types: `getBookingsRepository()`, host authorization, host clock
- **Not** keyed by `tenantId`; policies are distinct adapter instances per workspaceType

## Fail-closed

| Input | Result |
| ----- | ------ |
| empty `tenantId` | `BOOKING_WORKSPACE_UNSUPPORTED` |
| `urban` / `starter` / unknown | `BOOKING_WORKSPACE_UNSUPPORTED` (never silent Denali) |
| `denali` / `booking-ws2` | supported runtime |

## DEV tenants (static registry)

| Tenant | workspaceType |
| ------ | ------------- |
| `…000014` (operator) | denali |
| `…000015` (booking-ws2) | booking-ws2 |

## Proof

`booking-tenant-resolution.spec.ts`

- Tenant A Denali policy / Tenant B ws2 policy (same process)
- CASE_A accept vs reject via tenant-resolved public create
- No shared mutable policy state
- Unsupported fail-closed

## Architecture report (B1.5)

### Files

| Area | Files |
| ---- | ----- |
| Resolve | `resolve-booking-workspace-type-for-tenant.ts` |
| Composition | `create-bookings-service.ts` |
| Tenants | `tenant-registry.ts` (`…000015` booking-ws2) |
| Tests | `booking-tenant-resolution.spec.ts` |
| Doc | this file |

### Remaining gaps

- Shared repository across workspace types (intentional; tenant isolation via tenantId)
- Ops create may still under-use policies relative to public create (separate follow-up)
