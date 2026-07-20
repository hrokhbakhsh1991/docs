# Booking Capacity Concurrency — PostgreSQL Certification

```yaml
doc_id: BOOKING_CAPACITY_CONCURRENCY_CERT
status: ACTIVE
date: "2026-07-20"
driver: STORAGE_DRIVER=prisma + PostgreSQL only
isolation: READ COMMITTED (Prisma interactive TX; no SERIALIZABLE)
serialization: pg_advisory_xact_lock on md5(tenantId||':'||tourId) two-int key
invariant: SUM(party_size) WHERE status='approved' <= tourCapacityMax
```

## Capacity meaning

**Occupancy** = sum of `party_size` for rows with `status = approved` on `(tenant_id, tour_id)`.

Pending / waitlisted / rejected / cancelled do **not** consume occupancy.

Therefore:

| Path | Changes occupancy? | Must serialize on tour lock? |
| ---- | ------------------ | ---------------------------- |
| create (→ pending) | No | Yes — soft gate re-check vs approved under lock |
| approve / bulkApprove | Yes ↑ | Yes — lock → sum → assert → conditional status update |
| cancel (from approved) | Yes ↓ | Yes — lock → conditional update |
| cancel (from pending/waitlisted) | No | Yes — same lock (status race vs approve) |
| waitlist | No | Yes — status race vs approve (conditional update) |
| reject | No | Yes — status race vs approve (conditional update) |

## Create path (not eventually consistent for the soft gate)

Create previously: `sumApproved` + policy **outside** TX, then `INSERT` — TOCTOU vs concurrent approve filling the last seat (spurious accept) or vs concurrent create (both accept when `approved + party ≤ max` still holds for each alone).

Hard invariant (no overbook of **approved** seats) was already enforced only at approve.

**Redesign:** create runs inside the same tour advisory lock:

1. `pg_advisory_xact_lock(tour)`
2. re-sum approved
3. `assertCapacityInTx`
4. `INSERT` pending

Pending pile-up when `approved=0` and many creates of `partySize=1` with `capacityMax=1` remains allowed: pending does not consume seats; approve serializes winners. That is intake semantics, not an overbook hole.

## Status races (lost update)

Unconditional `UPDATE … WHERE id = $id` after a non-locking read allows:

```text
T_reject: READ status=pending
T_approve: LOCK → READ pending → SUM → UPDATE approved → COMMIT
T_reject: UPDATE rejected WHERE id=…   -- overwrites approved (lost update)
```

**Fix:** all status transitions use `updateMany` with an expected-status predicate; `count !== 1` → conflict / not found after re-read.

## Bulk lock order

Distinct `tourId`s are locked in **sorted** order to prevent AB-BA deadlocks across concurrent bulk approves.

## Advisory lock key

`hashtext(a), hashtext(b)` independent hashes collide across unrelated pairs.

**Replace with** two 32-bit ints derived from `md5(tenantId || ':' || tourId)` so one tour maps to one lock key with negligible collision class for practical tenant/tour UUIDs.

## Stress proof

```bash
pnpm --filter @apps/api run test:booking-capacity-stress
```

Requirements: PostgreSQL only, hundreds of concurrent ops, random schedules, ≥100 iterations, assert invariant after every wave. No “exactly one winner” scheduling assertions (those are flaky under READ COMMITTED + lock wait order).

## Outbox grants (2026-07-20)

Fresh empty `migrate deploy` must GRANT `outbox_events` to `app_tour` or Booking approve fails with Postgres 42501.

## Mandatory CI gate (Booking PostgreSQL)

**Workflow:** [`.github/workflows/booking-postgres-gate.yml`](../../../../.github/workflows/booking-postgres-gate.yml)

**Invariant:** certification jobs pin `STORAGE_DRIVER=prisma`. Memory repositories are forbidden — merge must fail if any production-path proof fails.

| Job | Commands | Approx runtime |
| --- | -------- | -------------- |
| Booking PostgreSQL capacity | `test:booking-capacity-postgres`, `test:booking-capacity-stress`, `test:booking-approve-concurrency` | 8–15 min (stress dominates) |
| Booking HTTP PostgreSQL | `test:booking-http-postgres` (create / approve / reject / waitlist / cancel / bulk-approve / receipts) | 3–6 min |

**Bootstrap (both jobs):**

1. Postgres 16 service (`:5434`)
2. `psql $DATABASE_URL_ADMIN -f docs/phase-4/dev/init/01-app-role.sql`
3. `DATABASE_URL=$DATABASE_URL_ADMIN pnpm --filter @apps/api run db:migrate:deploy`
4. `pnpm --filter @apps/api run prisma:generate` + Booking/Finance contract package builds

**Required env:**

| Variable | Role |
| -------- | ---- |
| `DATABASE_URL` | `app_tour` role (RLS) — runtime proof driver |
| `DATABASE_URL_ADMIN` | owner — migrate + seed/cleanup |
| `STORAGE_DRIVER` | must be `prisma` |
| `NODE_ENV` | `test` (header auth bypass) |
| `TENANT_MAX_CONCURRENT_DB_OPS` | raised for concurrency / stress |
| `PRISMA_TRANSACTION_TIMEOUT_MS` / `PRISMA_TRANSACTION_MAX_WAIT_MS` | stress TX wait budget |

Fast unit / memory HTTP suites (`bookings-ops.spec.ts`, etc.) stay outside this workflow.

**HTTP route matrix:** [`BOOKING_HTTP_POSTGRES_CERT.md`](./BOOKING_HTTP_POSTGRES_CERT.md) — create/approve/reject/waitlist/cancel/bulk/list/summary + tenant isolation + RLS.

**Branch protection:** job names `Booking PostgreSQL capacity` and `Booking HTTP PostgreSQL` **must** be required on `main`.

- Apply / verify: [`BOOKING_BRANCH_PROTECTION_GATE.md`](./BOOKING_BRANCH_PROTECTION_GATE.md)
- Script: `pnpm run ops:branch-protection:main` then `pnpm run ops:branch-protection:verify`
- Name drift guard: `pnpm run guard:required-check-names` (also a step in this workflow)
