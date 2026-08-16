# Outstanding balance read model (PR23-D1)

```yaml
doc_id: FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1
version: "2026-08-16-v2"
status: READY_FOR_PR23_D2
phase: PR23-D1
related:
  - docs/phase-20/p7/appendices/FINANCE_EXCEPTION_OPERATOR_UI_PR23_C3.md
  - docs/workspaces/denali/registration-payment-orchestration.mdoc
locks:
  mutation: forbidden
  balance_sot: registration_invoice_compile_only
  ledger_as_ar: forbidden
  payment_sum_as_debt: forbidden
  online_gateway: out_of_scope
  collection_mode: manual_offline_first
  candidate_source: operator_registrations
  candidate_not: payment_rows
```

## Purpose

First AR capability: **who owes money and how much?**

Read-only list of registrations with `invoice.balanceDueMinor > 0`, compiled from Invoice SoT.

## Manual collection boundary

Denali Finance is **manual/offline collection first**.

Payment lifecycle in scope:

```text
Manual Payment → Pending → Receipt review → Paid
                 Pending → Cancelled
```

**Out of scope for this slice (and product boundary):**

- Online payment gateway / PSP / card flows
- External payment intents
- Gateway Failed lifecycle
- Capture / refund flows

## Invoice as AR SoT

| Field | Source |
| ----- | ------ |
| `invoice.totalMinor` | `compileRegistrationInvoice.invoiceTotalMinor` |
| `invoice.paidMinor` | `compileRegistrationInvoice.paidAmountMinor` |
| `invoice.remainingMinor` | `compileRegistrationInvoice.balanceDueMinor` |

Forbidden:

- summing payment rows to invent debt
- using ledger as AR
- treating Cancelled payments as the debt source (invoice remains authoritative)
- a second settlement model

## Read pipeline

```mermaid
flowchart LR
  HTTP["GET /finance/reports/outstanding-balances"] --> SVC["FinanceService.listOutstandingBalances"]
  SVC --> OUT["finance-outstanding-operator.loadOutstandingBalanceItems"]
  OUT --> REPO["listOutstandingBalanceCandidates"]
  OUT --> INV["compileRegistrationInvoiceInternal via finance-read-enrichment"]
  OUT --> DISP["registrationDisplay"]
  SVC --> PAGE["paginateOutstandingBalanceItems"]
```

D1 load + identity attach live in `packages/finance-core/src/application/finance-outstanding-operator.ts`.
Shared read helpers (`tryCompileRegistrationInvoiceInternal`, booking payment status, identity attach)
are in `finance-read-enrichment.ts` (same module as exceptions).

```text
HTTP GET /finance/reports/outstanding-balances
  → FinanceService.listOutstandingBalances(auth, { cursor?, limit? })
      → gate + assertOperatorAccess
      → loadOutstandingBalanceItems(deps, tenantId)
           repository.listOutstandingBalanceCandidates(tenantId)
           registrationId + occurredAt (registration createdAt / candidate clock)
      → for each candidate:
           invoice ← compileRegistrationInvoiceInternal (facts + obligation + schedule)
           keep only isPositiveBalanceDueMinor(balanceDueMinor)
           bookingPaymentStatus ← IBookingPaymentPort.getPaymentStatus (nullable)
           identity ← RegistrationDisplayPort
      → paginateOutstandingBalanceItems (occurredAt ASC, registrationId ASC)
  → { items, nextCursor, hasMore }
```

## Candidate universe (2026-08-16 lock)

`listOutstandingBalanceCandidates` enumerates **operator registrations** for the tenant, not payment rows.

| Driver | Source | `occurredAt` |
| ------ | ------ | ------------ |
| Prisma | `operatorRegistration.findMany({ tenantId })` | `createdAt` |
| Memory (dev/test) | bookings `listByTenantPage` until exhausted (same universe, uncapped via paging) | `submittedAt` (booking clock; no separate `createdAt` on the memory record) |

**Forbidden candidate sources:** scanning `payments` / `paymentsById` as the universe. A Manual Payment row is a collection artifact, not the AR identity. Under Denali `approve_then_offline_pay`, club approve creates **no** payment row; the member has not uploaded a receipt yet. That guest still owes — invoice compile + obligation must keep them.

Inclusion after candidate load is unchanged: `compileRegistrationInvoice` remaining `> 0` only. Zero-remaining / paid registrations stay absent. Drivers must not diverge: memory omitting a registration that Prisma would emit is a product defect (PAY-FIN-02).

Memory tests that construct `InMemoryFinanceRepository` without a bookings list may still fall back to payment-row clocks so payment-first D1 fixtures keep working. The composition-root memory factory **must** inject bookings so the live memory API matches Prisma.

## Ordering / cursor

1. Inclusion: remaining > 0 only (“remaining exists” gate)
2. Within page universe: `occurredAt ASC`, then `registrationId ASC`
3. Opaque keyset cursor: `occurredAt` + `registrationId`
4. No offset pagination; do not sort by payment rows

## HTTP / BFF

- API: `GET /finance/reports/outstanding-balances?limit=&cursor=`
- BFF: `apps/web/app/api/finance/reports/outstanding-balances`

## Next

PR23-D2 — tour-level collection aggregation **from this outstanding model** (not from payment pending counts).

## Status

`READY_FOR_PR23_D2`
