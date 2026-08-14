# Denali Finance Receipts UX — PR21-C Audit

```yaml
doc_id: DENALI_FINANCE_RECEIPTS_UX_PR21_C
version: "2026-08-08-v1"
status: AUDIT_ACCEPTED
phase: PR21-C
verdict: READY_FOR_RECEIPTS_UX_IMPLEMENTATION
continues:
  - DENALI_FINANCE_CUSTOMER_HANDOFF_GATE
  - DENALI_FINANCE_OVERVIEW_UX_PR21_B1
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged
  - Classic Receipts remains first-customer primary review path
  - No third review path; Command UI stays Meaning-only / flagged
  - No prepayments / installments enablement
next:
  - PR21-C1 — Receipts review context + registration-preserving booking link + result feedback
```

## Purpose

Make receipt review a **comprehension-before-act** workflow for Denali’s first-customer contract:

```text
SEE → UNDERSTAND → DECIDE → APPROVE / REJECT → VERIFY RESULT → KNOW NEXT ACTION
```

Technical approve/reject is already proven (`READY_FOR_CUSTOMER_HANDOFF`). This audit isolates UX gaps that cause operators to reconstruct money truth from Payments / Booking / Meaning.

## Contract

**In scope:** pending queue, identity, payment association, proof, amount/date, classic approve/reject, reject note, partial collection comprehension, remaining balance display (existing invoice read model), booking payment sync feedback, registration-preserving navigation.

**Out of scope:** prepayments, installments, online capture, refunds, bulk/auto actions, new Command Bridge commands, FinanceService redesign, Case persistence/mutation, new policies/APIs/SoT.

---

## 1. Actual Receipts implementation map

| Surface | Path / file | Role |
| --- | --- | --- |
| Receipts tab | `/finance?tab=receipts` → `FinanceReceiptsPanel` | Primary FC review UI |
| Pending list | `GET /api/finance/receipts/pending` | Queue (scoped by `registrationId` / `tourId`) |
| Receipt “detail” | **Inline row only** — no separate route | Inspect + act in place |
| Proof preview | `GET /api/finance/receipts/:id/url` | Evidence |
| Classic approve/reject | `PATCH /api/finance/receipts/:id/review` | Mutation via FinanceService |
| Review response | `bookingPaymentStatus?: unpaid\|partial\|paid` | Returned; barely used in UI |
| Invoice balance | `GET /api/finance/invoices/:registrationId` | **Exists; not on Receipts** |
| Payments list | Payments tab + strip | History (not on Receipts) |
| Booking strip | `BookingFinancialStrip` | Invoice + payments on booking |
| Overview → Receipts | Attention href **with** `registrationId` (PR21-B1) | Discovery |
| Booking → Receipts | `href="/finance?tab=receipts"` **without** registrationId | Context drop |
| Meaning Command UI | `FinanceCaseCommandReviewReceiptUi` | Advanced / flagged |
| Portal upload | `apps/portal/.../member-receipt-upload-form` | Member ingress |

**No dedicated receipt detail page.**

Primary path:

```text
classic FinanceReceiptsPanel → PATCH /api/finance/receipts/:id/review
```

Secondary path:

```text
Meaning Command UI (tenant-flagged) → POST /api/finance/case/commands/review-receipt
```

Invoice reuse (existing):

```text
FinanceInvoiceBalanceCard / fetchRegistrationInvoice
```

---

## 2. Operator journey map

```text
Portal: member uploads proof
  → Receipt Pending
  → Operator: Overview attention / Booking hint / Receipts tab
  → Inline row: amount, who/tour, date, proof, Approve|Reject
  → PATCH review
  → List refresh; router.refresh ONLY if bookingPaymentStatus === "paid"
  → Booking badge / invoice may lag on partial
```

| Stage | Knows | Missing | Inspect | Decide | Act | After | Next |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Discover | Queue + identity + amount | Remaining, history | Row / booking link | Which receipt | Open row | — | Inspect |
| Inspect | Proof, amount, note, member/tour | Obligation, paid, remaining, consequence | Proof + booking | Approve? | Approve/Reject | Status changes SoT | Verify (weak) |
| After approve | Row gone after refresh | Explicit “now partial/paid, remaining X” | Must leave panel | — | — | Partial refresh gap | Another payment or idle |
| After reject | Row gone | “Reuse Pending payment; member re-uploads” | — | — | — | Booking unpaid | Wait member |

---

## 3. Review comprehension checklist

