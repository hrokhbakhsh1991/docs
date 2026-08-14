# Pending manual payment cancel — UI (PR23-A4)

```yaml
doc_id: FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_UI_PR23_A4
version: "2026-08-09-v1"
status: IMPLEMENTED
phase: PR23-A4
related:
  - docs/phase-20/p7/appendices/FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_PR23_A2.md
  - docs/phase-20/p7/appendices/FINANCE_PENDING_MANUAL_PAYMENT_CANCEL_HTTP_PR23_A3.md
  - apps/web/src/finance/finance-payments-panel.tsx
  - apps/web/src/finance/finance-payments-logic.ts
locks:
  domain_authority: FinanceService only
  ui_mutation_path: POST /api/finance/payments/:paymentId/cancel → API cancel
  finance_core_change: forbidden
  failed_semantics_reuse: forbidden
```

## Principle

UI is presentation + transport only. Cancellation semantics (guards, audit, debt gate)
live in FinanceService. The Payments panel calls the BFF cancel route; the BFF proxies
`POST /finance/payments/:paymentId/cancel` with `Idempotency-Key`.

## When the cancel action appears

Visible only when **all** hold:

| Check | Value |
| ----- | ----- |
| Operator can manage | admin/owner |
| `method` | `Manual` |
| `status` | `Pending` |
| Pending receipt on that payment | **none** (from scoped pending-receipts list) |

Hidden for Paid / Cancelled / Failed / non-Manual / pending-receipt rows.

Cancel is a **secondary** control (`لغو پرداخت` / “Cancel payment”) — never the primary CTA.

## Confirmation + reasons

Dialog requires a domain `reasonCode`:

| Code | FA | EN |
| ---- | -- | -- |
| `abandoned` | رها شده | Abandoned |
| `wrong_amount` | مبلغ اشتباه | Wrong amount |
| `superseded` | جایگزین شده | Superseded |
| `other` | سایر | Other |

`reasonNote` required when `other`. No frontend-only reason vocabulary.

## Vocabulary

| Status | FA | EN |
| ------ | -- | --- |
| Pending | در انتظار (این پرداخت) | Pending (this payment) |
| Cancelled | لغوشده (پرداخت دستی) | Cancelled (manual payment) |
| Failed | ناموفق (این پرداخت) — reserved | Failed (this payment) — reserved |

Do **not** label Cancelled as failed / unsuccessful / refunded.

## HTTP handling (client)

| Status | UI |
| ------ | -- |
| 200 | Update row → Cancelled; toast/banner success; refresh scoped lists + registration caches |
| 409 | Conflict copy (paid / pending receipt / not cancellable); refresh |
| 400 | Invalid reason |
| 404 | Unavailable / out of scope |

## Explicit non-goals

No refund UI, no Failed mapping, no receipt auto-reject, no booking settlement controls,
no finance-core changes.
