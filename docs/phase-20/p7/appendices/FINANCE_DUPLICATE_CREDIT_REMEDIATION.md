# Finance duplicate credit remediation — TourCreated ∩ payment capture

```yaml
doc_id: FINANCE_DUPLICATE_CREDIT_REMEDIATION
version: "1.0"
date: "2026-07-19"
invariant: "At most one booking-wallet clearing credit per registration (Path A XOR Path B)"
constraints:
  - payment capture domainEventId unchanged (payment:{paymentId}:ledger-capture-anchor)
  - TourCreated ledger domainEventId formula unchanged
  - approve Option C order unchanged (Paid → booking → Approved → outbox)
```

## Before (hostile)

| Path | Trigger | CoA | Identity |
| ---- | ------- | --- | -------- |
| **A** | Receipt approve | Dr clearing / Cr `bookingWalletId(registrationId)` | `payment:{paymentId}:ledger-capture-anchor` |
| **B** | TourCreated + `paidAmountMinor` | Same accounts | `finance.ledger:{registrationId}:tour-created:{TourCreated.domainEventId}` |

| Check | Result |
| ----- | ------ |
| Shared domainEventId? | **No** — both insert |
| Line idempotencyKey overlap? | **No** — `payment:…:capture-anchor` vs `tour-created:…` |
| Processed-claim / outbox replay? | Prevents **same-path** retry only |
| Concurrent A∥B? | **Double wallet credit possible** |

## After (protection)

```text
Shared exclusive section (pg_advisory_xact_lock per tenant+registration):

  if registration already has Path A capture OR Path B TourCreated ledger:
      Path B → SKIP emit (idempotent no-op)
      Path A → THROW FINANCE_DUPLICATE_OBLIGATION_CREDIT (TX rollback)

  else proceed with this path's ledger only
```

| Path | Behavior when other already credited |
| ---- | ------------------------------------ |
| B then A | Approve fails closed — no second credit; payment stays Pending |
| A then B | TourCreated finance reaction skips ledger |
| Retry / outbox replay | Same-path idempotency unchanged |

## Proof tests

| ID | Scenario | Expected | Result |
| -- | -------- | -------- | ------ |
| DUP-01 | A then B | B skips; one capture | **PASS** (DB + pure probe) |
| DUP-02 | B then A | A throws / B-only credit; B replay skips | **PASS** (DB exclusive skip; approve gate in Prisma) |
| DUP-03 | B replay | still one TourCreated ledger | **PASS** (claim + exclusive) |
| DUP-04 | A replay | still one payment capture | **PASS** (existing approve idempotency) |
