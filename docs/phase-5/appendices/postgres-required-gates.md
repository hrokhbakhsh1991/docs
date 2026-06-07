# Postgres-required gates (DEC-080 / Wave A)

```yaml
status: implemented
phase: 4 resilience — Wave A (9.5+ path)
closes: GAP-95-A01 … GAP-95-A06
related: phase4-resilience-regression-gate.md, phase4-cross-phase-p0-verify.md, phase-4/ci.md
```

## Problem

Phase 4 resilience and cross-phase gates could **PASS** with `databaseUrlSet: false` — Postgres integration specs were skipped via `describe.skip` and optional postgres tiers. Enterprise SaaS CI treats a real database as **mandatory** for RLS, outbox relay, and clock-skew proofs; skip = fail.

## Decision

| Item            | Choice                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| Policy          | `DATABASE_URL` **required** before any Phase 4 resilience/cross-phase gate runs       |
| Helper          | `apps/api/scripts/lib/require-gate-database.mjs` — `exit 1` when unset                |
| Gates           | `phase-4:resilience-regression-gate`, `phase-4:cross-phase-p0-verify`                 |
| Postgres driver | `STORAGE_DRIVER=prisma` on postgres-tier spec steps                                   |
| Artifact fields | `postgresRequired: true`, `databaseUrlSet: true` (always when gate completes)         |
| Skip rule       | Zero `# SKIP` / `describe.skip` hits on gate path — gate supplies env                 |
| Runner          | Postgres tier uses `--test-force-exit` — Prisma/http handles must not block gate exit |

### Required environment

| Variable             | Role                                                               | Example                                                                     |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`       | App pool (`app_tour`, RLS-enforced)                                | `postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32` |
| `DATABASE_URL_ADMIN` | Superuser for seed/migrate (warn if unset; specs have CI fallback) | `postgresql://postgres:postgres@127.0.0.1:5434/tour_db`                     |
| `STORAGE_DRIVER`     | `prisma` on postgres-tier steps                                    | `prisma`                                                                    |

### Local bootstrap

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export STORAGE_DRIVER=prisma NODE_ENV=test
psql "$DATABASE_URL_ADMIN" -f docs/phase-4/dev/init/01-app-role.sql 2>/dev/null || true
pnpm --filter @apps/api run db:migrate:deploy
```

See [`migrate-deploy-only.md`](migrate-deploy-only.md) (DEC-124) — no parallel `infra/sql` bootstrap.

Postgres tier env includes `APPS_API_TEST_TIER=nightly` (DEC-089) so `atomic-rollback-stress.spec.ts` (chaos nightly tier) is not skipped. `noisy-neighbor-latency.spec.ts` runs in **`api-nightly.yml`** only — not blocking PR gate.

## Gate → postgres tier specs

### `phase-4:resilience-regression-gate` (DEC-082)

| Spec                                               | Proves                             |
| -------------------------------------------------- | ---------------------------------- |
| `test/4-integration/clock-skew-resilience.spec.ts` | CLK-SKEW-08/09 DB authority        |
| `test/4-integration/dynamic-config-sync.spec.ts`   | DEC-074 cache invalidation E2E     |
| `src/outbox/outbox-processing-reclaim.spec.ts`     | DEC-071 reclaim under RLS          |
| `src/outbox/outbox-publish-done-pairing.spec.ts`   | DEC-072 pairing under RLS          |
| `test/outbox-relay.integration.spec.ts`            | SKIP LOCKED claim + tenant session |
| `test/outbox-transactional.integration.spec.ts`    | Atomic persist + outbox row        |

### Wave C extensions (DEC-089 / CASCADE-01)

| Spec                                                         | Proves                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| `test/4-integration/outbox-failed-replay.spec.ts`            | DEC-086 failed + replay heal                  |
| `test/4-integration/outbox-relay-ordered-per-tenant.spec.ts` | DEC-087 per-tenant FIFO                       |
| `test/chaos/atomic-rollback-stress.spec.ts`                  | OZ-A subprocess SIGKILL — zero orphan commits |
| `test/3-performance/bulk-import-victim-slo.spec.ts`          | CASCADE-01 victim p95 under bulk storm        |

Gate sets `P5_CHAOS_ITERATIONS=5` for chaos fast path. Post-chaos assert: no stale `processing` rows for chaos tenant. Postgres tier env: `APPS_API_TEST_TIER=nightly`, `OUTBOX_RELAY_ORDERED_PER_TENANT=true`. CPU NN probe: nightly workflow — tier table in [`baseline-ratio-tiering.md`](baseline-ratio-tiering.md).

### Wave D extensions (DEC-090 … DEC-093)

| Spec                                                         | Proves                                |
| ------------------------------------------------------------ | ------------------------------------- |
| `test/4-integration/tenant-registry-cache-coherence.spec.ts` | DEC-090 feature flags via theme cache |
| `test/4-integration/malformed-json-body.spec.ts`             | DEC-092 INVALID_JSON 400              |
| `test/4-integration/proxy-production-wire.spec.ts`           | DEC-093 map enrich + DI               |

Memory-tier only (no postgres): `malformed-json-body`, `proxy-production-wire`. Coherence spec requires postgres.

### `phase-4:cross-phase-p0-verify`

| Spec                                            | Proves                                 |
| ----------------------------------------------- | -------------------------------------- |
| `test/3-performance/db-pool-saturation.spec.ts` | NN pool saturation under real Postgres |

## Failure modes

```text
DATABASE_URL unset → requireGateDatabase → exit 1 (before any guard/spec)
Postgres tier spec fail → gate FAIL, artifact verdict FAIL
databaseUrlSet:false in artifact → meta spec FAIL (stale run)
```

## CI (DEC-081)

GitHub Actions workflow `.github/workflows/phase-4-gate.yml` provisions Postgres service, `db:migrate:deploy` only (DEC-124), then runs resilience gate and `phase-4:gate`. See [`docs/phase-4/ci.md`](../../phase-4/ci.md).

## Verification

```bash
# Must fail:
cd apps/api && env -u DATABASE_URL pnpm run phase-4:resilience-regression-gate

# Must pass (with Postgres up):
cd apps/api && pnpm run phase-4:resilience-regression-gate
cd apps/api && pnpm run phase-4:cross-phase-p0-verify
pnpm run guard:phase4-resilience-regression-gate
pnpm run guard:phase4-cross-phase-p0
```
