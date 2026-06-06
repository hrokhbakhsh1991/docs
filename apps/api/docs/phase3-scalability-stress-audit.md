# Phase 3 — Scalability & Stress Audit

**Date:** 2026-06-05  
**Final stress-test audit:** 2026-06-05  
**Scope:** `apps/api/src` — connection-pool saturation, event-loop blocking sync work, CPU-heavy validation fairness, **noisy neighbor (Tenant A bulk import vs Tenant B login/read)**, **TenantRateLimiter under 100-tenant-ID flood**, **in-process outbox relay under 10_000-event flood** (§10), **shared mutable state races between concurrent HTTP requests** (§9), **logging backpressure** (§11), **cold-start / service initialization under adversarial cloud restart** (§12).  
**Method:** Static code review + tier-3 performance/reliability/chaos specs + live runs (`pool-stress-500-parallel.ts`, `outbox-throughput.spec.ts` @ 10k, `log-backpressure-burst.ts`, `cold-start-latency.spec.ts`, subprocess `main.ts` probes).  
**Related:** [phase0-audit-report.md](./phase0-audit-report.md) (pool isolation, HT-03/HT-08), [phase2-paranoid-audit.md](./phase2-paranoid-audit.md) (LOG-BP-_, TRACE-_), [`docs/phase-5/appendices/connection-budget.md`](../../../docs/phase-5/appendices/connection-budget.md), [`docs/phase-5/appendices/validation-fairness.md`](../../../docs/phase-5/appendices/validation-fairness.md), [`docs/phase-5/appendices/rate-limiting.md`](../../../docs/phase-5/appendices/rate-limiting.md) (DEC-015), DEC-004 (outbox co-commit), DEC-017 (relay publish concurrency).

---

## Final Stress-Test Audit

**Role:** Capstone — where the **single-worker** API stops meeting SLOs, degrades gracefully (503/429), or risks **hard failure** (OOM, hang, DoS, observability loss).  
**Assumptions (all break-point estimates):** `DATABASE_URL` set (Postgres), `STORAGE_DRIVER=prisma` unless noted, **one Node worker** / one `createRequestListener`, test pool **`connection_limit=10`** & **`pool_timeout=1s`** where specs pin it, default write rate limit **`TENANT_RATE_LIMIT_POINTS=50`/s** (tests often use 10/s).

### Headline