| # | Question | Status | Evidence |
| - | -------- | ------ | -------- |
| 1 | Who? | **PRESENT** | `registrationContext.memberDisplayName` |
| 2 | Which registration? | **PRESENT** | Identity + booking link |
| 3 | Which tour? | **PRESENT** | `tourTitle` |
| 4 | Which payment? | **PARTIAL** | `paymentId` / `payment.id` in data; **not shown** |
| 5 | Submitted amount? | **PRESENT** | `payment.amount` |
| 6 | Paid to date? | **MISSING** (UI) | **EXISTING** invoice `paidAmountMinor` |
| 7 | Total obligation? | **MISSING** (UI) | **EXISTING** `invoiceTotalMinor` |
| 8 | Remaining balance? | **MISSING** (UI) | **EXISTING** `balanceDueMinor` |
| 9 | Under/exact/over? | **MISSING** | Derivable: amount vs balanceDue (**EXISTING**) |
| 10 | Eligible for approval? | **PARTIAL** | Backend enforces; UI no pre-check |
| 11 | Approve consequence? | **MISSING** | Response has `bookingPaymentStatus`; UI ignores except `paid` refresh |
| 12 | Reject consequence? | **MISSING** | No copy; unpaid + Pending reuse is DOC-level |
| 13 | Other receipts/payments? | **MISSING** | Payments API with `registrationId` **EXISTING** |
| 14 | After rejection? | **MISSING** | Hint only in handoff docs |
| 15 | Who owns next action? | **MISSING** on Receipts | Meaning only |

---

## 4. Navigation / context map

| From → To | Context preserved? | Issue |
| --- | --- | --- |
| Overview attention → Receipts | **Yes** (`registrationId`) | Fixed in PR21-B1 |
| Booking unpaid/partial hint → Receipts | **No** | `/finance?tab=receipts` bare |
| Strip “Receipts” link | **Yes** | `withFinanceRegistrationQuery` |
| Receipts → Booking | **Yes** | `financeBookingHref` |
| Receipts → Meaning | **No link** | Must switch view + have filter |
| Receipts → Payments | **No in-row link** | Manual tab switch |
| After approve (partial) | Stays on Receipts | No result banner; booking may be stale |
| After approve (paid) | `router.refresh()` | Better than partial |

**Rule:** Never lose registration context when moving from a case-specific signal to Finance.

---

## 5. Approve / reject state machine UX

| Concern | Classic path | Notes |
| --- | --- | --- |
| Double-click | `busy` disables buttons | OK |
| Approve idempotency | `Idempotency-Key` header | OK |
| Reject idempotency | No key | Usually OK |
| Loading | Buttons disabled; no “Approving…” label | Weak |
| Success feedback | None (row disappears on refresh) | Weak |
| Failure | Generic `REVIEW_RECEIPT_FAILED` / HTTP code | Overpay/auth not distinguished in copy |
| Confirm step | **None** | Immediate click = mutate |
| Stale row | Removed after list refresh | OK |
| Partial result | `bookingPaymentStatus` parsed, unused in UI | Gap |
| Command path | Confirm required; Meaning refresh | Better confirm; different UX |

Backend behavior must not change; UX only wraps existing contracts.

---

## 6. Partial collection UX

SoT supports underpay → partial → … → paid. **Receipts UI does not narrate it.**

| Need | On Receipts? |
| --- | --- |
| See remaining before approve | No (invoice unused) |
| See “this capture vs remaining” | No |
| After approve: “now partial, remaining X” | No |
| History of prior Paid payments | No (Payments tab / strip only) |

**Class:** CUSTOMER_RISK (wrong amount judgment) + UX_IMPROVEMENT (post-result clarity).  
**Mitigation today:** HTTP 422 overpay — not comprehension.

---

## 7. Classic vs Command

| | Classic Receipts | Command UI (Meaning) |
| --- | --- | --- |
| First-customer primary? | **Yes** | No — flagged / advanced |
| Obvious? | Tab “Receipts” | Buried under Meaning + technical chrome |
| Accidental wrong path? | Low if operators stay Operational | Possible if they open Meaning Command |
| SoT outcome | FinanceService review | Same authority via bridge |
| Confirm | No | Yes |
| Refresh | List + paid-only `router.refresh` | Forces Meaning re-execute |
| Failure vocabulary | Generic | Structured failure classes |

**Recommendation:** Classic remains primary; do not remove Command; optionally label advanced. **Do not add a third path.**

---

## 8. Findings (classified)

### BLOCKER

**None** — FC receipt workflow operates end-to-end.

### CUSTOMER_RISK

1. Approve without visible obligation / paid / remaining / under-exact-over framing.
2. Booking → Receipts drops `registrationId` (wrong-queue risk under load).
3. No explicit approve consequence (partial vs paid) before/after click.

### INFORMATION_ARCHITECTURE

4. Action-first row (proof + buttons) before money package.
5. Dual review paths without “primary = Receipts” framing on Receipts itself.
6. No Receipts → Payments/Meaning shortcuts with registration scope.

