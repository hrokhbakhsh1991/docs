# Booking Second Workspace Hostile Proof (Phase B1.3)

```yaml
doc_id: BOOKING_WORKSPACE_FIXTURE_B1_3
phase: B1.3
status: LANDED
date: "2026-07-19"
authority:
  - BOOKING_CAPABILITY_GATE_B1_0 / BOOKING_DEPENDENCY_REGISTRY_B1_1
  - Booking Evolution Plan B1.3 (hostile-proof second workspace)
constraints:
  - one observable policy difference (capacity CASE_A)
  - no kind-only / empty-success adapters for the claimed difference
  - no registryOnly + supported (decorative support forbidden)
  - capability gate + runtime fail-closed for unsupported workspaceType
```

## Goal

Prove Booking capability is **real** across two product workspaces — not decorative
registration — via a minimal, observable create-policy difference.

## Classification

**Product capability** (`supported: true`, **not** `registryOnly`).

| Workspace | Capacity CASE_A (`guestLabel=CASE_A`) |
| --------- | ------------------------------------- |
| denali | **accept** |
| booking-ws2 | **reject** (`BOOKING_CAPACITY_REJECTED`) |

Shared: base validation (partySize / guestLabel), standard occupancy vs `tourCapacityMax`.

## Package

`packages/workspaces/booking-ws2` → `@app-tour/workspace-booking-ws2`

Included in API/web product plugin registries (minimal starter-based plugin stub).

## Enforcement

1. `isBookingSupportedWorkspace` — codegen from `workspaceBooking.supported`
2. `getOrCreateBookingRuntimeForWorkspaceType` — throws `BookingWorkspaceUnsupportedError`
3. `resolveBookingWorkspaceTypeForTenant` — fail-closed (no Denali fallback)
4. Codegen refuses `supported: true` + `registryOnly: true`

## Proof

`apps/api/src/bookings/booking-ws2-fixture.spec.ts`

- **A)** Denali accepts CASE_A public create
- **B)** booking-ws2 rejects CASE_A; still accepts normal guest
- **C)** same process, both workspaceTypes, divergent CASE_A outcome
- **D)** unsupported/unknown workspaceType rejected

## Explicitly NOT claimed as product differences

- Distinct `reactAfterApprove` tokens (`denali-approve-ack` vs `booking-ws2-approve-ack`); host invokes after approve TX (B1.7)
- Ops panel ids empty (both)
- Full tourWrite / Denali clone (forbidden)

## Architecture report (B1.3)

### Files

| Area | Files |
| ---- | ----- |
| Manifest / adapters | `packages/workspaces/booking-ws2/**`, Denali booking adapters import fix |
| Codegen | `domains/booking.mjs` (forbid supported+registryOnly) |
| Generated | booking + core-registry product plugin lists include booking-ws2 |
| Tests | `booking-ws2-fixture.spec.ts` (A/B/C/D) |

### Remaining gaps

- Ops create path may still skip validation/capacity (public create is the proof surface)
- Shared bookings repository across workspace types
- Post-approve reactions still no-op
