# Hostile accounting integrity — invariant table

```yaml
audit_id: FINANCE_HOSTILE_ACCOUNTING_INTEGRITY
version: "1.1"
date: "2026-07-19"
focus: financial correctness only
runtime: Prisma durable path unless noted
remediation: FINANCE_LEDGER_CORRECTNESS_REMEDIATION.md
```

## Lifecycle (stored facts)

| Label | Fact |
| ----- | ---- |
| CREATED | `Payment.status = Pending` |
| RECEIPT_SUBMITTED | `PaymentReceipt.status = Pending` |
| APPROVED | `PaymentReceipt.status = Approved` |
| PAID | `Payment.status = Paid` (same TX as Approved on success) |

---

## Invariant table

### 1. Paid payment ↔ ledger capture

| Invariant | Verdict | Evidence |
| --------- | ------- | -------- |
| Every `Paid` has **exactly one** ledger capture outbox (`finance.ledger.double_entry_applied` / `payment:{id}:ledger-capture-anchor`) | **PASS** (durable) | Empty lines → `FINANCE_LEDGER_CAPTURE_EMPTY` before/inside TX; Prisma requires non-empty `ledgerCapture`; enqueue no longer no-ops empty |
| Capture **amount** equals Payment amount at approve | **PASS** | `buildPaymentCaptureJournal({ amountMinor: payment.amount, … })` |
| Payment amount equals commercial/invoice obligation | **UNKNOWN** | Create/offline defaults unbound to invoice; not enforced at approve |
| Cannot **duplicate** capture for same payment (happy durable + stable adapter id) | **PASS** | Stable `domainEventId`; duplicate insert → `!inserted` → `FINANCE_APPROVE_CONFLICT` → full TX rollback; approve replay does not re-enqueue |
| Cannot duplicate if adapter uses unstable `domainEventId` | **PASS** | Adapters fail-closed without stable ids; host `assertStableCaptureIdentities`; TourCreated journal/lines seeded — see `FINANCE_ADAPTER_IDENTITY_STABILITY.md` |
| Approve TX: Paid without books when capture attempted and fails mid-TX | **PASS** | Throw rolls back Paid/Approved/booking |
| Non-durable memory omit of `ledgerCapture` | **N/A (test)** | Documented; Prisma path always requires capture |

### 2. Prepayment

| Invariant | Verdict | Evidence |
| --------- | ------- | -------- |
| Same Idempotency-Key cannot double-credit ledger | **PASS** | Stable `ledgerDomainEventId` / `prepaymentDomainEventId`; early return on existing recorded event |
| Distinct keys can post multiple credits to same registration | **PASS** (by design) | New key → new domain ids → second journal (not a bug if intentional multi-prepay) |
| Replay safe (same key, same/different body) | **PASS** (no double money) | Returns original payload; no second ledger. Amount change on reuse is **silent** (operator confusion, not double post) |
| Ledger insert success guaranteed with `finance.prepayment.recorded` | **PASS** | Empty lines throw; `!inserted` → `FINANCE_PREPAYMENT_CONFLICT` (no recorded without ledger) |
| Reconciliation safe (Payment table / booking / books) | **PARTIAL** | No Payment row; booking `partial` sync outside TX soft-fails; list is outbox-sourced |

### 3. TourCreated reaction + approve capture

| Invariant | Verdict | Evidence |
| --------- | ------- | -------- |
| No double credit to same booking wallet | **PASS** | Advisory lock + `registrationHasBookingWalletCredit`; Path B skips / Path A throws `FINANCE_DUPLICATE_OBLIGATION_CREDIT` |
| Ordering safe (TourCreated before/after approve) | **PASS** | Serialized by `pg_advisory_xact_lock(tenant:registration)` |
| Retry of TourCreated alone | **PASS** | Processed claim + exclusive skip |
| Retry of approve alone | **PASS** | Pending guards + stable payment capture id + replay path |

### 4. Recovery if ledger fails after payment success

| Invariant | Verdict | Evidence |
| --------- | ------- | -------- |
| **Detection** of Paid without capture | **PASS** (bounded) | `finance_reconciliation_mismatch` gauge (7d) + `countPaidWithoutLedgerCapture` helper (INV-P6) |
| Detection of all historical Paid gaps | **UNKNOWN** | Scrape windowed; not full-table continuous proof |
| **Repair** automated | **FAIL** | Runbook manual re-enqueue only; no repair API/job |
| **Reconciliation** closes the gap without human | **FAIL** | Gauge alerts; no auto-heal |

---

## Proof table (remediation)

| ID | Invariant | Result | Test |
| -- | --------- | ------ | ---- |
| INV-P1 | Empty lines cannot leave Paid | **PASS** | `finance-ledger-correctness.spec.ts` |
| INV-P2 | Success ⇒ exactly one capture | **PASS** | same |
| INV-P3 | Approve replay ⇒ one capture | **PASS** | same |
| INV-P4 | Empty prepay cannot record | **PASS** | same |
| INV-P5 | Prepay key replay ⇒ one ledger + one recorded | **PASS** | same |
| INV-P6 | Detector counts Paid∧¬capture | **PASS** | `paid-without-ledger-detection.spec.ts` |
| INV-E1 | Enqueue empty throws | **PASS** | `enqueue-finance-ledger-capture.spec.ts` |

---

## Scoreboard (strict)

| Area | Overall |
| ---- | ------- |
| Paid ↔ exactly-one capture (durable) | **PASS** |
| Paid amount correctness (vs payment row) | **PASS** |
| Paid amount correctness (vs commercial truth) | **UNKNOWN** |
| No duplicate capture (stable adapters) | **PASS** |
| Prepayment no double credit (same key) | **PASS** |
| Prepayment replay safe | **PASS** |
| Prepayment recorded ⇒ ledger inserted | **PASS** |
| TourCreated ∩ approve no double credit | **PASS** |
| Recovery detect | **PASS** (7d) |
| Recovery repair / auto-reconcile | **FAIL** |

**Accounting integrity (Paid⇒capture + single wallet credit):** **PASS** on durable path.  
**Full certification:** still blocked by repair automation only.
