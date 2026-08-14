# Denali Receipt Pending Vocabulary — PR21-H2

```yaml
doc_id: DENALI_FINANCE_RECEIPT_PENDING_VOCAB_PR21_H2
version: "2026-08-09-v2"
status: READY_FOR_REVIEW
phase: PR21-H2
continues:
  - DENALI_FINANCE_BOOKING_PAYMENT_VOCAB_PR21_H1
locks:
  - Presentation / i18n only
  - No API, DB, finance-core, FinanceService, SoT, state-machine, or new fetches
  - Preserve existing receipt review workflow (approve/reject paths unchanged)
scope: apps/web finance (+ dashboard KPI) receipt-pending labels
```

## 1. UX audit — before / after

| Surface | Before | After |
| ------- | ------ | ----- |
| Receipt queue badge `receipts.status.Pending` | در انتظار / Pending | در انتظار بررسی (فیش) / Pending review (receipt) |
| Payment row `payments.status.Pending` | در انتظار (این پرداخت) | **unchanged** |
| Empty queue `receipts.empty` | فیشی در انتظار بررسی نیست / No receipts awaiting review | **kept** (already review-scoped) |
| Command Bridge loader | Loading pending receipts… / …رسیدهای در انتظار… | Loading receipts awaiting review… / …فیش‌های در انتظار بررسی… |
| Dashboard KPI FA | رسید در انتظار | رسیدهای در انتظار بررسی |

## 2. Files changed

| File | Change |
| ---- | ------ |
| `docs/phase-20/p7/appendices/DENALI_FINANCE_RECEIPT_PENDING_VOCAB_PR21_H2.md` | This pack |
| `apps/web/messages/fa/finance.json` | Receipt Pending + bridge loader |
| `apps/web/messages/en/finance.json` | Receipt Pending + bridge loader |
| `apps/web/messages/fa/dashboard.json` | KPI `pending-receipts` |
| `apps/web/src/finance/finance-receipts-logic.ts` | `receiptStatus` test id |
| `apps/web/src/finance/finance-receipts-panel.tsx` | Wire receipt/payment status test attrs |
| `apps/web/test/finance-receipt-pending-vocab-pr21h2.spec.ts` | Focused vocab tests |

## 3. Vocabulary mapping

| Concept | Key | FA | EN |
| ------- | --- | -- | -- |
| Receipt pending | `finance.receipts.status.Pending` | در انتظار بررسی (فیش) | Pending review (receipt) |
| Payment pending | `finance.payments.status.Pending` | در انتظار (این پرداخت) | Pending (this payment) |
| Empty queue | `finance.receipts.empty` | فیشی در انتظار بررسی نیست. | No receipts awaiting review. |
| Bridge loader | `finance.commandBridge.loadingReceipts` | در حال بارگذاری فیش‌های در انتظار بررسی… | Loading receipts awaiting review… |
| Dashboard KPI | `dashboard.finance.kpi.pending-receipts` | رسیدهای در انتظار بررسی | Receipts awaiting review |

## 4. Safety report

| Check | Result |
| ----- | ------ |
| Pending payment ≠ pending receipt | Pass — distinct strings EN/FA |
| SoT / API / finance-core unchanged | Pass |
| No new fetches | Pass — i18n + test ids only |
| Receipt workflow preserved | Pass — same approve/reject paths |
| Existing finance tests green | Pass — 31/31 with H1/E/F/G1 |

## 5. Tests

```text
node --import tsx --test \
  test/finance-receipt-pending-vocab-pr21h2.spec.ts \
  test/finance-receipts-pr21g1.spec.ts \
  test/finance-payments-panel-pr21e.spec.ts \
  test/bookings-payment-vocab-pr21h1.spec.ts \
  test/finance-booking-strip-pr21f.spec.ts
→ 31/31 pass
```

## 6. Live FA (denali.admin.localhost)

| Check | Result |
| ----- | ------ |
| Empty queue | «فیشی در انتظار بررسی نیست.» |
| Payments tab | «در انتظار (این پرداخت)» present; no receipt-label leak |
| Receipt row (after submit on pending payment) | Badge «در انتظار بررسی (فیش)» + payment badge «در انتظار (این پرداخت)» on same card |

## Verdict

**READY_FOR_REVIEW** — Receipt pending language is review-scoped; payment pending remains payment-scoped; empty copy already described absence of receipts awaiting review; focused tests + live FA confirm distinction.
