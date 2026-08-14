# Finance Case SoT Paid-vs-Remaining Policy Gate (PR20-B)

```yaml
doc_id: FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY
version: "2026-08-08-v1"
status: IMPLEMENTED
phase: PR20-B (SoT paid-vs-remaining policy fix)
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SEMANTIC_CALIBRATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - packages/finance-core/src/domain/booking-payment-status-from-balance.ts
  - packages/finance-core/src/domain/resolve-approve-booking-payment-status.ts
  - packages/finance-core/src/application/finance.service.ts
  - apps/api/src/workspace-finance/infrastructure/booking-payment.adapter.ts
  - apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts
  - scripts/pr20b-denali-sot-paid-remaining-live.sh
locks:
  finance-core_interpreter: unchanged
  implement_sot_fix_in_this_pr: true
  rollout_expand: forbidden
  shadow: false
  command_ui_tenant: "00000000-0000-4000-8000-000000000003"
```

## Purpose

Resolve whether PR20-A `EXCEPTION` pressure (`booking.paymentStatus=paid` + invoice `remaining > 0`) is intentional SoT semantics or an incomplete FinanceService write policy — **before** any tenant expansion.

**PR20-B ships the SoT correction** (Case interpreter unchanged).

---

## Finding

**Option B — Policy is incorrect/incomplete** (with Option C vocabulary already present but unused on the approve path).

Receipt approve unconditionally raises booking projection to **`paid`**, even when compiled invoice balance remains positive. The same SoT already uses **`partial`** for underpayment on the **prepayment** path. Case `EXCEPTION` via Host `meaningConflictProven` is the correct commercial interpretation of that inconsistent projection.

**Not** Option A (intentional “paid means underpaid is fine” as a designed approve policy).  
**Not** a finance-core / interpreter / Command Bridge defect.

---

## Mutation path (exact)

```text
Operator / Command UI reviewReceipt(approve)
  → FinanceService.reviewReceipt
      · overpay guard vs obligation (underpay allowed)
      · ledger capture journal planned
  → repository.approveManualReceiptAtomic (single RLS TX)
      1. payment.status = Paid
      2. bookingPayments.raisePaidInTx(tx, { tenantId, registrationId })
           → raiseBookingPaymentStatus(current, "paid")   ← paid assigned HERE
           → operatorRegistration.paymentStatus = paid (rank never downgrades)
      3. receipt.status = Approved
      4. ledger outbox enqueue
  → SoT committed
  → fresh Encounter / HostDenaliCaseReadSource
      · remainingMinor ← compileRegistrationInvoice / invoice balanceDueMinor
      · bookingPaymentStatus ← booking.paymentStatus
      · if paid ∧ remaining>0 → meaningConflictProven=true (PR15-G)
  → exceptionCues.meaningConflict → meaning_conflict → Case reading EXCEPTION
```

### Where `paid` is assigned

| Layer | Location | Behavior |
| ----- | -------- | -------- |
| Prisma approve TX | `PrismaFinanceRepository.approveManualReceiptAtomic` | Always calls `raisePaidInTx` — **no remaining check** |
| Booking adapter | `BookingPaymentAdapter.raisePaidInTx` | Hard-targets `"paid"` via `raiseBookingPaymentStatus(current, "paid")` |
| Memory fake | `InMemoryFinanceRepository.approveManualReceiptAtomic` | `syncStatus(..., "paid")` — same unconditional target |
| Rank helper | `apps/api/src/bookings/booking-payment-status.ts` | `unpaid(0) < partial(1) < paid(2)` — never downgrades |

`FinanceService.raiseBookingPaymentStatus` can sync `"unpaid" | "partial" | "paid"`, but the **approve atomic path never asks for `partial`**.

### What `paid` means in current SoT (by behavior, not name)

| Path | Target status | Commercial implication in code |
| ---- | ------------- | ------------------------------ |
| Prepayment record / retry | **`partial`** | Money recorded; booking not treated as fully collected |
| Receipt **approve** | **`paid`** always | Workflow “raise to paid after this payment is Paid” — **does not** mean invoice cleared |
| Case settlement map | `paid` → `captured`; `partial`/`unpaid` → `unsettled` | Host treats booking `paid` as settlement captured |
| Classic ops heuristics | Keys off booking `paid` (+ empty pending queue) | Often presents as **settled** |

Invoice remaining is **independent**: `compileRegistrationInvoice` → `balanceDueMinor` from obligation − paid payments sum. Approve does not zero remaining unless the approved payment covers the obligation.

---

## Live evidence (PR20 / PR20-A, tenant `…000003`)

| Registration | Booking `paymentStatus` | Invoice `balanceDueMinor` | Case reading |
| ------------ | ----------------------- | ------------------------- | ------------ |
| `…000518` (PR20-A approve) | **paid** | **1000000** IRR | **EXCEPTION** |
| `…000522` (PR20 approve) | **paid** | **1000000** IRR | **EXCEPTION** |

Seed pattern: manual payment amount below tour obligation (e.g. `1500000` vs higher base price) → approve → paid booking + positive balance. Same commercial class as PR15-G `…0523` (paid `1600000` / remaining `900000`).

Repeatable → **not** isolated historical data.

---

## Classification (paid + remaining > 0 + EXCEPTION)

