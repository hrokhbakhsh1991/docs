# Tiered testing strategy

> **Goal:** Keep Husky pre-commit under ~60s while preserving a full verification path for PR closure and Phase 4 RLS.

## Tiers

| Tier                             | Command                              | When                                        | What runs                                                                                                                                              |
| -------------------------------- | ------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fast (default)**               | Husky → `scripts/pre-commit-fast.sh` | Every `git commit`                          | `guard-docs`, Node engine, eslint on changed TS (root + `apps/web`), optional prettier (if installed + config), `test-changed` for affected workspaces |
| **Changed tests**                | `pnpm run test:changed`              | Manual / CI selective                       | `scripts/test-changed.sh --mode ci` — diff `origin/main...HEAD`, dependency expansion, `.cache/test-changed/`                                          |
| **Pre-commit dry-run**           | `pnpm run pre-commit:fast`           | Before commit                               | Same as Husky fast path                                                                                                                                |
| **Full**                         | `pnpm run test:full`                 | Before PR / Phase 4 closure                 | `phase-3:gate` + `phase-4:gate` (includes build, full `pnpm test`, guards, doc-gate, `p4_rls_integration_tests` when env set)                          |
| **CI integrity**                 | `pnpm run ci:integrity`              | GitHub / explicit local                     | Phases **0 → 3** via `scripts/ci-integrity-check.sh` — **not** Husky default                                                                           |
| **Phase 8 guard (fast)**         | `pnpm run phase-8:guard`             | PR / local                                  | 25 doc + boundary charter gates — under 10s                                                                                                              |
| **Phase 8 urban regression**     | GHA job `urban-regression`           | GitHub PR (`phase-8-gate.yml`)              | Contract + urban proof bundle (memory driver)                                                                                                          |
| **Phase 8 urban E2E**            | `pnpm --filter @apps/web run test:e2e:urban` | GHA job `urban-e2e`                 | Playwright SMK-P8-01..04                                                                                                                               |
| **Phase 8 full closure**         | `pnpm run phase-8:gate`              | GHA `phase-8-gate-full` on **main** or `workflow_dispatch` | build + full `pnpm test` + nested `phase-7:gate` + `phase-8:guard` (~90–150 min)                                                          |
| **Nightly (API probes)**         | `pnpm run test:nightly`              | Scheduled / pre-release                     | `APPS_API_TEST_TIER=nightly` — backlog 1000-row, noise-neighbor HTTP, 10k relay leak; includes `test:nightly:soak` when `RUN_SOAK=1`                   |
| **Nightly (cold-start enforce)** | `pnpm run test:nightly:cold-start`   | Scheduled (`api-nightly.yml`) / pre-release | `build` + `cold-start-readiness-gate` with `COLD_START_READINESS_ENFORCE=true` — hard-fail when compiled p95 > 500 ms                                  |

Hooks cannot be bypassed (`HUSKY=0` / `SKIP_HOOKS` rejected). Fast path is the new default; full path is **on demand**.

## Phase 8 hook suspension (temporary)

While [`docs/phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml`](../phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml) has `active: true`, Husky **pre-commit exits immediately** (no `guard-docs`, eslint, prettier, or `test-changed`). This is the **only** supported suspend path during Phase 8 implementation (8.1→8.4).

| Action | Command / file |
| ------ | -------------- |
| **Suspended** (current) | Marker present + `active: true` |
| **Manual verify** (recommended per subphase PR) | `pnpm run phase-8:guard` + targeted urban specs |
| **Re-enable** (mandatory at **8.5**) | Delete marker file; run `pnpm run pre-commit:fast`, `pnpm run test:full`, `pnpm run phase-8:gate`, `pnpm run ci:integrity` |

Detector: `bash scripts/phase-8-hooks-suspended.sh` (exit 0 = suspended).

## Phase 8 GitHub Actions (`.github/workflows/phase-8-gate.yml`)

Heavy verification runs on **ubuntu-latest** with service containers — not on the developer laptop.

| Job | When | Services | Command |
| --- | ---- | -------- | ------- |
| `guard` | Every PR / push (path filter) | — | `phase-8:guard` + `guard:p8-boundary-diff` |
| `urban-regression` | After guard green | — | `phase-8.contract` + urban API proof specs + `workspace-urban` test |
| `urban-e2e` | After guard green | — | Playwright `test:e2e:urban` |
| `ci-integrity` | **main** push or `workflow_dispatch` | Postgres 16 | `pnpm run ci:integrity` |
| `phase-8-gate-full` | **main** push or manual `run_full_phase_8_gate` | Postgres + Redis | `pnpm run phase-8:gate` |

