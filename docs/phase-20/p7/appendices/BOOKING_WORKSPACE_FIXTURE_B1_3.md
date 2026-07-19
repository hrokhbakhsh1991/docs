# Booking Workspace Fixture Proof (Phase B1.3)

```yaml
doc_id: BOOKING_WORKSPACE_FIXTURE_B1_3
phase: B1.3
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.3 finance-ws2 (registryOnly fixture)
  - BOOKING_CAPABILITY_GATE_B1_0 / BOOKING_DEPENDENCY_REGISTRY_B1_1
constraints:
  - architecture fixture only
  - NO BookingsService / repository / routes / Prisma / Denali changes
  - NO real capacity / validation / HTTP / persistence / lifecycle
  - package + manifest + codegen must be sufficient for registration
```

## Goal

Prove a second workspace can register Booking capability deps via **manifest → codegen**
without copying `BookingsService` or shipping product HTTP/nav.

## Package

`packages/workspaces/booking-ws2` → `@app-tour/workspace-booking-ws2`

| Piece | Role |
| ----- | ---- |
| `workspace.manifest.json` | `workspaceBooking.supported: true`, `registryOnly: true`, four dependency module exports |
| `BOOKING_WS2_WORKSPACE_TYPE` | `"booking-ws2"` |
| `src/booking/*` | No-op registration adapters (distinct `kind` from Denali) |
| Minimal plugin stub | Required by manifest `plugin`; excluded from product registries |

## Manifest rules (B1.3)

```yaml
workspaceBooking:
  supported: true
  registryOnly: true          # exclude from API/web product plugin loaders
  workspaceTypeExport: BOOKING_WS2_WORKSPACE_TYPE  # no tourWrite required
  publicBooking / capacityPolicy / validationPolicy / opsCapability: module+export
```

Codegen updates:

- Enablement allows `supported + registryOnly` (fixture gate registration ≠ product enablement).
- `productWorkspaceManifests` excludes `workspaceBooking.registryOnly` (and finance fixtures).

## Proof

`apps/api/src/bookings/booking-ws2-fixture.spec.ts`

1. `isBookingSupportedWorkspace("booking-ws2") === true`
2. `resolveBookingWorkspaceDependencies("booking-ws2")` returns WS2 adapters
3. Service / repos / routes / composition sources unchanged (no ws2 imports)

## Explicitly NOT implemented

Real capacity/validation, new HTTP, new persistence, lifecycle changes, Denali edits.

## Architecture report (B1.3)

### Files changed

| Area | Files |
| ---- | ----- |
| Doc | `BOOKING_WORKSPACE_FIXTURE_B1_3.md` |
| Fixture | `packages/workspaces/booking-ws2/**` |
| Codegen | `domains/booking.mjs` (supported+registryOnly + workspaceTypeExport), `core-registry.mjs` (product filter) |
| Generated | `workspace-booking-bindings.generated.ts`, `workspace-booking-dependency-bindings.generated.ts` (+ sibling registry stubs) |
| Tests | `booking-ws2-fixture.spec.ts`; B1.0/B1.1 expectations updated |
| Host dep | `apps/api/package.json`, `dependency-cruiser.config.js` |

### Forbidden / untouched

`bookings.service.ts`, repositories, `bookings.routes.ts`, `create-bookings-service.ts`, Denali package, Prisma.

### Runtime impact

**NONE** for production Booking paths. Fixture is `registryOnly` (not in API/web plugin loaders). Gate/deps remain unwired.

### Gap to B1.4

B1.4 = public registration host neutrality (`BookingPublicPort` / host inject) — not ws2 product enablement.
