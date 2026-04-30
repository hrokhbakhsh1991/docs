# Screen State Specification v2 (P0 UX Core)

Document-ID: MKT-DOC-SCREEN-STATE-SPEC-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-28  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Purpose

Define mandatory UI states for critical screens and map each state to canonical backend outcomes and error taxonomy.

Mandatory states for each critical screen:
- `loading`
- `empty`
- `success`
- `error`
- `permission_denied`

## Critical Screen Set (P0)

- `S-LEAD-01`, `S-LEAD-02`, `S-LEAD-03`, `S-LEAD-04`, `S-LEAD-05`, `S-LEAD-06`
- `S-PART-01`, `S-PART-02`, `S-PART-03`, `S-PART-04`, `S-PART-05`
- `S-ID-01`, `S-ID-02`, `S-ID-03`

## State Spec Per Screen

### S-LEAD-01 (Leader Dashboard)
- `loading`: render skeleton for summary cards; actions disabled; auto fetch in-flight.
- `empty`: show "no tours/no operations yet"; actions: go to `S-LEAD-02`; retry: manual refresh; mapped codes: none.
- `success`: show registration/payment/capacity summary; actions: open queue/panel; retry: refresh button; mapped codes impact: none.
- `error`: render non-blocking error banner with retry; mapped codes: `INTERNAL_ERROR`, `DEPENDENCY_TEMPORARY_UNAVAILABLE`, `VALIDATION_REQUIRED_FIELD_MISSING`.
- `permission_denied`: block panel and show tenant/role warning; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_CONTEXT_MISSING`.

### S-LEAD-02 (Tour List)
- `loading`: list skeleton.
- `empty`: no tour rows + create CTA; retry: refresh.
- `success`: tenant-scoped list visible; actions: create/edit tour.
- `error`: inline list error + retry; mapped codes: `INTERNAL_ERROR`, `DEPENDENCY_TEMPORARY_UNAVAILABLE`.
- `permission_denied`: role/tenant denied message; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`.

### S-LEAD-03 (Tour Editor)
- `loading`: form shell while edit context loads.
- `empty`: create mode form with defaults.
- `success`: save confirmation + redirect option to list.
- `error`: field/global errors; mapped codes: `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `VALIDATION_FIELD_FORMAT_INVALID`, `VALIDATION_UNKNOWN_FIELD`, `CONCURRENCY_CONFLICT`.
- `permission_denied`: form locked; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`, `AUTH_UNAUTHENTICATED`.

### S-LEAD-04 (Registration Queue)
- `loading`: queue skeleton and action placeholders.
- `empty`: no pending requests message.
- `success`: queue rows with status action controls.
- `error`: operation error banner per row/global; mapped codes: `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `CAPACITY_FULL`, `CONCURRENCY_CONFLICT`.
- `permission_denied`: queue hidden/disabled; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`.

### S-LEAD-05 (Capacity and Waitlist Panel)
- `loading`: capacity counters and queue skeleton.
- `empty`: no waitlist items but capacity card visible.
- `success`: capacity + waitlist table + convert/cancel actions.
- `error`: conflict/operation errors; mapped codes: `WAITLIST_CONFLICT_ACTIVE_RECORD`, `CAPACITY_FULL`, `STATE_TRANSITION_INVALID`, `CONCURRENCY_CONFLICT`.
- `permission_denied`: actions removed; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`.

### S-LEAD-06 (Payment Tracking Panel)
- `loading`: payment distribution and table skeleton.
- `empty`: no payment records with guidance text.
- `success`: payment states + export action visible.
- `error`: update/export errors shown with retry path; mapped codes: `PAYMENT_STATUS_TRANSITION_INVALID`, `EXPORT_SNAPSHOT_INCONSISTENT`, `CONCURRENCY_CONFLICT`, `INTERNAL_ERROR`.
- `permission_denied`: panel read/write blocked; mapped codes: `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`.

### S-PART-01 (Leader-Specific Tour Details)
- `loading`: tour details skeleton.
- `empty`: tour unavailable/closed message.
- `success`: tour details + register CTA.
- `error`: fetch failure message + retry; mapped codes: `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`.
- `permission_denied`: access denied for tenant context; mapped codes: `TENANT_SCOPE_FORBIDDEN`, `TENANT_CONTEXT_MISSING`.

### S-PART-02 (Registration Form)
- `loading`: form initializing.
- `empty`: blank form ready to fill.
- `success`: submit accepted then transition to `S-PART-03`.
- `error`: inline and top-level form errors; mapped codes: `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `VALIDATION_FIELD_FORMAT_INVALID`, `VALIDATION_UNKNOWN_FIELD`, `REGISTRATION_DUPLICATE_ACTIVE`, `CAPACITY_FULL`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`.
- `permission_denied`: submission disabled; mapped codes: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_SCOPE_CONFLICT`.

