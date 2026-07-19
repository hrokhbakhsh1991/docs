# Booking Ops Capability (Phase B1.6)

```yaml
doc_id: BOOKING_OPS_CAPABILITY_B1_6
phase: B1.6
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.9.2 / 1.10.1 — workspaceFinance.opsManifest
  - packages/workspaces/denali/src/bookings/ops-manifest.ts (Phase 9.5 SoT values)
constraints:
  - UI metadata only (views / columns / actions / filters / KPIs)
  - NO authorization / persistence / approve logic moves
  - generic web resolves via generated bindings — never hard-import workspace packages
```

## Manifest

```yaml
workspaceBooking:
  opsManifest:
    module: "./bookings"
    defaultExport: "DEFAULT_BOOKING_OPS_MANIFEST"
    resolveFromThemeExport: "resolveBookingOpsManifestFromTheme"
```

## Generated

`apps/web/src/bootstrap/workspace-booking-ops-bindings.generated.ts`

| Export | Role |
| ------ | ---- |
| `WORKSPACE_BOOKING_OPS_BINDINGS` | pluginId → default + resolveFromTheme |
| `hasBookingOpsManifest(pluginId)` | presence |
| `resolveWorkspaceBookingOpsManifest(pluginId, theme?)` | throws if unbound |

Hub soft-resolve (Finance mirror):

`resolveBookingOpsCapabilityForHub(theme, pluginId)` → `BookingOpsCapability | null`

## Capability type

`BookingOpsCapability` ≡ `RegistrationOpsManifest` (workspace-sdk) — columns/actions/views only.

## Workspaces

| Workspace | Manifest id | Notes |
| --------- | ----------- | ----- |
| Denali | `denali_registration_ops` | Same values as prior `denaliRegistrationOpsManifest` |
| booking-ws2 | `booking_ws2_registration_ops` | Distinct fixture columns/actions |

## Explicitly NOT moved

Authz (`BOOKINGS_OPS_FORBIDDEN`), repository, `BookingsService.approve*`, outbox enqueue.

## Proof

`apps/web/test/booking-ops-capability.spec.ts` — Denali + booking-ws2 declare independently; unbound → null.
