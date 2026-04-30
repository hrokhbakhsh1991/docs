# Wireflows Must-Have Journeys v2

Document-ID: MKT-DOC-WIREFLOWS-MUST-HAVE-V2  
Version: v1.0  
Status: Active  
Owner: Product Documentation Team  
Last-Updated: 2026-04-28  
Language: English  
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Purpose

Formalize end-to-end wireflows for P0 UX journeys with strict FE/BE contract alignment.

## A) Wireflow Coverage Matrix

| Journey ID | Use Case | Screen IDs | Flow Doc | Endpoint Touchpoints | Coverage Status |
|---|---|---|---|---|---|
| `J-L-01` | `L-01` Create/publish tour | `S-LEAD-02 -> S-LEAD-03 -> S-LEAD-02` | `flows/capacity_management` | `POST /api/v2/tours`, `PATCH /api/v2/tours/{tour_id}` | Covered |
| `J-L-02` | `L-02` Review pending registrations | `S-LEAD-01 -> S-LEAD-04 -> S-LEAD-04` | `flows/registration` | `GET /api/v2/dashboard/leader-workspace`, `GET /api/v2/registrations/{registrationId}`, `PATCH /api/v2/registrations/{registrationId}/status` | Covered |
| `J-L-03` | `L-03` Manage accepted capacity | `S-LEAD-04 -> S-LEAD-05 -> S-LEAD-04` | `flows/capacity_management`, `flows/waitlist` | `PATCH /api/v2/registrations/{registrationId}/status`, `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | Covered |
| `J-L-04` | `L-04` Record payment status | `S-LEAD-04 -> S-LEAD-06 -> S-LEAD-06` | `flows/cost_and_payment` | `PATCH /api/v2/registrations/{registrationId}/payment`, `GET /api/v2/registrations/{registrationId}` | Covered |
| `J-L-05` | `L-05` Reconcile payment state | `S-LEAD-06 -> S-LEAD-06` | `flows/cost_and_payment` | `GET /api/v2/dashboard/leader-workspace`, `GET /api/v2/reconciliation/export.csv` | Covered |
| `J-P-01` | `P-01` Open tour and register | `S-PART-01 -> S-PART-02 -> S-PART-03` | `flows/registration` | `POST /api/v2/registrations`, `GET /api/v2/registrations/{registrationId}` | Covered |
| `J-P-02` | `P-02` Track registration status | `S-PART-03` | `flows/registration` | `GET /api/v2/registrations/{registrationId}` | Covered |
| `J-P-03` | `P-03` Follow payment status | `S-PART-03 -> S-PART-04` | `flows/cost_and_payment` | `GET /api/v2/registrations/{registrationId}` | Covered |
| `J-I-01` | `I-01` Telegram entry | `S-ID-01 -> S-PART-01` | `flows/telegram_integration` | `POST /api/v2/auth/telegram/session` | Covered |
| `J-I-02` | `I-02` Web entry without Telegram | `S-ID-02 -> S-PART-01` | `flows/telegram_integration` | `POST /api/v2/auth/web/session` | Covered |
| `J-I-03` | `I-03` Connect Telegram post-onboarding | `S-ID-02 -> S-ID-03 -> S-PART-03` | `flows/telegram_integration` | `POST /api/v2/auth/link-telegram` | Covered |

## Wireflows (Detailed)

### J-L-01 (L-01)
- **Actors / entry mode:** Leader, web mode.
- **Preconditions:** Authenticated leader session in tenant scope.
- **Ordered transitions:**
  1. `S-LEAD-02` -> open create action.
  2. `S-LEAD-03` -> submit tour form.
  3. `S-LEAD-02` -> list refresh with new/updated tour.
- **Trigger/action per step:** click create/edit, fill form, submit.
- **Backend touchpoints:**
  - `POST /api/v2/tours` success: `201` with `tour_id`.
  - `PATCH /api/v2/tours/{tour_id}` success: `200` updated projection.
  - primary errors: `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_SCOPE_FORBIDDEN`, `VALIDATION_REQUIRED_FIELD_MISSING`, `CONCURRENCY_CONFLICT`.
- **Alternate/error branches:** validation error stays on `S-LEAD-03`; forbidden/tenant error -> permission-denied view.
- **Completion condition:** tour appears in tenant-scoped list.

### J-L-02 (L-02)
- **Actors / entry mode:** Leader, web mode.
- **Preconditions:** Pending registrations exist.
- **Ordered transitions:**
  1. `S-LEAD-01` -> open pending queue.
  2. `S-LEAD-04` -> open item details.
  3. `S-LEAD-04` -> apply `Accepted`/`Rejected`/`Cancelled`.
- **Trigger/action:** open queue, select request, click action.
- **Backend touchpoints:**
  - `GET /api/v2/dashboard/leader-workspace` success: queue summary.
  - `GET /api/v2/registrations/{registrationId}` success: detail projection.
  - `PATCH /api/v2/registrations/{registrationId}/status` success: `old_status/new_status`.
  - primary errors: `RESOURCE_NOT_FOUND`, `STATE_TRANSITION_INVALID`, `CAPACITY_FULL`, `TENANT_SCOPE_FORBIDDEN`, `CONCURRENCY_CONFLICT`.
- **Alternate/error branches:** capacity full when accepting -> remain in queue with conflict banner.
- **Completion condition:** selected registration reaches target status and queue summary updates.

### J-L-03 (L-03)
- **Actors / entry mode:** Leader, web mode.
- **Preconditions:** Tour and capacity context exists.
- **Ordered transitions:**
  1. `S-LEAD-04` -> accept/cancel action affecting capacity.
  2. `S-LEAD-05` -> inspect capacity and waitlist queue.
  3. `S-LEAD-04` -> optional converted participant appears in registration path.
- **Trigger/action:** accept/release seat, run convert on earliest eligible waitlist item.
- **Backend touchpoints:**
  - `PATCH /api/v2/registrations/{registrationId}/status`.
  - `POST /api/v2/waitlist-items/{waitlistItemId}/convert`.
  - primary errors: `CAPACITY_FULL`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `STATE_TRANSITION_INVALID`, `CONCURRENCY_CONFLICT`.
- **Alternate/error branches:** conversion conflict keeps `Waiting` and shows conflict guidance.
- **Completion condition:** capacity reflects accepted count and waitlist conversion is consistent.

### J-L-04 (L-04)
- **Actors / entry mode:** Leader, web mode.
- **Preconditions:** Target registration exists in tenant scope.
- **Ordered transitions:**
  1. `S-LEAD-04` -> open payment action for registration.
  2. `S-LEAD-06` -> submit payment status/amount.
  3. `S-LEAD-06` -> updated payment distribution and record shown.
- **Trigger/action:** set `NotPaid|Partial|Paid`, optional amount update.
- **Backend touchpoints:**
  - `PATCH /api/v2/registrations/{registrationId}/payment` success: updated payment projection.
  - `GET /api/v2/registrations/{registrationId}` for latest state.
  - primary errors: `PAYMENT_STATUS_TRANSITION_INVALID`, `VALIDATION_ENUM_INVALID`, `TENANT_SCOPE_FORBIDDEN`, `CONCURRENCY_CONFLICT`.
- **Alternate/error branches:** invalid amount/status -> inline validation, no transition.
- **Completion condition:** payment status persists and is visible in panel.

### J-L-05 (L-05)
- **Actors / entry mode:** Leader, web mode.
- **Preconditions:** Leader has at least one tour in tenant scope.
- **Ordered transitions:**
  1. `S-LEAD-06` -> load aggregated payment/reconciliation data.
  2. `S-LEAD-06` -> trigger export CSV.
- **Trigger/action:** open panel, click export.
- **Backend touchpoints:**
  - `GET /api/v2/dashboard/leader-workspace` success: summaries.
  - `GET /api/v2/reconciliation/export.csv` success: CSV file stream.
  - primary errors: `EXPORT_SNAPSHOT_INCONSISTENT`, `RESOURCE_NOT_FOUND`, `TENANT_SCOPE_FORBIDDEN`.
- **Alternate/error branches:** snapshot conflict -> retry option on same screen.
- **Completion condition:** export generated with canonical headers.

### J-P-01 (P-01)
- **Actors / entry mode:** Participant, telegram/web mode.
- **Preconditions:** User enters leader-specific context.
- **Ordered transitions:**
  1. `S-PART-01` -> click register CTA.
  2. `S-PART-02` -> submit intake form.
  3. `S-PART-03` -> show initial `Pending` status.
- **Trigger/action:** open tour details, complete form, submit.
- **Backend touchpoints:**
  - `POST /api/v2/registrations` success: `registration_id`, `registration_status=Pending`.
  - `GET /api/v2/registrations/{registrationId}` for status render.
  - primary errors: `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_ENUM_INVALID`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `REGISTRATION_DUPLICATE_ACTIVE`, `CAPACITY_FULL`, `TENANT_SCOPE_CONFLICT`.
- **Alternate/error branches (explicit waitlist formalization):**
  - `CAPACITY_FULL` at `S-PART-02` -> render blocking waitlist CTA.
  - user action: choose waitlist enrollment from same context.
  - endpoint touchpoint: `POST /api/v2/waitlist-items` with `tenant_id`, `tour_id`, `user_id`.
  - success outcome: waitlist enrollment acknowledged in same participant context; user keeps status awareness path via `S-PART-03`.
  - failure outcome: `WAITLIST_CONFLICT_ACTIVE_RECORD` or `TENANT_SCOPE_CONFLICT` keeps user on `S-PART-02` error state with corrective guidance.
- **Completion condition:** participant has visible registration status record.

### J-P-02 (P-02)
- **Actors / entry mode:** Participant, telegram/web mode.
- **Preconditions:** Existing registration.
- **Ordered transitions:**
  1. `S-PART-03` -> poll/refresh status.
  2. `S-PART-03` -> reflect `Pending|Accepted|Rejected|Cancelled|NoShow`.
- **Trigger/action:** open status view, refresh.
- **Backend touchpoints:**
  - `GET /api/v2/registrations/{registrationId}`.
  - primary errors: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`.
