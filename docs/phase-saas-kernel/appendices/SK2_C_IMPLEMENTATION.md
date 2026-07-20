# SK2.C — First notification adapter (implementation)

```yaml
doc_id: SK2_C_IMPLEMENTATION
status: LANDED
date: "2026-07-21"
unlock: |
  YES — IMPL-SK2.C
  first_event: registration.approved
  channel: in_app
  owner: Architect (chat unlock 2026-07-21 — first menu item only)
canonical_branch: booking/capacity-concurrency-cert
design: SK2_NOTIFICATION_OUTBOX.md
```

## Trigger (filled)

| Field | Value |
| ----- | ----- |
| Event | `registration.approved` (`BOOKING_APPROVE_OUTBOX_EVENT_TYPE`) |
| Channel | `in_app` |
| Owner | Architect (user unlock; Stabilization→Kernel train) |
| Why this event | Approve already has durable outbox + relay; [BOOKING_APPROVE_REACTION_DELIVERY](../../phase-20/p7/appendices/BOOKING_APPROVE_REACTION_DELIVERY.md) names host relay / notification as the durable consumer surface |

## What lands

| Piece | Path | Role |
| ----- | ---- | ---- |
| Port | `apps/api/src/notifications/notification-delivery.port.ts` | `NotificationDeliveryPort` + command types (SK2 §3) |
| Adapter | `apps/api/src/notifications/in-app-structured-notification.adapter.ts` | First **real** adapter: tenant-required, idempotent on `(tenantId, correlationId, channel)`, structured log sink |
| Dispatch | `apps/api/src/notifications/dispatch-registration-approved-notification.ts` | Maps outbox row → command; only `registration.approved` |
| Composition | `apps/api/src/notifications/create-notification-delivery.ts` | Singleton / test reset |
| Relay wire | `apps/api/src/outbox/outbox-relay.ts` `publishClaimedOutboxRow` | After domain publish + workspace side-effects; before mark-done (same pattern as integration dispatcher) |
| Specs | `notification-delivery.port.spec.ts` | Tenant required; idempotent re-deliver; unknown event no-op |

**No** `packages/notification-*` package (forbidden hollow). Host composition only until a second consumer needs extract.

## Delivery semantics

```text
approve TX → outbox row (registration.approved)
  → relay claim/publish
    → publishDomainEvent
    → workspace tour side-effects (unchanged)
    → integration dispatcher (unchanged)
    → NotificationDeliveryPort.deliver (in_app)   ← NEW
    → mark done
```

- Idempotency: adapter keys on `tenantId + correlationId(=domainEventId) + channel`. Duplicate relay publish returns `{ ok: true }` without double sink.
- Missing/blank `tenantId` → throw (fail-closed).
- Template ID opaque: `booking.registration.approved` (workspace copy stays out of kernel).
- This is **not** SMTP/SMS yet — `in_app` structured sink is the SK2.C-allowed first adapter with a real call site.

## Explicit non-goals (this PR)

- Email/SMS providers  
- Inbox UI  
- Replacing `reactAfterApprove`  
- Hollow packages  
- DEV-POINTER / stash / portal modal (not unlocked)

## Proof

`pnpm --filter @apps/api exec node --import tsx --test src/notifications/*.spec.ts`
