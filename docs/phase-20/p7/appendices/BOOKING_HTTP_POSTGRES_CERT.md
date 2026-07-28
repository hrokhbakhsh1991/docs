# Booking HTTP → PostgreSQL Certification Matrix

```yaml
doc_id: BOOKING_HTTP_POSTGRES_CERT
status: ACTIVE
date: "2026-07-20"
path: HTTP → route → facade → resolveBookingsServiceForTenant → BookingsService → PrismaBookingsRepository → PostgreSQL+RLS
forbidden: InMemoryBookingsRepository | mocked repositories | direct BookingsService calls
command: pnpm --filter @apps/api run test:booking-http-postgres
ci_job: Booking HTTP PostgreSQL
fail_closed: "MR-P0-015 — missing DATABASE_URL(+ADMIN) throws BOOKING_HTTP_POSTGRES_REQUIRES_DATABASE (no silent skip)"
```

## Path under test

```text
HTTP
→ bookings.routes (handle*)
→ create-bookings-service façades
→ resolveBookingsServiceForTenant
→ workspace runtime (Denali)
→ BookingsService
→ PrismaBookingsRepository
→ PostgreSQL + RLS (app_tour)
```

## Matrix (must be proven over HTTP + Prisma)

| ID | Method | Scenario | Expected HTTP | DB / side effects |
| -- | ------ | -------- | ------------- | ----------------- |
| C1 | `POST /bookings` | valid create | **201** `{ id, status: pending }` | row in `operator_registrations` |
| C2 | `POST /bookings` | validation failure (invalid body) | **400** `BOOKING_CREATE_INVALID` | no row |
| C3 | `POST /bookings` | capacity failure (`partySize` > `tourCapacityMax`) | **409** `BOOKING_CAPACITY_REJECTED` | no row |
| A1 | `POST /bookings/:id/approve` | success | **200** `status: approved` | status + `registration.approved` outbox |
| A2 | `POST /bookings/:id/approve` | capacity conflict (two pendings @ max=1; second approve) | **409** `BOOKING_CAPACITY_REJECTED` | pending unchanged; no outbox |
| A3 | `POST /bookings/:id/approve` | already approved | **409** `BOOKING_ALREADY_APPROVED` | single outbox row |
| R1 | `POST /bookings/:id/reject` | with reason | **200** | `status=rejected`, `reject_reason` persisted; no reject outbox |
| R2 | `POST /bookings/:id/reject` | without reason | **200** | `status=rejected`, reason null; no reject outbox |
| W1 | `POST /bookings/:id/waitlist` | pending → waitlisted | **200** | status + `registration.waitlisted` outbox |
| X1 | `POST /bookings/:id/cancel` | pending → cancelled | **200** | status + `registration.cancelled` outbox |
| B1 | `POST /bookings/bulk-approve` | two pending | **200** `{ approvedIds, skippedIds }` | both approved + outbox each |
| L1 | `GET /bookings` | ops list schema | **200** `{ items, total, nextCursor }` | items tenant-scoped |
| S1 | `GET /bookings/summary` | KPI schema | **200** `{ pending, approvedToday, departures7d, waitlist, tourChips }` | counts match DB |
| T1 | tenant isolation | foreign tenant approve | **404** `BOOKING_NOT_FOUND` | no cross-tenant write |
| T2 | RLS enforcement | app role + wrong tenant session | empty read | cannot see foreign row |

## Proof harness

`apps/api/test/bookings-http-postgres.spec.ts` — only `createRequestListener` + header auth; asserts `PrismaBookingsRepository`.

See also: [`BOOKING_CAPACITY_CONCURRENCY_CERT.md`](./BOOKING_CAPACITY_CONCURRENCY_CERT.md), [`BOOKING_HTTP_ERROR_MATRIX.md`](./BOOKING_HTTP_ERROR_MATRIX.md).

## Active submitter uniqueness (MR-P0-011 / hostile audit)

Postgres enforces `uq_operator_reg_active_user` on `(tenant_id, tour_id, submitted_by_user_id)` for non-terminal statuses. Certification helpers must not reuse the same operator user id for multiple active creates on one tour — `createPending` defaults to a fresh `randomUUID()` submitter.
