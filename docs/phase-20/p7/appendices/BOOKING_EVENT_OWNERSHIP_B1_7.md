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
  - Hostile finding — eventReaction injected but reactAfterApprove never executed
constraints:
  - outbox persistence stays host (enqueueOutboxEvent / Prisma OutboxEvent)
  - approve/bulkApprove transaction ownership stays in BookingRepositoryPort
  - NO Prisma / relay / outbox infrastructure moves into workspace packages
  - domainEventId formula registration.approved:{id}:{ts} frozen (no product YES)
  - generic event runtime must not hard-import workspace packages
  - reactAfterApprove must be idempotent; must not enqueue a second outbox row
```

## Delivery guarantees (honest)

See [`BOOKING_APPROVE_REACTION_DELIVERY`](BOOKING_APPROVE_REACTION_DELIVERY.md).

| Channel | Durable | Delivery | Exactly once |
| ------- | ------- | -------- | ------------ |
| Outbox `registration.approved` | yes (same TX) | insert at-most-once / relay at-least-once | **no** |
| `reactAfterApprove` | **no** (in-process) | **best-effort** after commit | **no**; not on outbox replay |

## Ownership split (closed)

| Concern | Owner |
| ------- | ----- |
| **WHEN** approve reaction runs | **Booking application** (`BookingsService.invokeApproveReaction`) — after `approveWithOutbox` / `bulkApproveWithOutbox` commits |
| **WHAT** the reaction does | **Workspace adapter** (`reactAfterApprove`) |
| Outbox persistence + approve TX | **Host / repository** (unchanged) |
| Outbox relay / brokers | **Host** (unchanged — no message broker added) |

```text
approveBooking / bulkApproveBookings
  ├─ assertOpsAccess
  ├─ repository.approve*WithOutbox  ← TX: status + outbox (host)
  └─ eventReaction.reactAfterApprove ← AFTER commit (workspace WHAT)
```

## Capability port

SoT: `@app-tour/booking-http-contracts` → `WorkspaceBookingEventReactionPort`

| Member | Role |
| ------ | ---- |
| `kind` | Adapter discriminator |
| `approveOutboxEventType` | Outbox `eventType` for approve / bulkApprove |
| `reactAfterApprove` | **Required** post-approve hook (idempotent per `bookingId`) |

Dead optional `reactAfterApprove?` binding removed — service always invokes.

## Workspace WHAT (in-process acknowledgements)

| Workspace | Adapter | `reactionToken` |
| --------- | ------- | --------------- |
| Denali | `DenaliBookingEventReactionAdapter` | `denali-approve-ack` |
| booking-ws2 | `BookingWs2EventReactionAdapter` | `booking-ws2-approve-ack` |

Both share `approveOutboxEventType = registration.approved`. Adapters record reacted booking IDs in-process and no-op on repeat — they do **not** write outbox.

## Explicitly NOT moved

| Stay host | Notes |
| --------- | ----- |
| Prisma `OutboxEvent` / `enqueueOutboxEvent` | Persistence |
| Approve TX in repository | Atomic status + outbox |
| Outbox relay | Event infrastructure |
| `domainEventId` formula | Frozen until product YES |

## Proof

`apps/api/src/bookings/booking-event-ownership.spec.ts`

- Registry + generated bindings (Denali / ws2; urban fail-closed)
- Hand-written event runtime has **zero** `@app-tour/workspace-*` imports
- Denali approve → Denali reaction + single outbox row
- ws2 approve → ws2 reaction (distinct token)
- Repeated `reactAfterApprove` does not duplicate effect / outbox
- Unsupported workspace cannot approve

## Codegen

```bash
pnpm -w run generate:workspace-registry -- --domain=booking
```

Orchestrator key: `workspaceBookingEventReactions`.