| Metric                                      |                                                                                                           Value |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------: |
| **Break-point RPS (global, pool-limited)**  | **~40 RPS** sustained @ 250 ms DB hold · **~10 concurrent** long-held TX · **~200 RPS** @ ~50 ms TX (estimated) |
| **Break-point RPS (per tenant, by design)** |                                       **50 RPS** write / read tiers (429 above bucket) · tests gate at **10/s** |
| **Hard-fail risks**                         |                                                                      **12** ([SCAL-HF-01…12](#hard-fail-risks)) |
| **Scalability debt**                        |                                                                   **14** ([SCAL-DEBT-01…14](#scalability-debt)) |
| **Verdict**                                 |                                                                                                 **CONDITIONAL** |

**Headline RPS derivation:** Little's law on gate pool: 10 connections ÷ 0.25 s hold ≈ **40 completions/s** before queue saturation. Live proof: [`pool-stress-500-parallel.ts`](../scripts/pool-stress-500-parallel.ts) — **500 concurrent** → **460×503**, **40×200**, ~2.4 s storm, loop alive ([§ Pool 500](#prisma-connection-pool--500-parallel-http-stress-audit)). Short canonical TX (~50 ms) raises ceiling to **~200 RPS** global (not gate-tested at 500 parallel). Per-tenant **50 RPS** is intentional throttling, not infra failure.

### Break point table

| Failure mode                                    |                                                             Approx RPS / concurrent limit | Primary evidence                                                                             | Failure character                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **DB pool saturation**                          | **~10 concurrent** long TX · **~40 RPS** @ 250 ms hold · **500 parallel** spike tolerated | `db-pool-saturation.spec.ts`, `pool-stress-500-parallel.ts`                                  | **Graceful** — 503 `service_unavailable`; heartbeat ≥8 (100) / 56 (500)                  |
| **Per-tenant HTTP rate limit**                  |                                      **50 RPS/tenant** (default) · **10/s** in unit specs | `tenant-rate-limiter.spec.ts`, `tenant-rate-limiting.spec.ts`                                | **Graceful** — 429; victim ≤2× baseline p50                                              |
| **100-tenant ID limiter flood**                 |                             **100 concurrent** admin `findUnique` / wave (not RPS-capped) | [RL-DOS-01…04](#dos-vulnerability-table)                                                     | **DoS** — admin pool + heap amplification                                                |
| **CPU noisy neighbor (RuleEngine)**             |                                 **1000 concurrent** validations breaks **10%** victim SLO | `noisy-neighbor-latency.spec.ts`                                                             | **Degraded** — ratio >1.10 = throttling gap                                              |
| **DB read noisy neighbor**                      |                             **500 concurrent GETs** + 1 POST → fail if write >4× baseline | `noise-neighbor.spec.ts`                                                                     | **Degraded** — 300% SLO on reads                                                         |
| **Noisy neighbor (bulk import → B login/read)** |                                       A at **50/s POST** or **10 parallel** persist/chunk | [NN-01…08](#noisy-neighbor-vulnerability-register)                                           | **503/timeout** on B `GET /tours`, tenant-config                                         |
| **Outbox 10k flood + HTTP**                     |                             **~233 events/s** drain · **20 concurrent** POST OK @ ≤4× p95 | [§10](#10-outbox-relay--10000-event-flood-audit) (10.5 live run)                             | **Pass** — 0 System Scalability Failures                                                 |
| **Outbox 10k memory / conn leak**               |                                                                      **10_000 ops** batch | `outbox-relay-memory.spec.ts`, `outbox-relay-connection-leak.spec.ts`                        | **Pass** — heap ≤2× post-GC; max 9 `app_tour` conns                                      |
| **Logging backpressure**                        | **1000 req** burst @ c=100 OK (fast stdout) · **>~200–500 RPS** to slow sink **untested** | `log-backpressure-burst.ts`, [§11.4](#114-empirical-baseline-fast-sink--extends-log-bp-0102) | **Low today** · [FOF-LOG-01…03](#115-fatal-observability-flaw-inventory) under slow sink |
| **Cold start / scale-to-zero**                  |                                                         **1st request** **<1000 ms** TTFB | `cold-start-latency.spec.ts`                                                                 | **Budget fail** — serverless readiness                                                   |
| **Memory soak (heap slope)**                    |                                              **50 RPS × 900 s** (`SOAK_MAX_INFLIGHT=200`) | `soak-memory-leak.spec.ts` (`RUN_SOAK=1`)                                                    | **Pass** if \|slope\| ≤0.03 MB/s                                                         |
| **Large JSON (no body cap)**                    |                                              **512 KiB–2 MiB** parse blocks loop 5–50 ms+ | [Event loop blockers](#performance-blockers-event-loop)                                      | **Degraded → OOM** at multi-MiB                                                          |
| **Validation gate (HT-03)**                     |                                                            **2+ tenants** parallel pre-TX | `validation-gate-concurrency.spec.ts`                                                        | **Pass** — per-tenant `openGates` Map                                                    |

### Scalability Debt

Architectural items deferred — tier-3 gates **pass**, but scale-out needs these.

| ID               | Item                                                             | Closes                                                | Detail                                                                |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| **SCAL-DEBT-01** | Per-tenant DB connection semaphore (P2-5)                        | NN-02, PS-02                                          | [Pool stress §](#database-connection-pool--stress-integration)        |
| **SCAL-DEBT-02** | RuleEngine validation worker pool + time budget                  | NN-01, NN-04, EL High rows                            | DEC-016 scheduler insufficient alone                                  |
| **SCAL-DEBT-03** | HTTP request body size limit (413)                               | NN-07, large JSON rows                                | No `maxBody` in `src/`                                                |
| **SCAL-DEBT-04** | Require `REDIS_URL` + cache theme lookup                         | RL-DOS-01/02                                          | [Tenant rate limiter §](#tenant-rate-limiter--100-tenant-flood-audit) |
| **SCAL-DEBT-05** | Enforce `STORAGE_DRIVER=prisma` in prod                          | DI-MEM-01, [AUDIT-GAP-01](./phase2-paranoid-audit.md) | Memory driver non-forensic                                            |
| **SCAL-DEBT-06** | Per-tenant validation queue max depth + shed                     | NN-04, BULK-UNSAFE-01                                 | Unbounded `tenantQueues`                                              |
| **SCAL-DEBT-07** | Defer access logs off sync `finish`                              | FOF-LOG-02, [LOG-BP-03](./phase2-paranoid-audit.md)   | §11                                                                   |
| **SCAL-DEBT-08** | Logging backpressure contract (drop/drain/flush)                 | FOF-LOG-01/03                                         | §11.7                                                                 |
| **SCAL-DEBT-09** | Bulk import concurrency cap / job API                            | NN-05                                                 | No HTTP bulk route today                                              |
| **SCAL-DEBT-10** | Outbox relay per-tenant budget                                   | NN-03, NN-06, OB-COND-02                              | Size pool ≥ publish concurrency                                       |
| **SCAL-DEBT-11** | Idempotency memory TTL + LRU ([HT-08](./phase0-audit-report.md)) | `memoryByKey`                                         | Dev/memory driver                                                     |
| **SCAL-DEBT-12** | Registry cache max-size sweep                                    | RL-DOS-03, admin reads                                | 5s TTL only                                                           |
| **SCAL-DEBT-13** | Victim SLO spec: bulk import ∥ B login/read                      | NN gap                                                | Extends noise-neighbor matrix                                         |
| **SCAL-DEBT-14** | 100-tenant rate-limiter probe in CI                              | RL-DOS gap                                            | Two-tenant specs insufficient                                         |
| **SCAL-DEBT-15** | Cold-start readiness gate @ **500 ms** (compiled `dist/main.js`) | CS-UNSC-01/02                                         | §12 — tsx dev path **2×** over SLO                                    |

### Hard-Fail Risks

Crash, OOM, hang, pool leak without recovery, cross-tenant DoS, or fatal observability — **not** graceful 503/429.

| ID             | Risk                                             | Trigger (approx)                                 | Canonical ref                            |
| -------------- | ------------------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| **SCAL-HF-01** | Admin DB amplification via rate limiter          | **100+ unique tenant IDs** × rate-limited routes | RL-DOS-01, RL-DOS-03                     |
| **SCAL-HF-02** | OOM — memory rate limiter keys                   | Rotating UUIDs without `REDIS_URL`               | RL-DOS-02                                |
| **SCAL-HF-03** | OOM — unbounded idempotency Map                  | Unique `Idempotency-Key` flood (memory driver)   | HT-08, `memoryByKey`                     |
| **SCAL-HF-04** | OOM — validation queue closures                  | Burst >> scheduler drain                         | NN-04, BULK-UNSAFE-01                    |
| **SCAL-HF-05** | OOM — metrics label cardinality                  | Unbounded custom labels                          | [MET-API-01](./phase2-paranoid-audit.md) |
| **SCAL-HF-06** | OOM / stall — large JSON bodies                  | Multi-MiB POST without 413                       | Event-loop High rows                     |
| **SCAL-HF-07** | OOM — unbounded Sonic-Boom buffer                | High RPS + slow log sink                         | FOF-LOG-01                               |
| **SCAL-HF-08** | Event-loop stall — logging on `finish`           | 503/200 storm + full log buffer                  | FOF-LOG-02, LOG-BP-03                    |
| **SCAL-HF-09** | Process crash — destination `error` on full pipe | EAGAIN storm, no handler                         | §11.3 stage 5                            |
| **SCAL-HF-10** | Cross-tenant CPU/pool DoS                        | A bulk import @ allowed RPS                      | NN-01, NN-02                             |
| **SCAL-HF-11** | Redis fail-closed **500** on all limited routes  | `REDIS_URL` blip                                 | RL-DOS-04, SH-GAP-13                     |
| **SCAL-HF-12** | Sync domain handler blocks entire process        | Heavy `publishDomainEvent` subscriber            | OB-COND-01                               |

**Not hard-fail at gate (monitored):** pool leak post-storm (`connectionLeakSuspected=false` @ 500 parallel); cold-start **>500 ms Unscalable** (§12 — readiness, not crash); FOF-LOG-03 (tail loss on SIGTERM, not OOM).

### Verdict: **CONDITIONAL**

**Ship for Phase 3 integration** with Postgres + tier-3 gates: pool storms → **503** (not hang), outbox **10k** @ **233 eps** with HTTP SLO **3.19×**, pre-TX validation off pool ([DEC-013](./phase0-audit-report.md)), fast-sink logging green ([LOG-BP-01](./phase2-paranoid-audit.md)).

**Do not scale** multi-tenant production until **SCAL-DEBT-01…06**, **SCAL-HF-01…02**, and **NN-01/02** mitigations land — uncached admin Prisma on every rate-limited request and single-thread RuleEngine CPU break before infra 503/429. Re-audit on `GET /tours` list, body-limit middleware, validation workers, 100-tenant limiter probe.

### Stress-test evidence matrix

| Spec / script                         | Stress shape                  | Pass / fail signal                                                       |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `db-pool-saturation.spec.ts`          | 100 × parallel hold, pool=10  | 503 + heartbeat ≥8                                                       |
| `pool-stress-500-parallel.ts`         | 500 × parallel hold           | 460×503, 40×200, no leak                                                 |
| `long-tx-safety.spec.ts`              | `P5_VALIDATE_DELAY_MS=500`    | Zero idle-in-TX during delay                                             |
| `noisy-neighbor-latency.spec.ts`      | 1000 validations ∥ 1 write    | Victim ratio ≤1.10                                                       |
| `noise-neighbor.spec.ts`              | 500 reads ∥ 1 write           | Write ≤4× baseline                                                       |
| `outbox-throughput.spec.ts`           | 10k seed + 20 creates ∥ relay | 233 eps; p95 ratio 3.19×                                                 |
| `outbox-relay-memory.spec.ts`         | 10k relay rows                | Heap growth ≤2× post-GC                                                  |
| `tenant-rate-limiter.spec.ts`         | 20+5 concurrent POST          | 10×201 + 10×429 (10/s limit)                                             |
| `tenant-rate-limiting.spec.ts`        | 100 burst + victim            | A throttled; B ≤2× p50                                                   |
| `cold-start-latency.spec.ts`          | Fresh engine + HTTP TTFB      | ≤1000 ms spec; **§12: 2 Unscalable @ 500 ms** (main boot + worker ready) |
| `soak-memory-leak.spec.ts`            | 50 rps × 900 s                | \|slope\| ≤0.03 MB/s                                                     |
| `log-backpressure-burst.ts`           | 1000 `/health` @ c=100        | Δ p99 +102 ms (concurrency noise)                                        |
| `validation-gate-concurrency.spec.ts` | 2 tenants parallel pre-TX     | Independent gates (HT-03)                                                |

**ID registry (deduped):** break-point/debt/hard-fail → **SCAL-\*** (this section); rate limiter DoS → **RL-DOS-\***; noisy neighbor → **NN-\***; outbox → **OB-\***; logging → **FOF-LOG-\*** / [LOG-BP-\*](./phase2-paranoid-audit.md); races → **RACE-\*** (§9); pool run → **PS-\***.

---

## Executive summary

| Area                                       | Verdict                                      | Notes                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pool saturation (DEC-012)**              | **Pass** (isolation + 503 mapping)           | Fairness gap — no per-tenant DB slot cap                                                                                                                        |
| **Pre-TX validation (DEC-013)**            | **Pass**                                     | Validation does not hold pool connections                                                                                                                       |
| **Event-loop sync CPU**                    | **Conditional pass**                         | No sync fs/crypto/zlib; **RuleEngine validation** is the dominant >10 ms risk                                                                                   |
| **JSON body/response**                     | **Gap**                                      | No enforced body size limit; large payloads can block on parse/stringify                                                                                        |
| **Logging backpressure**                   | **Fatal under slow sink**                    | **3** [Fatal Observability Flaws](#11-logging-backpressure--adversarial-sink--fatal-observability-flaws); fast stdout [LOG-BP-01](./phase2-paranoid-audit.md)   |
| **In-memory caches / OOM**                 | **Conditional pass**                         | RuleEngine + engine cache **bounded**; **7 High** Map growth paths without prod guards                                                                          |
| **Tenant rate limiter (100-ID flood)**     | **Fail — 4 DoS vulns**                       | Primary bottleneck: uncached admin Prisma `findUnique` per rate-limited request — see [§ Tenant rate limiter](#tenant-rate-limiter--100-tenant-flood-audit)     |
| **Outbox relay (10k flood)**               | **Pass** — **0 System Scalability Failures** | Relay async on same event loop; HTTP SLO holds — see [§10 Outbox relay](#10-outbox-relay--10000-event-flood-audit)                                              |
| **Noisy neighbor (A bulk → B login/read)** | **Fail** (availability)                      | **8** NN vulnerabilities — partial DEC-015/016; no CPU/pool/import quotas — see [§ Noisy Neighbor](#noisy-neighbor--tenant-a-bulk-import-vs-tenant-b-loginread) |
| **Cold-start init (§12)**                  | **Fail — Unscalable**                        | **2 Unscalable** components (>500 ms); slowest: full `main.ts` boot **p95 2084 ms**                                                                             |

**Blocker inventory (detail below):** See [Final Stress-Test Audit — ID registry](#final-stress-test-audit). Rollup: **18** event-loop rows · **28** cache components (**7 High**) · **4** RL-DOS · **8** NN · **3** FOF-LOG · **30** RACE (**6 High**) · **0** OB-SSF · **2** cold-start **Unscalable** (CS-UNSC-01, CS-UNSC-02).

---

## Database connection pool — stress integration

Condensed from [phase0-audit-report § Database connection pooling](./phase0-audit-report.md#database-connection-pooling--tenant-isolation-audit). Full mermaid, pentest refs, and recommendation list remain in phase 0.

### Architecture (capacity, not isolation)

```mermaid
flowchart LR
  subgraph app_pool["getPrisma() — DATABASE_URL"]
    HTTP[HTTP handlers] --> WTR[withTenantRls]
    HTTP --> WCT[withCanonicalTransaction]
    WTR --> GUC["set_config(..., true)"]
    WCT --> GUC
  end
  subgraph admin_pool["getPrismaAdmin()"]
    RELAY_CLAIM[outbox claim / mark done]
    REG[tenant registry reads]
  end
  subgraph app_pool_relay["getPrisma() — relay publish path"]
    RELAY_RLS[withTenantRls visibility check per row]
  end
  RELAY_CLAIM --> admin_pool
  RELAY_RLS --> app_pool
  REG --> admin_pool
```

| Stress vector                                  | Behavior under load                                                                                                   | Event-loop interaction                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 concurrent long TX (`connection_limit=10`) | 503 storm via `DB_POOL_SATURATED`                                                                                     | Pool wait is **async** (Prisma); does not sync-block CPU                                                                                                                                  |
| Pre-TX validation + `P5_VALIDATE_DELAY_MS`     | **No** connection held during delay                                                                                   | Sync validation runs **before** TX; can starve loop independently of pool                                                                                                                 |
| Outbox relay + HTTP interleave                 | **Both** pools: admin claim/done + app `withTenantRls` per row (up to `OUTBOX_RELAY_PUBLISH_CONCURRENCY`, default 16) | `setInterval` tick is `void` async — does not block accept; **sync** `publishDomainEvent` emit can block if handlers are CPU-heavy — see [§10](#10-outbox-relay--10000-event-flood-audit) |
| Noisy neighbor (DB reads)                      | `2-observability/noise-neighbor.spec.ts` — 300% SLO on reads                                                          | I/O bound, not sync CPU                                                                                                                                                                   |

### Pool stress test matrix

| Spec                                                    | Proves                                          | Pass criteria                                                    |
| ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `test/3-performance/db-pool-saturation.spec.ts`         | Global pool exhaust → 503, loop alive           | ≥8 heartbeat ticks during 100-concurrent hold storm              |
| `test/3-performance/long-tx-safety.spec.ts`             | Validation delay does not open TX               | `idle in transaction` delta 0 during `P5_VALIDATE_DELAY_MS`      |
| `test/reliability/outbox-relay-connection-leak.spec.ts` | 10k relay ops — no leak                         | Peak conns bounded; idle TX → 0 after drain                      |
| `test/3-performance/outbox-throughput.spec.ts`          | **10k** pending rows + concurrent `POST /tours` | ≥100 events/sec drain; write p95 ≤4× baseline                    |
| `test/chaos/outbox-relay-memory.spec.ts`                | 10k relay rows — heap profile                   | Post-GC growth ≤2× or ≤48 MB                                     |
| `scripts/pool-stress-500-parallel.ts`                   | **500** concurrent holds (5× gate)              | ≥1×503, no hang, no idle-in-TX leak after cooldown               |
| `scripts/reliability-outbox-relay-profile.ts`           | Wrapper for connection-leak nightly spec        | Spawns `outbox-relay-connection-leak.spec.ts` with `--expose-gc` |

### Pool ↔ event-loop coupling

Pool saturation **does not** directly block the event loop (awaited I/O). Under constant starvation, however:

1. **Queued HTTP handlers** accumulate while Prisma waits for slots — memory and timer pressure grow.
2. **Sync validation** on other requests still runs on the same thread while pool waiters are parked — [noisy-neighbor-latency.spec.ts](../test/3-performance/noisy-neighbor-latency.spec.ts) encodes this (CPU isolation gap, not pool isolation gap).
3. **`finish` logging** on completing 503/200 responses runs sync on the loop — see LOG-BP-03 in phase 2.

**Operational mitigations (pool):** Distinct `DATABASE_URL_ADMIN`; size `connection_limit`; per-tenant DB semaphore (deferred P2-5); retain gate specs in CI.

---

## Audit assumptions (event loop >10 ms)

All blockers below use these load assumptions unless a row states otherwise:

| Parameter                       | Baseline                                 | Stress                                                                                             |
| ------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Request body size**           | ~2–8 KiB JSON (starter wizard)           | **512 KiB–2 MiB** (no `maxBody` guard in `src/`)                                                   |
| **Response canonical JSON**     | ~4 KiB                                   | **256 KiB+** nested `data` trees                                                                   |
| **Concurrent validations**      | 1 per request                            | **`VALIDATION_BURST=1000`** (noisy-neighbor spec) + `P5_VALIDATION_MAX_CONCURRENT=4` scheduler cap |
| **Tour count**                  | N/A on current routes (no list endpoint) | Capacity caps: **10k/tenant**, **100k/global** — relevant only if list/bulk paths added            |
| **Tenant registry queue depth** | 1–5                                      | **50+ tenants** with deep validation queues                                                        |
| **JWT / auth**                  | RS256 verify (async via `jose`)          | Dev bearer only in test — negligible in prod                                                       |
| **Logging**                     | NDJSON ~200 B/line to stdout             | Full Sonic-Boom buffer or slow container log driver                                                |

**Grep baseline (2026-06-05):** No matches for `readFileSync`, `writeFileSync`, `execSync`, `spawnSync`, `gzipSync`, `bcrypt`, `pbkdf2Sync`, `scryptSync`, or `pino` with `sync: true`. Prisma call sites are exclusively `async`/`await`.

---

## Performance Blockers (Event Loop)

Synchronous or CPU-bound operations on request or near-request paths that **could** exceed **10 ms** under the stress assumptions above.

| File                                                                                        | Line      | Operation                                                                          | Why >10 ms possible                                                                                                                    | Severity   | Mitigation                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tours/canonical-validation.ts`](../src/tours/canonical-validation.ts)                     | 95–137    | `createCanonicalDocument` → `assertCanonicalDocument` → `engine.validateCanonical` | RuleEngine walks plugin rules synchronously; noisy-neighbor spec uses 1000 concurrent validations; single complex doc can exceed 10 ms | **High**   | Worker thread pool for validation; `runScheduledValidation` already caps concurrency — add **time budget** + 408/429; pre-compile at provision (cold-start spec) |
| [`tours/canonical-validation.ts`](../src/tours/canonical-validation.ts)                     | 77–78     | `PlatformWizardEngine.create(plugin)` on cache miss                                | Cold compile >1 s on large RuleSet ([`cold-start-latency.spec.ts`](../test/3-performance/cold-start-latency.spec.ts))                  | **High**   | Warm cache at boot/provision; expand LRU (`P5_VALIDATION_ENGINE_CACHE_SIZE`); compile in worker                                                                  |
| [`canonical/pre-transaction-validation.ts`](../src/canonical/pre-transaction-validation.ts) | 29–44     | `runScheduledValidation` → `validateCanonicalBeforePersist`                        | Scheduler yields via `setImmediate` but **validation body is sync**; victim tenant waits behind CPU burst                              | **High**   | Same as validation row; consider `worker_threads` + transferable canonical snapshot                                                                              |
| [`canonical/validation-scheduler.ts`](../src/canonical/validation-scheduler.ts)             | 90–125    | `pumpQueue` `while` + `pickTenantWithShortestQueue` scan                           | Under 50+ tenants with deep queues, sync dequeue/scan in same tick as HTTP handlers                                                    | **Medium** | Move pump tail to `setImmediate`; index shortest-queue tenant in heap                                                                                            |
| [`http/json.ts`](../src/http/json.ts)                                                       | 3–8       | `Buffer.concat(chunks).toString("utf8")`                                           | Full body buffered in memory; 512 KiB–2 MiB upload copies on loop                                                                      | **High**   | Enforce `Content-Length` max; streaming parser; reject early                                                                                                     |
| [`http/json.ts`](../src/http/json.ts)                                                       | 16        | `JSON.parse(raw)`                                                                  | V8 parse of 512 KiB–2 MiB JSON blocks loop (typically 5–50 ms depending on depth)                                                      | **High**   | Size cap; streaming JSON (`stream-json`); worker parse                                                                                                           |
| [`http/json.ts`](../src/http/json.ts)                                                       | 20        | `JSON.stringify(body)` + `res.end`                                                 | Large canonical in GET/POST response; stringify + socket write sync portion                                                            | **Medium** | Pagination/summary DTOs; stream JSON; compress (async zlib in worker)                                                                                            |
| [`tours/tours.routes.ts`](../src/tours/tours.routes.ts)                                     | 24–26, 49 | `readRequestBodyRaw` + `JSON.parse` + `hashIdempotentRequest`                      | Duplicate full-buffer read; parse before Zod; SHA-256 over raw body scales with size                                                   | **Medium** | Single parse path; pass raw hash stream; body limit                                                                                                              |
| [`tours/tours.routes.ts`](../src/tours/tours.routes.ts)                                     | 72–74     | PATCH: same parse pattern                                                          | Update with large `data` patch same cost as create                                                                                     | **Medium** | Shared body parser middleware                                                                                                                                    |
| [`tours/tours.service.ts`](../src/tours/tours.service.ts)                                   | 22, 49    | `parseCreateTourBody` / `parseUpdateTourBody` (Zod)                                | Deep nested `data` record — Zod traverses entire tree sync                                                                             | **Medium** | Limit `data` depth/size in schema; structural sharing                                                                                                            |
| [`tours/create-tour.schema.ts`](../src/tours/create-tour.schema.ts)                         | 24–28     | `safeParse` + issue `.map().join`                                                  | Huge invalid payloads generate thousands of issues                                                                                     | **Low**    | Cap issue count in error mapper                                                                                                                                  |
| [`http/http-idempotency.ts`](../src/http/http-idempotency.ts)                               | 49–51     | `createHash("sha256").update(...).digest()`                                        | Node crypto sync; ~1 ms/MiB — crosses 10 ms only at multi-MiB bodies                                                                   | **Medium** | Body size cap; incremental hash while streaming read                                                                                                             |
| [`tenant/tenant-config.routes.ts`](../src/tenant/tenant-config.routes.ts)                   | 56–61     | `JSON.stringify({ … theme })`                                                      | Large `theme` JSON from DB (feature flags, assets)                                                                                     | **Medium** | Cache config response; strip heavy theme fields from API                                                                                                         |
| [`http/request-logging.ts`](../src/http/request-logging.ts)                                 | 13–19     | `res.on("finish")` → `logHttpRequest` → `logger.info`                              | Sync `finish` callback; Sonic-Boom full buffer or slow stdout blocks ([LOG-BP-03](./phase2-paranoid-audit.md))                         | **Medium** | `setImmediate(() => logHttpRequest(...))`; explicit `pino.destination({ sync: false })`; `LOG_LEVEL=warn` under load                                             |
| [`middleware/error-interceptor.ts`](../src/middleware/error-interceptor.ts)                 | 103–114   | `logInternalServerError` — stack split/filter + `logger.error`                     | 500 storm: larger records than access logs ([LOG-BP-04](./phase2-paranoid-audit.md))                                                   | **Medium** | Sample internal errors; defer log; truncate stack                                                                                                                |
| [`middleware/error-interceptor.ts`](../src/middleware/error-interceptor.ts)                 | 57        | `sendJson` on error path                                                           | Double stringify if nested error objects grow                                                                                          | **Low**    | Fixed envelope schema                                                                                                                                            |
| [`tenant-kernel/parse-bearer.ts`](../src/tenant-kernel/parse-bearer.ts)                     | 66–80     | `Buffer.from` base64url + `JSON.parse`                                             | Test-only dev bearer — trivial size                                                                                                    | **Low**    | N/A (prod uses async JWT)                                                                                                                                        |
| [`canonical/canonical-sync-validator.ts`](../src/canonical/canonical-sync-validator.ts)     | 28        | `JSON.stringify` ×2 compare per legacy row                                         | Phase 3.4: legacy mirror empty — O(1) today; bulk sync would scale with tour count                                                     | **Low**    | Deep compare or hash-based equality if mirror returns                                                                                                            |
| [`casl/api-ability.ts`](../src/casl/api-ability.ts)                                         | 21–39     | `createApiAbility` / `buildTenantAuthz`                                            | Sync but microsecond-scale                                                                                                             | **Low**    | Cache ability per `(tenantId, role)` per request ALS                                                                                                             |

### Not flagged (reviewed, below threshold or off hot path)

| Area                                                                                                 | Finding                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Sync fs / subprocess**                                                                             | None in `src/`                                                                            |
| **bcrypt / zlib sync**                                                                               | None                                                                                      |
| **Prisma**                                                                                           | All paths async; no sync query API                                                        |
| **JWT verify**                                                                                       | `jwtVerify` async ([`parse-jwt-bearer.ts`](../src/tenant-kernel/parse-jwt-bearer.ts) L91) |
| **`randomUUID` / small SHA-256**                                                                     | Sub-ms at normal payload sizes                                                            |
| **`outbox/outbox-relay.ts` L126 `while(true)`**                                                      | Background worker; async body — not HTTP hot path                                         |
| **`storage/.../listByTenant` loops**                                                                 | No public list route; cap 10k rows would matter if exposed                                |
| **`metrics.ts` label sort**                                                                          | Bounded label cardinality                                                                 |
| **Engine cache LRU `while` ([`canonical-validation.ts`](../src/tours/canonical-validation.ts) L57)** | Max 8 entries                                                                             |

### Event-loop stress test cross-reference

| Spec                                                                                                        | What it exercises                      | >10 ms signal                                                          |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| [`test/3-performance/noisy-neighbor-latency.spec.ts`](../test/3-performance/noisy-neighbor-latency.spec.ts) | 1000 sync validations vs 1 write       | Victim write ratio >1.10 → throttling gap                              |
| [`test/1-reliability/service-starvation.spec.ts`](../test/1-reliability/service-starvation.spec.ts)         | Microtask-interleaved validation storm | Heartbeat gap > threshold                                              |
| [`test/3-performance/cold-start-latency.spec.ts`](../test/3-performance/cold-start-latency.spec.ts)         | First `validateCanonical` / `tryInit`  | >1 s compile budget                                                    |
| [`test/3-performance/db-pool-saturation.spec.ts`](../test/3-performance/db-pool-saturation.spec.ts)         | Pool storm                             | Heartbeat proves loop not **fully** stalled (validation can still lag) |
| [`scripts/log-backpressure-burst.ts`](../scripts/log-backpressure-burst.ts)                                 | 1000 sequential `logger.info`          | stdout p99 ~1 ms local — not prod log driver                           |

### Recommended priority (event loop)

1. **P0 — Request body size limit** at HTTP boundary (413) before `Buffer.concat` / `JSON.parse`.
2. **P0 — Validation offload or hard time budget** — worker thread or separate validation service; document DEC-016 scheduler as necessary but insufficient for CPU isolation.
3. **P1 — Defer access logs** off `finish` synchronous path (phase 2 LOG-BP-03).
4. **P1 — Single parse pipeline** for POST/PATCH `/tours` (route + service duplicate work).
5. **P2 — Response shaping** — avoid full canonical on list endpoints when added.
6. **P2 — Explicit Pino destination** config with `sync: false` and shutdown flush.

---

## Summary verdict

Superseded by [Final Stress-Test Audit — Verdict: CONDITIONAL](#verdict-conditional). Detail rollup:

| Dimension                                   | Status                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Pool sharing + RLS                          | **Pass**                                                                                                            |
| Pool fairness under storm                   | **503 mapped** — [SCAL-DEBT-01](#scalability-debt)                                                                  |
| Noisy neighbor (bulk import → victim reads) | **Fail** — [NN-01…08](#noisy-neighbor-vulnerability-register)                                                       |
| Outbox 10k flood                            | **Pass** — 0 [OB-SSF](#106-system-scalability-failure-assessment)                                                   |
| Rate limiter 100-ID flood                   | **Fail** — [RL-DOS-01…04](#dos-vulnerability-table)                                                                 |
| Sync I/O / crypto / fs                      | **Pass**                                                                                                            |
| RuleEngine validation CPU                   | **High risk** — [SCAL-HF-10](#hard-fail-risks)                                                                      |
| Logging backpressure                        | **Fatal (adversarial)** — [FOF-LOG-01…03](#115-fatal-observability-flaw-inventory)                                  |
| Cold-start init (>500 ms)                   | **Unscalable** — **2** findings ([CS-UNSC-01/02](#12-cold-start--service-initialization-audit)); RuleEngine path OK |

**Next audit triggers:** `GET /tours` list; body-limit middleware; validation worker; bulk-import ∥ B login/read SLO spec; 100-tenant limiter probe; slow-sink logging stress; §12 re-run on compiled `dist/main.js`.

---

## In-memory caches, RuleEngine retention, and OOM stress

**Audit date:** 2026-06-05  
**Method:** Adversarial static review — assume every `Map`/module singleton grows **without bound** unless code proves LRU, TTL, or hard cap. Integrates [Database connection pool](#database-connection-pool--stress-integration) (I/O) and [Performance Blockers (Event Loop)](#performance-blockers-event-loop) (CPU).

**Summary:** **28** in-process components inventoried · **7 High** OOM/cardinality risks · **6 Medium** · **15 Low/Info**.

### RuleEngine on the API hot path

| Stage          | Module                                   | What runs                                                              |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Ingress        | `CanonicalTourService.writeTour`         | Auth + ALS                                                             |
| Fair queue     | `runPreTransactionValidation`            | `runScheduledValidation(tenantId, …)` (DEC-016)                        |
| Engine resolve | `canonical-validation.ts`                | `getOrCreateValidationEngine(tenantId, workspaceType, variant)`        |
| Facade         | `PlatformWizardEngine` (`platform-core`) | `tryInit()` → `FieldRegistryEngine` + **`RuleEngine`**                 |
| Validate       | `engine.validateCanonical`               | `RuleEngine.createScope` → `validateCanonicalDocument`                 |
| Feature flag   | `resolve-tenant-feature-flags.ts`        | `advancedRuleEngine: false` → `variant: "basic"` (separate cache slot) |

**Packages:** `platform-core` (engine + rule cache), `workspace-sdk` (canonical/plugin types), `workspaces/starter` (**no** runtime singleton caches on hot path). **Not** on default listener: legacy `FormRuleEngine` / Denali web engines.

**Retention chain (soak target):**

```text
createTour → runScheduledValidation → getOrCreateValidationEngine (LRU 8, tenant in key)
  → PlatformWizardEngine → RuleEngine.scopeCacheByTenant (inner LRU 64 × outer LRU 128)
```

| Policy                             | Default | Env                                 |
| ---------------------------------- | ------: | ----------------------------------- |
| Inner scope LRU / tenant partition |      64 | —                                   |
| Outer tenant partitions / engine   |     128 | `RULE_ENGINE_MAX_TENANT_PARTITIONS` |
| API wizard engine instances        |       8 | `P5_VALIDATION_ENGINE_CACHE_SIZE`   |

**Evidence:** [`packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts`](../../../packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts), [`rule-cache-poisoning.spec.ts`](../../../packages/platform-core/test/1-reliability/rule-cache-poisoning.spec.ts).

**Adversarial note:** Wrong `tenantId` on `RuleContext` while reusing a tenant-scoped cached engine can populate up to **128** outer partitions on one `RuleEngine` before eviction — heap amplification, not cross-tenant bleed.

### OOM ↔ event-loop coupling

| Mechanism              | OOM risk                             | Event-loop risk                                             |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Deep `tenantQueues`    | Unbounded task closures per tenant   | Same — queued sync validations                              |
| `memoryByKey`          | Unbounded completed idempotency rows | Large stored canonical JSON                                 |
| `metricsRegistry`      | Unbounded label series               | Low CPU unless huge snapshot                                |
| Bounded RuleEngine LRU | Capped scopes                        | CPU per `validateCanonical` still High (see blockers table) |

Pool stress specs do **not** model validation CPU pile-up; run memory soak + noisy-neighbor alongside `db-pool-saturation.spec.ts`.

### Inventory — caches and module singletons

| Component                                                         | File                                                          | Growth vector                                   | TTL / LRU?                                      | Risk                           | Remediation                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| **RuleEngine** `scopeCacheByTenant`                               | `packages/platform-core/src/engine/rule.engine.ts`            | Scope keys per tenant × dimensions              | **Yes** — 64 + 128 LRU                          | **Low**                        | Align `tenantId` with engine cache key; soak after policy changes                             |
| **PlatformWizardEngine** `runtime`                                | `packages/platform-core/src/engine/platform-wizard.engine.ts` | One runtime per engine instance                 | Single slot                                     | **Low**                        | Init failures not cached                                                                      |
| **RuleEngineScope** / **RuleCellIndex** / **FieldRegistryEngine** | `platform-core/src/engine/*.ts`                               | Per scope / rule set / registry                 | Fixed at init                                   | **Low**                        | Cap rule matrix at provision                                                                  |
| **engineCache** + order                                           | `apps/api/src/tours/canonical-validation.ts`                  | `tenantId:workspace:variant`                    | **Yes** — LRU 8                                 | **Low**                        | [`soak-memory-leak.spec.ts`](../test/3-performance/soak-memory-leak.spec.ts)                  |
| **tenant-registry-cache**                                         | `apps/api/src/tenant/tenant-registry-cache.ts`                | Distinct ids / subdomains                       | **Partial** — 5s TTL, lazy delete               | **Medium**                     | Max entries + sweep; invalidate on provision                                                  |
| **validation-scheduler** `tenantQueues`                           | `apps/api/src/canonical/validation-scheduler.ts`              | Pending validations                             | **No**                                          | **High**                       | Per-tenant max depth; shed 429/503; ALS wrap ([BULK-UNSAFE-01](./phase1-aggressive-audit.md)) |
| **inFlightPerTenant**                                             | `validation-scheduler.ts`                                     | Active tenants                                  | Cap `P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT`    | **Medium**                     | —                                                                                             |
| **openGates**                                                     | `apps/api/src/canonical/pre-transaction-validation.ts`        | Open gate per tenant                            | Cleared on consume                              | **Medium**                     | `finally` on all paths; size alert                                                            |
| **memoryByKey**                                                   | `apps/api/src/http/http-idempotency.ts`                       | Idempotency keys                                | **No**                                          | **High** (memory driver)       | Prod `STORAGE_DRIVER=prisma`; TTL/LRU in dev                                                  |
| **MemoryRateLimiterStore**                                        | `apps/api/src/middleware/tenant-rate-limiter.ts`              | Per `tenantId:tier` keys in `RateLimiterMemory` | Window TTL only; **unbounded keys** (RL-DOS-02) | **High** without Redis         | Require `REDIS_URL` in prod; max-key cap or LRU prune                                         |
| **RedisRateLimiterStore** `limiters`                              | `redis-rate-limiter-store.ts`                                 | Limiter configs (not tenant keys)               | Small fixed map                                 | **Low**                        | Single shared `ioredis` client — not N connections at 100 tenants                             |
| **resolveEffectiveRateLimitForTenant**                            | `tenant-rate-limiter.ts`                                      | Admin `tenant.findUnique` per HTTP consume      | **No cache** (unlike registry)                  | **High** (RL-DOS-01/03)        | Route through `tenant-registry-cache`; negative-cache missing UUIDs                           |
| **metricsRegistry**                                               | `apps/api/src/observability/metrics.ts`                       | Metric series keys                              | **No**                                          | **High** if labels abused      | MET-API-01; bounded labels                                                                    |
| **InMemoryTourRepository**                                        | `apps/api/src/storage/in-memory-tour.repository.ts`           | Tours                                           | **Yes** — tour caps                             | **High** if prod memory driver | Fail boot without prisma                                                                      |
| **TenantHttpProxy** `cache`                                       | `apps/api/src/proxy/tenant-http-proxy.ts`                     | GET bodies                                      | **No**                                          | **Medium**                     | LRU+TTL when enabled; not wired in `main.ts`                                                  |
| **pluginById**                                                    | `apps/api/src/workspace/resolve-workspace-plugin.ts`          | Plugins                                         | Fixed at load                                   | **Info**                       | —                                                                                             |
| **JWT** `cachedPublicKey`                                         | `apps/api/src/tenant-kernel/parse-jwt-bearer.ts`              | One PEM                                         | PEM-change invalidate                           | **Info**                       | —                                                                                             |
| **domainBus** listeners                                           | `packages/platform-events/src/bus.ts`                         | Subscriptions                                   | **No** cap                                      | **Medium**                     | Unsubscribe on shutdown                                                                       |
| **Handler dedupe** `seenEventIds`                                 | `platform-events/src/bus.ts`                                  | Event ids / handler                             | **Yes** — cap 64                                | **Low**                        | DB claim in API subscriber                                                                    |
| **testSignals**                                                   | `apps/api/src/events/projection-reconciliation.ts`            | Test buffer                                     | `NODE_ENV=test` only                            | **Info**                       | —                                                                                             |
| **LegacyCanonicalAdapter** `mirror`                               | `legacy-canonical-adapter.ts`                                 | Mirrored tours                                  | **No**                                          | **Medium** (future)            | Keep mirror empty                                                                             |
| **Prisma** singletons                                             | `apps/api/src/db/prisma.ts`                                   | Connections                                     | URL `connection_limit`                          | **Medium**                     | Pool stress § above                                                                           |
| **canonical-sync-validator** map                                  | `canonical-sync-validator.ts`                                 | Per-request                                     | Request-scoped                                  | **Info**                       | —                                                                                             |
| **workspace-sdk** / **starter**                                   | —                                                             | —                                               | None on hot path                                | **Info**                       | —                                                                                             |

### Automated memory probes

| Spec                                                                                                            | Stress                                        | § relation                                                              |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| [`test/3-performance/soak-memory-leak.spec.ts`](../test/3-performance/soak-memory-leak.spec.ts)                 | Sustained HTTP/validation; post-GC heap slope | **Primary** — ALS + `engineCache` / RuleEngine retention (`RUN_SOAK=1`) |
| [`test/chaos/outbox-relay-memory.spec.ts`](../test/chaos/outbox-relay-memory.spec.ts)                           | 10k outbox relay rows                         | Background relay — not RuleEngine; no unbounded relay dedupe buffer     |
| [`rule-cache-eviction.spec.ts`](../../../packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts) | RuleEngine LRU                                | Unit proof of § caps                                                    |
| [`test/3-performance/noisy-neighbor-latency.spec.ts`](../test/3-performance/noisy-neighbor-latency.spec.ts)     | Validation storm                              | CPU + queue depth, not Map OOM                                          |
| [`test/3-performance/tenant-rate-limiter.spec.ts`](../test/3-performance/tenant-rate-limiter.spec.ts)           | **2** tenants; 20+5 burst, limit 10/s         | A: **10×201 + 10×429**; B: **5×201** — no 100-ID cardinality            |
| [`test/3-performance/tenant-rate-limiting.spec.ts`](../test/3-performance/tenant-rate-limiting.spec.ts)         | **1** attacker tenant, `RATE_BURST=100`       | Victim B ≤ **max(p50×2, 500ms)** — not multi-tenant limiter DoS         |
| [`test/2-observability/noise-neighbor.spec.ts`](../test/2-observability/noise-neighbor.spec.ts)                 | **500** GET A + POST B                        | Read limit **2/s**; throttling/fairness, not admin-pool stress          |
| [`test/3-performance/redis-rate-limiter.spec.ts`](../test/3-performance/redis-rate-limiter.spec.ts)             | Single Redis key, 2 pts/60s                   | Skipped without `REDIS_URL`                                             |

**Gap:** No spec floods `memoryByKey`, registry cache, or **rate-limiter tenant keys** with 100 unique IDs — recommend nightly adversarial Map-size + admin-pool probe.

### OOM recommendations

1. Enforce `STORAGE_DRIVER=prisma` + `REDIS_URL` in production.
2. Add per-tenant validation queue cap + global shed.
3. Registry cache proactive TTL sweep or max-size LRU.
4. Idempotency memory path: TTL + max entries (HT-08).
5. Nightly `RUN_SOAK=1` with tenant rotation after RuleEngine changes.
6. API integration test: >128 distinct `tenantId` values on one cached engine — heap must plateau.

### Section index (memory addendum)

| Section                                                                              | Topic                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| [Pool stress](#database-connection-pool--stress-integration)                         | DEC-012 / 503 / dual pool                  |
| [Event loop blockers](#performance-blockers-event-loop)                              | Sync CPU >10 ms                            |
| **This section**                                                                     | **RuleEngine + in-memory Map OOM**         |
| [Noisy neighbor](#noisy-neighbor--tenant-a-bulk-import-vs-tenant-b-loginread)        | Tenant A bulk import → Tenant B login/read |
| [§9 Race audit](#9-non-concurrent-race-audit--shared-mutable-state-between-requests) | RACE-\* inventory                          |
| [§10 Outbox](#10-outbox-relay--10000-event-flood-audit)                              | 10k flood                                  |
| [§11 Logging](#11-logging-backpressure--adversarial-sink--fatal-observability-flaws) | FOF-LOG-\*                                 |

---

## Noisy Neighbor — Tenant A bulk import vs Tenant B login/read

**Audit date:** 2026-06-05  
**Scenario:** Tenant A runs a **massive bulk import** (sustained `POST /tours` or direct `persistNewTourAtomically` batch job). Tenant B performs **login-adjacent reads**: `GET /health`, `GET /api/v2/tenant-config` (auth + registry metadata — the trunk “login/config” path), and `GET /tours/:id`.  
**Question:** Can Tenant A **block** Tenant B (503, timeout, auth failure) or only degrade latency?  
**Verdict:** **Data isolation Pass** (RLS unchanged). **Availability / latency fairness Fail** — **8** documented **Noisy Neighbor** vulnerabilities; **9** partially protected dimensions (see tables below).  
**Integrates:** [Pool stress](#database-connection-pool--stress-integration), [Event loop blockers](#performance-blockers-event-loop), [In-memory caches § validation-scheduler queues](#inventory--caches-and-module-singletons), [phase1 bulk audit](./phase1-aggressive-audit.md#bulk-writeread-cross-tenant-audit).

### Victim route inventory (Tenant B)

| Route                       | Auth                                              | Rate limit                                       | DB pool                                       | Dominant shared resource under A bulk import      |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | ------------------------------------------------- |
| `GET /health`               | None                                              | **None**                                         | None                                          | **Event loop** only (sync JSON envelope)          |
| `GET /api/v2/tenant-config` | JWT / headers → `resolveTenantContextFromRequest` | **Read tier** (`consumeTenantRateLimit("read")`) | **`getPrismaAdmin()`** on cache miss (5s TTL) | Admin pool + event loop (`JSON.stringify(theme)`) |
| `GET /tours/:id`            | Same kernel                                       | **Read tier**                                    | **`getPrisma()`** via `withTenantRls`         | App pool + event loop (response stringify)        |

There is **no dedicated login endpoint** on the trunk listener (`app.ts`); tenant-config + bearer verification is the post-auth config read that gates workspace bootstrap.

### Attack path — Tenant A bulk import

No production **`/bulk-import`** route exists ([`bulk-import-consistency.spec.ts`](../test/4-integration/bulk-import-consistency.spec.ts) calls `persistNewTourAtomically` directly). Realistic attack surfaces:

1. **HTTP abuse** — sustained `POST /tours` at write-tier RPS (default **50/s** per tenant, overridable via `theme.rateLimitRps`).
2. **Compromised worker / internal caller** — unbounded parallel `persistNewTourAtomically` (test harness uses **10** concurrent persists per chunk × **10** chunks = 100 tours/tenant with **no HTTP rate limit**).

```mermaid
sequenceDiagram
  participant A as Tenant_A_bulk
  participant EL as Node_event_loop
  participant Sched as validationScheduler
  participant AppPool as getPrisma_app_pool
  participant AdminPool as getPrismaAdmin
  participant Relay as outbox_relay
  participant B as Tenant_B_reads

  A->>Sched: N × runPreTransactionValidation
  Sched->>EL: sync validateCanonicalBeforePersist
  A->>AppPool: M × withCanonicalTransaction
  Note over AppPool: tour + audit + outbox enqueue per TX
  A->>AdminPool: outbox rows pending
  Relay->>AdminPool: claimPendingOutboxBatch SKIP LOCKED
  B->>EL: GET /health
  B->>AdminPool: tenant-config registry findUnique
  B->>AppPool: GET /tours/:id withTenantRls
  Note over EL,AdminPool: Shared process — no per-tenant CPU or pool slot quota
```

**Per-tour hot path (each import row):** `runScheduledValidation` → sync `validateCanonicalBeforePersist` → `withCanonicalTransaction` (RLS GUC + capacity `count()` ×2 + insert + audit + outbox enqueue). Validation runs **before** TX open ([DEC-013](./phase0-audit-report.md)); TX holds an app-pool connection for the full synchronous SQL batch inside the transaction callback.

### Partial protections vs gaps

| Dimension              | Partial protection (present)                                                                                                                                | Gap (noisy neighbor)                                                                                                    | Modules / evidence                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP request rate**  | Per-tenant read/write token buckets (DEC-015); theme `rateLimitRps` override                                                                                | Caps **each tenant’s own** RPS — does **not** reserve capacity for B; A can still saturate shared CPU/DB at allowed RPS | [`tenant-rate-limiter.ts`](../src/middleware/tenant-rate-limiter.ts), [`bind-request-context.ts`](../src/http/bind-request-context.ts)                     |
| **Validation CPU**     | Global cap `P5_VALIDATION_MAX_CONCURRENT=4`; per-tenant in-flight `P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT=2`; shortest-queue dequeue; `setImmediate` yields | Validation body is **sync on event loop**; **unbounded** `tenantQueues` depth per tenant; no CPU time budget            | [`validation-scheduler.ts`](../src/canonical/validation-scheduler.ts), [`validation-fairness.md`](../../../docs/phase-5/appendices/validation-fairness.md) |
| **App DB pool**        | `withPoolSaturationMapping` → **503** `DB_POOL_SATURATED` (DEC-012); RLS session per request                                                                | **Shared** `connection_limit` — **no per-tenant slot reservation**; A bulk TX storm → B `GET /tours` **503**            | [`pool-saturation.ts`](../src/db/pool-saturation.ts), [`with-canonical-transaction.ts`](../src/db/with-canonical-transaction.ts)                           |
| **Admin DB pool**      | Separate URL when `DATABASE_URL_ADMIN` set                                                                                                                  | `tenant-config` + outbox relay + registry share admin pool; A outbox flood delays B config read on cache miss           | [`resolve-registered-tenant.ts`](../src/tenant/resolve-registered-tenant.ts), [`outbox-relay.ts`](../src/outbox/outbox-relay.ts)                           |
| **Outbox relay**       | `FOR UPDATE SKIP LOCKED`; per-row `withTenantRls` publish; batch default **10**, publish concurrency **16**                                                 | **Global FIFO** claim — no per-tenant relay budget; large A backlog competes for admin connections                      | [`outbox-relay-config.ts`](../src/outbox/outbox-relay-config.ts)                                                                                           |
| **Import concurrency** | Write rate limit on HTTP path                                                                                                                               | **No** bulk-job semaphore, queue depth cap, or worker pool isolation; direct persist bypasses HTTP limits entirely      | [`bulk-import-consistency.spec.ts`](../test/4-integration/bulk-import-consistency.spec.ts) — **RLS only**, no victim SLO                                   |
| **Tour volume**        | `MAX_TOURS_PER_TENANT` default **10k**, global **100k**                                                                                                     | Capacity is a **ceiling**, not a **fair-share throttle** — import can run at max RPS until cap                          | [`assert-tour-capacity-in-tx.ts`](../src/canonical/assert-tour-capacity-in-tx.ts)                                                                          |
| **Data partition**     | RLS + ALS on all tenant routes                                                                                                                              | **Does not** protect B from **latency** or **503** under shared resource exhaustion                                     | [`bulk-import-consistency.spec.ts`](../test/4-integration/bulk-import-consistency.spec.ts)                                                                 |
| **Health probe**       | Minimal handler                                                                                                                                             | **No** priority lane — still subject to event-loop starvation                                                           | [`health.routes.ts`](../src/health/health.routes.ts)                                                                                                       |

**Protected dimensions (rollup for parent):** data isolation (RLS); per-tenant HTTP rate limits (read/write tiers); validation scheduler global + per-tenant in-flight caps; shortest-queue validation dequeue; pool saturation fail-fast 503; tour capacity ceilings; tenant registry 5s cache; dual app/admin pool (when configured); outbox SKIP LOCKED + tenant-scoped publish.

### Noisy Neighbor vulnerability register

| ID        | Severity   | Shared resource                     | Tenant B impact                                                                                        | Trigger (Tenant A)                                                                     | Mitigation (deferred / recommended)                                                                     |
| --------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **NN-01** | **High**   | Node event loop (sync RuleEngine)   | **Degraded** `GET /health`, tenant-config, `GET /tours` latency; extreme stall → effective **timeout** | Thousands of validations via bulk `POST /tours` or `runPreTransactionValidation` storm | Worker-thread validation; hard CPU time budget + 408; per-tenant validation queue **max depth** + shed  |
| **NN-02** | **High**   | App DB pool (`getPrisma`)           | **`GET /tours/:id` → 503** `DB_POOL_SATURATED`; create/update blocked                                  | Concurrent `withCanonicalTransaction` (10+ parallel TX per chunk in bulk harness)      | Per-tenant DB semaphore (P2-5); pool `connection_limit` tuning; import job concurrency cap              |
| **NN-03** | **Medium** | Admin DB pool                       | **tenant-config slow or 503** on cache miss; delayed theme/feature resolution after “login”            | A bulk import → outbox rows → relay `claimPendingOutboxBatch` + mark `done`            | Size admin pool; relay shard by `tenant_id`; extend registry cache TTL under load                       |
| **NN-04** | **Medium** | Validation scheduler `tenantQueues` | B’s `POST /tours` (if any) queued behind A’s deep FIFO; indirect delay on mixed workloads              | Unbounded enqueue while under in-flight cap                                            | Max queue depth per tenant → 429/503; metrics on queue depth                                            |
| **NN-05** | **Medium** | HTTP + persist path                 | No **bulk import quota** — A runs at full write RPS until tour cap                                     | Sustained `POST /tours`                                                                | Dedicated import API with **global + per-tenant** concurrency; lower write points for bulk content-type |
| **NN-06** | **Medium** | Outbox relay + admin pool           | Background load raises p99 on admin reads (tenant-config)                                              | 100+ tours/import × outbox enqueue                                                     | Per-tenant outbox relay budget; priority class for registry reads                                       |
| **NN-07** | **Medium** | Event loop (JSON)                   | B reads lag while A parses large POST bodies (no `maxBody`)                                            | Large canonical payloads on import                                                     | Request body size limit (413) — see [Event loop blockers](#performance-blockers-event-loop)             |
| **NN-08** | **Low**    | Health handler priority             | `GET /health` has **no** isolation — still answers unless loop fully wedged                            | Extreme CPU monolith (sync validation bypassing scheduler)                             | Priority queue or separate health worker / sidecar                                                      |

**Noisy neighbor vulnerability count:** **8** (**3 High**, **4 Medium**, **1 Low**).

**Can Tenant B be blocked?**

| Endpoint                    | Blocked (503 / hard failure)?                                     | Degraded only?    | Primary NN IDs      |
| --------------------------- | ----------------------------------------------------------------- | ----------------- | ------------------- |
| `GET /health`               | Rare (process hang)                                               | **Yes** — latency | NN-01, NN-08        |
| `GET /api/v2/tenant-config` | **Yes** — admin pool saturation or auth timeout under extreme lag | **Yes**           | NN-01, NN-03, NN-06 |
| `GET /tours/:id`            | **Yes** — app pool 503                                            | **Yes**           | NN-01, NN-02        |

Tenant B’s **read rate limit bucket is independent** of Tenant A — B is not 429’d by A’s traffic unless B exceeds its own read tier. Blocking is via **shared pool exhaustion** and **event-loop contention**, not cross-tenant rate-limit key collision.

### Test cross-reference — what is proven vs missing

| Spec                                                                                       | Tenant A noise                                      | Tenant B victim                 | Proves                                                                     | Does **not** prove                              |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| [`bulk-import-consistency.spec.ts`](../test/4-integration/bulk-import-consistency.spec.ts) | 100× `persistNewTourAtomically` (10 parallel/chunk) | Interleaved B batch (same test) | RLS partition integrity (**BULK-IMPORT-01**)                               | B login/read SLO under **one-sided** A storm    |
| [`noisy-neighbor-latency.spec.ts`](../test/3-performance/noisy-neighbor-latency.spec.ts)   | 1000× validation storm (scheduler-batched)          | 1× `createTour`                 | CPU fairness SLO ≤ **10%** over baseline (`BASELINE_RATIO_MAX=1.10`)       | HTTP GET paths; bulk TX pool hold               |
| [`noise-neighbor.spec.ts`](../test/2-observability/noise-neighbor.spec.ts)                 | 500× `GET /tours/:id`                               | 1× `POST /tours`                | Write under read noise ≤ **4×** baseline (with read limit **2/s** in test) | Bulk **import** (writes); tenant-config; health |
| [`service-starvation.spec.ts`](../test/1-reliability/service-starvation.spec.ts)           | 1200× microtask validation + sync monolith probe    | 24× concurrent writes           | Event-loop heartbeat gap; sync path **documents debt**                     | Per-route victim matrix for B reads             |
| [`db-pool-saturation.spec.ts`](../test/3-performance/db-pool-saturation.spec.ts)           | 100× long TX hold                                   | Heartbeat only                  | 503 storm + loop alive                                                     | Cross-tenant victim GET latency                 |

**Gap (recommended spec):** Nightly probe — Tenant A runs `bulk-import`-scale **HTTP** or `persistNewTourAtomically` storm while Tenant B concurrently hits `GET /health`, tenant-config, and `GET /tours/:id`; assert B success with p99 latency ceiling (extends noise-neighbor matrix to import → login/read).

### Attack scenario narrative (A → B)

1. Tenant A starts a batch job: **1000 tours**, **10 concurrent** persists (matches test harness), or max-rate `POST /tours` (**50/s** default).
2. Each row: scheduler queues validation → up to **2** in-flight validations for A globally among **4** process-wide slots → sync CPU work interleaves with B’s requests on the **same thread**.
3. Each persist opens **`withCanonicalTransaction`**, holding an app-pool connection through dual `count()` capacity checks, insert, audit append, outbox insert — under **10**-wide parallelism, a **`connection_limit=10`** pool is **fully occupied** by A.
4. Tenant B user signs in: JWT verify (async) succeeds, but **`GET /api/v2/tenant-config`** misses registry cache → **`getPrismaAdmin().tenant.findUnique`** waits behind relay **`update`** / claim transactions from A’s outbox flood (**NN-03**, **NN-06**).
5. Tenant B **`GET /tours/:id`** → **`withTenantRls`** cannot acquire connection → **503** `DB_POOL_SATURATED` (**NN-02**). Data remains isolated; user experience is **denial or severe lag**.

### Recommended priority (noisy neighbor)

1. **P0** — Per-tenant **validation queue max depth** + shed; validation **worker pool** (closes NN-01, NN-04).
2. **P0** — Per-tenant **app pool semaphore** or reserved slots for read tier (closes NN-02).
3. **P1** — Bulk import **concurrency cap** (HTTP middleware or job API) (closes NN-05).
4. **P1** — Body size limit before parse (closes NN-07; shared with event-loop P0).
5. **P2** — Outbox relay **per-tenant budget** + registry read priority (closes NN-03, NN-06).
6. **P2** — Victim SLO integration test (bulk import ∥ B login/read paths).

### Section ties

| Related §                                                                            | Link                                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Pool architecture                                                                    | [Database connection pool — stress integration](#database-connection-pool--stress-integration)              |
| Sync CPU blockers                                                                    | [Performance Blockers (Event Loop)](#performance-blockers-event-loop)                                       |
| Unbounded validation queues                                                          | [Inventory — validation-scheduler `tenantQueues`](#inventory--caches-and-module-singletons)                 |
| Rate limit design                                                                    | [`docs/phase-5/appendices/rate-limiting.md`](../../../docs/phase-5/appendices/rate-limiting.md)             |
| DEC-016 fairness                                                                     | [`docs/phase-5/appendices/validation-fairness.md`](../../../docs/phase-5/appendices/validation-fairness.md) |
| [§9 Race audit](#9-non-concurrent-race-audit--shared-mutable-state-between-requests) | **Async interleaving on module singletons**                                                                 |
| [Tenant rate limiter](#tenant-rate-limiter--100-tenant-flood-audit)                  | **100-tenant flood / RL-DOS-\***                                                                            |
| [§10 Outbox relay](#10-outbox-relay--10000-event-flood-audit)                        | **10k flood / main-path isolation**                                                                         |

---

## Tenant rate limiter — 100-tenant flood audit

**Audit date:** 2026-06-05  
**Modules:** [`tenant-rate-limiter.ts`](../src/middleware/tenant-rate-limiter.ts), [`redis-rate-limiter-store.ts`](../src/middleware/redis-rate-limiter-store.ts), [`bind-request-context.ts`](../src/http/bind-request-context.ts)  
**Tests reviewed:** `tenant-rate-limiter.spec.ts`, `tenant-rate-limiting.spec.ts`, `redis-rate-limiter.spec.ts`, `noise-neighbor.spec.ts`, `noisy-neighbor-latency.spec.ts`  
**Related:** DEC-015, [rate-limiting.md](../../../docs/phase-5/appendices/rate-limiting.md), [phase5-evolution-audit.md § Redis rate limiter](phase5-evolution-audit.md) (SH-GAP-13)

### Adversary model

Attacker floods with requests bearing **100 distinct tenant IDs** — DoS the **limiter infrastructure** (memory Maps, Redis, admin Prisma pool, per-tenant bucket creation), not merely exhaust one tenant's token bucket. In dev/test, header auth accepts arbitrary `x-tenant-id` without a DB row check at ingress.

### Architecture and HTTP integration

| Component                   | Role                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `runWithHttpRequestContext` | After auth + tenant ALS, optional `consumeTenantRateLimit(tier)` before route handler           |
| `consumeTenantRateLimit`    | `resolveEffectiveRateLimitForTenant` → `store.consume(\`${tenantId}:${tier}\`)`                 |
| `MemoryRateLimiterStore`    | Default when `REDIS_URL` unset; one `RateLimiterMemory` per `(points, durationSec)` config pair |
| `RedisRateLimiterStore`     | When `REDIS_URL` set; **single** shared `ioredis` client                                        |
| `rate-limiter-flexible` v5  | Token bucket; default **50 req/s** per tenant (`TENANT_RATE_LIMIT_POINTS=50`, `DURATION_SEC=1`) |
| Tiers                       | Independent keys: `{tenantId}:read` vs `{tenantId}:write` (P0-8)                                |

**Routes with rate limit:** `POST /tours`, `PATCH /tours/:id` → `write`; `GET /tours/:id`, tenant config → `read`.  
**Errors:** `TenantRateLimitExceededError` → **429** (`error-interceptor.ts`); Redis/DB errors on consume path → **500** (fail-closed — limits not bypassed).

```mermaid
sequenceDiagram
  participant Attacker as 100 tenant IDs
  participant Bind as runWithHttpRequestContext
  participant Resolve as resolveEffectiveRateLimitForTenant
  participant Admin as getPrismaAdmin pool
  participant Store as Memory or Redis store

  Attacker->>Bind: parallel rate-limited requests
  Bind->>Resolve: per request (no registry cache)
  Resolve->>Admin: tenant.findUnique theme
  Resolve->>Store: consume tenantId:tier
  alt over limit
    Store-->>Attacker: 429 RATE_LIMIT_EXCEEDED
  else Redis down
    Store-->>Attacker: 500 internal_error
  end
```

### Analysis — 100-tenant flood surfaces

| Surface                      | Mechanism                                                                                                                                                                                                 | At 100 tenants                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin Prisma per request** | `resolveEffectiveRateLimitForTenant` calls `getPrismaAdmin().tenant.findUnique` — **bypasses** [`tenant-registry-cache.ts`](../src/tenant/tenant-registry-cache.ts) used by `resolveRegisteredTenantById` | Up to **100 concurrent** admin-pool queries per wave before bucket check (**RL-DOS-01**)                                                                               |
| **No negative cache**        | Valid UUID shape passes `isPersistedTenantUuid`; missing rows re-query every request                                                                                                                      | Spoofed IDs amplify admin load (**RL-DOS-03**)                                                                                                                         |
| **In-memory consumer keys**  | `RateLimiterMemory` — one hash entry per `{tenantId}:{tier}` until window TTL                                                                                                                             | 100 stable tenants ≈ **200 keys** (read+write); O(1) lookup — **not** O(n) scan. **Rotating** UUIDs within 1s → linear heap growth, no store-level cap (**RL-DOS-02**) |
| **Limiter-instance Map**     | `MemoryRateLimiterStore.limiters` keyed by `points:durationSec`                                                                                                                                           | Typically **1 entry** — not per-tenant                                                                                                                                 |
| **Redis connections**        | Single `ioredis` in `RedisRateLimiterStore`                                                                                                                                                               | **Not** 100 connections                                                                                                                                                |
| **Redis key cardinality**    | `keyPrefix:ratelimit` + consumer key; TTL via library Lua                                                                                                                                                 | 100–200 keys OK; unbounded if IDs rotate continuously                                                                                                                  |
| **`consume()` cost**         | Async `limiter.consume(key, 1)`                                                                                                                                                                           | O(1) per key; does not scan all tenants                                                                                                                                |
| **Sync hot path**            | `await consume()` on request chain                                                                                                                                                                        | Does not sync-block event loop; latency = DB RTT + Redis RTT                                                                                                           |
| **Fail-closed (Redis)**      | `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`                                                                                                                                                    | Redis blip → throw → **500** on all limited routes (**RL-DOS-04**)                                                                                                     |
| **Fail-closed (ALS)**        | `requireActiveTenantId()` before consume                                                                                                                                                                  | Correct — CTX-MW-OK-02                                                                                                                                                 |

**Primary bottleneck (one line):** `resolveEffectiveRateLimitForTenant` → uncached admin Prisma `tenant.findUnique` on every rate-limited HTTP request.

Attacker need not exceed any single bucket — **one request per unique tenant ID** still triggers up to 100 admin DB lookups per wave.

### rate-limiter-flexible configuration

| Setting               | Memory store                                         | Redis store                           |
| --------------------- | ---------------------------------------------------- | ------------------------------------- |
| Algorithm             | Token bucket                                         | Token bucket                          |
| `points` / `duration` | Env + optional `tenants.theme.rateLimitRps` override | Same                                  |
| Consumer key          | `{tenantId}:{tier}`                                  | Same + Redis `keyPrefix: "ratelimit"` |
| Expiry                | Library TTL on record (`durationSec`, default 1s)    | Redis `EXPIRE` in Lua                 |
| Rejection             | `RateLimiterRes` → `TenantRateLimitExceededError`    | Same                                  |

Theme override resolution currently requires the uncached admin fetch on every consume when `DATABASE_URL` is set and tenant id is a persisted UUID.

### Existing test numbers vs 100-tenant gap

| Spec                             | Tenants            | Recorded behavior                                                               |
| -------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `tenant-rate-limiter.spec.ts`    | **2**              | Limit **10/s**; A burst **20** → **10×201 + 10×429**; B burst **5** → **5×201** |
| `tenant-rate-limiting.spec.ts`   | **2** (1 attacker) | `RATE_BURST=**100**` from tenant A only; victim B ≤ **max(p50×2, 500ms)**       |
| `noise-neighbor.spec.ts`         | **2**              | **500** parallel GET A; read cap **2/s** (`TENANT_RATE_LIMIT_READ_POINTS`)      |
| `noisy-neighbor-latency.spec.ts` | **2**              | **1000** validation tasks — **no HTTP rate limiter**; SLO **≤1.10×** baseline   |
| `redis-rate-limiter.spec.ts`     | **1** key          | **2** points / **60s** window; requires `REDIS_URL`                             |

**Gap:** No probe with **100 unique tenant IDs** on the limiter path. Two-tenant fairness does not bound admin-pool or key-cardinality cost.

### DoS vulnerability table

| ID            | Severity   | Class             | Finding                                                                                                                  |
| ------------- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **RL-DOS-01** | **High**   | DB amplification  | Uncached admin `tenant.findUnique` on every rate-limited request — unlike registry reads (5s TTL cache)                  |
| **RL-DOS-02** | **Medium** | Memory exhaustion | Unbounded `RateLimiterMemory` consumer keys when tenant IDs rotate faster than window TTL; no max-key cap at store layer |
| **RL-DOS-03** | **Medium** | DB amplification  | No negative cache for non-existent UUID tenants on theme lookup path                                                     |
| **RL-DOS-04** | **Medium** | Availability      | Redis failure → **500** fail-closed on all rate-limited routes (SH-GAP-13); limits not bypassed but service denied       |

**DoS vulnerability count: 4**

**Not vulnerable at 100 stable tenants:** O(n) Map iteration on consume (hash O(1)); Redis connection fan-out (single client); limiter-instance Map (bounded by config pairs).

### Rate limiter recommendations

1. **RL-DOS-01/03:** Route theme/RPS resolution through `tenant-registry-cache` (5s TTL) or dedicated override map; add negative-cache for unknown UUIDs.
2. **RL-DOS-02:** Cap in-memory consumer keys or require `REDIS_URL` in multi-tenant production ([OOM § MemoryRateLimiterStore](#inventory--caches-and-module-singletons)).
3. **RL-DOS-04:** Document fail-open vs fail-closed policy for Redis tier; consider bounded in-memory fallback when Redis unhealthy ([phase5-evolution-audit](phase5-evolution-audit.md)).
4. **Test gap:** Add 100-tenant probe — 100 unique IDs × concurrent requests; assert admin pool stable and limiter p95 within budget.
5. **Cross-link pool stress:** Admin pool used by rate limiter is the same `getPrismaAdmin()` singleton as registry/outbox — 100-tenant flood stacks with [pool stress](#database-connection-pool--stress-integration) under combined load.

### Cross-links (rate limiter)

- [DEC-015 — per-tenant HTTP rate limiting](../../../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md)
- [rate-limiting.md — probes and 429 contract](../../../docs/phase-5/appendices/rate-limiting.md)
- [phase5-evolution-audit.md — SH-GAP-13 Redis fail-closed](phase5-evolution-audit.md)
- [phase2-paranoid-audit.md — CTX-MW-OK-02 fail-closed ALS](phase2-paranoid-audit.md)

---

## Prisma connection pool — 500 parallel HTTP stress audit

```yaml
audit_id: phase3-pool-stress-500
date: 2026-06-05
script: apps/api/scripts/pool-stress-500-parallel.ts
baseline_gate: apps/api/test/3-performance/db-pool-saturation.spec.ts (100 concurrent)
related: DEC-012, DEC-013, connection-budget.md (P2-5)
```

**Run outcome:** **executed** (local Postgres `127.0.0.1:5434`) — **460×503** (expected DEC-012 saturation), **40×200**, **pass**, no `idle in transaction` leak after 5s cooldown.

### Components audited

| Component         | Path                                            | Role under stress                                                          |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| Prisma singleton  | `src/db/prisma.ts`                              | Single `getPrisma()` pool; sizing via `DATABASE_URL` query params only     |
| Saturation mapper | `src/db/pool-saturation.ts`                     | Regex → `DB_POOL_SATURATED:` → HTTP 503; test `P5_DB_HOLD_MS` + `pg_sleep` |
| RLS wrapper       | `src/db/with-tenant-rls.ts`                     | `$transaction` + GUC bootstrap + optional hold                             |
| Probe route       | `src/routes/internal/db-pool-hold.ts`           | `GET /internal/test/db-pool-hold` — `NODE_ENV=test` only                   |
| Gate test         | `test/3-performance/db-pool-saturation.spec.ts` | 100 concurrent — CI DEC-012 gate                                           |

**Observability gap:** `metrics.ts` has no pool wait histogram; stress script samples `pg_stat_activity` for `usename=app_tour`.

### Methodology

1. Pin `connection_limit=10`, `pool_timeout=1` on `DATABASE_URL`.
2. Set `P5_DB_HOLD_MS=250`, `NODE_ENV=test`, `STORAGE_DRIVER=prisma`.
3. In-process HTTP server; **500** parallel `GET /internal/test/db-pool-hold`.
4. Sample connections at start, peak (50ms interval), and +5s post-storm.
5. Record every non-200 response.

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=10&pool_timeout=1' \
  DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
  P5_DB_HOLD_MS=250 \
  npx tsx scripts/pool-stress-500-parallel.ts
```

### Execution results

| Field                | Value    |
| -------------------- | -------- |
| Verdict              | **pass** |
| Concurrent           | 500      |
| Hold ms              | 250      |
| Pool limit / timeout | 10 / 1s  |
| Storm duration       | 2439.4ms |
| Max request duration | 2411.4ms |
| Heartbeat ticks      | 56       |
| Hung                 | false    |

| HTTP outcome                | Count |
| --------------------------- | ----: |
| 200                         |    40 |
| 503 (`service_unavailable`) |   460 |
| Other HTTP                  |     0 |
| Transport errors            |     0 |
| Client timeouts             |     0 |

**503 latency (ms):** min 1777.1, max 2233.2, avg 2198.5.

| `pg_stat_activity` phase | total | active | idle | idle in TX |
| ------------------------ | ----: | -----: | ---: | ---------: |
| Start                    |    16 |      0 |   16 |          0 |
| Peak                     |    26 |      0 |    0 |         26 |
| After 5s cooldown        |    26 |      0 |   26 |          0 |

**Leak check:** `connectionLeakSuspected=false`. Post-cooldown idle backends (26) are Prisma pool cache — not `idle in transaction`. Do not fail on idle count alone.

### Adversarial analysis — assumed connection leak

| Vector                               | 500-parallel result                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Long TX (`pg_sleep` in hold route)   | Peak 26 `idle in transaction` during storm; **0** after cooldown            |
| Missing `disconnectPrisma`           | Script calls disconnect in `finally`; pool drains to idle cache             |
| Single-tenant parallel amplification | All 500 requests one tenant — global pool only backpressure (P2-5 deferred) |
| Unmapped pool errors                 | **0** HTTP 500 from pool; all saturation → 503                              |
| Event-loop stall                     | 56 heartbeat ticks — loop responsive                                        |

### Pool stress findings (this run)

| ID    | Severity | Finding                                                              |
| ----- | -------- | -------------------------------------------------------------------- |
| PS-01 | Info     | 500 concurrent completes in ~2.4s — 5× gate load, same 503 semantics |
| PS-02 | Medium   | No per-tenant DB semaphore — one tenant can exhaust global pool      |
| PS-03 | Info     | ~8% acquire success (40/500) with hold=250ms, pool=10                |
| PS-04 | Info     | Dual Prisma singleton (app + admin) not stressed by hold route       |

### Failure log — every non-200 (460 entries)

All failures are expected `503_db_pool_saturated` (`DB_POOL_SATURATED` → `service_unavailable`). No transport errors, client timeouts, or unexpected HTTP statuses.

| Index | Kind                  | HTTP | Duration (ms) | Detail                                                       |
| ----- | --------------------- | ---- | ------------- | ------------------------------------------------------------ |
| 1     | 503_db_pool_saturated | 503  | 2060.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 2     | 503_db_pool_saturated | 503  | 2062          | 503 service_unavailable body={"error":"service_unavailable"} |
| 3     | 503_db_pool_saturated | 503  | 2063.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 4     | 503_db_pool_saturated | 503  | 2064.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 5     | 503_db_pool_saturated | 503  | 2067.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 6     | 503_db_pool_saturated | 503  | 2070.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 7     | 503_db_pool_saturated | 503  | 2069.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 8     | 503_db_pool_saturated | 503  | 2069          | 503 service_unavailable body={"error":"service_unavailable"} |
| 9     | 503_db_pool_saturated | 503  | 2069.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 41    | 503_db_pool_saturated | 503  | 2060.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 42    | 503_db_pool_saturated | 503  | 2060.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 43    | 503_db_pool_saturated | 503  | 2060.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 44    | 503_db_pool_saturated | 503  | 2060.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 49    | 503_db_pool_saturated | 503  | 2060.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 53    | 503_db_pool_saturated | 503  | 2059.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 54    | 503_db_pool_saturated | 503  | 2059.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 56    | 503_db_pool_saturated | 503  | 1777.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 57    | 503_db_pool_saturated | 503  | 2059.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 58    | 503_db_pool_saturated | 503  | 2103.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 59    | 503_db_pool_saturated | 503  | 2103.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 60    | 503_db_pool_saturated | 503  | 2103.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 61    | 503_db_pool_saturated | 503  | 2103.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 62    | 503_db_pool_saturated | 503  | 2110.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 63    | 503_db_pool_saturated | 503  | 2110.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 64    | 503_db_pool_saturated | 503  | 2110.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 65    | 503_db_pool_saturated | 503  | 2117.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 66    | 503_db_pool_saturated | 503  | 2117.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 67    | 503_db_pool_saturated | 503  | 2117.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 68    | 503_db_pool_saturated | 503  | 2119.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 69    | 503_db_pool_saturated | 503  | 2122.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 70    | 503_db_pool_saturated | 503  | 2122.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 71    | 503_db_pool_saturated | 503  | 2122.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 72    | 503_db_pool_saturated | 503  | 2122.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 73    | 503_db_pool_saturated | 503  | 2122.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 74    | 503_db_pool_saturated | 503  | 2122.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 75    | 503_db_pool_saturated | 503  | 2122.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 76    | 503_db_pool_saturated | 503  | 2122.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 77    | 503_db_pool_saturated | 503  | 2122.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 78    | 503_db_pool_saturated | 503  | 2122          | 503 service_unavailable body={"error":"service_unavailable"} |
| 79    | 503_db_pool_saturated | 503  | 2121.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 80    | 503_db_pool_saturated | 503  | 2122          | 503 service_unavailable body={"error":"service_unavailable"} |
| 81    | 503_db_pool_saturated | 503  | 2122          | 503 service_unavailable body={"error":"service_unavailable"} |
| 82    | 503_db_pool_saturated | 503  | 2121.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 83    | 503_db_pool_saturated | 503  | 2125.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 84    | 503_db_pool_saturated | 503  | 2125.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 85    | 503_db_pool_saturated | 503  | 2125.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 86    | 503_db_pool_saturated | 503  | 2125.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 87    | 503_db_pool_saturated | 503  | 2124.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 88    | 503_db_pool_saturated | 503  | 2124.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 89    | 503_db_pool_saturated | 503  | 2124.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 90    | 503_db_pool_saturated | 503  | 2124.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 91    | 503_db_pool_saturated | 503  | 2124.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 92    | 503_db_pool_saturated | 503  | 2124.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 93    | 503_db_pool_saturated | 503  | 2124.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 94    | 503_db_pool_saturated | 503  | 2124          | 503 service_unavailable body={"error":"service_unavailable"} |
| 95    | 503_db_pool_saturated | 503  | 2123.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 96    | 503_db_pool_saturated | 503  | 2123.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 97    | 503_db_pool_saturated | 503  | 2123.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 98    | 503_db_pool_saturated | 503  | 2133.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 99    | 503_db_pool_saturated | 503  | 2133.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 100   | 503_db_pool_saturated | 503  | 2140.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 101   | 503_db_pool_saturated | 503  | 2140.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 102   | 503_db_pool_saturated | 503  | 2140.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 103   | 503_db_pool_saturated | 503  | 2140.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 104   | 503_db_pool_saturated | 503  | 2140.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 105   | 503_db_pool_saturated | 503  | 2140.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 106   | 503_db_pool_saturated | 503  | 2140.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 107   | 503_db_pool_saturated | 503  | 2140.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 108   | 503_db_pool_saturated | 503  | 2140.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 109   | 503_db_pool_saturated | 503  | 2140.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 110   | 503_db_pool_saturated | 503  | 2140.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 111   | 503_db_pool_saturated | 503  | 2140.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 112   | 503_db_pool_saturated | 503  | 2140          | 503 service_unavailable body={"error":"service_unavailable"} |
| 113   | 503_db_pool_saturated | 503  | 2139.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 114   | 503_db_pool_saturated | 503  | 2146.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 115   | 503_db_pool_saturated | 503  | 2146.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 116   | 503_db_pool_saturated | 503  | 2146.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 117   | 503_db_pool_saturated | 503  | 2146.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 118   | 503_db_pool_saturated | 503  | 2146.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 119   | 503_db_pool_saturated | 503  | 2163.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 120   | 503_db_pool_saturated | 503  | 2181.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 121   | 503_db_pool_saturated | 503  | 2181.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 122   | 503_db_pool_saturated | 503  | 2181.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 123   | 503_db_pool_saturated | 503  | 2181.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 124   | 503_db_pool_saturated | 503  | 2181.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 125   | 503_db_pool_saturated | 503  | 2181.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 126   | 503_db_pool_saturated | 503  | 2181.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 127   | 503_db_pool_saturated | 503  | 2193.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 128   | 503_db_pool_saturated | 503  | 2194.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 129   | 503_db_pool_saturated | 503  | 2194.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 130   | 503_db_pool_saturated | 503  | 2194.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 131   | 503_db_pool_saturated | 503  | 2194.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 132   | 503_db_pool_saturated | 503  | 2194.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 133   | 503_db_pool_saturated | 503  | 2194.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 134   | 503_db_pool_saturated | 503  | 2194.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 135   | 503_db_pool_saturated | 503  | 2194.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 136   | 503_db_pool_saturated | 503  | 2193.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 137   | 503_db_pool_saturated | 503  | 2193.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 138   | 503_db_pool_saturated | 503  | 2193.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 139   | 503_db_pool_saturated | 503  | 2193.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 140   | 503_db_pool_saturated | 503  | 2193.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 141   | 503_db_pool_saturated | 503  | 2193.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 142   | 503_db_pool_saturated | 503  | 2195.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 143   | 503_db_pool_saturated | 503  | 2195.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 144   | 503_db_pool_saturated | 503  | 2195.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 145   | 503_db_pool_saturated | 503  | 2195.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 146   | 503_db_pool_saturated | 503  | 2195.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 147   | 503_db_pool_saturated | 503  | 2195.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 148   | 503_db_pool_saturated | 503  | 2195.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 149   | 503_db_pool_saturated | 503  | 2213.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 150   | 503_db_pool_saturated | 503  | 2214          | 503 service_unavailable body={"error":"service_unavailable"} |
| 151   | 503_db_pool_saturated | 503  | 2214.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 152   | 503_db_pool_saturated | 503  | 2214.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 153   | 503_db_pool_saturated | 503  | 2214.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 154   | 503_db_pool_saturated | 503  | 2214.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 155   | 503_db_pool_saturated | 503  | 2214.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 156   | 503_db_pool_saturated | 503  | 2217.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 157   | 503_db_pool_saturated | 503  | 2217.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 158   | 503_db_pool_saturated | 503  | 2217.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 159   | 503_db_pool_saturated | 503  | 2217.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 160   | 503_db_pool_saturated | 503  | 2217.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 161   | 503_db_pool_saturated | 503  | 2217.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 162   | 503_db_pool_saturated | 503  | 2217.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 163   | 503_db_pool_saturated | 503  | 2217.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 164   | 503_db_pool_saturated | 503  | 2217.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 165   | 503_db_pool_saturated | 503  | 2217.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 166   | 503_db_pool_saturated | 503  | 2216.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 167   | 503_db_pool_saturated | 503  | 2216.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 168   | 503_db_pool_saturated | 503  | 2216.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 169   | 503_db_pool_saturated | 503  | 2216.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 170   | 503_db_pool_saturated | 503  | 2216.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 171   | 503_db_pool_saturated | 503  | 2216.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 172   | 503_db_pool_saturated | 503  | 2219.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 173   | 503_db_pool_saturated | 503  | 2219.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 174   | 503_db_pool_saturated | 503  | 2219.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 175   | 503_db_pool_saturated | 503  | 2219.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 176   | 503_db_pool_saturated | 503  | 2219.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 177   | 503_db_pool_saturated | 503  | 2219.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 178   | 503_db_pool_saturated | 503  | 2219.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 179   | 503_db_pool_saturated | 503  | 2219.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 180   | 503_db_pool_saturated | 503  | 2219          | 503 service_unavailable body={"error":"service_unavailable"} |
| 181   | 503_db_pool_saturated | 503  | 2218.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 182   | 503_db_pool_saturated | 503  | 2218.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 183   | 503_db_pool_saturated | 503  | 2218.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 184   | 503_db_pool_saturated | 503  | 2218.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 185   | 503_db_pool_saturated | 503  | 2218.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 186   | 503_db_pool_saturated | 503  | 2218.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 187   | 503_db_pool_saturated | 503  | 2224.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 188   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 189   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 190   | 503_db_pool_saturated | 503  | 2222          | 503 service_unavailable body={"error":"service_unavailable"} |
| 191   | 503_db_pool_saturated | 503  | 2222          | 503 service_unavailable body={"error":"service_unavailable"} |
| 192   | 503_db_pool_saturated | 503  | 2221.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 193   | 503_db_pool_saturated | 503  | 2221.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 194   | 503_db_pool_saturated | 503  | 2221.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 195   | 503_db_pool_saturated | 503  | 2221.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 196   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 197   | 503_db_pool_saturated | 503  | 2221.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 198   | 503_db_pool_saturated | 503  | 2221.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 199   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 200   | 503_db_pool_saturated | 503  | 2220.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 201   | 503_db_pool_saturated | 503  | 2220.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 202   | 503_db_pool_saturated | 503  | 2220.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 203   | 503_db_pool_saturated | 503  | 2220.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 204   | 503_db_pool_saturated | 503  | 2220.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 205   | 503_db_pool_saturated | 503  | 2220.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 206   | 503_db_pool_saturated | 503  | 2222          | 503 service_unavailable body={"error":"service_unavailable"} |
| 207   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 208   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 209   | 503_db_pool_saturated | 503  | 2222.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 210   | 503_db_pool_saturated | 503  | 2222.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 211   | 503_db_pool_saturated | 503  | 2223.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 212   | 503_db_pool_saturated | 503  | 2224          | 503 service_unavailable body={"error":"service_unavailable"} |
| 213   | 503_db_pool_saturated | 503  | 2224          | 503 service_unavailable body={"error":"service_unavailable"} |
| 214   | 503_db_pool_saturated | 503  | 2223.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 215   | 503_db_pool_saturated | 503  | 2223.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 216   | 503_db_pool_saturated | 503  | 2223.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 217   | 503_db_pool_saturated | 503  | 2223.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 218   | 503_db_pool_saturated | 503  | 2225.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 219   | 503_db_pool_saturated | 503  | 2225.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 220   | 503_db_pool_saturated | 503  | 2225.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 221   | 503_db_pool_saturated | 503  | 2225.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 222   | 503_db_pool_saturated | 503  | 2225.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 223   | 503_db_pool_saturated | 503  | 2225.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 224   | 503_db_pool_saturated | 503  | 2225.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 225   | 503_db_pool_saturated | 503  | 2225.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 226   | 503_db_pool_saturated | 503  | 2225.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 227   | 503_db_pool_saturated | 503  | 2225.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 228   | 503_db_pool_saturated | 503  | 2225          | 503 service_unavailable body={"error":"service_unavailable"} |
| 229   | 503_db_pool_saturated | 503  | 2224.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 230   | 503_db_pool_saturated | 503  | 2224.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 231   | 503_db_pool_saturated | 503  | 2224.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 232   | 503_db_pool_saturated | 503  | 2224.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 233   | 503_db_pool_saturated | 503  | 2224.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 234   | 503_db_pool_saturated | 503  | 2224.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 235   | 503_db_pool_saturated | 503  | 2224.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 236   | 503_db_pool_saturated | 503  | 2224.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 237   | 503_db_pool_saturated | 503  | 2224.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 238   | 503_db_pool_saturated | 503  | 2232.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 239   | 503_db_pool_saturated | 503  | 2232.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 240   | 503_db_pool_saturated | 503  | 2232.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 241   | 503_db_pool_saturated | 503  | 2232.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 242   | 503_db_pool_saturated | 503  | 2232.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 243   | 503_db_pool_saturated | 503  | 2232.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 244   | 503_db_pool_saturated | 503  | 2232.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 245   | 503_db_pool_saturated | 503  | 2232.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 246   | 503_db_pool_saturated | 503  | 2232          | 503 service_unavailable body={"error":"service_unavailable"} |
| 247   | 503_db_pool_saturated | 503  | 2231.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 248   | 503_db_pool_saturated | 503  | 2228.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 249   | 503_db_pool_saturated | 503  | 2228.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 250   | 503_db_pool_saturated | 503  | 2228.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 251   | 503_db_pool_saturated | 503  | 2228.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 252   | 503_db_pool_saturated | 503  | 2228          | 503 service_unavailable body={"error":"service_unavailable"} |
| 253   | 503_db_pool_saturated | 503  | 2232.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 254   | 503_db_pool_saturated | 503  | 2233.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 255   | 503_db_pool_saturated | 503  | 2233.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 256   | 503_db_pool_saturated | 503  | 2233.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 257   | 503_db_pool_saturated | 503  | 2233          | 503 service_unavailable body={"error":"service_unavailable"} |
| 258   | 503_db_pool_saturated | 503  | 2232.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 259   | 503_db_pool_saturated | 503  | 2231.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 260   | 503_db_pool_saturated | 503  | 2231.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 261   | 503_db_pool_saturated | 503  | 2231.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 262   | 503_db_pool_saturated | 503  | 2231.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 263   | 503_db_pool_saturated | 503  | 2230.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 264   | 503_db_pool_saturated | 503  | 2230.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 265   | 503_db_pool_saturated | 503  | 2230.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 266   | 503_db_pool_saturated | 503  | 2230          | 503 service_unavailable body={"error":"service_unavailable"} |
| 267   | 503_db_pool_saturated | 503  | 2230.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 268   | 503_db_pool_saturated | 503  | 2230.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 269   | 503_db_pool_saturated | 503  | 2230.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 270   | 503_db_pool_saturated | 503  | 2227.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 271   | 503_db_pool_saturated | 503  | 2226.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 272   | 503_db_pool_saturated | 503  | 2226.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 273   | 503_db_pool_saturated | 503  | 2226.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 274   | 503_db_pool_saturated | 503  | 2226.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 275   | 503_db_pool_saturated | 503  | 2230.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 276   | 503_db_pool_saturated | 503  | 2227.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 277   | 503_db_pool_saturated | 503  | 2227.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 278   | 503_db_pool_saturated | 503  | 2228          | 503 service_unavailable body={"error":"service_unavailable"} |
| 279   | 503_db_pool_saturated | 503  | 2228          | 503 service_unavailable body={"error":"service_unavailable"} |
| 280   | 503_db_pool_saturated | 503  | 2227.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 281   | 503_db_pool_saturated | 503  | 2227.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 282   | 503_db_pool_saturated | 503  | 2224.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 283   | 503_db_pool_saturated | 503  | 2226.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 284   | 503_db_pool_saturated | 503  | 2226.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 285   | 503_db_pool_saturated | 503  | 2222.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 286   | 503_db_pool_saturated | 503  | 2222.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 287   | 503_db_pool_saturated | 503  | 2222.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 288   | 503_db_pool_saturated | 503  | 2222.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 289   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 290   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 291   | 503_db_pool_saturated | 503  | 2222.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 292   | 503_db_pool_saturated | 503  | 2222.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 293   | 503_db_pool_saturated | 503  | 2222.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 294   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 295   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 296   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 297   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 298   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 299   | 503_db_pool_saturated | 503  | 2221.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 300   | 503_db_pool_saturated | 503  | 2221.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 301   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 302   | 503_db_pool_saturated | 503  | 2220.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 303   | 503_db_pool_saturated | 503  | 2220.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 304   | 503_db_pool_saturated | 503  | 2220.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 305   | 503_db_pool_saturated | 503  | 2220.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 306   | 503_db_pool_saturated | 503  | 2220.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 307   | 503_db_pool_saturated | 503  | 2220.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 308   | 503_db_pool_saturated | 503  | 2220.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 309   | 503_db_pool_saturated | 503  | 2220.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 310   | 503_db_pool_saturated | 503  | 2220.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 311   | 503_db_pool_saturated | 503  | 2220.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 312   | 503_db_pool_saturated | 503  | 2220.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 313   | 503_db_pool_saturated | 503  | 2220          | 503 service_unavailable body={"error":"service_unavailable"} |
| 314   | 503_db_pool_saturated | 503  | 2219.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 315   | 503_db_pool_saturated | 503  | 2219.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 316   | 503_db_pool_saturated | 503  | 2219.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 317   | 503_db_pool_saturated | 503  | 2219.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 318   | 503_db_pool_saturated | 503  | 2219.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 319   | 503_db_pool_saturated | 503  | 2219.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 320   | 503_db_pool_saturated | 503  | 2219.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 321   | 503_db_pool_saturated | 503  | 2219.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 322   | 503_db_pool_saturated | 503  | 2219.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 323   | 503_db_pool_saturated | 503  | 2219.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 324   | 503_db_pool_saturated | 503  | 2219.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 325   | 503_db_pool_saturated | 503  | 2219.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 326   | 503_db_pool_saturated | 503  | 2219.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 327   | 503_db_pool_saturated | 503  | 2219          | 503 service_unavailable body={"error":"service_unavailable"} |
| 328   | 503_db_pool_saturated | 503  | 2218.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 329   | 503_db_pool_saturated | 503  | 2218.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 330   | 503_db_pool_saturated | 503  | 2218.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 331   | 503_db_pool_saturated | 503  | 2218.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 332   | 503_db_pool_saturated | 503  | 2218.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 333   | 503_db_pool_saturated | 503  | 2218.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 334   | 503_db_pool_saturated | 503  | 2222.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 335   | 503_db_pool_saturated | 503  | 2222.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 336   | 503_db_pool_saturated | 503  | 2222.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 337   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 338   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 339   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 340   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 341   | 503_db_pool_saturated | 503  | 2222.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 342   | 503_db_pool_saturated | 503  | 2222.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 343   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 344   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 345   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 346   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 347   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 348   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 349   | 503_db_pool_saturated | 503  | 2222.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 350   | 503_db_pool_saturated | 503  | 2222.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 351   | 503_db_pool_saturated | 503  | 2222.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 352   | 503_db_pool_saturated | 503  | 2222.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 353   | 503_db_pool_saturated | 503  | 2222.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 354   | 503_db_pool_saturated | 503  | 2222.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 355   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 356   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 357   | 503_db_pool_saturated | 503  | 2222.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 358   | 503_db_pool_saturated | 503  | 2222.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 359   | 503_db_pool_saturated | 503  | 2222.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 360   | 503_db_pool_saturated | 503  | 2222.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 361   | 503_db_pool_saturated | 503  | 2222.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 362   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 363   | 503_db_pool_saturated | 503  | 2222.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 364   | 503_db_pool_saturated | 503  | 2222.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 365   | 503_db_pool_saturated | 503  | 2222          | 503 service_unavailable body={"error":"service_unavailable"} |
| 366   | 503_db_pool_saturated | 503  | 2221.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 367   | 503_db_pool_saturated | 503  | 2221.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 368   | 503_db_pool_saturated | 503  | 2221.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 369   | 503_db_pool_saturated | 503  | 2221.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 370   | 503_db_pool_saturated | 503  | 2221.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 371   | 503_db_pool_saturated | 503  | 2221.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 372   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 373   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 374   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 375   | 503_db_pool_saturated | 503  | 2221.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 376   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 377   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 378   | 503_db_pool_saturated | 503  | 2220.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 379   | 503_db_pool_saturated | 503  | 2220.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 380   | 503_db_pool_saturated | 503  | 2220.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 381   | 503_db_pool_saturated | 503  | 2220.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 382   | 503_db_pool_saturated | 503  | 2220.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 383   | 503_db_pool_saturated | 503  | 2220.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 384   | 503_db_pool_saturated | 503  | 2220.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 385   | 503_db_pool_saturated | 503  | 2220.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 386   | 503_db_pool_saturated | 503  | 2220.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 387   | 503_db_pool_saturated | 503  | 2220.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 388   | 503_db_pool_saturated | 503  | 2218.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 389   | 503_db_pool_saturated | 503  | 2218.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 390   | 503_db_pool_saturated | 503  | 2218.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 391   | 503_db_pool_saturated | 503  | 2218.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 392   | 503_db_pool_saturated | 503  | 2218.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 393   | 503_db_pool_saturated | 503  | 2218.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 394   | 503_db_pool_saturated | 503  | 2218.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 395   | 503_db_pool_saturated | 503  | 2218.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 396   | 503_db_pool_saturated | 503  | 2218.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 397   | 503_db_pool_saturated | 503  | 2218          | 503 service_unavailable body={"error":"service_unavailable"} |
| 398   | 503_db_pool_saturated | 503  | 2217.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 399   | 503_db_pool_saturated | 503  | 2217.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 400   | 503_db_pool_saturated | 503  | 2217.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 401   | 503_db_pool_saturated | 503  | 2217.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 402   | 503_db_pool_saturated | 503  | 2217.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 403   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 404   | 503_db_pool_saturated | 503  | 2217.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 405   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 406   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 407   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 408   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 409   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 410   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 411   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 412   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 413   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 414   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 415   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 416   | 503_db_pool_saturated | 503  | 2221.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 417   | 503_db_pool_saturated | 503  | 2221.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 418   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 419   | 503_db_pool_saturated | 503  | 2221          | 503 service_unavailable body={"error":"service_unavailable"} |
| 420   | 503_db_pool_saturated | 503  | 2221.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 421   | 503_db_pool_saturated | 503  | 2221.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 422   | 503_db_pool_saturated | 503  | 2221.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 423   | 503_db_pool_saturated | 503  | 2221.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 424   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 425   | 503_db_pool_saturated | 503  | 2221.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 426   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 427   | 503_db_pool_saturated | 503  | 2221.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 428   | 503_db_pool_saturated | 503  | 2221.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 429   | 503_db_pool_saturated | 503  | 2221.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 430   | 503_db_pool_saturated | 503  | 2221.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 431   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 432   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 433   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 434   | 503_db_pool_saturated | 503  | 2217.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 435   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 436   | 503_db_pool_saturated | 503  | 2217.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 437   | 503_db_pool_saturated | 503  | 2217.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 438   | 503_db_pool_saturated | 503  | 2217.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 439   | 503_db_pool_saturated | 503  | 2208          | 503 service_unavailable body={"error":"service_unavailable"} |
| 440   | 503_db_pool_saturated | 503  | 2207.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 441   | 503_db_pool_saturated | 503  | 2207.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 442   | 503_db_pool_saturated | 503  | 2210.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 443   | 503_db_pool_saturated | 503  | 2210.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 444   | 503_db_pool_saturated | 503  | 2210.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 445   | 503_db_pool_saturated | 503  | 2214.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 446   | 503_db_pool_saturated | 503  | 2214.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 447   | 503_db_pool_saturated | 503  | 2211.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 448   | 503_db_pool_saturated | 503  | 2208.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 449   | 503_db_pool_saturated | 503  | 2208.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 450   | 503_db_pool_saturated | 503  | 2210.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 451   | 503_db_pool_saturated | 503  | 2209.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 452   | 503_db_pool_saturated | 503  | 2209.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 453   | 503_db_pool_saturated | 503  | 2208.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 454   | 503_db_pool_saturated | 503  | 2208.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 455   | 503_db_pool_saturated | 503  | 2208.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 456   | 503_db_pool_saturated | 503  | 2208.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 457   | 503_db_pool_saturated | 503  | 2207          | 503 service_unavailable body={"error":"service_unavailable"} |
| 458   | 503_db_pool_saturated | 503  | 2206.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 459   | 503_db_pool_saturated | 503  | 2206.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 460   | 503_db_pool_saturated | 503  | 2206.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 461   | 503_db_pool_saturated | 503  | 2205.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 462   | 503_db_pool_saturated | 503  | 2205.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 463   | 503_db_pool_saturated | 503  | 2205.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 464   | 503_db_pool_saturated | 503  | 2205.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 465   | 503_db_pool_saturated | 503  | 2205.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 466   | 503_db_pool_saturated | 503  | 2205          | 503 service_unavailable body={"error":"service_unavailable"} |
| 467   | 503_db_pool_saturated | 503  | 2205          | 503 service_unavailable body={"error":"service_unavailable"} |
| 468   | 503_db_pool_saturated | 503  | 2205.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 469   | 503_db_pool_saturated | 503  | 2205.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 470   | 503_db_pool_saturated | 503  | 2205.6        | 503 service_unavailable body={"error":"service_unavailable"} |
| 471   | 503_db_pool_saturated | 503  | 2205.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 472   | 503_db_pool_saturated | 503  | 2205.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 473   | 503_db_pool_saturated | 503  | 2205.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 474   | 503_db_pool_saturated | 503  | 2205          | 503 service_unavailable body={"error":"service_unavailable"} |
| 475   | 503_db_pool_saturated | 503  | 2204.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 476   | 503_db_pool_saturated | 503  | 2204.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 477   | 503_db_pool_saturated | 503  | 2204.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 478   | 503_db_pool_saturated | 503  | 2203.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 479   | 503_db_pool_saturated | 503  | 2203.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 480   | 503_db_pool_saturated | 503  | 2202.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 481   | 503_db_pool_saturated | 503  | 2202.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 482   | 503_db_pool_saturated | 503  | 2202.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 483   | 503_db_pool_saturated | 503  | 2202.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 484   | 503_db_pool_saturated | 503  | 2202.1        | 503 service_unavailable body={"error":"service_unavailable"} |
| 485   | 503_db_pool_saturated | 503  | 2202          | 503 service_unavailable body={"error":"service_unavailable"} |
| 486   | 503_db_pool_saturated | 503  | 2201.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 487   | 503_db_pool_saturated | 503  | 2201.8        | 503 service_unavailable body={"error":"service_unavailable"} |
| 488   | 503_db_pool_saturated | 503  | 2201.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 489   | 503_db_pool_saturated | 503  | 2201.5        | 503 service_unavailable body={"error":"service_unavailable"} |
| 490   | 503_db_pool_saturated | 503  | 2201.4        | 503 service_unavailable body={"error":"service_unavailable"} |
| 491   | 503_db_pool_saturated | 503  | 2201.3        | 503 service_unavailable body={"error":"service_unavailable"} |
| 492   | 503_db_pool_saturated | 503  | 2201.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 493   | 503_db_pool_saturated | 503  | 2201.2        | 503 service_unavailable body={"error":"service_unavailable"} |
| 494   | 503_db_pool_saturated | 503  | 2201          | 503 service_unavailable body={"error":"service_unavailable"} |
| 495   | 503_db_pool_saturated | 503  | 2201          | 503 service_unavailable body={"error":"service_unavailable"} |
| 496   | 503_db_pool_saturated | 503  | 2200.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 497   | 503_db_pool_saturated | 503  | 2200.9        | 503 service_unavailable body={"error":"service_unavailable"} |
| 498   | 503_db_pool_saturated | 503  | 2200.7        | 503 service_unavailable body={"error":"service_unavailable"} |
| 499   | 503_db_pool_saturated | 503  | 2200.5        | 503 service_unavailable body={"error":"service_unavailable"} |

---

## 9. Non-concurrent race audit — shared mutable state between requests

**Audit date:** 2026-06-05  
**Method:** Static review of module singletons + async interleaving between **concurrent HTTP requests** on one worker (not data-race UB — **logical** races on shared Maps, flags, and uncached reads). Integrates [phase1 DI/singleton audit](./phase1-aggressive-audit.md#dependency-injection--singleton-tenant-state-leak-audit).  
**Verdict:** **No cross-tenant data bleed** on Prisma path (RLS + ALS tested). **6 High** logical races remain on limiter, idempotency, scheduler depth, and relay/sync emit.

### 9.1 Scope and adversary model

Concurrent requests A and B interleave at `await` boundaries on **process-wide** singletons. Safe if: keyed by `tenantId`, bounded LRU/TTL, ALS-scoped, or immutable after init.

```mermaid
flowchart LR
  subgraph singletons["Module singletons"]
    RL[MemoryRateLimiterStore]
    IDM[memoryByKey idempotency]
    SCH[validation-scheduler queues]
    REG[tenant-registry-cache]
    RELAY[outbox relay running flag]
    BUS[domainBus emit]
  end
  HTTP_A[Request A] --> singletons
  HTTP_B[Request B] --> singletons
```

### 9.2 High-severity race register

| ID          | Severity | Shared state                                   | Race / interleaving hazard                                                                                            | Mitigation ref          |
| ----------- | -------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **RACE-01** | **High** | `resolveEffectiveRateLimitForTenant`           | Uncached admin `findUnique` races with relay/registry on **same admin pool** — latency amplification, not stale theme | RL-DOS-01, SCAL-DEBT-04 |
| **RACE-02** | **High** | `MemoryRateLimiterStore` / `RateLimiterMemory` | Concurrent `consume` on **new** keys — unbounded Map growth under rotating UUIDs                                      | RL-DOS-02, SCAL-HF-02   |
| **RACE-03** | **High** | `http-idempotency` `memoryByKey`               | Parallel duplicate keys: check-then-set without TX — duplicate work / last-writer wins on memory driver               | SCAL-HF-03, HT-08       |
| **RACE-04** | **High** | `validation-scheduler` `tenantQueues`          | `pumpQueue` + HTTP handlers interleave — deep queue growth while in-flight cap stalls dequeue                         | NN-04, SCAL-DEBT-06     |
| **RACE-05** | **High** | `publishDomainEvent` / `domainBus.emit`        | Relay row publish **sync** on loop while HTTP validation runs — indirect stall (see OB-COND-01)                       | SCAL-HF-12              |
| **RACE-06** | **High** | `InMemoryTourRepository` (memory driver)       | Shared repo singleton — correct only if every read filters `tenantId`; `resolveById` footgun                          | DI-MEM-01, SCAL-DEBT-05 |

### 9.3 Medium / Low rollup (24 findings)

| Category                    | Count | Examples                                                         | Status                                                          |
| --------------------------- | ----: | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| **Admin cache TTL races**   |     4 | Registry 5s lazy delete vs provision; stale `theme.rateLimitRps` | Medium — acceptable window                                      |
| **Engine / RuleEngine LRU** |     3 | Eviction during concurrent validate for same tenant              | Low — bounded caps                                              |
| **Validation gate**         |     2 | Per-tenant `openGates` Map                                       | **Pass** — HT-03 closed (`validation-gate-concurrency.spec.ts`) |
| **Outbox relay**            |     3 | `running` mutex drops ticks; claim SKIP LOCKED                   | Low — by design                                                 |
| **ALS / trace**             |     4 | Nested contexts; scheduler `setImmediate`                        | **Pass** — TR-01…12, TRACE-SCHED-01                             |
| **Metrics / dedupe**        |     3 | `metricsRegistry` increment; bus dedupe cap 64                   | Medium if labels abused                                         |
| **Graceful shutdown**       |     2 | `shuttingDown` flag vs in-flight HTTP                            | Low — documented                                                |
| **Proxy / legacy mirror**   |     3 | `TenantHttpProxy.cache`; empty `LegacyCanonicalAdapter.mirror`   | Low / future                                                    |

**Race inventory count: 30** (**6 High**, **15 Medium**, **9 Low/Info**).

### 9.4 Test cross-reference

| Spec                                                                        | Proves                   | Gap                         |
| --------------------------------------------------------------------------- | ------------------------ | --------------------------- |
| `validation-gate-concurrency.spec.ts`                                       | HT-03 gate isolation     | —                           |
| `5.4-S4-idempotency.spec.ts`                                                | Prisma idempotency claim | Memory driver parallel keys |
| `concurrent-tour-logic.spec.ts`                                             | Mixed-tenant creates     | Rate-limiter admin storm    |
| `background-task-isolation.spec.ts`                                         | Outbox relay ALS         | 100-tenant limiter flood    |
| [phase1 A→B→A stress](./phase1-aggressive-audit.md#als-a→b→a-stress-script) | ALS never cross-binds    | HTTP + memory storage combo |

### 9.5 Recommendations

1. **RACE-01/02:** Registry-cache theme lookup + `REDIS_URL` prod guard ([SCAL-DEBT-04](#scalability-debt)).
2. **RACE-03:** Prisma idempotency only in prod; memory TTL ([SCAL-DEBT-11](#scalability-debt)).
3. **RACE-04:** Queue max depth ([SCAL-DEBT-06](#scalability-debt)).
4. **RACE-05:** Async/light domain handlers ([OB-COND-01](#107-conditional-risks-not-failures-at-tested-load)).
5. **Test gap:** 100-tenant concurrent limiter probe ([SCAL-DEBT-14](#scalability-debt)).

---

## 10. Outbox relay — 10,000-event flood audit

```yaml
audit_id: phase3-outbox-relay-10k-flood
date: 2026-06-05
modules:
  - apps/api/src/outbox/outbox-relay.ts
  - apps/api/src/outbox/start-outbox-relay.ts
  - apps/api/src/outbox/outbox-relay-config.ts
  - apps/api/src/outbox/enqueue-domain-event.ts
  - apps/api/src/main.ts
related: DEC-004, DEC-017
tests:
  - apps/api/test/3-performance/outbox-throughput.spec.ts
  - apps/api/test/chaos/outbox-relay-memory.spec.ts
  - apps/api/test/reliability/outbox-relay-connection-leak.spec.ts
script: apps/api/scripts/reliability-outbox-relay-profile.ts
```

**Adversarial question:** With **10_000** pending `outbox_events`, can the in-process relay drain without **blocking the main HTTP thread / starving the event loop**?

**Verdict:** **Pass** — **System Scalability Failure count: 0** (no event-loop stall; HTTP main path within SLO under measured load).

**Primary bottleneck (one line):** Per-row `withTenantRls` on shared `getPrisma()` pool (up to 16 parallel) competes with HTTP writes — I/O queueing, not synchronous relay tick blocking.

### 10.1 Architecture and `main.ts` integration

| Component            | Path                      | Role                                                                                                      |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Enqueue (write path) | `enqueue-domain-event.ts` | `enqueueOutboxEvent(tx, …)` — same Prisma TX as aggregate; dedupe on `(tenant_id, domain_event_id)`       |
| Relay core           | `outbox-relay.ts`         | `claimPendingOutboxBatch` → `publishClaimedBatch` → per-row `publishClaimedOutboxRow`                     |
| Scheduler            | `start-outbox-relay.ts`   | `setInterval(tick, intervalMs)` when `OUTBOX_RELAY_ENABLED=true` (DEC-004)                                |
| Boot                 | `main.ts` L32             | `startOutboxRelayIfEnabled()` — same Node process as HTTP server                                          |
| Shutdown             | `graceful-shutdown.ts`    | `outboxRelay.stop()` → drain HTTP → `flushOutboxRelay()` (tight `processOutboxRelayOnce` loop, 8s budget) |

```mermaid
sequenceDiagram
  participant Timer as setInterval tick
  participant Relay as processOutboxRelayOnce
  participant Admin as getPrismaAdmin
  participant App as getPrisma
  participant Bus as publishDomainEvent sync emit
  participant HTTP as POST /tours

  Timer->>Relay: void tick (running guard)
  Relay->>Admin: claim batch FOR UPDATE SKIP LOCKED
  par up to OUTBOX_RELAY_PUBLISH_CONCURRENCY workers
    Relay->>App: withTenantRls visibility TX
    Relay->>Bus: runWithTenantContext → emit
    Relay->>Admin: mark done
  end
  HTTP->>App: withTenantRls canonical TX
  Note over Timer,HTTP: Same event loop — interleaved via await
```

### 10.2 Configuration defaults (`outbox-relay-config.ts`)

| Env var                            | Default | Cap         | Effect under flood                                             |
| ---------------------------------- | ------: | ----------- | -------------------------------------------------------------- |
| `OUTBOX_RELAY_ENABLED`             | `false` | —           | Relay off unless explicitly enabled                            |
| `OUTBOX_POLL_INTERVAL_MS`          |    1000 | min 100     | Tick cadence; **skipped** while prior tick `running`           |
| `OUTBOX_RELAY_BATCH_SIZE`          |      10 | max **100** | Rows claimed per tick; bounds in-memory `claimed[]`            |
| `OUTBOX_RELAY_PUBLISH_CONCURRENCY` |      16 | max **64**  | Parallel `publishClaimedOutboxRow` workers per batch (DEC-017) |

### 10.3 Mechanism analysis — adversarial 10k flood

#### setInterval tick and backpressure

`startOutboxRelayIfEnabled` (`start-outbox-relay.ts` L20–37):

1. **`running` mutex** — if a tick is in flight, subsequent interval callbacks **return immediately** (no stacked relay work).
2. **`void processOutboxRelayOnce()`** — relay work is async; timer callback does not `await` on the HTTP critical path.
3. **`interval.unref?.()`** — relay timer does not pin process exit.

**Backpressure model:** Missed interval ticks during a long batch are **dropped**, not queued. Drain rate is bounded by **batch duration**, not poll interval, while backlog exists. Enqueue path has **no** relay-side throttle — backlog grows with write rate; relay drains sequentially one batch at a time.

**Not a System Scalability Failure:** Slow backlog drain under default `batch=10` + `interval=1s` (~17+ min estimated for 10k at ~430 ms/batch with tight loop) is **latency to `done`**, not HTTP event-loop blocking.

#### Batch size and claimed-batch memory

- `claimPendingOutboxBatch` loads at most `min(OUTBOX_RELAY_BATCH_SIZE, 100)` full rows (payload JSON included) into a single `ClaimedOutboxRow[]`.
- **10k flood ≠ 10k in RAM** — only one claimed batch resident per tick (~100 rows max).
- `outbox-relay-memory.spec.ts`: 10k rows, batch 50 — heap growth ratio **≤2×** after GC (PASS).

#### Sequential vs parallel publish

`runWithConcurrency` (`outbox-relay.ts` L115–136) runs `min(concurrency, batch.length)` async workers pulling from a shared index — **not** `Promise.all` on the full batch at once.

Per row (`publishClaimedOutboxRow` L175–207), **await chain**:

1. `withTenantRls` → `getPrisma().$transaction` + GUC + `findUnique` visibility check (**app pool**).
2. `runWithTenantContext` → **`publishDomainEvent` (synchronous `EventEmitter.emit`)** inside ALS.
3. `getPrismaAdmin().outboxEvent.update` → mark `done` (**admin pool**).

**Per row:** ~2 pool touches (app TX + admin update); up to **16 concurrent** app-pool transactions when `OUTBOX_RELAY_PUBLISH_CONCURRENCY=16`.

#### Shared Prisma pool contention

| Pool                | Relay usage                                      | HTTP usage                                      |
| ------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `getPrisma()` (app) | Up to 16 parallel `withTenantRls` per relay tick | Every tenant route / canonical persist          |
| `getPrismaAdmin()`  | 1 claim TX + up to 16 parallel `update` per tick | Registry, rate-limit theme lookup, provisioning |

When `DATABASE_URL_ADMIN` is set, admin and app pools are **separate singletons** — claim/done does not consume app slots, but **visibility checks do**.

Default Prisma `connection_limit` ≈ **10**. Relay concurrency **16** > pool **10** → internal queueing on app pool during each tick. HTTP requests **await** the same pool → latency inflation or `DB_POOL_SATURATED` 503 (DEC-012), not event-loop freeze.

#### `runWithTenantContext` per row

ALS bind per row (`tenant-request-context.ts`) — O(1) `AsyncLocalStorage.run`; negligible vs DB RTT. Not a scalability hotspot.

#### Sync `publishDomainEvent` — conditional event-loop risk

`packages/platform-events/src/bus.ts` L81: `domainBus.emit` runs **synchronously** on the relay worker's continuation. Handlers that perform sync CPU work **block the entire process event loop** (HTTP + relay + timers).

Current tests use **noop** subscribers. Production plugins with heavy sync handlers would be **OB-COND-01** (conditional — not triggered in 10k run).

### 10.4 Production relay vs throughput test harness

| Aspect          | Production (`startOutboxRelayIfEnabled`) | `outbox-throughput.spec.ts`                    |
| --------------- | ---------------------------------------- | ---------------------------------------------- |
| Driver          | `setInterval` + `running` guard          | Tight `while` calling `processOutboxRelayOnce` |
| Batch size      | Env (default 10)                         | `OUTBOX_RELAY_BATCH_SIZE=100`                  |
| Pool            | Production URL limits                    | `connection_limit=64` injected                 |
| HTTP concurrent | Organic traffic                          | 20× `POST /tours` during drain                 |

Throughput test is **adversarial for main-path isolation** (worst-case deliberate overlap). Production `setInterval` is **less aggressive** than the test harness for concurrent relay ticks.

### 10.5 Execution results (2026-06-05, local Postgres `127.0.0.1:5434`)

```bash
cd apps/api && \
  DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
  DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
  OUTBOX_RELAY_BATCH_SIZE=100 OUTBOX_SEED_COUNT=10000 MIN_THROUGHPUT=100 \
  OUTBOX_THROUGHPUT_EMIT=1 \
  pnpm exec node --import tsx --test test/3-performance/outbox-throughput.spec.ts
```

#### Drain-only (10k pending rows)

| Metric          |                      Value |
| --------------- | -------------------------: |
| Published       |                     10_000 |
| Failed          |                          0 |
| Drain wall time |                42_879.8 ms |
| Throughput      |       **233.2 events/sec** |
| Min budget      | ≥100 events/sec — **PASS** |

#### Main-path isolation (10k drain ∥ 20× `POST /tours`)

| Metric                              |                                Value |
| ----------------------------------- | -----------------------------------: |
| Baseline write p95                  |            123.9 ms (10 solo writes) |
| Under-relay write p95               |                             395.3 ms |
| SLO ratio                           | **3.19×** (threshold ≤4×) — **PASS** |
| Concurrent creates succeeded        |                          **20 / 20** |
| Relay throughput (incl. 30 creates) |                     218.1 events/sec |

#### Nightly reliability reference (`.last-run.json`)

| Metric                          |  Value |
| ------------------------------- | -----: |
| Verdict                         |   PASS |
| Max `app_tour` connections      |      9 |
| Heap growth ratio               | 1.0001 |
| Idle-in-transaction after drain |      0 |

### 10.6 System Scalability Failure assessment

A **System Scalability Failure** is recorded when the relay **blocks the main HTTP thread** (sync stall) or **starves HTTP** beyond the encoded SLO (main-path fail / hung accept loop).

| ID                                                     | Failure? | Mechanism                                  | Evidence                                                 |
| ------------------------------------------------------ | -------- | ------------------------------------------ | -------------------------------------------------------- |
| **OB-SSF-01** Event-loop sync block from relay tick    | **No**   | `void` async tick; Prisma I/O yields       | Throughput test completes; no heartbeat stall            |
| **OB-SSF-02** HTTP starvation under 10k relay + writes | **No**   | App-pool contention raises p95 but ≤4× SLO | `underRelayWriteP95Ms=395.3`, ratio 3.19×, all 201       |
| **OB-SSF-03** Unbounded relay memory on 10k backlog    | **No**   | Batch cap 100 rows in memory               | `outbox-relay-memory.spec.ts` PASS                       |
| **OB-SSF-04** Connection leak under relay storm        | **No**   | Pools return to baseline                   | `outbox-relay-connection-leak.spec.ts` PASS; max 9 conns |

**System Scalability Failure count: 0**

### 10.7 Conditional risks (not failures at tested load)

| ID             | Severity                     | Finding                                                                   | Trigger                                                                               |
| -------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **OB-COND-01** | **High** (if handlers heavy) | Sync `domainBus.emit` in `publishDomainEvent`                             | Plugin subscribers with >10 ms sync work                                              |
| **OB-COND-02** | **Medium**                   | `OUTBOX_RELAY_PUBLISH_CONCURRENCY` (16) > default `connection_limit` (10) | Default pool URL without raise → HTTP 503 under combined relay+write                  |
| **OB-COND-03** | **Low**                      | `running` guard drops interval ticks                                      | Very long batches + `OUTBOX_POLL_INTERVAL_MS` — slower `done` latency, not HTTP block |
| **OB-COND-04** | **Info**                     | No relay throughput metric exported                                       | `metrics.ts` — tour counters only                                                     |

### 10.8 Cross-links to prior sections

| Section                                                        | Coupling                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Pool stress §](#database-connection-pool--stress-integration) | Relay `withTenantRls` shares `getPrisma()` with HTTP — stacks with 500-parallel hold storm on **app** pool |
| [Event-loop blockers §](#performance-blockers-event-loop)      | `outbox-relay.ts` `while(true)` worker loop flagged **not HTTP hot path**; sync emit is the residual risk  |
| [OOM inventory §](#inventory--caches-and-module-singletons)    | `domainBus` listeners unbounded; handler dedupe cap 64 per subscription                                    |
| [Rate limiter §](#tenant-rate-limiter--100-tenant-flood-audit) | Admin pool shared with relay `mark done` + uncached theme lookup                                           |

### 10.9 Recommendations

1. **Size `connection_limit`** ≥ `OUTBOX_RELAY_PUBLISH_CONCURRENCY` + HTTP headroom (or lower concurrency to match pool).
2. **Document OB-COND-01** — domain event handlers must be async/light; heavy work via outbox subscriber queue (Phase 7).
3. **Promote `outbox-throughput.spec.ts`** with `OUTBOX_SEED_COUNT=10000` to nightly when Postgres available.
4. **Export relay lag metric** — `pending` row count / oldest `created_at` age (Phase 7 observability).
5. **Production batch tuning** — default `OUTBOX_RELAY_BATCH_SIZE=10` implies ~1000 ticks per 10k backlog; raise to 100 for catch-up after incidents.

### 10.10 Run commands

```bash
# Throughput + main-path (10k)
OUTBOX_SEED_COUNT=10000 OUTBOX_RELAY_BATCH_SIZE=100 OUTBOX_THROUGHPUT_EMIT=1 \
  pnpm --filter @apps/api exec node --import tsx --test test/3-performance/outbox-throughput.spec.ts

# Memory profile (10k)
pnpm --filter @apps/api exec node --import tsx --expose-gc --test test/chaos/outbox-relay-memory.spec.ts

# Nightly connection + heap (wrapper)
pnpm --filter @apps/api exec node --import tsx --expose-gc scripts/reliability-outbox-relay-profile.ts
```

---

## 11. Logging backpressure — adversarial sink & Fatal Observability Flaws

**Audit date:** 2026-06-05  
**Method:** Static review of `logger.ts`, `request-logging.ts`, `error-interceptor.ts`, `graceful-shutdown.ts`, Pino 9 / Sonic-Boom semantics; adversarial assumption that **log sink throughput < HTTP emit rate**; cross-ref [phase2-paranoid-audit § LOG-BP-\*](./phase2-paranoid-audit.md#empirical--logging-backpressure-1000-request-burst) and [`scripts/log-backpressure-burst.ts`](../scripts/log-backpressure-burst.ts) (re-run 2026-06-05 — extends phase 2, not duplicated verbatim).

### 11.1 Emit path (what runs per request)

```mermaid
sequenceDiagram
  participant HTTP as Node HTTP
  participant Fin as res finish
  participant Log as logHttpRequest
  participant Pino as pino logger
  participant SB as Sonic-Boom stdout

  HTTP->>Fin: response ended
  Fin->>Log: sync on event loop
  Log->>Pino: logger.info http.request
  Pino->>SB: append NDJSON line
  Note over SB: minLength 4096 default flush batch
```

| Layer              | File                                                                                 | Behavior                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Logger factory** | [`observability/logger.ts`](../src/observability/logger.ts)                          | `pino({ level: LOG_LEVEL ?? "info", … })` — **no** explicit `destination`; inherits Pino 9 → Sonic-Boom **fd=1**, **`sync: false`**, **`minLength: 4096`**           |
| **Access log**     | [`http/request-logging.ts`](../src/http/request-logging.ts) L13–19                   | `res.on("finish", () => logHttpRequest(…))` — **synchronous** on the HTTP thread ([LOG-BP-03](./phase2-paranoid-audit.md))                                           |
| **Error log**      | [`middleware/error-interceptor.ts`](../src/middleware/error-interceptor.ts) L103–114 | `status === 500` → `logger.error` with message + up to 12 stack lines — **larger** records than access logs ([LOG-BP-04](./phase2-paranoid-audit.md))                |
| **Shutdown**       | [`server/graceful-shutdown.ts`](../src/server/graceful-shutdown.ts)                  | Stops relay → `server.close()` → outbox flush → Prisma disconnect — **no** `logger.flush()` / destination drain ([LOG-BP-HARDEN-02](./phase2-paranoid-audit.md) gap) |
| **Wiring**         | [`main.ts`](../src/main.ts)                                                          | `createServer(withRequestLogging(…))` — **every** route including `GET /health` emits one access log on finish                                                       |

There is **no** application-level log queue, rate limiter, sampler, or `destination.on('drop')` handler. The only runtime throttle is **`LOG_LEVEL`** (default `info`).

### 11.2 Sonic-Boom / Pino defaults (sync vs async)

| Option                               | `apps/api` today                            | Adversarial effect when sink is slow                                                                                                                     |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`sync: false`** (default)          | Yes — `logger.info` returns after buffering | Internal `_bufs` / `_len` grow until `fs.write` drains; **no `maxLength`** configured → **no `drop` event** (Sonic-Boom drops only when `maxLength > 0`) |
| **`minLength: 4096`** (Pino default) | Yes — batch before flush                    | Reduces syscall count; **increases** bytes held in-process under burst                                                                                   |
| **`maxLength`**                      | **Unset (0)**                               | Buffer can grow **without bound** → **OOM** risk before any shed policy                                                                                  |
| **`sync: true`**                     | Not used                                    | Would **block** the event loop on every log line — worse than async backlog                                                                              |
| **`retryEAGAIN`**                    | Default always retry                        | Retries on full pipe (K8s/docker log copier); prolongs pressure, does not shed                                                                           |
| **`drain` event**                    | **Not subscribed**                          | No app reaction to backpressure signal from Sonic-Boom                                                                                                   |

Pino’s `logger.info()` return time measures **enqueue into Sonic-Boom**, not collector durability. Phase 2 micro-benchmark (~10–30 µs per line to stdout) and §11.3 re-run (~0.01–0.05 ms p99 sequential) prove the **fast-sink** case only.

### 11.3 Adversarial scenario — logging service slower than request rate

Assume: **R_req** HTTP completions/sec each calling `logHttpRequest`, **R_sink** bytes/sec to stdout (container log agent, JSON pretty transport, remote forwarder) with **R_sink ≪ R_req × line_size**.

| Failure stage        | Mechanism                                                                  | Symptom                                                                                       |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Buffer fill       | Sonic-Boom `_len` rises; `_bufs[]` holds stranded NDJSON                   | RSS climbs; GC pressure                                                                       |
| 2. No shed policy    | `maxLength` not set; no `drop` listener; no access-log sampling            | **Silent** completeness illusion — operators believe logs are complete                        |
| 3. `finish` coupling | Each completing response runs `logger.info` **inside** `finish` callback   | Event-loop latency spikes; keep-alive sockets stall ([LOG-BP-03](./phase2-paranoid-audit.md)) |
| 4. 500 amplification | `logInternalServerError` adds stack payload per failure                    | Buffer fill **faster** than access-only traffic ([LOG-BP-04](./phase2-paranoid-audit.md))     |
| 5. EAGAIN / error    | Full pipe → `release` → `emit('error')` unless `retryEAGAIN` returns false | Uncaught destination error can **crash** the process if not handled                           |
| 6. SIGTERM           | `runGracefulShutdown` never flushes Pino                                   | Last **≥4 KiB** (and all queued lines) **lost**; incident timelines incomplete                |

**Contrast with healthy observability:** explicit **shed** (sample / drop with metric), **decouple** HTTP from sink (`setImmediate` / worker transport), **monitor** `drop`/`drain`/`writeBufferLen`, **flush** on shutdown.

### 11.4 Empirical baseline (fast sink — extends LOG-BP-01/02)

Re-run: `cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory OUTBOX_RELAY_ENABLED=false npx tsx scripts/log-backpressure-burst.ts` (stderr summary; NDJSON on stdout).

| Metric  | Bare `/health` | With `withRequestLogging` | Δ (logged − bare) |
| ------- | -------------- | ------------------------- | ----------------- |
| **p50** | 18.0 ms        | 21.0 ms                   | +3.0 ms           |
| **p95** | 300.9 ms       | 383.1 ms                  | +82.2 ms          |
| **p99** | 436.2 ms       | 538.7 ms                  | +102.5 ms         |

| Pino isolated write (1000 sequential) | p99 (ms)         |
| ------------------------------------- | ---------------- |
| `/dev/null` async                     | 0.029            |
| stdout `minLength: 4096`              | 0.055 (max 2.12) |

**Verdict (empirical):** Matches **LOG-BP-01** / **LOG-BP-02** — no backpressure **observed** on local fast stdout; tail delta is HTTP concurrency noise, not proof of safety under slow sink. Phase 2 caveat stands: re-run with stdout blocked (slow consumer, `pv -L`, or saturated docker log driver) to stress **LOG-BP-03**.

### 11.5 Fatal Observability Flaw inventory

Under the adversarial assumption above, the API lacks a **logging backpressure contract**. Documented flaws:

| ID             | **Fatal Observability Flaw**                                                                                                                                                            | Phase 2 cross-ref             | Contributing code                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| **FOF-LOG-01** | **No application backpressure, sampling, or drop policy** when emit rate exceeds sink throughput — relies on unbounded Sonic-Boom buffer (`maxLength` unset), no `drop`/`drain` metrics | LOG-BP-05, LOG-BP-DEFER-02/03 | `logger.ts` — implicit destination only    |
| **FOF-LOG-02** | **HTTP lifecycle coupled to logging latency** — synchronous `finish` → `logger.info` on the event loop                                                                                  | LOG-BP-03, LOG-BP-DEFER-01    | `request-logging.ts` L13–19                |
| **FOF-LOG-03** | **Graceful shutdown does not flush or drain the log destination** — buffered NDJSON discarded on SIGTERM under pressure                                                                 | LOG-BP-HARDEN-02              | `graceful-shutdown.ts` — outbox flush only |

**Fatal Observability Flaw count: 3**

**Not separate FOF (Medium, folded above):** LOG-BP-04 (500 storm write amplification); LOG-BP-06 (missing `traceId` in access logs).

**Passes (fast sink only):** LOG-BP-01, LOG-BP-02.

### 11.6 Current backpressure behavior (one line)

**Default async Pino → Sonic-Boom stdout buffers NDJSON with no app-level shed, monitoring, or shutdown flush; every response logs synchronously on `res.finish` — safe when the sink keeps up (LOG-BP-01), unbounded-buffer / event-loop / OOM risk when it does not (FOF-LOG-01–03).**

### 11.7 Recommendations (docs-only; implementation deferred)

| Priority | Action                                                                                                | Rationale                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **P1**   | Explicit destination in `logger.ts`: `pino.destination({ dest: 1, sync: false, minLength: 4096 })`    | Documents intent; avoids accidental `sync: true` / pretty transport ([LOG-BP-HARDEN-01](./phase2-paranoid-audit.md)) |
| **P1**   | Subscribe to Sonic-Boom **`drain`** and optional **`drop`** (requires `maxLength` + operator metric)  | Only way to **observe** backpressure; `drop` enables bounded memory at cost of completeness                          |
| **P2**   | `runGracefulShutdown`: after `server.close()`, `await` `logger.flush(cb)` / `destination.flushSync()` | Prevents FOF-LOG-03 tail loss ([LOG-BP-HARDEN-02](./phase2-paranoid-audit.md))                                       |
| **P2**   | Defer access log: `res.on("finish", () => setImmediate(() => logHttpRequest(…)))`                     | Decouples `finish` from Pino enqueue (LOG-BP-DEFER-01); accept rare loss on hard kill                                |
| **P3**   | Sample or suppress **`GET /health`** access logs (e.g. 1% or `LOG_LEVEL=warn` under load test)        | Probe storms dominate volume in K8s (LOG-BP-DEFER-02)                                                                |
| **P3**   | Load / incident: `LOG_LEVEL=warn` (or `error`) via env                                                | Reduces emit rate without code change — already supported in `logger.ts`                                             |
| **P4**   | `pino.transport` worker + `await once(dest, 'drain')` if pretty-print or remote sink                  | Correct backpressure with formatting (LOG-BP-DEFER-03)                                                               |
| **P4**   | Sample / truncate `logInternalServerError` under 500 storm                                            | Mitigates LOG-BP-04 amplification                                                                                    |

### 11.8 Gate / regression

| Check                  | Command / spec                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Fast-path regression   | `npx tsx scripts/log-backpressure-burst.ts` — compare Δ p99 vs baseline on CI runner                                      |
| Slow-sink stress (gap) | Block stdout or rate-limit pipe while bursting `/health` — expect p99 regression; add nightly when infra available        |
| Privacy / shape        | [`test/2-observability/log-privacy.spec.ts`](../test/2-observability/log-privacy.spec.ts) — does not measure backpressure |

### 11.9 Cross-links

| Section                                                                         | Coupling                                                                                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Event-loop blockers §](#performance-blockers-event-loop)                       | `request-logging.ts` / `error-interceptor.ts` rows remain **Medium**; §11 elevates **adversarial-sink** to **Fatal** |
| [Noisy neighbor §](#noisy-neighbor--tenant-a-bulk-import-vs-tenant-b-loginread) | Victim `GET /health` still logs every completion — amplifies probe + import storms                                   |
| [Outbox §10](#10-outbox-relay--10000-event-flood-audit)                         | `logger.info` on relay tick adds background emit rate under `OUTBOX_THROUGHPUT_EMIT`                                 |

---

## 12. Cold-start — service initialization audit

**Audit date:** 2026-06-05  
**Method:** Static review of `main.ts` boot chain + live runs of [`cold-start-latency.spec.ts`](../test/3-performance/cold-start-latency.spec.ts), subprocess [`main.ts`](../src/main.ts) probes, and [`cold-start-http-worker.ts`](../test/3-performance/cold-start-http-worker.ts) spawn-to-ready timing.  
**Adversarial assumption:** Cloud with **frequent process restarts** (scale-to-zero, rolling deploys, spot preemption, crash loops). Each new worker must become traffic-ready quickly.  
**SLO (this audit):** Any measured init phase **p50 or p95 > 500 ms** → flag **Unscalable** (stricter than the spec’s default `COLD_START_BUDGET_MS=1000`).

```yaml
audit_id: phase3-cold-start-init
date: 2026-06-05
slo_ms: 500
spec_budget_ms: 1000 # cold-start-latency.spec.ts default — informational only
worker: test/3-performance/cold-start-http-worker.ts
fixtures: test/3-performance/cold-start-fixtures.ts
entrypoint: src/main.ts
```

### 12.1 Boot sequence (monolith API process)

`@apps/api` runs as a **single Node HTTP process** (not separate microservices). Initialization is synchronous at module load plus async work on first request.

```mermaid
sequenceDiagram
  participant Node as node process
  participant Main as main.ts
  participant Auth as auth-env / production-runtime-env
  participant App as app.ts (createRequestListener)
  participant Svc as ToursService stack
  participant Relay as startOutboxRelayIfEnabled
  participant HTTP as server.listen

  Node->>Main: ESM import graph (tsx or dist)
  Main->>Auth: assertAuthEnvironmentIntegrity (sync)
  Main->>Auth: assertProductionRuntimeIntegrity (sync)
  Main->>Svc: TourStorageDbAdapter + CanonicalTourService + ToursService
  Main->>App: createRequestListener({ toursService })
  Main->>Relay: startOutboxRelayIfEnabled (sync register; async tick if enabled)
  Main->>HTTP: createServer(withRequestLogging(listener))
  Note over HTTP: First GET — lazy Prisma / Redis / validation engine
```

| Phase                          | Module / symbol                                                                                             | Sync at boot?                                                             | First touch                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| **1 — Process + import graph** | All transitive `import` from `main.ts`                                                                      | **Yes** — dominates cold start                                            | Module evaluation                     |
| **2 — Auth guards**            | [`tenant-kernel/auth-env.ts`](../src/tenant-kernel/auth-env.ts) `assertAuthEnvironmentIntegrity`            | **Yes** — env checks only                                                 | `main.ts` L7                          |
| **3 — Production guards**      | [`server/production-runtime-env.ts`](../src/server/production-runtime-env.ts)                               | **Yes** — no I/O                                                          | `main.ts` L8                          |
| **4 — Service wiring**         | `TourStorageDbAdapter`, `CanonicalTourService`, `ToursService`                                              | **Yes** — constructs in-memory adapters                                   | `main.ts` L20–22                      |
| **5 — HTTP listener**          | [`app.ts`](../src/app.ts) `createRequestListener`                                                           | **Yes** — builds closure; `ProvisioningService` default if omitted        | `main.ts` L24–29                      |
| **6 — Outbox relay**           | [`outbox/start-outbox-relay.ts`](../src/outbox/start-outbox-relay.ts)                                       | **Sync register**; first `processOutboxRelayOnce` is async `void`         | Boot when `OUTBOX_RELAY_ENABLED=true` |
| **7 — Shutdown hooks**         | [`server/graceful-shutdown.ts`](../src/server/graceful-shutdown.ts)                                         | **Yes** — handler registration                                            | `main.ts` L34                         |
| **8 — Listen**                 | `server.listen(port)`                                                                                       | **Yes** — binds socket                                                    | `main.ts` L36–38                      |
| **9 — Prisma singleton**       | [`db/prisma.ts`](../src/db/prisma.ts) `getPrisma()`                                                         | **Lazy** — `new PrismaClient()` on first call                             | First DB route / storage op           |
| **10 — Tenant registry**       | [`tenant/tenant-registry.ts`](../src/tenant/tenant-registry.ts)                                             | **Sync** — `warnDevTenantRegistryWhenAllowed()` at import                 | Import side-effect only               |
| **11 — Tenant DB preload**     | [`tenant/resolve-registered-tenant.ts`](../src/tenant/resolve-registered-tenant.ts) + cache                 | **Lazy** — admin `findUnique` on first resolve                            | First tenant-scoped route             |
| **12 — Redis rate limiter**    | [`middleware/tenant-rate-limiter.ts`](../src/middleware/tenant-rate-limiter.ts) `getTenantRateLimiterStore` | **Lazy** — `new Redis(url)` when limiter enabled + `REDIS_URL` set        | First rate-limited write              |
| **13 — Validation engine**     | [`tours/canonical-validation.ts`](../src/tours/canonical-validation.ts) `getOrCreateValidationEngine`       | **Lazy** — LRU cache; `PlatformWizardEngine.create` + `tryInit` on miss   | First `POST /tours`                   |
| **14 — Provisioning**          | [`internal/provisioning.service.ts`](../src/internal/provisioning.service.ts)                               | **Lazy** — `new ProvisioningService()` per listener or per route fallback | `POST /internal/tenants/provision`    |

**Prisma generate:** Not at runtime boot — [`package.json`](../package.json) `pretest` / `build` run `prisma generate`. Production images must bake generated client at build time.

### 12.2 `createRequestListener` dependency graph

[`createRequestListener`](../src/app.ts) wraps every route in `runWithTraceContext` and dispatches synchronously to route handlers. Dependencies injected at construction:

| Dep                   | Source in `main.ts`                                                                             | Boot cost                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `toursService`        | `ToursService` → `CanonicalTourService` → `TourStorageDbAdapter(createTourStorageRepository())` | Pulls canonical, CASL, storage, metrics, outbox persist modules into import graph |
| `provisioningService` | Optional; defaults to `new ProvisioningService()` inside listener                               | Lazy unless passed explicitly                                                     |

**Not wired at listener creation:** Prisma, Redis, tenant Postgres lookup, RuleEngine — all first-request lazy paths (good for pool/Redis isolation, but import graph still loads most modules).

### 12.3 Module import graph — sync work at boot

Heavy transitive imports from `main.ts` include:

- `@app-tour/platform-core`, `@app-tour/workspace-sdk`, `@app-tour/workspace-starter` (via `resolve-workspace-plugin` / canonical stack)
- `@prisma/client` (type + client factory — no connect until query)
- `jose`, `@casl/ability`, `pino`, `zod`, `ioredis`, `rate-limiter-flexible` (loaded when middleware modules import)

**Sync side-effects at import (non-I/O):**

| File                   | Side-effect                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `tenant-registry.ts`   | `warnDevTenantRegistryWhenAllowed()` when static registry allowed |
| `workspace-plugins.ts` | Builds `pluginById` Map from starter plugin                       |
| `metrics.ts`           | Module-level registry init                                        |

No sync filesystem, crypto, or zlib on the documented hot path ([Performance Blockers](#performance-blockers-event-loop)).

### 12.4 Execution results (2026-06-05)

Environment: Linux, Node **v22.22.0**, workspace `@apps/api`, `tsx` transpile for subprocess probes (dev/test path). **Compiled `dist/main.js` not measured** — `pnpm run build` failed (TS error in `idempotent-domain-event-subscriber.ts`); production cold-start may differ (typically faster without tsx).

#### A — RuleEngine path ([`cold-start-latency.spec.ts`](../test/3-performance/cold-start-latency.spec.ts))

```bash
cd apps/api && NODE_ENV=test COLD_START_HTTP_EMIT=1 \
  node --import tsx --test test/3-performance/cold-start-latency.spec.ts
```

| Metric                                       |    Value | vs 500 ms SLO |
| -------------------------------------------- | -------: | :-----------: |
| `engineCreateMs` (256 cells)                 |    45.74 |     Pass      |
| `engineTryInitMs`                            |    13.08 |     Pass      |
| `engineValidateMs`                           |     6.86 |     Pass      |
| `engineTotalMs` (tryInit + validate)         |    19.94 |     Pass      |
| `starterTryInitMs` (baseline)                |     0.88 |     Pass      |
| `httpTtfbMs` (subprocess first GET /probe)   |    86.67 |     Pass      |
| `httpInitHeaderMs` (`X-Rule-Engine-Init-Ms`) |    59.56 |     Pass      |
| Spec verdict (`COLD_START_BUDGET_MS=1000`)   | **pass** |     Pass      |

**Note:** API hot path uses [`getOrCreateValidationEngine`](../src/tours/canonical-validation.ts) LRU (DEC-030), not fresh `create` per request — cold-start spec models **worst-case serverless** first validation after scale-to-zero.

#### B — Minimal worker spawn-to-ready ([`cold-start-http-worker.ts`](../test/3-performance/cold-start-http-worker.ts))

Five fresh subprocesses; time from `spawn` to `COLD_START_READY` on stdout (module load + listen, **no HTTP yet**):

|     Run |    readyMs |
| ------: | ---------: |
|       1 |     535.82 |
|       2 |     581.71 |
|       3 |     631.75 |
|       4 |     725.28 |
|       5 |     794.31 |
| **p50** | **631.75** |
| **p95** | **794.31** |

#### C — Full API subprocess boot to first `/health`

Five fresh `node --import tsx src/main.ts` processes (`NODE_ENV=test`, `STORAGE_DRIVER=memory`, `OUTBOX_RELAY_ENABLED=false`, unique `PORT`):

|     Run | ttfbMs (spawn → first byte `/health`) |
| ------: | ------------------------------------: |
|       1 |                               1244.38 |
|       2 |                               1281.22 |
|       3 |                               1295.70 |
|       4 |                               1354.05 |
|       5 |                               2084.33 |
| **p50** |                           **1295.70** |
| **p95** |                           **2084.33** |

#### D — Prisma path (first DB-touch after listen)

Single subprocess: `STORAGE_DRIVER=prisma`, `DATABASE_URL` → local Postgres:

| Metric                                           |      Value |
| ------------------------------------------------ | ---------: |
| Spawn → `/health` TTFB                           | 1285.31 ms |
| First `GET /api/v2/tenant-config` (after health) |   19.43 ms |

Prisma connect + first admin registry query is **lazy** and **under 500 ms** once the process is up; it does **not** explain the **>1 s** boot — import graph does.

### 12.5 Unscalable findings (>500 ms)

| ID             | Component                                           | p50 (ms) | p95 (ms) |      Flag      | Root cause                                                                                                                |
| -------------- | --------------------------------------------------- | -------: | -------: | :------------: | ------------------------------------------------------------------------------------------------------------------------- |
| **CS-UNSC-01** | Full `main.ts` subprocess → first `/health`         |     1296 |     2084 | **Unscalable** | Node ESM import graph + **tsx on-the-fly transpile**; pulls platform-core, workspace-sdk, prisma client, middleware stack |
| **CS-UNSC-02** | `cold-start-http-worker` spawn → `COLD_START_READY` |      632 |      794 | **Unscalable** | Same import/transpile cost for platform-core + workspace-sdk subset (256-cell plugin materialized at module load)         |

**Unscalable flag count: 2**

**Slowest init component:** **CS-UNSC-01 — full `main.ts` module import graph** (**p95 2084 ms**).

**Passes under 500 ms SLO:** RuleEngine tryInit/validate (§12.4 A); first HTTP validation TTFB after worker ready (86.67 ms); lazy Prisma first query (19.43 ms); outbox relay when disabled (no measurable boot block); Redis (lazy, not at boot); provisioning service (lazy).

### 12.6 Coupling to other § sections

| Section                                                                              | Coupling                                                                                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [Event-loop blockers](#performance-blockers-event-loop)                              | RuleEngine rows cite cold-start spec — **CPU** risk under load, not boot graph                                 |
| [In-memory caches](#in-memory-caches-ruleengine-retention-and-oom-stress)            | Engine LRU reduces repeat-init; does not shrink first boot import                                              |
| [Pool stress §](#prisma-connection-pool--500-parallel-http-stress-audit)             | Pool is async post-connect; cold-start defers Prisma until first DB route                                      |
| [Rate limiter §](#tenant-rate-limiter--100-tenant-flood-audit)                       | Redis connect deferred — good for boot, bad for first-write latency spike                                      |
| [Outbox §10](#10-outbox-relay--10000-event-flood-audit)                              | Relay `setInterval` + immediate `tick()` when enabled adds background DB work seconds after boot               |
| [Logging §11](#11-logging-backpressure--adversarial-sink--fatal-observability-flaws) | `withRequestLogging` on every route including `/health` — probe storms during rolling restart amplify log emit |

### 12.7 Recommendations (docs-only)

| Priority | Action                                                                                    | Closes                                                              |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **P0**   | Measure **`node dist/main.js`** cold boot in CI (readiness probe @ **500 ms**)            | CS-UNSC-01 — tsx may overstate prod                                 |
| **P1**   | Pre-warm: min-instances / readiness gate until `/health` <500 ms for N consecutive probes | Scale-to-zero adversarial assumption                                |
| **P1**   | Split validation worker process OR defer platform-core import until first tour write      | Shrinks HTTP-only worker graph                                      |
| **P2**   | Pre-compile RuleEngine at tenant provision; expand `P5_VALIDATION_ENGINE_CACHE_SIZE`      | Already in validation-fairness.md — reduces first-write, not import |
| **P2**   | Lazy-import heavy routes (`/tours`, provisioning) via dynamic `import()`                  | Reduces CS-UNSC-01 graph                                            |
| **P3**   | Align `COLD_START_BUDGET_MS` gate to **500 ms** or add separate `@500ms` tier in spec     | Matches this audit SLO                                              |

### 12.8 Gate / regression

| Check                         | Command                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| RuleEngine + HTTP TTFB        | `cd apps/api && NODE_ENV=test node --import tsx --test test/3-performance/cold-start-latency.spec.ts` |
| JSON report                   | `COLD_START_HTTP_EMIT=1`                                                                              |
| Engine-only (skip subprocess) | `COLD_START_SKIP_SUBPROCESS=1`                                                                        |
| Platform-core contract        | `packages/platform-core/test/cold-start.contract.spec.ts`                                             |

### 12.9 Cross-links

- [`validation-fairness.md`](../../../docs/phase-5/appendices/validation-fairness.md) — LRU vs fresh-engine cold-start probe
- [`phase2-paranoid-audit.md`](./phase2-paranoid-audit.md) — cold-start spec console emit inventory
- [`main.ts`](../src/main.ts), [`app.ts`](../src/app.ts), [`cold-start-fixtures.ts`](../test/3-performance/cold-start-fixtures.ts)
