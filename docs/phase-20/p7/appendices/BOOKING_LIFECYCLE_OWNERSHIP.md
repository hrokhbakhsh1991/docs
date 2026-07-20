# Booking Lifecycle Ownership

```yaml
doc_id: BOOKING_LIFECYCLE_OWNERSHIP
status: LANDED
date: "2026-07-19"
scope: cancel + waitlist + terminal consistency
```

## States

`pending` | `waitlisted` | `approved` | `rejected` | `cancelled`

## Transition ownership (runtime)

| Transition | Trigger | Auth | Validation | Side effects | Event | Tenant/ws |
| ---------- | ------- | ---- | ---------- | ------------ | ----- | --------- |
| → pending (create) | Booking service | ops / publicCreate | validation+capacity | persist | none | yes |
| pending → waitlisted | Booking `waitlistBooking` | ops | status=pending | persist + outbox | `registration.waitlisted` | yes |
| pending\|waitlisted → approved | Booking approve | ops | capacity in TX | outbox (`registration.approved`); in-process reaction only if capability `mode=in-process` (Option A: off) | `registration.approved` | yes |
| pending\|waitlisted → rejected | Booking reject | ops | status gate | persist only | **none** (decision B — intentionally silent; see `BOOKING_REJECT_LIFECYCLE_OWNERSHIP`) | yes |
| pending\|waitlisted\|approved → cancelled | Booking `cancelBooking` | ops | status gate | persist + outbox | `registration.cancelled` | yes |
| rejected\|cancelled → * | forbidden | — | terminal | — | — | — |

## HTTP

- `POST /bookings/:id/waitlist`
- `POST /bookings/:id/cancel`

## Intentional non-ownership

- **Finance / paymentStatus / refund:** not Booking lifecycle; Finance via payment port.
- **Notifications delivery:** host/integration consumers of outbox; Booking emits only (`BOOKING_NOTIFICATION_OWNERSHIP`). No notify implementation in Booking.
- **Reject outbox:** **intentionally silent** (decision B). Type `registration.rejected` is reserved/not emitted — never compare with observable cancel (`BOOKING_REJECT_LIFECYCLE_OWNERSHIP`).

## Terminal consistency

Approve / waitlist / reject / cancel refuse `rejected` and `cancelled` sources (`BookingStatusConflictError`).
Waitlist only from `pending`. Cancel from `pending|waitlisted|approved`.