**PR fast path (typical):** guard → urban-regression → urban-e2e (~15–45 min on GHA).

**Closure path (8.5):** merge to `main` triggers `ci-integrity` + `phase-8-gate-full`, or run **Actions → phase-8-gate → Run workflow** with `run_full_phase_8_gate: true`.

Postgres bootstrap in CI always uses `DATABASE_URL_ADMIN` (postgres role) for `pnpm run db:migrate:deploy` — never migrate with `app_tour` alone (DEC-124).

## `test-changed` behavior

```bash
pnpm run test:changed                              # CI mode: origin/main...HEAD
bash scripts/test-changed.sh --mode pre-commit     # + staged + unstaged (Husky)
```

1. **Base ref:** `origin/main` → else `main` → else `HEAD~1`.
2. **Path → workspace:** longest-prefix map (`packages/platform-core` → `@app-tour/platform-core`, etc.).
3. **Expansion:** static dependents (e.g. `@app-tour/workspace-sdk` → `platform-core`, `apps/api`, …).
4. **Cache:** `.cache/test-changed/<filter-slug>.sha` stores SHA-256 of `base + changed paths in package`. Cache hit skips `pnpm --filter <name> test`.
5. **Exit:** non-zero on any test failure.

## Database fast reset (RLS loops)

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
psql "$DATABASE_URL_ADMIN" -f infra/sql/001_tenant_rls.sql
psql "$DATABASE_URL_ADMIN" -f infra/sql/002_phase5_data_layer.sql  # if Phase 5 tables needed
bash scripts/db-test-reset.sh
```

`infra/sql/test-reset.sql` truncates `outbox_events`, `audit_events`, `tours`, `tenants` (FK-safe, `CASCADE`) without dropping RLS policies.

## Full path environment (Phase 4)

`pnpm run test:full` runs `phase-4:gate`, which requires Postgres for `p4_rls_integration_tests`:

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db}"
export STORAGE_DRIVER=prisma
pnpm run test:full
```

See [`docs/phase-4/ci.md`](../phase-4/ci.md) for compose URLs and migration steps.

## Phase 5 API test tiers (P2-1)

| Command                                  | `APPS_API_TEST_TIER` | Probes                                                                                                                                                                                      |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @apps/api test` (default) | `trunk`              | Unit + integration; **skips** nightly-only specs; **`STORAGE_DRIVER` defaults to `memory`** (integration specs that need Postgres atomic persist set `STORAGE_DRIVER=prisma` in `before()`) |

### Outbox relay test isolation (F-03)

Trunk `pnpm test` disables in-process background workers that would race manual relay ticks in integration specs:

| Env var                             | Default in `apps/api` test script | Purpose                                                                                                                                                |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OUTBOX_RELAY_ENABLED`              | `false`                           | Prevents `startOutboxRelayIfEnabled` timer from claiming rows while tests call `processOutboxRelayOnce` / `processOutboxRelayForTenantOnce` explicitly |
| `PROJECTION_AUTO_RECONCILE_ENABLED` | `false`                           | Prevents projection auto-reconcile from mutating outbox / read-model state mid-test                                                                    |

Both vars are set again in [`apps/api/test/bootstrap-outbox-test-env.ts`](../../apps/api/test/bootstrap-outbox-test-env.ts), loaded via `node --import ./test/bootstrap-outbox-test-env.ts` on every test run. When `DATABASE_URL` is set, that bootstrap:

1. Sets `TENANT_MAX_CONCURRENT_DB_OPS=64` when unset (concurrent mixed-tenant specs under full gate).
2. Registers `beforeEach` hooks that reset tenant DB budget, DB circuit breaker, weighted-fair admission, Redis rate-limiter circuit, tour-write concurrency counters, and outbox relay tenant publish slots between specs.
3. Registers a root `before()` hook that calls `reclaimStaleProcessingOutboxRows(0)` so stale `processing` rows from prior specs or crashed workers do not block ordered-per-tenant claims.

HTTP specs that use `createTestToursService()` with in-memory storage should call `installMemoryStorageDriverForDescribe()` from `test-helpers.ts` so `STORAGE_DRIVER=prisma` from the outer gate does not force atomic Postgres persist on random tenant UUIDs.

Burst HTTP specs that assert **rate-limit** (`429` + `RATE_LIMIT_EXCEEDED`) or **validation** outcomes must raise `TENANT_MAX_CONCURRENT_TOUR_WRITES` in the suite `before()` hook above the burst size — default **8** sheds in-flight POST /tours as `TOUR_CAPACITY_EXCEEDED` (also mapped to 429), which would false-fail rate-limiter and feature-flag degradation probes.

