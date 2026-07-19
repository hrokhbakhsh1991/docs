# Booking Dependency Registry (Phase B1.1)

```yaml
doc_id: BOOKING_DEPENDENCY_REGISTRY_B1_1
phase: B1.1
status: LANDED
date: "2026-07-19"
authority:
  - Finance Phase 1.1 / 1.5 C1 — workspace-finance-dependency-bindings.generated.ts
  - docs/phase-20/p7/appendices/BOOKING_CAPABILITY_GATE_B1_0.md
  - Booking Evolution Plan B1.1 (narrow slice: registration only)
constraints:
  - architectural dependency registration only
  - NO BookingsService / repository / HTTP / Prisma changes
  - NO capacity or validation behavior changes
  - NO runtime consumers of the registry
  - generated bindings are the single source of truth
```

## Goal

Mirror Finance Phase 1.1: `workspaceType` → Booking capability dependency factories via
**manifest → codegen**. Boot and HTTP call sites must not hardcode Denali adapter classes
once later phases wire the registry. This phase **registers only**.

## Manifest shape

Under `workspaceBooking` (alongside B1.0 enablement fields):

```yaml
workspaceBooking:
  supported: true
  defaultModuleEnabledWhenUnset: true
  publicBooking:
    module: "./booking"
    export: "DenaliBookingPublicAdapter"
  capacityPolicy:
    module: "./booking"
    export: "DenaliBookingCapacityPolicyAdapter"
  validationPolicy:
    module: "./booking"
    export: "DenaliBookingValidationPolicyAdapter"
  opsCapability:
    module: "./booking"
    export: "DenaliBookingOpsCapabilityAdapter"
```

Rules (codegen):

- If **any** of the four dependency fields is present, **all four** must be present
  (Finance `ledgerPolicy` + `receiptDefaults` pairing).
- Requires non-empty `workspaceTypes[]` on the manifest.
- `module` + `export` resolve via `importSpecifier` → `@app-tour/<pkg>/host/<module>`.

## Generated SoT

`apps/api/src/bookings/workspace-booking-dependency-bindings.generated.ts`

| Export | Role |
| ------ | ---- |
| `WORKSPACE_BOOKING_DEPENDENCY_BINDINGS` | `workspaceType` → factory bag |
| `isBookingDependencyBindingRegistered` | presence check |
| `listBookingDependencyWorkspaceTypes` | sorted keys |
| `resolveBookingWorkspaceDependencies(workspaceType)` | instantiate all four deps |

Return shape:

```ts
{
  workspaceType: string;
  publicBooking: /* DenaliBookingPublicAdapter */;
  capacityPolicy: /* DenaliBookingCapacityPolicyAdapter */;
  validationPolicy: /* DenaliBookingValidationPolicyAdapter */;
  opsCapability: /* DenaliBookingOpsCapabilityAdapter */;
}
```

## Denali adapters (registration tokens)

`packages/workspaces/denali/src/booking/` — **no-op registration classes**.

They intentionally do **not** move capacity math, intake validation, public booking host
wiring, or ops UI behavior. Existing Denali registration / host paths remain the runtime
owners until a later phase injects ports into `BookingsService` / host composition.

Export path: `@app-tour/workspace-denali/host/booking` (mirror finance).

## Runtime

**Unchanged.** No production importer of the dependency bindings or
`resolveBookingWorkspaceDependencies` outside structural tests.

## Explicitly NOT in B1.1

| Item | Deferred to |
| ---- | ----------- |
| Wire registry into `BookingsService` constructor | B1.4+ / B1.5 |
| Port method surfaces (capacity read, validate payload, …) | when wiring |
| `booking-http-contracts` / HTTP ownership | B1.2 |
| Second workspace fixture | B1.3 |
| Ops hub codegen (`opsManifest` nav) | B1.6 |
| Hand-written `booking-dependency-registry.ts` with platform extras | only if needed later (Finance booking-payment style) |

## Structural proof

`apps/api/src/bookings/booking-dependency-registry.spec.ts`

- Denali resolves all four adapters; unknown types fail closed
- Generated file is AUTO-GENERATED; manifest fields drive imports
- `bookings.service.ts`, repositories, routes, composition do not import dependency bindings

## Codegen

| Piece | Path |
| ----- | ---- |
| Generator | `scripts/codegen/workspace-registry/domains/booking.mjs` → `generateWorkspaceBookingDependencyBindings` |
| Orchestrator key | `workspaceBookingDependencies` |
| Domain group | `--domain booking` |

```bash
pnpm run generate:workspace-registry
# or: node scripts/generate-workspace-registry.mjs --domain booking
```

## Architecture report (B1.1)

### Files changed

| Area | Files |
| ---- | ----- |
| Doc | `docs/phase-20/p7/appendices/BOOKING_DEPENDENCY_REGISTRY_B1_1.md` |
| Codegen | `domains/booking.mjs`, `orchestrator.mjs` |
| Manifest | `packages/workspaces/denali/workspace.manifest.json` |
| Denali adapters | `packages/workspaces/denali/src/booking/*`, `package.json` export, `src/index.ts` |
| Generated | `apps/api/src/bookings/workspace-booking-dependency-bindings.generated.ts` |
| Tests | `apps/api/src/bookings/booking-dependency-registry.spec.ts` |

### Runtime changes

**NONE.**

### Gap to B1.2

B1.2 owns HTTP contracts (`booking-http-contracts` / `booking-http`) — orthogonal to this
registry. Registry **wiring** into service/host remains post-B1.2 (B1.4/B1.5) unless a
nano-spec pulls it forward.

### Risks

- Hollow registration adapters can be mistaken for real policy implementations
- Gate (B1.0) and deps (B1.1) both unused until composition wires them
- Requiring all four fields may block partial onboarding until adapters exist
