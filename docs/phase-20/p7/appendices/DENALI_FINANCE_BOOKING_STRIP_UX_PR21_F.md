# Denali Finance Booking Strip + Overview Attention UX — PR21-F

```yaml
doc_id: DENALI_FINANCE_BOOKING_STRIP_UX_PR21_F
version: "2026-08-09-v1"
status: IMPLEMENTATION
phase: PR21-F
continues:
  - DENALI_FINANCE_OVERVIEW_UX_PR21_B1
  - DENALI_FINANCE_PAYMENTS_UX_PR21_E
  - PR21-F UX audit (READY_FOR_PR21_F_IMPLEMENTATION)
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged
  - No installment/prepayment enablement
  - No new finance workflows or Booking work queue
scope: apps/web BookingFinancialStrip, Overview attention copy, client registration finance cache
```

## Purpose

Close the booking-level financial context bridge after Receipts (PR21-C/D) and Payments (PR21-E):

1. **F1 — Attention vocabulary** — `pending-manual` CTA is “Open payment” / «باز کردن پرداخت», not receipt-review language. Destination stays Payments + `registrationId`.
2. **F2 — Settlement bridge** — Strip payment rows distinguish *payment recorded/pending* from *booking unpaid/partial/paid* using existing invoice + booking `paymentStatus`.
3. **F3 — Next-step semantics** — For approved unpaid/partial: open Pending payment → Payments; otherwise → Receipts. No unsupported “member must upload” claim.
4. **F4 — Targeted cache freshness** — After successful classic receipt review or manual payment create (and Command reviewReceipt success), invalidate registration-scoped invoice + strip payments cache entries only.

## Operator information model (Booking)

```text
booking identity (inspection header)
        ↓
invoice TOTAL / PAID / REMAINING
        ↓
payment row status (payment-scoped labels)
        ↓
settlement bridge line (payment vs booking)
        ↓
compact next surface (Payments | Receipts, registration-scoped)
        ↓
nav: Payments / Receipts / Meaning
```

## Cache invalidation (F4)

Namespaces (unchanged TTL 45s for ordinary hits):

| Namespace | Used by |
| --------- | ------- |
| `finance-invoice-balance` | `FinanceInvoiceBalanceCard` |
| `finance-strip-payments` | `BookingFinancialStrip` |

`invalidateFinanceRegistrationCaches(registrationId)` deletes **only** that registration’s entries. Failed mutations do not invalidate.

## Non-goals

Ledger redesign, Meaning UI in strip, pending-receipt queue on Booking, API changes, global TTL reduction, polling.

## Acceptance

Operator answers owed/paid/remaining, whether a payment is merely recorded vs booking settled, and the next sensible Finance tab — without Ledger/Meaning — with registration context preserved.
