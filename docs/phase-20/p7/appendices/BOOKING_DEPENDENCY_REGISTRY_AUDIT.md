# Booking Dependency Registry Audit

```yaml
doc_id: BOOKING_DEPENDENCY_REGISTRY_AUDIT
phase: dependency-registry-audit
status: LANDED
date: "2026-07-19"
authority:
  - BOOKING_DEPENDENCY_REGISTRY_B1_1
  - BOOKING_EVENT_OWNERSHIP_B1_7
  - BOOKING_OPS_CAPABILITY_B1_6 (opsManifest — web)
  - BOOKING_WRITE_PATH_POLICY_UNIFICATION
constraint: Do not keep capability tokens without runtime ownership.
```

## Classification

| Manifest capability | Binding | Classification | Runtime ownership |
| ------------------- | ------- | -------------- | ----------------- |
| `validationPolicy` | API dependency bag | **ACTIVE** | `BookingsService.executeCreatePipeline` → `assertCreateValid` |
| `capacityPolicy` | API dependency bag | **ACTIVE** | `BookingsService.executeCreatePipeline` → `assertCreateCapacity` |
| `publicBooking` | API dependency bag | **ACTIVE** (wired) | `BookingsService.createPublicGuestBooking` → `supportsPublicCreate()` |
| `eventReaction` | Separate event-reaction bindings | **GRADED OFF (Option A)** | Outbox type via adapter; `reactAfterApprove` **not** invoked (`enabled=false`, `mode=none`) |
| `opsCapability` | *(removed)* | **DEAD → removed** | Ops UI is `opsManifest` → `apps/web` booking-ops bindings — never API bag |

## Actions taken

### Wired — `publicBooking`
Previously generated and resolved but never consulted. Now injected into `BookingsService` and enforced on the public create path only (operator create unchanged).

Reject code: `BOOKING_PUBLIC_CREATE_UNSUPPORTED` when `supportsPublicCreate()` is false.

### Removed — `opsCapability`
Hollow `BookingOpsCapabilityPort` / `*OpsCapabilityAdapter` / `listOpsPanelIds()` had **zero** production call sites. Real ops UI ownership:

`workspaceBooking.opsManifest` → `workspace-booking-ops-bindings.generated.ts` → hub soft-resolve.

Codegen now rejects manifests that still declare `workspaceBooking.opsCapability`.

Dependency bag shape:

```ts
{
  workspaceType,
  publicBooking,
  capacityPolicy,
  validationPolicy,
}
```

## Proof

`booking-dependency-registry-audit.spec.ts` + updated B1.1 / B1.8 specs.
