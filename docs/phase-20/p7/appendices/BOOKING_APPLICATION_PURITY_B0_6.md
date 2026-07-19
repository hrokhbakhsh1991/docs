# BookingsService Application Purity (Phase B0.6)

```yaml
doc_id: BOOKING_APPLICATION_PURITY_B0_6
phase: B0.6
status: LANDED
date: "2026-07-19"
authority:
  - docs/phase-20/p7/appendices/BOOKING_SERVICE_DI_B0_5.md
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md
constraints:
  - BookingsService depends only on BookingRepositoryPort, BookingAuthorizationPort, BookingClockPort (+ domain DTOs)
  - no new ports
  - domain errors leave adapter files
  - no behavior change
```

## Changes

| Item | Action |
| ---- | ------ |
| Domain errors | SoT → `bookings.errors.ts` (application) |
| Adapter error defs | Removed from `in-memory-bookings.repository.ts` |
| `BookingsService` | Imports only ports + `bookings.types` + actor context type; no adapter imports; no error re-exports |

## BookingsService allowed imports

- `./ports/booking-repository.port`
- `./ports/booking-authorization.port`
- `./ports/booking-clock.port`
- `./ports/booking-actor-context` (DTO for method signatures)
- `./bookings.types` (domain DTOs)

## Explicitly not in BookingsService

- `in-memory-bookings.repository` / `prisma-bookings.repository`
- Host adapters
- `create-bookings-repository` / composition
- workspace-sdk
