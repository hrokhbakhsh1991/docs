# Phase 9.7 — Finance Denali API dispatch addendum

```yaml
addendum_id: DISPATCH-P9-FINANCE
version: "2026-06-08-v3"
prior_version: "2026-06-08-v2"
authority: FINANCE-OPS-UX.md · subphases/9.7-finance-denali.md · INV-P9-006 · DEC-P9-016 · DEC-P9-017
target: apps/api/src/openapi/dispatch-routes.ts
trunk_r1_handlers: packages/workspaces/denali/src/http/finance.routes.ts
trunk_r1_host: apps/api/src/http/configure-denali-finance-http-host.ts
```

> **Trunk R1 note:** HTTP handlers are consolidated in `finance.routes.ts` + `finance.service.ts`. Per-operation handler filenames below are **logical operation IDs** for future file split — not separate files on trunk yet.

## Workspace gate

All routes below require:

1. `resolveWorkspaceTypeForTenant(tenantId) === 'denali'`
2. Tenant `enabled_modules` includes `finance` (where noted)
3. Operator CASL per route (`isAdminOrOwner` default for mutate)

Urban → **404** `FINANCE_WORKSPACE_UNSUPPORTED`.

---

## Dispatch operations — Reports (R1)

| operationId               | Method | Path                             | Handler                                           | Actor       |
| ------------------------- | ------ | -------------------------------- | ------------------------------------------------- | ----------- |
| `getFinanceSummary`       | GET    | `/finance/reports/summary`       | `finance.routes.ts` → `handleFinanceSummary`      | admin/owner |
| `listFinanceOpenPayments` | GET    | `/finance/reports/open-payments` | `finance.routes.ts` → `handleFinanceOpenPayments` | admin/owner |
| `listFinanceLedgerEvents` | GET    | `/finance/reports/ledger-events` | `finance.routes.ts` → `handleFinanceLedgerEvents` | admin/owner |

Response schema (summary): [`schemas/FINANCE-SUMMARY.schema.json`](schemas/FINANCE-SUMMARY.schema.json).

---

## Dispatch operations — Payments & receipts (R1)

| operationId             | Method | Path                                   | Handler                                                  | Actor                |
| ----------------------- | ------ | -------------------------------------- | -------------------------------------------------------- | -------------------- |
| `listFinancePayments`   | GET    | `/finance/payments`                    | `finance.routes.ts` → `handleFinanceListPayments`        | admin/owner          |
| `createManualPayment`   | POST   | `/finance/payments/manual`             | `finance.routes.ts` → `handleFinanceCreateManualPayment` | admin/owner          |
| `submitPaymentReceipt`  | POST   | `/finance/receipts`                    | `finance.routes.ts` → `handleFinanceSubmitReceipt`       | admin/owner/member\* |
| `reviewPaymentReceipt`  | PATCH  | `/finance/receipts/{receiptId}/review` | `finance.routes.ts` → `handleFinanceReviewReceipt`       | admin/owner          |
| `getReceiptDownloadUrl` | GET    | `/finance/receipts/{receiptId}/url`    | `finance.routes.ts` → `handleFinanceReceiptUrl`          | admin/owner          |

\* Member scoped to own registration manual payment (legacy parity).

---

## Dispatch operations — Invoice & prepayment (R2)

| operationId              | Method | Path                                 | Handler                                        | Actor       |
| ------------------------ | ------ | ------------------------------------ | ---------------------------------------------- | ----------- |
| `getRegistrationInvoice` | GET    | `/finance/invoices/{registrationId}` | `denali-finance/invoices.get.handler.ts`       | admin/owner |
| `recordPrepayment`       | POST   | `/finance/prepayments`               | `denali-finance/prepayments.record.handler.ts` | admin/owner |
| `listPrepayments`        | GET    | `/finance/prepayments`               | `denali-finance/prepayments.list.handler.ts`   | admin/owner |

Prepayment body:

```json
{
  "registrationId": "uuid",
  "amountMinor": "5000000",
  "currency": "IRR",
  "method": "Manual",
  "note": "optional"
}
```

---

## Dispatch operations — Installment schedule (R2-R3)

| operationId               | Method | Path                                                 | Handler                                          | Actor       |
| ------------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------ | ----------- |
| `getPaymentSchedule`      | GET    | `/finance/schedules/{registrationId}`                | `denali-finance/schedules.get.handler.ts`        | admin/owner |
| `generatePaymentSchedule` | POST   | `/finance/schedules/generate`                        | `denali-finance/schedules.generate.handler.ts`   | admin/owner |
| `patchScheduleItem`       | PATCH  | `/finance/schedules/{registrationId}/items/{itemId}` | `denali-finance/schedules.patch-item.handler.ts` | admin/owner |

Item schema: [`schemas/PAYMENT-SCHEDULE-ITEM.schema.json`](schemas/PAYMENT-SCHEDULE-ITEM.schema.json).

Generate body:

```json
{
  "registrationId": "uuid",
  "template": {
    "depositPercent": 30,
    "installmentCount": 3,
    "graceDays": 7,
    "firstDueAt": "2026-07-01T00:00:00Z"
  }
}
```

**Validation:** `sum(items.amountMinor) === invoiceTotalMinor` or **422** `SCHEDULE_INVOICE_MISMATCH`.

---

## Dispatch operations — Reconciliation (R1)

| operationId                        | Method | Path                                             | Handler                     | Actor                 |
| ---------------------------------- | ------ | ------------------------------------------------ | --------------------------- | --------------------- |
| `listReconciliationFindings`       | GET    | `/workspaces/{tenantId}/reconciliation-findings` | adapter to legacy semantics | Reconciliation read   |
| `acknowledgeReconciliationFinding` | POST   | `.../findings/{id}/acknowledge`                  | same                        | Reconciliation manage |
| `applyReconciliationAdjustment`    | POST   | `.../findings/{id}/apply-adjustment`             | same                        | Reconciliation manage |

Web surface: `(app)/settings/reconciliation-triage`.

---

## Forbidden (P9-F-008)

- No registration under `apps/api/src/modules/finance/**`
- No finance handlers in `packages/workspaces/urban/**`
- No ledger persistence outside outbox enqueue (TQ-P9-006)

---

## Literal insertion block

```typescript
export const FINANCE_OPERATOR_DISPATCH = [
  {
    operationId: "getFinanceSummary",
    method: "GET",
    path: "/finance/reports/summary",
    handler: "@app-tour/workspace-denali/http#handleFinanceSummary",
  },
  {
    operationId: "createManualPayment",
    method: "POST",
    path: "/finance/payments/manual",
    handler: "@app-tour/workspace-denali/http#handleFinanceCreateManualPayment",
  },
  {
    operationId: "recordPrepayment",
    method: "POST",
    path: "/finance/prepayments",
    handler: "denali-finance/prepayments.record.handler",
  },
  {
    operationId: "generatePaymentSchedule",
    method: "POST",
    path: "/finance/schedules/generate",
    handler: "denali-finance/schedules.generate.handler",
  },
] as const;
```
