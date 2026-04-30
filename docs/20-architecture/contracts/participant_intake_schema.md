Document-ID: MKT-DOC-ANALYSIS-STEP-04A
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 04-A: Participant Intake Schema

## 1. Purpose

Define the minimum canonical participant intake schema required to satisfy Step-03 requirements, especially `SR-FR-002`.

---

## 2. Scope

Applies to registration creation/update payloads in both access modes:

- Telegram Mini App mode
- Standalone web mode

---

## 3. Canonical Field Schema (MVP)

## 3.1 Required Fields

| Field | Type | Validation | Notes |
|---|---|---|---|
| `tenant_id` | UUID/string | MUST be present and valid | Tenant scope boundary |
| `tour_id` | UUID/string | MUST be present and valid | Target tour |
| `participant_full_name` | string | MUST be non-empty; min length 3 | Human-identifiable label |
| `participant_contact_phone` | string | MUST match phone format policy | Primary contact |
| `transport_mode` | enum | MUST be one of `self_vehicle`, `group_vehicle`, `other` | Needed for operational planning |
| `entry_mode` | enum | MUST be one of `telegram`, `web` | Dual-mode trace |

## 3.2 Conditional Fields

| Field | Type | Condition | Notes |
|---|---|---|---|
| `telegram_user_id` | string | REQUIRED when `entry_mode=telegram` | Identity continuity |
| `telegram_username` | string | OPTIONAL | Discovery/ops convenience |
| `vehicle_seat_capacity` | integer | OPTIONAL, valid only if participant is driver | Metadata only in MVP |
| `participant_note` | string | OPTIONAL | Free note, bounded length |

## 3.3 System-Assigned Fields (Not User Input)

| Field | Type | Rule |
|---|---|---|
| `registration_id` | UUID/string | Assigned by system |
| `registration_status` | enum | Initial MUST be `Pending` |
| `payment_status` | enum | Initial MUST be `NotPaid` |
| `created_at` | datetime | System clock |
| `updated_at` | datetime | System clock |

---

## 4. Validation Rules

- `INTAKE-VAL-001`: Request MUST be rejected if any required field is missing.
- `INTAKE-VAL-002`: Request MUST be rejected if `entry_mode=telegram` and `telegram_user_id` is absent.
- `INTAKE-VAL-003`: Unknown enum values MUST be rejected.
- `INTAKE-VAL-004`: Extra unrecognized fields SHOULD be ignored or explicitly rejected by API policy (must be consistent).
- `INTAKE-VAL-005`: Input normalization SHOULD trim whitespace for string fields before validation.

## 4.1 Backend Processing Notes

- Tenant mismatch between trusted request context and payload `tenant_id` MUST be fail-closed.
- `tenant_id` provided by client payload is treated as asserted scope and MUST be verified against trusted context.
- Unknown-field policy: STRICT REJECT across all channels and API versions. Incoming payloads with unknown top-level fields must be rejected; record the rejection in intake logs.

---

## 5. Acceptance Criteria

- `AC-INTAKE-001`: Valid payload creates `Pending` registration with `NotPaid` payment status.
- `AC-INTAKE-002`: Missing required field returns structured validation error.
- `AC-INTAKE-003`: Telegram-mode payload without `telegram_user_id` fails validation.
- `AC-INTAKE-004`: Enum violations return deterministic error codes/messages.

---

## 6. Traceability

- `SR-FR-002` -> mandatory field enforcement
- `SR-FR-008` -> dual-mode field `entry_mode`
- `SR-FR-009` -> Telegram identity condition
- `SR-NFR-001` -> tenant boundary via required `tenant_id`

Related clarifications:
- `docs/40-clarifications/clarifications_backlog.md` (`CLAR-001`, `CLAR-005`, `CLAR-034`)

---

## Changelog

- 2026-04-28: Added backend processing notes for tenant mismatch fail-closed handling.
- 2026-04-28: Added explicit clarification linkage for unknown-field policy freeze dependency.
- 2026-04-28: Replaced unknown-field pending note with strict reject policy and intake-log requirement. — Decision Source: CLAR-034 — 2026-04-28
