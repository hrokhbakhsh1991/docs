# Booking list / duplicate / summary — no hidden 500 cap

```yaml
doc_id: BOOKING_LIST_CORRECTNESS
status: ACTIVE
date: "2026-07-20"
```

## Problem

`listByTenant` delegated to `listByTenantPage(limit=500)` (newest first). Correctness paths that scanned that array silently missed older rows:

- guest duplicate detection (public create)
- `GET /bookings` ops list + `total`
- `GET /bookings/summary` KPIs

## Fix (no new architecture)

| Path | Repository method | Behavior |
| ---- | ----------------- | -------- |
| Duplicate | `findActiveGuestDuplicate` | SQL filter by tour + match kind; active = not cancelled/rejected; **no row cap** |
| List | `listByTenantPage` + `countByTenantFilters` | Keyset page + exact COUNT for filters |
| Summary | `getBookingsSummaryStats` | SQL aggregates + tour chip group-by |

`listByTenant` remains deprecated for tests/perf only — **BookingsService must not call it** for product paths.

## Proof

- Unit / HTTP-PG: summary counts match admin `COUNT(*)`
- Duplicate: older-than-500 active guest still conflicts
