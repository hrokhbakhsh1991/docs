# Finance ledger correctness remediation

```yaml
doc_id: FINANCE_LEDGER_CORRECTNESS_REMEDIATION
version: "1.0"
date: "2026-07-19"
invariant: "Paid payment ⇒ exactly one durable ledger capture"
constraints:
  - no ledger domainEventId / journalId formula changes
  - no approve TX reordering (Option C: Paid → booking → Approved → outbox)
  - no redesign of approve atomicity model
```

## Audit (pre-fix)

### 1. Approve flow

| Question | Finding |
| -------- | ------- |
| Can payment become Paid without ledger? | **Yes (was)** — empty `ledgerCapture.lines` skipped enqueue; TX still committed Paid+Approved |
| Empty ledger lines possible? | **Yes** — `enqueueFinanceLedgerCaptureOutbox` returned `true` (no-op); service recorded `skipped_empty` |
| Partial failure mid-TX? | **Fail closed** — throw rolls back Paid/Approved/booking (unchanged) |

### 2. Prepayment

| Question | Finding |
| -------- | ------- |
| Enqueue failure handling | **Weak** — `enqueueFinanceLedgerCaptureOutbox` return value ignored; empty lines no-op then `finance.prepayment.recorded` still inserted |
| Retry / same key | **Safe** — stable `ledgerDomainEventId` / `prepaymentDomainEventId`; early return |
| Missing capture detection | Gauge `finance_reconciliation_mismatch` (7d) for **payments** only; prepay gap not payment-row based |

### 3. Idempotency

| Case | Finding |
| ---- | ------- |
| Repeated approve | Pending guards + stable `payment:{id}:ledger-capture-anchor`; duplicate insert → `FINANCE_APPROVE_CONFLICT` → rollback or replay |
| Event / worker replay | Outbox `domainEventId` uniqueness; approve replay path does not re-enqueue |

## Fix (fail closed)

```text
1. enqueueFinanceLedgerCaptureOutbox:
     lines.length === 0 → throw FINANCE_LEDGER_CAPTURE_EMPTY  (was return true)

2. FinanceService.reviewReceipt (durable):
     after buildPaymentCaptureJournal, lines.length === 0 → throw before approve TX

3. FinanceService.recordPrepayment:
     lines.length === 0 → throw before recordPrepaymentAtomic

4. PrismaFinanceRepository.approveManualReceiptAtomic:
     require ledgerCapture with lines.length > 0 (Prisma = durable only)

5. PrismaFinanceRepository.recordPrepaymentAtomic:
     inserted = enqueue(...); if (!inserted) throw FINANCE_PREPAYMENT_CONFLICT

6. Detection (unchanged formula):
     finance_reconciliation_mismatch = Paid ∧ ¬ outbox(payment:{id}:ledger-capture-anchor)
     + unit proof that detector SQL matches invariant
```

**Out of scope:** automated repair jobs (still runbook/manual). TourCreated ∩ capture double-credit is remediated in `FINANCE_DUPLICATE_CREDIT_REMEDIATION.md`.

## Invariant proof targets

| ID | Invariant | Proof | Result |
| -- | --------- | ----- | ------ |
| INV-P1 | Durable approve with empty lines cannot leave Paid | Service + enqueue throw; payment stays Pending | **PASS** |
| INV-P2 | Durable approve success ⇒ exactly one capture outbox | Happy path count = 1 | **PASS** |
| INV-P3 | Repeated approve / conflict replay ⇒ still one capture | Idempotency | **PASS** |
| INV-P4 | Prepay empty lines cannot record prepayment | Throw before recorded event | **PASS** |
| INV-P5 | Prepay enqueue duplicate (`!inserted`) cannot insert recorded | Conflict / rollback (Prisma); key replay (memory) | **PASS** |
| INV-P6 | Detector counts Paid-without-capture | `countPaidWithoutLedgerCapture` + gauge SQL | **PASS** |
| INV-E1 | Enqueue empty lines fail closed | `enqueue-finance-ledger-capture.spec.ts` | **PASS** |
