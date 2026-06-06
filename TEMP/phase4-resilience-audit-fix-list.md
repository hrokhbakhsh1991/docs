# Phase 4 — نقشه ۹.۵+ با راهکارهای Enterprise (پیاده‌سازی روی app-tour)

**منبع audit:** [`apps/api/docs/phase4-resilience-audit.md`](../apps/api/docs/phase4-resilience-audit.md)  
**به‌روزرسانی:** 2026-06-05  
**هدف:** نمره پیاده‌سازی **≥ ۹.۵/۱۰ (۹۵+)** — هم‌تراز Stripe/Shopify-class SaaS backend patterns  
**قانون سخت:** **Postgres واقعی اجباری در هر gate** — `skip`، `databaseUrlSet: false`، یا `# SKIP` در integration = **رد**

---

## ۱. وضعیت و هدف

| بعد                       |         الان |                      هدف ۹.۵+ |
| ------------------------- | -----------: | ----------------------------: |
| Resilience (DEC-071…079)  |       ۷۸/۱۰۰ |                          ≥ ۹۵ |
| Modular Phase 4 (4.0→4.6) | ۲۹٪ VERIFIED | ۱۰۰٪ + `phase-4:gate ok:true` |
| Degradation pillar        |        ~۶/۱۰ |                        ≥ ۹/۱۰ |
| Trunk / CI truth          |        ~۵/۱۰ |                         ۱۰/۱۰ |

**Baseline انجام‌شده (نگه دارید):** DEC-071…079 — reclaim، pairing، proxy timeout، shutdown await، canonical TX now، PATCH drift spec، resilience gate (با نقص Postgres).

---

## ۲. معیار قبولی نهایی (رد = fail)

```yaml
pass_95:
  postgres:
    DATABASE_URL: required # app_tour + RLS
    DATABASE_URL_ADMIN: required # postgres owner
    STORAGE_DRIVER: prisma
    zero_skip_in_gate: true # هیچ describe.skip برای DB
  gates:
    - phase-4:resilience-regression-gate # MUST databaseUrlSet: true
    - phase-4:gate # MUST ok: true (10/10)
    - phase-4:cross-phase-p0-verify # postgres tier اجباری
  artifacts:
    - IMPLEMENTATION-TRUTH.md → 7/7 VERIFIED
    - phase-4-zero-debt-forensic-audit.mdoc → Zero-Debt Verified
  ci:
    - Testcontainers یا service Postgres در GitHub Actions (نه optional)
    - prisma migrate + RLS policies قبل از integration specs
```

