# Booking guest duplicate uniqueness (MR-P0-011)

```yaml
doc_id: BOOKING_GUEST_DUPLICATE_UNIQUENESS
status: ACTIVE
date: "2026-07-20"
closes: MR-P0-011
migration: 20260720150000_operator_registration_active_guest_uniques
```

## Problem

Guest duplicate detection was **check-then-act** in application code (`findActiveGuestDuplicate` then `create`). Under concurrency, two inserts for the same active guest on a tour can both pass the check.

## Decision

PostgreSQL **partial unique indexes** enforce uniqueness for rows that are not `cancelled` / `rejected`:

| Index | Keys | Predicate |
| ----- | ---- | --------- |
| `uq_operator_reg_active_email` | `(tenant_id, tour_id, lower(guest_email))` | email present + active |
| `uq_operator_reg_active_user` | `(tenant_id, tour_id, submitted_by_user_id)` | active |
| `uq_operator_reg_active_label` | `(tenant_id, tour_id, lower(guest_label))` | active |
| `uq_operator_reg_active_national_id` | `(tenant_id, tour_id, intake nationalId)` | nationalId present + active |

Application layer still pre-checks for friendly UX. On race, Prisma `P2002` maps to `BOOKING_GUEST_DUPLICATE` (HTTP 409).

## Harness note (capacity / concurrency specs)

Fixtures that seed **multiple active** rows on the same tour (pending or approved) must use a **distinct** `submitted_by_user_id` (and distinct `guest_label`) per row. Reusing one user across pendings violates `uq_operator_reg_active_user` and is not a valid domain scenario — capacity races model distinct guests competing for seats.

## Verification

```bash
pnpm --filter @apps/api run guard:migration-head-preflight
# After migrate: parallel public creates for same email → one 201, one 409
```
