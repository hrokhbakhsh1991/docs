# Phase 3 Scalability & Stress Audit — Fix List

**Source:** [`apps/api/docs/phase3-scalability-stress-audit.md`](../apps/api/docs/phase3-scalability-stress-audit.md)  
**Generated:** 2026-06-05  
**Scope:** Connection-pool saturation, event-loop CPU, noisy neighbor, 100-tenant rate-limiter flood, outbox 10k relay, shared-state races, logging backpressure, cold-start init.

---

## خلاصه اجرایی (فارسی)

| مورد                             | مقدار                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| **حکم Stress-Test**              | **CONDITIONAL** — tier-3 gates سبز؛ scale-out تولیدی **مسدود** |
| **Break-point RPS (global)**     | **~40 RPS** @ 250 ms hold · **~200 RPS** @ ~50 ms TX (تخمینی)  |
| **Break-point RPS (per tenant)** | **50 RPS** write/read (429 بالاتر — عمدی)                      |
| **Hard-Fail Risks**              | **12** (`SCAL-HF-01` … `SCAL-HF-12`)                           |
| **Scalability Debt**             | **15** (`SCAL-DEBT-01` … `SCAL-DEBT-15`)                       |
| **Noisy Neighbor**               | **8** آسیب‌پذیری (**3 High**) — RLS سبز؛ availability **Fail** |
| **Rate limiter 100-ID flood**    | **4** DoS (`RL-DOS-01` … `RL-DOS-04`) — **Fail**               |
| **Outbox 10k flood**             | **Pass** — 0 System Scalability Failure · **233 eps** drain    |
| **Cold-start**                   | **2 Unscalable** (`CS-UNSC-01/02`) — p95 boot **2084 ms**      |
| **Race register**                | **30** (**6 High**) — بدون bleed داده بین tenant               |

**جمع‌بندی:** pool storm → **503** (نه hang)، outbox 10k + HTTP SLO **3.19×** اثبات شده. قبل از multi-tenant production: **SCAL-DEBT-01…06**، **SCAL-HF-01/02**، **NN-01/02** و **RL-DOS-01** را ببندید.

---

## تناقضات و ابهامات در سند (نیاز به هم‌راستاسازی)

| ID         | محل در سند                                                                               | تناقض                            | توضیح / اقدام پیشنهادی                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **CON-01** | Headline «**14** Scalability Debt» vs جدول SCAL-DEBT (**15** ردیف تا CS-UNSC)            | شمارش 14 vs 15                   | **SCAL-DEBT-15** (cold-start gate @ 500 ms) بعد از capstone اضافه شده — در doc اصلی headline را به **15** اصلاح کنید. |
| **CON-02** | Verdict **CONDITIONAL** vs Executive «Rate limiter **Fail**» و «Noisy neighbor **Fail**» | capstone سبز؛ زیربخش‌ها Fail     | تناقض نیست — gate integration **Pass**؛ production scale-out **blocked**. در گزارش مدیریتی هر دو را جدا بنویسید.      |
| **CON-03** | `cold-start-latency.spec.ts` budget **1000 ms** vs §12 SLO **500 ms Unscalable**         | دو آستانه                        | spec قدیمی‌تر است؛ audit §12 سخت‌گیرتر — **CS-UNSC** بر اساس 500 ms. هم‌راستا: gate @ 500 ms روی `dist/main.js`.      |
| **CON-04** | Outbox §10 **Pass** vs OB-COND-01 sync `publishDomainEvent`                              | relay pass؛ handler sync ریسک    | pass در بار تست‌شده؛ OB-COND-01 ریسک **آینده** اگر subscriber سنگین شود — در risk register نگه دارید.                 |
| **CON-05** | Logging §11 «**Low today**» (fast stdout) vs FOF-LOG **Fatal (adversarial)**             | empirical سبز؛ تئوری Fatal       | عمدی — LOG-BP-01 سبز ≠ slow-sink امن. re-run با stdout blocked اجباری قبل از prod log driver.                         |
| **CON-06** | `BASELINE_RATIO_MAX=1.10` در spec vs `1.25` در `phase-5:gate`                            | SLO noisy-neighbor شل‌تر در gate | [phase5 CI-BYP-20](../apps/api/docs/phase5-evolution-audit.md) — fairness gate pragmatic؛ doc delta را ثبت کنید.      |
| **CON-07** | Pool «**Pass**» (isolation) vs NN-02 «B **503**» (fairness)                              | RLS درست؛ pool مشترک             | schema/design درست؛ **fairness gap** — SCAL-DEBT-01 P2-5.                                                             |

