# Booking workspace: transition alignment report

**Scope:** Participant `/bookings` surfaces, leader registration editors (`RegistrationsTable`, review queue), and alignment with backend registration/payment lifecycles.  
**Policy:** [`apps/web/lib/booking-transition-policy.ts`](../../../apps/web/lib/booking-transition-policy.ts) (single aggregate transition matrix).  
**Related:** [`domain_model_alignment.md`](./domain_model_alignment.md) (bookings ↔ registrations mapping), [`workspace-transition-alignment-report.md`](./workspace-transition-alignment-report.md) (tour workspace + waitlist FIFO).

---

## Backend truth

- **Registration status:** `RegistrationStatus` — `apps/api/src/modules/registrations/registration.entity.ts`, transitions in `RegistrationsService.validateStatusTransition`.
- **Aggregate payment status:** `RegistrationPaymentStatus` on the same entity (includes `Failed`, `Refunded` on persisted rows); public PATCH payment DTO remains `NotPaid` | `Partial` | `Paid`.
- **REST:** `GET` / `POST /api/v2/bookings` are aliases on the registrations controller; payloads are `RegistrationResponseDto`.

---

## Frontend surfaces

| Surface | Behavior |
|---------|----------|
| `/bookings` list | `GET /api/v2/bookings`, `BookingDto` rows |
| `/bookings/[id]` | `GET /api/v2/registrations/:id`, payment intent mutation |
| Tour workspace / leader queue | Status & payment `<select>` built from `booking-transition-policy.ts`; terminal rows readonly; per-row mutation pending via `variables?.id`; row-level errors |

---

## UX rules (summary)

1. Do not offer illegal registration or aggregate-payment transitions; intersect payment targets with public PATCH subset where applicable.
2. Terminal registration or aggregate-payment rows: hide Apply / Save payment; disable controls.
3. `Cancelled` / `Rejected` registrations: no aggregate payment updates (mirrors backend gate).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-04 | Initial stub linking policy + domain mapping doc. |
