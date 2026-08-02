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

Composition may throw `FINANCE_WORKSPACE_UNSUPPORTED: workspaceType=urban` (diagnostic suffix). HTTP
mapping must strip to the stable code (**404**, no 500) — see `handleHttpError` early branch and
`docs/phase-15/operator-dashboard-runtime.mdoc` (P15-P-A2 finance HTTP strip).

### Memory driver (`STORAGE_DRIVER=memory`, no `DATABASE_URL`)

Local dev without Postgres must not return **500** on read-only finance report routes documented in SMK-P9-09.

| Layer | Behavior |
| ----- | -------- |
| `assertFinanceWorkspaceGate` | When `canResolveDevTenantRegistryFallback()` is true, resolve `workspaceType` + `theme` from static `DEV_TENANTS` (`findTenantById`) instead of `getPrismaAdmin().tenant.findUnique`. |
| Finance repository factory | `resolveStorageDriver() === "memory"` → `InMemoryFinanceRepository` (zeros for `getSummary`, empty arrays for list reads). |
| Prisma path | Unchanged — `FinanceRepository` (Prisma) + RLS via `withTenantRls`. |

Dashboard KPI strip (`GET /finance/reports/summary` BFF) therefore returns `{ pendingManualPayments: 0, pendingReceiptReviews: 0, paidPayments: 0, failedPayments: 0 }` until `DATABASE_URL` is configured.

---

## Host bootstrap (trunk)

`apps/api/src/app.ts` **must** side-effect-import before request dispatch:

```typescript
import "./http/configure-denali-finance-http-host";
import "./http/configure-urban-http-host";
```

Those modules call `configureDenaliFinanceHttpHost` / `configureUrbanHttpHost` at load time, wiring host ports (`resolveFinanceService`, `sendJson`, tenant context). Without them, Denali finance handlers call `getDenaliFinanceHttpHost()` unconfigured and every finance route returns **500** `INTERNAL_ERROR`.

R2 handlers (`handleFinanceListPrepayments`, `handleFinanceRecordPrepayment`, schedule handlers) must be re-exported from `packages/workspaces/denali/src/http/routes.ts` and the package rebuilt (`pnpm --filter @app-tour/workspace-denali run build`) — lazy import in `lazy-workspace-finance-handlers.ts` reads **dist**, not TypeScript source.

Workspace-product routes (urban catalog/settings + Denali finance) dispatch through `tryDispatchWorkspaceRoutes` in `dispatchRequest` — after core identity/bookings/settings routes, before the final 404.

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
| `createManualPayment`   | POST   | `/finance/payments/manual`             | `finance.routes.ts` → `handleFinanceCreateManualPayment` | admin/owner · **`Idempotency-Key` required** (Phase 4B H1.2) |
| `submitPaymentReceipt`  | POST   | `/finance/receipts`                    | `finance.routes.ts` → `handleFinanceSubmitReceipt`       | admin/owner/member\* · **`Idempotency-Key` required** (Phase 4B H1.2) |
| `reviewPaymentReceipt`  | PATCH  | `/finance/receipts/{receiptId}/review` | `finance.routes.ts` → `handleFinanceReviewReceipt`       | admin/owner · **`Idempotency-Key` required when `decision=approve`** (400 `IDEMPOTENCY_KEY_REQUIRED`); Prisma single RLS TX — see [P7-FINANCE-PATH-BOUNDARY.md](../../phase-20/p7/appendices/P7-FINANCE-PATH-BOUNDARY.md) Phase 3B |
| `getReceiptDownloadUrl` | GET    | `/finance/receipts/{receiptId}/url`    | `finance.routes.ts` → `handleFinanceReceiptUrl`          | admin/owner          |

\* Member scoped to own registration manual payment (legacy parity).

### List query + registration context (Phase B)

| Query | Applies to | Behavior |
| ----- | ---------- | -------- |
| `limit` | list endpoints (existing) | unchanged caps |
| `registrationId` | `GET /finance/payments` · `…/receipts/pending` · `…/prepayments` · `…/reports/ledger-events` · `…/schedules` | Optional UUID. After **tenant-scoped** list, keep only matching `registrationId`. Invalid UUID → `ZOD_VALIDATION_FAILED`. |

List item enrichment (optional, backward compatible):

```json
{
  "registrationContext": {
    "registrationId": "uuid",
    "tourId": "uuid",
    "tourTitle": "North Ridge",
    "memberDisplayName": "Guest label"
  }
}
```

Loaded via bookings `getByIds` under RLS in `workspace-finance` — see FINANCE-OPS-UX §5.0b.

---

## Dispatch operations — Invoice & prepayment (R2)

| operationId              | Method | Path                                 | Handler                                        | Actor       |
| ------------------------ | ------ | ------------------------------------ | ---------------------------------------------- | ----------- |
| `getRegistrationInvoice` | GET    | `/finance/invoices/{registrationId}` | `finance.routes.ts` → `handleFinanceGetRegistrationInvoice` | admin/owner |
| `recordPrepayment`       | POST   | `/finance/prepayments`               | `finance.routes.ts` → `handleFinanceRecordPrepayment`         | admin/owner · **`Idempotency-Key` required** (400 `IDEMPOTENCY_KEY_REQUIRED`); single RLS TX for ledger + `finance.prepayment.recorded` — see [P7-FINANCE-PATH-BOUNDARY.md](../../phase-20/p7/appendices/P7-FINANCE-PATH-BOUNDARY.md) Phase 3A |
| `listPrepayments`        | GET    | `/finance/prepayments`               | `finance.routes.ts` → `handleFinanceListPrepayments`          | admin/owner |

Invoice response (derived read model — trunk compiles from schedule sum + wallet credits):

```json
{
  "registrationId": "uuid",
  "currency": "IRR",
  "invoiceTotalMinor": "10000000",
  "paidAmountMinor": "3000000",
  "balanceDueMinor": "7000000",
  "walletNetMinor": "3000000"
}
```

Balance math lives in `apps/api/src/denali-finance/compile-invoice-balances.ts`:

- `walletNetMinor` = sum(prepayment outbox) + sum(paid manual payments)
- `invoiceTotalMinor` = sum(schedule items) when schedule exists, else sum(all payment amounts)
- `paidAmountMinor` = `min(walletNetMinor, invoiceTotalMinor)`
- `balanceDueMinor` = `invoiceTotalMinor − paidAmountMinor`

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
