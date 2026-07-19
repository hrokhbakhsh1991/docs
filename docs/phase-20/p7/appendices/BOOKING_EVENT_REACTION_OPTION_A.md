# Booking eventReaction capability — Option A

```yaml
doc_id: BOOKING_EVENT_REACTION_OPTION_A
status: ACTIVE
date: "2026-07-20"
decision: remove hollow in-process capability claim
```

## Before

Manifest claimed `eventReaction.mode = in-process` while `reactAfterApprove()` was an empty no-op. Approve durability is **only** the host outbox (`registration.approved`).

## After (Option A)

- Graded capability: `eventReaction.enabled=false`, `mode=none` (Denali + booking-ws2).
- Durable approve channel unchanged: repository outbox write + relay.
- Adapter retained solely to supply `approveOutboxEventType` (composition binding).
- `BookingsService` does **not** invoke `reactAfterApprove` when the capability is disabled.
- Runtime assert allows `mode=none` with binding/adapter present (outbox type only).

Reintroduce `in-process` only when a workspace ships a durable or product-visible reaction with replay semantics.