**Env استاندارد:**

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test
```

---

## ۳. مرجع‌های Enterprise (برای ایده‌گیری)

| حوزه                    | مرجع industry                     | پروژه/استاندارد قابل الگو                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outbox + reclaim        | Lease recovery قبل از DLQ         | [CodeNotes Outbox](https://codenotes.tech/blog/transactional-outbox-pattern-in-microservices) · [JusDB Outbox](https://www.jusdb.com/blog/transactional-outbox-pattern-event-publishing)                                                                         |
| FIFO per tenant         | Partition key + NOT EXISTS guard  | [SimpleOutbox](https://github.com/alexandrereyes/SimpleOutbox) · [OutboxNet](https://github.com/outboxnet/OutboxNet) · [SqlTransactionalOutbox](https://github.com/cajuncoding/SqlTransactionalOutbox)                                                           |
| Failed events / DLQ     | Terminal state + admin replay     | [Confluent DLQ guide](https://www.confluent.io/learn/kafka-dead-letter-queue/) · [Conduktor DLQ ops](https://www.conduktor.io/glossary/dead-letter-queues-for-error-handling)                                                                                    |
| Rate limit + Redis blip | fail_local / tiered policy        | [FluxRate](https://github.com/ayd1ndemirci/fluxrate) · [aws-rate-limiter failure modes](https://github.com/sanskari27/aws-rate-limiter/blob/main/docs/08-failure-modes.md)                                                                                       |
| CI Postgres             | Ephemeral real DB per suite       | [Testcontainers PostgreSQL](https://node.testcontainers.org/modules/postgresql/) · [Nikola Milovic Vitest pattern](https://nikolamilovic.com/posts/integration-testing-node-postgres-vitest-testcontainers/)                                                     |
| Graceful shutdown       | keep-alive drain + hard timeout   | [Grizzly Peak shutdown](https://www.grizzlypeaksoftware.com/library/graceful-shutdown-in-nodejs-applications-4rmcu5d5) · [K8s preStop pattern](https://dev.to/axiom_agent/nodejs-graceful-shutdown-the-right-way-sigterm-connection-draining-and-kubernetes-fp8) |
| Circuit breaker + fetch | Opossum (Red Hat)                 | [nodeshift/opossum](https://github.com/nodeshift/opossum) — شما DEC-075 دارید؛ wire + metrics                                                                                                                                                                    |
| Cache invalidation      | Cache-aside + invalidate-on-write | [Microsoft cache-aside](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) · [Redis node invalidation](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/)                                                               |
| Schema evolution        | Expand–Contract (Fowler)          | [Martin Fowler Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) · [Prisma expand-contract](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern)                                                                     |
| Idempotency timestamps  | DB authority نه wall clock        | [FlowVerify idempotency](https://www.flowverify.co/blog/idempotency-keys-concurrent-pattern) · [Cockroach event ordering](https://www.cockroachlabs.com/blog/idempotency-and-ordering-in-event-driven-systems/)                                                  |

---

## ۴. موج A — Postgres اجباری در Gate (P0 · بدون این رد)

### GAP-95-A01 — Resilience gate بدون Postgres

|                        |                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **مشکل**               | آخرین `phase-4-resilience-regression-gate` با `databaseUrlSet: false` — CLK-SKEW-08، dynamic-config، outbox integration skip                                                                     |
| **Enterprise pattern** | Testcontainers در CI + `fail if !DATABASE_URL` در gate script ([Testcontainers guide](https://qaskills.sh/blog/testcontainers-postgresql-node-complete-guide))                                   |
| **راهکار app-tour**    | 1) ابتدای `phase-4-resilience-regression-gate.mjs`: اگر `!DATABASE_URL` → `exit 1` با پیام فارسی/انگلیسی 2) tier Postgres همیشه اجرا (نه `if HAS_DATABASE`) 3) artifact `postgresRequired: true` |
| **فایل‌ها**            | `scripts/phase-4-resilience-regression-gate.mjs` · `scripts/guard-phase4-resilience-regression-gate.mjs` · `docs/phase-5/appendices/phase4-resilience-regression-gate.md`                        |
| **DEC**                | DEC-080                                                                                                                                                                                          |
| **قبولی**              | gate بدون env → exit 1؛ با Postgres → `databaseUrlSet: true` و ۰ skip                                                                                                                            |

### GAP-95-A02 — `phase-4:gate` و RLS

|                        |                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `p4_rls_integration_tests` fail وقتی `DATABASE_URL` unset ([`phase-4-gate-2026-06-05.json`](../reports/phase-4-gate-2026-06-05.json))                                                                 |
| **Enterprise pattern** | CI service container Postgres + migrate + seed ([CLOSURE-CHECKLIST](../docs/phase-4/audits/CLOSURE-CHECKLIST.md) §B)                                                                                  |
| **راهکار app-tour**    | 1) `.github/workflows` یا `ci:integrity`: Postgres قبل از `phase-4:gate` 2) `docker compose -f infra/docker-compose.yml up -d` در doc gate 3) guard: `phase-4-guard.mjs` نباید ok:true بدون RLS در CI |
| **DEC**                | DEC-081                                                                                                                                                                                               |
| **قبولی**              | `pnpm run phase-4:gate` → 10/10 PASS با env استاندارد                                                                                                                                                 |

### GAP-95-A03 — Cross-phase verify Postgres اختیاری

|                     |                                                     |
| ------------------- | --------------------------------------------------- |
| **مشکل**            | `db-pool-saturation.spec.ts` فقط با `DATABASE_URL`  |
| **راهکار app-tour** | همان DEC-080 — یک policy برای همه gateهای Phase 3/4 |
| **DEC**             | DEC-080 (همان)                                      |

### GAP-95-A04 — Outbox integration `# SKIP` بدون DB

|                        |                                                                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `outbox-processing-reclaim.spec.ts` / `outbox-publish-done-pairing.spec.ts` — integration block skip                                                                                                                                                |
| **Enterprise pattern** | Relay integration با `FOR UPDATE SKIP LOCKED` تحت RLS ([SimpleOutbox](https://github.com/alexandrereyes/SimpleOutbox))                                                                                                                              |
| **راهکار app-tour**    | 1) حذف `hasDatabase ? … : SKIP` در gate path — gate خودش Postgres می‌دهد 2) اضافه به `phase4-resilience-postgres-specs`: `outbox-relay.integration.spec.ts` · `outbox-transactional.integration.spec.ts` 3) multi-worker claim spec با ۲ connection |
| **فایل‌ها**            | specهای outbox · gate script                                                                                                                                                                                                                        |
| **DEC**                | DEC-082                                                                                                                                                                                                                                             |
| **قبولی**              | reclaim + pairing + relay تحت RLS در gate سبز                                                                                                                                                                                                       |

