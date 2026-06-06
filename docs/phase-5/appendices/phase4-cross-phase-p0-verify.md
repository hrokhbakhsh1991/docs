# Phase 4 cross-phase P0 verify (DEC-073 / step 3)

```yaml
status: implemented
phase: 4 resilience audit — closure step 3
closes: CASCADE-01 (partial), CASCADE-03 (partial)
verifies: Phase 3 DEC-053…069 against Phase 4 Must-Fix NN / RL-DOS / Redis
```

## Purpose

Phase 4 Must-Fix items **NN-01/02**, **RL-DOS-01**, and **SCAL-HF-11** are implemented under Phase 3 scalability closure. Step 3 does **not** re-implement them — it **re-runs** the CI locks and performance probes that prove CASCADE-01 and CASCADE-03 mitigations remain wired.

## Verification matrix

| Phase 4 ID          | CASCADE    | Phase 3 mitigation                                             | DEC                       | Guard / probe                                                                                                                           | Step 3 status                          |
| ------------------- | ---------- | -------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **NN-01**           | CASCADE-01 | Validation queue shed + worker pool + time budget              | DEC-054, DEC-056          | `guard:validation-queue-depth`, `guard:validation-workers`, `validation-queue-depth.spec.ts`, `validation-worker-pool.spec.ts`          | **Verified**                           |
| **NN-02**           | CASCADE-01 | Per-tenant DB budget + tour write concurrency cap              | DEC-055, DEC-064          | `guard:tenant-db-budget`, `guard:tour-write-concurrency`, `tenant-connection-budget.spec.ts`, `tour-write-concurrency.spec.ts`          | **Verified**                           |
| **NN-01/02**        | CASCADE-01 | Worker offload + victim SLO under bulk import                  | DEC-056, DEC-069          | `validation-worker-pool.spec.ts`, `guard:bulk-import-victim-slo`, `bulk-import-victim-slo.spec.ts`                                      | **Verified**                           |
| **NN-01** (nightly) | CASCADE-01 | CPU noisy-neighbor latency probe                               | DEC-056                   | `noisy-neighbor-latency.spec.ts` (nightly tier — not in trunk gate)                                                                     | **Nightly**                            |
| **RL-DOS-01**       | CASCADE-03 | Theme registry cache on rate-limiter path + 100-ID flood probe | DEC-053, DEC-059, DEC-068 | `guard:rate-limit-theme-cache`, `guard:tenant-registry-cache-bounds`, `guard:rate-limiter-100-probe`, `tenant-rate-limiter-100.spec.ts` | **Verified**                           |
| **SCAL-HF-11**      | CASCADE-03 | Production `REDIS_URL` required (fail-closed boot)             | DEC-065                   | `guard:production-redis-url`, `production-runtime-env.spec.ts`                                                                          | **Partial**                            |
| **RL-DOS-04**       | CASCADE-03 | Redis **runtime** blip → 500 fail-closed                       | — (SH-GAP-13)             | Not in Phase 3 scope                                                                                                                    | **Residual** — Phase 5 evolution audit |

### Residual gap (explicit)

**SCAL-HF-11 / RL-DOS-04:** DEC-065 prevents unbounded in-memory limiter keys in production by requiring `REDIS_URL` at boot. A **runtime** Redis connectivity blip still surfaces as **500** on rate-limited routes (`redis-rate-limiter-store.ts`). Fail-open degradation is tracked as **SH-GAP-13** in [`phase5-evolution-audit.md`](../../../apps/api/docs/phase5-evolution-audit.md) — not blocking step 3 verify.

## Gate

Runs **9 guards** + **`pnpm run build`** (worker thread loads `dist/canonical/validation-worker-entry.js`) + **8 trunk specs** + **required postgres tier** (`db-pool-saturation.spec.ts`). `DATABASE_URL` is **mandatory** (DEC-080) — see [`postgres-required-gates.md`](postgres-required-gates.md).

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export STORAGE_DRIVER=prisma NODE_ENV=test
cd apps/api && pnpm run phase-4:cross-phase-p0-verify
pnpm run guard:phase4-cross-phase-p0
node --import tsx --test test/reliability/phase-4-cross-phase-p0-verify.spec.ts
```

Artifact: `test/reliability/phase-4-cross-phase-p0-verify.last-run.json`

## CASCADE verdict after step 3

| Scenario       | Before step 3           | After step 3                                                                                                        |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **CASCADE-01** | Unmitigated NN brownout | **Partially mitigated** — queue/worker/budget/victim SLO probes green; Rule Engine hard-fail paths remain (Phase 6) |
| **CASCADE-03** | Admin pool + Redis 500  | **Partially mitigated** — RL-DOS-01 closed; Redis runtime blip residual                                             |
