# Denali Finance Customer Handoff Polish — PR22-D

```yaml
doc_id: DENALI_FINANCE_CUSTOMER_HANDOFF_POLISH_PR22_D
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR22-D
continues:
  - PR22-C Final Finance Operator Journey Audit
locks:
  - Presentation only — no API / DB / finance-core / state-machine changes
  - No new fetches — reject nav uses registrationId already on receipt row
scope: apps/web Finance Command Center guidance + receipts amount-fit + reject banner link
```

## 1. Operator state → action

First-customer chrome shows a compact cheat sheet:

| State | Action |
| ----- | ------ |
| Unpaid booking | Payments — open manual debt |
| Partial booking | Payments if balance remains / no Pending receipt; else follow strip |
| Pending payment | Payments — payment-scoped «در انتظار (این پرداخت)» |
| Pending receipt | Receipts — «در انتظار بررسی (فیش)» |
| Paid booking | No collection action |

Vocabulary callout (fixed):

- ثبت‌شده (این پرداخت) / Recorded (this payment)
- پرداخت‌شده (رزرو) / Paid (booking)
- در انتظار (این پرداخت) / Pending (this payment)
- در انتظار بررسی (فیش) / Pending review (receipt)

## 2. Amount-fit

`amountFitUnder`: balance-oriented («کمتر از مانده» / «Under remaining balance») — not bare «جزئی».

## 3. Reject → related payment

After reject, banner links to Payments with existing `registrationId` from the reviewed receipt (no fetch).
