# Booking Event Ownership (Phase B1.7)

```yaml
doc_id: BOOKING_EVENT_OWNERSHIP_B1_7
phase: B1.7
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.8 / 1.9 / 1.13 — workspaceFinance.eventReaction
  - ADR-004 HostIo for finance event reactions
  - Booking Evolution Plan B1.7
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md §7
constraints:
  - outbox persistence stays host (enqueueOutboxEvent / Prisma OutboxEvent)
  - approve/bulkApprove transaction ownership stays in BookingRepositoryPort
  - NO Prisma / relay / outbox infrastructure moves into workspace packages
  - domainEventId formula registration.approved:{id}:{ts} frozen (no product YES)
  - generic event runtime must not hard-import workspace packages
```

## Audit (pre-B1.7)

| Concern | Finding | Owner (correct) |
| ------- | ------- | --------------- |
| Outbox persistence | `enqueueOutboxEvent(tx, …)` inside Prisma approve TX; memory store push in in-memory repo | **Host / Infrastructure** |
| Event name | Hardcoded `APPROVE_OUTBOX_EVENT = "registration.approved"` in `bookings.service.ts` | **Workspace capability** (via registry) |
| `domainEventId` | Hardcoded `registration.approved:{id}:{iso}` in repositories | **Host** (frozen formula) |
| Consumers | Integrations / relay dispatch published rows; Finance Option C payment sync is separate | **Host** |
| Workspace reactions | None declared for Booking — Finance owns TourCreated → ledger via `workspaceFinance.eventReaction` | **Workspace** (optional Booking reaction hooks) |

## Goal

Make Booking lifecycle event **names + reaction hooks** capability-owned like Finance:

`workspaceBooking.eventReaction` → generated bindings → thin host registry →
`BookingsService` injects `WorkspaceBookingEventReactionPort` (approve outbox event type).

## Manifest

```yaml
workspaceBooking:
  eventReaction:
    module: "./booking"
    export: "DenaliBookingEventReactionAdapter" # or BookingWs2…
    requiresHostIo: false # Booking emit path needs no HostIo today
```

| Workspace | Adapter | `approveOutboxEventType` |
| --------- | ------- | ------------------------ |
| Denali | `DenaliBookingEventReactionAdapter` | `registration.approved` |
| booking-ws2 | `BookingWs2EventReactionAdapter` | `registration.approved` (behavior-stable; independent class) |

## Capability port

SoT: `@app-tour/booking-http-contracts` → `WorkspaceBookingEventReactionPort`

| Member | Role |
| ------ | ---- |
| `approveOutboxEventType` | Outbox `eventType` for approve / bulkApprove |
| `reactAfterApprove?` | Optional post-approve hook (no-op in B1.7; host may call later) |

## Generated

`apps/api/src/bookings/workspace-booking-event-reaction-bindings.generated.ts`

| Export | Role |
| ------ | ---- |
| `WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS` | workspaceType → `{ requiresHostIo, create }` |
| `isBookingEventReactionBindingRegistered` | presence |

Thin registry (hand-written, **no workspace package imports**):

`apps/api/src/bookings/booking-event-reaction-registry.ts` →
`resolveWorkspaceBookingEventReaction(workspaceType)` (fail-closed).

## Runtime wiring

`getOrCreateBookingRuntimeForWorkspaceType` resolves the reaction and passes it into
`createBookingsService({ …, eventReaction })`. Service uses
`eventReaction.approveOutboxEventType` instead of a module-level constant.

## Explicitly NOT moved

| Stay host | Notes |
| --------- | ----- |
| Prisma `OutboxEvent` / `enqueueOutboxEvent` | Persistence |
| Approve TX in repository | Atomic status + outbox |
| Outbox relay / `processOutboxRelayOnce` | Event infrastructure |
| `domainEventId` formula | Frozen until product YES |

## Proof

`apps/api/src/bookings/booking-event-ownership.spec.ts`

- Denali + booking-ws2 both registered; distinct adapter classes; same stable event type
- Hand-written event runtime (`bookings.service`, repositories, `enqueue-domain-event`, `outbox-relay`) has **zero** `@app-tour/workspace-*` imports
- Only generated bindings + workspace packages declare adapters
- Registry imports generated bindings only

## Codegen

```bash
pnpm -w run generate:workspace-registry -- --domain=booking
```

Orchestrator key: `workspaceBookingEventReactions`.
