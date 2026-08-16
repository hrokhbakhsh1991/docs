# Phase 5 — Implementation decisions (agent SoT)

```yaml
decision_doc_version: "2026-06-04-v1"
agent_load_tier: T0_before_code
owner: appendices/IMPLEMENTATION-DECISIONS.md
supersedes_ambiguity_in:
  - phase-5-ai-exec.md layer progression
  - conflicting prisma.$transaction vs withCanonicalTransaction wording
industry_refs:
  - "Transactional outbox — same DB TX as aggregate (microservices.io / NP Blog 2025)"
  - "Relay — FOR UPDATE SKIP LOCKED, at-least-once, idempotent consumers"
legacy_port_reference: legacy/apps/api/src/common/outbox/outbox-relay-worker.ts
phase_4_carryover:
  - apps/api/src/db/with-tenant-rls.ts
  - packages/platform-events publishDomainEvent (in-process bus)
  - apps/api/src/canonical/publish-tour-created.ts
```

> **Rule:** If this file conflicts with a historical paragraph elsewhere, **this file wins** for implementation. Update subphase actions to match — do not invent a third pattern.

**Boot:** read after [`REPO-PROJECT-ALIGNMENT.md`](REPO-PROJECT-ALIGNMENT.md) · guard `p5_doc_hardening` enforces presence.

---

## DEC-001 — Single write orchestrator

| Layer           | File                                               | Role                                                                       |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| HTTP + validate | `apps/api/src/tours/tours.service.ts`              | `buildValidatedCanonicalDocument` (5.2 **done**)                           |
| Orchestrator    | `apps/api/src/canonical/canonical-tour.service.ts` | **Only** place that commits tour + side effects                            |
| CASL            | `apps/api/src/db/scoped-tour.repository.ts`        | Unchanged — ability checks before TX                                       |
| Storage port    | `apps/api/src/storage/prisma-tour.repository.ts`   | Low-level Prisma rows (5.3 projection fields here **until** DEC-002 merge) |
| Adapter         | `apps/api/src/db/tour-storage.adapter.ts`          | Bridge storage port → db port                                              |

**Today (pre-5.4):** `writeTour` → `ScopedTourRepository.create` → `PrismaTourRepository.createTour/save` (each call uses `withTenantRls`) → **`publishTourCreatedEvent` after commit** (Phase 4.5).

**Target (5.4+):** `writeTour` → `withCanonicalTransaction(tenantId, fn)` → inside `fn(tx)`:

1. CASL already checked outside TX.
2. Insert/update `tours` via `tx.tour` with `canonical_data` + projected columns (DEC-003).
3. Insert `outbox_events` row (DEC-004).
4. Optional insert `audit_events` (DEC-007) when 5.5 lands.
5. **No** `publishDomainEvent` / `publishTourCreatedEvent` inside `fn`.

**After commit:** relay (DEC-004) may call `publishDomainEvent` for claimed rows.

```mermaid
sequenceDiagram
  participant API as ToursService
  participant CTS as CanonicalTourService
  participant TX as withCanonicalTransaction
  participant DB as Postgres
  participant Relay as OutboxRelay
  participant Bus as platform-events

  API->>CTS: writeTour(validated canonical)
  CTS->>TX: begin tenant RLS session
  TX->>DB: tour + outbox (+ audit)
  TX-->>CTS: commit
  Note over CTS,Bus: no bus call before commit
  Relay->>DB: SKIP LOCKED claim pending
  Relay->>Bus: publishDomainEvent
  Relay->>DB: status done
```

---

## DEC-002 — `withCanonicalTransaction` vs `withTenantRls`

| API                                      | When to use                                                                                | Phase       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| `withTenantRls(tenantId, fn)`            | Reads, capacity checks, **legacy per-op writes**                                           | 4 (current) |
| `withCanonicalTransaction(tenantId, fn)` | **All canonical writes** that touch `tours` + `outbox_events` + `audit_events` in one unit | 5.4+        |

Implementation: [`apps/api/src/db/with-canonical-transaction.ts`](../../../apps/api/src/db/with-canonical-transaction.ts) — already sets `app.current_tenant_id` then `prisma.$transaction`.

**Empty-tenant guard (pentest 2026-06-05):** Both helpers reject blank `tenantId` **before** opening a TX — `withTenantRls` → `TENANT_RLS_TENANT_ID_REQUIRED`; `withCanonicalTransaction` → `CANONICAL_TX_TENANT_REQUIRED`. Whitespace-only ids are treated as empty. RLS `set_config(..., true)` remains transaction-local (no pool pollution across borrowers).

**5.3 (parallel):** May add projection columns inside existing `withTenantRls` `save/create` paths first.  
**5.4 (required):** Move canonical persist into `withCanonicalTransaction`; stop calling `publishTourCreatedEvent` from `writeTour`.

**In-memory driver (`STORAGE_DRIVER=memory`):** No outbox table — tests that need outbox **must** set `STORAGE_DRIVER=prisma` + `DATABASE_URL` (see DEC-010).

---

## DEC-003 — Projection sync (5.3)

**Map SoT:** [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) §5.

| JSON path           | Column                 |
| ------------------- | ---------------------- |
| `data.basics.title` | `tours.title`          |
| `schemaVersion`     | `tours.schema_version` |

**New helper (recommended):** `apps/api/src/canonical/projection-sync.ts`

```typescript
export function deriveTourProjections(canonical: CanonicalDocument): {
  title: string | null;
  schemaVersion: number;
};
```

**Where to call (5.3):** In `PrismaTourRepository` `create`/`update` `data:` blocks (lines ~92–108) — pass derived `title` and `schemaVersion`.

**List / EXPLAIN proof (5.3 DoD):** Use `listByTenant` → `orderBy: { title: 'asc' }` or filter `where: { title: { contains: ... } }` on `idx_tours_tenant_title` — **not** `canonical_data @>` (FORBIDDEN-016).

**5.4 merge:** Same derivation inside `withCanonicalTransaction` `tx.tour.create/update` — do not duplicate logic.

---

## DEC-004 — Outbox + relay (5.4)

### Enqueue (same TX as tour)

**New:** `apps/api/src/outbox/enqueue-domain-event.ts`

```typescript
export async function enqueueOutboxEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    aggregateType: "tour";
    aggregateId: string;
    eventType: "TourCreated";
    payload: TourCreatedPayload;
    domainEventId: string; // UUID — maps to platform-events eventId
  }
): Promise<void>;
```

- `status: 'pending'`
- `UNIQUE (tenant_id, domain_event_id)` — duplicate insert = no double side effect (idempotent enqueue)

**Payload:** Align with [`packages/platform-events/src/bus.ts`](../../../packages/platform-events/src/bus.ts) `DomainEventEnvelope` (`eventId`, `tenantId`, `type`, `payload`, `occurredAt`).

### Relay (after commit — industry standard)

**New:** `apps/api/src/outbox/outbox-relay.ts`

1. `withCanonicalTransaction` **or** dedicated admin connection with tenant loop — for Phase 5 trunk use **per-tenant poll** inside `withTenantRls(tenantId, ...)` or global poll with `tenant_id` on row (RLS applies when session set).
2. Claim batch:

```sql
SELECT id FROM outbox_events
WHERE status = 'pending'
ORDER BY created_at
LIMIT $n
FOR UPDATE SKIP LOCKED;
```

3. For each row: `publishDomainEvent({ ... })` using stored payload; tenant guard per P4-E-EVT / `DOMAIN_EVENT_TENANT_REQUIRED`.
4. Update `status` → `processing` → `done` (or `failed` on handler error). Status updates tolerate `P2025` (row removed between claim and ack — concurrent cleanup / test isolation).

**Process model (trunk):** In-process timer in API — mirror legacy `OutboxRelayWorker` (interval + `setInterval`), **not** a separate Nest module.

| File                                        | Role                                 |
| ------------------------------------------- | ------------------------------------ |
| `apps/api/src/outbox/start-outbox-relay.ts` | `startOutboxRelayIfEnabled()`        |
| `apps/api/src/main.ts`                      | Call after listen — when env enabled |

**Separate worker process:** Deferred (Phase 7 ops / MAP §5) — document only.

### Chaos / hardened-gate test hooks

| Env                                     | Behavior                                                                                                                | Use                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P5_ATOMIC_TX_TEST_ABORT=before_outbox` | Throw after tour+audit, before outbox insert                                                                            | In-process rollback proof                                                                                                                                                    |
| `P5_ATOMIC_TX_TEST_ABORT=outbox`        | Throw inside `enqueueOutboxEvent`                                                                                       | In-process rollback proof                                                                                                                                                    |
| `P5_ATOMIC_TX_TEST_ABORT=process_exit`  | `process.exit(1)` after tour+audit                                                                                      | **Subprocess only** — [`atomic-tx-crash-child.ts`](../../../apps/api/test/chaos/atomic-tx-crash-child.ts)                                                                    |
| `P5_VALIDATE_DELAY_MS`                  | `NODE_ENV=test` only — async `setTimeout` after `validateCanonicalBeforePersist`, **before** `withCanonicalTransaction` | [`long-tx-safety.spec.ts`](../../../apps/api/test/3-performance/long-tx-safety.spec.ts) — proves RuleEngine slowness does not hold pool connections or `idle in transaction` |

Hooks live in [`atomic-canonical-tour-persist.ts`](../../../apps/api/src/canonical/atomic-canonical-tour-persist.ts), [`enqueue-domain-event.ts`](../../../apps/api/src/outbox/enqueue-domain-event.ts), and [`pre-transaction-validation.ts`](../../../apps/api/src/canonical/pre-transaction-validation.ts) (`awaitPreTransactionValidationDelayForTests`). Never enable in production.

### Replace Phase 4 publish path

| Before                                                   | After                          |
| -------------------------------------------------------- | ------------------------------ |
| `publishTourCreatedEvent` in `canonical-tour.service.ts` | `enqueueOutboxEvent` inside TX |
| Immediate `publishDomainEvent`                           | Only from relay after commit   |

Keep `publish-tour-created.ts` as thin wrapper around relay dispatch in tests, or deprecate file and import relay helper.

### FORBIDDEN-006 vs in-process bus (clarified)

| Mode                                         | Allowed                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| **Production** / `OUTBOX_RELAY_ENABLED=true` | Outbox row **required**; bus only via relay                                      |
| **Unit tests** (memory driver)               | No outbox — event tests use prisma + DATABASE_URL                                |
| **Integration test harness**                 | May call relay tick synchronously after `writeTour` — still must have outbox row |

**Not allowed:** `publishDomainEvent` in `writeTour` without outbox row when `OUTBOX_RELAY_ENABLED=true`.

---

## DEC-005 — Environment flags

| Variable                  | Default (dev) | Default (production) | Purpose            |
| ------------------------- | ------------- | -------------------- | ------------------ |
| `STORAGE_DRIVER`          | memory        | prisma               | DEC-010            |
| `DATABASE_URL`            | unset         | required             | Prisma + RLS tests |
| `OUTBOX_RELAY_ENABLED`    | `false`       | `true` (after 5.4)   | Start relay timer  |
| `OUTBOX_POLL_INTERVAL_MS` | `1000`        | `1000`               | Relay cadence      |
| `NODE_ENV`                | development   | production           | Storage default    |

Documented in [`env-runtime-matrix.md`](env-runtime-matrix.md) and `apps/api/.env.example`.

**Note:** Legacy Denali uses `OUTBOX_PROCESSOR_ENABLED` — trunk uses **`OUTBOX_RELAY_ENABLED`** to avoid coupling Phase 5 to Nest ConfigService.

---

## DEC-006 — Idempotency scope (5.4)

| Mechanism                                                         | Phase 5 scope                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `UNIQUE (tenant_id, domain_event_id)` on outbox                   | **Required** 5.4                                                                                 |
| Handler dedupe via `platform-events` per-handler `eventId` memory | **Required** (existing P4-E-EVT-01)                                                              |
| HTTP `Idempotency-Key` on POST /tours                             | **Required (P0)** — `http_idempotency_records`; see [`http-idempotency.md`](http-idempotency.md) |

| HTTP detail    | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| Table          | `http_idempotency_records` PK `(tenant_id, idempotency_key)` |
| Replay         | Same `201` body; one tour row under parallel burst           |
| Payload drift  | `409` `IDEMPOTENCY_PAYLOAD_MISMATCH`                         |
| Omitted header | No dedup (backward compatible)                               |

---

## DEC-007 — Audit events (5.5)

| Field         | Value on tour create                                                             |
| ------------- | -------------------------------------------------------------------------------- |
| `action`      | `TOUR_CREATED`                                                                   |
| `entity_type` | `tour`                                                                           |
| `entity_id`   | tour UUID                                                                        |
| `actor_id`    | HMAC pseudonym of `auth.userId` when present, else `null` (DEC-034)              |
| `metadata`    | `{ "workspaceType": "starter" }` only — **allowlist**; extra caller keys dropped |

**Scope Phase 5 (create):** tour create via `TOUR_CREATED` — see **DEC-047** for update extension.

**Where:** `apps/api/src/audit/audit-logger.ts` (`appendAuditEvent`) inside same `withCanonicalTransaction` as tour + outbox.

**Test:** `apps/api/test/5.5-audit-events.spec.ts` — tenant B cannot read tenant A rows; append-only trigger.

---

## DEC-047 — Phase 2 step 5 closure (AUDIT-GAP-02 / TOUR_UPDATED)

**Scope:** Phase 2 Fix-next #2 — forensic row on `PATCH /tours` when Prisma atomic path is active.

| Field         | Value on tour update                            |
| ------------- | ----------------------------------------------- |
| `action`      | `TOUR_UPDATED`                                  |
| `entity_type` | `tour`                                          |
| `entity_id`   | tour UUID                                       |
| `actor_id`    | Same pseudonym rules as DEC-007 / DEC-034       |
| `metadata`    | `{ "workspaceType": "starter" }` allowlist only |

| ID               | Change                                                                                                        | Verification                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **AUDIT-GAP-02** | `persistTourUpdateAtomically` — `withCanonicalTransaction` → `tour.update` + `appendAuditEvent(TOUR_UPDATED)` | `5.5-audit-events.spec.ts` PATCH case |
| **Memory path**  | `STORAGE_DRIVER=memory` still skips audit (non-forensic per DEC-045)                                          | `isForensicStorageDriver()`           |
| **CI lock**      | `guard-tour-update-audit.mjs`                                                                                 | `pnpm run guard:tour-update-audit`    |

**Where:** `atomic-canonical-tour-persist.ts` (`persistTourUpdateAtomically`); `CanonicalTourService.updateTourInActiveContext` routes Prisma driver through atomic persist.

**No outbox on update** — `TourUpdated` domain event deferred; audit row is the Phase 2 observability target.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 5.

---

## DEC-008 — DLQ / failed rows (BLOCKER-P5-010)

| Decision                   | Detail                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 5**                | `status = failed` allowed; **no** separate DLQ table                                                                                                                                                                                                                                                                               |
| **Retry**                  | Manual requeue / ops runbook — forensic waiver                                                                                                                                                                                                                                                                                     |
| **Architect**              | Sign-off in 5.6 forensic if relay leaves rows in `failed`                                                                                                                                                                                                                                                                          |
| **Partial success (P1-3)** | After outbox `done` + `processed_domain_events` claim, downstream handler failure → `recordProjectionInconsistency` in [`projection-reconciliation.ts`](../../../apps/api/src/events/projection-reconciliation.ts); metric `projection_inconsistency_total{tenant_id}`; **no** rollback of processed log (idempotency intentional) |

Do **not** block 5.4 on finance-style DLQ from legacy.

---

## DEC-009 — TourCreated integration test (5.4 / 5.6)

**Pattern:** Extend [`apps/api/src/canonical/canonical-tour.service.events.spec.ts`](../../../apps/api/src/canonical/canonical-tour.service.events.spec.ts):

```yaml
setup:
  - STORAGE_DRIVER=prisma
  - DATABASE_URL set
  - subscribeDomainEvent("TourCreated", handler)
  - OUTBOX_RELAY_ENABLED=true OR manual relay.processOnce() in test
act:
  - CanonicalTourService.writeTour(...)
assert:
  - handler invoked once
  - outbox row status done
  - no publishTourCreatedEvent-only path
