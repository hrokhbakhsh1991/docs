# Denali Finance Product Acceptance Audit

```yaml
doc_id: DENALI_FINANCE_PRODUCT_ACCEPTANCE_AUDIT
version: "2026-08-08-v2"
status: ACCEPTANCE_AUDIT
phase: PR20-D
tenant: "00000000-0000-4000-8000-000000000003"
scope: classic Denali Finance SoT workflow (Finance Case interpret-only; Command stale/auth safety only)
artifacts:
  - /tmp/pr20d-readiness.json
  - scripts/pr20d-denali-first-customer-readiness.sh
  - scripts/pr20c-denali-finance-acceptance-audit.py
related:
  - docs/phase-20/p7/appendices/FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md
  - docs/phase-20/p7/appendices/adr/ADR-010-duplicate-wallet-credit-xor.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md
  - packages/finance-core/src/domain/manual-payment-debt-policy.ts
  - packages/finance-core/src/application/finance.service.ts
  - apps/api/src/middleware/error-interceptor.ts
  - apps/api/src/workspace-finance/registration-booking-wallet-credit.ts
```

## Purpose

Customer-facing acceptance of **Denali production finance** end-to-end, independent of Finance Case expansion.

Hard rule observed: no Case expansion, interpreter change, shadow enablement, capture/refund, or new command types.

---

## Executive decision

### Can Denali operate its core finance workflow for the first customer?

**`READY_FOR_FIRST_CUSTOMER`**

Handoff gate: [`DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md`](./DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md) → **`READY_FOR_CUSTOMER_HANDOFF`**.

Proven **LIVE** on tenant `…000003` (artifact `/tmp/pr20d-readiness.json`):

```text
underpay approve → booking partial + remaining > 0
  → second manual payment + receipt + approve → still partial
  → final payment + receipt + approve → booking paid + remaining 0
```

Also proven LIVE:

| Check | Result |
| ----- | ------ |
| Overpay | **422** `FINANCE_OBLIGATION_OVERPAY` at create; booking stays unpaid |
| Duplicate after paid | **400** settlement debt gate |
| Reject | booking remains unpaid |
| Unauthorized review | **401** |
| Stale Command after classic mutate | **409** (fail-closed; no second write) |
| Hub first-customer tabs | overview / payments / receipts / ledger (prepay/installments hidden by default) |

Prior PR20-C blockers (P0 partial dead-end, P1 overpay 500) are **closed**.

---

## Root-cause → fix (PR20-D)

### P0 — Manual debt gate

Legacy gate treated any `Paid` payment row as settlement. After PR20-B, `Paid` can coexist with `balanceDueMinor > 0`.

**Policy:** allow additional manual debt while remaining &gt; 0; reject Pending collision; reject when remaining = 0. See [`FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md`](./FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md).

### P0 companion — ADR-010 multi-capture

Second approve hit `FINANCE_DUPLICATE_OBLIGATION_CREDIT` because Path A treated **any prior capture** as duplicate.

**Policy:** Path A throws only when **TourCreated (Path B)** already credited the wallet; multiple Path A captures allowed for partial collection. Path B still skips when any capture exists. See [`adr/ADR-010-duplicate-wallet-credit-xor.md`](./adr/ADR-010-duplicate-wallet-credit-xor.md).

### P1 — Overpay HTTP

`FINANCE_OBLIGATION_OVERPAY` mapped to **HTTP 422** with stable code (was 500). Create also rejects amount &gt; remaining + tolerance.

---

## P2 — Scope clarifications (no placeholders)

### `reports/open-payments`

| Question | Finding |
| -------- | ------- |
| Required for first-customer product? | **No** |
| Referenced by current UI? | **No** (no BFF route under `apps/web/app/api/finance/reports/`) |
| Obsolete? | Manifest + finance-http handler exist; **BFF gap** → web `/api/...` returns **404** |
| Action | **Do not implement** for first customer. Keep API inventory for later ops; UI does not advertise it |

### Prepayments

| Question | Finding |
| -------- | ------- |
| First-customer contract? | **Out of scope** |
| Live proof? | List API returns empty; not acceptance-gated |
| UI | Default Denali `financeOps.panels.prepayments = false` (opt-in via theme) |

### Installments

| Question | Finding |
| -------- | ------- |
| First-customer contract? | **Out of scope** |
| Live proof? | Schedules list empty; not acceptance-gated |
| UI | Default `panels.installments = false`, `installmentDefaults.enabled = false` |

First-customer supported surface: **hub overview + payments + receipts + ledger reports** and the manual payment → receipt → approve collection loop (including multi-pay).

---

## SoT integrity (unchanged)

```text
Operator UI / BFF (/api/finance/*)
  → finance-http routes
  → FinanceService (mutation authority)
  → FinanceRepository + ledger outbox
  → IBookingPaymentPort (booking.paymentStatus)
  → compileRegistrationInvoice (remaining)
```

Case / Meaning remain interpret-only. No Case persistence. No automatic flag flips.

---

## Live scenario matrix

| ID | Scenario | Result |
| -- | -------- | ------ |
| Multi-pay journey | under → mid → final | **PASS LIVE** |
| Overpay | create 422 | **PASS LIVE** |
| Reject | unpaid retained | **PASS LIVE** |
| Duplicate after paid | 400 | **PASS LIVE** |
| Auth | 401 | **PASS LIVE** |
| Stale Command | 409 | **PASS LIVE** |
| open-payments | BFF 404; not product-critical | **CLARIFIED** |

Automated: finance-core debt policy unit tests; `finance.service.spec` multi-pay; error-interceptor overpay 422; Denali manifest first-customer panels.

---

## Verdict

**`READY_FOR_FIRST_CUSTOMER`**

Handoff gate: [`DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md`](./DENALI_FINANCE_CUSTOMER_HANDOFF_GATE.md) → **`READY_FOR_CUSTOMER_HANDOFF`**.

Do not expand Command UI tenants, enable shadow, or sell prepayments/installments until separately proven.