### GAP-95-A05 — DEC-074 E2E hot-reload

|                        |                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `dynamic-config-sync.spec.ts` خارج از gate با Postgres                                                                                                |
| **Enterprise pattern** | Cache-aside: update DB → invalidate key → read sees new ([MS cache-aside](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)) |
| **راهکار app-tour**    | اجباری در postgres tier؛ assert بدون `resetTenantRegistryCacheForTests` در mid-load                                                                   |
| **DEC**                | DEC-082                                                                                                                                               |
| **قبولی**              | admin UPDATE theme → GET tenant-config فوری (نه بعد از 5s TTL)                                                                                        |

### GAP-95-A06 — CLK-SKEW DB در gate

|                     |                                                                          |
| ------------------- | ------------------------------------------------------------------------ |
| **مشکل**            | DEC-077 فقط unit در memory gate                                          |
| **راهکار app-tour** | `clock-skew-resilience.spec.ts` اجباری در postgres tier — CLK-SKEW-08/09 |
| **DEC**             | DEC-082                                                                  |

### GAP-95-A07 — Trunk / commit

|                        |                                                     |
| ---------------------- | --------------------------------------------------- |
| **مشکل**               | تغییرات Phase 3/4 uncommitted                       |
| **Enterprise pattern** | Gate artifact با `gitSha` + CI فقط روی merge commit |
| **راهکار app-tour**    | PR یکپارچه Phase 3+4؛ gate بعد از merge روی main    |
| **DEC**                | — (process)                                         |

---

## ۵. موج B — Residual audit با الگوی Enterprise (P0)

### SH-GAP-13 — Redis blip → 500

|                        |                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `SCAL-HF-11` — fail-closed روی rate-limited routes                                                                                                                                                                                                                                                              |
| **Enterprise pattern** | **Tiered failure policy:** `fail_closed` برای auth/payment، `fail_local` برای tour writes، `fail_open` برای public read ([aws-rate-limiter doc](https://github.com/sanskari27/aws-rate-limiter/blob/main/docs/08-failure-modes.md))                                                                             |
| **راهکار app-tour**    | 1) `TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY=fail_local` (default برای `POST/PATCH /tours`) 2) in-memory per-process window وقتی Redis timeout (مثل FluxRate fallback) 3) circuit: ۳ خطا → 30s open 4) metric `rate_limiter_redis_fallback_total` 5) spec adversarial: Redis down → **429/503 ساخت‌یافته** نه 500 |
| **فایل‌ها**            | `tenant-rate-limiter.ts` · spec جدید · guard · appendix                                                                                                                                                                                                                                                         |
| **DEC**                | DEC-083                                                                                                                                                                                                                                                                                                         |
| **قبولی**              | Redis قطع → tour write همچنان bounded (local)؛ هرگز `internal_error`                                                                                                                                                                                                                                            |

### CLK-F-03 — Terminal timestamps

|                        |                                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `markOutboxDone` / idempotency `completedAt` از app `new Date()`                                                                                                                                     |
| **Enterprise pattern** | DB authority برای forensic + idempotency ([FlowVerify](https://www.flowverify.co/blog/idempotency-keys-concurrent-pattern): `created_at TIMESTAMPTZ DEFAULT now()`)                                  |
| **راهکار app-tour**    | 1) `markOutboxDone`: `UPDATE … SET processed_at = now()` (SQL) 2) idempotency terminal: `completed_at = now()` در Prisma raw یا `$executeRaw` 3) همان `readCanonicalTransactionNow` برای consistency |
| **فایل‌ها**            | `outbox-mark-done.ts` · `http-idempotency.ts` (prisma path)                                                                                                                                          |
| **DEC**                | DEC-084                                                                                                                                                                                              |
| **قبولی**              | terminal timestamps در بازه DB window در integration spec                                                                                                                                            |

### CLK-F-04 — JWT ±5s spec

|                     |                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------- |
| **مشکل**            | فقط ±5min تست شده                                                                  |
| **راهکار app-tour** | `CLK-SKEW-10` در `clock-skew-resilience.spec.ts` — exp دقیقاً 5s قبل/بعد tolerance |
| **DEC**             | DEC-084                                                                            |

