# BookingRepositoryPort (Phase B0.4)

```yaml
doc_id: BOOKING_REPOSITORY_PORT_B0_4
phase: B0.4
status: LANDED
date: "2026-07-19"
authority:
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md
  - docs/phase-20/p7/appendices/BOOKING_PORT_DISCOVERY_B0_2.md
  - Finance FinanceRepositoryPort pattern (interface SoT; adapters implement)
constraints:
  - no runtime behavior change
  - Prisma + InMemory implement BookingRepositoryPort
  - existing BookingsRepository type remains a compatibility alias
```

## Boundary introduced

| Item | Location |
| ---- | -------- |
| Port SoT | `apps/api/src/bookings/ports/booking-repository.port.ts` → `BookingRepositoryPort` |
| Compatibility alias | `BookingsRepository` = `BookingRepositoryPort` (same file + re-export from memory module) |
| Prisma adapter | `PrismaBookingsRepository implements BookingRepositoryPort` |
| Memory adapter | `InMemoryBookingsRepository implements BookingRepositoryPort` |
| Factory return | `getBookingsRepository(): BookingRepositoryPort` |

## Explicitly unchanged

- Method bodies (create/approve/reject/list/paymentStatus/outbox)
- Service Locator still used by `bookings.service` (DI is a later B0 slice)
- Domain errors still live in `in-memory-bookings.repository.ts` (extract later)
- No folder move to `infrastructure/` yet

## Acceptance

- Repository boundary established (interface SoT outside adapter file)
- Existing tests unchanged in intent; still green
- Behavior changes: **NONE**