---

## Must-Fix — Phase 3 scale-out sign-off (از Final Stress-Test Audit)

| Pri    | ID(s)                                  | File / area                          | Problem                                             | Suggested fix                                             |
| ------ | -------------------------------------- | ------------------------------------ | --------------------------------------------------- | --------------------------------------------------------- |
| **P0** | SCAL-DEBT-01, NN-02                    | pool / `withCanonicalTransaction`    | بدون سقف DB per-tenant — A bulk → B **503**         | Per-tenant app-pool semaphore (P2-5); reserved read slots |
| **P0** | SCAL-DEBT-02, NN-01, SCAL-HF-10        | `canonical-validation.ts`, scheduler | RuleEngine sync روی event loop — CPU monopolization | Worker pool + time budget + 408/429 shed                  |
| **P0** | SCAL-DEBT-03, NN-07                    | `http/json.ts`, routes               | بدون `maxBody` — parse/stringify multi-MiB          | HTTP 413 قبل از `Buffer.concat`                           |
| **P0** | SCAL-DEBT-04, RL-DOS-01/03, SCAL-HF-01 | `tenant-rate-limiter.ts`             | Admin `findUnique` هر consume — 100-ID flood        | Route via `tenant-registry-cache` + negative cache        |
| **P0** | SCAL-DEBT-06, NN-04, RACE-04           | `validation-scheduler.ts`            | `tenantQueues` بدون max depth                       | Queue depth cap → 429/503 + metric                        |
| **P1** | SCAL-DEBT-05                           | `create-tour-storage.ts`             | Memory driver در misconfig prod                     | Fail-closed prisma + DATABASE_URL (cross phase1/2)        |
| **P1** | SCAL-DEBT-09, NN-05                    | bulk import path                     | بدون quota/concurrency cap                          | Job API یا middleware cap                                 |
| **P1** | SCAL-DEBT-14                           | CI                                   | فقط two-tenant limiter specs                        | 100-tenant concurrent probe در gate                       |
| **P1** | SCAL-DEBT-15, CS-UNSC-01               | cold-start / CI                      | tsx boot **2×** over 500 ms SLO                     | Gate `node dist/main.js` @ 500 ms readiness               |

---

## Hard-Fail Risks (SCAL-HF — crash/OOM/DoS)

| ID             | Risk                                | Trigger (خلاصه)                                | Ref                  |
| -------------- | ----------------------------------- | ---------------------------------------------- | -------------------- |
| **SCAL-HF-01** | Admin DB amplification via limiter  | 100+ unique tenant IDs × rate-limited routes   | RL-DOS-01            |
| **SCAL-HF-02** | OOM — memory rate limiter keys      | Rotating UUIDs بدون `REDIS_URL`                | RL-DOS-02            |
| **SCAL-HF-03** | OOM — idempotency Map               | Unique `Idempotency-Key` flood (memory driver) | HT-08                |
| **SCAL-HF-04** | OOM — validation queue closures     | Burst >> scheduler drain                       | NN-04                |
| **SCAL-HF-05** | OOM — metrics label cardinality     | Unbounded custom labels                        | MET-API-01           |
| **SCAL-HF-06** | OOM/stall — large JSON              | Multi-MiB POST بدون 413                        | Event-loop High      |
| **SCAL-HF-07** | OOM — Sonic-Boom buffer             | High RPS + slow log sink                       | FOF-LOG-01           |
| **SCAL-HF-08** | Event-loop stall — `finish` logging | 503/200 storm + full buffer                    | FOF-LOG-02           |
| **SCAL-HF-09** | Process crash — pipe `error`        | EAGAIN storm                                   | §11.3                |
| **SCAL-HF-10** | Cross-tenant CPU/pool DoS           | A bulk @ allowed RPS                           | NN-01, NN-02         |
| **SCAL-HF-11** | Redis fail-closed **500**           | `REDIS_URL` blip                               | RL-DOS-04, SH-GAP-13 |
| **SCAL-HF-12** | Sync domain handler blocks process  | Heavy `publishDomainEvent` subscriber          | OB-COND-01           |

