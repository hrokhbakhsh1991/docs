# Denali Finance Payments UX — PR21-E

```yaml
doc_id: DENALI_FINANCE_PAYMENTS_UX_PR21_E
version: "2026-08-08-v1"
status: IMPLEMENTED
phase: PR21-E
verdict: READY_FOR_PR21_E_REVIEW
continues:
  - DENALI_FINANCE_CUSTOMER_HANDOFF_GATE
  - DENALI_FINANCE_OVERVIEW_UX_PR21_B1
  - DENALI_FINANCE_RECEIPTS_UX_PR21_C
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged
  - No receipt-state invention from payment DTO
  - Portal → Receipts remains primary proof review path
  - No prepayments / installments enablement
```

## Phase 0 — implementation map

```text
Existing data:
  FinancePaymentRow — id, registrationId, amount, currency, method, status,
  provider, paidAt, createdAt, registrationContext?
  Manual create response — same payment row shape (status Pending).
  Invoice read — GET /api/finance/invoices/:registrationId (TOTAL/PAID/REMAINING).
  No receiptId / receiptStatus on payment DTO.

Existing helpers:
  withFinanceRegistrationQuery / withFinanceListScopeQuery
  FinanceRegistrationIdentity / FinanceRegistrationLink / financeBookingHref
  buildFinanceCommercialMeaningHref
  fetchRegistrationInvoice / formatMinorAmount / formatFinanceTimestamp

Safe reusable UI:
  One registration-scoped obligation glance (not N+1 per global row)
  Receipts escape hatch with registrationId
  Collapsed create + advanced forms

Semantic limitations:
  Pending ≠ proof awaiting review (cannot know without inventing state)
  Payment Paid ≠ booking paid/partial/unpaid

Potentially unsafe assumptions (rejected):
  Inferring receipt pending from payment Pending
  Claiming “awaiting proof” as fact after create
  Fetching invoice for every row in global/tour lists
```

## Semantic model (locked)

```text
Payment status ≠ Booking settlement status
```

Operator copy must keep payment-record scope explicit.

## Implementation slices

1. Row hierarchy: identity → amount + payment status → meta → nav
2. Registration-scoped obligation glance (single invoice fetch)
3. Neutral Pending meaning + Receipts secondary link (no fabricated receipt state)
4. Create: list-first, create secondary; result banner from actual response
5. Advanced receipt: clearly secondary; row “use this payment” prefill
6. Empty: true vs filtered vs registration-scoped; API failure stays error
7. EN/FA vocabulary for payment vs booking settlement

## Out of scope

FinanceService, APIs, Case/Meaning semantics, third review path, Ledger redesign.

## Shipped (presentation)

1. List-first queue; create + advanced demoted below list (`details`).
2. Member-first identity (shared `FinanceRegistrationIdentity`).
3. Settlement hint + payment-scoped status labels (EN/FA).
4. Neutral Pending meaning; Receipts link with `registrationId` (no fabricated receipt state).
5. Registration-scoped obligation glance (single invoice fetch).
6. Create result banner from create response; no false “awaiting proof”.
7. Row “Use this payment” prefills advanced form (no primary UUID workflow).
8. Empty: true / filtered / registration-scoped; API error unchanged.

