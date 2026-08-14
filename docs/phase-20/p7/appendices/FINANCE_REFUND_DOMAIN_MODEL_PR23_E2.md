# Refund domain model contract (PR23-E2)

```yaml
doc_id: FINANCE_REFUND_DOMAIN_MODEL_PR23_E2
version: "2026-08-09-v1"
status: READY_FOR_PR23_E2_IMPLEMENTATION
phase: PR23-E2
related:
  - docs/phase-20/p7/appendices/FINANCE_REFUND_BOUNDARY_PR23_E1.md
  - docs/phase-20/p7/appendices/FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2.md
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_SEMANTICS_PR23_D3_A.md
  - docs/phase-20/p7/appendices/FINANCE_AR_AGING_PERSISTENCE_PR23_D3_B.md
locks:
  collection_mode: manual_offline_first
  online_gateway: forbidden
  multi_currency: forbidden_v1
  money_sot: registration_invoice_compile_only
  payment_amount: immutable_after_paid
  ledger: audit_only
  refund_money_gate: completed_only
```

## Purpose

Lock the **Refund domain model** (lifecycle, caps, invoice integration, facts) before coding.

Builds on E1 boundary. **No schema DDL, no HTTP/UI, no gateway.**

---

## 1. Refund lifecycle

### States (locked)

| State | Meaning |
| ----- | ------- |
| `Requested` | Operator opened a refund intent |
| `Approved` | Optional ops review passed (not money) |
| `Rejected` | Review denied; terminal; no money effect |
| `Completed` | Offline cash return confirmed; **only state that affects invoice** |
| `Cancelled` | Abandoned before Completed; terminal; no money effect |

### Approval mandatory?

**No — not mandatory for v1.**

Denali is small-club manual/offline: forcing Approve adds friction without PSP risk.

- **Allowed:** `Requested → Completed` (complete is the explicit money confirmation).  
- **Allowed:** `Requested → Approved → Completed` (optional two-step).  
- **Allowed:** `Requested → Rejected`, `Requested → Cancelled`, `Approved → Rejected`, `Approved → Cancelled`, `Approved → Completed`.  

**Forbidden:** `Rejected|Cancelled|Completed → *` (terminal).  
**Forbidden:** `Completed` without going through `Requested` (must have an intent record).

### Transition matrix (allowed)

```text
Requested  → Approved | Rejected | Cancelled | Completed
Approved   → Completed | Rejected | Cancelled
Rejected   → ∅
Cancelled  → ∅
Completed  → ∅
```

### Which transition affects invoice money?

**Only `* → Completed`.**

Approve/Reject/Cancel never change `paid` / `remaining` / wallet.

### Completion metadata (required on Complete)

- `completedAt` (FinanceClock)  
- `completedByUserId`  
- Optional completion note / offline evidence reference  

Idempotent Complete: second Complete on same refund is replay (no double money).

---

## 2. Refund amount rules

### Collected ceiling (registration)

```text
collectedGrossMinor =
  paidPaymentsMinor          # sum of Payment status=Paid amounts
  + prepaymentMinor

refundedCompletedMinor =
  sum(Refund.amount where status=Completed ∧ registrationId)

refundableRemainingMinor =
  max(collectedGrossMinor − refundedCompletedMinor, 0)
```

**New refund Request/Complete amount must be:**

```text
0 < amountMinor ≤ refundableRemainingMinor
  (and ≤ payment-scoped cap when paymentId set — below)
```

Evaluated at **Complete** time (re-check); Request may soft-validate.

### Payment-scoped cap (when `paymentId` present)

```text
payment must be Manual + Paid
sum(Completed refunds linked to paymentId) + thisAmount ≤ payment.amount
```

### Caps — answers

| Question | Decision |
| -------- | -------- |
| Cap based on payment collected? | **Yes**, when refund is linked to a Paid payment |
| Cap based on invoice `paidAmountMinor`? | **No** as primary — use **collected gross** (Paid + prepayment). Invoice `paid` is capped to total and can understate refundable wallet when overpay/wallet &gt; total |
| Prepayment / wallet? | Prepayment is refundable via refund with `sourceKind = prepayment` and `paymentId = null`; counts in `collectedGrossMinor` |

### Full / partial / multiple

| Mode | Rule |
| ---- | ---- |
| Full | `amountMinor = refundableRemainingMinor` (or = remaining on linked payment) |
| Partial | Any amount in `(0, cap]` |
| Multiple | Many Completed refunds; sum ≤ caps |

### Currency

Tenant single currency (IRR) for v1; refund currency must match registration invoice currency.

---

## 3. Invoice integration

### Compile inputs (contract)

```text
walletNetMinor =
  prepaymentMinor
  + paidPaymentsMinor
  − refundedCompletedMinor

paidAmountMinor = min(walletNetMinor, invoiceTotalMinor)
balanceDueMinor = max(invoiceTotalMinor − paidAmountMinor, 0)
```

### Read model exposure (recommended)

```text
invoice:
  totalMinor
  paidMinor          # net after refunds (same as paidAmountMinor)
  refundedMinor      # refundedCompletedMinor (new explicit field)
  remainingMinor
  currency
```

**Refund is a deduction from collected wallet**, not a change to invoice **total/obligation**.

