# Form Validation UX Contract v2

Document-ID: MKT-DOC-FORM-VALIDATION-UX-CONTRACT-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-28  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Purpose

Define deterministic frontend/backend validation semantics for P1-critical form and action inputs, aligned with canonical endpoint contracts and error taxonomy.

## Normative Interpretation (BCP 14)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

## Validation Semantics Baseline

- FE MUST perform pre-submit validation for required/format/enum/conditional rules.
- BE remains authoritative and MUST re-validate all inputs.
- FE MUST map server error envelope (`error.code`, `error.details.field_errors`) to deterministic UI behavior.
- Unknown top-level fields MUST be treated as blocking errors (`VALIDATION_UNKNOWN_FIELD`) and MUST NOT be silently ignored.
- Retry behavior MUST follow `retryability` from `docs/20-architecture/contracts/error_response_taxonomy_v2.md`.

## Message Key Strategy (Localization-Safe)

- FE MUST use stable message keys, not raw backend text, for localized rendering.
- Required naming:
  - `validation.required.<field>`
  - `validation.format.<field>`
  - `validation.enum.<field>`
  - `validation.conditional.<field>`
  - `error.code.<ERROR_CODE>`
- Example:
  - `error.code.VALIDATION_REQUIRED_FIELD_MISSING`
  - `validation.conditional.telegram_user_id`

## UI Handling Policy

- **inline**: field-specific validation errors where `details.field_errors` pinpoints field.
- **banner**: non-field operation errors that still allow user on same screen.
- **blocking**: tenant/authz/authentication violations that prevent current action/screen.

## Retry and Recovery Policy by Retryability

- `NO_RETRY`: user must fix data or permissions; show inline/banner with corrective action.
- `SAFE_RETRY`: show retry CTA; one immediate retry allowed without full form reset.
- `RETRY_WITH_BACKOFF`: background or user-driven retry with exponential backoff.
- `RETRY_AFTER_ACTION`: require user action first (login/re-auth/link/refresh context), then retry.

## A) Validation Rule Matrix (Field -> Rule -> Error Code -> UI Handling -> Endpoint)

