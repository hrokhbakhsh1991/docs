# Refund domain + invoice integration — implementation contract (PR23-E2)

```yaml
doc_id: FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2
version: "2026-08-09-v3"
status: IMPLEMENTED
phase: PR23-E2
implemented_paths:
  - packages/finance-core/src/domain/refund/
  - packages/finance-core/src/domain/compile-invoice-balances.ts
  - packages/finance-core/src/application/finance.service.ts
  - packages/finance-core/src/ports/finance-repository.port.ts
  - packages/finance-core/src/ports/finance-ar-observation.port.ts
  - packages/finance-core/test/isolation/in-memory-finance.repository.ts
  - packages/finance-core/test/refund-domain-pr23e2.spec.ts
  - apps/api/prisma/schema.prisma (FinanceRefund)
  - apps/api/prisma/migrations/20260809120000_finance_refunds/
  - apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts
  - apps/api/src/workspace-finance/in-memory-finance.repository.ts
  - apps/api/src/finance/load-registration-invoice-facts.ts
  - external-finance-consumer/src/in-memory-repository.ts
  - packages/finance-core/test/external-consumer/adapters.ts
notes:
  - booking_reproject_on_complete: deferred_E3_followup
  - ar_hook: FinanceArObservationPort_afterRegistrationMoneyChanged
  - http_ui: forbidden_until_E3
verdict_after_tests: READY_FOR_PR23_E3
related:
  - docs/phase-20/p7/appendices/FINANCE_REFUND_BOUNDARY_PR23_E1.md
  - docs/phase-20/p7/appendices/FINANCE_REFUND_DOMAIN_MODEL_PR23_E2.md
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_PERSISTENCE_PR23_D3_B.md
  - packages/finance-core/src/domain/compile-invoice-balances.ts
  - packages/finance-core/src/application/finance.service.ts
locks:
  collection_mode: manual_offline_first
  online_gateway: forbidden
  multi_currency: forbidden_v1
  money_sot: registration_invoice_compile_only
  payment_rows: immutable_after_paid
  ledger: audit_only
  refund_money_gate: completed_only
  ui: forbidden_this_slice
  http: forbidden_this_slice
```

## Purpose

Implementation contract for **Refund aggregate + invoice compile integration** in FinanceService / finance-core.

Builds on E1 boundary + E2 domain model. **No operator UI. No HTTP routes. No PSP. No ledger redesign.**

After domain tests green → **READY_FOR_PR23_E3** (ops HTTP/UI).

---

## Product boundary (hard)

```text
Manual Payment → Pending → Receipt review → Paid
                 Pending → Cancelled

Refund (new) → Requested → [Approved?] → Completed
             → Rejected | Cancelled (no money)
```

Forbidden this slice: gateway/PSP, automatic payout, credit-wallet product, multi-currency, editing Paid amounts, negative Payment rows, ledger-as-refund-state, BFF money invention, Case mutation authority for refunds.

---

## Slice scope

| In | Out |
| -- | --- |
| Domain types + transition/cap helpers | Operator UI / refund dashboard |
| `FinanceRepositoryPort` refund methods | HTTP / BFF / manifest routes |
| FinanceService commands + reads (service-level) | PSP / payout / credit-note |
| `compileRegistrationInvoice` + facts `refundedMinor` | Ledger journal redesign |
| Complete → AR observe hook (D3-B compatible) | D3-C CSV / reporting E4 |
| Domain + regression specs | Schema micro-tuning beyond minimum persistence |

---

## 1. Refund aggregate

### Ownership

Finance-owned aggregate, parallel to Payment / receipt — **not** a Payment status, **not** booking column.

Recommended persistence: `finance_refunds` (Prisma + RLS), mapped `@@map("finance_refunds")`.

Logical PK: `(tenant_id, id)`. Indexes: `(tenant_id, registration_id)`, `(tenant_id, payment_id)` where payment_id not null, `(tenant_id, status)`.

### Logical fields

| Field | Required | Notes |
| ----- | -------- | ----- |
| `id` | yes | |
| `tenantId` | yes | RLS |
| `registrationId` | yes | |
| `paymentId` | optional | Required when `sourceKind = payment` |
| `sourceKind` | yes | `payment` \| `prepayment` |
| `amountMinor` | yes | Positive digit string |
| `currency` | yes | Must match registration invoice currency (IRR v1) |
| `reasonCode` | yes | Closed enum (below) |
| `reasonNote` | optional | Required when `reasonCode = other` |
| `status` | yes | `Requested` \| `Approved` \| `Rejected` \| `Completed` \| `Cancelled` |
| `requestedAt` / `requestedByUserId` | yes | |
| `approvedAt` / `approvedByUserId` | optional | |
| `rejectedAt` / `rejectedByUserId` / `rejectNote` | optional | |
| `cancelledAt` / `cancelledByUserId` | optional | |
| `completedAt` / `completedByUserId` | set on Complete | |
| `completionNote` | optional | |
| `evidenceFileKey` | optional | Same pattern as receipt `fileKey` (storage key) |
| `evidenceNote` | optional | Offline proof text |
| `creationIdempotencyKey` | recommended | Unique per tenant when present |

