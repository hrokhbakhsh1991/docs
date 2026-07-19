# ADR-001 — Option C approve / ledger capture atomicity

```yaml
adr_id: ADR-001
title: Option C approve atomicity
status: Accepted
date: "2026-07-18"
supersedes: []
related:
  - PAYMENT-LEDGER-BOUNDARY
  - FINANCE_HOST_INTEGRATION_KIT
  - FINANCE-APPROVE-TX-IDEM-3B
  - FINANCE_LEDGER_CORRECTNESS_REMEDIATION
```

## Status

Accepted (frozen).

## Context

Manual receipt approval must not leave a payment `Paid` without a durable ledger capture attempt, and must not Service-Locate booking tables from the finance repository. Booking projection updates and ledger outbox insert must share one tenant RLS unit of work on Prisma. In-memory storage is not TX-equivalent and must not be treated as production atomicity.

## Decision

1. Approve UoW is owned by the host `FinanceRepositoryPort.approveManualReceiptAtomic` implementation.
2. Normative Prisma order (**Option C**):

   ```text
   Paid → bookingPayments.raisePaidInTx(tx) → Approved → outbox(ledgerCapture) last
   ```

3. Finance repository **must not** mutate booking/`operatorRegistration` tables directly; booking participates only via `IBookingPaymentPort.raisePaidInTx`.
4. Capture identity is **`payment:{paymentId}:ledger-capture-anchor`** (not the HTTP Idempotency-Key).
5. Duplicate outbox insert / conflict → `FINANCE_APPROVE_CONFLICT` and **full TX rollback**. Already Approved+Paid → non-destructive replay (no second enqueue).
6. Empty capture lines fail closed (`FINANCE_LEDGER_CAPTURE_EMPTY`); do not commit Paid without a non-empty capture plan on the durable path.

## Consequences

- Changing Option C order or capture identity formula is a **breaking** host/core contract change (`FINANCE_SEMVER_POLICY`).
- Reconciliation repair must re-enqueue the **same** capture id; it must not redesign Option C (`FINANCE_RECON_REPAIR_ENGINE` constraints).
- Memory driver remains a test path — not Option C proof.

## Evidence

- [`../FINANCE_HOST_INTEGRATION_KIT.md`](../FINANCE_HOST_INTEGRATION_KIT.md) §3
- [`../PAYMENT-LEDGER-BOUNDARY.md`](../PAYMENT-LEDGER-BOUNDARY.md)
- [`../FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md`](../FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md) §4
- `packages/finance-core` `FinanceRepositoryPort.approveManualReceiptAtomic`
- `apps/api/.../infrastructure/prisma-finance.repository.ts`
