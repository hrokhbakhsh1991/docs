# Booking Tenant / Workspace Runtime Binding (B2.0)

```yaml
doc_id: BOOKING_TENANT_RUNTIME_BINDING_B2_0
phase: B2.0
status: LANDED
date: "2026-07-19"
authority:
  - Hostile certification v2 — same-tenant / different-workspaceType undefined
constraints:
  - invariant tenantId → workspaceType
  - no repository split
  - no workspaceType column on booking tables
  - no data-model change
```

## Invariant

```text
tenantId  ──resolve──►  workspaceType
                              │
                              ▼
                    BookingRuntime(workspaceType)
                              │
              every service call with that tenantId
                              │
                              ▼
         owned(workspaceType) === runtime.workspaceType
              else BOOKING_WORKSPACE_TENANT_MISMATCH
```

Callers **must not** select a workspaceType for a tenant. Tenant façades
(`resolveBookingsServiceForTenant`, `resolveWorkspaceBookingEventReactionForTenant`,
HTTP façades) always derive type from tenant context.

`getOrCreateBookingRuntimeForWorkspaceType` remains a **capability cache** only;
`BookingsService` still asserts binding on every tenant-scoped method.

## Wiring

| Piece | Role |
| ----- | ---- |
| `BookingTenantWorkspaceBindingPort` | Application port |
| `HostBookingTenantWorkspaceBindingAdapter` | Resolves tenant type; throws mismatch / unsupported |
| `BookingsService.workspaceType` + `assertTenantBound` | Enforced on create / public / approve / reject / bulk / list / duplicates |
| `resolveWorkspaceBookingEventReactionForTenant` | Tenant-owned reaction resolution |

## Proof

`booking-tenant-runtime-binding.spec.ts` — A/B/C/D.
