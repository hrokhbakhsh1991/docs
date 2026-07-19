# Booking Reject Lifecycle Ownership

```yaml
doc_id: BOOKING_REJECT_LIFECYCLE_OWNERSHIP
status: LANDED
date: "2026-07-20"
decision: B — reject is intentionally silent (no outbox)
```

## Decision (outbox)

**B.** Reject is **intentionally silent**.

- Persist `status=rejected` (+ optional `rejectReason`).
- Do **not** emit `registration.rejected`.
- The string `registration.rejected` remains a **reserved contract token** so hosts do not invent a parallel type — it is **not** an emitted event.

**Never** treat silent reject as equivalent to observable cancel. Cancel emits `registration.cancelled`; reject does not emit.

## Why not A (emit)

Making reject observable would imply host notification / reaction parity with approve and cancel. Product has not required that. Shipping a hollow outbox row would be dishonest ownership.

## Reject reason ownership

| Concern | Owner | Mechanism |
| ------- | ----- | --------- |
| Request wire field | HTTP contracts | `RejectBookingRequest.reason?` (optional; omit = reject without reason) |
| Persistence column | Booking repository | `operator_registrations.reject_reason` → domain `rejectReason` |
| List / detail projection | Booking service | Optional `rejectReason` on `BookingListItem` when present |
| Reject HTTP response | Booking service | Optional `rejectReason` on `RejectBookingResponse` |
| Reject history view | Host UI via list | `GET /bookings?view=ops&status=rejected` (no separate history table) |
| Detail (no GET-by-id route) | Repository | `getById` returns `rejectReason` when set |
| Outbox on reject | **None** (intentional) | No row; `reservedNotEmitted` |

### Backward compatibility

- `reason` remains optional on reject body.
- `rejectReason` is **additive optional** on list/detail/reject responses — absent when never set (pre-migration rows and reason-less rejects).
- Clients that ignore unknown JSON fields continue to work.

### Forbidden for reason

- Dropping `reason` into `registrationIntake` JSON (intake is product create payload, not lifecycle audit).
- Emitting reason via outbox while decision B holds.

## Ownership (lifecycle)

| Concern | Owner | Mechanism |
| ------- | ----- | --------- |
| Status transition pending\|waitlisted → rejected | Booking repository | `rejectBooking` — persist status + reason; no outbox |
| Ops gate on reject HTTP/service | Host authz | `assertOpsAccess` |
| Outbox on approve | Booking | `registration.approved` in TX |
| Outbox on cancel | Booking | `registration.cancelled` in TX |
| Notification delivery | Host | Consumes emitted types only (not reserved) |

## Runtime contract

```text
BOOKING_REJECT_OUTBOX_EVENT_TYPE = "registration.rejected"  // reserved, never emitted
BOOKING_NOTIFICATION_OWNERSHIP.reservedNotEmitted = [registration.rejected]
BOOKING_NOTIFICATION_OUTBOX_EVENT_TYPES excludes registration.rejected

Persist: status=rejected, rejectReason = trim(reason) | unset
API: RejectBookingRequest.reason? → RejectBookingResponse.rejectReason?
List/detail: BookingListItem.rejectReason?
```

## Outbox comparison (behavioral)

| Transition | Outbox rows for that booking | Event type |
| ---------- | ---------------------------- | ---------- |
| approve | ≥1 | `registration.approved` |
| reject | **0** | — (silent) |
| cancel | ≥1 | `registration.cancelled` |

Proof: `apps/api/src/bookings/booking-reject-lifecycle.spec.ts`.

## Forbidden

- Emitting `registration.rejected` without flipping this decision to **A** and updating this doc + notification ownership contract
- Documenting reject as “bug / missing outbox”
- Equating reject silence with cancel observability in tests or product copy
- Discarding a provided non-empty reject reason
