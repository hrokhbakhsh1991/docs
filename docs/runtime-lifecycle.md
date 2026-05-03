# Runtime Lifecycle (Current Backend Behavior)

This document describes the **actual current runtime behavior** of registration, waitlist, and payment lifecycles in the backend.
It intentionally excludes planned/future behavior.

## Registration Lifecycle (Runtime)

### States observed in runtime
- `Accepted`
- `AcceptedPaid`
- `Cancelled`
- `Rejected`
- `Refunded`
- (also present in runtime transition logic: `Pending`, `NoShow`)

### Public registration entry path
- Public registration (`POST /api/v2/tours/:tourId/register`) creates registration directly in `Accepted` when capacity is available.
- If payment is required, payment intent is created in `Pending` and registration remains `Accepted` until payment success/failure events.

### Runtime transition behavior (effective)
- `none -> Accepted` (public registration success path)
- `Accepted -> AcceptedPaid` (payment webhook status `Paid`)
- `Accepted -> Rejected` (payment webhook status `Failed`, or manual status change)
- `Accepted -> Cancelled` (manual status change)
- `AcceptedPaid -> Refunded` (refund flow)
- `AcceptedPaid -> Cancelled` (allowed in registration transition rules)
- `AcceptedPaid -> Rejected` (allowed in registration transition rules)

## Waitlist Lifecycle (Runtime)

### States
- `Waiting`
- `Converted`
- `Cancelled`

### Runtime transition behavior
- `Waiting -> Converted` (manual conversion or automatic promotion path when capacity is released)
- `Waiting -> Cancelled` (manual cancellation)
- `Converted` and `Cancelled` are terminal in operational flow.

## Payment Lifecycle (Runtime)

### States
- `Pending`
- `Paid`
- `Failed`
- `Refunded`
- `Cancelled`

### Runtime transition behavior
- `Pending -> Paid`
- `Pending -> Failed`
- `Paid -> Refunded`
- `Paid -> Cancelled`
- `Failed`, `Refunded`, and `Cancelled` are terminal in payment transition rules.

## Capacity Rule (Runtime)

- Both `Accepted` and `AcceptedPaid` consume tour capacity.
- Capacity counter (`acceptedCount`) increases when entering a capacity-consuming status.
- Capacity counter decreases when leaving a capacity-consuming status (for example: `Accepted -> Rejected`, `Accepted -> Cancelled`, `AcceptedPaid -> Refunded`).

