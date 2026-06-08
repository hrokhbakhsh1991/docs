# Phase 9.5 — Bookings ops API dispatch addendum

```yaml
addendum_id: DISPATCH-P9-BOOKINGS
version: "2026-06-08-v2"
authority: subphases/9.5-bookings-ops.md · BOOKINGS-OPS-UX.md · TQ-P9-006
target: apps/api/src/openapi/dispatch-routes.ts
decisions: [DEC-P9-006, DEC-P9-011]
```

## Dispatch operations (9.5)

| operationId           | Method | Path                     | Handler                            | Transaction         |
| --------------------- | ------ | ------------------------ | ---------------------------------- | ------------------- |
| `listBookings`        | GET    | `/bookings`              | `bookings/list.handler.ts`         | read                |
| `getBookingsSummary`  | GET    | `/bookings/summary`      | `bookings/summary.handler.ts`      | read                |
| `getBooking`          | GET    | `/bookings/{id}`         | `bookings/get.handler.ts`          | read                |
| `createBooking`       | POST   | `/bookings`              | `bookings/create.handler.ts`       | write               |
| `approveBooking`      | POST   | `/bookings/{id}/approve` | `bookings/approve.handler.ts`      | **outbox + status** |
| `rejectBooking`       | POST   | `/bookings/{id}/reject`  | `bookings/reject.handler.ts`       | **outbox + status** |
| `bulkApproveBookings` | POST   | `/bookings/bulk-approve` | `bookings/bulk-approve.handler.ts` | **outbox + status** |

## Query parameters — `listBookings`

| Param              | Type            | Purpose                               |
| ------------------ | --------------- | ------------------------------------- |
| `view`             | `ops` \| `mine` | Ops queue vs member own registrations |
| `tourId`           | uuid            | Tour chip filter                      |
| `status`           | enum            | Pipeline filter                       |
| `from` / `to`      | ISO date        | Departure or submitted range          |
| `q`                | string          | Guest name / email / phone search     |
| `paymentStatus`    | enum            | Payment filter                        |
| `cursor` / `limit` | pagination      | Stable cursor pagination              |

**Fail-closed:** `view=ops` with member actor → **403** unless admin scoped by tour ACL (legacy `leader` DB rows hydrate to `admin` · DEC-P9-015).

## Request bodies

### `rejectBooking`

```json
{ "reason": "optional string — stored in audit tail" }
```

### `bulkApproveBookings`

```json
{ "ids": ["uuid", "..."], "maxBatch": 25 }
```

Batch size capped by manifest `actions.bulkApprove.maxBatch`.

## Fail-closed (P9-F-006)

`approveBooking` and `bulkApproveBookings` must persist status + outbox event(s) in **one transaction** — no approve without outbox row (TQ-P9-006).

## Literal insertion block

```typescript
export const BOOKINGS_OPERATOR_DISPATCH = [
  {
    operationId: "listBookings",
    method: "GET",
    path: "/bookings",
    handler: "bookings/list.handler",
  },
  {
    operationId: "getBookingsSummary",
    method: "GET",
    path: "/bookings/summary",
    handler: "bookings/summary.handler",
  },
  {
    operationId: "getBooking",
    method: "GET",
    path: "/bookings/{id}",
    handler: "bookings/get.handler",
  },
  {
    operationId: "createBooking",
    method: "POST",
    path: "/bookings",
    handler: "bookings/create.handler",
  },
  {
    operationId: "approveBooking",
    method: "POST",
    path: "/bookings/{id}/approve",
    handler: "bookings/approve.handler",
  },
  {
    operationId: "rejectBooking",
    method: "POST",
    path: "/bookings/{id}/reject",
    handler: "bookings/reject.handler",
  },
  {
    operationId: "bulkApproveBookings",
    method: "POST",
    path: "/bookings/bulk-approve",
    handler: "bookings/bulk-approve.handler",
  },
] as const;
```
