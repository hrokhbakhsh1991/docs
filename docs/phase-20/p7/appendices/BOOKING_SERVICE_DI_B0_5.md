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
| Host composition | `resolveBookingsServiceForTenant(tenantId)` wires repo + Host adapters + workspace policies |
| HTTP / Denali host | Unchanged imports of façade functions (`listBookings`, …) |

## Injected ports

1. `BookingRepositoryPort`
2. `BookingAuthorizationPort` (`assertOpsAccess`)
3. `BookingClockPort` (`now()`)
4. Workspace capability / policy ports + `BookingRuntimeCapabilities` (later B1/B2)
5. **`productionGradeIntegrity: boolean`** — host composition sets this from
   `requiresProductionGradeIntegrity()`; `BookingsService` must **not** import
   `../server/runtime-profile` (BK-DI-04). When tour SoT lacks `capacityMax`,
   production-grade hosts fail closed; test/dev may use intake last-resort.

## Host composition

`create-bookings-service.ts` resolves `tenantId → workspaceType → BookingRuntime` via
`resolveBookingsServiceForTenant`. There is **no** tenant-less `resolveBookingsService()` boot path.
HTTP façades call the composed service; the application class does not.

## Explicitly unchanged

- Approve/reject outbox inside repository TX
- Prisma / InMemory method bodies
- Route handlers and Denali public host wiring (call façades)
