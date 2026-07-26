# Booking Manifest Completeness (Phase B1.8)

```yaml
doc_id: BOOKING_MANIFEST_COMPLETENESS_B1_8
phase: B1.8
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.10 — Declarative finance capability registration
  - Booking Evolution Plan B1.8
  - Prior Booking phases B1.0–B1.7 generated artifacts
constraints:
  - NO runtime behavior change
  - Replace only where safe (codegen completeness + thin registries + proofs)
  - Do not remove Denali plugin registrationOps (same SoT object as opsManifest)
```

## Audit

### Hardcoded booking workspace lists (hand-written production)

| Location | Finding | Action |
| -------- | ------- | ------ |
| ~~`BOOT_BOOKING_WORKSPACE_TYPE`~~ | Removed with tenant-less `resolveBookingsService()` | **Deleted** — public entry is tenant-only |
| Specs naming `"denali"` / `"booking-ws2"` | Fixture assertions | **Keep** — tests may hardcode expected ids |

### Manual registries

| Location | Finding | Action |
| -------- | ------- | ------ |
| Hand `Map` of Denali/ws2 adapter classes in `apps/api` | **None** — adapters only appear in `*.generated.ts` | N/A |
| `resolveBookingWorkspaceDependencies` lived in generated file | Fine functionally; Finance uses thin hand registry | **Safe** — thin `booking-dependency-registry.ts` re-exports generated |
| `booking-event-reaction-registry.ts` | Already thin (B1.7) | Keep |

### Duplicated capability declarations

| Pair | Why both existed | Action |
| ---- | ---------------- | ------ |
| `opsCapability` (deps) vs `opsManifest` (web UI) | Hollow API token vs real UI metadata | **Removed `opsCapability`** — see `BOOKING_DEPENDENCY_REGISTRY_AUDIT` |
| Plugin `registrationOps.manifest` vs `workspaceBooking.opsManifest` | Same object (`DEFAULT_BOOKING_OPS_MANIFEST === denaliRegistrationOpsManifest`) | **Keep** — removing plugin surface is unsafe (SDK contract) |

## Capability map (SoT = `workspace.manifest.json` → codegen)

| Capability | Manifest field | Generated artifact | Runtime |
| ---------- | -------------- | ------------------ | ------- |
| Enablement | `supported` (+ optional `defaultModuleEnabledWhenUnset`) | `workspace-booking-bindings.generated.ts` | `isBookingSupportedWorkspace` |
| Public / capacity / validation | `publicBooking`, `capacityPolicy`, `validationPolicy` | `workspace-booking-dependency-bindings.generated.ts` | Injected into `BookingsService` via composition |
| Event names / hooks | `eventReaction` | `workspace-booking-event-reaction-bindings.generated.ts` | `resolveWorkspaceBookingEventReaction` → approve path |
| Ops UI | `opsManifest` (packaging) + `capabilities.bookingOps` (runtime; Phase 4bf) | ~~web binder deleted~~ | `resolveBookingOpsCapabilityForHub` |


## Codegen completeness (Phase B1.8 + audit)

When `workspaceBooking.supported === true`:

- Require **three** dependency fields (`publicBooking`, `capacityPolicy`, `validationPolicy`).
- `workspaceBooking.opsCapability` is **rejected** by codegen (dead token).
- `eventReaction` / `opsManifest` remain optional at manifest level but required in practice for product workspaces.
- `registryOnly: true` cannot combine with `supported: true` (B1.3).

## Explicitly NOT changed (runtime)

- Approve / reject / bulkApprove behavior and outbox `eventType`
- Tenant → workspaceType resolution / denali fallback
- Prisma / relay / enqueue
- Plugin `registrationOps` surface

## Proof

`apps/api/src/bookings/booking-manifest-completeness.spec.ts`

- For each Booking-capable manifest (Denali, booking-ws2): generated deps / eventReaction / ops / gate artifacts contain the declared `export` / `defaultExport` names
- Hand-written booking registries contain **no** `@app-tour/workspace-*` imports (only generated)
- Hand-written non-generated booking sources contain **no** `new Map({ denali: … })`-style adapter tables

## Codegen

```bash
pnpm -w run generate:workspace-registry -- --domain=booking
```