---

## Scalability Debt (SCAL-DEBT — معماری معوق)

| ID               | Item                                      | Closes                  |
| ---------------- | ----------------------------------------- | ----------------------- |
| **SCAL-DEBT-01** | Per-tenant DB connection semaphore        | NN-02, PS-02            |
| **SCAL-DEBT-02** | Validation worker pool + time budget      | NN-01, NN-04, EL High   |
| **SCAL-DEBT-03** | HTTP body size limit (413)                | NN-07, large JSON       |
| **SCAL-DEBT-04** | `REDIS_URL` + cache theme lookup          | RL-DOS-01/02            |
| **SCAL-DEBT-05** | Enforce `STORAGE_DRIVER=prisma` prod      | DI-MEM-01, AUDIT-GAP-01 |
| **SCAL-DEBT-06** | Validation queue max depth + shed         | NN-04, BULK-UNSAFE-01   |
| **SCAL-DEBT-07** | Defer access logs off sync `finish`       | FOF-LOG-02, LOG-BP-03   |
| **SCAL-DEBT-08** | Logging backpressure contract             | FOF-LOG-01/03           |
| **SCAL-DEBT-09** | Bulk import concurrency cap / job API     | NN-05                   |
| **SCAL-DEBT-10** | Outbox relay per-tenant budget            | NN-03, NN-06            |
| **SCAL-DEBT-11** | Idempotency memory TTL + LRU              | HT-08                   |
| **SCAL-DEBT-12** | Registry cache max-size sweep             | RL-DOS-03               |
| **SCAL-DEBT-13** | Victim SLO: bulk import ∥ B login/read    | NN gap                  |
| **SCAL-DEBT-14** | 100-tenant rate-limiter probe CI          | RL-DOS gap              |
| **SCAL-DEBT-15** | Cold-start gate @ 500 ms (`dist/main.js`) | CS-UNSC-01/02           |

---

## باگ‌ها و آسیب‌پذیری‌ها

### Noisy Neighbor (NN — Tenant A bulk → B login/read)

| ID        | Sev      | Shared resource         | B impact                     | Trigger A                     |
| --------- | -------- | ----------------------- | ---------------------------- | ----------------------------- |
| **NN-01** | **High** | Event loop (RuleEngine) | Degraded health/config/tours | 1000+ validations / bulk POST |
| **NN-02** | **High** | App DB pool             | **503** `GET /tours/:id`     | 10+ parallel canonical TX     |
| **NN-03** | Medium   | Admin pool              | tenant-config slow/503       | Outbox relay + registry miss  |
| **NN-04** | Medium   | `tenantQueues`          | B POST queued behind A       | Unbounded enqueue             |
| **NN-05** | Medium   | HTTP persist            | No bulk quota                | Sustained POST @ 50/s         |
| **NN-06** | Medium   | Relay + admin pool      | p99 admin reads              | 100+ tours/import             |
| **NN-07** | Medium   | Event loop (JSON)       | B reads lag                  | Large POST bodies             |
| **NN-08** | Low      | Health priority         | health latency only          | Extreme CPU monolith          |

### Rate limiter DoS (RL-DOS)

