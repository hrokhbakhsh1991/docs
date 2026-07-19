# BookingsService Dependency Injection (Phase B0.5)

```yaml
doc_id: BOOKING_SERVICE_DI_B0_5
phase: B0.5
status: LANDED
date: "2026-07-19"
authority:
  - docs/phase-20/p7/appendices/BOOKING_PORT_DISCOVERY_B0_2.md
  - Finance Phase 0 / FinanceService constructor DI
constraints:
  - inject only BookingRepositoryPort, BookingAuthorizationPort, BookingClockPort
  - no runtime / TX / outbox / Prisma / InMemory / HTTP / routes / workspace behavior change
  - no getBookingsRepository inside BookingsService application class
```

## Boundary

| Layer | Responsibility |
| ----- | -------------- |
| Application | `BookingsService` — constructor deps only; no Service Locator |
| Host composition | `resolveBookingsService()` wires repo factory + Host authz/clock adapters |
| HTTP / Denali host | Unchanged imports of façade functions (`listBookings`, …) |

## Injected ports

1. `BookingRepositoryPort`
2. `BookingAuthorizationPort` (`assertOpsAccess`)
3. `BookingClockPort` (`now()`)

## Host composition

`resolveBookingsService()` in `create-bookings-service.ts` wires `getBookingsRepository()` + `HostBookingAuthorizationAdapter` + `HostBookingClockAdapter`. HTTP façades call the composed service; the application class does not.

## Explicitly unchanged

- Approve/reject outbox inside repository TX
- Prisma / InMemory method bodies
- Route handlers and Denali public host wiring (call façades)