```

New file preferred for gate: `apps/api/test/outbox-transactional.spec.ts` per [`test-inventory.md`](test-inventory.md).

---

## DEC-010 — CI / dev Postgres SoT (BLOCKER-P5-007)

```bash
export STORAGE_DRIVER=prisma
export DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev
export OUTBOX_RELAY_ENABLED=true   # 5.4+ integration
pnpm --filter @apps/api test
```

Apply SQL: `001_tenant_rls.sql` then `002_phase5_data_layer.sql` before integration tests.

---

## DEC-011 — Subphase order (agent)

| Order | Subphase             | Reason                                                        |
| ----- | -------------------- | ------------------------------------------------------------- |
| 1     | 5.3 (optional first) | Projection helper + prisma columns — can ship before TX merge |
| 2     | 5.4                  | **TX + outbox + relay** — replaces publish path               |
| 3     | 5.5                  | Audit in same TX pattern                                      |
| 4     | 5.6                  | Gates + forensic                                              |

**5.4 must not start** until 5.2 `VERIFIED_BEHAVIORAL` ([`phase-5-state-machine.md`](../phase-5-state-machine.md) TG-P5-005).

---

## DEC-012 — Connection pool saturation → HTTP 503 (performance gate)

**Problem:** When Prisma cannot acquire a connection within `pool_timeout` (URL query param on `DATABASE_URL`), the driver throws with messages such as `Timed out fetching a new connection from the connection pool` or `Unable to start a transaction in the given time`. Without mapping, route handlers surface **500** and clients may retry blindly; the event loop must keep scheduling timers while requests queue.

**Production mapping:**

| Layer                                        | Behavior                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `withTenantRls` / `withCanonicalTransaction` | Catch pool-timeout errors → rethrow `Error` with prefix `DB_POOL_SATURATED:` (preserves original message as suffix)                   |
| HTTP (`tours.routes`, test hold route)       | `mapErrorToStatus` — prefix `DB_POOL_SATURATED` → **503** `service_unavailable` JSON body                                             |
| Prisma URL                                   | `connection_limit` (default ~10) + `pool_timeout` (seconds, default 10) — tune per deploy; saturation test pins `connection_limit=10` |

**Test-only hold (does not run in production):**

| Env                               | When                 | Effect                                                                                                                                      |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `P5_DB_HOLD_MS`                   | `NODE_ENV=test` only | After RLS `set_config`, `SELECT pg_sleep(holdMs/1000)` inside the open TX — holds one pool connection for the configured milliseconds       |
| `GET /internal/test/db-pool-hold` | `NODE_ENV=test` only | Resolves tenant from standard kernel headers, one `withTenantRls` round-trip (for `apps/api/test/3-performance/db-pool-saturation.spec.ts`) |

**Verification:**

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=10&pool_timeout=1' \
  P5_DB_HOLD_MS=250 \
  node --import tsx --test test/3-performance/db-pool-saturation.spec.ts
```

**Pass criteria:** 100 concurrent holds exceed pool size → some **503** responses; all HTTP ops settle within storm deadline; event-loop heartbeat ticks during the burst (no hang).

---

## DEC-013 — Pre-TX validation delay → no long-held connections (long-tx-safety)

**Problem:** If `runPreTransactionValidation` or slow RuleEngine work opened a DB transaction before validation finished, a single slow create-tour request would hold `idle in transaction` and starve the Prisma pool — especially harmful when `connection_limit` is small.

**Architecture (RULE-003):**

| Phase                                                     | Connection acquired?                  | `pg_stat_activity` state                                      |
| --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `validateCanonicalBeforePersist` + `P5_VALIDATE_DELAY_MS` | **No** — CPU / async timer only       | No new `app_tour` rows; `idle in transaction` = 0             |
| `withCanonicalTransaction` → persist                      | **Yes** — one pool slot for TX window | May show `active` / brief `idle in transaction` during commit |

**Test hook:** `awaitPreTransactionValidationDelayForTests()` in [`pre-transaction-validation.ts`](../../../apps/api/src/canonical/pre-transaction-validation.ts), invoked from [`canonical-tour.service.ts`](../../../apps/api/src/canonical/canonical-tour.service.ts) after sync validation and gate open, before any `persistNewTourAtomically` / `withCanonicalTransaction` call. Only runs when `NODE_ENV=test` and `P5_VALIDATE_DELAY_MS` is a positive integer.

**Verification:**

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=1&pool_timeout=2' \
  P5_VALIDATE_DELAY_MS=500 \
  node --import tsx --test test/3-performance/long-tx-safety.spec.ts
```

**Pass criteria:** While POST `/tours` is in the validation-delay window, sampled `idle in transaction` for `app_tour` stays 0; a concurrent `GET /internal/test/db-pool-hold` succeeds (pool not held by validation); create-tour completes 201 after delay + persist.

---

## DEC-014 — Per-tenant Advanced Rule Engine degradation (`theme.featureFlags`)

**Problem:** High load or incident response may require relaxing RuleEngine matrix evaluation for **one tenant** without disabling POST `/tours` globally or returning 503 to unaffected tenants.

**Flag contract:**

| Field                | Location                                                | Default             |
| -------------------- | ------------------------------------------------------- | ------------------- |
| `advancedRuleEngine` | `tenants.theme.featureFlags.advancedRuleEngine` (JSONB) | `true` when omitted |

**Runtime mapping:**

| Flag             | `validateCanonical` variant | Starter matrix cell                     |
| ---------------- | --------------------------- | --------------------------------------- |
| `true` / omitted | `default`                   | Full rules (`basics.title` required)    |
| `false`          | `basic`                     | Relaxed rules (`basics.title` optional) |

**Read path:** `resolveTenantFeatureFlags(tenantId)` — `findTenantById` registry first, else `getPrismaAdmin().tenant.findUnique` on `theme`. Called from `ToursService.createTour` before `CanonicalTourService.writeTour`.

**Verification:**

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  node --import tsx --test test/4-integration/feature-flag-degradation.spec.ts
```

**Pass criteria:** Tenant A degraded accepts invalid starter body (201); Tenant B advanced rejects same body (400); concurrent burst yields no 503; B unchanged while A degraded.

See [`feature-flag-degradation.md`](feature-flag-degradation.md).

---

## DEC-015 — Per-tenant HTTP rate limit (in-memory interim, 5.6 / noisy-neighbor)

**Problem:** Without per-tenant request throttling, one tenant’s burst on `POST /tours` can saturate the Node event loop and deny service to others (`noise-neighbor.spec.ts`, `noisy-neighbor-latency.spec.ts`, `tenant-rate-limiting.spec.ts`).

**Phase 7.6 target:** Redis keys `ratelimit:{tenantId}:{tier}:{route}` — see [`docs/phase-7/subphases/7.6-rate-limits.md`](../../phase-7/subphases/7.6-rate-limits.md) and DEC-P7-006.

**Interim (this repo, until Redis):**

| Layer               | Behavior                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library             | [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible) `RateLimiterMemory` — token bucket per **tenant id** key (not a global bucket) |
| Store port          | `RateLimiterStore` in `apps/api/src/middleware/tenant-rate-limiter.ts` — swap to `RateLimiterRedis` in 7.6 without changing route wiring                       |
| ALS key             | `requireActiveTenantId()` after HTTP binds `runWithTraceContext` → `runWithTenantContext` (see [`rate-limiting.md`](rate-limiting.md))                         |
| Route               | `handleCreateTour` — `runWithHttpRequestContext(..., { rateLimit: true })` after auth + ALS, before `ToursService.createTour`                                  |
| Per-tenant override | `tenants.theme.rateLimitRps` or `theme.featureFlags.rateLimitRps` — see [`rate-limiting.md`](rate-limiting.md)                                                 |
| Distinct 429        | `{ "error": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED", "retryAfter": "<sec>" }` + `Retry-After` header — **not** `TOUR_CAPACITY_EXCEEDED_*`         |

**Env (apps/api):**

| Variable                         | Default | Role                                       |
| -------------------------------- | ------- | ------------------------------------------ |
| `TENANT_RATE_LIMIT_ENABLED`      | `true`  | Set `false` to disable middleware          |
| `TENANT_RATE_LIMIT_POINTS`       | `50`    | Default max requests per tenant per window |
| `TENANT_RATE_LIMIT_DURATION_SEC` | `1`     | Window length (seconds)                    |

**Verification:**

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory \
  TENANT_RATE_LIMIT_POINTS=10 TENANT_RATE_LIMIT_DURATION_SEC=1 \
  node --import tsx --test test/3-performance/tenant-rate-limiter.spec.ts

cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory RUN_RATE_LIMIT_EXPECT=1 \
  TENANT_RATE_LIMIT_POINTS=10 \
  node --import tsx --test test/3-performance/tenant-rate-limiting.spec.ts
```

**Pass criteria (tenant-rate-limiter):** 20 concurrent `POST /tours` for tenant A with limit 10/s → exactly 10×201 and 10×`RATE_LIMIT_EXCEEDED` 429; 5 concurrent for tenant B → 5×201.

**Pass criteria (tenant-rate-limiting regression):** Tenant A burst throttled with mix of 201 and rate-limit 429; tenant B concurrent request stays 2xx with latency ≤ `max(p50 × TENANT_B_LATENCY_RATIO_MAX, TENANT_B_LATENCY_MIN_BUDGET_MS)` (defaults 2.0 and 500ms). See [`rate-limiting.md`](rate-limiting.md).

**Memory driver note:** `resolveTenantFeatureFlags` skips Postgres `tenants.theme` lookup when `DATABASE_URL` is unset so `STORAGE_DRIVER=memory` HTTP probes (random `integrationTenantId`) do not 500 before the limiter runs.

---

## DEC-016 — Validation fairness scheduler + engine cache (P0-7)

**Problem:** Sync `validateCanonicalBeforePersist` / per-call `PlatformWizardEngine.create` monopolizes the event loop; victim tenant `createTour` latency can exceed 10× baseline under neighbor validation storms.

**Production:**

| Layer                         | Behavior                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `validation-scheduler.ts`     | `runScheduledValidation(tenantId, fn)` — max `P5_VALIDATION_MAX_CONCURRENT` (default 4); round-robin across tenant queues |
| `runPreTransactionValidation` | **async** — validation body runs inside scheduler; then opens pre-TX gate                                                 |
| `canonical-validation.ts`     | LRU engine cache per `(workspaceType, validationVariant)` — no per-tenant engine state                                    |

**Env:**

| Variable                          | Default |
| --------------------------------- | ------- |
| `P5_VALIDATION_MAX_CONCURRENT`    | `4`     |
| `P5_VALIDATION_ENGINE_CACHE_SIZE` | `8`     |

**Verification:** [`validation-fairness.md`](validation-fairness.md) — `noisy-neighbor-latency.spec.ts` must `verdict=pass` at `BASELINE_RATIO_MAX=1.10`.

**CRIT-STATE-01 waiver:** Cached engines are keyed by workspace plugin type + rule variant only; tenant id is passed at `validateCanonical` call time, not stored on the engine singleton.

---

## DEC-017 — Outbox relay parallel publish (P0-6)

**Problem:** Serial `publishClaimedOutboxRow` in `publishClaimedBatch` caps drain at ~90–100 evt/s local (batch=100).

**Production:**

| Setting                            | Default                  | Role                                                          |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `OUTBOX_RELAY_PUBLISH_CONCURRENCY` | `16`                     | Parallel publish workers per claimed batch                    |
| `OUTBOX_RELAY_BATCH_SIZE`          | `10` (unchanged cap 100) | Claim size                                                    |
| `MIN_THROUGHPUT` (test)            | `100`                    | Local CI drain budget                                         |
| `OUTBOX_THROUGHPUT_STRICT=1`       | —                        | Raises `MIN_THROUGHPUT` default to `500` (nightly / hardened) |

Visibility check (`withTenantRls` + `findUnique`) retained per row; parallelism is across distinct claimed rows only.

**Verification:** `apps/api/test/3-performance/outbox-throughput.spec.ts`.

---

## DEC-019 — SCHEMA_VERSION_MISMATCH (P1-7)

| Rule        | Detail                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| Current rev | `resolveWorkspaceCurrentSchemaVersion(workspaceType)` — starter = `1`       |
| Mismatch    | Request `schemaVersion` ≠ current → `400` + `code: SCHEMA_VERSION_MISMATCH` |
| Default     | Omitted `schemaVersion` uses workspace current (not implicit downgrade)     |

Code: [`schema-version-policy.ts`](../../../apps/api/src/canonical/schema-version-policy.ts), [`canonical-validation.ts`](../../../apps/api/src/tours/canonical-validation.ts).

**Verification:** `apps/api/test/4-integration/schema-version-compat.spec.ts`.

---

## DEC-022 — API test tiers trunk vs nightly (P2-1 / P2-2)

| Tier    | Env                          | Command                                                                       |
| ------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Trunk   | `APPS_API_TEST_TIER=trunk`   | `pnpm --filter @apps/api test` (default); used by `phase-5:gate`              |
| Nightly | `APPS_API_TEST_TIER=nightly` | `pnpm run test:nightly` — backlog 1000, noise-neighbor HTTP, relay leak, soak |

Implementation: [`apps/api/test/test-tier.ts`](../../../apps/api/test/test-tier.ts). Docs: [`docs/dev/tiered-testing.md`](../../dev/tiered-testing.md).

---

## DEC-021 — Redis rate limiter when `REDIS_URL` set (P1-1)

| Env               | Store                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| `REDIS_URL` unset | `MemoryRateLimiterStore` (interim — multi-replica BLOCKER documented in 7.6) |
| `REDIS_URL` set   | `RedisRateLimiterStore` + shared `ioredis` client                            |

**Verification:** `apps/api/test/3-performance/redis-rate-limiter.spec.ts` (requires live Redis).

---

## DEC-020 — PATCH tour optimistic locking (P1-6)

| Item     | Detail                                        |
| -------- | --------------------------------------------- |
| Column   | `tours.row_version` (default 1)               |
| API      | `PATCH /tours/:id` with required `rowVersion` |
| Conflict | `409 TOUR_VERSION_CONFLICT`                   |

See [`tour-update-api.md`](tour-update-api.md).

---

## DEC-018 — RuleEngine global tenant partition cap (P1-9)

**Problem:** `scopeCacheByTenant` (outer `Map`) grew without bound — one inner LRU (64 scopes) per distinct `tenantId`; multi-tenant API processes could retain hundreds of tenant partitions per `RuleEngine` instance.

**Production (`packages/platform-core/src/engine/rule.engine.ts`):**

| Layer | Cap                   | Policy                                      |
| ----- | --------------------- | ------------------------------------------- |
| Inner | 64 scopes / tenant    | LRU on `scopeKey`                           |
| Outer | 128 tenants (default) | LRU on `tenantId`; evict entire inner `Map` |

| Env                                 | Default | Role                    |
| ----------------------------------- | ------- | ----------------------- |
| `RULE_ENGINE_MAX_TENANT_PARTITIONS` | `128`   | Outer partition ceiling |

Touch on cache hit promotes tenant partition and scope entry to MRU before insert/evict.

**Verification:** `packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts`, `rule-cache-poisoning.spec.ts`.

---

## DEC-023 — Production JWT-only + dev bearer TTL (P1-8)

**Problem:** Header-only auth and unsigned `dev.*` bearer are acceptable in `development` / `test`, but production must bind identity to verified RS256 JWT. Dev bearer had no `exp`, so clock-skew tests documented a session TTL gap.

**Policy:** See [`docs/phase-4/appendices/production-auth-policy.md`](../../phase-4/appendices/production-auth-policy.md).

| Mode                                           | Ingress                                     | Boot                                                            |
| ---------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV=production`                          | Non-empty `Authorization` + JWT verify only | `AUTH_JWT_*` required                                           |
| `NODE_ENV=test` + `AUTH_ALLOW_DEV_BEARER=true` | `dev.<payload>` with mandatory `exp`        | Dev bearer TTL via `AUTH_DEV_BEARER_TTL_SECONDS` (default 3600) |

**Verification:** `auth-env.spec.ts`, `tenant-kernel.spec.ts`, `clock-skew-resilience.spec.ts` (CLK-SKEW-07 expired dev bearer).

---

## DEC-024 — `tours` RLS in Prisma migrate track (P0-1 / W-03)

