# Booking Public Port Neutrality (Phase B1.4)

```yaml
doc_id: BOOKING_PUBLIC_PORT_B1_4
phase: B1.4
status: LANDED
date: "2026-07-19"
authority:
  - docs/phase-20/p7/appendices/BOOKING_PORT_DISCOVERY_B0_2.md §2.4
  - Booking Evolution Plan B1.4
constraints:
  - preserve Denali registration / catalog behavior
  - NO API / DB / registration lifecycle changes
  - remove Denali naming from Booking-facing public port
```

## Ownership

| Owner | Responsibility |
| ----- | -------------- |
| **Workspace (Denali)** | Registration orchestration, payload validation, capacity decision |
| **Booking host** | Duplicate checks, create pending booking, approved occupancy query |

## Contract SoT

`@app-tour/booking-http-contracts`

- `BookingPublicPort`
- `BookingPublicCreateInput`
- `BookingPublicCreateResult`

Former names `DenaliPublicBookingPort` / `DenaliPublicBookingCreate*` are **removed** from the port file.
Denali HTTP modules import the neutral types from contracts.

## Host adapter

`apps/api/src/bookings/infrastructure/host-booking-public.adapter.ts`

Implements `BookingPublicPort` via existing composition façades
(`createPublicGuestBooking`, `findGuestBookingDuplicate*`, `sumApprovedPartySizeByTourIds`).

`configure-workspace-denali-product-http-host.ts` resolves the port through this adapter
(still Denali product HTTP host — allowed workspace coupling at composition edge).

## Application purity (Booking)

Under `apps/api/src/bookings/` (excluding `*.generated.ts`):

- no `DenaliPublicBookingPort`
- no `@app-tour/workspace-denali` imports in application/service/repo/ports/infrastructure sources

Generated capability/dependency bindings may still import workspace packages (B1.0/B1.1 SoT).

## Behavior

Method set and semantics unchanged from prior `DenaliPublicBookingPort` (pending create, duplicate lookups, approved party-size sum).

## Architecture report (B1.4)

### Changed files

| Area | Files |
| ---- | ----- |
| Doc | `BOOKING_PUBLIC_PORT_B1_4.md` |
| Contracts | `packages/booking-http-contracts/src/booking-public.port.ts`, `index.ts`, README |
| Booking app | `ports/booking-public.port.ts`, `infrastructure/host-booking-public.adapter.ts` |
| Host | `configure-workspace-denali-product-http-host.ts` |
| Denali | `http/ports/public-booking.port.ts`, product-host-ports, routes, registration/catalog, filter, test, `package.json` |
| Proof | `booking-public-port-neutrality.spec.ts` |

### Remaining Denali coupling (allowed)

- Product HTTP host composition still Denali-named (`configureDenaliProductHttpHost`)
- Registration orchestration / validation / capacity remain in Denali services
- Generated capability bindings may import `@app-tour/workspace-denali` (B1.0/B1.1)

### Gap to B1.5

Tenant-aware `resolveBookingsServiceForTenant` — not part of this rename.