- **Alternate/error branches:** forbidden/not-found -> permission-denied/error state.
- **Completion condition:** current canonical registration status is rendered.

### J-P-03 (P-03)
- **Actors / entry mode:** Participant, telegram/web mode.
- **Preconditions:** Existing registration.
- **Ordered transitions:**
  1. `S-PART-03` -> navigate to payment status view.
  2. `S-PART-04` -> render `NotPaid|Partial|Paid`.
- **Trigger/action:** open payment status section.
- **Backend touchpoints:**
  - `GET /api/v2/registrations/{registrationId}` success includes `payment_status`.
  - primary errors: `AUTH_UNAUTHENTICATED`, `TENANT_SCOPE_FORBIDDEN`, `RESOURCE_NOT_FOUND`.
- **Alternate/error branches:** unavailable data -> error/retry state on `S-PART-04`.
- **Completion condition:** participant sees canonical payment status.

### J-I-01 (I-01)
- **Actors / entry mode:** Participant, Telegram mode.
- **Preconditions:** Telegram init context present.
- **Ordered transitions:**
  1. `S-ID-01` -> submit Telegram session bootstrap.
  2. `S-PART-01` -> load tenant-scoped tour details.
- **Trigger/action:** Telegram launch/continue.
- **Backend touchpoints:**
  - `POST /api/v2/auth/telegram/session` success returns session + tenant context.
  - primary errors: `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_CONFLICT`.
