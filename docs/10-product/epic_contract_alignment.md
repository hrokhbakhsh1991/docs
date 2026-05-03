# Frontend Readiness Tasks (Pre-Implementation)

Goal: Align backend (runtime + OpenAPI) with product docs (wireflows + screen specs) and fill all critical UX/API gaps before starting frontend implementation.

Status: NOT READY FOR FE YET (working through this checklist)

---

## Section A – API & Contract Alignment

### A1. Dashboard & Reconciliation Endpoints

- ID: A1
- Type: API / Contract
- Priority: HIGH
- Description:
  Wireflows J-L-02 and J-L-05 rely on:
  - GET /api/v2/dashboard/leader-workspace
  - GET /api/v2/reconciliation/export.csv
  These do NOT exist in apps/api/openapi.json.
- Options:
  1) Add these endpoints to the public API (preferred if product really needs these features now), or
  2) Rewrite the wireflows to use existing endpoints (e.g. filtered lists of registrations/tours) and drop CSV export for v1.
- Decision:
  - [ ] Decide option 1 or 2
- Tasks:
  - [ ] Update docs/10-product/wireflows_must_have_journeys_v2.md accordingly
  - [ ] Update apps/api/openapi.json (if new endpoints are added)

---

### A2. Canonical public registration flow

- ID: A2
- Type: Product / API usage
- Priority: HIGH
- Description:
  Backend runtime says:
  - Public flow uses POST /api/v2/tours/{tourId}/register
  - If capacity is available, status = Accepted (not Pending)
  Product docs in J-P-01 assume POST /api/v2/registrations and initial Pending.
- Decision:
  - [ ] Choose canonical flow for participants (public registration):
        → Most likely: POST /api/v2/tours/{tourId}/register with initial Accepted.
- Tasks:
  - [ ] Update J-P-01 in wireflows_must_have_journeys_v2.md (change Pending → Accepted for public path)
  - [ ] Update screen_state_spec_v2.md where it assumes Pending as initial state
  - [ ] Clearly document in runtime-lifecycle.md which path is canonical for FE

---

## Section B – Payment & Async UX

### B1. Payment state model (participant)

- ID: B1
- Type: UX / Spec
- Priority: HIGH
- Description:
  S-PART-04 currently uses a simplified model:
  - NotPaid / Partial / Paid
  Backend payment lifecycle includes:
  - Payment.status: Pending, Paid, Failed, Refunded, Cancelled
  - Registration.paymentStatus and status: Accepted, AcceptedPaid, Refunded, Rejected (on failure)
- Tasks:
  - [ ] Extend S-PART-04 to include:
        - "Payment Pending Confirmation" (Payment.Pending after gateway, before webhook)
        - "Payment Failed" with clear retry/recovery
        - Optional: "Refunded" state for the participant
  - [ ] Add a clear mapping table in the doc:
        Backend (Registration.status + Payment.status) → UI label on S-PART-04 / S-PART-03

---

### B2. Async payment confirmation (webhook delay)

- ID: B2
- Type: UX / Flow
- Priority: HIGH
- Description:
  Backend confirms final payment via async webhook (POST /internal/payments/webhook).
  Webhook always returns 200 even on internal errors.
  UI must not assume the payment is final immediately after redirect from the gateway.
- Tasks:
  - [ ] Define a new intermediate state in wireflows and screen_state_spec_v2.md:
        - WF-PAY-ASYNC-01: "Payment Pending Confirmation"
  - [ ] Describe polling or refresh logic (e.g. FE calls GET /api/v2/registrations/{id} every X seconds until a final state is reached or a timeout)
  - [ ] Add text copy to explain to the user:
        "Your payment was received by the gateway. We are confirming it with our system. This may take up to X seconds."

---

### B3. Payment failure and capacity release

- ID: B3
- Type: UX / Flow
- Priority: HIGH
- Description:
  When Payment.status = Failed:
  - Registration may go to Rejected
  - Capacity is released
  This is not explicitly modeled in S-PART-04 today.
- Tasks:
  - [ ] Define WF-PAY-FAIL-01 in screen_state_spec_v2.md:
        - Show failure reason (if available)
        - Tell the user what happened to their registration
        - Offer retry or go back to tour page
  - [ ] Document behavior when capacity is taken by someone else during retry.

---

## Section C – Waitlist & Capacity

### C1. Participant waitlist status screen

- ID: C1
- Type: UX / New Screen
- Priority: HIGH
- Description:
  Backend waitlist states: Waiting → Converted/Cancelled.
  Participant currently has no dedicated waitlist status page/screen.
- Tasks:
  - [ ] Add a new conceptual screen to screens_overview.md:
        - WF-WAITLIST-STATUS-01
  - [ ] In screen_state_spec_v2.md, define states for:
        - Waiting (with optional queue position)
        - Converted (and next steps, e.g. payment)
        - Cancelled
  - [ ] Align J-P-* flows to include this screen after waitlist registration.

---

### C2. Capacity race condition (seat lost during submit)

- ID: C2
- Type: UX / Error State
- Priority: MEDIUM
- Description:
  Backend may return CAPACITY_FULL or a concurrency conflict at submit time.
  Current UX only has a generic CAPACITY_FULL error.
- Tasks:
  - [ ] Add WF-RACE-CAPACITY-01 to screen_state_spec_v2.md:
        - Dedicated message like: "The last seat was just taken while you were submitting."
        - Clear CTA: "Join waitlist" or "Try another tour"
  - [ ] Map this to backend error codes in the error taxonomy.

---

## Section D – Idempotency & Duplicate Submission

### D1. Global idempotency UX pattern

- ID: D1
- Type: UX / Tech Contract
- Priority: MEDIUM–HIGH
- Description:
  Many mutations require an idempotency key.
  UI currently has no explicit pattern for:
  - duplicate submits
  - IDEMPOTENCY_KEY_REPLAY_MISMATCH
- Tasks:
  - [ ] Define a global UX pattern in screen_state_spec_v2.md:
        - Buttons become disabled with a spinner during submit
        - Clear error copy for idempotency mismatch
  - [ ] Document for each mutating action (register, pay, convert waitlist, cancel, etc.) that FE must send Idempotency-Key.
  - [ ] Add WF-IDEMPOTENCY-01 to the docs.

---

## Section E – Registration Status Coverage

### E1. Add AcceptedPaid & Refunded to participant status

- ID: E1
- Type: UX / Status Semantics
- Priority: MEDIUM
- Description:
  RegistrationResponseDto.status includes AcceptedPaid and Refunded.
  S-PART-03 currently does not explicitly model these as canonical outcome states.
- Tasks:
  - [ ] Update S-PART-03 in screen_state_spec_v2.md to list:
        - AcceptedPaid clearly (different from Accepted without payment)
        - Refunded as a distinct end state
  - [ ] Add copy examples for each.

---

## Section F – Session & Network

### F1. Session expired mid-journey

- ID: F1
- Type: UX / Global
- Priority: MEDIUM
- Description:
  401 / AUTH_UNAUTHENTICATED can happen mid-form or after returning from payment.
- Tasks:
  - [ ] Define a global "session expired" pattern:
        - Modal or redirect with message
        - Preserve draft form data when possible
  - [ ] Add it to screen_state_spec_v2.md under error handling.

---

### F2. Network/offline error states

- ID: F2
- Type: UX / Global
- Priority: LOW–MEDIUM
- Description:
  Currently handled as generic error.
- Tasks:
  - [ ] Define WF-NETWORK-RETRY-01:
        - Clear offline / network error message
        - Manual retry
  - [ ] Document where this should appear (registration submit, payment-related screens, etc.)

---
