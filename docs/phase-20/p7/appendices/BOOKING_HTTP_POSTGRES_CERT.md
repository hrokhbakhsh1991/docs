# Booking HTTP → PostgreSQL Certification Matrix

```yaml
doc_id: BOOKING_HTTP_POSTGRES_CERT
status: ACTIVE
date: "2026-07-20"
path: HTTP → route → facade → resolveBookingsServiceForTenant → BookingsService → PrismaBookingsRepository → PostgreSQL+RLS
forbidden: InMemoryBookingsRepository | mocked repositories | direct BookingsService calls
command: pnpm --filter @apps/api run test:booking-http-postgres
ci_job: Booking HTTP PostgreSQL
fail_closed: "MR-P0-015 — missing DATABASE_URL(+ADMIN) → honest describe skip with BOOKING_HTTP_POSTGRES_REQUIRES_DATABASE (visible skip, never silent green). Dedicated runners (`test:booking-http-postgres`, Booking HTTP PostgreSQL CI, Phase-6 PG jobs) must set DATABASE_URL(+ADMIN) so the suite executes."
```

## Env contract (memory trunk vs PG cert)

| Runner | `DATABASE_URL` (+ADMIN) | Expected |
| ------ | ----------------------- | -------- |
| Root `pnpm test` / `STORAGE_DRIVER=memory` | Cleared by `bootstrap-outbox-test-env` | Suite **skipped** with stable `*_REQUIRES_DATABASE` reason — not a product failure |
| `pnpm --filter @apps/api run test:booking-http-postgres` (loads `.env`) | Present | Suite **runs**; missing env is a CI misconfig (scripts pin prisma + env files) |

Honest skip ≠ silent skip: Node test reporter shows skipped suites and the reason string remains grep-stable for MR-P0-015 meta-contracts.

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


## App-role table privileges (CI migrate order)

CI runs `docs/phase-4/dev/init/01-app-role.sql` **before** `prisma migrate deploy`. That script revokes default privileges for future postgres-owned tables, then grants only tables that already exist. Migrations that create tables later must include explicit `GRANT … TO app_tour` (RLS policies alone are not enough — Postgres still requires table privilege).

Booking HTTP Postgres cert requires at least:

| Table | Grant | Why |
| ----- | ----- | --- |
| `tenant_routes` | `SELECT` | `lookupTenantRouteRow` / `bind-request-context` on every authenticated request |
| `tours` | `SELECT, INSERT, UPDATE, DELETE` | Booking create/capacity paths read tours under `app_tour` + FORCE RLS |
| `urban_registrations` | `SELECT, INSERT, UPDATE, DELETE` | TODO-002 RLS adversarial + urban intake under `app_tour` + FORCE RLS |
| `http_idempotency_records` | `SELECT, INSERT, UPDATE, DELETE` | Finance prepay / IDEM-* under Phase 5 + `ci:integrity` (table from `20260605160000`; tip GRANT `20260803120000`) |

Without these grants, Prisma surfaces a truncated `Invalid …` wrapping Postgres `42501 permission denied`. Migrations: `20260802140000_tenant_routes_tours_app_tour_grants` + `20260802150000_urban_registrations_app_tour_grants` + `20260803120000_http_idempotency_app_tour_grants` — tip bumps `EXPECTED_PRISMA_MIGRATION_HEAD` (DEC-097 / MR-P0-003).

## Proof harness

`apps/api/test/bookings-http-postgres.spec.ts` — only `createRequestListener` + header auth; asserts `PrismaBookingsRepository`.

### TODO-001 — production JWT path (`test:booking-http-postgres-jwt-production`)

Honest production create under `NODE_ENV=production` + JWT (no `x-*` header auth, no harness). Capacity resolution is **fail-closed on tour SoT**:

```text
BookingsService.resolveEffectiveTourCapacityMax
  → HostBookingTourCapacityAdapter.resolveTourCapacityMax
  → tour.canonical.data.capacityMax
```

When `productionGradeIntegrity` is on (production / prodlike), a missing tour `capacityMax` rejects with `BOOKING_CAPACITY_REJECTED: tourCapacityMax required` even if the client sends `registrationIntake.tourCapacityMax`. The JWT cert therefore **seeds a `tours` row** with `canonical.data.capacityMax` before `POST /bookings` — client intake alone is not a valid production ceiling. Seed `publish_status` as `published` (Postgres `chk_tours_publish_status`); Denali-canonical `active` is not a column-legal value.

See also: [`BOOKING_CAPACITY_CONCURRENCY_CERT.md`](./BOOKING_CAPACITY_CONCURRENCY_CERT.md), [`BOOKING_HTTP_ERROR_MATRIX.md`](./BOOKING_HTTP_ERROR_MATRIX.md), [`BOOKING_REMEDIATION_TODO_001_HARNESS.md`](./BOOKING_REMEDIATION_TODO_001_HARNESS.md).

## Active submitter uniqueness (MR-P0-011 / hostile audit)

Postgres enforces `uq_operator_reg_active_user` on `(tenant_id, tour_id, submitted_by_user_id)` for non-terminal statuses. Certification helpers must not reuse the same operator user id for multiple active creates on one tour — `createPending` defaults to a fresh `randomUUID()` submitter.
