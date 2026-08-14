# Manual debt gate — partial collection policy (PR20-D)

```yaml
doc_id: FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY
version: "2026-08-08-v1"
status: IMPLEMENTED
phase: PR20-D
related:
  - docs/phase-20/p7/appendices/DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md
  - docs/phase-20/p7/appendices/FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md
  - packages/finance-core/src/domain/manual-payment-debt-policy.ts
  - packages/finance-core/src/application/finance.service.ts
locks:
  finance_service_mutation_authority: true
  case_mutation: forbidden
  remove_debt_gate: forbidden
```

## Root cause

Legacy pilot policy (`PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN`) treated **any** payment row with status `Paid` as **settlement complete**, blocking further manual debt.

That proxy was correct when receipt approve always raised booking to `paid` and operators collected in **one shot**.

After **PR20-B**, approve sets:

```text
balanceDueMinor > 0 → booking.paymentStatus = partial
balanceDueMinor = 0 → booking.paymentStatus = paid
```

A `Paid` payment row can therefore coexist with **remaining balance**. The old gate still forbade a second manual payment → **dead-end** for `unpaid → partial → … → paid`.

The gate was **intentionally protective** (no double debt after settlement; not a bug in isolation). It became **incorrect** once partial collection was a first-class SoT outcome.

## Policy (minimal correct)

Do **not** delete the debt gate. Re-anchor it on **invoice remaining** + **open Pending**:

| Condition | Result |
| --------- | ------ |
| Any payment status `Pending` | Reject — one open manual debt intent at a time |
| `balanceDueMinor = 0` (settled / fully covered) | Reject — no additional manual debt after settlement |
| `balanceDueMinor > 0` | **Allow** new Pending manual payment even if prior rows are `Paid` |

Settlement message for clients that already match the string remains when remaining is zero and a `Paid` row exists:

`registration already has a successful payment; additional manual debt is not allowed`

## Overpay vs remaining

Approve (and create, when obligation is known) compare the **this payment** amount against **`balanceDueMinor + tolerance`**, not only against the full obligation. Otherwise a second payment could exceed remaining while still being below original obligation.

Stable domain error: `FINANCE_OBLIGATION_OVERPAY` → HTTP **422** (mapped in API error interceptor; no SoT mutation).

## Preserved invariants

- No overpayment past remaining (+ tolerance)
- Duplicate / idempotent create still keyed; Paid payment cannot accept a new receipt submit
- Booking payment rank never downgrades (`raiseBookingPaymentStatus`)
- Prepayment path unchanged (separate atomic write)
- FinanceService remains sole mutation authority; Case remains interpret-only
- Classic review and Command bridge both call `FinanceService.reviewReceipt`

## First-customer journey unlocked

```text
underpay approve → partial + remaining > 0
  → second manual payment (allowed)
  → receipt → approve → still partial | paid
  → … until remaining = 0 and booking paid
```

## Ledger companion (ADR-010)

Partial collection also required Path A approve to stop treating **prior payment captures** as `FINANCE_DUPLICATE_OBLIGATION_CREDIT`.

- Path A throws only when **TourCreated (Path B)** already credited the booking wallet.
- Multiple Path A captures (one per approved payment) are allowed; amounts sum on the wallet.
- Path B still skips when any capture or TourCreated credit exists.

See [`adr/ADR-010-duplicate-wallet-credit-xor.md`](./adr/ADR-010-duplicate-wallet-credit-xor.md).
