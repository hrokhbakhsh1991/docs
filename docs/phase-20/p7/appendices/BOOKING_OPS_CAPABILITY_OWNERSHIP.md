# Booking Ops Capability Ownership

```yaml
doc_id: BOOKING_OPS_CAPABILITY_OWNERSHIP
status: LANDED
date: "2026-07-20"
decision: B — ops capability is UI-only
```

## Decision

**B.** `capabilities.ops` belongs only to operator **UI** (via `opsManifest` → web bindings).

It does **not** gate Booking write paths.

## Ownership split (no duplicates)

| Concern | Owner | Mechanism |
| ------- | ----- | --------- |
| Operator UI surface | Workspace `opsManifest` | Codegen requires `capabilities.ops.mode=ui-manifest` ↔ `opsManifest` |
| Operator **writes** (create/approve/reject/waitlist/cancel/bulk/list-ops) | Host authz | `BookingAuthorizationPort.assertOpsAccess` (admin \| owner) |
| Workspace enablement | Bindings | `workspaceBooking.supported` / `isBookingSupportedWorkspace` |

## Composition

```text
manifest capabilities.ops { enabled, mode: ui-manifest }
  → codegen validates opsManifest present
  → web ops bindings (UI only)

manifest graded write capabilities { publicCreate, operatorCreate, … }
  → toBookingRuntimeCapabilities (ops omitted)
  → BookingsService gates

HTTP ops writes
  → resolveBookingsServiceForTenant
  → assertOpsAccess (role) — never capabilities.ops
```

## Forbidden

- Injecting `ops` into `BookingRuntimeCapabilities`
- Reading `capabilities.ops` inside `BookingsService`
- Using `ops.mode` as a write-path gate