### SD-G4 — Shutdown watchdog

|                        |                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | `server.close` ممکن است forever hang (keep-alive)                                                                                                                                                                                         |
| **Enterprise pattern** | Hard timeout + destroy idle sockets ([Grizzly Peak](https://www.grizzlypeaksoftware.com/library/graceful-shutdown-in-nodejs-applications-4rmcu5d5)) · Node 19+ `close()` بسته idle ([Node HTTP](https://nodejs.org/api/http.html))        |
| **راهکار app-tour**    | 1) `server.closeIdleConnections()` در shutdown (Node 18.2+) 2) `GRACEFUL_SHUTDOWN_HTTP_MS` — بعد از آن `connections.destroy()` 3) health → 503 بلافاصله هنگام shutdown (K8s pattern) 4) metric `graceful_shutdown_http_force_close_total` |
| **فایل‌ها**            | `graceful-shutdown.ts` · spec                                                                                                                                                                                                             |
| **DEC**                | DEC-085                                                                                                                                                                                                                                   |
| **قبولی**              | hung handler → exit 1 قبل از `terminationGracePeriodSeconds`                                                                                                                                                                              |

### SD-G5 — Logger flush

|                        |                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **مشکل**               | tail log روی SIGTERM گم می‌شود                                                                                                                                      |
| **Enterprise pattern** | Drain observability قبل از `disconnectPrisma` ([phase3 LOG-BP](apps/api/docs/phase3-scalability-stress-audit.md))                                                   |
| **راهکار app-tour**    | `await flushLogSink()` بعد از HTTP close، قبل از outbox drain — ترتیب: relay stop → health 503 → server.close → **flushLogSink** → outbox drain → prisma disconnect |
| **DEC**                | DEC-085                                                                                                                                                             |

### SD-G7 — SIGINT parity

|                     |                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **راهکار app-tour** | `graceful-shutdown-worker.ts` فقط `runGracefulShutdown` import — بدون duplicate logic؛ test برای SIGINT |
| **DEC**             | DEC-085                                                                                                 |

---

## ۶. موج C — Recovery و Ops (P1)

### F-03 — Outbox `failed` + replay

|                        |                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Enterprise pattern** | DLQ + admin replay با payload immutable ([Confluent DLQ](https://www.confluent.io/learn/kafka-dead-letter-queue/))                                                                                                                                           |
| **راهکار app-tour**    | 1) status `failed` با `last_error` JSON (already partial) 2) internal `POST /internal/outbox/:id/replay` (non-prod + admin) → `pending` 3) CLI `pnpm run outbox:replay-failed --tenant=X` 4) spec INT-SAGA-03 heal 5) **نه** auto-retry بی‌نهایت برای poison |
| **DEC**                | DEC-086                                                                                                                                                                                                                                                      |

### F-15 / BL-01 — FIFO per tenant

|                        |                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | `partition_key = tenantId` + claim guard که row قبلی همان partition در `processing` نباشد ([OutboxNet ordered processing](https://github.com/outboxnet/OutboxNet))                                                                                                                                            |
| **راهکار app-tour**    | 1) env `OUTBOX_RELAY_ORDERED_PER_TENANT=true` 2) claim query: `AND NOT EXISTS (SELECT 1 FROM outbox_events o2 WHERE o2.tenant_id = $t AND o2.status = 'processing')` یا serialize per-tenant batch size=1 3) relay `occurredAt` از `created_at` (DEC-077) 4) spec: دو event هم‌tenant → publish order حفظ شود |
| **DEC**                | DEC-087                                                                                                                                                                                                                                                                                                       |

### F-04 — Projection reconcile (OZ-D)

|                     |                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **راهکار app-tour** | metric `outbox_projection_lag_seconds` + optional job `reconcile-tour-projection` (read canonical vs projection column) |
| **DEC**             | DEC-088                                                                                                                 |

### CASCADE-01 — NN victim SLO با Postgres

|                     |                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **راهکار app-tour** | `bulk-import-victim-slo` + `noisy-neighbor-latency` در postgres gate pack؛ victim p95 < SLO ثبت‌شده |
| **DEC**             | DEC-082                                                                                             |

### OZ-A / F-10 — SIGKILL chaos

|                        |                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Chaos subprocess + assert no orphan commit (already partial)                                              |
| **راهکار app-tour**    | gate postgres tier شامل `atomic-rollback-stress.spec.ts`؛ alert اگر `processing` > threshold بعد از chaos |
| **DEC**                | DEC-089                                                                                                   |

