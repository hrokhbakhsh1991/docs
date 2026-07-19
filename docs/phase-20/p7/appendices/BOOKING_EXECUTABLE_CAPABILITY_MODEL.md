# Booking Executable Capability Model

```yaml
doc_id: BOOKING_EXECUTABLE_CAPABILITY_MODEL
status: LANDED
date: "2026-07-20"
decision: B — remove decorative owner metadata
```

## Field audit

| Field | Consumer | Where | If changed |
| ----- | -------- | ----- | ---------- |
| `workspaceBooking.supported` | Composition gate | `isBookingSupportedWorkspace` / bindings codegen | Unsupported → fail closed |
| `capabilities.enabled` | Composition | `requireBookingWorkspaceCapabilities` | Must be `true` when supported |
| `*.enabled` | Application + assert | `BookingsService` gates; `assertBookingRuntimeCapabilitiesMatchAdapters` | Disables path / fail closed |
| `*.mode` | Application + assert + codegen | Service gates; adapter honesty; ops↔opsManifest coupling | Changes required behavior / generation fails |
| `*.owner` | **None** | — | **Removed** (was decorative) |
| `*.level` | **None** | — | **Never existed** / rejected if declared |

## Final executable model

```text
workspaceBooking.supported: boolean          # product enablement
capabilities.enabled: true                   # required when supported
capabilities.<name>: { enabled, mode }       # graded depth only
```

Graded names: `publicCreate` | `operatorCreate` | `validation` | `capacity` | `approval` | `eventReaction` | `ops`

Injected into application (no generated imports): `{ enabled, mode }` per **write** path
(`publicCreate`, `operatorCreate`, `validation`, `capacity`, `approval`, `eventReaction`).

`ops` remains on the graded matrix for **UI only** (`mode=ui-manifest` ↔ `opsManifest`).
It is **not** injected into `BookingsService`. See [`BOOKING_OPS_CAPABILITY_OWNERSHIP.md`](./BOOKING_OPS_CAPABILITY_OWNERSHIP.md).
