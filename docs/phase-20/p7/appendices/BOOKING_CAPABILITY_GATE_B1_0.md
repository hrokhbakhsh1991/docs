# Booking Capability Gate (Phase B1.0)

```yaml
doc_id: BOOKING_CAPABILITY_GATE_B1_0
phase: B1.0
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.17 / workspace-finance-bindings.generated.ts
  - docs/phase-20/p7/appendices/BOOKING_BOUNDARY_B0_1.md
constraints:
  - capability layer only
  - NO BookingsService / repository / HTTP / Prisma / workspace product behavior changes
  - gate APIs exist; not wired into routes yet (preserves runtime)
```

## Capability shape

```yaml
workspaceBooking:
  supported: true
  defaultModuleEnabledWhenUnset: true   # optional
  # registryOnly: true  # fixtures may combine with supported (B1.3 / B1.8)
```

Requires `tourWrite.workspaceTypeExport` when `supported: true` (same as finance enablement bindings).

## Generated

`apps/api/src/bookings/workspace-booking-bindings.generated.ts`

- `WORKSPACE_BOOKING_BINDINGS`
- `isBookingSupportedWorkspace(workspaceType)`
- `defaultBookingEnabledWhenModulesUnset(workspaceType)`

## Runtime

**Unchanged.** Booking HTTP / service / Denali registration do not call these APIs yet.
B1.1+ will compose policies and optionally wire the gate.
See [`BOOKING_DEPENDENCY_REGISTRY_B1_1.md`](./BOOKING_DEPENDENCY_REGISTRY_B1_1.md) for dependency registration (landed; unused at runtime).

## Codegen

| Piece | Path |
| ----- | ---- |
| Domain generator | `scripts/codegen/workspace-registry/domains/booking.mjs` |
| Orchestrator key | `workspaceBooking` → `apps/api/src/bookings/workspace-booking-bindings.generated.ts` |
| Domain group | `--domain booking` |
| Manifest (Denali) | `packages/workspaces/denali/workspace.manifest.json` → `workspaceBooking` |

```bash
pnpm run generate:workspace-registry
# or: node scripts/generate-workspace-registry.mjs --domain booking
```

## Structural proof

`apps/api/src/bookings/booking-capability-gate.spec.ts`

- Bindings accept `denali`, reject non-booking workspaces
- Generated file is AUTO-GENERATED; no hardcoded `["denali"]` / `workspaceType === "denali"` tables
- `bookings.service.ts`, repositories, routes, composition do **not** import gate APIs

## Architecture report (B1.0)

### Files changed (this phase)

| Area | Files |
| ---- | ----- |
| Doc | `docs/phase-20/p7/appendices/BOOKING_CAPABILITY_GATE_B1_0.md` |
| Codegen | `scripts/codegen/workspace-registry/domains/booking.mjs`, `orchestrator.mjs` |
| Manifest | `packages/workspaces/denali/workspace.manifest.json` (`workspaceBooking`) |
| Generated | `apps/api/src/bookings/workspace-booking-bindings.generated.ts` |
| Tests | `apps/api/src/bookings/booking-capability-gate.spec.ts` |

### Runtime changes

**NONE.** Gate helpers are unused by HTTP / `BookingsService` / repositories / Prisma.

### Architectural improvements

- Manifest-driven Booking enablement mirrors Finance Phase 1 (`workspaceFinance` → generated bindings)
- Single SoT for `isBookingSupportedWorkspace` / `defaultBookingEnabledWhenModulesUnset`
- Hardcoded workspace allowlists for Booking capability are unnecessary (none existed under `bookings/`)

### Gap to Phase B1.1

B1.1 typically adds **dependency / policy registries** (capacity, validation, or workspace adapters) and may begin **wiring the gate** into host composition — still without changing Booking domain lifecycle semantics unless explicitly scoped.

### Risks

- Gate exists but is unused → easy to forget wiring in B1.1
- Only Denali declares `workspaceBooking` today; other workspaces that already create bookings via shared HTTP may need explicit manifest entries before the gate is enforced
- Full `generate:workspace-registry` regenerates sibling domains; prefer `--domain booking` when iterating
