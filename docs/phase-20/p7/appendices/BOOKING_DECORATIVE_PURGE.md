# Booking Decorative Surface Purge

```yaml
doc_id: BOOKING_DECORATIVE_PURGE
status: LANDED
date: "2026-07-20"
rule: remove artifacts that never change control flow, persistence, or network
behavior_delta: zero for HTTP/DB outcomes (capacity postgres A–E green)
```

## Classification applied

| Class | Action |
| ----- | ------ |
| A Runtime critical | Kept |
| B Test only | Rewritten or deleted |
| C Decorative | Removed |
| D Dead | Removed |
| E Future placeholder | Removed |

## Remaining runtime architecture

```text
HTTP / Denali public host
  → resolveBookingsServiceForTenant(tenantId)
       → resolveBookingWorkspaceTypeForTenant
       → getOrCreateBookingRuntimeForWorkspaceType
            → resolveBookingWorkspaceDependencies
            → resolveWorkspaceBookingEventReaction
            → assertBookingRuntimeCapabilityLevels
            → createBookingsService
  → BookingsService → PrismaBookingsRepository
```

`opsManifest` remains web-only (not API graded matrix).
