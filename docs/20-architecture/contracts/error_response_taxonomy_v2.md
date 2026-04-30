# Error Response Taxonomy v2

Document-ID: MKT-DOC-API-ERROR-TAXONOMY-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-28  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## 1. Purpose

Define one reusable and canonical error model for frontend/backend integration across all operational endpoints.

## 2. Normative Interpretation (BCP 14)

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

## 3. Canonical Error Envelope

All non-2xx responses MUST use this envelope:

```json
{
  "error": {
    "code": "TENANT_SCOPE_CONFLICT",
    "message": "Trusted tenant context conflicts with payload tenant_id.",
    "details": {
      "field_errors": [
        {
          "field": "tenant_id",
          "reason": "conflict",
          "expected": "trusted-context-tenant",
          "actual": "payload-tenant"
        }
      ],
      "request_id": "req_123",
      "trace_id": "trace_123"
    },
    "retryability": "NO_RETRY"
  }
}
```

### 3.1 Field Rules

- `error.code` MUST be one of the canonical codes in section 4.
- `error.message` MUST be user-display-safe and action-oriented.
- `error.details` MAY include structured diagnostics (`field_errors`, `request_id`, `trace_id`, `hint`).
- `error.retryability` MUST be one of:
  - `NO_RETRY`
  - `SAFE_RETRY`
  - `RETRY_WITH_BACKOFF`
  - `RETRY_AFTER_ACTION`

## 4. Canonical Error Codes

| Code | HTTP Status | Retryability | Meaning |
|---|---:|---|---|
| `VALIDATION_FAILED` | 400 | `NO_RETRY` | Request validation errors |
| `VALIDATION_REQUIRED_FIELD_MISSING` | 400 | `NO_RETRY` | Required input missing |
| `VALIDATION_ENUM_INVALID` | 400 | `NO_RETRY` | Enum value is not canonical |
| `VALIDATION_FIELD_FORMAT_INVALID` | 400 | `NO_RETRY` | Field format invalid (phone/date/etc.) |
| `VALIDATION_UNKNOWN_FIELD` | 400 | `NO_RETRY` | Unknown top-level field (strict reject) |
| `AUTH_TELEGRAM_CONTEXT_REQUIRED` | 401 | `RETRY_AFTER_ACTION` | Telegram mode request lacks valid Telegram identity |
| `AUTH_UNAUTHENTICATED` | 401 | `RETRY_AFTER_ACTION` | User is not authenticated |
| `AUTH_FORBIDDEN_ROLE` | 403 | `NO_RETRY` | Authenticated user lacks role permission |
| `TENANT_CONTEXT_INVALID` | 403 | `NO_RETRY` | Trusted tenant context is present but malformed/invalid |
| `TENANT_CONTEXT_MISSING` | 403 | `NO_RETRY` | Trusted tenant context required but absent |
| `TENANT_SCOPE_CONFLICT` | 403 | `NO_RETRY` | Trusted tenant context conflicts with asserted scope |
| `TENANT_SCOPE_FORBIDDEN` | 403 | `NO_RETRY` | Access to target tenant not permitted |
| `RESOURCE_NOT_FOUND` | 404 | `NO_RETRY` | Resource does not exist in tenant scope |
| `REGISTRATION_DUPLICATE_ACTIVE` | 409 | `NO_RETRY` | Active registration already exists for `(user_id, tour_id)` |
| `CAPACITY_FULL` | 409 | `NO_RETRY` | Acceptance blocked because capacity is full |
| `WAITLIST_CONFLICT_ACTIVE_RECORD` | 409 | `NO_RETRY` | Conversion blocked due to active registration/waitlist conflict |
| `PAYMENT_STATUS_TRANSITION_INVALID` | 409 | `NO_RETRY` | Requested payment update violates status rules |
| `STATE_TRANSITION_INVALID` | 409 | `NO_RETRY` | Requested lifecycle transition is not allowed |
| `CONCURRENCY_CONFLICT` | 409 | `SAFE_RETRY` | Concurrent update conflict detected |
| `IDEMPOTENCY_KEY_REPLAY_MISMATCH` | 409 | `NO_RETRY` | Same idempotency key reused with different payload |
| `EXPORT_SNAPSHOT_INCONSISTENT` | 409 | `SAFE_RETRY` | Export run violates snapshot consistency semantics |
| `RATE_LIMITED` | 429 | `RETRY_WITH_BACKOFF` | Request exceeds throttling policy |
| `DEPENDENCY_TEMPORARY_UNAVAILABLE` | 503 | `RETRY_WITH_BACKOFF` | Upstream dependency unavailable |
| `INTERNAL_ERROR` | 500 | `RETRY_WITH_BACKOFF` | Unexpected server error |

## 5. Frontend Handling Contract

- FE MUST branch behavior using `error.code` (stable key), not parsing `message`.
- FE SHOULD show `message` as primary feedback text.
- FE SHOULD surface `details.field_errors` inline for form errors.
- FE MUST use `retryability` to decide retry UX:
  - `NO_RETRY`: show corrective action; do not auto-retry.
  - `SAFE_RETRY`: allow immediate single retry.
  - `RETRY_WITH_BACKOFF`: exponential retry with cap.
  - `RETRY_AFTER_ACTION`: prompt user to authenticate/link/refresh context.

## 6. Endpoint Conformance Rule

Every endpoint in `docs/20-architecture/contracts/api_endpoint_contracts_v2.md` MUST:

- declare allowed error codes,
- align HTTP status values with this taxonomy,
- keep envelope shape identical.

## 7. Traceability

- `SR-FR-002` -> validation code set.
- `SR-FR-008`, `SR-FR-009`, `SR-FR-010` -> auth/identity error set.
- `SR-NFR-001` -> tenant boundary and fail-closed error set.
- `SR-NFR-002` -> transition/audit-related conflict visibility.

## 8. Mini Self-Check (Phase-1 Consistency Hardening)

- wildcard error references count: `0`
- inconsistent path param names count: `0`
- SR rows without endpoint mapping count: `0`