---

## ۷. موج D — Coherence (P1)

### PU-F-02 / PU-03 / PU-06 — Cache coherence

|                        |                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Cache-aside + **invalidate-on-write** + TTL as safety net ([Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/)) · tenant-prefixed keys `tenant:{id}:*`                                                                      |
| **راهکار app-tour**    | 1) همه reads از `resolveTenantRegistry` — نه mix cache/DB 2) `updateTenantRegistryRow` → `invalidateTenantRegistryCache` (DEC-074) — تست race دو reader 3) optional: Redis pub/sub برای multi-pod (آینده) — فعلاً single-pod + invalidation کافی برای ۹.۵ trunk |
| **DEC**                | DEC-090                                                                                                                                                                                                                                                         |

### SV-F-04 — Schema migration

|                        |                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | **Expand–Contract** (Fowler) — نه big-bang `migrateCanonical` ([Prisma guide](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern))                          |
| **راهکار app-tour**    | 1) Phase 4: `migrateCanonicalHook` → explicit reject + telemetry 2) Phase 6: expand (dual-write) → backfill job → contract 3) workspace bump: implicit default به current + spec bump |
| **DEC**                | Phase 6 (DEC-091 placeholder)                                                                                                                                                         |

### SV-11 — Malformed JSON → 400

|                        |                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Parse layer قبل از domain ([API backward compat](https://asoasis.tech/articles/2026-03-27-0253-api-backward-compatibility-strategies/)) |
| **راهکار app-tour**    | `try/catch JSON.parse` در routes → `400` + `code: INVALID_JSON`                                                                         |
| **DEC**                | DEC-092                                                                                                                                 |

### PI-02 / PI-03 — Proxy production path

|                        |                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Opossum per upstream host ([nodeshift/opossum](https://github.com/nodeshift/opossum)) — شما DEC-075 دارید                       |
| **راهکار app-tour**    | 1) wire `TenantHttpProxy` در DI `main.ts` 2) `theme.proxyTimeoutMs` / env override 3) integration spec روی مسیر واقعی map proxy |
| **DEC**                | DEC-093                                                                                                                         |

---

## ۸. موج E — Modular Phase 4 → VERIFIED (P2)

| Subphase | Enterprise analogue                         | اقدام app-tour                                            | DEC     |
| -------- | ------------------------------------------- | --------------------------------------------------------- | ------- |
| **4.0**  | Red-flag CI gate (P4-E-RF-40)               | `prove_with` executable + human signoff در report         | DEC-094 |
| **4.1**  | JWT host contract (Auth0/Clerk style)       | tenant-kernel `prove_with` + ledger VERIFIED              | DEC-095 |
| **4.4**  | Multi-tenant theme CDN                      | TH-1 e2e: tenant A accent ≠ B روی GET config              | DEC-096 |
| **4.5**  | Domain events (Shopify/Stripe internal bus) | TourCreated E2E: persist → relay → subscriber با Postgres | DEC-097 |
| **4.6**  | Platform gate (مثل internal `ci:integrity`) | `phase-4:gate` سبز پایدار + forensic Zero-Debt            | DEC-098 |

---

## ۹. موج F — Rule Engine + Observability (۹.۵+ سخت‌گیرانه)

### HF-RE-01…16 — Reactive degrade

|                        |                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Circuit breaker روی validation engine + fallback variant ([Resilience4j-style](https://github.com/nodeshift/opossum) برای CPU path)                                                                               |
| **راهکار app-tour**    | 1) اگر `validateCanonical` throw/timeout → یک بار retry با `basic` variant 2) اگر باز fail → `503 VALIDATION_ENGINE_UNAVAILABLE` (نه 500) 3) metric `validation_engine_degrade_total` 4) **نه** silent wrong data |
| **DEC**                | DEC-099                                                                                                                                                                                                           |

### FOF-LOG + nightly

|                     |                                                                              |
| ------------------- | ---------------------------------------------------------------------------- |
| **راهکار app-tour** | `log-slow-sink-adversarial` در weekly CI؛ shutdown spec با slow sink + flush |
| **DEC**             | DEC-100                                                                      |

### event-backlog 1000 rows

