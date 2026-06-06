# Outbox terminal `failed` + admin replay (DEC-086 / Wave C)

```yaml
status: implemented
phase: 4 resilience — Wave C
closes: F-03, OZ-F (partial)
related: outbox-relay-fairness.md, saga-rollback.spec.ts
```

## Problem

When relay publish validation fails (e.g. `OUTBOX_TENANT_PAYLOAD_MISMATCH` in INT-SAGA-03), the row lands in terminal **`failed`**. The relay never re-claims `failed` rows — correct for poison — but ops had **no replay path** after fixing root cause (payload correction, transient infra).

Enterprise pattern: **DLQ + immutable payload + explicit admin replay** — not infinite automatic retry on poison.

## Decision

| Item               | Choice                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terminal state     | `status = failed`, `processed_at` set, `last_error` JSON                                                                                            |
| `last_error` shape | `{ code: string, at: ISO8601 }` from caught publish error                                                                                           |
| Replay             | `pending` + clear `processed_at` + `last_error` — **payload unchanged**                                                                             |
| HTTP               | `POST /internal/outbox/:id/replay` body `{ tenantId }` — dev/test only                                                                              |
| CLI                | `pnpm run outbox:replay-failed -- --tenant=<uuid> [--id=<uuid>]`                                                                                    |
| Guard              | `guard:outbox-failed-replay`                                                                                                                        |
| Auto-retry         | **Forbidden on `failed`** — relay must not claim terminal `failed` (DEC-086). **Transient retry before `failed`:** DEC-110 returns row to `pending` |

### Dev-only gate

Same policy as provisioning (`assertProvisioningDevelopmentOnly`): `NODE_ENV` ∈ `{ development, test }` and not production auth mode. Production uses CLI with break-glass credentials (future) — HTTP route returns **403** outside dev/test.

## Flow

```mermaid
sequenceDiagram
  participant Relay
  participant DB as outbox_events
  participant Admin
  Relay->>DB: claim pending → processing
  Relay->>Relay: publish validation fails
  Relay->>DB: status=failed, last_error, processed_at
  Note over Relay: no re-claim on failed
  Admin->>DB: fix payload (optional)
  Admin->>DB: replay → pending
  Relay->>DB: claim → publish → done
```

## Schema

Migration `outbox_events.last_error JSONB NULL` — Prisma `lastError Json? @map("last_error")`.

## Modules

| Module                             | Role                                           |
| ---------------------------------- | ---------------------------------------------- |
| `outbox-failed.ts`                 | `serializeOutboxLastError`, `markOutboxFailed` |
| `outbox-replay.ts`                 | `replayFailedOutboxEvent`, error types         |
| `routes/internal/outbox-replay.ts` | HTTP handler                                   |
| `scripts/outbox-replay-failed.mjs` | Batch replay CLI                               |

## Verification

```bash
cd apps/api && pnpm run guard:outbox-failed-replay
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test
node --import tsx --test test/4-integration/outbox-failed-replay.spec.ts
```

Acceptance (INT-SAGA-03 heal): poison → `failed` + `last_error` → fix payload → replay → relay `done`.
