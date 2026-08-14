# Refund boundary audit (PR23-E1)

```yaml
doc_id: FINANCE_REFUND_BOUNDARY_PR23_E1
version: "2026-08-09-v1"
status: READY_FOR_PR23_E2
phase: PR23-E1
related:
  - docs/phase-20/p7/appendices/FINANCE_REFUND_DOMAIN_MODEL_PR23_E2.md
  - docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_SEMANTICS_PR23_D3_A.md
locks:
  collection_mode: manual_offline_first
  online_gateway: forbidden
  multi_currency: out_of_scope_for_refund_v1
  money_sot: registration_invoice_compile_only
  payment: collection_lifecycle_only
  ledger: audit_only
  settlement_redesign: forbidden
```

## Purpose

Define the **safe boundary** for adding manual/offline refund support without redesigning settlement, inventing online payouts, or corrupting Invoice / Payment / Ledger roles.

Analysis only — no schema, no code, no UI.

## Product boundary (hard)

```text
Manual Payment → Pending → Receipt review → Paid
                 Pending → Cancelled
```

Refund (future) is a **separate offline cash-return workflow**, not a Payment status, not a gateway capture reverse, not a credit-note product.

Forbidden in E1–E4 design:

- Online / PSP / gateway refund
- Automated payout
- Accounting journal redesign as refund SoT
- Credit-note subsystem
- Multi-currency refund complexity (tenant remains single-currency for v1)

---

## 1. Current state

### What represents money already collected?

| Fact | Role |
| ---- | ---- |
| Payment `status = Paid` + `amount` | Collection lifecycle unit that **contributed** to wallet |
| Prepayment recorded amounts | Wallet credit before/alongside payments |
| `getRegistrationInvoiceFacts().paidPaymentsMinor` | Sum of **Paid** payment amounts (facts input) |
| `prepaymentMinor` | Prepayment wallet input |
| Invoice `paidAmountMinor` / `walletNetMinor` | **Compiled** view: wallet capped to invoice total |
| Invoice `balanceDueMinor` | Remaining to collect |
| Booking `paymentStatus` | Settlement **projection** only |
| Ledger outbox / journals | **Audit** of past captures — not mutable AR |

### Where is paid amount derived?

```text
walletNet = prepaymentMinor + paidPaymentsMinor
paidAmountMinor = min(walletNet, invoiceTotal)
balanceDueMinor = max(invoiceTotal − paidAmountMinor, 0)
```

SoT: `compileRegistrationInvoice`.  
**There is no refund fact today** — Case vocabulary may mention `refunded` as settlement meaning, but finance-core has **no refund write path**.

### Where would a refund fact belong?

**Not** as:

- Negative Payment row  
- Edit of Paid `amount`  
- Ledger row as state machine  
- Obligation / invoice total edit  

**Yes** as a **new Refund aggregate** (registration-scoped, optionally linked to a Paid payment for evidence), whose **completed** amounts feed invoice compile as a **deduction from walletNet** (e.g. `refundedMinor` or net paid), so money SoT stays compile — discovery for E2 exact input shape.

---

## 2. Refund semantics (proposed lock for E2)

### Definitions

| Kind | Meaning |
| ---- | ------- |
| **Full refund** | Completed refund amount equals collected wallet applicable to that registration (or linked Paid payment amount); after compile, typically `paidAmountMinor` decreases and `balanceDueMinor` may rise |
| **Partial refund** | Completed refund amount &lt; collected; remaining paid stays |
| **Multiple refunds** | Allowed; sum of **Completed** refunds ≤ collected ceiling; each refund is its own aggregate instance |

### Scenario rules

| Scenario | Rule |
| -------- | ---- |
| Refund after **Paid** invoice (remaining = 0) | Allowed if collected &gt; 0; increases remaining after complete |
| Refund when **remaining &gt; 0** | Allowed up to **net collected** (wallet), not up to invoice total |
| Refund after **Cancelled** payment | Cancelled never collected — **cannot** refund that payment; may still refund other **Paid** collections / prepayments on the registration |
| Refund of **Pending** payment | **Forbidden** — nothing collected |
| Refund of **Rejected** receipt only | **Forbidden** — payment still Pending |
| Link to payment | Optional but preferred for ops: refund against a specific **Paid** Manual payment; registration-level refund of prepayment needs explicit type |

