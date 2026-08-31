# Outbox relay ordered processing per tenant (DEC-087 / Wave C)

```yaml
status: implemented
phase: 4 resilience — Wave C
closes: F-15, BL-01
related: outbox-relay-fairness.md, event-backlog-recovery.spec.ts
```

## Problem

Global `ORDER BY created_at ASC` with parallel publish concurrency can deliver **two events for the same tenant** out of strict FIFO order when batch size > 1 and workers overlap. Downstream idempotent handlers tolerate reorder for some event types; tour lifecycle ordering expects **per-tenant serialization** when enabled.

Enterprise analogue: Kafka `partition_key = tenantId` — only one in-flight message per partition.

## Decision

| Item         | Choice                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| Env          | `OUTBOX_RELAY_ORDERED_PER_TENANT=true` enables ordered mode            |
| Default      | `false` — preserves existing parallel throughput                       |
| Batch size   | **1** when ordered mode enabled (per-tenant serialization)             |
| Claim guard  | `NOT EXISTS` sibling row same `tenant_id` with `status = 'processing'` |
| `occurredAt` | Unchanged — `created_at` on publish (DEC-077)                          |
| Scope        | Both `claimPendingOutboxBatch` and `claimPendingOutboxBatchForTenant`  |

### Claim SQL (ordered mode)

```sql
WHERE status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM outbox_events o2
    WHERE o2.tenant_id = outbox_events.tenant_id
      AND o2.status = 'processing'
  )
ORDER BY created_at ASC, id ASC
LIMIT $batch
FOR UPDATE SKIP LOCKED
```

`id ASC` is the deterministic tiebreaker when multiple pending rows share the same `created_at` (e.g. same-transaction `createMany` with `@default(now())`). Without it, Postgres may return either row and per-tenant FIFO becomes undefined.

Cross-tenant parallelism unchanged; within a tenant at most one `processing` row at a time.

## Verification

```bash
cd apps/api && pnpm run guard:outbox-relay-ordered-per-tenant
OUTBOX_RELAY_ORDERED_PER_TENANT=true \
  node --import tsx --test test/4-integration/outbox-relay-ordered-per-tenant.spec.ts
```

Acceptance: two pending rows same tenant — second not claimed until first reaches `done` or `failed`.
