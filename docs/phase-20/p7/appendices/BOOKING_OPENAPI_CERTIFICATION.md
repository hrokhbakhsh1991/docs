# Booking OpenAPI Certification

```yaml
doc_id: BOOKING_OPENAPI_CERTIFICATION
status: LANDED
date: "2026-07-20"
updated: "2026-07-20"
related: DEC-099 openapi-dispatch-contract
```

## Problem

Booking HTTP routes were wired in `apps/api/src/app.ts` but absent from `DISPATCH_ROUTES` / `openapi.json`, then present as **path-only** stubs (no request/response schemas).

## Decision

1. Inventory every public Booking route in `dispatch-routes.ts`.
2. Production-grade schemas in `src/openapi/booking-openapi.ts` — **named** `#/components/schemas/*` only (no anonymous inline objects on Booking ops).
3. Generator merges `BOOKING_OPENAPI_SCHEMAS` + `BOOKING_OPENAPI_OVERRIDES` into `openapi/openapi.json`.
4. Completeness audit: `booking-openapi-certification.spec.ts` requires 100% Booking op coverage.

**Runtime handlers unchanged** for this pack (no new HTTP surfaces).  
There is **no** `GET /bookings/{bookingId}` today — **detail** wire shape is `BookingListItem` (list projection). **Payment status** is the list query `paymentStatus` + `BookingListItem.paymentStatus` (+ receipt status on GET receipts).

## Registered endpoints

| Registered (`app.ts`) | OpenAPI path | operationId |
| --------------------- | ------------ | ----------- |
| `GET /bookings` | `/bookings` | `listBookings` |
| `POST /bookings` | `/bookings` | `createBooking` |
| `GET /bookings/summary` | `/bookings/summary` | `getBookingsSummary` |
| `POST /bookings/bulk-approve` | `/bookings/bulk-approve` | `bulkApproveBookings` |
| `POST /bookings/:id/approve` | `/bookings/{bookingId}/approve` | `approveBooking` |
| `POST /bookings/:id/reject` | `/bookings/{bookingId}/reject` | `rejectBooking` |
| `POST /bookings/:id/waitlist` | `/bookings/{bookingId}/waitlist` | `waitlistBooking` |
| `POST /bookings/:id/cancel` | `/bookings/{bookingId}/cancel` | `cancelBooking` |
| `POST /bookings/:id/receipts` | `/bookings/{bookingId}/receipts` | `postBookingReceipt` |
| `GET /bookings/:id/receipts` | `/bookings/{bookingId}/receipts` | `getBookingReceiptStatus` |

## Schema SoT

`apps/api/src/openapi/booking-openapi.ts` mirrors `@app-cloud/booking-http-contracts` DTOs:

`BookingStatus`, `BookingPaymentStatus`, `BookingsListView`, `BookingListItem`, `BookingsListResponse`, `BookingsSummaryResponse`, `BookingTourChip`, `CreateBookingRequest`, `CreateBookingResponse`, `ApproveBookingResponse`, `RejectBookingRequest`, `RejectBookingResponse`, `WaitlistBookingResponse`, `CancelBookingResponse`, `BulkApproveBookingsRequest`, `BulkApproveBookingsResponse`, `BookingMemberReceiptJsonBody`, `BookingMemberReceiptStatusResponse`, `BookingHttpError`, `BookingIdPathParam`.

## Completeness matrix (100% of registered Booking HTTP)

| endpoint | request schema | response schema | errors | examples |
| -------- | -------------- | --------------- | ------ | -------- |
| `GET /bookings` | — (query: view/status/tourId/**paymentStatus**/q/cursor/limit) | `BookingsListResponse` | 401,403 | yes |
| `POST /bookings` | `CreateBookingRequest` | `CreateBookingResponse` | 400,401,403,404,429 | yes |
| `GET /bookings/summary` | — | `BookingsSummaryResponse` | 401,403 | yes |
| `POST /bookings/bulk-approve` | `BulkApproveBookingsRequest` | `BulkApproveBookingsResponse` | 400,401,403,429 | yes |
| `POST /bookings/{bookingId}/approve` | — (path `BookingId`) | `ApproveBookingResponse` | 401,403,404,409,429 | yes |
| `POST /bookings/{bookingId}/reject` | `RejectBookingRequest` | `RejectBookingResponse` | 401,403,404,409 | yes |
| `POST /bookings/{bookingId}/waitlist` | — (path `BookingId`) | `WaitlistBookingResponse` | 401,403,404,409 | yes |
| `POST /bookings/{bookingId}/cancel` | — (path `BookingId`) | `CancelBookingResponse` | 401,403,404,409 | yes |
| `POST /bookings/{bookingId}/receipts` | `BookingMemberReceiptJsonBody` (+ binary) | `BookingReceiptCreatedResponse` | 400,401,403,503 | yes |
| `GET /bookings/{bookingId}/receipts` | — (path `BookingId`) | `BookingMemberReceiptStatusResponse` | 401,403 | yes |

**Detail:** no `GET /bookings/{bookingId}` registered — detail wire DTO is `BookingListItem` (list projection).  
**Payment status:** list query `paymentStatus` + `BookingListItem.paymentStatus` + GET receipts status.

## Verification

```bash
cd apps/api
pnpm run openapi:generate
pnpm run guard:openapi-dispatch-parity
NODE_ENV=test node --import tsx --test src/bookings/booking-openapi-certification.spec.ts
```
