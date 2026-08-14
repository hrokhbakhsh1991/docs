# Booking guest duplicate uniqueness (MR-P0-011)

```yaml
doc_id: BOOKING_GUEST_DUPLICATE_UNIQUENESS
status: ACTIVE
date: "2026-08-10"
closes: MR-P0-011
migration: 20260720150000_operator_registration_active_guest_uniques
amends: 20260810120000_operator_registration_active_self_unique
authority: docs/workspaces/denali/registration-self-other-uniqueness.mdoc
```

## Problem

Guest duplicate detection was **check-then-act** in application code (`findActiveGuestDuplicate` then `create`). Under concurrency, two inserts for the same active guest on a tour can both pass the check.

## Decision

PostgreSQL **partial unique indexes** enforce uniqueness for rows that are not `cancelled` / `rejected`:

| Index | Keys | Predicate |
| ----- | ---- | --------- |
| `uq_operator_reg_active_email` | `(tenant_id, tour_id, lower(guest_email))` | email present + active |
| `uq_operator_reg_active_self` | `(tenant_id, tour_id, submitted_by_user_id)` | active **and** `coalesce(intake.registrantTarget,'self') = 'self'` (replaces `uq_operator_reg_active_user` as of 20260810) |
| `uq_operator_reg_active_label` | `(tenant_id, tour_id, lower(guest_label))` | active |
| `uq_operator_reg_active_national_id` | `(tenant_id, tour_id, intake nationalId)` | nationalId present + active |

**Self vs other:** one active **self** registration per submitter per tour. Multiple **other** rows by the same booker are allowed when guest label / nationalId differ. Application `kind: "user"` duplicate match is **self-only** (excludes `registrantTarget=other`).

Application layer still pre-checks for friendly UX. On race, Prisma `P2002` maps to `BOOKING_GUEST_DUPLICATE` (HTTP 409).

## Harness note (capacity / concurrency / list pagination specs)

Fixtures that seed **multiple active** rows on the same tour (pending or approved) must use **distinct** values for every active unique key that applies:

| Key | Index | Harness rule |
| --- | ----- | ------------ |
| `submitted_by_user_id` (self rows) | `uq_operator_reg_active_self` | Distinct submitter **or** mark intake `registrantTarget: "other"` when modeling multiple seats for one booker |
| `guest_label` | `uq_operator_reg_active_label` | Distinct label string per row |
| `guest_email` / `guest_phone` | email / phone uniques | Distinct or null |
| `registration_intake.nationalId` | `uq_operator_reg_active_national_id` | **Per-row** nationalId when intake includes the key — a shared `HEAVY_REGISTRATION_INTAKE` blob will fail on the 2nd insert |

Capacity races model distinct guests competing for seats — prefer distinct `submitted_by_user_id` + distinct labels (or `other` + distinct labels).

**List SQL filters after uniqueness:** when submitters are unique per row, tests must **not** filter `submittedByUserId` to a single shared fixture user for multi-row walks (BK-PAGE-05/07). Filter by `tourId` + `status` (and assert on `submittedAt` / id order) instead.

Same rule applies to Postgres seed hooks in:

| Spec | Why |
| --- | --- |
| `bookings-list-pagination.spec.ts` (Postgres SQL edge cases) | Tied-timestamp + noise rows on one tour |
| `bookings-pagination-stress.spec.ts` (Postgres stress) | Exact-limit + tie-break seeds — unique nationalId per heavy intake |
| `bookings-perf.spec.ts` (Postgres projection) | Bulk SEED_ROW_COUNT on one tour — unique nationalId per row |

## Verification

```bash
pnpm --filter @apps/api run guard:migration-head-preflight
# After migrate: parallel public creates for same email → one 201, one 409
# Self→self 409; other→other distinct labels 201 (same booker)
```
