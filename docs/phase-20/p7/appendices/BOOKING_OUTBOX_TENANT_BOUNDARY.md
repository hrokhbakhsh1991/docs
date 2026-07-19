# Booking Outbox Tenant Boundaries

```yaml
doc_id: BOOKING_OUTBOX_TENANT_BOUNDARY
status: LANDED
date: "2026-07-20"
constraint: Remove caller-discipline tenant assumptions on Booking outbox lookups.
```

## Audit

| Path | Pre | Post |
| ---- | --- | ---- |
| `listOutboxByAggregate` (port) | Admin `findUnique` by aggregate id → derived tenant; later `{ tenantId, aggregateId }` under `withTenantRls` | **Removed** — no production callers (service never read outbox via Booking port). Mutate paths still enqueue under tenant TX. |
| Approve / waitlist / cancel emission | Already `tenantId` on enqueue | Unchanged |
| `reactAfterApprove` | Already receives `tenantId` | Unchanged |
| Platform outbox replay | `replayFailedOutboxEvent` requires tenant match | Unchanged (not Booking-repo) |

## Rule

Booking **writes** still stamp `tenantId` on every outbox row inside the mutate TX.

There is **no** Booking-repository read API for outbox rows. External verification in memory tests uses `peekOutboxByAggregateForTests` (test-only helper on the in-memory adapter store — not part of `BookingRepositoryPort`). Prisma / production outbox inspection stays on the platform outbox module (`outbox-relay` / admin tools), which already requires tenant scope.

Admin lookup-by-aggregate-id alone remains **forbidden**.

## Dead-port cleanup (2026-07-20)

Removed from `BookingRepositoryPort` + Prisma + in-memory adapters (zero production callers; service inlines list/summary/duplicate via `listByTenant` / counts / recent):

- `listBySubmittedUser`
- `findActiveDuplicateBy*`
- `countByListFilters`
- `getBookingsSummaryCounts`
- `listTourChipsByTenant`
- `listOutboxByAggregate`

## Proof

`booking-outbox-tenant-boundary.spec.ts` asserts the port no longer exposes `listOutboxByAggregate`, and memory tests verify tenant-filtered peek helper behavior.
