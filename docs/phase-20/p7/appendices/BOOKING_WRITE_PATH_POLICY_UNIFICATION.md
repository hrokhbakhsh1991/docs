# Booking Write-Path Policy Unification

```yaml
doc_id: BOOKING_WRITE_PATH_POLICY_UNIFICATION
phase: write-path-unification
status: LANDED
date: "2026-07-19"
authority:
  - Hostile Booking certification — ops createBooking bypassed workspace policies
  - BOOKING_TENANT_RESOLUTION_B1_5 (registry injection)
note: >
  Distinct from BOOKING_OPS_CAPABILITY_B1_6 (UI opsManifest). This closes the
  create-path policy asymmetry between public and operator HTTP entry points.
constraints:
  - one application create pipeline inside BookingsService
  - validationPolicy + capacityPolicy on every pending create
  - shared repository / no booking-core extraction
  - approve / reject / bulkApprove remain transitions (not create policies)
```

## Write entry inventory

| Entry | Path | Create policies? |
| ----- | ---- | ---------------- |
| Public create | `createPublicGuestBooking` → `executeCreatePipeline` | **Yes** |
| Operator create | `createBooking` (ops authz) → `executeCreatePipeline` | **Yes** |
| Bulk create / import | — | **N/A** (does not exist) |
| Approve / bulk approve / reject | status transitions | **No** (not create) |

## Pipeline

```text
createBooking (assertOpsAccess) ─┐
                                 ├─► executeCreatePipeline
createPublicGuestBooking ────────┘         │
                                           ├ occupancy (repo)
                                           ├ validationPolicy.assertCreateValid
                                           ├ capacityPolicy.assertCreateCapacity
                                           └ repository.createBooking
```

## Proof

`booking-write-path-policy.spec.ts` — A/B/C/D/E + public≡ops CASE_A per workspaceType.

## Remaining without create-policy execution

- `approveBooking` / `bulkApproveBookings` / `rejectBooking` (transitions)
- Denali `registration.service` pre-checks (workspace dual intake; still ends in public create pipeline)
- Receipt upload (Finance bridge)
