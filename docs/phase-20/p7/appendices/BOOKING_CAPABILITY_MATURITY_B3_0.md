# Booking Capability Maturity Model (Phase B3.0)

```yaml
doc_id: BOOKING_CAPABILITY_MATURITY_B3_0
phase: B3.0
status: LANDED
date: "2026-07-19"
authority:
  - Finance B2.3 / workspace-finance-capabilities.generated.ts
  - docs/phase-20/p7/appendices/BOOKING_CAPABILITY_GATE_B1_0.md
constraints:
  - reuse generated workspace-booking-capabilities.generated.ts (no second registry)
  - runtime fail-closed on level / adapter mismatch
  - supported remains product gate; capabilities are executable levels
```

## Problem

`workspaceBooking.supported: true` was read as full booking parity. Denali and booking-ws2 both claimed it while capacity SoT, validation depth, and approve reactions differed.

## Model

`supported` = product enablement gate only (`isBookingSupportedWorkspace`).

Graded claims live under `workspaceBooking.capabilities`:

```yaml
workspaceBooking:
  supported: true
  capabilities:
    enabled: true
    publicCreate:    { enabled, owner, mode }
    operatorCreate:  { enabled, owner, mode }
    validation:      { enabled, owner, mode }
    capacity:        { enabled, owner, mode }
    approval:        { enabled, owner, mode }
    eventReaction:   { enabled, owner, mode }
    ops:             { enabled, owner, mode }
```

### Owners

| Value | Meaning |
| ----- | ------- |
| `none` | Capability off |
| `workspace` | Workspace adapter / ops manifest owns WHAT |
| `booking-host` | Host `BookingsService` / shared repository owns WHEN+WHERE |
| `hybrid` | Both participate (e.g. host occupancy + workspace policy; or registration + booking) |

### Modes

| Capability | Allowed modes |
| ---------- | ------------- |
| `publicCreate` / `operatorCreate` | `none` \| `create-pipeline` |
| `validation` | `none` \| `base-shape` \| `product-intake` |
| `capacity` | `none` \| `delegated-workspace` \| `booking-owned` \| `hybrid` |
| `approval` | `none` \| `host-lifecycle` |
| `eventReaction` | `none` \| `in-process` \| `durable-outbox` |
| `ops` | `none` \| `ui-manifest` |

### Anti-overclaim (codegen fails generation)

| Claim | Required implementation evidence |
| ----- | -------------------------------- |
| `publicCreate` / `operatorCreate` / `validation` / `capacity` enabled with non-`none` mode | Matching dependency bag fields (`publicBooking`, `validationPolicy`, `capacityPolicy`) |
| `capacity.mode=booking-owned\|hybrid` | `capacityPolicy` declared |
| `capacity.mode=delegated-workspace` | Forbids `capacityPolicy` (capacity not Booking-owned) |
| `eventReaction.mode=in-process` | `eventReaction` present; `requiresHostIo` must be false |
| `eventReaction.mode=durable-outbox` | `eventReaction` present; `requiresHostIo` must be true |
| `eventReaction.mode=none` | Forbids `eventReaction` block |
| `ops.mode=ui-manifest` | `opsManifest` present |
| `ops.mode=none` | Forbids `opsManifest` |
| `validation.mode=product-intake` | Rejected until Booking policy owns product intake (no hollow claim) |
| `enabled: true` with `mode: none` (or inverse) | Rejected |

## Honest matrix (landed)

| Capability | denali | booking-ws2 |
| ---------- | ------ | ----------- |
| enabled | true | true |
| publicCreate | hybrid / create-pipeline | hybrid / create-pipeline |
| operatorCreate | booking-host / create-pipeline | booking-host / create-pipeline |
| validation | workspace / base-shape | workspace / base-shape |
| capacity | hybrid / hybrid | workspace / booking-owned |
| approval | booking-host / host-lifecycle | booking-host / host-lifecycle |
| eventReaction | workspace / none (Option A — off) | workspace / none (Option A — off) |
| ops | workspace / ui-manifest | workspace / ui-manifest |

### Old claim vs new claim

| Workspace | Old | New |
| --------- | --- | --- |
| denali | `supported: true` (implied full parity) | `supported` + graded capabilities (capacity **hybrid**, reaction **in-process**, validation **base-shape**) |
| booking-ws2 | `supported: true` (same as Denali) | `supported` + graded capabilities (capacity **booking-owned**, same reaction/validation grades) |

## Generated

`apps/api/src/bookings/workspace-booking-capabilities.generated.ts`

- `WORKSPACE_BOOKING_CAPABILITIES`
- `getBookingWorkspaceCapabilities(workspaceType)`
- `listBookingCapableWorkspaceTypes()`
- typed owners/modes

## Runtime

**Executable (not descriptive-only).** Composition calls `assertBookingRuntimeCapabilityLevels`
against `getBookingWorkspaceCapabilities` (same generated matrix — no second registry).

`BookingsService` fails closed on:

- `publicCreate` / `operatorCreate` mode gates
- `validationMode` / `capacityMode` before create pipeline
- `eventReactionMode` + approval before approve
- adapter / binding mismatches (hollow `supportsPublicCreate`, durable-outbox without HostIo)

Proof: `booking-runtime-capability-levels.spec.ts` + `booking-capability-maturity.spec.ts`

## Proof

`apps/api/src/bookings/booking-capability-maturity.spec.ts`
`apps/api/src/bookings/booking-runtime-capability-levels.spec.ts`

```bash
pnpm run generate:workspace-registry
# or: node scripts/generate-workspace-registry.mjs --domain booking
```