### Reason codes (v1)

`member_withdrawal` | `overpayment` | `ops_correction` | `other`

### Domain module placement

```text
packages/finance-core/src/domain/refund/
  types.ts                 # status, sourceKind, reasonCode, RefundRow shape
  transitions.ts           # assertAllowedTransition
  refundable-cap.ts        # registration + payment scoped caps
  (optional) validate-request.ts
```

Export via finance-core domain index / public API only what callers need (prefer service-owned surface).

---

## 2. Commands (FinanceService)

All commands: `gate(auth)` + `assertOperatorAccess`. Authority = FinanceService only (Case must not mutate refunds).

### Shared types (sketch)

```ts
type RequestRefundBody = {
  registrationId: string;
  sourceKind: "payment" | "prepayment";
  paymentId?: string;           // required iff sourceKind === "payment"
  amountMinor: string;
  reasonCode: RefundReasonCode;
  reasonNote?: string;
  evidenceFileKey?: string;
  evidenceNote?: string;
  idempotencyKey?: string;
};
```

### `requestRefund`

**Preconditions**

| Check | Fail closed |
| ----- | ----------- |
| `amountMinor` &gt; 0 | invalid amount |
| Currency = registration invoice currency | currency mismatch |
| `sourceKind = payment` | `paymentId` present; payment exists; `method = Manual`; `status = Paid` |
| `sourceKind = prepayment` | `paymentId` absent/null; registration has refundable prepayment headroom |
| Cap soft-check | `amount ≤ refundableRemaining` (registration + payment scope) |
| Idempotency | same key → return existing row |

**Effect:** insert `status = Requested`. **No** invoice money change. **No** AR observe required (remaining unchanged).

### `approveRefund` (optional)

`Requested → Approved`. No money. No AR. Idempotent `Approved → Approved`.

### `rejectRefund`

`Requested|Approved → Rejected`. Terminal. No money. No AR.

### `cancelRefund`

`Requested|Approved → Cancelled`. Terminal. No money. No AR.

### `completeRefund` — money transition

**Allowed from:** `Requested` or `Approved`.

**Hard re-check at Complete (not only at Request):**

1. Caps still hold (registration collected gross − other Completed refunds; payment scope if linked).  
2. Linked payment still `Paid` (if payment-sourced).  
3. Currency unchanged.  

**Effect sequence (atomic preferred):**

```text
BEGIN (tenant RLS)
  lock refund row WHERE status IN (Requested, Approved)
  recompute caps from Paid + prepayment + Completed siblings
  SET status = Completed, completedAt, completedByUserId, …
  COMMIT
THEN (same unit of work or immediate after):
  invoice = compileRegistrationInvoiceInternal(...)
  observeRegistrationArState(tenantId, registrationId, invoice.balanceDueMinor, now)
  optional: enqueue finance.refund.completed outbox (audit only — not money SoT)
```

**Idempotent Complete:** if already `Completed`, return same row; do **not** double-count in facts; observe may no-op.

**Forbidden:** Complete from Rejected/Cancelled; Complete inventing payment; writing Payment amount; writing ledger as state machine.

### Reads (service-level, for tests / future E3)

- `getRefund(auth, refundId)`  
- `listRefundsForRegistration(auth, registrationId)`  

No HTTP in this slice.

---

## 3. Invoice compile integration

### Current (today)

```text
walletNet = prepayment + paidPayments
paid = min(walletNet, total)
remaining = max(total − paid, 0)
```

Facts: `RegistrationInvoiceFacts { prepaymentMinor, paidPaymentsMinor, paymentAmountsMinor, currency }`  
(`paidPaymentsMinor` = SQL/in-memory sum of **status = Paid** only.)

### Target

```text
walletNet = prepayment + paidPayments − completedRefunds
paid = min(walletNet, total)
remaining = max(total − paid, 0)
```

### API changes (finance-core)

**`CompileInvoiceBalancesInput`** — add:

```ts
readonly refundedCompletedMinor?: string; // default "0"
```

**`compileRegistrationInvoice`** — compute:

```text
walletNet =
  sum(prepaymentMinor) + sum(paidPaymentsMinor) − sum(refundedCompletedMinor ?? "0")
```

Clamp: if subtraction would go negative, treat walletNet as `0` (should be unreachable if caps hold; fail-soft for compile safety).

**`RegistrationInvoiceReadModel`** — add:

```ts
readonly refundedMinor: string; // always present; "0" when none
```

`invoiceTotalMinor` derivation **unchanged** (schedule → obligation → paymentAmounts → wallet hint). Refund must **never** alter total derivation inputs except via wallet hint path — and wallet hint uses **net** wallet after refunds only when falling through to wallet hint (document: prefer schedule/obligation so total stable).

### Facts port

**`RegistrationInvoiceFacts`** — add:

```ts
readonly refundedCompletedMinor: string;
```

Loaders:

- Prisma (`load-registration-invoice-facts.ts`): `SUM(amount_minor)` from `finance_refunds` where `status = 'Completed'` for `(tenant_id, registration_id)`.  
- In-memory (isolation + apps/api + external-consumer): `sumCompletedRefundsMinor` over `refundsById` with `status === "Completed"`.  
- Prepayment facts in memory adapters: sum `prepaymentsByDomainEventId` for the registration (not hard-coded `"0"`).  
- External-consumer stub adapter (`test/external-consumer/adapters.ts`): refund port methods throw `notImplemented` until a consumer wires them.

### Persistence (Prisma + RLS)

Table `finance_refunds` (`@@map("finance_refunds")`), model `FinanceRefund`:

| Column / field | Notes |
| -------------- | ----- |
| `id`, `tenant_id`, `registration_id` | PK + RLS tenant |
| `payment_id` | optional UUID |
| `source_kind`, `amount_minor`, `currency` | digit string amount |
| `reason_code`, `reason_note`, `status` | domain enums as TEXT |
| lifecycle timestamps + actor user ids | requested / approved / rejected / cancelled / completed |
| `evidence_file_key`, `evidence_note`, `creation_idempotency_key` | optional proof + idempotency |
| `created_at`, `updated_at` | Prisma defaults |

Constraints / indexes:

- `@@unique([tenantId, creationIdempotencyKey])`
- `@@index([tenantId, registrationId])`, `@@index([tenantId, paymentId])`, `@@index([tenantId, status])`

RLS: `ENABLE` + `FORCE` + policy `tenant_id = current_setting('app.current_tenant_id', true)::uuid` (same pattern as `finance_schedules`). `GRANT SELECT, INSERT, UPDATE, DELETE … TO app_tour` (SoT app role — never `app_cloud`).

### Repository port methods (all adapters)

```text
createRefund
findRefundById
findRefundByCreationIdempotencyKey
listRefundsForRegistration
sumCompletedRefundsMinor
transitionRefundStatus
```

Prisma implementation uses `withTenantRls` + `tx.financeRefund`. `approveManualReceiptAtomic` passes `facts.refundedCompletedMinor` into `resolveApproveBookingPaymentStatus` so booking projection sees net wallet after completed refunds.

**Ignored by design**

| Fact | In walletNet? |
| ---- | ------------- |
| Pending / Cancelled payments | No (unchanged) |
| Requested / Approved / Rejected / Cancelled refunds | No |
| Completed refunds | Yes (subtract) |

### Call site

`FinanceService.compileRegistrationInvoiceInternal` passes `refundedCompletedMinor: facts.refundedCompletedMinor`.

Downstream DTOs that project invoice (`getRegistrationInvoice`, outstanding D1/D2, case obligation remaining) automatically pick up net paid/remaining **once compile changes**. No separate “refund money path.”

### Booking projection

CompleteRefund **does not** invent a new booking sync rule in E2 beyond: after Complete, if existing paths recompile for sync on other commands, leave booking sync **out of Complete** unless a current Paid→remaining change already has a shared helper. Prefer: **no booking downgrade on refund in E2** unless an existing observe already ties invoice remaining → booking `paymentStatus`. If `raiseBookingPaymentStatus` is only on approve/prepayment today, **document as deferred E3/E4** — do not silently omit forever; add a follow-up note in implementation PR. **Default for this contract:** on Complete, after compile, if `balanceDueMinor > 0` and booking shows `paid`, optionally re-sync via existing `resolveApproveBookingPaymentStatus` / sync helper **only if** a single shared “reproject from invoice” exists; otherwise leave booking projection for a dedicated tiny follow-up — **money SoT remains invoice**.

**Locked preference:** CompleteRefund **should** call the same booking reproject used after receipt approve when one exists keyed off compiled invoice (fail-closed miss already defined). If no reusable helper, ship E2 without booking write and file explicit TODO in PR description — invoice remains authoritative.

---

## 4. AR interaction (D3-B)

### Rule

No refund-specific AR table or columns.

On **CompleteRefund** only (after compile):

```text
observeRegistrationArState(tenantId, registrationId, balanceDueMinor, now)
```

Semantic (D3-A/B):

