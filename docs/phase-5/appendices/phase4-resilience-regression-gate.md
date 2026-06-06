# Phase 4 resilience regression gate + sign-off (DEC-079 / closure step 9)

```yaml
status: implemented
phase: 4 resilience audit — closure step 9
closes: closure path steps 1–8 (DEC-071 … DEC-078)
related: phase4-resilience-audit.md, TEMP/phase4-resilience-audit-fix-list.md
```

## Problem

Phase 4 resilience fixes (steps 1–8) shipped individual guards and specs but lacked a **single orchestrated gate** and **formal sign-off artifact** — audit verdict remained **CONDITIONAL (62/100)** without closure proof.

## Decision

| Item          | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Gate command  | `pnpm run phase-4:resilience-regression-gate`                                           |
| Artifact      | `test/reliability/phase-4-resilience-regression-gate.last-run.json`                     |
| Meta spec     | `test/reliability/phase-4-resilience-regression-gate.spec.ts`                           |
| CI lock       | `guard:phase4-resilience-regression-gate`                                               |
| Cross-phase   | Embeds `phase-4:cross-phase-p0-verify` (DEC-073) — no duplicate NN/RL-DOS matrix        |
| Postgres tier | **Required** (DEC-080) — see [`postgres-required-gates.md`](postgres-required-gates.md) |
| Wave A        | DEC-080 … DEC-082 — `postgresRequired: true` in artifact                                |
| Wave B        | DEC-083 … DEC-085 — Redis fallback, SQL `now()`, shutdown watchdog                      |
| Wave C        | DEC-086 … DEC-089 — replay, FIFO, projection lag, chaos + NN gate pack                  |
| Wave D        | DEC-090 … DEC-093 — cache coherence, migrateCanonical guard, INVALID_JSON, proxy wire   |

## Gate steps (memory tier)

1. `guard:outbox-processing-reclaim` (DEC-071)
2. `guard:outbox-publish-done-pairing` (DEC-072)
3. `guard:tenant-registry-cache-invalidation` (DEC-074)
4. `guard:proxy-upstream-timeout` (DEC-075)
5. `guard:graceful-shutdown-outbox` (DEC-076)
6. `guard:canonical-transaction-now` (DEC-077)
7. `guard:patch-schema-drift` (DEC-078)
8. `guard:phase4-cross-phase-p0` (DEC-073 wiring)
9. `phase-4:cross-phase-p0-verify` (NN / RL-DOS / victim SLO)
10. `build-dist` — monorepo root `pnpm run build` (`gate-build-dist.mjs`; `platform-core/dist` before `@apps/api` prebuild)
11. Resilience closure specs (outbox reclaim/pairing/shutdown, proxy timeout, canonical TX now, schema PATCH drift)

## Gate steps (postgres tier — required, DEC-082)

12. `phase4-resilience-postgres-specs` — `STORAGE_DRIVER=prisma`:

| Spec                                                         | DEC / audit                             |
| ------------------------------------------------------------ | --------------------------------------- |
| `test/4-integration/clock-skew-resilience.spec.ts`           | CLK-SKEW-08/09                          |
| `test/4-integration/dynamic-config-sync.spec.ts`             | DEC-074 E2E                             |
| `src/outbox/outbox-processing-reclaim.spec.ts`               | DEC-071 integration                     |
| `src/outbox/outbox-publish-done-pairing.spec.ts`             | DEC-072 integration                     |
| `test/outbox-relay.integration.spec.ts`                      | SKIP LOCKED + RLS                       |
| `test/outbox-transactional.integration.spec.ts`              | Atomic outbox persist                   |
| `test/4-integration/outbox-failed-replay.spec.ts`            | DEC-086 replay                          |
| `test/4-integration/outbox-relay-ordered-per-tenant.spec.ts` | DEC-087 FIFO                            |
| `test/chaos/atomic-rollback-stress.spec.ts`                  | DEC-089 chaos (`P5_CHAOS_ITERATIONS=5`) |
| `test/3-performance/bulk-import-victim-slo.spec.ts`          | CASCADE-01 victim SLO                   |
| `test/3-performance/noisy-neighbor-latency.spec.ts`          | NN latency under prisma                 |

Wave C guards (steps 1–8 unchanged +):

- `guard:outbox-failed-replay`
- `guard:outbox-relay-ordered-per-tenant`
- `guard:outbox-projection-lag`

Wave D guards + memory specs:

- `guard:tenant-registry-cache-coherence`
- `guard:migrate-canonical-placeholder`
- `guard:http-malformed-json`
- `guard:proxy-production-wire`
- `test/4-integration/malformed-json-body.spec.ts`
- `test/4-integration/proxy-production-wire.spec.ts`

Gate **exits 1** if `DATABASE_URL` unset (`requireGateDatabase`).

## Sign-off (DEC-079)

| Metric                          | Before closure | After closure gate PASS                     |
| ------------------------------- | -------------- | ------------------------------------------- |
| **Chaos verdict**               | CONDITIONAL    | **CLOSURE_PASS_WITH_RESIDUAL**              |
| **Resilience score (estimate)** | 62/100         | **88/100** (Wave A–D closure)               |
| **Must-Fix P0 (phase4 list)**   | 8 open         | **0 open** (steps 1–5 + cross-phase verify) |
| **Closure steps**               | 1–8 pending    | **1–9 Done**                                |

### Residual (not closure blockers)

| ID                      | Topic                                                     |
| ----------------------- | --------------------------------------------------------- |
| SH-GAP-13               | Redis runtime blip → 500 (RL-DOS-04) — **closed DEC-083** |
| CLK-F-03/04             | Terminal SQL `now()` — **closed DEC-084**                 |
| SV-F-04                 | `migrateCanonical` — Phase 6                              |
| SD-G4/G5/G7             | Shutdown watchdog — **closed DEC-085**                    |
| F-03/F-15/OZ-A          | Replay / FIFO / chaos — **closed DEC-086…089**            |
| PU-F-03 / PI-03 / SV-11 | Wave D coherence — **closed DEC-090…093**                 |
| SV-F-04                 | `migrateCanonical` — Phase 6 (guard only DEC-091)         |

## Verification

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test

cd apps/api && pnpm run guard:phase4-resilience-regression-gate
pnpm run phase-4:resilience-regression-gate
# artifact MUST show databaseUrlSet: true, postgresRequired: true
```