### Does refund reopen AR?

**Yes, when money effect causes remaining `≤ 0 → > 0`.**

On Complete:

1. Recompile invoice.  
2. Call D3-B `observeRegistrationArState(tenantId, registrationId, balanceDueMinor, now)`.  
3. If reopen → new `arOpenedAt` + `observed_transition_v1`.

If remaining stays `> 0`, open AR episode unchanged (do not move `arOpenedAt`).  
If remaining goes to `0`, close episode per D3-B.

### Does refund change invoice total?

**Never.**

---

## 4. Ownership

| Owner | Owns |
| ----- | ---- |
| **Refund aggregate** | id, registrationId, optional paymentId, sourceKind, amount, reason, status, evidence refs, request/approve/complete/cancel metadata |
| **Payment** | Original collection; amount/status immutable for Paid |
| **Invoice compile** | Financial interpretation (total / paid net / refunded / remaining) |
| **Ledger** | Optional append-only audit on Complete — not status SoT |
| **FinanceService** | All refund commands + reads; observe AR |

---

## 5. Required facts (logical — no schema)

| Field | Required | Notes |
| ----- | -------- | ----- |
| `id` | yes | |
| `tenantId` | yes | |
| `registrationId` | yes | |
| `paymentId` | optional | Required when `sourceKind = payment`; null when `prepayment` |
| `sourceKind` | yes | `payment` \| `prepayment` |
| `amountMinor` | yes | Positive integer string |
| `currency` | yes | Match registration |
| `reasonCode` | yes | Closed enum (E2 picks codes; e.g. `member_withdrawal`, `overpayment`, `ops_correction`, `other`) |
| `reasonNote` | optional | |
| `status` | yes | Lifecycle above |
| `requestedAt` / `requestedByUserId` | yes | |
| `approvedAt` / `approvedByUserId` | optional | |
| `rejectedAt` / `rejectedByUserId` / `rejectNote` | optional | |
| `cancelledAt` / `cancelledByUserId` | optional | |
| `completedAt` / `completedByUserId` | yes when Completed | |
| `evidenceFileKey` / `evidenceNote` | optional | Offline proof — not gateway |
| `creationIdempotencyKey` | recommended | HTTP create safety |

---

## 6. Edge cases

| Case | Expected |
| ---- | -------- |
| **A** Paid 100M, Refund 100M Completed | `refunded=100`, `paid=0` (if total≥0), remaining = total; AR may reopen |
| **B** Paid 100M, Refund 40 then 60 | Both OK if caps hold; after both `refunded=100` |
| **C** Paid 100M, remaining 0, Refund 30 | OK; remaining becomes 30 (if total=100); AR reopen if was closed |
| **D** Payment Pending, Refund requested | **Reject at Request** — not collected |
| **E** Prepayment only 100M, no Paid payment | Refund with `sourceKind=prepayment`, `paymentId=null`; cap ≤ prepayment − prior prepayment refunds |

Additional:

| Case | Expected |
| ---- | -------- |
| Cancelled payment 50M, Paid 50M | Can refund ≤ 50M against Paid only |
| Second Complete same refund | Idempotent replay; no double count |
| Request 80 when refundable 70 | Fail validation |
| Complete when concurrent other Complete exhausts cap | Fail closed at Complete re-check |

---

## 7. Safety rules

| Prevent | Mechanism |
| ------- | --------- |
| Negative payments | No Payment write for refund |
| Editing Paid rows | Repository forbids amount/status downgrade except existing Cancelled≠Paid paths |
| Refund &gt; collected | Caps at Request (soft) + Complete (hard) |
| Refund changing invoice total | Compile never uses refund to alter obligation/total |
| Ledger as refund state | Status only on Refund aggregate |
| Gateway / multi-currency | Product lock |
| BFF inventing nets | FinanceService only |

---

## Invariants

1. Only `Completed` affects money.  
2. Invoice total/obligation unchanged by refund.  
3. `refundedCompletedMinor` deducted in walletNet before paid/remaining.  
4. Paid payment amounts immutable.  
5. Caps: registration collected gross + optional payment scope.  
6. AR observe on Complete after compile.  
7. Manual/offline only.  
8. FinanceService owns commands.

---

## Implementation boundary (next coding slice)

**In scope for E2 implementation (after this contract):**

- Domain types + transition guards + cap helpers  
- `refundedCompletedMinor` in invoice facts/compile  
- Repository port + in-memory/Prisma  
- FinanceService: request / approve? / reject / cancel / complete + list  
- Tests for A–E + caps + idempotent Complete + AR observe hook  
- **No HTTP/UI** (that is E3)

**Out of scope:** PSP, credit notes, journal-as-SoT, multi-currency, changing D3-A aging anchor.

---

## Final verdict

**READY_FOR_PR23_E2_IMPLEMENTATION** — domain model contract locked.

Implementation planning: [`FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2.md`](./FINANCE_REFUND_DOMAIN_IMPLEMENTATION_PR23_E2.md).

**Not yet `READY_FOR_PR23_E3`:** operator HTTP/UI waits until E2 domain + compile integration + tests are green.

No further product-boundary discovery required; remaining work is implementation detail within this contract.
