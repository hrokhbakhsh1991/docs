# Denali Finance Payments Density — PR21-G3

```yaml
doc_id: DENALI_FINANCE_PAYMENTS_DENSITY_PR21_G3
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR21-G3
continues:
  - DENALI_FINANCE_MICRO_UX_PR21_G1_G2
  - DENALI_FINANCE_PAYMENTS_UX_PR21_E
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / BFF / DB / flags unchanged
  - No N+1 invoice fetch on global Payments list
  - No payment/receipt state-machine or semantic changes
scope: apps/web Payments list presentation density + operator action hierarchy
```

## Micro-audit (pre-implementation)

| # | Finding |
| - | ------- |
| 1 | Row DOM: `li` → identity (member + tour + booking link) → amount+badge → paid/pending meaning paragraphs → method+time → Receipts link + Use this payment (equal weight) |
| 2 | First-pass essentials: member, amount, payment-scoped status, Receipts |
| 3 | Redundant at 20–50 rows: per-row settlement/pending meaning sentences; verbose “Method:” prefix; duplicate identity via link label |
| 4 | Primary action: Receipts. Secondary: Use this payment (advanced prefill) |
| 5 | Advanced currently renders inline beside Receipts |
| 6 | Create Manual is a Card **after** the list (`createDetails`, open when not registration-scoped) |
| 7 | At 50 rows each row is multi-block (~6–8 text lines) → scan fatigue |
| 8 | With `registrationId`: obligation TOTAL/PAID/REMAINING + create collapsed; invoice fetch once for scope only |
| 9 | Stable test ids: `settlementHint`, `pendingMeaning`, `openReceipts`, `usePaymentForReceipt`, `obligationGlance`, `createResult`, `emptyFiltered`, `createDetails`, `list` |
| 10 | Reuse: `settlementHint`, `pendingPaymentMeaning`, `usePaymentForAdvanced`, `createManual`, status/method keys |

## Target hierarchy

```text
WHO          member / registration identity (compact)
WHAT MONEY   payment amount
WHAT STATE   payment-scoped status badge
WHAT KIND    method · created (metadata)
WHAT NEXT    Receipts (primary)
ADVANCED     nested secondary → Use this payment
```

List/context level carries settlement + pending meaning once (not 50×).

## G3 slices

| ID | Change |
| -- | ------ |
| G3-1 | Compact payment row using existing identity / amount / badge patterns |
| G3-2 | Move repetitive meaning copy to list-level; keep payment ≠ booking settlement |
| G3-3 | Demote “Use this payment” under Advanced disclosure; preserve prefill |
| G3-4 | Near-header Create affordance that opens existing create details (list-first preserved) |
| G3-5 | Preserve scoped TOTAL / PAID / REMAINING glance; no global N+1 |
| G3-6 | When list rows already carry `registrationContext`, surface Member · Tour for scoped filter clarity (no new fetch) |
| G3-7 | Density acceptance at 20–50 rows |

## Non-goals

Overview attention, Ledger/Meaning chrome, Inbox badge tension, new APIs, Receipts queue redesign.