| Field / Input | Rule Type | Validation Rule | Canonical Error Code(s) | UI Handling | Endpoint |
|---|---|---|---|---|---|
| `tenant_id` | required + scope | MUST be present and match trusted tenant context | `VALIDATION_REQUIRED_FIELD_MISSING`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN` | inline for missing; blocking for tenant violations | `POST /api/v2/registrations`, `POST /api/v2/waitlist-items` |
| `tour_id` | required + format | MUST be present and valid identifier | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_FIELD_FORMAT_INVALID`, `RESOURCE_NOT_FOUND` | inline for field; banner for not-found | `POST /api/v2/registrations`, `POST /api/v2/waitlist-items`, `GET /api/v2/reconciliation/export.csv` |
| `participant_full_name` | required + range | MUST be non-empty and min length 3 | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_FIELD_FORMAT_INVALID` | inline | `POST /api/v2/registrations` |
| `participant_contact_phone` | required + format | MUST match canonical phone format | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_FIELD_FORMAT_INVALID` | inline | `POST /api/v2/registrations` |
| `transport_mode` | enum | MUST be one of `self_vehicle`, `group_vehicle`, `other` | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID` | inline | `POST /api/v2/registrations` |
| `entry_mode` | enum + conditional trigger | MUST be `telegram` or `web`; drives conditional fields | `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID` | inline | `POST /api/v2/registrations`, `POST /api/v2/auth/telegram/session`, `POST /api/v2/auth/web/session/otp` |
| `telegram_user_id` | conditional required | REQUIRED when `entry_mode=telegram` | `VALIDATION_REQUIRED_FIELD_MISSING`, `AUTH_TELEGRAM_CONTEXT_REQUIRED` | inline for missing field; blocking for auth context failure | `POST /api/v2/registrations` |
| `telegram_username` | optional format | if provided, MUST match allowed username pattern | `VALIDATION_FIELD_FORMAT_INVALID` | inline | `POST /api/v2/registrations` |
| `vehicle_seat_capacity` | conditional range | OPTIONAL; if provided MUST be positive integer in allowed range | `VALIDATION_FIELD_FORMAT_INVALID` | inline | `POST /api/v2/registrations` |
| `participant_note` | optional range | OPTIONAL bounded-length string | `VALIDATION_FIELD_FORMAT_INVALID` | inline | `POST /api/v2/registrations` |
| unknown top-level payload fields | schema strictness | MUST be rejected | `VALIDATION_UNKNOWN_FIELD` | blocking banner on submit | all mutation endpoints |
| `target_status` | enum + transition guard | MUST be one of `Accepted|Rejected|Cancelled|NoShow` and valid from current state | `VALIDATION_ENUM_INVALID`, `STATE_TRANSITION_INVALID`, `CAPACITY_FULL` | inline for enum; banner for transition/capacity conflicts | `PATCH /api/v2/registrations/{registrationId}/status` |
| `payment_status` | canonical enum | MUST be one of `NotPaid|Partial|Paid` | `VALIDATION_ENUM_INVALID`, `PAYMENT_STATUS_TRANSITION_INVALID` | inline for enum; banner for transition conflict | `PATCH /api/v2/registrations/{registrationId}/payment` |
| `paid_amount` | range/consistency | MUST NOT be negative; MUST align with payment algebra | `VALIDATION_FIELD_FORMAT_INVALID`, `PAYMENT_STATUS_TRANSITION_INVALID` | inline + banner if algebra conflict | `PATCH /api/v2/registrations/{registrationId}/payment` |
| `conversion_reason` | enum + guard | MUST be `capacity_available` or `manual_override`; conversion only from `Waiting` | `VALIDATION_ENUM_INVALID`, `STATE_TRANSITION_INVALID`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `CAPACITY_FULL` | inline for enum; banner for conflicts | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` |
| `cancel_reason` | required | MUST be present for cancellation command | `VALIDATION_REQUIRED_FIELD_MISSING`, `STATE_TRANSITION_INVALID` | inline + banner | `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` |
| `snapshot_at` | optional format | if provided, MUST be valid datetime and consistent with export semantics | `VALIDATION_FIELD_FORMAT_INVALID`, `EXPORT_SNAPSHOT_INCONSISTENT` | inline for datetime format; banner for snapshot consistency | `GET /api/v2/reconciliation/export.csv` |
| `Idempotency-Key` header | consistency | replay with different payload MUST fail | `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | banner + blocking submit retry | create/update/convert endpoints |

## Endpoint Linkage

- Intake field rules and conditional requirements align with:
  - `docs/20-architecture/contracts/participant_intake_schema.md`
  - `POST /api/v2/registrations` contract in `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- Error semantics align with:
  - `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
- AuthZ/tenant fail-closed expectations align with:
  - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`

## B) Edge-Aware Validation Hooks (for FE test derivation)

- `SR-FR-002`: missing required, invalid enums, unknown fields, conditional Telegram field.
- `SR-FR-004`: payment enum and amount consistency.
- `SR-FR-005`: conversion input guard plus conflict codes.
- `SR-FR-008/009/010`: mode-aware auth and linking validation paths.
- `SR-NFR-001`: tenant mismatch/missing context as blocking conditions.

## C) Conflict Resolution Notes

1. Unknown-field ambiguity is resolved as **strict reject** (`VALIDATION_UNKNOWN_FIELD`) for all channels and versions.
2. Field validation responsibility is split deterministically:
   - FE: immediate UX feedback.
   - BE: authoritative gate and canonical error code emission.
3. Telegram conditional validation is resolved as:
   - data-level (`telegram_user_id` required when `entry_mode=telegram`)
   - context-level (`AUTH_TELEGRAM_CONTEXT_REQUIRED` when trusted Telegram identity missing/invalid).

## D) Residual Risks

- **Risk-01 (Medium):** Phone format policy is referenced but not expanded into regex profile in current contracts; test suites must freeze one format profile before implementation.
- **Risk-02 (Low):** Optional fields (`participant_note`, `telegram_username`) may need exact max-length constants in implementation spec for strict parity across FE/BE.

## Self-Check

- validation rules with endpoint mapping count: `17`
- edge cases with full mapping (req+endpoint+test) count: `0` (tracked in `docs/20-architecture/flows/edge_cases_and_failure_paths_v2.md`)
- contradictions found with existing contracts: `0`
