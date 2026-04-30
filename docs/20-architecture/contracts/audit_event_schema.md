Document-ID: MKT-DOC-ANALYSIS-STEP-04B
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 04-B: Audit Event Schema

## 1. Purpose

Define the minimal audit event model required for critical status transitions (`SR-NFR-002`).

---

## 2. Scope

Audit events are required for changes to:

- registration status
- payment status
- waitlist status

---

## 3. Canonical Event Fields

| Field | Type | Requirement |
|---|---|---|
| `event_id` | UUID/string | MUST be unique |
| `tenant_id` | UUID/string | MUST be present |
| `event_type` | enum | MUST be valid canonical event type |
| `entity_type` | enum | MUST be one of `registration`, `payment`, `waitlist_item` |
| `entity_id` | UUID/string | MUST reference changed entity |
| `actor_type` | enum | MUST be one of `leader`, `participant`, `admin`, `system` |
| `actor_id` | UUID/string | MUST be present for non-system actors |
| `old_value` | string/json | SHOULD capture prior status/value |
| `new_value` | string/json | MUST capture new status/value |
| `reason_code` | string | OPTIONAL but RECOMMENDED for manual overrides |
| `occurred_at` | datetime | MUST be server-generated |
| `request_id` | string | SHOULD be captured for correlation |

---

## 4. Event Type Catalog (MVP)

- `registration_status_changed`
- `payment_status_changed`
- `waitlist_status_changed`
- `registration_created`
- `waitlist_item_created`
- `payment.created`
- `payment.succeeded`
- `payment.failed`
- `payment.refunded`

---

## 5. Behavioral Rules

- `AUDIT-RULE-001`: Audit is MANDATORY for every release-critical transition. Missing audit events SHALL cause PRE-SPRINT-0 gate FAIL.
- `AUDIT-RULE-002`: Events MUST be tenant-scoped and immutable after write.
- `AUDIT-RULE-003`: `occurred_at` MUST come from server time, not client payload.
- `AUDIT-RULE-004`: Audit writes SHOULD be fail-safe with domain transaction policy (either both domain change and event succeed, or both fail).

## 5.1 Mandatory Transition-to-Event Baseline (Release-Critical)

| Domain Transition | Required Event Type |
|---|---|
| `Registration: Pending -> Accepted/Rejected/Cancelled; Accepted -> Rejected/Cancelled/NoShow` | `registration_status_changed` |
| `WaitlistItem: Waiting -> Converted/Cancelled` | `waitlist_status_changed` |
| `Payment: NotPaid/Partial/Paid` changes | `payment_status_changed` |
| `Payment: Pending -> Paid` | `payment.succeeded` |
| `Payment: Pending -> Failed` | `payment.failed` |
| `Payment: Paid -> Refunded` | `payment.refunded` |
| Registration created | `registration_created` |
| Waitlist item created | `waitlist_item_created` |

If any release-critical transition occurs without its required event, the build must fail contract gate checks.
All transitions—including non-happy paths—must map to events. Composite transitions MAY map to multiple events if explicitly documented.

---

## 6. Acceptance Criteria

- `AC-AUDIT-001`: Registration transition `Pending -> Accepted` creates one `registration_status_changed` event.
- `AC-AUDIT-002`: Event stores actor, old value, new value, and timestamp.
- `AC-AUDIT-003`: Event retrieval enforces tenant boundary.
- `AC-AUDIT-004`: Event records cannot be updated through public operational endpoints.

---

## 7. Traceability

- `SR-NFR-002` -> auditable transitions
- `SR-NFR-001` -> tenant-scoped event model
- `SR-FR-003` -> operational visibility dependency on reliable status history

Related clarifications:
- `docs/40-clarifications/clarifications_backlog.md` (`CLAR-027`, `CLAR-029`, `CLAR-028`)

---

## Changelog

- 2026-04-30: Synced registration transition baseline with runtime state machine (`Pending -> Accepted/Rejected/Cancelled`, `Accepted -> Rejected/Cancelled/NoShow`).
- 2026-04-28: Added release-critical transition-to-event baseline mapping table.
- 2026-04-28: Added explicit traceability links to audit/event clarification items.
- 2026-04-28: Updated mandatory audit gate-fail rule and non-happy-path/composite event mapping semantics. — Decision Source: CLAR-027/CLAR-029 — 2026-04-28