### Caps

```text
sum(completedRefundMinor) ≤ sum(paidPaymentsMinor) + prepaymentMinor
  (and per linked payment: sum(refunds on payment) ≤ payment.amount)
```

No negative money fields on Payment.

### Status sketch (E2 owns names)

```text
Requested → Approved → Completed
              ↘ Rejected / Cancelled (ops abandon)
```

Only **Completed** affects invoice compile.

---

## 3. Ownership

| Concern | Owner |
| ------- | ----- |
| Invoice compile | Remains money SoT; gains refund deduction input in E2 |
| Payment | Collection lifecycle only — **no** Refunded payment status required for v1 (prefer keep Paid immutable) |
| **Refund aggregate** | **New** domain aggregate + repository |
| Writes / reads | **FinanceService** only |
| Ledger | Optional **audit event** after Completed — never refund state machine |
| Booking projection | May re-sync unpaid/partial after remaining rises — existing sync paths; no new settlement engine |
| AR `arOpenedAt` | If remaining `≤0 → >0` after refund complete → D3-B observe reopen |

**Reject:** Payment-owned “refund status” that mutates Paid amount.  
**Reject:** Invoice-owned free-text credit without Refund aggregate.

---

## 4. Data model discovery (concepts only — no schema)

| Concept | Need |
| ------- | ---- |
| Refund request | Operator-initiated; registrationId; amountMinor; currency (tenant single) |
| Refund reason | Closed enum (ops) + optional note |
| Refund status | Requested / Approved / Completed / Rejected / Abandoned |
| Refund evidence | Optional offline proof (file key / note) — **not** gateway receipt |
| Completion confirmation | Explicit Complete command with actor + timestamp (cash returned offline) |
| Linkage | Optional `paymentId` (Paid only) and/or `prepayment` flag |
| Audit | Domain event / outbox for Completed — ledger append-only if policy requires |

**Do not design:** online refund APIs, payout rails, journals as SoT, credit-note documents.

---

## 5. Wrong actions to prevent

| Anti-pattern | Why forbidden |
| ------------- | ------------- |
| Negative Payment | Breaks lifecycle; corrupts aggregates |
| Editing Paid `amount` | Destroys audit of what was collected |
| Ledger as refund state | Ledger is audit-only |
| Manual invoice total tweak for refund | Obligation ≠ refund |
| Treating Cancelled as refundable | Never collected |
| Gateway / chargeback vocabulary | Out of product |
| BFF inventing net paid | FinanceService only |

---

## 6. Recommended PR split

| Slice | Scope |
| ----- | ----- |
| **E1** (this) | Semantics + boundary lock |
| **E2** | Domain model: Refund aggregate, compile input (`refundedMinor` or equivalent), repository, FinanceService commands, tests — **no UI** |
| **E3** | Operator workflow: HTTP + BFF + Command Center affordance (request / complete) |
| **E4** | Reporting: AR/export awareness of refunds; ops list of refunds — still invoice SoT |

---

## Invariants (carry forward)

1. Invoice compile = only money SoT (refunds enter as compile inputs, not parallel balances).  
2. Payment = collection lifecycle; Paid amounts immutable.  
3. Ledger = audit only.  
4. Manual/offline only; no PSP.  
5. Refund Completed is the only money-affecting refund state.  
6. FinanceService owns writes.  
7. No settlement redesign.

---

## Discovery still required in E2 (bounded)

Not blockers for E1 lock, but E2 must decide:

1. Exact compile field: `refundedMinor` vs net `paidPaymentsMinor` post-refund.  
2. Prepayment-only refund without paymentId.  
3. Whether Approve step is mandatory vs Request→Complete for small clubs.  
4. Interaction tests with D3-B AR reopen.

---

## Final verdict

**READY_FOR_PR23_E2** (semantics/boundary locked).

Not “implement all refund end-to-end” yet — **more discovery is scoped inside E2 domain model**, not a reopen of product boundary.

**Not READY** for E3 UI until E2 compile + aggregate green.