100-request HTTP smoke specs (`full-service-stack`, `log-persistence-smoke`) set `TENANT_RATE_LIMIT_ENABLED=false` in `before()` — default **10 req/s** would fail request ~11+ even when sequential. Bootstrap `beforeEach` also calls `resetTenantRateLimiterStoreForTests()` so perf specs that enable the limiter do not leak bucket state.

Per-spec helpers in [`apps/api/test/test-helpers.ts`](../../apps/api/test/test-helpers.ts):

- `stabilizeOutboxRelayTestEnv()` — force the two env vars off (returns `restore`)
- `quiesceStaleOutboxProcessing(reclaimMs?)` — reclaim stale `processing` → `pending` / `done`
- `preparePostgresOutboxIsolation()` — stabilize env + quiesce (call from Postgres outbox integration `before()` / `beforeEach`)

Integration specs that drive relay manually should prefer **tenant-scoped** `processOutboxRelayForTenantOnce(tenantId, batch)` over global `processOutboxRelayOnce` to avoid cross-tenant pollution on shared Postgres.

| `pnpm --filter @apps/api run test:nightly` | `nightly` | Full suite including `event-backlog-recovery`, `noise-neighbor`, `outbox-relay-connection-leak`, `outbox-throughput` |
| `pnpm run test:nightly` (root) | `nightly` + soak | Above + `soak-memory-leak` when `RUN_SOAK=1` |
| `pnpm --filter @apps/api run test:nightly:cold-start` | enforce gate | Compiled `dist/main.js` spawn-to-`/health` with `COLD_START_READINESS_ENFORCE=true` (not trunk) |

`pnpm run phase-5:gate` uses trunk-tier `pnpm test` — heavy probes do not block PR closure. Cold-start **enforce** runs only in `api-nightly` workflow, not `phase-3-gate` / Husky.

Nightly-only specs: [`apps/api/test/test-tier.ts`](../../apps/api/test/test-tier.ts) — includes `chaos/atomic-rollback-stress` (subprocess SIGKILL; trunk skips to avoid orphaned `atomic-crash-worker` blocking `phase-1:gate`) and `3-performance/outbox-throughput` (5000-row drain SLO; trunk skips so shared Postgres under full `phase-1:gate` is not throughput-gated). Phase 4 resilience gate runs chaos with `APPS_API_TEST_TIER=nightly`.

## Tenant ALS isolation (0-security, no Postgres)

[`runWithTenantContext`](../../apps/api/src/tenant/tenant-request-context.ts) uses Node `AsyncLocalStorage.run` — tenant scope must survive `Promise.all`, nested binds, `setImmediate` / `nextTick`, and rejections without cross-tenant bleed.

| Spec                                                                                                                  | DB      | Focus                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| [`tenant-request-context-isolation.spec.ts`](../../apps/api/test/0-security/tenant-request-context-isolation.spec.ts) | No      | Pure ALS unit — parallel tenants, nesting, scheduling hops, missing-context errors                  |
| [`als-high-load-synthetic.spec.ts`](../../apps/api/test/0-security/als-high-load-synthetic.spec.ts)                   | No      | High-load synthetic — 200 concurrent trace+tenant ALS, `queueMicrotask`, nested bind, jitter timers |
| [`context-resilience.spec.ts`](../../apps/api/test/0-security/context-resilience.spec.ts)                             | Partial | ALS teardown after throw/reject; PG RLS when `DATABASE_URL` set                                     |
| [`async-context-leak.spec.ts`](../../apps/api/test/0-security/async-context-leak.spec.ts)                             | Yes     | 50 concurrent mixed-tenant ALS + `withTenantRls` probes                                             |

Run the unit suite alone:

```bash
cd apps/api && NODE_ENV=test node --import tsx --test test/0-security/tenant-request-context-isolation.spec.ts
```

High-load synthetic (trace + tenant ALS, no Postgres):

```bash
cd apps/api && NODE_ENV=test node --import tsx --test test/0-security/als-high-load-synthetic.spec.ts
```

## GitHub Actions

- Phase 3: `.github/workflows/phase-3-gate.yml` runs `pnpm run phase-3:gate` on PR/push.
- API nightly: `.github/workflows/api-nightly.yml` — scheduled `test:nightly:cold-start` (enforce) + `test:nightly:slow-sink`; not on trunk PR path.
- Phase 4 RLS: run `pnpm run test:full` (or `phase-4:gate` with env) in a job with Postgres — not part of fast pre-commit.
