# Booking Capacity Ownership (authority unification)

```yaml
doc_id: BOOKING_CAPACITY_OWNERSHIP
status: LANDED
date: "2026-07-19"
model: booking-owned
constraints:
  - Booking owns occupancy SoT + fail-closed max + approve-in-TX enforcement
  - Workspace adapters supply product markers only (e.g. CASE_A)
  - Denali registration supplies tourCapacityMax from tour SoT when known; never enforces occupancy
  - Client registrationIntake.tourCapacityMax must not raise ceiling above tour SoT
  - prodlike/production: missing tour SoT capacityMax fail-closes (no client ceiling)
  - test/dev: intake last-resort only for fixtures / workspaces without the field
  - no second capacity authority / no hybrid ambiguity
```

## Model: Booking-owned capacity

| Concern | Owner |
| ------- | ----- |
| Occupancy sum (approved seats) | **Booking** repository |
| Fail-closed when `tourCapacityMax` missing | **Booking** application (create + approve) |
| **Ceiling authority** | **Tour canonical `data.capacityMax`** via `BookingTourCapacityPort` when present |
| Client `registrationIntake.tourCapacityMax` | **Never raises** ceiling above tour SoT; **ignored as authority** when tour SoT present; **rejected as sole ceiling** under `requiresProductionGradeIntegrity()` |
| Product markers (CASE_A, etc.) | **Workspace** `capacityPolicy` |
| Final admit/reject on create & approve | **Booking** invokes `capacityPolicy` |
| Approve capacity vs race | **Inside** `approveWithOutbox` TX (same RLS + outbox TX); ceiling re-resolved from tour SoT when available |

### Resolution order (`resolveEffectiveTourCapacityMax`)

```text
1. BookingTourCapacityPort.resolveTourCapacityMax(tenant, tour)
2. if number → that is the ceiling (client intake cannot inflate)
3. if null and requiresProductionGradeIntegrity() → throw BOOKING_CAPACITY_MAX_REQUIRED
4. if null and test/dev → requireTourCapacityMax(intake)  // fixture compat only
```

Proof: `booking-tour-capacity-authority.spec.ts` (SoT wins; prodlike rejects null SoT; test façade still accepts intake).

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
