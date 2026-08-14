# Pending manual payment cancel — domain command (PR23-A.2)

```yaml
doc_id: FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_PR23_A2
version: "2026-08-09-v1"
status: IMPLEMENTED
phase: PR23-A.2
related:
  - docs/phase-20/p7/appendices/FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md
  - packages/finance-core/src/application/finance.service.ts
  - packages/finance-core/src/domain/cancel-pending-manual-payment.ts
locks:
  finance_service_mutation_authority: true
  case_mutation: forbidden
  reuse_failed_for_abandon: forbidden
  ledger_on_cancel: forbidden
  booking_payment_downgrade_on_cancel: forbidden
  ui_before_domain: forbidden
```

## Decision (PR23-A.1)

Operator abandon of an open manual debt intent uses status **`Cancelled`**.

| Status | Meaning |
| ------ | ------- |
| `Pending` | Open collection intent (debt lock) |
| `Paid` | Money recognized via receipt approve |
| `Cancelled` | Intent closed without capture (this command) |
| `Failed` | Reserved for provider/system failure — **not** this command |

`Cancelled ≠ Paid ≠ Failed ≠ Refund`. Cancel does not settle a booking, write a ledger journal, or change invoice totals.

## Command

`FinanceService.cancelPendingManualPayment`

| Input | Notes |
| ----- | ----- |
| `tenantId` / `actorUserId` | From `FinanceActorContext` |
| `paymentId` | Target row |
| `reasonCode` | `abandoned` \| `wrong_amount` \| `superseded` \| `other` |
| `reasonNote` | Required when `reasonCode = other` |
| `idempotencyKey` | Optional; hashed into audit payload when present |

### Transition

```text
Pending + method=Manual  →  Cancelled
```

### Forbidden

- `Paid|Failed|Cancelled → Cancelled` as a mutating win over money recognition (`Cancelled→Cancelled` is idempotent replay only)
- Non-`Manual` methods
- Cancel while any attached receipt is `Pending` (no auto-reject)
- Setting `failedAt` or incrementing `failedPayments`

## Atomic sequence (repository)

```text
BEGIN (tenant RLS)
  lock / conditional update payment WHERE status = Pending
  re-validate method + pending-receipt count = 0
  SET status = Cancelled
  enqueue outbox finance.payment.cancelled
COMMIT
```

Approve and cancel both use `updateMany … status = Pending`. Concurrent approve vs cancel yields exactly one winner: **Paid** or **Cancelled**, never both.

## Audit event

`finance.payment.cancelled` — durable outbox row.

Required payload fields: `tenantId`, `paymentId`, `registrationId`, `actorUserId`, `occurredAt`, `fromStatus=Pending`, `toStatus=Cancelled`, `method=Manual`, `reasonCode`, `reasonNote`, `amount`, `currency`, `openReceiptCount=0`.

Must omit: `ledgerJournalId`, booking/settlement mutations.

`domainEventId`: `payment-cancelled:{paymentId}` (one durable cancel per payment; replay-safe).

## Debt gate

After `Cancelled`, registration no longer has a `Pending` row → `assertManualPaymentDebtAllowed` allows a new manual intent when `balanceDueMinor > 0` (unchanged gate; only `Pending` blocks).

## Reporting

`FinanceSummaryRow.cancelledPayments` counts `status = Cancelled`. **`failedPayments` unchanged** (still `Failed` only).

## Errors

| Code | When |
| ---- | ---- |
| `PAYMENT_NOT_FOUND` | No payment for tenant scope |
| `PAYMENT_NOT_IN_SCOPE` | Payment exists under another tenant (in-memory / detectable hosts) |
| `PAYMENT_CANCEL_ONLY_MANUAL` | `method ≠ Manual` |
| `PAYMENT_NOT_CANCELLABLE` | Status not `Pending` (except idempotent `Cancelled` replay) |
| `PAYMENT_HAS_PENDING_RECEIPT` | Attached receipt still `Pending` |
| `PAYMENT_CANCEL_REASON_INVALID` | Bad `reasonCode` / missing note for `other` |

## Scope boundary

**In:** finance-core command + port + in-memory/Prisma atomics + summary count + domain tests.

**Out:** HTTP/UI/i18n, refund/reverse, gateway `Failed`, ledger/booking sync, Case mutation.