|                        |                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise pattern** | Soak / backlog replay ([Confluent ordering](https://www.cockroachlabs.com/blog/idempotency-and-ordering-in-event-driven-systems/)) |
| **راهکار app-tour**    | `TEST_TIER=nightly` در scheduled workflow — نه optional local                                                                      |
| **DEC**                | DEC-100                                                                                                                            |

---

## ۱۰. ترتیب اجرا و تخمین نمره

```text
فاز 1  DEC-080…082  Postgres اجباری + integration pack (رد فوری)
فاز 2  DEC-083…085  Redis fail_local + timestamps + shutdown hardening
فاز 3  DEC-086…089  DLQ replay + FIFO + chaos/postgres
فاز 4  DEC-090…093  Cache E2E + JSON 400 + proxy wire
فاز 5  DEC-094…098  Modular 4.0→4.6 VERIFIED
فاز 6  DEC-099…100  RE degrade + nightly soak
```

| بعد از فاز |        نمره |
| ---------- | ----------: |
| الان       |         ۷.۸ |
| فاز ۱      |         ۸.۷ |
| فاز ۲      |         ۹.۲ |
| فاز ۳      |         ۹.۴ |
| فاز ۴      |         ۹.۶ |
| فاز ۵+۶    | **۹.۷–۹.۸** |

---

## ۱۱. Gate نهایی ۹.۵+ (همه PASS — هر fail = رد)

```bash
# پیش‌نیاز: Postgres بالا
docker compose -f infra/docker-compose.yml up -d
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test

cd apps/api
pnpm run phase-4:resilience-regression-gate   # MUST: databaseUrlSet: true
cd ../.. && pnpm run phase-4:gate              # MUST: ok: true

# Postgres integration pack (کامل)
cd apps/api && node --import tsx --test --test-concurrency=1 \
  test/outbox-transactional.integration.spec.ts \
  test/outbox-relay.integration.spec.ts \
  test/rls-isolation.integration.spec.ts \
  test/4-integration/saga-rollback.spec.ts \
  test/4-integration/event-backlog-recovery.spec.ts \
  test/4-integration/graceful-shutdown.spec.ts \
  test/4-integration/dynamic-config-sync.spec.ts \
  test/4-integration/clock-skew-resilience.spec.ts \
  test/4-integration/bulk-import-consistency.spec.ts \
  test/3-performance/noisy-neighbor-latency.spec.ts \
  test/3-performance/bulk-import-victim-slo.spec.ts \
  src/outbox/outbox-processing-reclaim.spec.ts \
  src/outbox/outbox-publish-done-pairing.spec.ts
```

---

## ۱۲. جدول DEC پیشنهادی (فاز ۹.۵+)

| DEC         | موضوع                                                    | موج |
| ----------- | -------------------------------------------------------- | --- |
| DEC-080     | Postgres required در همه resilience/cross-phase gates    | A   |
| DEC-081     | CI Postgres service + phase-4:gate سبز                   | A   |
| DEC-082     | Postgres integration pack (outbox/RLS/config/clock/bulk) | A   |
| DEC-083     | Redis fail_local tiered policy                           | B   |
| DEC-084     | SQL `now()` terminal + CLK-SKEW-10                       | B   |
| DEC-085     | Shutdown watchdog + log flush + SIGINT                   | B   |
| DEC-086     | Outbox failed replay tooling                             | C   |
| DEC-087     | Per-tenant ordered relay                                 | C   |
| DEC-088     | Projection reconcile metric/job                          | C   |
| DEC-089     | Chaos SIGKILL postgres gate                              | C   |
| DEC-090     | Cache single read path + race spec                       | D   |
| DEC-091     | Expand–contract migration (Phase 6)                      | D   |
| DEC-092     | Malformed JSON 400                                       | D   |
| DEC-093     | Proxy DI wire + per-tenant timeout                       | D   |
| DEC-094…098 | Modular subphase VERIFIED                                | E   |
| DEC-099…100 | RE degrade + nightly soak                                | F   |

---

## ۱۳. metadata

| Item                | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **هدف**             | ≥ ۹.۵/۱۰ (۹۵+)                                                             |
| **حکم فعلی**        | `CLOSURE_PASS_WITH_RESIDUAL` — ناکافی                                      |
| **حکم هدف**         | `ENTERPRISE_PASS`                                                          |
| **فایل**            | `TEMP/phase4-resilience-audit-fix-list.md`                                 |
| **پیاده‌سازی بعدی** | از **DEC-080** (Postgres اجباری) — doc-first در `docs/phase-5/appendices/` |

---

_این سند نقشه کار + مرجع enterprise است. پیاده‌سازی هر DEC نیاز به appendix Markdoc + guard + spec با Postgres دارد._