- **Alternate/error branches:** invalid Telegram context keeps user on `S-ID-01` with retry-after-action guidance.
- **Completion condition:** authenticated Telegram session established.

### J-I-02 (I-02)
- **Actors / entry mode:** Participant, web mode.
- **Preconditions:** User has valid web credential flow.
- **Ordered transitions:**
  1. `S-ID-02` -> submit sign-in/sign-up.
  2. `S-PART-01` -> load leader-scoped tour details.
- **Trigger/action:** credential submission.
- **Backend touchpoints:**
  - `POST /api/v2/auth/web/session`.
  - primary errors: `AUTH_UNAUTHENTICATED`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_CONFLICT`.
- **Alternate/error branches:** authentication failure remains on `S-ID-02`.
- **Completion condition:** web session created in tenant scope.

### J-I-03 (I-03)
- **Actors / entry mode:** Participant, web mode (post-onboarding).
- **Preconditions:** Authenticated web session exists.
- **Ordered transitions:**
  1. `S-ID-02` -> navigate to connect action.
  2. `S-ID-03` -> submit Telegram linking.
  3. `S-PART-03` -> return to operational journey with linked identity.
- **Trigger/action:** click connect, confirm link.
- **Backend touchpoints:**
  - `POST /api/v2/auth/link-telegram` success returns `link_status=Linked`.
  - primary errors: `AUTH_UNAUTHENTICATED`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`, `TENANT_SCOPE_CONFLICT`, `STATE_TRANSITION_INVALID`, `CONCURRENCY_CONFLICT`.
