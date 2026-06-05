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

**Scope Phase 5:** **create tour only** — not update/delete (Phase 6+).

**Where:** `apps/api/src/audit/audit-logger.ts` (`appendAuditEvent`) inside same `withCanonicalTransaction` as tour + outbox.

**Test:** `apps/api/test/5.5-audit-events.spec.ts` — tenant B cannot read tenant A rows; append-only trigger.

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
| Provisioning static lookup            | `resolveTenantIdentity`                                 | `findTenantBySubdomain` only when gate true                                                  |

CI `guard:static-registry` bans direct `findTenantById` / `findTenantBySubdomain` outside `tenant-registry.ts` unless preceded by `isStaticTenantRegistryAllowed()` on the same or prior line block.

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
