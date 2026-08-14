# Denali Booking Strip Next Action — PR22-A

```yaml
doc_id: DENALI_FINANCE_BOOKING_STRIP_NEXT_ACTION_PR22_A
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR22-A
continues:
  - PR22 Finance Operator Reality Audit (risk #1/#2/#4)
  - DENALI_FINANCE_BOOKING_STRIP_UX_PR21_F
locks:
  - No API / DB / finance-core / new entities
  - Uses existing payments list, invoice read model, receipts/pending (registration-scoped)
  - Recorded payment ≠ booking settled; receipt pending ≠ payment pending
scope: apps/web booking financial strip next-step routing + single primary CTA
```

## Decision order

```text
1. booking.paymentStatus === paid     → no next action
2. open Pending payment exists        → Payments (primary)
3. pending receipt exists             → Receipts (primary)
4. invoice balanceDueMinor > 0        → Payments (primary)
5. otherwise                          → no next action
```

When (2) and a pending receipt also exist: still Payments; neutral copy (do not imply receipt is the wrong queue — just prefer open payment first).

## CTA hierarchy

- At most **one** primary next-step CTA (clickable link, preserves `registrationId`).
- Always-visible “Open payments” only when **no** next-step is shown.
- Secondary Receipts / Meaning text links remain tertiary (not primary CTAs).

## Inputs (existing)

| Signal | Source |
| ------ | ------ |
| Pending payment | Strip payments list (`status=Pending`) |
| Pending receipt | `GET /api/finance/receipts/pending` + registration scope |
| Remaining balance | Invoice cache / `GET /api/finance/invoices/:id` `balanceDueMinor` |
| Booking settlement | `booking.paymentStatus` prop (SoT) |
