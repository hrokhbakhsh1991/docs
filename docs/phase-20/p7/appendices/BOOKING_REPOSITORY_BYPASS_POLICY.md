# Booking repository access outside BookingsService

```yaml
doc_id: BOOKING_REPOSITORY_BYPASS_POLICY
status: ACTIVE
date: "2026-07-20"
```

## Decision

| Caller | Access | Classification | Rule |
| ------ | ------ | -------------- | ---- |
| `BookingPaymentAdapter` | `getById`, `updatePaymentStatus` | **Read / projection write** | Allowed. Payment raise is Finance-owned; never approve/create/cancel. Tenant id required on every call; Prisma path uses `withTenantRls`. |
| `BookingPaymentAdapter.raisePaidInTx` | ambient Finance TX | **TX-local projection** | Explicit exception — same connection as ledger approve; not a second policy path. |
| `BookingRegistrationDisplayAdapter` | `getById` / `getByIds` | **Read-only projection** | Allowed. Display labels only. |
| `users.service` member booking summary | count + recent list by user | **Read-only projection** | Allowed. No lifecycle mutations. |
| Any **lifecycle** (create/approve/reject/waitlist/cancel/bulk) | — | **Forbidden** | Must go through `resolveBookingsServiceForTenant` façades. |

## Enforcement

Static: no `approveWithOutbox` / `createBooking` / `rejectBooking` / `cancelBooking` / `waitlistBooking` / `bulkApproveWithOutbox` imports outside bookings composition + tests.

Runtime: Finance/Identity paths documented above; capacity and status races remain Booking-service-owned.
