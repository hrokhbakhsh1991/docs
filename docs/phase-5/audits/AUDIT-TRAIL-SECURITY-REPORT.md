# Audit Trail Security Report — Phase 5 (DEC-007)

**Date:** 2026-06-05  
**Spec:** [`apps/api/test/security/audit-trail-integrity.spec.ts`](../../../apps/api/test/security/audit-trail-integrity.spec.ts)  
**Policy SoT:** [`../appendices/IMPLEMENTATION-DECISIONS.md`](../appendices/IMPLEMENTATION-DECISIONS.md) **DEC-007**  
**Postgres:** `127.0.0.1:5434` · `STORAGE_DRIVER=prisma` · tenant via `integrationTenantId()` · subdomain `audit-trail-<run-uuid-prefix>`

---

## Executive verdict

| Verdict            | Result   |
| ------------------ | -------- |
| **Security audit** | **PASS** |

No forensic gap: every successful tour create in the matrix has a matching `TOUR_CREATED` audit row and `TourCreated` outbox row with `aggregate_id = tour.id`. Failed mutations produced zero audit rows (success-only policy). `audit_events` rejects `UPDATE` and `DELETE` via trigger `audit_events_append_only`.

---

## Test matrix counts

| Scenario                                                                | Attempts | Expected (DEC-007)                                          | Observed    |
| ----------------------------------------------------------------------- | -------- | ----------------------------------------------------------- | ----------- |
| Successful tour create (HTTP POST `/tours` + `ToursService.createTour`) | 20       | 20 new `audit_events` with `action = TOUR_CREATED`          | **20 / 20** |
| Failed tour create (`ValidationFailure` / HTTP 400)                     | 10       | **0** audit rows (pre-TX validation; no `appendAuditEvent`) | **0 / 10**  |

**Batch deltas (tenant-scoped):**

- `audit_events`: baseline → +20 after success batch; unchanged across 10 failure attempts (per-attempt delta 0).
- `tours`: +20 success only.
- `outbox_events`: +20 success only (`event_type = TourCreated`).

---

## Failed-mutation policy (DEC-007 clarification)

DEC-007 scopes Phase 5 audit to **successful create tour only**:

- `appendAuditEvent` runs inside `withCanonicalTransaction` in `persistNewTourAtomically` (same TX as tour + outbox).
- Plugin / canonical validation failures throw `ValidationFailure` **before** that transaction opens (see `5.2-plugin-validation.spec.ts`).

**Policy for this audit:** **success-only** — failed mutations must not write `audit_events`. The integrity spec asserts **0** audit rows per failed attempt and documents that as compliant with DEC-007, not a gap.

There is **no** Phase 5 requirement to log validation failures to `audit_events`; failure audit would be a separate ADR / Phase 6+ story.

---

## Field-level checks (successful creates)

For each of the 20 tour IDs:

| Field                        | Expected                               | Verified                                |
| ---------------------------- | -------------------------------------- | --------------------------------------- |
| `audit_events.action`        | `TOUR_CREATED`                         | Yes                                     |
| `audit_events.tenant_id`     | integration tenant UUID                | Yes                                     |
| `audit_events.entity_type`   | `tour`                                 | Yes                                     |
| `audit_events.entity_id`     | tour UUID                              | Yes                                     |
| `audit_events.actor_id`      | HMAC pseudonym of HTTP actor (DEC-034) | Yes (pseudonym stable per tenant+actor) |
| `outbox_events.aggregate_id` | same tour UUID                         | Yes                                     |
| `outbox_events.event_type`   | `TourCreated`                          | Yes                                     |

Distinct canonical markers were embedded in `basics.title` / `details.summary` (`audit-trail-success:*`, failure markers in invalid bodies).

---

## Immutability proof

Trigger: `audit_events_append_only` → function `reject_audit_events_mutation()` (migration `20260605150000_audit_events_append_only`).

On a sample row from the success batch:

| Operation                                     | Result                                      |
| --------------------------------------------- | ------------------------------------------- |
| `UPDATE audit_events SET action = 'TAMPERED'` | Rejected — message matches `/append-only/i` |
| `DELETE FROM audit_events WHERE id = …`       | Rejected — message matches `/append-only/i` |

Any successful mutation of audit storage → **FAIL** (not observed).

Test cleanup disables the trigger only in `after()` for fixture teardown (same pattern as `5.5-audit-events.spec.ts`).

---

## Sequence and correlation (tour ↔ audit ↔ outbox)

| Check                                                                 | Result                                              |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `created_at` monotonic per tenant on `audit_events` (ascending order) | **PASS** — non-decreasing timestamps across 20 rows |
| `tour.id` = `audit_events.entity_id` = `outbox_events.aggregate_id`   | **PASS** — 1:1:1 for all 20 tours                   |
| Successful tour without audit row                                     | **None** (would FAIL spec)                          |
| Successful tour without outbox row                                    | **None**                                            |

Timestamps for tour, audit, and outbox rows are written in a single canonical transaction; ordering is validated via audit `created_at` monotonicity and id correlation (not wall-clock equality).

---

## Test execution

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma
cd apps/api && NODE_ENV=test node --import tsx --test --test-concurrency=1 \
  test/security/audit-trail-integrity.spec.ts
```

**Result:** 2 tests, 0 failures (2026-06-05 run).

---

## References

- DEC-007: [`../appendices/IMPLEMENTATION-DECISIONS.md`](../appendices/IMPLEMENTATION-DECISIONS.md)
- Baseline audit spec: [`../../../apps/api/test/5.5-audit-events.spec.ts`](../../../apps/api/test/5.5-audit-events.spec.ts)
- Validation failure path: [`../../../apps/api/test/5.2-plugin-validation.spec.ts`](../../../apps/api/test/5.2-plugin-validation.spec.ts)
- Atomic persist: [`../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts`](../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts)
