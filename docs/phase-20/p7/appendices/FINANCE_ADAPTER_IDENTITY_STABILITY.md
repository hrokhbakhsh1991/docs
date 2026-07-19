# Finance adapter identity stability

```yaml
doc_id: FINANCE_ADAPTER_IDENTITY_STABILITY
version: "1.0"
date: "2026-07-19"
status: remediated
constraints:
  - do not change business domainEventId formulas
    (payment:{paymentId}:ledger-capture-anchor;
     finance.ledger:{registrationId}:tour-created:{TourCreated.domainEventId}:debit)
```

## Goal

Every adapter-generated **ledger identity** used for outbox dedupe / replay must be **deterministic** across:

| Scenario | Expectation |
| -------- | ----------- |
| Manual recon repair rebuild | Same `domainEventId` + `journalId` + line ids |
| Reconciliation enqueue | Same capture id formula |
| Retry after mid-flight failure | Same ids → unique outbox no-op or single row |
| Worker restart | Same ids on re-claim / re-reaction |
| Duplicate processing | Processed-claim + domainEventId unique |

## Audit result

| Path | domainEventId | journal / line ids | Before | After |
| ---- | ------------- | ------------------ | ------ | ----- |
| Payment capture (Denali + WS2–6) | `payment:{id}:ledger-capture-anchor` | seeded SHA-256 UUID | domainEventId OK; `randomUUID` fallback if seed empty | **fail-closed** if stable ids missing |
| Prepayment | caller `ledgerDomainEventId` | seeded from `journalSeed` | OK | OK + fail-closed |
| TourCreated Path B | `finance.ledger:{reg}:tour-created:{evt}:debit` | **was random** | domainEventId OK; journal/lines random | **seeded from TourCreated domainEventId** |
| `postDoubleEntryJournal` | n/a | optional stable → else random | unstable footgun | **requires** `stableJournalAndLineIds` |

Business formulas **unchanged**.

## Regression

- `packages/workspaces/denali/test/ledger-identity-stability.spec.ts`
- `apps/api/src/workspace-finance/adapter-identity-stability.spec.ts` (all registered workspace policies)

## Host assert

`enqueueFinanceLedgerCaptureOutbox` calls `assertStableCaptureIdentities` before insert:

- Non-empty `domainEventId`, `journalId`, and every line `id` / `journalId`
- When `domainEventId` matches `payment:{uuid}:ledger-capture-anchor`, metadata `paymentId` must match (if present)

Payment rebuild / recon repair reuses the same policy adapters → same identities on manual replay.

## Determinism map (post-remediation)

```text
payment capture:
  domainEventId = payment:{paymentId}:ledger-capture-anchor   (business — unchanged)
  journal/line  = UUID v5-like from SHA-256(seed) via stableLedgerIdentifiersFromSeed

prepayment:
  domainEventId = caller ledgerDomainEventId
  journal/line  = seeded from journalSeed

TourCreated Path B:
  domainEventId = finance.ledger:{reg}:tour-created:{TourCreated.domainEventId}:debit  (unchanged)
  journal/line  = seeded from TourCreated domainEventId (was randomUUID)
```

Empty stable ids → `LEDGER_STABLE_ID_REQUIRED` / `FINANCE_LEDGER_STABLE_ID_REQUIRED` / `FINANCE_LEDGER_IDENTITY_UNSTABLE` (no `randomUUID` fallback).

