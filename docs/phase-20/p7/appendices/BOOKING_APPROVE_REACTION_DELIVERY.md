# Booking Approve Reaction Delivery (Honest Contract)

```yaml
doc_id: BOOKING_APPROVE_REACTION_DELIVERY
status: LANDED
date: "2026-07-20"
architecture: unchanged (WHEN Booking / WHAT workspace / outbox host)
```

## Decision

Do **not** change architecture. Make delivery guarantees **explicit** so every consumer knows what channel they are on.

Approve has **two independent channels**. They are not substitutes.

## Channel matrix

| Consumer surface | Channel | Durable? | Delivery | Exactly once? | Triggered by outbox replay? |
| ---------------- | ------- | -------- | -------- | ------------- | --------------------------- |
| Host relay / notification / external subscribers | Outbox `registration.approved` | **Yes** (same TX as status) | Write: **at-most-once insert** per `domainEventId`; relay publish: **at-least-once** | **No** (end-to-end) | **Yes** (replay re-queues row for relay only) |
| Workspace `reactAfterApprove` | In-process callback after TX commit | **No** | **Best-effort** (lost if process dies after commit or before/during callback; adapter state is process-local) | **No** | **No** |

```text
approveBooking
  ├─ repository.approveWithOutbox     → durable outbox row (host)
  └─ invokeApproveReaction            → in-process best-effort (workspace WHAT)
         ▲
         └── NOT on outbox relay / failed-replay path
```

## Semantics (frozen vocabulary)

| Term | Meaning here |
| ---- | ------------ |
| **durable outbox** | Row persisted atomically with status; survives process restart |
| **in-process callback** | `reactAfterApprove` in the approving Node process after commit |
| **best effort** | No retry, no persistence, no restart recovery for the callback |
| **at-most-once insert** | Unique `(tenant_id, domain_event_id)` prevents duplicate outbox rows for the same id formula |
| **at-least-once** | Host outbox relay may deliver the durable event more than once to downstream consumers |
| **exactly once** | **Not claimed** for either channel |

## Ownership

| Concern | Owner |
| ------- | ----- |
| WHEN reaction runs | Booking application (`invokeApproveReaction`) |
| WHAT reaction does | Workspace adapter (`reactAfterApprove`) — must be idempotent |
| Outbox persist + approve TX | Host repository |
| Outbox relay + failed replay | Host (`outbox-relay` / `outbox-replay`) — **does not** call `reactAfterApprove` |
| Adapter idempotency store | Workspace (today: process memory — not durable) |

## Crash / restart honesty

| Failure window | Outbox | `reactAfterApprove` |
| -------------- | ------ | ------------------- |
| Before TX commit | No row | Not invoked |
| After commit, before/during callback | Row present | **May be lost** |
| Process restart after successful approve | Row still present | Adapter memory **cleared** — callback **not** re-run automatically |
| Admin outbox replay (`failed` → `pending`) | Row re-queued for relay | **Not** re-invoked |

## Forbidden dishonest claims

- Calling `reactAfterApprove` “durable” or “exactly once”
- Saying outbox replay “re-runs approve reactions”
- Equating in-process ack tokens with host notification delivery

## Runtime contract constants

`@app-cloud/booking-http-contracts`:

- `BOOKING_APPROVE_OUTBOX_DELIVERY`
- `BOOKING_APPROVE_REACTION_DELIVERY`

## Proof

`apps/api/src/bookings/booking-approve-reaction-delivery.spec.ts`

- repeat approve → conflict; single outbox; single reaction observation
- duplicate `reactAfterApprove` → idempotent; no second outbox
- outbox “replay” path does not invoke reaction
- process restart simulation → outbox survives; in-process reaction log does not
