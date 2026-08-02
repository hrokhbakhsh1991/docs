# Booking HTTP Error Matrix

```yaml
doc_id: BOOKING_HTTP_ERROR_MATRIX
status: LANDED
date: "2026-07-20"
```

## Rule

Known Booking domain errors **never** map to HTTP 500.  
500 is reserved for genuine internal failures (unexpected throws, DB driver faults, etc.).

SoT: `apps/api/src/bookings/booking-http-error-map.ts` → `resolveBookingHttpError` (wired in `handleHttpError`).

### Platform workspace-type unresolved (adjacent)

`resolveWorkspaceTypeForTenant` throws `WORKSPACE_TYPE_UNRESOLVED:<tenantId>` when the tenant is not registered (TODO-011 fail-closed).  
`handleHttpError` / `mapErrorMessageToStatus` map that prefix to HTTP **404** with stable wire code `WORKSPACE_TYPE_UNRESOLVED` (UUID suffix stripped — never `INTERNAL_ERROR`).

Booking composition wraps the same fault as `BookingWorkspaceUnsupportedError` so Booking routes keep the matrix row below rather than leaking a platform 500.

## Matrix

| Domain Error | HTTP | Reason | Client Action |
| ------------ | ---- | ------ | ------------- |
| `BOOKING_WORKSPACE_TENANT_MISMATCH` | **403** | Tenant’s workspaceType ≠ Booking runtime | Fix composition / tenant binding; do not retry same runtime |
| `BOOKING_CAPABILITY_VIOLATION` | **422** | Graded capability claim ≠ adapters | Fix manifest/codegen; do not retry |
| `BOOKING_PUBLIC_CREATE_UNSUPPORTED` | **403** | Public create disabled for workspace | Use ops create or enable publicCreate |
| `BOOKING_CAPACITY_REJECTED` | **409** | Occupancy / tourCapacityMax rule failed | Adjust party size / capacity; do **not** treat as rate-limit |
| `BOOKING_ALREADY_APPROVED` | **409** | Booking already approved | Treat as success/idempotent; refresh state |
| `BOOKING_ALREADY_CANCELLED` | **409** | Booking already cancelled (terminal) | Stop lifecycle writes; refresh state |
| `BOOKING_NOT_FOUND` | **404** | Registration missing / wrong tenant | Check id + tenant |
| `BOOKING_FORBIDDEN` / `BOOKINGS_OPS_FORBIDDEN` | **403** | Ops role / ownership denied | Authenticate as admin\|owner |
| `BOOKING_VALIDATION_FAILED` / `BOOKING_VALIDATION_REJECTED` | **400** | Create validation failed | Fix request body |
| `BOOKING_WAITLIST_REQUIRED` | **409** | Transition requires waitlist path | `POST …/waitlist` instead |
| `BOOKING_WORKSPACE_UNSUPPORTED` | **404** | Workspace not booking-supported | Use supported tenant/workspace |

Operator tour `acceptedCount` enrichment (`enrichTourListProjectionsWithAcceptedCount`) **fail-softs** on `BookingWorkspaceUnsupportedError` → `acceptedCount=0`. Booking write/lifecycle routes still return the 404 matrix row above.
| `BOOKING_STATUS_CONFLICT` | **409** | Illegal status transition (other statuses) | Refresh status; choose valid transition |
| `BULK_APPROVE_BATCH_LIMIT` | **400** | Bulk batch too large | Reduce `ids` length |

## Proof

`apps/api/src/bookings/booking-http-error-map.spec.ts` — every matrix row + no-500 invariant for known codes.