| Before remaining | After Complete | AR |
| ---------------- | -------------- | --- |
| 0 | &gt; 0 | **Reopen** — new `arOpenedAt = now`, `observed_transition_v1` |
| &gt; 0 | &gt; 0 | No-op on open episode |
| &gt; 0 | 0 | Close episode |
| 0 | 0 | No-op |

### Lazy observe compatibility

Outstanding/aging read paths that already lazy-observe remain valid safety net if Complete forgets observe (should not rely on this).

If D3-B **code is not yet merged** when E2 lands:

1. Introduce a narrow internal hook `afterRegistrationMoneyChanged(tenantId, registrationId, balanceDueMinor)` on FinanceService.  
2. CompleteRefund + future D3-B write paths call the hook.  
3. Hook no-ops until `observeRegistrationArState` exists; then wire one line.

**Do not** invent refund-only AR fields.

### Tests when D3-B present

- remaining 0 → Complete partial → remaining &gt; 0 → AR row open with `observed_transition_v1`.  
- Requested refund alone → AR unchanged.

---

## 5. Cap helpers (domain)

```text
collectedGrossMinor = paidPaymentsMinor + prepaymentMinor
refundedCompletedMinor = sum(Completed.amount for registration)
refundableRemainingMinor = max(collectedGross − refundedCompleted, 0)

# payment-scoped (sourceKind=payment):
paymentRefunded = sum(Completed linked to paymentId)
paymentCap = payment.amount − paymentRefunded
effectiveCap = min(refundableRemainingMinor, paymentCap)

# prepayment-scoped:
prepaymentRefunded = sum(Completed where sourceKind=prepayment)
prepaymentCap = prepaymentMinor − prepaymentRefunded
effectiveCap = min(refundableRemainingMinor, prepaymentCap)
```

Request: soft validate `amount ≤ effectiveCap`.  
Complete: hard validate or fail.

---

## 6. Tests required

### Domain / service (new)

| ID | Case |
| -- | ---- |
| R-01 | Request from Paid Manual payment → Requested |
| R-02 | Request against Pending payment → reject |
| R-03 | Request over registration/payment cap → reject |
| R-04 | Partial Completed → invoice `refundedMinor` / paid / remaining update |
| R-05 | Multiple Completed (40 then 60 on 100) → caps OK; over third fails |
| R-06 | Full refund Completes → paid net 0 (when total ≤ collected) |
| R-07 | Prepayment-only refund (`sourceKind=prepayment`) |
| R-08 | Requested (not Completed) → invoice unchanged vs baseline |
| R-09 | Approve / Reject / Cancel → invoice unchanged |
| R-10 | Complete idempotent replay → no double refund in facts |
| R-11 | AR reopen when remaining 0 → &gt; 0 after Complete (if observe wired) |
| R-12 | Currency mismatch / non-Manual payment → reject |

Prefer pure domain unit tests for transitions/caps + FinanceService in-memory repository integration (same style as cancel / outstanding specs).

### Regression (must stay green)

| Area | Specs / path |
| ---- | ------------ |
| Manual payment + receipt approve | existing finance-core payment/receipt tests |
| Pending cancel | PR23-A2 specs |
| Invoice facts Paid-only sum | `finance-registration-invoice-facts` / compile tests |
| Outstanding balances D1 | `outstanding-balances-pr23d1.spec.ts` |
| Tour collections D2 | `tour-collections-pr23d2.spec.ts` |
| AR aging (when present) | D3-A/B specs |

Compile unit: wallet with refunds; total stable when schedule/obligation present.

---

## 7. Non-goals

- Operator UI / refund dashboard  
- HTTP / BFF / workspace manifest routes  
- PSP / gateway / automatic payout  
- Credit wallet product  
- Ledger redesign / journal-as-SoT  
- Multi-currency  
- Credit-note subsystem  
- Changing D3-A aging anchor semantics  
- E4 reporting nets  

---

## Implementation order (suggested)

1. Domain types + transitions + caps + unit tests.  
2. Extend `compileRegistrationInvoice` + facts type; update all facts loaders (`"0"` default).  
3. Repository port + in-memory + Prisma `finance_refunds`.  
4. FinanceService commands; Complete → compile → AR hook.  
5. Domain service specs R-01…R-12.  
6. Regression `test:changed` / targeted finance-core specs (no full monorepo gate).  

---

## Acceptance → next phase

When R-01…R-12 + regressions pass:

**READY_FOR_PR23_E3** — operator HTTP + UI for request/approve/complete/reject/cancel against this domain.

---

## Final verdict (this planning doc)

**IMPLEMENTED** — domain + invoice + AR hook + R-01…R-12 green.

**READY_FOR_PR23_E3** — operator HTTP + UI for request/approve/complete/reject/cancel against this domain.

Deferred (non-blocking for E3 start): booking paymentStatus reproject on Complete (invoice remains money SoT).
