Document-ID: MKT-FLOW-WAITLIST-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Waitlist Flow v2

## Purpose
Define FIFO waitlist behavior when a leader tour is at full capacity.

## Core Rules
- Waitlist is separate from registration.
- No simultaneous active registration and active waitlist record for same `(user, tour)`.
- Queue ordering is FIFO.

## Entry Conditions
1. Participant requests registration.
2. Tour has no available accepted capacity.
3. Participant has no active registration.
4. System creates `WaitlistItem(status=Waiting)`.

## Conversion Conditions
1. Capacity becomes available (cancellation/capacity increase).
2. System selects earliest eligible `Waiting` item.
3. Convert waitlist item to registration path.
4. Mark waitlist item as `Converted`.

## Cancellation
- Participant or leader can cancel waitlist item -> `Cancelled`.

## Tenant Safety
- Queue operations are strictly tour-scoped and tenant-scoped.

## Related Backend References
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/flows/registration.md`

---

## Changelog

- 2026-04-28: Added backend cross-references for conversion and audit traceability.