- **Alternate/error branches:** conflict/invalid state remains on `S-ID-03` with retry guidance.
- **Completion condition:** account linking completed without tenant violation.

## D) Endpoint Error -> UI Handling Crosswalk (Uniform)

| Journey ID | Endpoint | Critical Error Code | Resulting UI State | User-Facing Action |
|---|---|---|---|---|
| `J-L-01` | `POST /api/v2/tours`, `PATCH /api/v2/tours/{tour_id}` | `AUTH_FORBIDDEN_ROLE` | `permission_denied` on `S-LEAD-03` | show access warning; return to tenant dashboard |
| `J-L-01` | `POST /api/v2/tours`, `PATCH /api/v2/tours/{tour_id}` | `VALIDATION_REQUIRED_FIELD_MISSING` | `error` on `S-LEAD-03` | inline required-field errors; resubmit |
| `J-L-02` | `PATCH /api/v2/registrations/{registrationId}/status` | `CAPACITY_FULL` | `error` on `S-LEAD-04` | show capacity conflict banner; refresh queue |
| `J-L-03` | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `WAITLIST_CONFLICT_ACTIVE_RECORD` | `error` on `S-LEAD-05` | show conflict guidance; retry later |
| `J-L-04` | `PATCH /api/v2/registrations/{registrationId}/payment` | `PAYMENT_STATUS_TRANSITION_INVALID` | `error` on `S-LEAD-06` | correct payment state/amount and resubmit |
| `J-L-05` | `GET /api/v2/reconciliation/export.csv` | `EXPORT_SNAPSHOT_INCONSISTENT` | `error` on `S-LEAD-06` | retry export with fresh snapshot |
| `J-P-01` | `POST /api/v2/registrations` | `AUTH_TELEGRAM_CONTEXT_REQUIRED` | `error` on `S-PART-02` | recover auth context then retry |
| `J-P-01` | `POST /api/v2/registrations` | `CAPACITY_FULL` | `error` on `S-PART-02` | choose waitlist enrollment action |
| `J-P-01` | `POST /api/v2/waitlist-items` | `WAITLIST_CONFLICT_ACTIVE_RECORD` | `error` on `S-PART-02` | resolve duplicate/conflict and retry |
| `J-P-02` | `GET /api/v2/registrations/{registrationId}` | `TENANT_SCOPE_FORBIDDEN` | `permission_denied` on `S-PART-03` | show tenant denial; stop protected action |
| `J-P-03` | `GET /api/v2/registrations/{registrationId}` | `RESOURCE_NOT_FOUND` | `error` on `S-PART-04` | show not-found guidance; manual refresh |
| `J-I-01` | `POST /api/v2/auth/telegram/session` | `TENANT_CONTEXT_MISSING` | `error` on `S-ID-01` | show context recovery guidance; retry after action |
| `J-I-02` | `POST /api/v2/auth/web/session` | `AUTH_UNAUTHENTICATED` | `error` on `S-ID-02` | re-enter credentials and retry |
| `J-I-03` | `POST /api/v2/auth/link-telegram` | `STATE_TRANSITION_INVALID` | `error` on `S-ID-03` | resolve linking precondition and retry |
| `J-I-03` | `POST /api/v2/auth/link-telegram` | `TENANT_SCOPE_CONFLICT` | `permission_denied` on `S-ID-03` | stop action and return to tenant-safe path |

## C) Ambiguity Register

| ID | Ambiguity | Severity | Proposed Owner | Resolution Status |
|---|---|---|---|---|
| None | No P0 ambiguity remains after endpoint/state formalization in this phase. | N/A | N/A | Closed |

## Self-Check

- must-have journeys covered count / required count: `11 / 11`
- critical screens with 5-state coverage count / required count: `13 / 13` (defined in `screen_state_spec_v2.md`)
- unresolved P0 ambiguities count (target: 0): `0`
