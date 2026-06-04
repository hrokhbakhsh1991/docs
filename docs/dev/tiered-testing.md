# Tiered testing strategy

> **Goal:** Keep Husky pre-commit under ~60s while preserving a full verification path for PR closure and Phase 4 RLS.

## Tiers

| Tier                   | Command                              | When                        | What runs                                                                                                                                              |
| ---------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fast (default)**     | Husky → `scripts/pre-commit-fast.sh` | Every `git commit`          | `guard-docs`, Node engine, eslint on changed TS (root + `apps/web`), optional prettier (if installed + config), `test-changed` for affected workspaces |
| **Changed tests**      | `pnpm run test:changed`              | Manual / CI selective       | `scripts/test-changed.sh --mode ci` — diff `origin/main...HEAD`, dependency expansion, `.cache/test-changed/`                                          |
| **Pre-commit dry-run** | `pnpm run pre-commit:fast`           | Before commit               | Same as Husky fast path                                                                                                                                |
| **Full**               | `pnpm run test:full`                 | Before PR / Phase 4 closure | `phase-3:gate` + `phase-4:gate` (includes build, full `pnpm test`, guards, doc-gate, `p4_rls_integration_tests` when env set)                          |
| **CI integrity**       | `pnpm run ci:integrity`              | GitHub / explicit local     | Phases **0 → 3** via `scripts/ci-integrity-check.sh` — **not** Husky default                                                                           |

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

## GitHub Actions

- Phase 3: `.github/workflows/phase-3-gate.yml` runs `pnpm run phase-3:gate` on PR/push.
- Phase 4 RLS: run `pnpm run test:full` (or `phase-4:gate` with env) in a job with Postgres — not part of fast pre-commit.