**Problem:** `tours` ENABLE/FORCE RLS and policy `tenant_isolation` lived only in [`infra/sql/001_tenant_rls.sql`](../../../infra/sql/001_tenant_rls.sql). Databases provisioned with `prisma migrate deploy` alone had no RLS on `tours` until manual SQL.

**Decision:** Add migration [`apps/api/prisma/migrations/20260605180000_tours_rls/migration.sql`](../../../apps/api/prisma/migrations/20260605180000_tours_rls/migration.sql) mirroring 001 policy expression (`app.current_tenant_id`, transaction-local `true`).

| Deploy path                 | `tours` RLS                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma migrate deploy`     | **Required** — applies `20260605180000_tours_rls` (use owner role, e.g. `postgres` / `DATABASE_URL_ADMIN`, for `ALTER TABLE` RLS DDL) |
| Manual `001_tenant_rls.sql` | Idempotent duplicate — `DROP POLICY IF EXISTS`                                                                                        |
| Runtime `app_tour`          | Uses RLS via `set_config` — does not need table ownership                                                                             |

**Verification:** `apps/api/test/rls-isolation.integration.spec.ts` (P4-E-RLS-01); Phase 0 audit W-03 closure.

---

## DEC-GAP-03 — Production runtime integrity (P0-3 / P0-4)

**Problem:** Production could boot with `DATABASE_URL_ADMIN` unset (admin client fell back to app pool), `STORAGE_DRIVER=memory`, or identical app/admin URLs — weakening RLS isolation and ops probes.

**Decision:** `assertProductionRuntimeIntegrity()` in [`apps/api/src/server/production-runtime-env.ts`](../../../apps/api/src/server/production-runtime-env.ts) runs at boot with `assertAuthEnvironmentIntegrity()`. [`assertProductionStorageDriver()`](../../../apps/api/src/storage/create-tour-storage.ts) enforces the same storage rules at the DI factory (Phase 1 **DM-CT-01**). [`assertProductionDatabaseIntegrity()`](../../../apps/api/src/db/assert-production-database-integrity.ts) probes Postgres at boot in production (Phase 1 **DM-CT-02** / **DI-PRISMA-01**). Production requires:

| Check                                         | Error code                               | Enforced at            |
| --------------------------------------------- | ---------------------------------------- | ---------------------- |
| `DATABASE_URL` set                            | `PRODUCTION_DATABASE_URL_REQUIRED`       | Boot + storage factory |
| `DATABASE_URL_ADMIN` set and ≠ `DATABASE_URL` | `PRODUCTION_DATABASE_URL_ADMIN_*`        | Boot only              |
| `STORAGE_DRIVER` ≠ `memory`                   | `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`    | Boot + storage factory |
| App DB role `rolbypassrls = false`            | `PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS` | Boot DB probe          |
| Tenant RLS tables enabled + forced            | `PRODUCTION_DATABASE_RLS_NOT_APPLIED`    | Boot DB probe          |

`getPrismaAdmin()` throws `PRODUCTION_DATABASE_URL_ADMIN_REQUIRED` in production when admin URL is missing (no silent fallback to app pool — **DI-PRISMA-01**).

**Memory driver:** `STORAGE_DRIVER=memory` is for unit/integration without Postgres only — not a forensic isolation mode (**DI-MEM-01**).

**Bootstrap:** Apply Prisma migrations with owner/`DATABASE_URL_ADMIN` before production boot; boot probe verifies RLS is active on tenant-scoped tables.

**Doc:** [`docs/phase-4/production-deploy-checklist.md`](../../phase-4/production-deploy-checklist.md) · [`env-runtime-matrix.md`](../../phase-4/appendices/env-runtime-matrix.md).

---

## DEC-025 — Static tenant registry gate (HT-01 / P0-2)

**Problem:** `DEV_TENANTS` could satisfy tenant resolution when Postgres had no row, masking mis-provisioned tenants in production.

**Decision:** `isStaticTenantRegistryAllowed()` — `false` in production auth mode; `true` in `NODE_ENV=test`; in development only when `DATABASE_URL` is unset. All resolution paths (`resolveRegisteredTenantBy*`, rate limit theme, feature flags) consult this gate before `findTenantById`.

---

## DEC-026 — Per-tenant pre-transaction validation gate (HT-03 / P1-2)

**Problem:** A single process-wide `openGate` scalar allowed concurrent tenants to overwrite each other's gate between validate and `withCanonicalTransaction`.

**Decision:** `Map<tenantId, ValidationGate>` in [`pre-transaction-validation.ts`](../../../apps/api/src/canonical/pre-transaction-validation.ts). `consumePreTransactionValidationGate(tenantId)` deletes only that tenant's entry. Scheduler parallelism (DEC-016) remains safe across tenants.

**Verification:** `apps/api/test/1-functional/validation-gate-concurrency.spec.ts`.

---

## DEC-027 — ALS on background publish (V-005 / P1-3)

**Decision:** `publishClaimedOutboxRow` and idempotent domain-event handlers run inside `runWithTenantContext(envelope.tenantId)` so `getActiveTenantId()` and trace-scoped logs match relay delivery tenant.

---

## DEC-028 — ALS ↔ RLS tenant alignment (P1-4 / DEC-GAP-06)

**Problem:** A caller could bind ALS to tenant A while opening `withTenantRls` / `withCanonicalTransaction` for tenant B.

**Decision:** Before each RLS transaction, `assertActiveTenantMatchesRlsTarget(rlsTenantId)` throws `TENANT_RLS_ALS_TENANT_MISMATCH` when ALS is bound and differs. Unbound ALS (background jobs that set RLS only) remains allowed.

**Verification:** `apps/api/test/0-security/tenant-rls-als-alignment.spec.ts`.

---

## DEC-029 — Canonical write trust boundary (P1-5 / DEC-GAP-05)

**Decision:** `CanonicalTourService.writeTourInActiveContext` and `updateTourInActiveContext` each require `requireActiveTenantId() === input.tenantId` or throw `CANONICAL_WRITE_TENANT_MISMATCH`. HTTP ingress must use `runWithHttpRequestContext` / `writeTour` / `updateTour` — never the private paths with a mismatched ALS (Phase 1 **DM-CT-04** on update).

**Verification:** `apps/api/src/canonical/canonical-tour.service.spec.ts` — ALS mismatch rejects for create and update.

---

## DEC-030 — Validation engine cache partition (HT-04 / P1-17)

**Decision:** LRU key is `${tenantId}:${workspaceType}:${validationVariant}` (was workspace-only). Engines remain stateless; partition prevents cross-tenant cache affinity under concurrent validation (DEC-016 scheduler).

---

## DEC-031 — Tenant-scoped tour read only (DM-CT-03 / DI-RAW-01 / BULK-UNSAFE-03)

**Problem:** `PrismaTourRepository.resolveById` used `getPrismaAdmin().tour.findUnique({ id })` — an RLS bypass that could leak any tenant's row if wired to HTTP responses.

**Decision:** Remove `TourIdResolver`, `resolveById`, and db-layer `findById`. All tour reads go through `getById(id, tenantId)` / `findFirst({ tenantId, id })` inside `withTenantRls`. Cross-tenant UUID guess returns **404** `TOUR_NOT_FOUND` (no admin existence probe).

**Verification:** `apps/api/scripts/guard-no-id-only-tour-read.mjs`; `scoped-tour.repository.spec.ts`; `cross-tenant-forensic.spec.ts`; `integration.routes.spec.ts`.

---

## DEC-032 — Outbox claim updateMany tenant predicate (BULK-UNSAFE-04)

**Problem:** After `FOR UPDATE SKIP LOCKED`, relay marked rows `processing` via `updateMany({ where: { id: { in: [...] } } })` — primary key only, no `tenantId` in WHERE.

**Decision:** Compound predicate on every claim mark:

- **`claimPendingOutboxBatch`** — `OR` of `{ id, tenantId }` pairs from the claimed batch (multi-tenant poll).
- **`claimPendingOutboxBatchForTenant`** — `WHERE tenantId = $tenant AND id IN (...)`.

Admin connection remains required for cross-tenant SKIP LOCKED; this is defense-in-depth so a mistaken id list cannot flip another tenant's row.

**Verification:** `outbox-relay.integration.spec.ts` (source + integration); `5.4-S4-idempotency.spec.ts` parallel claim.

---

## DEC-033 — HTTP idempotency ALS assert (DI-MANUAL-01)

**Problem:** `runIdempotentCreateTour(tenantId, …)` accepted a manual `tenantId` parameter without verifying it matched AsyncLocalStorage. A future internal caller could pass `tenantId=B` while ALS=A, opening `withTenantRls(B)` under session A (gate/RLS divergence).

**Decision:** At entry, `requireActiveTenantId()` must equal `tenantId.trim()` or throw `HTTP_IDEMPOTENCY_TENANT_MISMATCH`. HTTP route already binds ALS via `runWithHttpRequestContext` before calling idempotency.

**Verification:** `apps/api/src/http/http-idempotency.spec.ts`; `test/1-reliability/idempotency-bypass.spec.ts` (HTTP path unchanged).

---

## DEC-034 — Audit actor pseudonym + metadata allowlist (LOG-COL-03)

**Problem:** `audit_events` rows stored raw `actor_id` (`auth.userId`) alongside `tenant_id` and `entity_id` (tour UUID) — a tenant↔user↔resource triangle if exported to observability backends.

**Decision:**

| Control    | Implementation                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `actor_id` | `pseudonymizeAuditActorId(actorId, tenantId)` — HMAC-SHA256 with `AUDIT_PSEUDONYM_KEY` or `LOG_HASH_KEY` |
| `metadata` | Allowlist `workspaceType` only; ignore/spread-block caller extras                                        |
| Export     | No audit→shared log replication; audit DB restricted                                                     |

**Verification:** `apps/api/src/audit/audit-logger.spec.ts`; `5.5-audit-events.spec.ts`; `audit-log-security.spec.ts`.

---

## DEC-035 — Dev seed logging hygiene (LOG-COL-05 / LOG-COL-11)

**Problem:** `db-seed.ts` logged `subdomain` + tenant UUID on one stdout line; failures used raw `console.error(error)`.

**Decision:** Structured pino only — `{ event: "db.seed.tenant", subdomain }` (no UUID); failures `{ event: "db.seed.failed", code: "SEED_DEV_TENANTS_FAILED" }` without error message/stack on shared stream.

**Verification:** `apps/api/scripts/db-seed.spec.ts` source review; aligns Phase 2 LOG-V-02/03.

---

## DEC-036 — CI tenant-isolation guard pack (Phase 1 step 9)

**Problem:** Phase 1 Must-Fix items (DM-CT-03, RLS GUC, unscoped queries) needed a single CI entry that runs all static depgrep guards — not only implicit `pretest` hooks.

**Decision:** Meta script `guard-tenant-isolation.mjs` runs in order:

| Script                           | npm alias                 | Blocks                                          |
| -------------------------------- | ------------------------- | ----------------------------------------------- |
| `guard-no-raw-queries.mjs`       | `guard:api-queries`       | Unscoped `findMany`/`findFirst` in route layers |
| `guard-rls-session-local.mjs`    | `guard:rls-session-local` | `set_config(..., false)` in `src/`              |
| `guard-no-id-only-tour-read.mjs` | `guard:id-only-tour-read` | `resolveById`, admin id-only `tour.findUnique`  |

Wired in `pretest` / `prebuild` / `prelint` and explicit in `phase-3:api-gate` after build+test.

**Verification:** `pnpm --filter @apps/api run guard:tenant-isolation`; `scripts/guard-tenant-isolation.spec.ts`.

---

## DEC-037 — Shared-stream log masking (LOG-COL-01 / 02 / 04)

**Problem:** Pino/stderr records co-located raw `tenant_id` with `Error.message`, stack fragments, or projection `reason` text — enabling tenant↔PII linkage in shared SIEMs.

**Decision:** [`observability/log-safety.ts`](../../../apps/api/src/observability/log-safety.ts) helpers:

| Sink                           | Allowed fields                                  | Forbidden on shared stream       |
| ------------------------------ | ----------------------------------------------- | -------------------------------- |
| HTTP 500 (`error-interceptor`) | `correlation_id`, `tenant_hash`, `error_code`   | `tenant_id`, `message`, `stack`  |
| Projection inconsistency       | `tenant_hash`, `domain_event_id`, `reason_code` | `tenantId`, `tourId`, `reason`   |
| Graceful shutdown failure      | `code: GRACEFUL_SHUTDOWN_FAILED`                | `console.*`, raw `Error.message` |

`tenant_hash` = HMAC-SHA256(`LOG_HASH_KEY` or `AUDIT_PSEUDONYM_KEY`). Test signals may retain full `reason` in memory only (`NODE_ENV=test`).

**Verification:** `log-safety.spec.ts`, `projection-reconciliation.spec.ts`, `error-enrichment.spec.ts`, `log-privacy.spec.ts`; cross-ref Phase 2 LOG-V-01.

---

## DEC-038 — Client error log safety (LOG-COL-06 / LOG-COL-07)

**Problem:** Enriched `ValidationFailure` and `SchemaVersionMismatchError` carry `tenant_id` + user-facing `message` on the same Error instance. If ever passed to pino (misclassified 500 or future middleware), shared SIEMs get tenant↔validation-text co-location.

**Decision:**

| Type                         | Safe log helper                      | Allowed fields                                | Forbidden on shared stream               |
| ---------------------------- | ------------------------------------ | --------------------------------------------- | ---------------------------------------- |
| `ValidationFailure`          | `toValidationFailureLogFields()`     | `error_code`, `tenant_hash`, `correlation_id` | `message`, `detail`, raw `tenant_id`     |
| `SchemaVersionMismatchError` | `toSchemaVersionMismatchLogFields()` | `error_code`, `tenant_hash`, `correlation_id` | `message`, version text, raw `tenant_id` |

HTTP 400 path: `handleHttpError` **does not log** these errors (client body only). CI `guard:client-error-log` bans `tenant_id`+`message` co-location in logger calls and direct logger pass-through of `error`/`failure` variables.

**Verification:** `validation-failure.spec.ts`, `schema-version-mismatch.spec.ts`, `guard-no-client-error-log-co-location.mjs`.

---

## DEC-039 — Registry boot policy + idempotency memory bounds (DI-REG-01 / DI-IDEM-02)

**Problem (DI-REG-01):** `DEV_TENANTS` can still satisfy resolution in misconfigured deploys (`NODE_ENV` outside `test`/`development` without `DATABASE_URL`). `ProvisioningService.resolveTenantIdentity` called `findTenantBySubdomain` without the static-registry gate.

**Decision (registry):**

| Check                                 | When                                                    | Action                                                                                       |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `assertStaticTenantRegistryRuntime()` | Boot (`main.ts` via `assertProductionRuntimeIntegrity`) | Production: static registry must be disallowed; prod-like env without `DATABASE_URL` → throw |
| `isStaticTenantRegistryAllowed()`     | All static lookups                                      | Unchanged DEC-025 contract                                                                   |
| Provisioning static lookup            | `resolveTenantIdentity`                                 | `findTenantBySubdomain` only when `isStaticTenantRegistryAllowed()`                          |
| Club smoke seed theme (GL-BRAND-02)   | `ProvisioningService.seedDenaliSmokeTenant`             | Copy `DEV_TENANTS` theme only when `canResolveDevTenantRegistryFallback()` — so Postgres-backed **dev/test** (Phase 6.6 with `DATABASE_URL`) still seeds `displayName=shenski`. Production auth mode stays workspace-type color-only. Ungated `findTenantBy*` is forbidden. |

CI `guard:static-registry` bans direct `findTenantById` / `findTenantBySubdomain` outside `tenant-registry.ts` unless the prior 6-line window contains `isStaticTenantRegistryAllowed()` or `canResolveDevTenantRegistryFallback()`.

**Problem (DI-IDEM-02):** `memoryByKey` Map grew without bound in memory storage driver — resource leak in dev/test.

**Decision (idempotency memory):**

| Control               | Default                                | Env override                          |
| --------------------- | -------------------------------------- | ------------------------------------- |
| Completed-entry TTL   | 300_000 ms                             | `HTTP_IDEMPOTENCY_MEMORY_TTL_MS`      |
| Max completed entries | 512                                    | `HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES` |
| Test reset            | `resetHttpIdempotencyMemoryForTests()` | Called between specs                  |

Processing entries are never TTL-evicted. LRU evicts oldest **completed** entries when over cap. Production uses Prisma path only (DEC-GAP-03).

**Verification:** `tenant-registry.spec.ts`, `http-idempotency.memory.spec.ts`, `guard-static-registry-gate.mjs`.

---

## DEC-040 — Phase 1 formal regression gate (closure step 4)

**Problem:** Death-Match fixes (Must-Fix + LOG + DI-REG/DI-IDEM) were verified ad hoc; no single CI-invokable gate recorded pass/fail for Phase 1 sign-off.

**Decision:** `pnpm run phase-1:regression-gate` orchestrates:

| Tier                  | Steps                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Guards**            | `guard:tenant-isolation`, `guard:client-error-log`, `guard:static-registry`                                                                                  |
| **ALS scripts**       | `stress-tenant-context-switch.ts`, `verify-als-request-cleanup.ts`                                                                                           |
| **Isolation specs**   | `0-security/*`, `security-isolation-stress`, `validation-gate-concurrency`, `bulk-import-consistency`, `in-memory-tour.repository`, `canonical-tour.service` |
| **Observability**     | `log-safety`, `validation-failure`, `schema-version-mismatch`, `error-enrichment`, `log-privacy`, `projection-reconciliation`                                |
| **Postgres optional** | `raw-sql-exposure`, `5.4-S4-idempotency` when `DATABASE_URL` set                                                                                             |

Pass criteria: exit `0`; results appended to [`phase1-aggressive-audit.md`](../../../apps/api/docs/phase1-aggressive-audit.md) § Regression gate run log.

**Verification:** `scripts/phase-1-regression-gate.mjs`, `test/reliability/phase-1-regression-gate.spec.ts`.

---

## DEC-041 — Phase 1 formal sign-off (closure step 5)

**Closure date:** 2026-06-05  
**Scope:** Death-Match Must-Fix (7/7), LOG-COL P0+P1 principal items, DI-REG-01 / DI-IDEM-02, formal regression gate (DEC-040).

| Metric                                | Pre-audit            | Post-closure                                                                                        |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| Death-Match verdict                   | PASS WITH CONDITIONS | **PASS** (residual = waived worker risks + optional Postgres tier)                                  |
| Execution trust score                 | 84 / 100 (Tier B+)   | **94 / 100** (Tier **A−**)                                                                          |
| Confirmed HTTP cross-tenant tour read | 0                    | **0**                                                                                               |
| Must-Fix open                         | 7                    | **0**                                                                                               |
| LOG-COL CRITICAL open                 | 4                    | **0**                                                                                               |
| Formal regression gate                | ad hoc               | **`pnpm run phase-1:regression-gate` PASS** (8 steps; Postgres tier skipped without `DATABASE_URL`) |

**Verdict semantics (resolves CON-01):**

| Count type                               | Meaning                                                           | Post-closure                                    |
| ---------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| CRITICAL **ALS singleton leak** findings | Request A tenant survives into request B on shared service fields | **0**                                           |
| CRITICAL **HTTP cross-tenant tour read** | Tenant A receives Tenant B row in API response                    | **0**                                           |
| CRITICAL **code backdoor** (historical)  | DI-RAW-01 `resolveById` admin id-only probe                       | **Closed** — DEC-031, `guard:id-only-tour-read` |

**Remaining conditions (not blockers for Phase 1 sign-off):** DM-CT-06 / BULK-UNSAFE-02 worker global claim (waived); Postgres-tier specs when `DATABASE_URL` unset; LOG-COL-10 product/docs; DI-LGC-01 if dual-write enabled.

**P2 pack (DEC-042):** LOG-COL-08/09/12 + memory mixed-tenant HTTP spec — **Done**.

**Sign-off artifact:** [`apps/api/docs/phase1-aggressive-audit.md`](../../../apps/api/docs/phase1-aggressive-audit.md) § Phase 1 closure sign-off.

---

## DEC-042 — Phase 1 P2 zero-debt pack (closure step 6)

**Scope:** Optional P2 items from fix-list — not required for DEC-041 sign-off; closes residual LOG-COL P2 + memory HTTP gap #10.

| ID             | Change                                                                                           | Verification                                         |
| -------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **LOG-COL-08** | `normalizeHttpLogPath()` — strip query; redact UUID path segments to `:id` before `http.request` | `log-safety.spec.ts`, `log-privacy.spec.ts`          |
| **LOG-COL-09** | `outbox.relay.error` logs `error_code` only (no `message`)                                       | `start-outbox-relay.ts`                              |
| **LOG-COL-12** | Chaos harness stderr → JSON `{ event, code }` only                                               | `atomic-crash-worker.ts`, `atomic-tx-crash-child.ts` |
| **#10**        | `memory-mixed-tenant-http.spec.ts` — concurrent A/B POST+GET on memory driver                    | `test/1-integration/`                                |

**Deferred (unchanged):** LOG-COL-10 (product response shape); IDX-ADV-\* (no new queries); DI-LGC-01 (dual-write not enabled).

---

## DEC-043 — Phase 2 step 1 closure (LOG-V-01 / STD-BYPASS-02)

**Scope:** Phase 2 paranoid audit Must-Fix #1 — eliminate the last production unstructured sink on graceful shutdown.

| ID                | Change                                                                                                                                                                       | Verification                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **LOG-V-01**      | `installGracefulShutdownHandlers` logs `graceful_shutdown.failed` via pino with `code: GRACEFUL_SHUTDOWN_FAILED` only — no `console.error`, no `Error.message` interpolation | `graceful-shutdown.ts`, `graceful-shutdown.spec.ts`             |
| **STD-BYPASS-02** | Same as LOG-V-01 — `src/server/graceful-shutdown.ts` is the former single production bypass                                                                                  | `guard-no-console-in-src.mjs`                                   |
| **STD-BYPASS-01** | CI guard forbids `console.(log\|error\|warn\|debug\|info)` under `apps/api/src/` (excludes `*.spec.ts`)                                                                      | `pnpm run guard:no-console-src` wired in `prebuild` / `pretest` |

**Cross-phase:** Implementation landed with DEC-037 (`graceful_shutdown.failed` row in observability matrix). DEC-043 is the Phase 2 formal closure + regression lock.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 1.

---

## DEC-044 — Phase 2 step 2 closure (TRACE-REGEN-01 / TRACE-CONTEXT-SPLIT)

**Scope:** Phase 2 Must-Fix #2 — one trace id per HTTP request end-to-end (ALS → Postgres GUC → error `correlationId`).

| ID                      | Change                                                                                                                          | Verification                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **TRACE-REGEN-01**      | `runWithHttpRequestContext` skips nested `runWithTraceContext` when `getActiveTraceId()` is already set (outer `app.ts` bind)   | `bind-request-context.spec.ts`                        |
| **TRACE-CONTEXT-SPLIT** | Headerless clients no longer get independent `randomUUID()` at inner bind — persist GUC and `handleHttpError` share the same id | `trace-isolation.spec.ts`, `error-enrichment.spec.ts` |

**Invariant:** Ingress resolution runs at most once per HTTP request on the hot path (`app.ts` → routes reuse). Direct script callers without outer bind still resolve once inside `runWithHttpRequestContext`.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 2.

---

## DEC-045 — Phase 2 step 3 closure (AUDIT-GAP-01)

**Scope:** Phase 2 Must-Fix #3 — production cannot run without forensic storage; memory driver explicitly non-forensic.

| ID                        | Change                                                                                                                                  | Verification                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **AUDIT-GAP-01 (prod)**   | `assertProductionStorageDriver()` + `assertProductionRuntimeIntegrity()` fail boot on `STORAGE_DRIVER=memory` or missing `DATABASE_URL` | `production-runtime-env.spec.ts`, `create-tour-storage.spec.ts` |
| **Non-forensic contract** | `isForensicStorageDriver()` === `useAtomicCanonicalPersist()` — memory skips `appendAuditEvent` by design                               | `forensic-storage-driver.spec.ts`                               |
| **CI lock**               | `guard-forensic-storage-production.mjs` — boot chain + single `appendAuditEvent` production call site                                   | `pnpm run guard:forensic-storage` in `prebuild` / `pretest`     |

**Cross-phase:** Same policy as Phase 1 **DM-CT-01** / **DI-MEM-01** (DEC-GAP-03). Phase 2 adds explicit forensic naming, regression spec, and guard — not a new storage rule.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 3 · [`storage-driver-truth.md`](../../phase-4/appendices/storage-driver-truth.md) § Forensic vs non-forensic.

---

## DEC-046 — Phase 2 step 4 closure (TRACE-LOST-03)

**Scope:** Phase 2 Fix-next #1 — persist HTTP trace correlation on outbox insert at tour create.

| ID                    | Change                                                                                          | Verification                        |
| --------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| **TRACE-LOST-03**     | `persistNewTourAtomically` passes `correlationId: getActiveTraceId()` into `enqueueOutboxEvent` | `outbox-http-correlation.spec.ts`   |
| **Null when unbound** | No trace ALS → `correlation_id` column stays `NULL` (scripts / background callers)              | same spec                           |
| **CI lock**           | `guard-outbox-http-correlation.mjs` — atomic persist must wire trace → outbox                   | `pnpm run guard:outbox-correlation` |

**Cross-phase:** Column existed since Phase 5.4 outbox schema; only the create path was omitting the field. Relay trace continuation (**TRACE-LOST-02**) remains Phase 7.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 4 · [`trace-request-context.md`](trace-request-context.md) § Outbox correlation.

---

## DEC-048 — Phase 2 step 6 closure (TRACE-LOST-01)

**Scope:** Phase 2 Fix-next #3 — access logs carry the same trace id as error envelope / outbox correlation.

| ID                    | Change                                                                                          | Verification                       |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| **TRACE-LOST-01**     | `logHttpRequest` emits `correlation_id` from `getActiveTraceId()` in `res.on("finish")`         | `access-log-correlation.spec.ts`   |
| **Omit when unbound** | No `correlation_id` key when trace ALS absent (defensive — HTTP path always binds via `app.ts`) | same spec                          |
| **CI lock**           | `guard-http-access-trace.mjs`                                                                   | `pnpm run guard:http-access-trace` |

**Field name:** `correlation_id` (not `traceId`) — aligns with `http.error.internal` and Postgres GUC naming.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 6 · [`observability.md`](../../phase-4/appendices/observability.md) `http.request` row.

---

## DEC-049 — Phase 2 step 7 closure (MET-API-01)

**Scope:** Phase 2 Fix-next #4 (final) — tenant-scoped counters cannot open unlabeled billing series.

| ID             | Change                                                                                                         | Verification                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **MET-API-01** | `MetricsRegistry.increment` fail-closed when metric name is tenant-scoped and `labels.tenant_id` missing/empty | `metrics.spec.ts`                      |
| **Catalog**    | `TENANT_SCOPED_METRIC_NAMES` — `tour_creation_count`, `projection_inconsistency_total`                         | `guard-tenant-metrics-labels.mjs`      |
| **CI lock**    | Static scan: direct `metricsRegistry.increment` on tenant-scoped names must pass `tenant_id` label             | `pnpm run guard:tenant-metrics-labels` |

**HT-11 alignment:** New tenant business counters must be added to `TENANT_SCOPED_METRIC_NAMES` and use `tenant_id` label (see [`tenant-metrics.md`](tenant-metrics.md)).

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure step 7 — **Fix-next complete**.

---

## DEC-050 — Phase 2 formal regression gate (closure step 8)

**Problem:** Phase 2 closure steps 1–7 (DEC-043…049) were verified ad hoc; no single CI-invokable gate records pass/fail for observability sign-off.

**Decision:** `pnpm run phase-2:regression-gate` orchestrates:

| Tier                  | Steps                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 2 guards**    | `guard:no-console-src`, `guard:forensic-storage`, `guard:outbox-correlation`, `guard:tour-update-audit`, `guard:http-access-trace`, `guard:tenant-metrics-labels`                           |
| **ALS script**        | `verify-als-request-cleanup.ts`                                                                                                                                                             |
| **Memory specs**      | `bind-request-context`, `access-log-correlation`, `log-privacy`, `trace-isolation`, `tenant-metrics`, `metrics`, `forensic-storage-driver`, `create-tour-storage`, `production-runtime-env` |
| **Postgres optional** | `outbox-http-correlation`, `5.5-audit-events` when `DATABASE_URL` set                                                                                                                       |

Pass criteria: exit `0`; artifact `test/reliability/phase-2-regression-gate.last-run.json`.

**Verification:** `scripts/phase-2-regression-gate.mjs`, `test/reliability/phase-2-regression-gate.spec.ts`.

---

## DEC-051 — Phase 2 formal sign-off (closure step 9)

**Closure date:** 2026-06-05  
**Scope:** Phase 2 paranoid audit Must-Fix (3/3), Fix-next (5/5), formal regression gate (DEC-050).

| Metric                 | Pre-audit | Post-closure                                |
| ---------------------- | --------- | ------------------------------------------- |
| Red Team trust score   | 78 / 100  | **90 / 100**                                |
| Must-Fix open          | 3         | **0**                                       |
| Fix-next open          | 5         | **0**                                       |
| Formal regression gate | ad hoc    | **`pnpm run phase-2:regression-gate` PASS** |

**Verdict:** Phase 2 **observability parity closed** for trunk — residual P2/P3 items (TRACE-LOST-02 Phase 7, outbox-replay error mapper, MET-VALID-01 empty tenant_id) are scheduled, not blockers.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 closure sign-off.

---

## DEC-052 — HTTP request body size limit (Phase 3 closure step 1)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-03, SCAL-HF-06 (ingress), NN-07 (large POST parse).

| Item         | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Default max  | **256 KiB** (`HTTP_MAX_BODY_BYTES=262144`)                   |
| Reject point | `readRequestBodyRaw` — before `Buffer.concat` / `JSON.parse` |
| Status       | **413** `payload_too_large` / `REQUEST_BODY_TOO_LARGE`       |
| Logging      | **None** on 413 (client error)                               |

**Rationale:** Phase 3 event-loop audit priority #1 — blocks multi-MiB DoS and event-loop monopolization from oversized JSON without waiting for validation scheduler or pool saturation.

**Verification:** [`http-request-body-limit.md`](http-request-body-limit.md) · `guard:http-body-limit` · `test/3-performance/request-body-limit.spec.ts`.

---

## DEC-053 — Rate limiter theme lookup cache (Phase 3 closure step 2)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-04 (partial), RL-DOS-01, RL-DOS-03, RACE-01 (rate-limiter path).

| Item           | Choice                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| API            | `resolveTenantThemeJsonById` in `resolve-registered-tenant.ts`                            |
| Cache          | `tenant-registry-cache.ts` — `getCachedTenantThemeById` / `setCachedTenantThemeById`      |
| TTL            | **5s** (same as registry row cache)                                                       |
| Negative cache | `null` theme cached for unknown UUID — stops rotating-ID admin storms                     |
| Rate limiter   | `resolveEffectiveRateLimitForTenant` — **no direct** `getPrismaAdmin().tenant.findUnique` |

**Rationale:** Phase 3 audit primary bottleneck — uncached admin read on every rate-limited HTTP request under 100-tenant flood.

**Verification:** [`rate-limiting.md`](rate-limiting.md) · `guard:rate-limit-theme-cache` · `resolve-tenant-theme-cache.spec.ts`.

**Deferred (same pattern, later step):** `resolveTenantFeatureFlags` still uncached — separate ticket.

---

## DEC-054 — Validation queue max depth + shed (Phase 3 closure step 3)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-06, NN-04 (partial), SCAL-HF-04 (closure growth), RACE-04 (depth cap).

| Item   | Choice                                                              |
| ------ | ------------------------------------------------------------------- |
| Env    | `P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT` (default **64**)         |
| Scope  | **Pending** tasks per tenant in `tenantQueues` — in-flight excluded |
| Shed   | Immediate reject — `ValidationQueueSaturatedError`                  |
| HTTP   | **429** `validation_queue_saturated` / `VALIDATION_QUEUE_SATURATED` |
| Metric | `validation_queue_shed_total{tenant_id}`                            |

**Rationale:** Unbounded `tenantQueues` closures under bulk import → OOM and cross-tenant indirect delay (NN-04).

**Verification:** [`validation-fairness.md`](validation-fairness.md) · `guard:validation-queue-depth` · `validation-queue-depth.spec.ts`.

---

## DEC-055 — Per-tenant DB connection budget (Phase 3 closure step 4)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-01 (partial), NN-02 (fairness — tenant A cannot monopolize all pool slots).

| Item    | Choice                                                            |
| ------- | ----------------------------------------------------------------- |
| Env     | `TENANT_MAX_CONCURRENT_DB_OPS` (default **4**)                    |
| Scope   | `withTenantRls` + `withCanonicalTransaction` (app pool only)      |
| Acquire | Non-blocking — reject before `$transaction`                       |
| HTTP    | **503** `tenant_db_budget_exceeded` / `TENANT_DB_BUDGET_EXCEEDED` |
| Module  | `apps/api/src/db/tenant-connection-budget.ts`                     |

**Verification:** [`connection-budget.md`](connection-budget.md) · `guard:tenant-db-budget` · `tenant-connection-budget.spec.ts`.

---

## DEC-056 — Validation worker pool + time budget (Phase 3 closure step 5)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-02, NN-01 (partial), SCAL-HF-10 (event-loop CPU monopolization).

| Item           | Choice                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env            | `P5_VALIDATION_WORKER_POOL_SIZE` (default **2**); `P5_VALIDATION_TIME_BUDGET_MS` (default **10000**); `P5_VALIDATION_WORKERS_ENABLED` (`false` disables) |
| Offload        | `worker_threads` — `validation-worker-entry.ts` runs `validateCanonicalBeforePersistSync` off main thread                                                |
| Production API | `validateCanonicalBeforePersist()` → `runValidationOffThread()`; sync export retained for probes                                                         |
| Timeout        | Per-job timer in pool — `ValidationTimeBudgetExceededError`                                                                                              |
| HTTP           | **408** `validation_time_budget_exceeded` / `VALIDATION_TIME_BUDGET_EXCEEDED`                                                                            |
| Metric         | `validation_time_budget_exceeded_total{tenant_id}`                                                                                                       |
| Modules        | `validation-worker-pool.ts`, `validation-time-budget.ts`, `validation-worker-entry.ts`                                                                   |

**Rationale:** DEC-016 scheduler yields between tasks but validation body was still sync on the event loop; bulk RuleEngine work blocked heartbeats (`noisy-neighbor-latency`, `service-starvation`).

**Verification:** [`validation-fairness.md`](validation-fairness.md) · `guard:validation-workers` · `validation-worker-pool.spec.ts`.

---

## DEC-057 — Phase 3 formal regression gate (closure step 6)

**Problem:** Phase 3 closure steps 1–5 (DEC-052…056) were verified ad hoc; no single CI-invokable gate records pass/fail for P0 scalability sign-off.

**Decision:** `pnpm run phase-3:regression-gate` orchestrates:

| Tier                  | Steps                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 3 guards**    | `guard:http-body-limit`, `guard:rate-limit-theme-cache`, `guard:validation-queue-depth`, `guard:tenant-db-budget`, `guard:validation-workers`, `guard:rate-limiter-100-probe`                                                         |
| **Memory specs**      | `request-body-limit`, `resolve-tenant-theme-cache`, `validation-queue-depth`, `tenant-connection-budget`, `validation-worker-pool`, `tenant-rate-limiter-100`, `validation-gate-concurrency` (workers disabled for deterministic LRU) |
| **Postgres optional** | `db-pool-saturation` when `DATABASE_URL` set                                                                                                                                                                                          |

Pass criteria: exit `0`; artifact `test/reliability/phase-3-regression-gate.last-run.json`.

**Verification:** `scripts/phase-3-regression-gate.mjs`, `test/reliability/phase-3-regression-gate.spec.ts`.

---

## DEC-058 — Phase 3 P0 scale-out sign-off (closure step 7)

**Closure date:** 2026-06-05  
**Scope:** Phase 3 scalability audit P0 Must-Fix (SCAL-DEBT-01…03, 06 + partial 04), formal regression gate (DEC-057).

| Metric                 | Pre-closure P0 | Post-closure                                |
| ---------------------- | -------------- | ------------------------------------------- |
| Must-Fix P0 open       | 5              | **0**                                       |
| SCAL-DEBT P0 done      | 0              | **6** (01–03, 06 + partial 04 theme cache)  |
| Formal regression gate | ad hoc         | **`pnpm run phase-3:regression-gate` PASS** |

**Verdict:** Phase 3 **P0 scale-out blockers closed** for trunk — overall audit remains **CONDITIONAL** until remaining P1 backlog (SCAL-DEBT-09, 07/08 logging, partial 04 `REDIS_URL` prod guard, 10–13).

**Sign-off artifact:** [`apps/api/docs/phase3-scalability-stress-audit.md`](../../../apps/api/docs/phase3-scalability-stress-audit.md) § Phase 3 closure sign-off.

---

## DEC-059 — 100-tenant rate-limiter flood probe (Phase 3 P1 step 8)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-14, RL-DOS gap (two-tenant specs insufficient), partial RL-DOS-01 regression lock.

| Item         | Choice                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec         | `test/3-performance/tenant-rate-limiter-100.spec.ts`                                                                                                        |
| Shape        | **100** unique tenant IDs × **1** concurrent `POST /tours` each                                                                                             |
| Admin budget | When `DATABASE_URL` set: `getAdminThemeLookupCountForTests()` ≤ **100** on cold cache; second wave **0** new lookups                                        |
| SLO          | Storm ≤ **30s**; p95 ≤ **8s**; event-loop max heartbeat gap ≤ **500ms** (not raw tick count — busy loop under CI); all **201** (limit points ≥ flood count) |
| CI lock      | `guard:rate-limiter-100-probe` + `phase-3:regression-gate`                                                                                                  |

**Rationale:** DEC-053 theme cache mitigates RL-DOS-01 but two-tenant fairness specs do not bound 100-ID admin-pool amplification.

**Verification:** [`rate-limiting.md`](rate-limiting.md) · `guard:rate-limiter-100-probe` · `tenant-rate-limiter-100.spec.ts`.

---

## DEC-060 — Production storage driver CI lock (Phase 3 P1 step 9)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-05, DI-MEM-01, AUDIT-GAP-01 (formal cross-ref to Phase 1/2 DEC-GAP-03).

| Item            | Choice                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Runtime guard   | Existing `assertProductionStorageDriver()` in `create-tour-storage.ts` + `assertProductionRuntimeIntegrity()` at boot |
| CI lock         | `guard:production-storage-driver.mjs` — asserts boot chain + regression gate runs storage specs                       |
| Specs           | `create-tour-storage.spec.ts`, `forensic-storage-driver.spec.ts` in `phase-3:regression-gate`                         |
| Production rule | `NODE_ENV=production` + `STORAGE_DRIVER=memory` → `PRODUCTION_STORAGE_DRIVER_FORBIDDEN`                               |

**Rationale:** Fail-closed production storage was implemented in Phase 4/5; Phase 3 audit required a **formal regression lock** so misconfig cannot regress without CI failure.

**Verification:** [`storage-driver-truth.md`](../../phase-4/appendices/storage-driver-truth.md) · `guard:production-storage-driver` · `phase-3:regression-gate`.

---

## DEC-061 — Compiled cold-start readiness gate (Phase 3 P1 step 10)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-15, CS-UNSC-01/02 (compiled path); tsx dev boot remains documented as **unscalable** at 500 ms.

| Item              | Choice                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Probe             | Spawn `node dist/main.js` → poll `GET /health` (spawn-to-200 ms)                                                                |
| Samples           | **3** cold starts per run; report p50/p95/max                                                                                   |
| Budget            | Default **500 ms** p95 (`COLD_START_READINESS_BUDGET_MS`)                                                                       |
| Enforce (trunk)   | `COLD_START_READINESS_ENFORCE=false` in `phase-3:regression-gate` — records `unscalable: true` but **PASS** unless enforce=true |
| Enforce (nightly) | `COLD_START_READINESS_ENFORCE=true` via `test:nightly:cold-start` — **FAIL** when p95 > budget; not in trunk/pre-commit         |
| Artifact          | `test/reliability/cold-start-readiness.last-run.json`                                                                           |
| CI lock (trunk)   | `guard:cold-start-readiness-gate` + record-only step after `build-dist` in `phase-3:regression-gate`                            |
| CI lock (nightly) | `guard:cold-start-readiness-enforce` + `.github/workflows/api-nightly.yml`                                                      |

**Rationale:** `cold-start-latency.spec.ts` measures tsx/dev import graph (~2× over 500 ms SLO). Production scale-to-zero readiness must use **compiled** `dist/main.js`. Trunk stays record-only so shared PR runners with variable p95 do not block merge; nightly/release hard-fail when lazy-boot p95 exceeds budget.

**Follow-on (lazy boot):** [`cold-start-lazy-boot.md`](cold-start-lazy-boot.md) — `main.ts` serves `/health` before `import("./app")`; tour stack and non-health routes load on first use. Gate samples (2026-06-05): p95 **240–290 ms** on `dist/main.js` (`unscalable: false`).

**Verification:** `apps/api/docs/phase3-scalability-stress-audit.md` §12 · `cold-start-readiness-gate.mjs` · `test:nightly:cold-start` · `guard:cold-start-readiness-enforce` · `cold-start-lazy-boot.md`.

---

## DEC-062 — Async request-log enqueue off `finish` (Phase 3 P1 step 11)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-07, FOF-LOG-02 (partial; SCAL-DEBT-08 remains open for sink-level backpressure contract).

| Item         | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Ingress hook | `withRequestLogging()` captures request context at `finish` and enqueues log write    |
| Dispatch     | `setImmediate` drain so the response `finish` path avoids synchronous `logger.info()` |
| Queue cap    | `HTTP_LOG_QUEUE_MAX` (default **2048**) with fail-open drop on overflow               |
| Drop signal  | Warn once per burst with dropped count (no throw; availability-first logging path)    |
| Scope        | Request access logs only; does not change outbox/audit logger behavior                |

**Rationale:** Slow sink pressure previously executed log write inline with `finish`, compounding tail latency under 503/200 storms. Moving to an async bounded queue preserves request-path responsiveness while keeping logs best-effort.

**Verification:** `request-logging.spec.ts` · `log-backpressure-burst.ts` baseline · `phase-3:regression-gate`.

---

## DEC-063 — Logging backpressure contract (Phase 3 P1 step 12)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-08, FOF-LOG-01 (bounded buffer + metrics), FOF-LOG-03 (shutdown flush).

| Item          | Choice                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------ |
| Destination   | Explicit `pino.destination({ dest: 1, sync: false, minLength, maxLength })`                |
| Bound         | `LOG_SINK_MAX_LENGTH` default **4 MiB** — Sonic-Boom `drop` on overflow                    |
| Observability | `log_sink_drain_total`, `log_sink_drop_total` counters                                     |
| Shutdown      | After `server.close()`: `drainHttpRequestLogQueueSync()` → `flushLogSink()` → outbox flush |
| Flush timeout | `LOG_SINK_FLUSH_TIMEOUT_MS` default **2000** — fail-open                                   |

**Rationale:** DEC-062 decoupled HTTP `finish` from Pino enqueue; step 12 completes the sink contract so operators can observe backpressure and shutdown does not silently discard buffered access logs.

**Verification:** [`logging-backpressure.md`](logging-backpressure.md) · `guard:log-backpressure-contract` · `logger-backpressure.spec.ts`.

---

## DEC-064 — Tour write concurrency cap (Phase 3 P1 step 13)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-09, NN-05 (partial — no dedicated bulk route).

| Item   | Choice                                                                 |
| ------ | ---------------------------------------------------------------------- |
| Scope  | `POST /tours` only (create path)                                       |
| Cap    | `TENANT_MAX_CONCURRENT_TOUR_WRITES` default **8** in-flight per tenant |
| HTTP   | **429** `tour_write_concurrency_exceeded`                              |
| Hook   | `runWithHttpRequestContext(..., { tourWriteConcurrency: true })`       |
| Metric | `tour_write_concurrency_shed_total`                                    |

**Rationale:** RPS limits bound arrival rate; DB budget bounds TX slots. Bulk-import storms need an HTTP-level concurrent-create semaphore before validation CPU and pool pressure accumulate.

**Verification:** [`tour-write-concurrency.md`](tour-write-concurrency.md) · `guard:tour-write-concurrency` · `tour-write-concurrency.spec.ts`.

---

## DEC-065 — Production `REDIS_URL` guard (Phase 3 P1 step 14)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-04 (complete), RL-DOS-02 (prod misconfig), SCAL-HF-02 (prod path).

| Item       | Choice                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| When       | `NODE_ENV=production` + `TENANT_RATE_LIMIT_ENABLED` not `false`              |
| Rule       | Non-empty `REDIS_URL` required — boot throws `PRODUCTION_REDIS_URL_REQUIRED` |
| Skip       | Rate limiting disabled → memory store allowed (single-node ops only)         |
| Boot chain | `assertProductionRedisUrl()` from `assertProductionRuntimeIntegrity()`       |
| CI lock    | `guard:production-redis-url`                                                 |

**Rationale:** DEC-053 closed admin theme amplification; memory `RateLimiterMemory` keys remain unbounded (RL-DOS-02) without Redis in multi-tenant production.

**Verification:** [`rate-limiting.md`](rate-limiting.md) · `guard:production-redis-url` · `production-runtime-env.spec.ts`.

---

## DEC-066 — Outbox relay per-tenant budget (Phase 3 P1 step 15)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-10, NN-03, NN-06 (partial).

| Item         | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Cap          | `OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT` default **4** concurrent publishes per tenant |
| Over cap     | Revert row to `pending` — deferred to next tick (not `failed`)                        |
| Scope        | `publishClaimedBatch` in `outbox-relay.ts`                                            |
| Metric       | `outbox_relay_tenant_deferred_total`                                                  |
| Result field | `OutboxRelayProcessResult.deferred`                                                   |

**Rationale:** Global batch claim + parallel publish allowed one tenant's backlog to amplify admin/app pool usage. Per-tenant in-flight cap bounds noisy-neighbor blast radius without disabling global throughput.

**Verification:** [`outbox-relay-fairness.md`](outbox-relay-fairness.md) · `guard:outbox-relay-tenant-budget` · `outbox-relay-tenant-budget.spec.ts`.

---

## DEC-067 — Idempotency memory TTL + LRU CI lock (Phase 3 P1 step 16)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-11, HT-08, SCAL-HF-03 (memory driver path).  
**Cross-ref:** Implementation in **DEC-039** — this step adds Phase 3 regression lock only.

| Item     | Choice                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| Bounds   | `HTTP_IDEMPOTENCY_MEMORY_TTL_MS` (default **300000**) + `HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES` (default **512**) |
| Eviction | TTL purge + LRU on **completed** entries only; `processing` claims never TTL-evicted                            |
| CI lock  | `guard:http-idempotency-memory-bounds` + `http-idempotency.memory.spec.ts` in `phase-3:regression-gate`         |

**Rationale:** Memory-driver idempotency was bounded in DEC-039; Phase 3 audit required explicit regression lock so `memoryByKey` cannot regress unbounded under HT-08 flood scenarios.

**Verification:** [`http-idempotency.md`](http-idempotency.md) · `guard:http-idempotency-memory-bounds` · `http-idempotency.memory.spec.ts`.

---

## DEC-068 — Registry cache max-size sweep (Phase 3 P1 step 17)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-12, RL-DOS-03 (partial).

| Item     | Choice                                                          |
| -------- | --------------------------------------------------------------- |
| Maps     | `byId`, `bySubdomain`, `themeById` — each bounded independently |
| Cap      | `TENANT_REGISTRY_CACHE_MAX_ENTRIES` default **1024** per map    |
| Eviction | Expired purge then LRU oldest key                               |
| TTL      | **5000 ms** unchanged                                           |

**Rationale:** DEC-053 added theme JSON cache for rate limiter; without max-size sweep, rotating UUID probes could still grow Maps between TTL expiries.

**Verification:** [`registry-cache-bounds.md`](registry-cache-bounds.md) · `guard:tenant-registry-cache-bounds` · `tenant-registry-cache.spec.ts`.

---

## DEC-069 — Victim SLO bulk import probe (Phase 3 P1 step 18)

**Date:** 2026-06-05  
**Closes:** SCAL-DEBT-13, NN-05 (partial), BULK-01 victim SLO gap.

| Item     | Choice                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Spec     | `bulk-import-victim-slo.spec.ts`                                        |
| Attacker | Tenant A — parallel `POST /tours` (`BULK_IMPORT_PARALLEL`)              |
| Victim   | Tenant B — `GET /health`, `GET /api/v2/tenant-config`, `GET /tours/:id` |
| SLO      | p99 ≤ baseline p50 × **4** per path (min **500 ms**)                    |
| CI lock  | `guard:bulk-import-victim-slo` + regression gate memory tier            |

**Rationale:** Closes the noisy-neighbor matrix gap where bulk import starves B login/read paths without a regression spec.

**Verification:** [`victim-slo-bulk-import.md`](victim-slo-bulk-import.md) · `guard:bulk-import-victim-slo` · `bulk-import-victim-slo.spec.ts`.

---

## DEC-070 — Nightly slow-sink adversarial probe (Phase 3 optional closure)

**Date:** 2026-06-05  
**Closes:** LOG-BP-03 adversarial gap, FOF-LOG nightly re-run (post DEC-062/063).

| Item     | Choice                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| Spec     | `log-slow-sink-adversarial.spec.ts`                                                     |
| Tier     | Nightly only — `skipUnlessNightlyTier`                                                  |
| Scenario | Burst `/health` with `withRequestLogging` while `logger.info` simulates slow sink drain |
| SLO      | 100% HTTP **200**; p99 ≤ **3000 ms**; log queue drains to **0**                         |
| CI lock  | `guard:log-slow-sink-nightly` — **not** in trunk `phase-3-regression-gate`              |

**Rationale:** Fast-path burst (LOG-BP-01) cannot prove safety when sink throughput < emit rate. Nightly probe validates DEC-062 decoupling + DEC-063 bounded sink under adversarial drain without blocking HTTP completion.

**Verification:** [`logging-backpressure.md`](logging-backpressure.md) § nightly · `pnpm run test:nightly:slow-sink` · `guard:log-slow-sink-nightly`.

---

## DEC-071 — Outbox processing reclaim + shutdown drain (Phase 4 step 1)

**Date:** 2026-06-05  
**Closes:** F-01, F-05, SD-G1, OZ-01/02/06 (partial), CASCADE-02 propagation.

| Item        | Choice                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| Reclaim TTL | `OUTBOX_PROCESSING_RECLAIM_MS` (default **120_000**)                                     |
| Claim time  | `processed_at` set when status → `processing`                                            |
| Reclaim     | `processing` → `pending`, `processed_at = null`                                          |
| Shutdown    | `drainOutboxRelayOnShutdown()` — reclaim + relay until no pending/reclaimable processing |
| CI lock     | `guard:outbox-processing-reclaim`                                                        |

**Rationale:** Deploy SIGTERM mid-relay left permanent `processing` zombies; shutdown flush ignored them (SD-G1). Time-boxed reclaim restores at-least-once delivery without manual SQL.

**Verification:** [`outbox-processing-reclaim.md`](outbox-processing-reclaim.md) · `guard:outbox-processing-reclaim` · `outbox-processing-reclaim.spec.ts`.

---

## DEC-072 — Outbox publish / mark-done pairing (Phase 4 step 2)

**Date:** 2026-06-05  
**Closes:** F-02, OZ-02 (partial).

| Item        | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Mark-done   | Conditional `processing` → `done` with retry after bus publish    |
| Pairing gap | Publish success + mark failure → stay `processing` (not `failed`) |
| OZ-02 heal  | Reclaim tick marks `done` when `processed_domain_events` matches  |
| CI lock     | `guard:outbox-publish-done-pairing`                               |

**Rationale:** Bus could lead DB by one admin round-trip; stuck `processing` implied undelivered events. Retries shrink the window; reclaim heal closes the OZ-02 gap when handlers already claimed delivery.

**Verification:** [`outbox-publish-done-pairing.md`](outbox-publish-done-pairing.md) · `guard:outbox-publish-done-pairing` · `outbox-publish-done-pairing.spec.ts`.

---

## DEC-073 — Phase 4 cross-phase P0 verify (step 3)

**Date:** 2026-06-05  
**Closes:** CASCADE-01 (partial), CASCADE-03 (partial) — verifies Phase 3 mitigations for NN / RL-DOS / Redis.

| Item       | Choice                                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| NN-01/02   | Re-run DEC-054…056, DEC-069 guards + probes                                     |
| RL-DOS-01  | Re-run DEC-053, DEC-059, DEC-068 guards + `tenant-rate-limiter-100`             |
| SCAL-HF-11 | Verify DEC-065 boot guard — **runtime blip residual** (SH-GAP-13)               |
| Gate       | `phase-4:cross-phase-p0-verify` → `phase-4-cross-phase-p0-verify.last-run.json` |
| CI lock    | `guard:phase4-cross-phase-p0`                                                   |

**Rationale:** Phase 4 Must-Fix NN/RL-DOS/Redis items are implemented in Phase 3; step 3 proves they remain wired without duplicating implementation.

**Verification:** [`phase4-cross-phase-p0-verify.md`](phase4-cross-phase-p0-verify.md) · `pnpm run phase-4:cross-phase-p0-verify` · `guard:phase4-cross-phase-p0`.

---

## DEC-074 — Tenant registry cache invalidation on write (Phase 4 step 4)

**Date:** 2026-06-05  
**Closes:** PU-F-01, PU-F-04 (partial).

| Item    | Choice                                                         |
| ------- | -------------------------------------------------------------- |
| API     | `invalidateTenantRegistryCache(tenantId, subdomain?)`          |
| Hooks   | `ProvisioningService` upsert/create; `updateTenantRegistryRow` |
| Metric  | `tenant_registry_cache_invalidated_total`                      |
| CI lock | `guard:tenant-registry-cache-invalidation`                     |

**Rationale:** 5s TTL cache served stale theme/workspace after admin writes; tests hid gap with full cache reset. Targeted invalidation makes hot-reload coherent without restart.

**Verification:** [`tenant-registry-cache-invalidation.md`](tenant-registry-cache-invalidation.md) · `guard:tenant-registry-cache-invalidation` · `tenant-registry-cache-invalidation.spec.ts` · `dynamic-config-sync.spec.ts`.

---

## DEC-075 — Proxy upstream timeout + circuit breaker (Phase 4 step 5)

**Date:** 2026-06-05  
**Closes:** PI-01.

| Item    | Choice                                                                         |
| ------- | ------------------------------------------------------------------------------ |
| Timeout | `PROXY_UPSTREAM_TIMEOUT_MS` (default **5000**) — `AbortSignal.timeout`         |
| Breaker | `PROXY_CIRCUIT_FAILURE_THRESHOLD` (**5**), `PROXY_CIRCUIT_OPEN_MS` (**30000**) |
| CI lock | `guard:proxy-upstream-timeout`                                                 |

**Rationale:** Unbounded `fetch` to map upstream would hold request slots when routes wire. Bounded deadline + per-host circuit fast-fails before systemic hang.

**Verification:** [`proxy-upstream-timeout.md`](proxy-upstream-timeout.md) · `guard:proxy-upstream-timeout` · `proxy-upstream-timeout.spec.ts`.

---

## DEC-076 — Graceful shutdown relay await + flush timeout (Phase 4 step 6)

**Date:** 2026-06-05  
**Closes:** SD-G2, SD-G3, F-11, F-12 (partial).

| Item    | Choice                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| SD-G2   | `OutboxRelayHandle.stop(): Promise<void>` awaits in-flight relay tick                 |
| SD-G3   | `drainOutboxRelayOnShutdown` returns `drained`; timeout → throw + metric + exit **1** |
| CI lock | `guard:graceful-shutdown-outbox`                                                      |

**Rationale:** Stop cleared the poll timer while a tick could still publish; flush deadline expiry was silent success. Await + explicit timeout signal closes deploy-window races.

**Verification:** [`graceful-shutdown-outbox-drain.md`](graceful-shutdown-outbox-drain.md) · `guard:graceful-shutdown-outbox` · `graceful-shutdown-outbox.spec.ts` · `start-outbox-relay.spec.ts`.

---

## DEC-077 — Canonical TX unified DB `now()` (Phase 4 step 7)

**Date:** 2026-06-05  
**Closes:** CLK-F-01, CLK-F-02 (atomic enqueue + relay path).

| Item                  | Choice                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| CLK-TT-01             | `readCanonicalTransactionNow(tx)` — single Postgres snapshot per canonical TX                  |
| Tour / audit / outbox | Explicit `createdAt: txNow` on all three writes in `persistNewTourAtomically`                  |
| CLK-TT-02             | Outbox row `created_at` set at enqueue (not app default); relay `occurredAt` unchanged mapping |
| Update audit          | `persistTourUpdateAtomically` passes `txNow` to `appendAuditEvent`                             |
| CI lock               | `guard:canonical-transaction-now`                                                              |

**Rationale:** Mixed app vs DB timestamps in one TX corrupt incident ordering. One DB `now()` per TX aligns tour, audit, outbox, and downstream relay `occurredAt`.

**Verification:** [`canonical-transaction-now.md`](canonical-transaction-now.md) · `guard:canonical-transaction-now` · `canonical-transaction-now.spec.ts` · `clock-skew-resilience.spec.ts` (CLK-SKEW-08).

---

## DEC-078 — PATCH schema drift HTTP spec (Phase 4 step 8)

**Date:** 2026-06-05  
**Closes:** SV-F-03, SV-CRIT-02 (inferred → proven).

| Item                | Choice                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Coverage            | Extend `schema-version-compat.spec.ts` with PATCH HTTP cases                                              |
| SV-PATCH-01 / SV-09 | Stale explicit `schemaVersion` → **400** `SCHEMA_VERSION_MISMATCH`                                        |
| SV-PATCH-05         | Partial merged `data` → **400** `VALIDATION_FAILURE`                                                      |
| SV-PATCH-OK         | Valid merge → **200**                                                                                     |
| CI lock             | `guard:patch-schema-drift`                                                                                |
| Worker path         | Rehydrate `SchemaVersionMismatchError` off-thread — prevents **500** when `P5_VALIDATION_WORKERS_ENABLED` |

**Rationale:** POST drift matrix was gated; PATCH shared validation code without contract tests. Mirroring SV-01/05/09 closes the audit gap without wiring Phase 6 `migrateCanonical`.

**Verification:** [`patch-schema-drift.md`](patch-schema-drift.md) · `guard:patch-schema-drift` · `schema-version-compat.spec.ts`.

---

## DEC-079 — Phase 4 resilience regression gate + sign-off (closure step 9)

**Date:** 2026-06-05  
**Closes:** Phase 4 resilience audit closure path (steps 1–9).

| Item             | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| Gate             | `pnpm run phase-4:resilience-regression-gate`              |
| Artifact         | `phase-4-resilience-regression-gate.last-run.json`         |
| Embeds           | `phase-4:cross-phase-p0-verify` (DEC-073)                  |
| Sign-off verdict | **CLOSURE_PASS_WITH_RESIDUAL** (score **78/100** estimate) |
| CI lock          | `guard:phase4-resilience-regression-gate`                  |

**Rationale:** Steps 1–8 shipped isolated guards; trunk needed one orchestrated gate + signed artifact before Phase 5 handoff. Residual risks (Redis blip, Phase 6 migrate, SD-G4+) documented — not Phase 4 closure blockers.

**Verification:** [`phase4-resilience-regression-gate.md`](phase4-resilience-regression-gate.md) · `guard:phase4-resilience-regression-gate` · `phase-4-resilience-regression-gate.spec.ts`.

---

## DEC-080 — Postgres required in Phase 4 resilience gates (Wave A)

**Date:** 2026-06-05  
**Closes:** GAP-95-A01 … GAP-95-A03 — optional Postgres tier allowed PASS without integration proof.

| Item     | Choice                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| Policy   | `DATABASE_URL` required — gate `exit 1` when unset                            |
| Helper   | `apps/api/scripts/lib/require-gate-database.mjs`                              |
| Gates    | `phase-4-resilience-regression-gate.mjs`, `phase-4-cross-phase-p0-verify.mjs` |
| Artifact | `postgresRequired: true`, `databaseUrlSet: true`                              |

**Rationale:** 9.5+ enterprise bar treats skip-as-pass as fail. Testcontainers/service Postgres in CI; local dev uses `docs/phase-4/dev/docker-compose.yml`.

**Verification:** [`postgres-required-gates.md`](postgres-required-gates.md) · `require-gate-database.mjs` · meta specs assert `databaseUrlSet`.

---

## DEC-081 — GitHub Actions Postgres for `phase-4:gate` (Wave A)

**Date:** 2026-06-05  
**Closes:** GAP-95-A02 — `p4_rls_integration_tests` fail without CI Postgres.

| Item      | Choice                                                             |
| --------- | ------------------------------------------------------------------ |
| Workflow  | `.github/workflows/phase-4-gate.yml`                               |
| Service   | `postgres:16` on port 5434                                         |
| Bootstrap | `01-app-role.sql` → `prisma migrate deploy` → `001_tenant_rls.sql` |
| Commands  | `phase-4:resilience-regression-gate` then `phase-4:gate`           |

**Rationale:** Trunk CI must prove RLS + resilience integration without manual Docker on every PR.

**Verification:** [`docs/phase-4/ci.md`](../../phase-4/ci.md) · workflow green on PR.

---

## DEC-082 — Postgres integration pack in resilience gate (Wave A)

**Date:** 2026-06-05  
**Closes:** GAP-95-A04 … GAP-95-A06 — outbox/clock/config specs skipped in gate path.

| Item    | Choice                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| Step id | `phase4-resilience-postgres-specs` (always runs)                                      |
| Specs   | clock-skew, dynamic-config, outbox reclaim/pairing, relay + transactional integration |
| Env     | `STORAGE_DRIVER=prisma`, `OUTBOX_RELAY_ENABLED=false`                                 |

**Rationale:** Memory tier proves source invariants; postgres tier proves RLS + relay under real DB — SimpleOutbox-class integration gate.

**Verification:** [`postgres-required-gates.md`](postgres-required-gates.md) · `guard:phase4-resilience-regression-gate` lists all spec paths.

---

## DEC-083 — Redis rate limiter runtime fallback (Wave B)

**Date:** 2026-06-05  
**Closes:** SH-GAP-13 — Redis blip → 500 on throttled routes.

| Item               | Choice                                   |
| ------------------ | ---------------------------------------- |
| Write tier default | `fail_local` → in-process memory bucket  |
| Read tier default  | `fail_open`                              |
| Override           | `TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY` |
| Circuit            | 3 failures → 30s open → skip Redis       |
| Metric             | `rate_limiter_redis_fallback_total`      |
| fail_closed        | `RateLimiterRedisUnavailableError` → 503 |

**Verification:** [`redis-rate-limiter-fallback.md`](redis-rate-limiter-fallback.md) · `guard:redis-rate-limiter-fallback` · `redis-rate-limiter-fallback.spec.ts`.

---

## DEC-084 — Terminal timestamps via SQL `now()` (Wave B)

**Date:** 2026-06-05  
**Closes:** CLK-F-03, CLK-F-04.

| Item        | Choice                                     |
| ----------- | ------------------------------------------ |
| Outbox done | `processed_at = now()` in `markOutboxDone` |
| Idempotency | `completed_at = now()` on Prisma path      |
| Spec        | CLK-SKEW-10 — JWT ±5s boundary             |

**Verification:** [`canonical-terminal-timestamps.md`](canonical-terminal-timestamps.md) · `guard:canonical-terminal-timestamps`.

---

## DEC-085 — HTTP shutdown watchdog + worker parity (Wave B)

**Date:** 2026-06-05  
**Closes:** SD-G4, SD-G5, SD-G7.

| Item        | Choice                                               |
| ----------- | ---------------------------------------------------- |
| HTTP cap    | `GRACEFUL_SHUTDOWN_HTTP_MS` (default 10s)            |
| Force close | `closeIdleConnections` / `closeAllConnections`       |
| Health      | 503 during shutdown                                  |
| Flush order | HTTP close → `flushLogSink` → outbox drain           |
| Worker      | `installGracefulShutdownHandlers` — SIGTERM + SIGINT |

**Verification:** [`graceful-shutdown-http-watchdog.md`](graceful-shutdown-http-watchdog.md) · `guard:graceful-shutdown-outbox` (extended).

---

## DEC-086 — Outbox terminal `failed` + admin replay (Wave C)

**Date:** 2026-06-05  
**Closes:** F-03 — poison outbox with no ops replay path.

| Item     | Choice                                                           |
| -------- | ---------------------------------------------------------------- |
| Column   | `outbox_events.last_error JSONB`                                 |
| Terminal | `failed` + `processed_at` + `last_error` — relay never re-claims |
| Replay   | `replayFailedOutboxEvent` → `pending`; payload immutable         |
| HTTP     | `POST /internal/outbox/:id/replay` + bulk `/internal/outbox/replay` — Phase 3.17 prod ops JWT `outbox:replay` |
| CLI      | `outbox:replay-failed` (dry-run default; `--apply` confirms)                 |
| Spec     | `outbox-failed-replay.spec.ts` — INT-SAGA-03 heal; `outbox-prod-replay.spec.ts` |

**Verification:** [`outbox-failed-replay.md`](outbox-failed-replay.md) · [`OUTBOX_PRODUCTION_REPLAY.md`](../../phase-20/p7/appendices/OUTBOX_PRODUCTION_REPLAY.md) · `guard:outbox-failed-replay`.

---

## DEC-087 — Outbox relay ordered per tenant (Wave C)

**Date:** 2026-06-05  
**Closes:** F-15, BL-01 — same-tenant publish order under parallel relay.

| Item    | Choice                                           |
| ------- | ------------------------------------------------ |
| Env     | `OUTBOX_RELAY_ORDERED_PER_TENANT=true`           |
| Claim   | `NOT EXISTS` processing sibling same `tenant_id` |
| Default | Unordered (backward compatible)                  |

**Verification:** [`outbox-relay-ordered-per-tenant.md`](outbox-relay-ordered-per-tenant.md) · `guard:outbox-relay-ordered-per-tenant` · `outbox-relay-ordered-per-tenant.spec.ts`.

---

## DEC-088 — Projection lag metric + reconcile job (Wave C)

**Date:** 2026-06-05  
**Closes:** F-04 / OZ-D — ops visibility for projection drift.

| Item    | Choice                                                 |
| ------- | ------------------------------------------------------ |
| Metric  | `outbox_projection_lag_seconds` (gauge, tenant-scoped) |
| Job     | `reconcile:tour-projection`                            |
| Compare | `deriveTourProjections(canonical)` vs `tours` columns  |

**Verification:** [`outbox-projection-reconcile.md`](outbox-projection-reconcile.md) · `guard:outbox-projection-lag`.

---

## DEC-089 — Chaos SIGKILL + NN victim SLO in postgres gate (Wave C)

**Date:** 2026-06-05  
**Closes:** OZ-A, CASCADE-01 — postgres gate missing chaos + victim proofs.

| Item       | Choice                                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs      | `atomic-rollback-stress`, `bulk-import-victim-slo`, `outbox-failed-replay`, `outbox-relay-ordered-per-tenant` — `noisy-neighbor-latency` **nightly only** (aligns cross-phase P0 NN-01 row; removed from blocking gate 2026-06-07) |
| Chaos env  | `P5_CHAOS_ITERATIONS=5` in gate (fast path)                                                                                                                                                                                        |
| Post-chaos | `processing` rows for chaos tenant ≤ 0 (stale claim alert)                                                                                                                                                                         |
| Guards     | Wave C guards in resilience gate STEPS                                                                                                                                                                                             |

**Verification:** [`postgres-required-gates.md`](postgres-required-gates.md) (Wave C table) · `guard:phase4-resilience-regression-gate` (extended paths).

---

## DEC-090 — Feature flags via theme cache (Wave D)

**Date:** 2026-06-05  
**Closes:** FF-RC-02, PU-F-03 (partial) — uncached admin reads on hot write path.

| Item         | Choice                                                             |
| ------------ | ------------------------------------------------------------------ |
| Read path    | `resolveTenantFeatureFlags` → `resolveTenantThemeJsonById`         |
| Forbidden    | Direct `getPrismaAdmin().tenant.findUnique` in feature-flag module |
| Invalidation | DEC-074 `invalidateTenantRegistryCache` on admin writes            |
| Spec         | `tenant-registry-cache-coherence.spec.ts`                          |
| Guard        | `guard:tenant-registry-cache-coherence`                            |

**Verification:** [`tenant-registry-cache-coherence.md`](tenant-registry-cache-coherence.md).

---

## DEC-091 — migrateCanonical Phase 6 placeholder guard (Wave D)

**Date:** 2026-06-05  
**Closes:** SV-F-04 — documented deferral + import lock.

| Item           | Choice                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Hook           | `migrateCanonicalNotImplemented` throws `MIGRATE_CANONICAL_NOT_IMPLEMENTED_PHASE_5` |
| Write paths    | **Must not** import `migrate-canonical-hook` until Phase 6                          |
| Mismatch today | `SchemaVersionMismatchError` → **400**                                              |
| Guard          | `guard:migrate-canonical-placeholder`                                               |

**Verification:** [`migrate-canonical-phase6-placeholder.md`](migrate-canonical-phase6-placeholder.md).

---

## DEC-092 — Malformed JSON → 400 INVALID_JSON (Wave D)

**Date:** 2026-06-05  
**Closes:** SV-11 — client parse errors must not 500.

| Item     | Choice                                                       |
| -------- | ------------------------------------------------------------ |
| Parser   | `parseJsonBody` / `MalformedJsonBodyError` in `http/json.ts` |
| Routes   | `tours.routes.ts` POST/PATCH                                 |
| Response | **400** `{ code: "INVALID_JSON" }` — no error log            |
| Spec     | `malformed-json-body.spec.ts`                                |
| Guard    | `guard:http-malformed-json`                                  |

**Verification:** [`http-malformed-json.md`](http-malformed-json.md).

---

## DEC-093 — TenantHttpProxy DI + map enrich route (Wave D)

**Date:** 2026-06-05  
**Closes:** PI-03 — proxy seam production-wired.

| Item         | Choice                                |
| ------------ | ------------------------------------- |
| Env          | `MAP_UPSTREAM_BASE_URL`               |
| Bootstrap    | `main.ts` → `AppDeps.tenantHttpProxy` |
| Route        | `GET /api/v2/map/enrich?path=`        |
| Unconfigured | **503** `MAP_UPSTREAM_NOT_CONFIGURED` |
| Spec         | `proxy-production-wire.spec.ts`       |
| Guard        | `guard:proxy-production-wire`         |

**Verification:** [`proxy-production-wire.md`](proxy-production-wire.md).

---

## DEC-094 — Transient DB classifier + circuit breaker (evolution P0 Phase 1)

**Date:** 2026-06-05  
**Closes:** SH-GAP-04, SH-GAP-05, SH-GAP-15 — P1001/P1017 → 503 not 500.

| Item       | Choice                                                   |
| ---------- | -------------------------------------------------------- |
| Classifier | `isTransientDbError` in `src/db/transient-db-error.ts`   |
| Circuit    | `db-circuit-breaker.ts` — 3 failures → open 30s          |
| HTTP       | **503** + `Retry-After` (1s transient, 30s circuit open) |
| Wrapper    | `withTransientDbGuard` on `withTenantRls` outer boundary |
| Guard      | `guard:transient-db-error`                               |

**Verification:** [`transient-db-error.md`](transient-db-error.md) · [`phase5-evolution-p0-phase1.md`](phase5-evolution-p0-phase1.md).

---

## DEC-095 — db:test-reset production guard (evolution P0 Phase 1)

**Date:** 2026-06-05  
**Closes:** CAE-GAP-05, AR-30-10.

| Item   | Choice                                                   |
| ------ | -------------------------------------------------------- |
| Script | `scripts/db-test-reset.sh` — block `NODE_ENV=production` |
| URL    | Prod host heuristics unless `CONFIRM_TEST_RESET=1`       |
| Guard  | `guard-db-test-reset-prod.mjs`                           |

**Verification:** [`db-test-reset-prod-guard.md`](db-test-reset-prod-guard.md).

---

## DEC-096 — GHA phase-5 gate + test:full extension (evolution P0 Phase 1)

**Date:** 2026-06-05  
**Closes:** CI-BYP-12, CI-BYP-13.

| Item        | Choice                                           |
| ----------- | ------------------------------------------------ |
| Workflow    | `.github/workflows/phase-5-gate.yml`             |
| test:full   | `phase-5:gate` only (nests `phase-4:gate` → `phase-3:gate`) |
| Postgres CI | Same service container pattern as phase-4        |

**History:** Initial Phase 1 wiring ran sibling `phase-3:gate` → `phase-4:gate` → `phase-5:gate` (redundant nest). Flattened 2026-08-01 so `scripts/test-full.sh` invokes `phase-5:gate` once; coverage unchanged because `phase-5:gate` already nests prior gates.

**Verification:** [`phase5-evolution-p0-phase1.md`](phase5-evolution-p0-phase1.md).

---

## DEC-097 — Migration head preflight at boot (evolution P0 Phase 1)

**Date:** 2026-06-05  
**Closes:** MD-GAP-12, RB-GAP-04 (partial).

| Item     | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| Constant | `EXPECTED_PRISMA_MIGRATION_HEAD` in `migration-head-preflight.ts` |
| Probe    | Latest finished `_prisma_migrations` row at production boot       |
| Error    | `PRODUCTION_MIGRATION_HEAD_MISMATCH`                              |
| Guard    | `guard:migration-head-preflight`                                  |

**Verification:** [`migration-head-preflight.md`](migration-head-preflight.md).

---

## DEC-098 — Forward-only rollback runbook (evolution P1 Phase 2)

**Date:** 2026-06-05  
**Closes:** RB-GAP-01…04 (documentation).

| Item     | Choice                                                     |
| -------- | ---------------------------------------------------------- |
| Location | `docs/phase-4/production-deploy-checklist.md` § Bad deploy |
| Policy   | No `migrate down`; code/cache/outbox coordinated revert    |

**Verification:** [`phase5-evolution-p1-phase2.md`](phase5-evolution-p1-phase2.md).

---

## DEC-099 — OpenAPI dispatch contract (evolution P1 Phase 2)

**Date:** 2026-06-05  
**Closes:** SHADOW-API-01…07.

| Item      | Choice                                                  |
| --------- | ------------------------------------------------------- |
| SoT       | `src/openapi/dispatch-routes.ts`                        |
| Generator | `scripts/generate-openapi.mjs` → `openapi/openapi.json` |
| Scripts   | `openapi:generate`, `guard:openapi-dispatch-parity`     |

**Verification:** [`openapi-dispatch-contract.md`](openapi-dispatch-contract.md).

---

## DEC-100 — Deployment debt Phase 6 decision (evolution P1 Phase 2)

**Date:** 2026-06-05  
**Closes:** DEPLOY-DEBT-01/02 (decision; implementation Phase 6).

| Item    | Choice                                  |
| ------- | --------------------------------------- |
| Posture | Lockstep breaking deploy until MAP §8.3 |
| Doc     | `deploy-debt-phase6-decision.md`        |

**Verification:** [`deploy-debt-phase6-decision.md`](deploy-debt-phase6-decision.md).

---

## DEC-101 — Shutdown ingress reject (evolution P1 Phase 2)

**Date:** 2026-06-05  
**Closes:** RB-GAP-09, RB-GAP-08 (partial).

| Item     | Choice                                                   |
| -------- | -------------------------------------------------------- |
| Gate     | `rejectRequestDuringShutdown` in `createRequestListener` |
| Response | **503** `shutting_down` on all routes                    |
| Guard    | `guard:shutdown-ingress`                                 |

**Verification:** [`graceful-shutdown-ingress-reject.md`](graceful-shutdown-ingress-reject.md).

---

## DEC-105 — Soft delete deferred Phase 6 (evolution P2 Phase 3)

**Date:** 2026-06-05  
**Closes:** CAE-GAP-01/02 (decision only).

| Item    | Choice                                 |
| ------- | -------------------------------------- |
| Posture | Hard delete + audit remains in Phase 5 |
| Doc     | `soft-delete-phase6-deferred.md`       |

---

## DEC-106 — Internal cache invalidate (evolution P2 Phase 3)

**Date:** 2026-06-05  
**Closes:** RB-GAP-13 (partial).

| Item  | Choice                                           |
| ----- | ------------------------------------------------ |
| Route | `POST /internal/cache/invalidate`                |
| Guard | dev/test only; `guard:internal-cache-invalidate` |

**Verification:** [`internal-cache-invalidate.md`](internal-cache-invalidate.md).

---

## DEC-107 — JWT dual-key verify (evolution P2 Phase 3)

**Date:** 2026-06-05  
**Closes:** SM-VUL (partial).

| Item | Choice                         |
| ---- | ------------------------------ |
| Env  | `AUTH_JWT_PUBLIC_KEY_PREVIOUS` |
| Code | `parse-jwt-bearer.ts` fallback |

**Verification:** [`jwt-dual-key-verify.md`](jwt-dual-key-verify.md).

---

## DEC-108 — Prometheus metrics export (evolution P2 Phase 3)

**Date:** 2026-06-05  
**Closes:** SCAL-LIM-02/03 (partial).

| Item   | Choice                  |
| ------ | ----------------------- |
| Route  | `GET /internal/metrics` |
| Format | `prometheus-format.ts`  |

**Verification:** [`metrics-prometheus-export.md`](metrics-prometheus-export.md).

---

## DEC-109 — Phase 5 evolution gate pack (evolution P2 Phase 3)

**Date:** 2026-06-05  
**Closes:** CI evolution guard rollup.

| Item    | Choice                            |
| ------- | --------------------------------- |
| Script  | `phase-5-evolution-gate.mjs`      |
| Command | `pnpm run phase-5:evolution-gate` |

**Verification:** [`phase5-evolution-p2-phase3.md`](phase5-evolution-p2-phase3.md).

---

## DEC-110 — Outbox publish transient auto-retry (evolution Phase 4.1)

**Date:** 2026-06-05  
**Closes:** SH-GAP-07, phase4 F-03 (partial).

| Item       | Choice                                                                |
| ---------- | --------------------------------------------------------------------- |
| Classifier | `classifyOutboxPublishError` → transient \| poison                    |
| Config     | `OUTBOX_PUBLISH_MAX_ATTEMPTS` (default 5)                             |
| Retry      | `markOutboxPendingForRetry` — `pending` + `last_error.attempts`       |
| Terminal   | Poison or exhausted attempts → `markOutboxFailed` (DEC-086 unchanged) |

**Verification:** [`outbox-publish-auto-retry.md`](outbox-publish-auto-retry.md).

---

## DEC-111 — Relay / poll exponential backoff + jitter (evolution Phase 4.2)

**Date:** 2026-06-05  
**Closes:** SH-GAP-06, SH-GAP-09, SH-GAP-10, SH-GAP-11, SH-GAP-12.

| Item           | Choice                                                           |
| -------------- | ---------------------------------------------------------------- |
| Helper         | `computeRelayBackoff` — capped exponential + 25% jitter          |
| Relay          | `setTimeout` chain; streak backoff on tick error or `failed > 0` |
| Shutdown drain | Backoff between iterations                                       |
| Idempotency    | Backoff in `waitForPrismaCompletion` / `waitForMemoryCompletion` |

**Verification:** [`relay-backoff-jitter.md`](relay-backoff-jitter.md).

---

## DEC-112 — Canonical TX transient whole-TX retry (evolution Phase 4.3)

**Date:** 2026-06-05  
**Closes:** SH-GAP-01, SH-GAP-02, SH-GAP-03 (partial).

| Item     | Choice                                                      |
| -------- | ----------------------------------------------------------- |
| Wrapper  | `withTransientTxRetry`                                      |
| Wired in | `withCanonicalTransaction`                                  |
| Config   | `CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS` (default 2 retries) |
| Circuit  | Count transient failure only when retry budget exhausted    |

**Verification:** [`canonical-tx-transient-retry.md`](canonical-tx-transient-retry.md).

---

## DEC-113 — Pool saturation 503 + Retry-After (evolution Phase 4.4)

**Date:** 2026-06-05  
**Closes:** SH-GAP-05, SCAL-LIM-10 (partial).

| Item   | Choice                                                           |
| ------ | ---------------------------------------------------------------- |
| Error  | `DbPoolSaturatedError`                                           |
| Config | `DB_POOL_SATURATED_RETRY_AFTER_SEC` (default 2)                  |
| HTTP   | Explicit `Retry-After` on pool saturation + tenant DB budget 503 |

**Verification:** [`pool-saturation-retry-after.md`](pool-saturation-retry-after.md).

---

## DEC-114 — Tenant priority load shed (evolution Phase 4.5)

**Date:** 2026-06-05  
**Closes:** SCAL-LIM-05, SCAL-LIM-12 (partial).

| Item      | Choice                                                      |
| --------- | ----------------------------------------------------------- |
| Tier      | `theme.priorityTier` → low / normal / high                  |
| Admission | `weighted-fair-admission.ts` at `runWithHttpRequestContext` |
| Shed      | 503 `PRIORITY_LOAD_SHED` + `Retry-After`                    |

**Verification:** [`priority-load-shed.md`](priority-load-shed.md).

---

## DEC-115 — Projection auto-reconcile scheduler (evolution Phase 4.6)

**Date:** 2026-06-05  
**Closes:** phase4 F-04 (partial).

| Item      | Choice                                                   |
| --------- | -------------------------------------------------------- |
| Queue     | `enqueueProjectionAutoReconcile` on inconsistency signal |
| Repair    | Sync `title` / `schemaVersion` from canonical JSON       |
| Scheduler | `startProjectionAutoReconcileIfEnabled`                  |

**Verification:** [`projection-auto-reconcile.md`](projection-auto-reconcile.md).

---

## DEC-116 — HTTP idempotency poll backoff (evolution Phase 4.7)

**Date:** 2026-06-05  
**Closes:** SH-GAP-11, SH-GAP-12.

| Item           | Choice                                                           |
| -------------- | ---------------------------------------------------------------- |
| Implementation | `sleepIdempotencyPollBackoff` in `http-idempotency.ts` (DEC-111) |
| Guard          | `guard:relay-backoff` asserts no fixed `POLL_INTERVAL_MS`        |

**Verification:** [`relay-backoff-jitter.md`](relay-backoff-jitter.md).

---

## DEC-117 — Evolution Phase 4 gate rollup (evolution Phase 4.8)

**Date:** 2026-06-05  
**Closes:** evolution CI pack extension.

| Item    | Choice                                                 |
| ------- | ------------------------------------------------------ |
| Script  | `phase-5-evolution-phase4-gate.mjs`                    |
| Command | `pnpm run phase-5:evolution-phase4-gate`               |
| Parent  | `phase-5:evolution-gate` composes phase-4 + phases 1–3 |

**Verification:** [`phase5-evolution-phase4-gate.md`](phase5-evolution-phase4-gate.md).

---

## DEC-118 — Argo Rollouts blue-green + split outbox relay (evolution Phase 5.1)

**Date:** 2026-06-05  
**Closes:** RB-GAP-05, RB-GAP-08, RB-GAP-14.

| Item      | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Manifests | `deploy/argo-rollouts/api-rollout.yaml`, `outbox-relay-deployment.yaml`  |
| Strategy  | Blue/green `scaleDownDelaySeconds: 30`; API `OUTBOX_RELAY_ENABLED=false` |
| Boot      | `WORKER_ROLE=outbox-relay` → `bootstrapOutboxRelayWorker()`              |
| Guard     | `guard:deploy-argo-rollouts`                                             |

**Verification:** [`argo-rollouts-progressive-delivery.md`](argo-rollouts-progressive-delivery.md).

---

## DEC-119 — CI integrity phase-4 guard + evolution (evolution Phase 5.6)

**Date:** 2026-06-05  
**Closes:** CI-BYP-11 (partial), CI-BYP-13 naming drift.

| Item      | Choice                                                                           |
| --------- | -------------------------------------------------------------------------------- |
| Script    | `scripts/ci-integrity-check.sh` tail: `phase-4:guard` + `phase-5:evolution-gate` |
| Full perf | `phase-5:gate` stays in `test:full` / GHA — not `ci:integrity`                   |
| Guard     | `guard:ci-integrity-extension`                                                   |

**Verification:** [`ci-integrity-phase-extension.md`](ci-integrity-phase-extension.md).

---

## DEC-120 — Production cache invalidate + feature-flag freeze (evolution Phase 5.2)

**Date:** 2026-06-05  
**Closes:** RB-GAP-11, RB-GAP-12, RB-GAP-13 (prod path).  
**Extends:** DEC-106.

| Item   | Choice                                                                     |
| ------ | -------------------------------------------------------------------------- |
| Auth   | RS256 service JWT with `ops_scope: cache:invalidate` (DEC-107 dual-key)    |
| Freeze | `feature-flag-freeze.ts` — cache-only reads in `resolveTenantFeatureFlags` |
| Route  | `POST /internal/cache/invalidate` — dev/test unchanged; prod JWT-gated     |
| Guard  | `guard:internal-cache-invalidate` (extended)                               |

**Verification:** [`prod-cache-invalidate-service-jwt.md`](prod-cache-invalidate-service-jwt.md).

---

## DEC-121 — ServiceMonitor + Prometheus Adapter + HPA gauges (evolution Phase 5.3)

**Date:** 2026-06-05  
**Closes:** SCAL-LIM-01, SCAL-LIM-02, SCAL-LIM-15 (partial).  
**Extends:** DEC-108.

| Item        | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Manifests   | `deploy/prometheus/api-servicemonitor.yaml`, `adapter-rules.yaml` |
| Gauges      | `http_requests_in_flight`, `outbox_pending_total`                 |
| Prod scrape | `ops_scope: metrics:read` via `verify-ops-service-jwt.ts`         |
| Guard       | `guard:deploy-prometheus-adapter`                                 |

**Verification:** [`prometheus-servicemonitor-adapter.md`](prometheus-servicemonitor-adapter.md).

---

## DEC-122 — API HPA custom metrics (evolution Phase 5.4)

**Date:** 2026-06-05  
**Closes:** SCAL-LIM-01.

| Item      | Choice                                                     |
| --------- | ---------------------------------------------------------- |
| Manifests | `deploy/hpa/api-hpa.yaml`, `outbox-relay-hpa.yaml`         |
| Target    | Argo `Rollout` `api`; optional `Deployment` `outbox-relay` |
| Metrics   | `http_requests_in_flight`, `outbox_pending_total`, CPU 70% |
| Guard     | `guard:deploy-hpa`                                         |

**Verification:** [`api-hpa-custom-metrics.md`](api-hpa-custom-metrics.md).

---

## DEC-123 — Phase 5 SLO alerting (evolution Phase 5.5)

**Date:** 2026-06-05  
**Closes:** Observability prod alert gap (evolution audit).

| Item   | Choice                                                                     |
| ------ | -------------------------------------------------------------------------- |
| Rules  | `deploy/alerts/phase5-slo.yaml` — `PrometheusRule`                         |
| Alerts | `outbox_failed_total`, `projection_inconsistency_total`, `db_circuit_open` |
| Gauge  | `outbox_failed_total` — admin DB count of `status=failed`                  |
| Guard  | `guard:deploy-phase5-slo-alerts`                                           |

**Verification:** [`phase5-slo-alerting.md`](phase5-slo-alerting.md).

---

## DEC-124 — Migrate deploy only — CI/prod parity (evolution Phase 5.7)

**Date:** 2026-06-05  
**Closes:** MD-GAP-05, MD-GAP-06, MD-GAP-04 (partial).

| Item                | Choice                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| Command             | `pnpm run db:migrate:deploy` (`apps/api`)                                |
| CI                  | GHA phase-4/5 gates — `migrate deploy` only; no `infra/sql/001`          |
| `infra/sql/001…004` | Reference-only per [`infra/sql/README.md`](../../../infra/sql/README.md) |
| Guard               | `guard:migrate-deploy-only`                                              |

**Verification:** [`migrate-deploy-only.md`](migrate-deploy-only.md).

---

## DEC-125 — RPO/RTO + monthly restore drill (evolution Phase 5.8)

**Date:** 2026-06-05  
**Closes:** CAE-GAP-14.

| Item    | Choice                                                          |
| ------- | --------------------------------------------------------------- |
| Targets | RPO ≤ 15m (PITR), RTO ≤ 60m                                     |
| Script  | `scripts/restore-drill-smoke.sh`                                |
| CI      | `.github/workflows/restore-drill-monthly.yml` (cron + dispatch) |
| Guard   | `guard:rpo-rto-restore-drill`                                   |

**Verification:** [`rpo-rto-production.md`](rpo-rto-production.md).

---

## DEC-126 — Phase 2 residual P1 closure (TRACE-REGEN-02, ERR-BYPASS-01, ALS-FOOTGUN-01)

**Date:** 2026-06-05  
**Scope:** Remaining Phase 2 paranoid audit **P1 (سایر)** — correlation fail-closed, internal route error parity, route-handler async hygiene guard.

| ID                 | Change                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **TRACE-REGEN-02** | `resolveCorrelationId()` uses `requireActiveTraceId()` — no `randomUUID()` fallback that splits error envelope from ingress trace ALS  |
| **ERR-BYPASS-01**  | `POST /internal/tenants/provision` and `GET /internal/test/db-pool-hold` route errors through `handleHttpError` (correlation echo)     |
| **ALS-FOOTGUN-01** | `guard:route-handler-async-hygiene` forbids `setImmediate` / `process.nextTick` / `void promise(` in `*.routes.ts` and `src/routes/**` |

**Provisioning errors in mapper:** `ProvisioningDevOnlyError` → 403; `TenantProvisionConflictError` → 409 with stable `code`.

**Verification:** `guard:route-handler-async-hygiene` · `guard:internal-route-http-error` · `test/2-observability/internal-route-correlation.spec.ts` · `error-interceptor.spec.ts` · phase-2 regression gate.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 residual P1.

---

## DEC-127 — Phase 2 residual P2 closure (batch 1)

**Date:** 2026-06-05  
**Scope:** Phase 2 paranoid audit **P2** — test harness logging, metrics coverage, HTTP error parity, provision audit, audit index.

| ID                | Change                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **LOG-V-04/05**   | Graceful-shutdown harness stderr — JSON `{ event, code }` only (no raw `Error.message`)                |
| **MET-COV-01**    | `metrics.spec.ts` asserts `projection_inconsistency_total` rejects unlabeled increment                 |
| **ERR-GAP-01**    | `guard:http-send-json-5xx` — forbid `sendJson(res, 5xx, { error: error.message })` outside interceptor |
| **ERR-BYPASS-02** | Unknown routes return JSON `{ error, code, correlationId }` via `sendHttpError`                        |
| **ERR-429-01**    | `sendTenantRateLimitExceeded` uses trace ALS (`requireActiveTraceId`) instead of `randomUUID`          |
| **outbox-replay** | Internal replay route uses `handleHttpError` (ERR-BYPASS parity)                                       |
| **AUDIT-GAP-03**  | `TENANT_PROVISIONED` audit row in same admin TX as `tenant.create`                                     |
| **AUDIT-GAP-06**  | Index `(tenant_id, actor_id, created_at)` on `audit_events`                                            |

**Verification:** `guard:http-send-json-5xx` · `guard:tenant-provision-audit` · `guard:internal-route-http-error` · phase-2 regression gate.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 residual P2.

---

## DEC-128 — Phase 2 residual P2 closure (batch 2)

**Date:** 2026-06-05  
**Scope:** Remaining Phase 2 **P2** advisories — log hygiene CI locks, 500 burst budget, audit coverage documentation.

| ID                  | Change                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| **H-01**            | `guard:http-access-path-normalize` locks `normalizeHttpLogPath` on access logs   |
| **H-02**            | `guard:log-structured-hygiene` forbids raw `message:` in pino structured objects |
| **H-03**            | `sanitizeReliabilitySamplePayload` before emitting `P5_RELIABILITY_SAMPLES`      |
| **LOG-BP-04**       | Per-second burst budget for `http.error.internal` logs + suppression metric      |
| **AUDIT-GAP-05/07** | [`audit-coverage.md`](audit-coverage.md) — actor null policy + bypass matrix     |
| **CTX-MW-LOW-01**   | Closed via DEC-044 (trace ALS reuse, not middleware fork)                        |

**Verification:** `guard:http-access-path-normalize` · `guard:log-structured-hygiene` · `guard:internal-error-log-budget` · `internal-error-log-budget.spec.ts`.

**Sign-off artifact:** [`apps/api/docs/phase2-paranoid-audit.md`](../../../apps/api/docs/phase2-paranoid-audit.md) § Phase 2 residual P2 batch 2.

---

## DEC-129 — HTTP response size budget + tenant-config cache (Event-loop P2 #5)

**Date:** 2026-06-05  
**Closes:** Event-loop egress stringify row (partial), `tenant-config.routes.ts` repeat stringify under load.

| Item                  | Choice                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| Default max           | **2 MiB** (`HTTP_MAX_RESPONSE_BYTES=2097152`)                                 |
| Reject point          | `sendJson` — after `JSON.stringify`, before `res.end`                         |
| Pre-serialized string | `Buffer.byteLength` check only — no re-stringify                              |
| Status                | **507** `response_too_large` / `RESPONSE_TOO_LARGE` (ingress remains **413**) |
| Tenant-config cache   | **5s** TTL serialized JSON per tenant; evicted on registry invalidation       |
| Logging               | **None** on 507 (client error)                                                |

**Rationale:** Phase 3 event-loop P2 — caps adversarial multi-MiB egress and avoids repeat `JSON.stringify` on hot `GET /api/v2/tenant-config` when registry row is already cached.

**Verification:** [`http-response-size-budget.md`](http-response-size-budget.md) · `guard:http-response-size-budget` · `src/http/json.spec.ts` · `src/tenant/tenant-config-response-cache.spec.ts`.

---

## Cross-phase references

| Phase  | Artifact                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| 3      | `CanonicalTourService`, CASL                                                             |
| 4      | `publishTourCreatedEvent`, RLS `001`                                                     |
| 4.5    | `platform-events` bus                                                                    |
| 5      | This doc + `phase-5-canonical-schema.md`                                                 |
| 6      | Denali plugin, finance outbox consumers                                                  |
| legacy | `OutboxRelayWorker`, `OutboxService.enqueue` — **reference only**, no Nest port in trunk |

---

## File checklist (expected new/changed)

| Path                                                | Subphase              |
| --------------------------------------------------- | --------------------- |
| `canonical/projection-sync.ts`                      | 5.3                   |
| `storage/prisma-tour.repository.ts`                 | 5.3 data mapping      |
| `canonical/canonical-tour.service.ts`               | 5.4 orchestration     |
| `outbox/enqueue-domain-event.ts`                    | 5.4                   |
| `outbox/outbox-relay.ts`                            | 5.4                   |
| `outbox/start-outbox-relay.ts`                      | 5.4                   |
| `audit/audit-logger.ts`                             | 5.5                   |
| `test/canonical-projection-sync.spec.ts`            | 5.3                   |
| `test/outbox-transactional.spec.ts`                 | 5.4                   |
| `test/5.5-audit-events.spec.ts`                     | 5.5                   |
| `middleware/tenant-rate-limiter.ts`                 | 5.6 interim / DEC-015 |
| `appendices/rate-limiting.md`                       | 5.6 interim / DEC-015 |
| `http/bind-request-context.ts`                      | 5.6 interim / DEC-015 |
| `test/3-performance/tenant-rate-limiter.spec.ts`    | 5.6 interim / DEC-015 |
| `test/3-performance/tenant-rate-limiting.spec.ts`   | 5.6 interim / DEC-015 |
| `canonical/validation-scheduler.ts`                 | P0-7 / DEC-016        |
| `appendices/validation-fairness.md`                 | P0-7 / DEC-016        |
| `test/3-performance/noisy-neighbor-latency.spec.ts` | P0-7 probe            |
| `outbox/outbox-relay.ts` (parallel publish)         | P0-6 / DEC-017        |
| `test/3-performance/outbox-throughput.spec.ts`      | P0-6 probe            |

Update [`IMPLEMENTATION-MAP.md`](IMPLEMENTATION-MAP.md) and [`IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md) when each lands.
