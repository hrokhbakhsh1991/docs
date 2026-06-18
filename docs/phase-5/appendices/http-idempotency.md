# HTTP idempotency (POST /tours) — DEC-006 extension

## Scope

| Layer    | Mechanism                                 | Status                              |
| -------- | ----------------------------------------- | ----------------------------------- |
| Outbox   | `UNIQUE (tenant_id, domain_event_id)`     | Required 5.4                        |
| Consumer | `processed_domain_events`                 | Required 5.4-S4                     |
| **HTTP** | `Idempotency-Key` header on `POST /tours` | **P0** — `http_idempotency_records` |
| **HTTP** | `Idempotency-Key` header on `POST /urban/registrations` | **P1** Phase 8 — required; `runIdempotentHttpMutation` |
| **HTTP** | `Idempotency-Key` header on `PATCH /workspaces/.../drafts/...` | **Optional** Phase 11.2+ — replay same 200; see [`workspace-draft-persistence.md`](../../phase-11/workspace-draft-persistence.md) § PATCH Idempotency-Key |

When the client sends `Idempotency-Key`, the API must return the **same** `201` body for replays and persist **at most one** tour row per `(tenant_id, idempotency_key)`.

`POST /urban/registrations` stores the full `{ success, data: { id, status } }` envelope. Missing header → **400** `IDEMPOTENCY_KEY_REQUIRED` (Phase 8 route matrix §B).

## Header

- Name: `Idempotency-Key` (case-insensitive)
- Required charset: same as auth scope ids (`AUTH_SCOPE_ID_PATTERN`)
- Omitted: legacy behavior (no dedup) for backward compatibility

## Request fingerprint

`request_hash = SHA-256(method + path + rawBody)` hex. Same key with a different body → **409** `IDEMPOTENCY_PAYLOAD_MISMATCH`.

## State machine

```mermaid
stateDiagram-v2
  [*] --> processing: first claim (INSERT)
  processing --> completed: createTour OK + store response
  processing --> [*]: createTour failed (DELETE row, client may retry)
  completed --> completed: replay stored 201 body
```

Concurrent requests with the same key:

1. First transaction inserts `status = processing` and runs `createTour`.
2. Others block on `SELECT … FOR UPDATE` (Postgres) or poll until `completed`.
3. All receive the same JSON `{ id, tenantId, canonical }`.

## ALS invariant (DI-MANUAL-01 / DEC-033)

`runIdempotentCreateTour(tenantId, …)` **must** run inside `runWithHttpRequestContext` / `runWithTenantContext` so AsyncLocalStorage is bound before claim.

| Check                     | When                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `requireActiveTenantId()` | Entry to `runIdempotentCreateTour` — throws `TENANT_CONTEXT_NOT_BOUND` if ALS empty               |
| Param vs ALS              | `tenantId.trim() === requireActiveTenantId()` — else `HTTP_IDEMPOTENCY_TENANT_MISMATCH` → **403** |

Rationale: idempotency keys are scoped per `(tenant_id, idempotency_key)` in storage, but the `tenantId` parameter also drives `withTenantRls` session GUC on the Prisma path. A caller passing `tenantId=B` while ALS=A would open the wrong RLS session even though the map/unique key might still partition by B.

## Terminal timestamps (DEC-084)

Prisma path sets `completed_at = now()` via SQL on transition to `completed` — not app `new Date()`. See [`canonical-terminal-timestamps.md`](canonical-terminal-timestamps.md).

## Storage

| Driver                  | Backend                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `STORAGE_DRIVER=prisma` | `http_idempotency_records` with RLS on `tenant_id`                             |
| `STORAGE_DRIVER=memory` | In-process `Map` — **dev/test only**; TTL + LRU bounded (DEC-039 / DI-IDEM-02) |

### Memory driver bounds (DI-IDEM-02)

| Control             | Default                                | Env                                                       |
| ------------------- | -------------------------------------- | --------------------------------------------------------- |
| Completed-entry TTL | 5 min                                  | `HTTP_IDEMPOTENCY_MEMORY_TTL_MS`                          |
| Max completed rows  | 512                                    | `HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES`                     |
| Test hygiene        | `resetHttpIdempotencyMemoryForTests()` | Spec `afterEach`; TTL spec uses `mock.timers` (CI-stable) |

Processing claims are not TTL-evicted. Production auth mode always uses Prisma storage (DEC-GAP-03).

**Phase 3 regression lock (DEC-067 / SCAL-DEBT-11):** `pnpm run guard:http-idempotency-memory-bounds` asserts TTL/LRU helpers remain in `http-idempotency.ts` and memory-bound spec stays in `phase-3:regression-gate`.

## Errors

| Code                               | HTTP | When                                   |
| ---------------------------------- | ---- | -------------------------------------- |
| `IDEMPOTENCY_PAYLOAD_MISMATCH`     | 409  | Same key, different body hash          |
| `IDEMPOTENCY_IN_PROGRESS`          | 409  | Claim timeout (rare; default poll 30s) |
| `HTTP_IDEMPOTENCY_TENANT_MISMATCH` | 403  | `tenantId` param ≠ ALS active tenant   |
| `TENANT_CONTEXT_NOT_BOUND`         | 500  | Idempotent create without bound ALS    |

## Verification

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
  node --import tsx --test test/1-reliability/idempotency-bypass.spec.ts
```

Enable the regression example by removing `skip` on the `REGRESSION TARGET` test after implementation.

## Related

- [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) — DEC-006
- [`5.4-transactional-outbox.md`](../subphases/5.4-transactional-outbox.md)
