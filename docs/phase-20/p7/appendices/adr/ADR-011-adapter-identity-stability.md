# ADR-011 — Deterministic adapter ledger identities

```yaml
adr_id: ADR-011
title: Adapter identity stability
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_ADAPTER_IDENTITY_STABILITY
  - ADR-001
  - ADR-008
```

## Status

Accepted (remediated).

## Context

Unstable `randomUUID` journal/line ids (and missing stable seeds) produced distinct outbox identities on retry, worker restart, recon rebuild, or duplicate processing — defeating unique constraints and risking multiple journals for one business event.

## Decision

1. **Business `domainEventId` formulas are unchanged:**
   - Payment capture: `payment:{paymentId}:ledger-capture-anchor`
   - TourCreated primary line: `finance.ledger:{registrationId}:tour-created:{TourCreated.domainEventId}:…`
2. Adapter-generated **journalId / line ids** must be deterministic seeds (e.g. `stableLedgerIdentifiersFromSeed`) derived from stable business inputs.
3. `postDoubleEntryJournal` / workspace ledger adapters **require** `stableJournalAndLineIds` — **no** `randomUUID` fallback (`LEDGER_STABLE_ID_REQUIRED` / `FINANCE_LEDGER_STABLE_ID_REQUIRED`).
4. Host enqueue asserts identities via `assertStableCaptureIdentities` before outbox insert.
5. Reconciliation repair must reuse the same capture/prepay identities when re-enqueueing.

## Consequences

- Manual replay, recon, retry, worker restart, and duplicate processing converge on one outbox identity.
- Blank/malformed identities fail closed rather than minting a second journal.
- Truncation-to-128 collision class remains a separate residual (not solved by this ADR).

## Evidence

- [`../FINANCE_ADAPTER_IDENTITY_STABILITY.md`](../FINANCE_ADAPTER_IDENTITY_STABILITY.md)
- `packages/workspaces/denali/src/finance/post-double-entry-journal.ts`
- `apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts`
- `packages/workspaces/denali/test/ledger-identity-stability.spec.ts`
- `apps/api/src/workspace-finance/adapter-identity-stability.spec.ts`
