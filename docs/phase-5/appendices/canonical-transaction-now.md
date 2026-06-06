# Canonical transaction timestamp authority (DEC-077 / Phase 4 step 7)

```yaml
status: implemented
phase: 4 resilience audit — closure step 7
closes: CLK-F-01, CLK-F-02 (partial — relay + atomic enqueue path)
related: phase4-resilience-audit.md § Clock skew, clock-skew-resilience.spec.ts
```

## Problem

| Finding      | Issue                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **CLK-F-01** | Atomic TX mixed authorities — tour `created_at` from app `new Date()`, audit/outbox from Postgres `@default(now())` |
| **CLK-F-02** | Domain `occurredAt` split — in-process bus defaults to app clock; relay uses outbox `created_at`                    |

Under ±5 min app clock skew, tour rows could order **before** audit/outbox in forensic timelines even though all three committed in one TX (**CLK-TT-01**). Relay path already mapped `occurredAt` from DB `created_at` (**CLK-SKEW-09**); enqueue did not **bind** that timestamp explicitly at insert time (**CLK-TT-02**).

## Decision

| Item                  | Choice                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| TX clock              | One `SELECT now()` per `withCanonicalTransaction` callback via `readCanonicalTransactionNow(tx)`    |
| Tour                  | `tours.created_at` = shared `txNow` (no app `Date` on persist path)                                 |
| Audit                 | `appendAuditEvent(..., { createdAt: txNow })`                                                       |
| Outbox                | `enqueueOutboxEvent(..., { createdAt: txNow })` — relay `occurredAt` = row `created_at`             |
| Update TX             | `persistTourUpdateAtomically` audit append uses same `txNow` pattern                                |
| Out of scope (step 7) | CLK-F-03 terminal `processedAt` / idempotency; CLK-F-04 ±5s JWT spec; memory-storage in-process bus |

## Flow

```mermaid
sequenceDiagram
  participant App as Node app clock
  participant TX as withCanonicalTransaction
  participant DB as Postgres now()
  participant Tour as tours
  participant Audit as audit_events
  participant Outbox as outbox_events

  App->>TX: persistNewTourAtomically
  TX->>DB: readCanonicalTransactionNow (once)
  DB-->>TX: txNow
  TX->>Tour: INSERT created_at = txNow
  TX->>Audit: INSERT created_at = txNow
  TX->>Outbox: INSERT created_at = txNow
  Note over Outbox: relay occurredAt = created_at ISO
```

## Verification

```bash
cd apps/api && pnpm run guard:canonical-transaction-now
node --import tsx --test src/db/canonical-transaction-now.spec.ts
node --import tsx --test src/canonical/canonical-timestamp-unify.spec.ts

# DB clock comparison (optional)
DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  node --import tsx --test --test-concurrency=1 \
  test/4-integration/clock-skew-resilience.spec.ts
```
