# Booking Capacity Ownership (authority unification)

```yaml
doc_id: BOOKING_CAPACITY_OWNERSHIP
status: LANDED
date: "2026-07-19"
model: booking-owned
constraints:
  - Booking owns occupancy SoT + fail-closed max + approve-in-TX enforcement
  - Workspace adapters supply product markers only (e.g. CASE_A)
  - Denali registration supplies tourCapacityMax when known; never enforces occupancy
  - no second capacity authority / no hybrid ambiguity
```

## Model: Booking-owned capacity

| Concern | Owner |
| ------- | ----- |
| Occupancy sum (approved seats) | **Booking** repository |
| Fail-closed when `tourCapacityMax` missing | **Booking** application (create + approve) |
| Product markers (CASE_A, etc.) | **Workspace** `capacityPolicy` |
| Final admit/reject on create & approve | **Booking** invokes `capacityPolicy` |
| Approve capacity vs race | **Inside** `approveWithOutbox` TX (same RLS + outbox TX) |

Capability claim: `capacity.mode = booking-owned` for denali and booking-ws2 (hybrid removed from product claims).

## Approve lifecycle

```text
approveBooking
  ├─ auth + capability levels
  ├─ repository.approveWithOutbox
  │    ├─ (TX / RLS) load booking
  │    ├─ (TX) SELECT id … WHERE tenant+tour FOR UPDATE  ← tour occupancy serialization
  │    ├─ (TX) re-read booking status under lock
  │    ├─ (TX) sum approved occupancy for tour
  │    ├─ assertCapacityInTx(...)   ← fail closed; same policy as create
  │    ├─ status → approved
  │    └─ outbox enqueue
  └─ reactAfterApprove (after commit)
```

### Prisma concurrency (production path)

Memory driver serializes approve via an in-process chain. **Prisma must not.**

Occupancy races are closed by locking **all** `operator_registrations` rows for `(tenant_id, tour_id)` with `SELECT … FOR UPDATE` inside the same `withTenantRls` transaction **before** re-reading status and summing approved party size. Two concurrent approves for the same tour block on that lock set; the loser re-reads occupancy after the winner commits.

Empty occupancy is still safe: the pending candidates themselves are included in the tour lock set.
