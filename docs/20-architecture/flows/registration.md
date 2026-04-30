Document-ID: MKT-FLOW-REGISTRATION-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Registration Flow v2

## Purpose
Define tenant-scoped registration lifecycle in the leader-centric model.

## Core Rules
- Registration and waitlist are separate entities.
- Only `Accepted` consumes capacity.
- No duplicate active registration (`Pending`/`Accepted`) per `(user, tour)`.

## Registration Status State Machine

| Current Status | Allowed Next Statuses | Notes |
|---|---|---|
| `Pending` | `Accepted`, `Rejected`, `Cancelled` | Initial operational review state. |
| `Accepted` | `Rejected`, `Cancelled`, `NoShow` | Leaving `Accepted` releases capacity; `Accepted -> Rejected` and `Accepted -> Cancelled` trigger waitlist promotion in runtime flow. |
| `Rejected` | terminal | No further transitions allowed. |
| `Cancelled` | terminal | No further transitions allowed. |
| `NoShow` | terminal | No further transitions allowed. |

### Transition Semantics: `Accepted -> Rejected`

Occurs when an already accepted registration is later rejected by an admin (for example: invalid documents, rule violation, or manual review outcome).  
This transition releases capacity and triggers waitlist promotion.

## Main Flow
1. Participant opens leader-specific tour entry.
2. Participant submits registration request.
3. System validates tenant context and active-registration constraints.
4. If capacity available: create `Registration(status=Pending)`.
5. Leader reviews request:
   - Accept -> `Accepted`
   - Reject -> `Rejected`
6. If accepted, participant becomes eligible for communication link access.

## Payment-Integrated Flow (Phase 5)
1. If tour has `costContext.requiresPayment = true`, registration is created as `Accepted` (capacity reserved) with payment pending state.
2. Internal payment webhook `Pending -> Paid` transitions registration to `AcceptedPaid`.
3. Internal payment webhook `Pending -> Failed` transitions registration to `Rejected`, releases capacity, and triggers canonical FIFO waitlist promotion.
4. Admin refund `Paid -> Refunded` transitions registration to `Refunded`, releases capacity, and triggers canonical FIFO waitlist promotion.
5. Timeout processor can convert stale `Pending` payments to `Failed` using the same recovery semantics as webhook failure.

## Full-Capacity Path
- If tour is full at request time, participant is routed to waitlist flow.

## Cancellation Path
- If `Accepted` becomes `Cancelled`, capacity is released.
- Non-accepted cancellation has no capacity effect.

## Related Backend References
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- `docs/20-architecture/contracts/audit_event_schema.md`

---

## Changelog

- 2026-04-28: Added backend cross-references to model and contracts for traceability.
- 2026-04-30: Synced registration status state machine with runtime transitions; added explicit `Accepted -> Rejected` semantics and side effects (capacity release + waitlist promotion).
