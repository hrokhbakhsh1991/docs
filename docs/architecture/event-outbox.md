# Tenant-aware transactional outbox

This repository implements the **transactional outbox** pattern in PostgreSQL (`outbox_events`) so domain commits and event emission stay atomic.

## Tenant-scoped rows

Every outbox row includes:

| Column | Role |
|--------|------|
| `tenant_id` | **Canonical workspace tenant** (`tenants.id`) — required on insert and indexed with `created_at`. |
| `aggregate_type` / `aggregate_id` | Domain aggregate pointer (existing contract). |
| `event_type` | Stable consumer-facing type string. |
| `payload` | JSON payload (may duplicate some IDs for consumers; **`tenant_id` on the row is authoritative**). |
| `created_at` | Event enqueue time. |

Producers **must** pass `tenantId` into `OutboxService.addEvent(...)` alongside aggregate metadata.

## Worker dispatch envelope

`OutboxProcessor` builds an internal delivery envelope before calling downstream handlers (today `AuditService.deliverFromOutbox`):

```json
{
  "tenant_id": "<uuid>",
  "event_id": "<uuid>",
  "event_type": "<string>",
  "payload": { },
  "created_at": "<ISO-8601>"
}
```

## Database tenant context (`set_config`)

Before dispatch, the worker executes:

```sql
SELECT set_config('app.tenant_id', <tenant_id from row>, true);
```

The third argument (`true`) makes the setting **transaction-local**, matching Postgres session binding used for HTTP requests.

**Guarantee:** Any downstream code running inside the same transaction **after** this call observes the same `app.tenant_id` as normal tenant-scoped API handlers, so **RLS-protected reads/writes align with the event’s tenant**.

Processors **must not** trust `payload` alone for tenant scope — they must rely on the row’s **`tenant_id`** and the `set_config` call.

## Why `outbox_events` does not use standard tenant RLS

The dispatcher **polls pending rows across all tenants** (`SELECT … FOR UPDATE SKIP LOCKED`). PostgreSQL RLS with the usual `tenant_id = current_setting('app.tenant_id')` policy would block cross-tenant reads unless the DB role bypassed RLS.

Therefore this table **does not** enable `FORCE ROW LEVEL SECURITY` for tenant isolation. Isolation is enforced by:

1. **Mandatory `tenant_id` column + FK to `tenants`** — schema-level integrity.
2. **Worker `set_config` before dispatch** — runtime alignment with RLS on domain tables.
3. **No client-facing INSERT** — only application code inside validated transactions writes rows.

If you need strict DB-level secrecy on the outbox table itself, introduce a **dedicated DB role** with `BYPASSRLS` for the worker only, or partition events physically per tenant.

## Operational notes

- Migration `1777576100000-OutboxTenantId.ts` backfills existing rows from `payload` and aggregate joins before enforcing `NOT NULL`.
- Failed migrations with orphaned rows surface an explicit error — resolve data manually before re-running.

## Related code

- **Domain event envelope + dev bus (Phase 2 foundation):** [`apps/api/src/common/events/README.md`](../../../apps/api/src/common/events/README.md) — `DomainEventEnvelope` aligns with outbox-style metadata (`eventId`, `eventType`, `occurredAt`, `tenantId`, `correlationId`, `schemaVersion`, `payload`). Production path: write the same shape (or a projection of it) via `OutboxService` in the aggregate transaction instead of `InMemoryEventBus.publish`.
- [`apps/api/src/modules/outbox/outbox.service.ts`](../../../apps/api/src/modules/outbox/outbox.service.ts)
- [`apps/api/src/modules/outbox/outbox.processor.ts`](../../../apps/api/src/modules/outbox/outbox.processor.ts)
- [`apps/api/src/common/audit/audit.service.ts`](../../../apps/api/src/common/audit/audit.service.ts)
- Integration test: [`apps/api/src/database/__tests__/outbox-tenant.spec.ts`](../../../apps/api/src/database/__tests__/outbox-tenant.spec.ts)