| Axis | Value |
| ---- | ----- |
| **SoT meaning** | Booking projection raised to `paid` on receipt approve; payment row `Paid`; invoice still owes `balanceDueMinor` |
| **Case meaning** | Product meaning conflicts with financial artifacts → **EXCEPTION** (`meaning_conflict`) |
| **Operator meaning (classic)** | Booking shows paid → often treated as settled / idle |
| **Expected commercial meaning** | **Not settled** — money remains due |
| **Policy owner** | **FinanceService / booking payment sync on approve** (`SOT_POLICY`) |
| **Recommended action** | **KEEP_CASE** + **CHANGE_SOT_POLICY** (separate implementation PR) |

Discrepancy class remains **`SOT_POLICY`**. Not `CASE_INTERPRETER`, `HOST_MAPPING`, `ADAPTER`, or Command Bridge.

---

## Ownership

| Concern | Owner | This PR |
| ------- | ----- | ------- |
| Case EXCEPTION for paid∩remaining>0 | Host coherence + interpreter laws (already correct) | **KEEP_CASE** — no change |
| Booking status after underpay approve | FinanceService + `IBookingPaymentPort` / `raisePaidInTx` | **CHANGE_SOT_POLICY** — propose only |
| Invoice remaining | `compileRegistrationInvoice` / obligation − paid sum | Correct — do not force to zero |
| `partialScopeDeclared` | Explicit partial-plan SoT (Denali: none) | Do **not** infer from remaining (PR15-G) |

---

## Policy decision

```text
KEEP_CASE
CHANGE_SOT_POLICY
```

- Case must continue exposing the conflict until SoT stops claiming `paid` while remaining > 0.
- **Implemented SoT rule (PR20-B fix):**

  ```text
  after receipt approve (payment = Paid, same RLS TX):
    balanceDueMinor > 0  → booking.paymentStatus = partial
    balanceDueMinor = 0  → booking.paymentStatus = paid
  ```

  Balance is compiled inside `approveManualReceiptAtomic` after the payment row is `Paid`, via `loadRegistrationInvoiceFacts` + `compileRegistrationInvoice` (obligation/schedule hints from FinanceService). Raise uses `raisePaidInTx(..., paymentStatus)` and existing monotonic `raiseBookingPaymentStatus`. Case interpreter laws unchanged; no `partialScopeDeclared` fabrication.

Option C note: the enum **already** encodes dual semantics (`partial` = incompletely collected, `paid` = fully raised). Approve now applies that dual. Documenting “paid means payment received” without using `partial` would have normalized the bug — rejected.

---

## Required code changes (implemented)

1. `resolveApproveBookingPaymentStatus` / `bookingPaymentStatusFromBalanceDue` (finance-core `./domain` only — not root barrel).
2. `ApproveManualReceiptAtomicInput` accepts `obligationMinor` + `scheduleAmountsMinor` hints from FinanceService.
3. Prisma + memory `approveManualReceiptAtomic`: after payment `Paid`, compile invoice facts in-TX → `partial|paid` → `raisePaidInTx(..., paymentStatus)`.
4. `BookingPaymentAdapter.raisePaidInTx` uses `input.paymentStatus` + existing monotonic rank.
5. Classic + Command Bridge both call the same FinanceService approve path.

## Required tests (implemented)

1. Domain unit: underpay → partial; full → paid.
2. Memory FinanceService: underpay / full / overpay rejection.
3. Rank: `booking-payment-status.spec.ts` never downgrades.
4. Prepayment / free-collection specs remain green.

## Live validation (executed 2026-08-08, tenant `…000003`)

| Scenario | Result |
| -------- | ------ |
| Classic underpay `…514` | booking **partial**, remaining **1000000**, Case **INCOMPLETE_INSPECT** (not paid∩remaining EXCEPTION) |
| Classic full `…532` | booking **paid**, remaining **0**, Case **SETTLED_CAPTURED** |
| Command underpay `…519` | booking **partial**, remaining **1000000**, Case **INCOMPLETE_INSPECT** |
| Auth | **401** |
| Stale after classic | **409** fail-closed (`CASE_COMMAND_VOCABULARY_DENIED` when tokens cleared; no second SoT write) |

Artifact: `/tmp/pr20b-live-validation.json`.

### Case note (KEEP_CASE)

Underpay + `partial` + no Denali `partialScopeDeclared` yields **INCOMPLETE_INSPECT** (fail-closed) rather than `PARTIAL_SCOPED`. That is expected without fabricating partial-plan SoT — **not** an interpreter defect. False `EXCEPTION` from paid∩remaining is eliminated.

---

## Rollout recommendation

**CONTINUE** — SoT policy corrected; live classic + Command underpay/full proven; safety fail-closed; flags unchanged.

- Not `READY_FOR_EXPANSION` (single-tenant window; Meaning health still needs observation without the old false EXCEPTION pressure).
- Shadow remains **OFF**. Never auto-flip flags.

```bash
# Unchanged
FINANCE_CASE_ENCOUNTER_MODE=internal
FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
FINANCE_CASE_SHADOW_ENABLED=false
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
```

---

## Documentation changes

| Doc | Update |
| --- | ------ |
| This file | Investigation + implementation + live results |
| `FINANCE_CASE_VALIDATION_RUNBOOK.md` | §PR20-B CONTINUE |
| `FINANCE_CASE_INTERPRETER_BOUNDARY.md` | KEEP_CASE + SoT fix shipped |
