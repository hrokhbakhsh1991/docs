# Tour collection report (PR23-D2)

```yaml
doc_id: FINANCE_TOUR_COLLECTION_REPORT_PR23_D2
version: "2026-08-09-v1"
status: READY_FOR_PR23_D3
phase: PR23-D2
related:
  - docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md
locks:
  mutation: forbidden
  balance_sot: registration_invoice_compile_only
  payment_row_ar: forbidden
  ledger_as_ar: forbidden
  online_gateway: out_of_scope
  collection_mode: manual_offline_first
```

## Purpose

Tour-level AR answer: **which tours have outstanding balance and how much?**

Aggregation is derived from the PR23-D1 outstanding balance model (Invoice SoT), not from payment operations.

## Invoice-based aggregation

```text
Per registration (outstanding only):
  invoice.totalMinor / paidMinor / remainingMinor
        ↓
Group by tourId
        ↓
tour.invoiceTotalMinor  = Σ totalMinor
tour.collectedMinor     = Σ paidMinor
tour.remainingMinor     = Σ remainingMinor
```

Default inclusion: `tour.remainingMinor > 0` only.

## Payment ops vs AR reporting

| Surface | Question | Source |
| ------- | -------- | ------ |
| Payments / receipts | What intents / proofs need work? | Payment + receipt lifecycle |
| Outstanding balances (D1) | Who owes how much? | Invoice compile |
| Tour collections (D2) | Which tours owe how much? | Σ of D1 invoice rows |

Forbidden as AR:

- summing Payment rows / Pending intents as debt
- ledger amounts
- recalculating booking settlement

## Manual collection boundary

Same as D1: manual/offline first. No gateway / PSP / refund / credit-note fields.

## Read pipeline

```text
HTTP GET /finance/reports/tour-collections
  → FinanceService.listTourCollectionSummary(auth, { cursor?, limit? })
      → load outstanding registration invoices (same path as D1)
      → aggregateTourCollectionFromOutstanding
      → keep remainingMinor > 0
      → paginate (remainingMinor DESC, tourId ASC)
```

## Ordering / cursor

1. `remainingMinor` DESC
2. `tourId` ASC
3. Opaque keyset: `remainingMinor` + `tourId`

## Status

`READY_FOR_PR23_D3`