| ID            | Sev      | Problem                                                       |
| ------------- | -------- | ------------------------------------------------------------- |
| **RL-DOS-01** | **High** | Uncached admin `tenant.findUnique` every rate-limited request |
| **RL-DOS-02** | Medium   | Unbounded `RateLimiterMemory` keys (rotating UUIDs)           |
| **RL-DOS-03** | Medium   | No negative cache for missing UUID tenants                    |
| **RL-DOS-04** | Medium   | Redis blip → **500** fail-closed on all limited routes        |

### Event-loop blockers (خلاصه — 18 ردیف در سند)

| Priority rows | File                                                       | Issue                                  |
| ------------- | ---------------------------------------------------------- | -------------------------------------- |
| **P0**        | `canonical-validation.ts`, `pre-transaction-validation.ts` | Sync RuleEngine >10 ms under burst     |
| **P0**        | `http/json.ts`                                             | Full-buffer parse/stringify large JSON |
| **P1**        | `request-logging.ts`, `error-interceptor.ts`               | Sync `finish` + 500 log storm          |
| **P1**        | `tours.routes.ts`                                          | Duplicate parse + hash before Zod      |

### Shared-state races (RACE — 6 High)

| ID          | Sev      | Shared state                         | Hazard                           |
| ----------- | -------- | ------------------------------------ | -------------------------------- |
| **RACE-01** | **High** | `resolveEffectiveRateLimitForTenant` | Admin pool contention            |
| **RACE-02** | **High** | `MemoryRateLimiterStore`             | Unbounded key growth             |
| **RACE-03** | **High** | `memoryByKey` idempotency            | check-then-set race              |
| **RACE-04** | **High** | `tenantQueues`                       | Deep queue while cap stalls      |
| **RACE-05** | **High** | `domainBus.emit`                     | Sync publish stalls loop         |
| **RACE-06** | **High** | `InMemoryTourRepository`             | Shared singleton (memory driver) |

### Logging — Fatal Observability Flaws (FOF-LOG)

| ID             | Sev       | Problem                                                   |
| -------------- | --------- | --------------------------------------------------------- |
| **FOF-LOG-01** | **Fatal** | No backpressure/drop policy — unbounded Sonic-Boom buffer |
| **FOF-LOG-02** | **Fatal** | HTTP `finish` → sync `logger.info` on event loop          |
| **FOF-LOG-03** | **Fatal** | Shutdown بدون `logger.flush` — tail loss on SIGTERM       |

### Cold-start Unscalable (CS-UNSC)

| ID             | Component                      | p95 (ms) | Root cause                           |
| -------------- | ------------------------------ | -------: | ------------------------------------ |
| **CS-UNSC-01** | Full `main.ts` → `/health`     | **2084** | ESM import + tsx transpile           |
| **CS-UNSC-02** | `cold-start-http-worker` ready |  **794** | platform-core + workspace-sdk subset |

### Outbox 10k — conditional (not failure @ tested load)

| ID             | Risk                                         | Note                       |
| -------------- | -------------------------------------------- | -------------------------- |
| **OB-COND-01** | Sync `publishDomainEvent`                    | Latent if subscriber heavy |
| **OB-COND-02** | Admin pool vs HTTP under 16 parallel publish | I/O contention             |

**OB-SSF (System Scalability Failure):** **0** @ 10k measured load.

---

## Accepted risks (waived — با monitoring)

| ID                     | Risk                            | دلیل پذیرش             |
| ---------------------- | ------------------------------- | ---------------------- |
| **Pool leak post-500** | `connectionLeakSuspected=false` | Gate proven            |
| **FOF-LOG-03**         | Tail loss SIGTERM               | Low freq vs OOM        |
| **CS-UNSC**            | Readiness not crash             | Scale-to-zero debt     |
| **OB-COND-\***         | Relay pass @ 10k                | Monitor subscriber CPU |
| **Engine LRU 8**       | Bounded cache                   | Soak pass              |

---

## پیشنهادات و اصلاحات (اولویت‌بندی یکپارچه)

### فوری (قبل از multi-tenant prod)

