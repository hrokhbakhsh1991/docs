# Finance exception operator UI (PR23-C3)

```yaml
doc_id: FINANCE_EXCEPTION_OPERATOR_UI_PR23_C3
version: "2026-08-09-v1"
status: READY_FOR_PR23_D_REPORTING
phase: PR23-C3
related:
  - docs/phase-20/p7/appendices/FINANCE_EXCEPTION_READ_PATH_PR23_C2.md
locks:
  domain_api: frozen
  mutation: forbidden
  client_exception_calc: forbidden
  sla_language: forbidden
  ownership_model: forbidden
  source: GET_/api/finance/exceptions_only
```

## Purpose

Read-only operator **discovery + navigation** for finance exceptions already aggregated by PR23-C2.

Surface: Finance Command Center → Overview → **Needs follow-up** (`FinanceExceptionsPanel`).

Not a new queue, not a mutation inbox, not an AR report.

## Data flow

```text
BFF GET /api/finance/exceptions
  → proxyFinanceApiGet → GET /finance/exceptions
  → FinanceExceptionsFollowUpSection fetch
  → FinanceExceptionsPanel({ items, loading, error, onRefresh })
```

- UI **parses** the API page shape only (`items`, `nextCursor`, `hasMore`).
- UI **does not** re-derive E1/E2 from payments/receipts.
- Ordering is **API order** (no client re-sort).
- Navigation uses `item.href.payments` / optional `item.href.receipts` from the API (registration-scoped).

## Exception copy (vocabulary)

| Type | Meaning (operator) | Primary nav | Secondary |
| ---- | ------------------ | ----------- | --------- |
| E1 `REJECTED_RECEIPT_PENDING_PAYMENT` | Payment intent still open; submitted proof was rejected | Open Payments | Open Receipts (if href) |
| E2 `CANCELLED_PAYMENT_WITH_BALANCE` | Payment intent cancelled; booking still has remaining balance | Open Payments | — |

Locks:

- `Cancelled` ≠ `Failed`
- Rejected receipt ≠ Pending payment
- No Create payment / Approve receipt CTAs
- No SLA / overdue / escalation language
- No auto-create payment or settlement change

## Component contract

```ts
FinanceExceptionsPanel({
  items,
  loading,
  error,
  onRefresh,
})
```

Presentation only. Fetch lives in `FinanceExceptionsFollowUpSection` (Overview mount).

## UI states

| State | Behavior |
| ----- | -------- |
| Loading | Existing `OperatorSkeleton` pattern |
| Empty | FA: «موردی برای پیگیری مالی وجود ندارد» / EN: «No finance follow-ups» |
| Error | Localized error + **Retry** only |
| Ready | List in API order with identity, payment, reason, optional balance, time, nav links |

## Explicit non-goals

Domain/API changes, mutations, receipt review actions, SLA, assignee, AR reporting (→ PR23-D).

## Status

`READY_FOR_PR23_D_REPORTING`
