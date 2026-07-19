# Booking Approve Concurrency (Prisma)

```yaml
doc_id: BOOKING_APPROVE_CONCURRENCY_PRISMA
status: LANDED
date: "2026-07-20"
driver: STORAGE_DRIVER=prisma + real PostgreSQL
lock: pg_advisory_xact_lock(hashtext(tenant), hashtext(tour))
```

## Locking strategy

Tour-scoped **transaction advisory lock** inside the approve TX (`withTenantRls`):

```sql
SELECT pg_advisory_xact_lock(
  hashtext($tenant::text),
  hashtext($tour::text)
);
```

Then: re-read booking → sum `status=approved` party sizes → capacity assert → update status → enqueue outbox (`domain_event_id` unique per tenant).

### Why advisory (not multi-row FOR UPDATE)

| Mechanism | Role |
| --------- | ---- |
| `pg_advisory_xact_lock(tenant, tour)` | Single key serializes all capacity decisions for `(tenant, tour)`; released on COMMIT/ROLLBACK |
| Occupancy re-read after lock | Loser sees winner’s approved seats |
| `@@unique([tenantId, domainEventId])` on outbox | At-most-once insert of `registration.approved:{id}:{ts}` |

**FOR UPDATE on all tour rows** deadlocked under 10-way concurrent approve (unordered multi-row locks → `40P01`). Advisory lock replaces that strategy.

### Ordering

```text
TX-A: find → advisory_xact_lock (holds) → capacity OK → approve + outbox → COMMIT (lock released)
TX-B: find → advisory_xact_lock (waits) → … → capacity FAIL → ROLLBACK
```

## Proof command

```bash
cd apps/api
pnpm run test:booking-approve-concurrency
# expands to: STORAGE_DRIVER=prisma TENANT_MAX_CONCURRENT_DB_OPS=32
#             node --env-file=.env --env-file=.env.local --test …
```

**Do not skip.** Missing `DATABASE_URL` / `DATABASE_URL_ADMIN` fails the suite.

Raise `TENANT_MAX_CONCURRENT_DB_OPS` for the ten-way race so the host tenant DB semaphore does not mask lock contention (default cap is 4).

## Remaining production risks

- Create path still check-then-act without tour lock (pending pile-up); approve is the hard capacity gate.
- Advisory lock waits (blocking) — under extreme contention latency grows; no overbooking; no deadlock on capacity key.
- `hashtext` collisions are theoretically possible across unrelated (tenant,tour) pairs; accepted for int4 advisory space (same class as other hash-keyed locks).
- Host `TENANT_MAX_CONCURRENT_DB_OPS` (default 4) can reject excess concurrent approve attempts with `TENANT_DB_BUDGET_EXCEEDED` **before** locks — capacity remains safe; clients see 503. Proof suite raises the budget so lock contention is observed.

## Related proof pack

Scenario matrix A–E (bulk, approve∥cancel, multi-worker) + `pg_locks` evidence:

- Doc: [`BOOKING_CAPACITY_CORRECTNESS_POSTGRES.md`](./BOOKING_CAPACITY_CORRECTNESS_POSTGRES.md)
- Command: `pnpm run test:booking-capacity-postgres`

