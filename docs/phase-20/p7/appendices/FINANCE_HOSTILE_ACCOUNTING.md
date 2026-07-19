# Hostile accounting correctness — risks only

```yaml
audit_id: FINANCE_HOSTILE_ACCOUNTING
version: "1.0"
date: "2026-07-19"
scope: payment lifecycle, ledger, prepayment, approve TX
exclude: architecture, authz, tenancy (except where books break)
```

## Lifecycle map (as implemented)

| Business label | Stored fact |
| -------------- | ----------- |
| Created | `Payment.status = Pending` |
| Submitted | `PaymentReceipt.status = Pending` (payment still Pending) |
| Approved | `PaymentReceipt.status = Approved` |
| Paid | `Payment.status = Paid` (+ `paidAt`, `ledgerJournalId`) |
| Rejected | `PaymentReceipt.status = Rejected` (**payment stays Pending**) |

Approve commits **Paid and Approved in one TX** (payment → booking → receipt → ledger outbox). There is no durable “Approved but unpaid” success state on the Prisma path.

---

## Accounting risks (ranked)

### P0 — books diverge from cash/payment facts

1. **Missing ledger capture on successful Paid/Approved**  
   - If `ledgerCapture.lines.length === 0`, enqueue is skipped; TX still commits Paid + Approved.  
   - If `!isDurablePersistence()`, `ledgerCapture` is **omitted** from the approve call even when the adapter built lines → Paid/Approved with **zero** ledger outbox.  
   - Memory approve path never enqueues ledger.  
   **Effect:** payment recognized; GL never receives the journal.

2. **Prepayment recorded without guaranteeing a new ledger insert**  
   `recordPrepaymentAtomic` calls `enqueueFinanceLedgerCaptureOutbox` and **ignores** `false` (duplicate `domainEventId`). It then inserts `finance.prepayment.recorded`.  
   **Effect:** prepayment business event can exist while ledger insert was a no-op duplicate — or empty lines no-op — so cashbook and prepayment register disagree.

3. **Same CoA double-post risk (TourCreated + payment capture)**  
   TourCreated reaction and payment-capture approve both debit clearing / credit `bookingWalletId(registrationId)` when TourCreated carries `paidAmountMinor`.  
   **Effect:** wallet can be credited twice for one economic receipt if both paths fire for the same registration.

### P1 — wrong amounts / incomplete recognition

4. **Payment amount not tied to invoice/tour price**  
   Manual create accepts any positive digit string; approve posts **whatever is on the Payment row**.  
   Member offline bootstrap uses workspace `offlineReceiptPaymentDefaults()` (e.g. Denali fixed `2500000`), not live invoice.  
   **Effect:** systematic under/over-statement vs commercial obligation.

5. **Multiple Pending debts until first Paid**  
   Debt gate only blocks **new** manual create after any `Paid`. Several Pending payments (and receipts) can coexist; only one can win approve. Losers remain Pending open liability with no auto-void.  
   **Effect:** overstated open AR / operator confusion; risk of second approve attempt after partial cleanup.

6. **Reject does not clear payment obligation**  
   Rejected receipt leaves `Payment = Pending`. Correct for retry, but reports that key off receipts vs payments can disagree until a later approve.  
   **Effect:** reconciliation noise, not a false Paid (unless misread).

7. **Prepayment ↔ booking projection eventually consistent by design**  
   After atomic outbox writes, `trySyncBookingPaymentStatus(..., "partial")` runs **outside** the TX and soft-fails to degraded.  
   **Effect:** books show prepayment; booking may still show unpaid until retry — AR/booking mismatch window. Retry forces `partial` without re-validating prepayment totals vs invoice.

8. **Prepayment has no Payment row**  
   Prepayments live as outbox payloads (`finance.prepayment.recorded` + ledger event).  
   **Effect:** hard to reconcile Payment.Paid + prepayment sums to one registration balance; list/rebuild depends on outbox retention.

