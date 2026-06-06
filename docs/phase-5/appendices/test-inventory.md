# Phase 5 — Test inventory

```yaml
inventory_date: "2026-06-05"
rule: "SCAFFOLD tests do not satisfy 5.3–5.5 behavioral DoD"
note_5_2: "5.2 behavioral specs IMPLEMENTED — see IMPLEMENTATION-MAP.md §5.2"
ci_tiers:
  trunk: "APPS_API_TEST_TIER=trunk — default pnpm test / phase-5:gate"
  nightly: "pnpm run test:nightly — backlog 1000, noise-neighbor HTTP, relay leak, soak"
```

## CI test tiers (P2-1)

| Tier    | Command                        | Skipped in trunk                                                                  |
| ------- | ------------------------------ | --------------------------------------------------------------------------------- |
| Trunk   | `pnpm --filter @apps/api test` | `event-backlog-recovery`, `noise-neighbor` (HTTP), `outbox-relay-connection-leak` |
| Nightly | `pnpm run test:nightly`        | —                                                                                 |

See [`docs/dev/tiered-testing.md`](../../dev/tiered-testing.md), [`apps/api/test/test-tier.ts`](../../../apps/api/test/test-tier.ts).

## Scaffold (5.1 / guard only)

| File                                                | Type            | Proves                                                                     | Does NOT prove                                     |
| --------------------------------------------------- | --------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/api/test/outbox-rls-forbidden-access.spec.ts` | **INTEGRATION** | `outbox_events` ENABLE+FORCE RLS; `app_tour` without `set_config` → 0 rows | atomic outbox write, relay                         |
| `apps/api/test/phase-5.contract.spec.ts`            | **SCAFFOLD**    | DEL-P5-001 artifacts exist                                                 | outbox relay, validate-before-persist, audit write |
| `scripts/guards/phase-5-guard.mjs`                  | guard           | files + contract run                                                       | behavioral Phase 5                                 |

```yaml
scaffold_contract_assertions:
  - schema doc sections
  - SQL file exists
  - Prisma models exist
  - withCanonicalTransaction export
behavioral_required_by:
  "5.2": "new spec — invalid canonical rejected"
  "5.3": "projection drift spec"
  "5.4": "outbox same-TX + handler idempotency"
  "5.5": "5.5-audit-events.spec.ts — TOUR_CREATED append + cross-tenant RLS + immutability"
