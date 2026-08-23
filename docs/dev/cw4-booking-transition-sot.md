# CW4 — Booking lifecycle transition source of truth

**Wave:** CW-4 (CW4-01..04)  
**Contract owner:** `@app-tour/booking-http-contracts` (`booking-lifecycle-transitions.ts`)  
**Evidence:** TRUTH §13–18; DEC-CW-07 (booking-http-contracts below tour-core / workspace-sdk)

## CW4-01 — Host vs Denali transition census

### Host enforcement surfaces (`BookingsService` → repository)

| Transition | Source statuses (host) | Target | Outbox |
| --- | --- | --- | --- |
| approve | `pending`, `waitlisted` | `approved` | `registration.approved` |
| reject | `pending`, `waitlisted` | `rejected` | **none** (decision B) |
| waitlist | `pending` | `waitlisted` | `registration.waitlisted` |
| cancel | `pending`, `waitlisted`, `approved` | `cancelled` | `registration.cancelled` |

Enforced in:

- `apps/api/src/bookings/in-memory-bookings.repository.ts` (approve / reject / waitlist / cancel)
- `apps/api/src/bookings/prisma-bookings.repository.ts` (same edges; optimistic `updateMany` + status guards)

`BookingsService` delegates lifecycle writes to the repository; it does not maintain a parallel edge table.

### Denali parallel graph (pre-CW4-02)

`packages/workspaces/denali/src/booking/lifecycle.ts` held `DENALI_BOOKING_TRANSITIONS`:

| From | To (allowed) |
| --- | --- |
| `pending` | `approved`, `waitlisted`, `rejected`, `cancelled` |
| `waitlisted` | `approved`, `rejected`, `cancelled` |
| `approved` | `cancelled` |
| `rejected` | — (terminal) |
| `cancelled` | — (terminal) |

### Parity result

**FULL PARITY** on transition edges. No semantic mismatch between host repository guards and the Denali graph.

**Intentional divergence (not edges):**

| Area | Host | Denali workspace domain |
| --- | --- | --- |
| History append model | Not in repository (DB status column only) | `applyDenaliBookingTransition` + `DenaliBookingHistoryEntry` in `lifecycle.ts` |
| Capacity gates on approve | `BookingsService` + `assertCapacityInTx` | `decideDenaliApprove` + `assertDenaliTransitionCapacity` |
| Waitlist policy gate | Host capability / workspace binding | `denaliWaitlistAllowed(rule)` |

Outbox semantics (CW0-04): approve / waitlist / cancel observable; reject silent — identical on both paths.

## CW4-02 — Shared contract promotion

Machine-readable edge list lives in:

`packages/booking-http-contracts/src/booking-lifecycle-transitions.ts`

Exports:

- `BOOKING_LIFECYCLE_TRANSITIONS` — adjacency map (SoT)
- `BOOKING_STATUS_PIPELINE` — ordered ops vocabulary (`pending` → `approved` → `waitlisted` → `rejected` → `cancelled`)
- `canTransitionBookingStatus`, `listBookingTransitionsFrom`, `listBookingSourceStatusesForTarget`
- `isBookingTerminalStatus`

Host repositories import these helpers for transition guards and Prisma `status: { in: [...] }` clauses.

Wire enum `BookingStatus` remains in `booking-status.ts` (unchanged).

## CW4-03 — Denali ops manifest derivation

`denaliRegistrationOpsManifest.statusPipeline` and `DENALI_BOOKING_STATUS_PIPELINE` re-export / freeze `BOOKING_STATUS_PIPELINE` from the shared contract so DN-B1-OPS-01 alignment is derivation, not manual sync.

## CW4-04 — Denali lifecycle demotion + consumer census

### Production authorization

Host booking authorization and persistence **do not** import Denali `lifecycle.ts` transition table. Enforcement is repository + shared contract (CW4-02).

### Remaining consumers of Denali lifecycle module

| Consumer | Role | CW4-04 disposition |
| --- | --- | --- |
| `operator-decisions.ts` | Pure workspace domain snapshots + capacity | **Compat** — uses `applyDenaliBookingTransition` (history model); edges delegated to contract |
| `ops-actions.ts` | Ops action → decision map | **Compat** — no independent graph |
| `packages/workspaces/denali/test/*` | Domain / journey specs | Test parity |
| `test/parity/registration-lifecycle.golden.spec.mjs` | CW0-04 goldens | Switched to contract importers |

### Workspace-retained (documented)

- `DenaliBookingHistoryEntry`, `applyDenaliBookingTransition`, `createDenaliBookingPendingSnapshot` — Denali pure-domain history append; not host SoT.

### Compat re-exports

`canTransitionDenaliBooking` / `listDenaliBookingTransitionsFrom` remain as thin aliases over `canTransitionBookingStatus` / `listBookingTransitionsFrom` for existing Denali tests and domain helpers.