### UX_IMPROVEMENT

7. Success/result banner using `bookingPaymentStatus` (+ remaining via invoice).
8. `router.refresh()` on **partial** as well as paid.
9. Show payment id/status/method already in payload.
10. Approving… / Rejecting… busy labels; optional light confirm.
11. Distinct error copy for overpay / already-reviewed / auth (map existing codes only).

### DOCUMENTATION

12. Reject → reuse Pending payment / member re-upload not in UI copy.

### NON_BLOCKING

13. SSR receipts prefetch unused.
14. Command UI shows raw receipt UUIDs.

---

## 9. Priority matrix

| Priority | Finding | Class | Existing data? | Effort | Impact |
| --- | --- | --- | --- | --- | --- |
| **P0** | Embed invoice package on receipt row | CUSTOMER_RISK | **Yes** `FinanceInvoiceBalanceCard` | S | High |
| **P0** | Booking hint preserve `registrationId` | CUSTOMER_RISK | Yes helper | S | High |
| **P0** | Show expected result / under-exact framing | CUSTOMER_RISK | Yes invoice + payment.amount | S–M | High |
| **P1** | Post-review result banner | UX | Yes review response + invoice | S | High |
| **P1** | `router.refresh()` on partial too | UX | Yes | S | Med |
| **P1** | Surface payment status; reject-next-step copy | UX / DOC | Yes payload | S | Med |
| **P1** | Label classic as primary review path | IA | Copy only | S | Med |
| **P2** | Compact payment history | UX | Yes payments API | M | Med |
| **P2** | Meaning secondary link from row | IA | Yes href builder | S | Low–Med |
| **P2** | Confirm dialog / busy labels | UX | — | S | Low–Med |

---

## 10. Smallest safe implementation — PR21-C1

**Name:** Receipts review context + registration-preserving booking link + result feedback

**In scope (web presentation only):**

1. On each `ReceiptRow` with `registrationId`: render existing `FinanceInvoiceBalanceCard`.
2. Compact compare: payment amount vs `balanceDueMinor` (under / matches remaining / exceeds — client display only; SoT still enforces).
3. After successful review: show result using `bookingPaymentStatus`; call `router.refresh()` for **partial and paid**; refresh list.
4. Fix Booking → Receipts: `withFinanceRegistrationQuery("/finance?tab=receipts", booking.id)`.
5. Short copy: reject → member re-uploads; reuse Pending payment.
6. Show payment status badge from existing `payment.status`.
7. One-line hint: classic Operational Receipts is primary; Command Bridge remains under Commercial Meaning.

**Out of scope:** FinanceService, policies, Case/Command changes, new APIs, prepay/installments, Payments/Meaning redesign, third review path.

**Why safe:** Reuses invoice + review response already shipped; no new SoT.

---

## Final verdict

**READY_FOR_RECEIPTS_UX_IMPLEMENTATION**

---

## PR21-D — deep UX refinement

```yaml
pr: PR21-D
status: IMPLEMENTED
focus: Receipts operator scanability, money glance, proof progressive disclosure, decision-bound consequence, FA copy
verdict: READY_FOR_PR21_E_AUDIT
```

### Audit (implementation-based, pre-fix)

| Question | Pre-PR21-D answer |
| --- | --- |
| Notice first? | Identity + stacked invoice card + fit box — equal visual weight |
| Person immediate? | Yes (`FinanceRegistrationIdentity`) |
| Amount immediate? | Partial — labeled but competing with invoice grid |
| Remaining immediate? | Yes but duplicated (card + fit box) |
| Partial/final immediate? | Yes but as a second bordered block |
| Proof without losing context? | Yes, but always open — kills scan of 20 rows |
| Approve/reject without hunting? | Yes at bottom of tall row |
| Post-approve clarity? | Banner exists; FA leaked `unpaid` |
| Process 20 efficiently? | **No** — information wall |

### Changes shipped

1. **Compact money glance** — single `TOTAL / PAID / REMAINING` row + submitted amount + fit badge; removed stacked `FinanceInvoiceBalanceCard` + hint paragraph wall (one invoice fetch per row).
2. **After-approve preview** — “After approve → X left” / “paid in full” under the glance (presentation math only).
3. **Decision-bound consequence** — consequence line sits immediately above Approve/Reject.
4. **Collapsible proof** — collapsed by default; expand loads preview in-place; full-size remains optional.
5. **Reject demotion** — `ghost` variant so Approve stays primary without hiding Reject.
6. **FA/EN copy** — operator vocabulary; no Latin `unpaid` in FA results; quieter primary-path hint.
7. **Shorter row chrome** — date/method demoted to meta line; taller list skeletons.

### Locks confirmed

FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged.