```

## Phase 4 carryover (prerequisite)

| File                                                  | Phase | Role for 5                                                    |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `test/rls-isolation.integration.spec.ts`              | 4     | RLS on tours                                                  |
| `test/outbox-rls-forbidden-access.spec.ts`            | 5.1   | RLS on `outbox_events` — `app_tour` forbidden without session |
| `test/tenant-security.spec.ts`                        | 4     | tenant context                                                |
| `src/canonical/canonical-tour.service.events.spec.ts` | 4.5   | in-process — **replace path** in 5.4                          |

## Pending behavioral gate (blocks 5.6)

| Subphase | Spec path                                   | Scenario                                                                                  | Blocks closure       |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------- |
| 5.2      | `5.2-plugin-validation.spec.ts`             | ValidationFailure; 0 tours + 0 outbox on Postgres                                         | **no** — IMPLEMENTED |
| 5.2      | `canonical-validate-before-persist.spec.ts` | invalid → 400, no row                                                                     | **no** — IMPLEMENTED |
| 5.2      | `validate-before-persist-ordering.spec.ts`  | create skipped on fail                                                                    | **no** — IMPLEMENTED |
| 5.3      | `canonical-projection-sync.spec.ts`         | title/schema_version on tours row in atomic TX                                            | **no** — IMPLEMENTED |
| 5.4-S1   | `outbox-transactional.integration.spec.ts`  | tour + projection + outbox commit/rollback                                                | **no** — IMPLEMENTED |
| 5.4-S2   | `5.4-S2-concurrent-tx-stress.spec.ts`       | 12×5 concurrent atomic persists; RLS; no partial pairs                                    | **no** — IMPLEMENTED |
| 5.4-S3   | `outbox-relay.integration.spec.ts`          | manual outbox insert → relay → bus `tenantId`; SKIP LOCKED parallel claim; RLS visibility | **no** — IMPLEMENTED |
| 5.4-S4   | `5.4-S4-idempotency.spec.ts`                | duplicate outbox P2002; double relay → one side-effect                                    | **no** — IMPLEMENTED |
| 5.4-S5   | `chaos/atomic-rollback-stress.spec.ts`      | subprocess crash loop; zero orphan tour/outbox/audit                                      | **no** — IMPLEMENTED |
| 5.5      | `5.5-audit-events.spec.ts`                  | TOUR_CREATED append + cross-tenant RLS + immutability                                     | **no** — IMPLEMENTED |

Subphase docs: [`5.3-projections.md`](../subphases/5.3-projections.md) · [`5.4-transactional-outbox.md`](../subphases/5.4-transactional-outbox.md) · [`5.5-audit-events.md`](../subphases/5.5-audit-events.md)

## Performance (3-performance)

| File                                                                    | Type                      | Proves                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/test/3-performance/db-pool-saturation.spec.ts`                | **INTEGRATION**           | 100 concurrent TX holds exceed `connection_limit=10` → HTTP **503** `service_unavailable`; event loop heartbeat; no hang (DEC-012)                                                                   |
| `apps/api/test/3-performance/outbox-throughput.spec.ts`                 | **INTEGRATION**           | DEC-017 parallel publish; drain ≥ `MIN_THROUGHPUT` (default **100**, strict **500** with `OUTBOX_THROUGHPUT_STRICT=1`); main-path p95 ≤ 4× baseline. Requires `DATABASE_URL` + `DATABASE_URL_ADMIN`. |
| `apps/api/test/3-performance/noisy-neighbor-latency.spec.ts`            | **INTEGRATION (nightly)** | DEC-016 validation fairness; victim write ≤ baseline × 1.10 under A validation storm — `pnpm run test:nightly`                                                                                       |
| `apps/api/test/3-performance/tenant-rate-limiter.spec.ts`               | **FUNCTIONAL**            | DEC-015: tenant A throttled, B unaffected; `RATE_LIMIT_EXCEEDED` + `retryAfter` / `Retry-After`                                                                                                      |
| `apps/api/test/3-performance/tenant-rate-limiting.spec.ts`              | **FUNCTIONAL**            | Noisy-neighbor HTTP fairness under limit; B latency SLO vs A flood                                                                                                                                   |
| `apps/api/test/1-reliability/idempotency-bypass.spec.ts`                | **INTEGRATION**           | HTTP `Idempotency-Key` parallel burst → 1 tour (DEC-006); service layer still no dedup                                                                                                               |
| `apps/api/test/0-functional/tenant-error-recovery.spec.ts`              | **FUNCTIONAL**            | `AUTH_SCOPE_ID_INVALID` / `WORKSPACE_INVALID` → 401; ALS isolation                                                                                                                                   |
| `apps/api/test/4-integration/dynamic-config-sync.spec.ts`               | **INTEGRATION**           | Postgres `tenants.theme` visible on GET tenant-config without restart                                                                                                                                |
| `apps/api/test/4-integration/graceful-shutdown.spec.ts`                 | **INTEGRATION**           | SIGTERM drain + outbox flush; `main.ts` uses `installGracefulShutdownHandlers`                                                                                                                       |
| `apps/api/test/4-integration/saga-rollback.spec.ts`                     | **INTEGRATION**           | Partial success: outbox `done` + projection failure → `projection.inconsistency` (DEC-008 / P1-3)                                                                                                    |
| `apps/api/test/4-integration/schema-version-compat.spec.ts`             | **INTEGRATION**           | `SCHEMA_VERSION_MISMATCH` when `schemaVersion` ≠ workspace current (P1-7)                                                                                                                            |
| `apps/api/test/1-functional/concurrent-tour-logic.spec.ts`              | **FUNCTIONAL**            | `row_version` CAS / optimistic conflicts under parallel updates (P1-6)                                                                                                                               |
| `apps/api/test/3-performance/redis-rate-limiter.spec.ts`                | **INTEGRATION**           | `RedisRateLimiterStore` when `REDIS_URL` set; skip documents BLOCKER otherwise (P1-1)                                                                                                                |
| `packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts` | **PERFORMANCE**           | DEC-018 outer tenant partition LRU (128 default)                                                                                                                                                     |

## Target behavioral tests (to implement)

| Subphase | Suggested path                                            | Scenario                                                  |
| -------- | --------------------------------------------------------- | --------------------------------------------------------- |
| 5.2      | `apps/api/test/canonical-validate-before-persist.spec.ts` | invalid plugin data → 400, no row (**IMPLEMENTED**)       |
| 5.2      | `apps/api/test/validate-before-persist-ordering.spec.ts`  | create not called when validation fails (**IMPLEMENTED**) |
| 5.3      | `apps/api/test/canonical-projection-sync.spec.ts`         | title/schema_version match JSON                           |
| 5.4      | `apps/api/test/outbox-transactional.spec.ts`              | row pending in same TX; handler receives                  |
| 5.5      | `apps/api/test/audit-events-tenant.spec.ts`               | tenant B cannot read A audit                              |

## Anti-hollow

`lib/anti-hollow-phase5.mjs` — schema artifacts only. **GAP-P5-03:** `phase-5.contract.spec` stays scaffold; behavioral DoD = rows in § Pending behavioral gate above (5.2–5.5 IMPLEMENTED).
