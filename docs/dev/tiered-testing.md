# Tiered testing strategy

> **Goal:** Keep Husky pre-commit under ~60s while preserving a full verification path for PR closure and Phase 4 RLS.

Canonical command ownership (verify/guard aliases, deprecations, removal rules): [`docs/platform/COMMAND_OWNERSHIP_MAP.md`](../platform/COMMAND_OWNERSHIP_MAP.md).

Finance CI workflow ownership (S4 cutover): [`docs/platform/FINANCE_CI_MIGRATION_STATUS.md`](../platform/FINANCE_CI_MIGRATION_STATUS.md).

Preferred local discovery commands: `pnpm verify:fast`, `pnpm verify:product`, `pnpm verify:full`, plus family runners `pnpm guard:marketing|workspace|field-exposure|guest`.

## Tiers

| Tier                             | Command                                      | When                                                       | What runs                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fast (default)**               | Husky → `scripts/pre-commit-fast.sh`         | Every `git commit` (when hooks not suspended)              | Path-gated guards, `lint-staged` (batched eslint + prettier), `test-changed --mode pre-commit` (direct packages, API spec-level) — see [Pre-commit fast path](#pre-commit-fast-path) |
| **Changed tests**                | `pnpm run test:changed`                      | Manual / CI selective                                      | `scripts/test-changed.sh --mode ci` — diff `origin/main...HEAD`, dependency expansion, `.cache/test-changed/`                                                                        |
| **Pre-commit dry-run**           | `pnpm run pre-commit:fast`                   | Before commit                                              | Same as Husky fast path                                                                                                                                                              |
| **Full**                         | `pnpm run test:full`                         | Before PR / Phase 4–5 closure                              | `phase-5:gate` only (nests `phase-4:gate` → `phase-3:gate`; build, full `pnpm test`, `phase-3:guard` + `phase-3:apps-cert`, `p4_rls_integration_tests` when env set)                                      |
| **Phase 5 runtime proof**        | `pnpm run phase-5:runtime-proof`             | Postgres available; additive (does not replace `:gate`)  | `db:test-reset` + `phase-4:guard` + targeted perf (`P5_PERF_GATE_MS=850`, `MIN_THROUGHPUT=100`, `BASELINE_RATIO_MAX=1.25`) — see [`phase-5-runtime-proof.mdoc`](../phase-5/phase-5-runtime-proof.mdoc) |
| **Phase 6 full closure**         | `pnpm run phase-6:gate`                      | Phase 6 DoD / GHA `full-gate`                          | build + test + `phase-5:runtime-proof` + `phase-5:guard` + residual apps-cert (`post-test` + `floors`) + `phase-6:guard` (Option B; **not** nested `phase-5:gate`; **PASS ≠** full `phase-3:apps-cert`) |
| **Phase 3 apps-cert post-test**  | `PHASE_3_APPS_CERT_INHERIT_ROOT=1 pnpm run phase-3:apps-cert:post-test` | After root `build && test` in same recipe; wired into `phase-6:gate` | Residual: web lint + canonical-sync + admin `next build` — **not** full apps-cert / leaf-gate PASS |
| **Phase 3 apps-cert floors**     | `PHASE_3_APPS_CERT_INHERIT_ROOT=1 pnpm run phase-3:apps-cert:floors` | After root `build && test` in same recipe; wired into `phase-6:gate` | Sdk ≥100 + starter ≥15 count floors — **not** api/web floors or leaf-gate PASS |
| **CI integrity**                 | `pnpm run ci:integrity`                      | GitHub / explicit local                                    | Phases **0 → 3** via `scripts/ci-integrity-check.sh` — **not** Husky default                                                                                                         |
| **Phase 8 guard (fast)**         | `pnpm run phase-8:guard`                     | PR / local                                                 | 25 doc + boundary charter gates — under 10s                                                                                                                                          |
| **Phase 8 urban regression**     | GHA job `urban-regression`                   | GitHub PR (`phase-8-gate.yml`)                             | Contract + urban proof bundle (memory driver)                                                                                                                                        |
| **Phase 8 urban E2E**            | `pnpm --filter @apps/web run test:e2e:urban` | GHA job `urban-e2e`                                        | Playwright SMK-P8-01..04                                                                                                                                                             |
| **Phase 8 full closure**         | `pnpm run phase-8:gate`                      | GHA `phase-8-gate-full` on **main** or `workflow_dispatch` | build + full `pnpm test` + `phase-7:guard` + `phase-8:guard` (~90–150 min; denested)                                                                                                     |
| **Nightly (API probes)**         | `pnpm run test:nightly`                      | Scheduled / pre-release                                    | `APPS_API_TEST_TIER=nightly` — backlog 1000-row, noise-neighbor HTTP, 10k relay leak; includes `test:nightly:soak` when `RUN_SOAK=1`                                                 |
| **Nightly (cold-start enforce)** | `pnpm run test:nightly:cold-start`           | Scheduled (`api-nightly.yml`) / pre-release                | `build` + `cold-start-readiness-gate` with `COLD_START_READINESS_ENFORCE=true` — hard-fail when compiled p95 > 500 ms                                                                |

Hooks cannot be bypassed (`HUSKY=0` / `SKIP_HOOKS` rejected). Fast path is the new default; full path is **on demand**.

## Phase hook suspension (temporary)

While a phase marker has `active: true`, Husky **pre-commit exits immediately** (no `guard-docs`, eslint, prettier, or `test-changed`). This is the **only** supported suspend path — not `HUSKY=0` or `--no-verify`.

| Phase           | Marker                                                                                                         | Re-enable at             |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **9** (current) | [`docs/phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml`](../phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml) | **9.8** — `phase-9:gate` |
| 8 (closed)      | `docs/phase-8/appendices/PHASE-8-HOOKS-SUSPENSION.yaml` (deleted at 8.5)                                       | —                        |

| Action                                    | Phase 9 dev loop                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| **Suspended**                             | Marker `active: true` — commit is instant                                         |
| **Manual verify** (subphase closure only) | Targeted specs + `phase-9:guard` when stabilizing                                 |
| **Re-enable** (mandatory at **9.8**)      | Delete marker; `pre-commit:fast` → `phase-9:guard` → `test:full` → `phase-9:gate` |

Detector: `bash scripts/phase-hooks-suspended.sh` (exit 0 = suspended).

### Phase 9 velocity protocol (while suspended)

1. **Ship flow/UX** — identity BFF, `(app)/` shell, command centers; skip full gates between commits.
2. **Do not claim DoD** — `IMPLEMENTATION-TRUTH` stays honest; behavioral closure proof deferred to 9.8.
3. **GHA** still runs on push — defer push or use draft PRs if CI latency blocks you.
4. **Before 9.8 merge** — delete suspension marker and run the re-enable verify list in the yaml.

### Phase 9 targeted API specs (fast · low memory)

Avoid `pnpm --filter @apps/api exec node --test …` — it skips bootstrap env and often **hangs** after green assertions (keep-alive HTTP servers).

```bash
# Full Phase 9.6 settings API bundle (~20s, clean exit)
pnpm --filter @apps/api run test:file \
  test/settings-modules.spec.ts \
  test/settings-resources.spec.ts \
  test/settings-config-version.spec.ts \
  test/settings-audit-trail.spec.ts \
  test/settings-urban-regression.spec.ts \
  test/identity-me.spec.ts

# Phase 9.4–9.5 identity + bookings bundle (~30s)
pnpm --filter @apps/api run test:file \
  test/identity-session.spec.ts \
  test/identity-users.spec.ts \
  test/bookings-ops.spec.ts \
  test/bookings-create.spec.ts

# Phase 9.3 tours operator bundle (~15s)
pnpm --filter @apps/api run test:file test/tours-operator.spec.ts test/finance-route-registrar.spec.ts

# All Phase 9 memory API proofs (~45s)
pnpm --filter @apps/api run test:file \
  test/settings-modules.spec.ts test/settings-resources.spec.ts \
  test/settings-config-version.spec.ts test/settings-audit-trail.spec.ts \
  test/settings-urban-regression.spec.ts test/identity-me.spec.ts \
  test/identity-session.spec.ts test/identity-users.spec.ts \
  test/bookings-ops.spec.ts test/bookings-create.spec.ts \
  test/tours-operator.spec.ts test/finance-route-registrar.spec.ts
```

New HTTP specs should use `apps/api/test/http-test-client.ts` (`installHttpTestClient`) — **one server per describe**, `Connection: close`, proper teardown.

`test:file` pins `STORAGE_DRIVER=memory`; bootstrap clears shell `DATABASE_URL` so tenant workspace_type resolves via static registry (operator-smoke → starter for POST `/tours` bodies). Postgres integration specs need an explicit `STORAGE_DRIVER=prisma DATABASE_URL=…` command — not `test:file`.

**Env vs product failures:** Postgres-only suites (`*.postgres.spec.ts`, booking HTTP PG cert, capacity/concurrency proofs, finance recon RLS) must **honest-skip** when `DATABASE_URL`(+ADMIN) is absent — `describe(..., { skip: reason })` with a stable `*_REQUIRES_DATABASE` string. They must not throw at module load (that hard-fails memory trunk). MinIO / object-storage live suites skip when `readMinioPhotoConfigFromEnv() === null` (`MINIO_* env not set`). When MinIO env is set but the backend is full/unreachable, round-trip cases call `t.skip` with an environment reason (`PHOTO_STORAGE_FULL`, etc.) — not a product red. Port/ACL unit proofs use in-memory `TenantObjectStoragePort` and must not require MinIO.

### Phase 9 Postgres finance + persistence (local · ~15s)

Requires Phase 4 Postgres (`docs/phase-4/dev/docker-compose.yml`) and `pnpm --filter @apps/api run db:migrate:deploy`.

```bash
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db}"
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-postgresql://postgres:postgres@127.0.0.1:5434/tour_db}"
export STORAGE_DRIVER=prisma NODE_ENV=test

cd apps/api && node --import tsx --test --test-force-exit --test-concurrency=1 \
  test/phase-9-persistence.integration.spec.ts \
  test/finance-prepayments.spec.ts \
  test/finance-invoice.spec.ts \
  test/finance-schedules.spec.ts
```

## Phase 8 GitHub Actions (`.github/workflows/phase-8-gate.yml`)

Heavy verification runs on **ubuntu-latest** with service containers — not on the developer laptop.

| Job                 | When                                            | Services         | Command                                                             |
| ------------------- | ----------------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| `guard`             | Every PR / push (path filter)                   | —                | `phase-8:guard` + `guard:p8-boundary-diff`                          |
| `urban-regression`  | After guard green                               | —                | `phase-8.contract` + urban API proof specs + `workspace-urban` test |
| `urban-e2e`         | After guard green                               | —                | Playwright `test:e2e:urban`                                         |
| `ci-integrity`      | **main** push or `workflow_dispatch`            | Postgres 16      | `pnpm run ci:integrity`                                             |
| `phase-8-gate-full` | **main** push or manual `run_full_phase_8_gate` | Postgres + Redis | `pnpm run phase-8:gate`                                             |

**PR fast path (typical):** guard → urban-regression → urban-e2e (~15–45 min on GHA).

**Closure path (8.5):** merge to `main` triggers `ci-integrity` + `phase-8-gate-full`, or run **Actions → phase-8-gate → Run workflow** with `run_full_phase_8_gate: true`.

Postgres bootstrap in CI always uses `DATABASE_URL_ADMIN` (postgres role) for `pnpm run db:migrate:deploy` — never migrate with `app_tour` alone (DEC-124).

## Pre-commit fast path

`scripts/pre-commit-fast.sh` runs in order:

1. **`guard-docs`** — always (no-op unless protected core paths staged without `docs/`).
2. **Path-gated static guards** — only when staged paths match:
   - **Field exposure (phases 0–11):** exposure/integration API paths, exposure API tests and Prisma contracts, web exposure/integration surfaces, workspace exposure/plugin/settings contracts, exposure docs, `scripts/guards/field-exposure-*`, and `scripts/pre-commit-fast.sh`. Unrelated workspace, SDK, platform-core, and API changes no longer trigger all 12 guards. A manifest comment block lists all `field-exposure-phase-N-guard.mjs` filenames for guard contract checks.
   - **Wizard post-submit:** `apps/web/src/wizard/`, `apps/web/src/tours/`, `packages/workspaces/denali/src/ui/chrome/`, wizard bootstrap bindings.
   - **CSS globals:** `apps/{portal,marketing,web}/app/globals.css` or any staged `globals.css`.
3. **`check-node-engine`** — always.
4. **`lint-staged`** — batched eslint + prettier on staged files (see root `package.json` `lint-staged` key). `@apps/api` gets **prettier only** (no eslint on commit).
5. **`test-changed --mode pre-commit`** — always last.

### lint-staged coverage

| Glob                                                     | eslint                  | prettier |
| -------------------------------------------------------- | ----------------------- | -------- |
| `packages/workspace-sdk/**`, `packages/platform-core/**` | root `.eslintrc.cjs`    | yes      |
| `apps/web/**`, `apps/portal/**`, `apps/marketing/**`     | per-app `.eslintrc.cjs` | yes      |
| `apps/api/**`                                            | —                       | yes      |
| `*.{json,md,mdoc,yml,yaml}`                              | —                       | yes      |

## `test-changed` behavior

```bash
pnpm run test:changed                              # CI mode: origin/main...HEAD
bash scripts/test-changed.sh --mode pre-commit     # staged files only (Husky)
```

### CI mode (`--mode ci` or default)

1. **Diff:** `origin/main...HEAD` (fallback: `main`, `HEAD~1`).
2. **Path → workspace:** longest-prefix map includes `@apps/portal`, `@apps/marketing`, workspaces, apps, packages.
3. **Expansion:** static dependents (e.g. `@app-tour/workspace-sdk` → `platform-core`, `apps/api`, `apps/web`).
4. **`__scripts__` blast:** changes under `scripts/`, `docs/`, `.github/`, etc. seed sdk + platform-core + api + web.
5. **Tests:** full `pnpm --filter <pkg> test` per target.
6. **Cache:** `.cache/test-changed/<filter-slug>.sha`.

### Pre-commit mode (`--mode pre-commit`)

1. **Diff:** **staged files only** — validates what is being committed, not the whole dirty worktree.
2. **Early exit:** no staged files → skip (no tests).
3. **Direct packages only** — no `expand_pkg` fan-out (e.g. sdk edit runs sdk tests only, not api + web).
4. **`docs/` / `scripts/` changes** — **no tests** on commit (guards/doc-gate handle policy).
5. **`@apps/api`:** spec-level via `scripts/lib/resolve-api-test-specs.mjs` → `pnpm --filter @apps/api run test:file <specs>`. Paths under `apps/api/scripts/` and `apps/api/docs/` are ignored. When a production path yields **zero** mapped specs, pre-commit warns, runs the bounded memory baseline (`package-boundary`, `resolve-workspace-type`, `tours-operator`), and defers the full API suite to checkpoint/CI.
6. **`@apps/web`:** directly referenced unit/contract specs via `scripts/lib/resolve-web-test-specs.mjs` → `pnpm --filter @apps/web run test:file <specs>`. An unmapped production path warns and runs the bounded baseline (`barrel-hunt`, `dashboard-smoke`, `phase-9.contract`); the full web suite remains in checkpoint/CI.
7. **Workspaces:** includes `@apps/portal`, `@apps/marketing`, urban, guest-club, and other mapped packages.
8. **Cache:** `.cache/test-changed/@apps___api-specs.sha` / `@apps___web-specs.sha` for spec lists; package-level `.sha` for other workspaces. Keys hash staged index content plus the package manifest, lockfile, and test runner sources; unrelated commit identity does not invalidate a warm pre-commit cache.

### Fast-path timing report

Every manual `pnpm run pre-commit:fast` run records per-step
`RUN`/`SKIP`/`PASS`/`FAIL` timing in
`.cache/pre-commit-fast/latest.tsv`. The default budget is 60 seconds
(`FAST_PATH_BUDGET_SECONDS` overrides it). Exceeding the budget emits a warning
but does not change a correct exit status.

Before re-enabling a suspended hook, stage one representative change for each
scenario and run:

```bash
bash scripts/benchmark-pre-commit-fast.sh docs         # 3×, <=10s
bash scripts/benchmark-pre-commit-fast.sh ui           # 3×, <=30s
bash scripts/benchmark-pre-commit-fast.sh package-api  # 3×, <=60s
```

Each command uses an isolated temporary cache: run 1 is cold and runs 2–3 are
warm. The suspension marker may be removed only after all three scenarios pass.

### API spec resolver (`scripts/lib/resolve-api-test-specs.mjs`)

| Changed path prefix                                      | Specs run                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/api/test/*.spec.ts` or `apps/api/src/**/*.spec.ts` | that file                                                                        |
| `apps/api/src/identity/`                                 | `test/identity-*.spec.ts`                                                        |
| `apps/api/src/settings/`                                 | `test/settings-*.spec.ts`                                                        |
| `apps/api/src/bookings/`                                 | `test/bookings-*.spec.ts`                                                        |
| `apps/api/src/tours/`                                    | `test/tours-*.spec.ts`                                                           |
| `apps/api/src/finance/`                                  | `test/finance-*.spec.ts`                                                         |
| `apps/api/src/exposure/`                                 | `test/field-exposure-*.spec.ts`, `test/4-integration/field-exposure-*.spec.ts`   |
| `apps/api/src/integrations/`                             | `test/integrations-*.spec.ts`, `test/field-exposure-*.spec.ts`                   |
| `apps/api/prisma/`                                       | `test/phase-9-persistence.integration.spec.ts`                                   |
| other `apps/api/**` (production)                         | **fallback:** three memory baseline specs + warning; full suite at checkpoint/CI |
| `apps/api/scripts/**`, `apps/api/docs/**`                | ignored (no tests, no fallback)                                                  |

Dry-run resolver:

```bash
git diff --cached --name-only | node scripts/lib/resolve-api-test-specs.mjs
```

### Web spec resolver (`scripts/lib/resolve-web-test-specs.mjs`)

The web resolver runs a changed spec directly or finds unit/contract specs that
reference the changed `apps/web` path. It excludes `test/e2e/`. If a production
path has no direct mapping, it emits the bounded three-spec baseline described
above and leaves the full web suite to `test:changed` checkpoint/CI.

Dry-run resolver:

```bash
git diff --cached --name-only | node scripts/lib/resolve-web-test-specs.mjs
```

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

`pnpm run test:full` runs `phase-5:gate` (which nests `phase-4:gate` → `phase-3:gate`). Nested `phase-4:gate` requires Postgres for `p4_rls_integration_tests`:

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

- Phase 3: `.github/workflows/phase-3-gate.yml` runs `pnpm run phase-3:gate` (`phase-3:guard` + `phase-3:apps-cert`). Local static-only: `pnpm run phase-3:guard`.
- Phase 10 + G+H+I: `.github/workflows/phase-10-guard.yml` — registry freshness, guest conformance, certification guards, I1/I2 guards + script tests. **H2/H4 API+web integration specs run in local `phase-i:closure` only** (full workspace build chain; not GHA fast path).
- API nightly: `.github/workflows/api-nightly.yml` — scheduled `test:nightly:cold-start` (enforce) + `test:nightly:slow-sink`; not on trunk PR path.
- Phase 4 RLS: run `pnpm run test:full` (or `phase-4:gate` with env) in a job with Postgres — not part of fast pre-commit.

## Phase G+H+I closure fast-track (DEV → main PR)

**Full bundle (recommended before merge):**

```bash
pnpm run phase-i:closure      # G+H regression + I1/I2 guards (~10 min)
pnpm run phase-g-h:handoff    # print PR checklist (no gh)
pnpm run phase-g-h:create-pr  # after gh auth login
```

**G+H only (subset):**

```bash
pnpm run phase-g-h:fast-track
```

Authority: [`workspace-certification.mdoc`](./workspace-certification.mdoc) · [`workspace-registry-codegen-modularization.mdoc`](./workspace-registry-codegen-modularization.mdoc) · [`workspace-scale-hardening.mdoc`](./workspace-scale-hardening.mdoc).
