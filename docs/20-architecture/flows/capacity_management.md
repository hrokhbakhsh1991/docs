Document-ID: MKT-FLOW-CAPACITY-MANAGEMENT-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Capacity Management Flow v2

## Purpose
Define canonical capacity behavior for leader-centric tours.

## Source of Truth
- `Tour.total_capacity`
- `Tour.accepted_count`

## Canonical Rule
- Only `Registration.status = Accepted` consumes capacity.

## Full Condition
- Tour is full when `accepted_count >= total_capacity`.

## Acceptance Guard
- Any transition to `Accepted` must verify free capacity first.

## Release Rule
- Transition from `Accepted` to non-accepted status decreases effective accepted occupancy.

## Waitlist Interaction
- When capacity becomes available, waitlist conversion logic may be triggered.

## Tenant Safety
- Capacity checks and updates are always evaluated within tenant scope.

## Related Backend References
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/flows/waitlist.md`

---

## Changelog

- 2026-04-28: Added backend cross-references for capacity, waitlist interaction, and audit alignment.
