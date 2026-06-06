# Tiered testing strategy

> **Goal:** Keep Husky pre-commit under ~60s while preserving a full verification path for PR closure and Phase 4 RLS.

## Tiers

| Tier                     | Command                              | When                        | What runs                                                                                                                                              |
| ------------------------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fast (default)**       | Husky → `scripts/pre-commit-fast.sh` | Every `git commit`          | `guard-docs`, Node engine, eslint on changed TS (root + `apps/web`), optional prettier (if installed + config), `test-changed` for affected workspaces |
| **Changed tests**        | `pnpm run test:changed`              | Manual / CI selective       | `scripts/test-changed.sh --mode ci` — diff `origin/main...HEAD`, dependency expansion, `.cache/test-changed/`                                          |
| **Pre-commit dry-run**   | `pnpm run pre-commit:fast`           | Before commit               | Same as Husky fast path                                                                                                                                |
| **Full**                 | `pnpm run test:full`                 | Before PR / Phase 4 closure | `phase-3:gate` + `phase-4:gate` (includes build, full `pnpm test`, guards, doc-gate, `p4_rls_integration_tests` when env set)                          |
| **CI integrity**         | `pnpm run ci:integrity`              | GitHub / explicit local     | Phases **0 → 3** via `scripts/ci-integrity-check.sh` — **not** Husky default                                                                           |
| **Nightly (API probes)** | `pnpm run test:nightly`              | Scheduled / pre-release     | `APPS_API_TEST_TIER=nightly` — backlog 1000-row, noise-neighbor HTTP, 10k relay leak; includes `test:nightly:soak` when `RUN_SOAK=1`                   |

Hooks cannot be bypassed (`HUSKY=0` / `SKIP_HOOKS` rejected). Fast path is the new default; full path is **on demand**.

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

| Command                                    | `APPS_API_TEST_TIER` | Probes                                                                                          |
| ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm --filter @apps/api test` (default)   | `trunk`              | Unit + integration; **skips** nightly-only specs                                                |
| `pnpm --filter @apps/api run test:nightly` | `nightly`            | Full suite including `event-backlog-recovery`, `noise-neighbor`, `outbox-relay-connection-leak` |
| `pnpm run test:nightly` (root)             | `nightly` + soak     | Above + `soak-memory-leak` when `RUN_SOAK=1`                                                    |

`pnpm run phase-5:gate` uses trunk-tier `pnpm test` — heavy probes do not block PR closure.

Nightly-only specs: [`apps/api/test/test-tier.ts`](../../apps/api/test/test-tier.ts).

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
- Phase 4 RLS: run `pnpm run test:full` (or `phase-4:gate` with env) in a job with Postgres — not part of fast pre-commit.
