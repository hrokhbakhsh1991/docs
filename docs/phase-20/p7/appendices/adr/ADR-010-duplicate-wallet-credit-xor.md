# ADR-010 — TourCreated ∩ capture wallet credit XOR

```yaml
adr_id: ADR-010
title: Duplicate booking-wallet credit prevention
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_DUPLICATE_CREDIT_REMEDIATION
  - ADR-001
  - ADR-005
```

## Status

Accepted (remediated / enforced).

## Context

Payment capture (Path A) and TourCreated ledger reaction (Path B) can both credit the same booking wallet clearing obligation, producing double money for one registration.

## Decision

1. **Path A XOR Path B** — TourCreated (Path B) and payment capture (Path A) must not both credit the same registration booking wallet.
2. Serialize with `pg_advisory_xact_lock` keyed by tenant + registration.
3. Detect Path B credit via `registrationHasTourCreatedWalletCredit`; detect any credit via `registrationHasBookingWalletCredit`.
4. **Path B** (TourCreated): **skip** enqueue when **any** Path A capture or Path B credit already exists.
5. **Path A** (approve capture): **throw** `FINANCE_DUPLICATE_OBLIGATION_CREDIT` only when **Path B** credit already exists (approve TX rolls back).
6. **PR20-D:** Multiple Path A payment captures for the same registration are **allowed** (partial collection). Each capture credits the wallet by that payment’s amount; XOR is against TourCreated, not against prior captures.
7. Do not change capture `domainEventId` formulas to encode this rule.

## Consequences

- Ordering of TourCreated vs approve is safe under the advisory lock.
- Partial payment sequences (`unpaid → partial → … → paid`) can enqueue one capture journal per approved payment.
- Recon may still ticket rare double-wallet findings (`ticket_only`) if historical rows predate the lock.
- Workspace CoA must keep wallet prefixes non-colliding across products (capability registry / CoA ownership).

## Evidence

- [`../FINANCE_DUPLICATE_CREDIT_REMEDIATION.md`](../FINANCE_DUPLICATE_CREDIT_REMEDIATION.md)
- [`../FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md`](../FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md)
- Path A/B handlers under `apps/api/src/workspace-finance` and Denali TourCreated ledger path