### S-PART-03 (Registration Status View)
- `loading`: status card skeleton.
- `empty`: no registration found guidance.
- `success`: canonical status `Pending|Accepted|Rejected|Cancelled|NoShow` rendered.
- `error`: read failure with retry action; mapped codes: `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`.
- `permission_denied`: restricted status view; mapped codes: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`.

### S-PART-04 (Payment Status View)
- `loading`: payment status skeleton.
- `empty`: no payment state recorded yet.
- `success`: canonical status `NotPaid|Partial|Paid` rendered.
- `error`: fetch failure with retry; mapped codes: `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`.
- `permission_denied`: payment panel denied; mapped codes: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`.

### S-PART-05 (Communication Access View)
- `loading`: communication access card skeleton while eligibility is resolved.
- `empty`: no communication link yet because participant is not in accepted eligibility path; actions: return to `S-PART-03`; retry: manual refresh eligibility.
- `success`: accepted-only communication link is visible and actionable; actions: open link, copy link; retry: refresh eligibility snapshot.
- `error`: link-resolution error banner with retry; mapped codes: `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `INTERNAL_ERROR`.
- `permission_denied`: access blocked for non-accepted, auth, or tenant violations; mapped codes: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_CONTEXT_MISSING`, `AUTH_FORBIDDEN_ROLE`.

### S-ID-01 (Telegram Session Entry)
- `loading`: verifying Telegram context.
- `empty`: no Telegram context prompt.
- `success`: session established and route to `S-PART-01`.
- `error`: auth/validation failure with recovery hints; mapped codes: `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_MISSING`.
- `permission_denied`: blocked due to tenant policy; mapped codes: `TENANT_SCOPE_FORBIDDEN`.

### S-ID-02 (Web Sign-In/Sign-Up)
- `loading`: auth request in-flight.
- `empty`: credential form ready.
- `success`: web session established and route to `S-PART-01`.
- `error`: auth failure with retry; mapped codes: `AUTH_UNAUTHENTICATED`, `VALIDATION_REQUIRED_FIELD_MISSING`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_MISSING`.
- `permission_denied`: web entry restricted for context; mapped codes: `TENANT_SCOPE_FORBIDDEN`.

### S-ID-03 (Connect Telegram)
- `loading`: linking request in-flight.
- `empty`: no linked telegram account yet.
- `success`: `link_status=Linked` with return path to participant flow.
- `error`: link conflict/state issues with retry; mapped codes: `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `STATE_TRANSITION_INVALID`, `CONCURRENCY_CONFLICT`, `TENANT_SCOPE_CONFLICT`.
- `permission_denied`: linking blocked by scope policy; mapped codes: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`.

## FE/BE Alignment Rules

1. No UI transition is allowed unless triggered by:
   - a successful endpoint response, or
   - an explicit user navigation action from already successful state.
2. Every endpoint result used by P0 journeys MUST map to one of the 5 mandatory states on the active screen.
3. Error handling MUST use canonical `error.code` from `docs/20-architecture/contracts/error_response_taxonomy_v2.md`.

## B) Screen State Coverage Matrix

| Screen ID | loading | empty | success | error | permission_denied | Missing States |
|---|---|---|---|---|---|---|
| `S-LEAD-01` | Yes | Yes | Yes | Yes | Yes | None |
| `S-LEAD-02` | Yes | Yes | Yes | Yes | Yes | None |
| `S-LEAD-03` | Yes | Yes | Yes | Yes | Yes | None |
| `S-LEAD-04` | Yes | Yes | Yes | Yes | Yes | None |
| `S-LEAD-05` | Yes | Yes | Yes | Yes | Yes | None |
| `S-LEAD-06` | Yes | Yes | Yes | Yes | Yes | None |
| `S-PART-01` | Yes | Yes | Yes | Yes | Yes | None |
| `S-PART-02` | Yes | Yes | Yes | Yes | Yes | None |
| `S-PART-03` | Yes | Yes | Yes | Yes | Yes | None |
| `S-PART-04` | Yes | Yes | Yes | Yes | Yes | None |
| `S-PART-05` | Yes | Yes | Yes | Yes | Yes | None |
| `S-ID-01` | Yes | Yes | Yes | Yes | Yes | None |
| `S-ID-02` | Yes | Yes | Yes | Yes | Yes | None |
| `S-ID-03` | Yes | Yes | Yes | Yes | Yes | None |

## C) Ambiguity Register

| ID | Ambiguity | Severity | Proposed Owner | Resolution Status |
|---|---|---|---|---|
| None | No P0 ambiguity remains after phase-2 formalization. | N/A | N/A | Closed |

## Self-Check

- must-have journeys covered count / required count: `11 / 11` (source: `wireflows_must_have_journeys_v2.md`)
- critical screens with 5-state coverage count / required count: `14 / 14`
- unresolved P0 ambiguities count (target: 0): `0`