1. **SCAL-DEBT-01/02/03/04/06** — pool semaphore، validation workers، body limit، registry cache on limiter، queue depth.
2. **NN-01/02** + **SCAL-HF-10** — CPU + pool noisy-neighbor mitigation.
3. **RL-DOS-01** — حذف admin storm per rate-limit check.
4. **SCAL-HF-11** / **RL-DOS-04** — Redis fail-open policy (phase5 SH-GAP-13).

### کوتاه‌مدت (P1)

5. **SCAL-DEBT-07/08** + **FOF-LOG-01…03** — defer logs، Pino destination، shutdown flush.
6. **SCAL-DEBT-13/14** — victim SLO spec + 100-tenant limiter CI.
7. **SCAL-DEBT-15** — cold-start gate on compiled `dist/main.js`.
8. **RACE-01…05** — بسته به موارد بالا.

### میان‌مدت (P2/P3)

9. **SCAL-DEBT-09/10** — bulk job API؛ outbox per-tenant budget.
10. Slow-sink logging stress (LOG-BP-03 adversarial re-run).
11. **OB-COND-01** — async/light domain handlers.
12. Lazy `import()` heavy routes — shrink CS-UNSC-01 graph.

---

## تأیید شده (PASS — نیاز به اقدام فوری نیست)

| Area                      | Evidence                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Pool 503 storm**        | `db-pool-saturation.spec.ts`, `pool-stress-500-parallel.ts` — 460×503, heartbeat alive |
| **Pre-TX off pool**       | `long-tx-safety.spec.ts`, DEC-013                                                      |
| **Outbox 10k**            | `outbox-throughput.spec.ts` — 233 eps; p95 ratio 3.19×                                 |
| **Outbox memory/conn**    | `outbox-relay-memory.spec.ts`, `outbox-relay-connection-leak.spec.ts`                  |
| **Validation gate HT-03** | `validation-gate-concurrency.spec.ts`                                                  |
| **Soak heap**             | `soak-memory-leak.spec.ts` (RUN_SOAK=1)                                                |
| **Sync fs/crypto**        | Grep baseline — none in `src/`                                                         |
| **RLS data isolation**    | NN + bulk — no cross-tenant bleed                                                      |

---

## Appendix A — Break-point table (خلاصه)

| Failure mode          | Approx limit                              | Character          |
| --------------------- | ----------------------------------------- | ------------------ |
| DB pool saturation    | ~10 concurrent long TX · ~40 RPS @ 250 ms | **Graceful** 503   |
| Per-tenant rate limit | 50 RPS/tenant                             | **Graceful** 429   |
| 100-tenant ID flood   | 100 concurrent admin reads                | **DoS**            |
| CPU noisy neighbor    | 1000 validations                          | **Degraded**       |
| Outbox 10k + HTTP     | 233 eps · 20 POST OK                      | **Pass**           |
| Cold start            | p95 **2084 ms** full boot                 | **Unscalable**     |
| Large JSON            | Multi-MiB                                 | **Degraded → OOM** |

---

## Appendix B — Stress-test evidence matrix

| Spec / script                         | Stress                     | Pass signal                           |
| ------------------------------------- | -------------------------- | ------------------------------------- |
| `db-pool-saturation.spec.ts`          | 100 parallel hold          | 503 + heartbeat ≥8                    |
| `pool-stress-500-parallel.ts`         | 500 parallel               | 460×503, no leak                      |
| `noisy-neighbor-latency.spec.ts`      | 1000 validations ∥ 1 write | ratio ≤1.10                           |
| `noise-neighbor.spec.ts`              | 500 reads ∥ 1 write        | write ≤4× baseline                    |
| `outbox-throughput.spec.ts`           | 10k + 20 creates           | 233 eps; 3.19× p95                    |
| `tenant-rate-limiting.spec.ts`        | 100 burst + victim         | B ≤2× p50                             |
| `cold-start-latency.spec.ts`          | Fresh engine + TTFB        | ≤1000 ms spec; §12 flags 2 Unscalable |
| `log-backpressure-burst.ts`           | 1000 `/health` @ c=100     | fast stdout baseline                  |
| `validation-gate-concurrency.spec.ts` | 2 tenants pre-TX           | independent gates                     |