### P1 — double / duplicate ledger events

9. **Approve double-capture blocked**  
   Stable Denali/ws `domainEventId = payment:{paymentId}:ledger-capture-anchor`; duplicate insert → `!inserted` → `FINANCE_APPROVE_CONFLICT` → **full TX rollback**.  
   Adapters fail-closed without seeded journal/line ids; host `assertStableCaptureIdentities` before enqueue. See `FINANCE_ADAPTER_IDENTITY_STABILITY.md`.  
   **Residual:** truncation to 128 chars can still collide distinct ids (separate from adapter randomness).

10. **Idempotent approve replay is safe for money**  
    Already Approved+Paid → no second ledger enqueue. Concurrent approve → conflict/replay.  
    **Not a risk** when Pending guards hold.

### P2 — weaker but real

11. **Zero / invalid amount**  
    Denali `postDoubleEntryJournal` requires `amount_minor > 0`; approve fails before commit → no false Paid.  
    **Residual:** workspace adapters that skip balance/positive checks could post unbalanced or zero journals if they return lines the host does not re-validate (host only checks tenant scope + non-empty to enqueue).

12. **Prepayment idempotent replay ignores new body amounts**  
    Same `Idempotency-Key` returns original outbox payload amounts; no `FINANCE_*_CONFLICT` if client retries with a different `amountMinor`.  
    **Effect:** operator believes a corrected amount posted; books keep the first amount (safe against double post, unsafe against human “fix” attempts).

13. **No reversing journal on reject / compensate**  
    Nothing to reverse if never captured; after Paid there is no HTTP void/reverse.  
    **Effect:** corrections require out-of-band GL entries.

14. **`domainEventId` truncation (128)**  
    Distinct logical events can share a truncated id → false duplicate → approve abort or prepayment ledger skip.

---

## Approve atomic TX (accounting view)

| Step order | On throw |
| ---------- | -------- |
| 1. Payment Pending→Paid | rolls back |
| 2. Booking → paid (in TX) | rolls back payment |
| 3. Receipt Pending→Approved | rolls back 1–2 |
| 4. Ledger outbox insert (if lines + durable) | rolls back 1–3 |

**Ordering risk (accounting):** cash/payment facts are written **before** ledger outbox inside the same TX. On successful commit they are atomic. On **missing enqueue** (empty lines / non-durable omit), commit still succeeds → **partial economic recognition** (Paid without books) — see P0 #1.

**Rollback:** Prisma `withTenantRls` TX is fail-closed for thrown errors (booking sync miss, approve conflict, duplicate ledger).  
**Partial failure after commit:** relay lag only; duplicate relay prevented by outbox `domainEventId` + processed claims — not a second GL post if ids stay stable.

---

## Ledger checklist

| Risk | Present? |
| ---- | -------- |
| Double capture (happy path) | Mitigated by stable id + TX conflict |
| Missing capture | **Yes** — empty lines / non-durable / memory |
| Wrong amount | **Yes** — unbound create + offline defaults + no invoice bind |
| Duplicate event | Residual if truncated ids; TourCreated∩capture CoA overlap mitigated (duplicate-credit rem) |

## Prepayment checklist

| Risk | Present? |
| ---- | -------- |
| Consistency (ledger + recorded event) | **Weak** — enqueue result ignored; empty lines |
| Replay | Safe against double money; silent amount ignore on key reuse |
| Reconciliation | **Weak** — outbox-sourced, booking soft-sync, no Payment row |

---

## Bottom line

Highest accounting damage: **Paid/Approved (or prepayment recorded) without a corresponding ledger journal**, plus **possible double wallet credit** if TourCreated ledger and payment capture both post for the same registration. Approve TX rollback itself is sound; the holes are **skipped capture**, **ignored ledger insert result on prepayment**, and **amount authority not bound to commercial truth**.