---

## Regression pack (verification commands)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

# Pool storm
npx tsx scripts/pool-stress-500-parallel.ts
node --import tsx --test test/3-performance/db-pool-saturation.spec.ts

# Noisy neighbor + fairness
node --import tsx --test test/3-performance/noisy-neighbor-latency.spec.ts
node --import tsx --test test/2-observability/noise-neighbor.spec.ts
node --import tsx --test test/4-integration/bulk-import-consistency.spec.ts

# Outbox 10k
node --import tsx --test test/3-performance/outbox-throughput.spec.ts
node --import tsx --test test/chaos/outbox-relay-memory.spec.ts
npx tsx scripts/reliability-outbox-relay-profile.ts

# Rate limiter
node --import tsx --test test/3-performance/tenant-rate-limiter.spec.ts
node --import tsx --test test/3-performance/tenant-rate-limiting.spec.ts
node --import tsx --test test/3-performance/redis-rate-limiter.spec.ts

# Races + validation gate
node --import tsx --test test/1-functional/validation-gate-concurrency.spec.ts
node --import tsx --test test/1-functional/concurrent-tour-logic.spec.ts

# Cold-start
node --import tsx --test test/3-performance/cold-start-latency.spec.ts
# COLD_START_HTTP_EMIT=1 for JSON report

# Logging backpressure (fast sink)
NODE_ENV=test npx tsx scripts/log-backpressure-burst.ts

# Soak (optional nightly)
RUN_SOAK=1 node --import tsx --test test/3-performance/soak-memory-leak.spec.ts
```

---

## شمارش نهایی

| دسته                         |       تعداد |
| ---------------------------- | ----------: |
| Verdict                      | CONDITIONAL |
| Hard-Fail (SCAL-HF)          |          12 |
| Scalability Debt (SCAL-DEBT) |          15 |
| Noisy Neighbor (NN)          |  8 (3 High) |
| Rate limiter DoS (RL-DOS)    |           4 |
| Event-loop blocker rows      |          18 |
| RACE (High / total)          |      6 / 30 |
| FOF-LOG Fatal                |           3 |
| Cold-start Unscalable        |           2 |
| OB-SSF @ 10k                 |           0 |
| تناقض/ابهام (CON)            |           7 |
| Must-Fix actions (P0+P1)     |           9 |

---

## پیوند به auditهای دیگر

| موضوع                  | سند                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| Tenant isolation / ALS | [`phase1-aggressive-audit-fix-list.md`](phase1-aggressive-audit-fix-list.md) |
| Observability / LOG-BP | [`phase2-paranoid-audit-fix-list.md`](phase2-paranoid-audit-fix-list.md)     |
| Resilience / shutdown  | [`phase4-resilience-audit-fix-list.md`](phase4-resilience-audit-fix-list.md) |
| Self-Heal / SH-GAP-13  | [`phase5-evolution-audit-fix-list.md`](phase5-evolution-audit-fix-list.md)   |

---

## Document metadata

| Item               | Value                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Output path**    | `TEMP/phase3-scalability-stress-audit-fix-list.md`                                                                          |
| **Code changes**   | None (`docs/TEMP` only)                                                                                                     |
| **Parent handoff** | `verdict=CONDITIONAL` · `hard_fail_count=12` · `scalability_debt_count=15` · `nn_vuln_count=8` · `rl_dos_count=4`           |
| **Architect note** | Documentation status: **Updated** (extracted from existing audit). Link: `TEMP/phase3-scalability-stress-audit-fix-list.md` |

_این فایل استخراج از `phase3-scalability-stress-audit.md` است و جایگزین سند منبع نیست. برای جزئیات کامل به سند اصلی مراجعه کنید._
