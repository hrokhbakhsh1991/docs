# Phase 4 Resilience Audit — Fix List

**Source:** [`apps/api/docs/phase4-resilience-audit.md`](../apps/api/docs/phase4-resilience-audit.md)  
**Generated:** 2026-06-05  
**Scope:** Saga/outbox relay, graceful shutdown, zombie events, feature flags, Rule Engine degradation, hot-reload config, proxy, schema drift, clock skew, bulk import coupling.

---

## خلاصه اجرایی (فارسی)

| مورد                               | مقدار                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| **حکم Chaos Report**               | **CONDITIONAL** — امتیاز تاب‌آوری **62/100**                                   |
| **Transactional integrity**        | **78** — tour + audit + outbox co-commit اثبات‌شده                             |
| **Degradation**                    | **58** — 503/429 خوب؛ gaps: NN, Redis 500, proxy hang                          |
| **Recovery**                       | **52** — backlog replay سبز؛ **بدون** reclaim `processing`                     |
| **Must-Fix (multi-tenant prod)**   | **8** مورد (F-01, F-02, F-05, PI-01, NN-01/02, RL-DOS-01, SCAL-HF-11, PU-F-01) |
| **Zombie-risk scenarios**          | **6**                                                                          |
| **Shutdown gaps**                  | **7** (SD-G1 … SD-G7)                                                          |
| **Schema drift critical 500**      | **0** — graceful 4xx/201                                                       |
| **Data Integrity Breach (replay)** | **0**                                                                          |
| **CASCADE scenarios**              | **3** (bulk brownout, deploy zombies, Redis blip)                              |

**جمع‌بندی:** یکپارچگی TX و idempotent replay قوی است؛ ریسک اصلی **outbox `processing` بدون reclaim** (deploy عادی → drift خاموش) و **noisy-neighbor** cross-tenant availability. قبل از scale-out: Must-Fix زیر را ببندید.

---

## Chaos Report — Pillar breakdown

| Pillar                      |  Score | خلاصه                                                          |
| --------------------------- | -----: | -------------------------------------------------------------- |
| **Transactional integrity** | **78** | Co-commit proven؛ gaps: publish≠`done` (F-02), SIGKILL (F-10)  |
| **Degradation**             | **58** | Pool 503 + 429؛ fail: NN CPU/pool, Redis 500, PI-01 latent     |
| **Recovery**                | **52** | No stale-`processing` reclaim (F-01); terminal `failed` (F-03) |
| **Config consistency**      | **64** | FF mid-burst pass؛ 5s TTL؛ E2E hot-reload not atomic           |
| **External dependencies**   | **55** | Postgres bounded؛ proxy latent؛ admin-pool amplification       |

---

## تناقضات و ابهامات در سند (نیاز به هم‌راستاسازی)

| ID         | محل در سند                                                                        | تناقض                                          | توضیح / اقدام پیشنهادی                                                        |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **CON-01** | `orphaned_tx_risk=no` (SIGTERM) vs `yes` (SIGKILL)                                | یک خط دو حکم                                   | عمدی — parent handoff هر دو را ذکر می‌کند؛ در PR «no» فقط برای graceful path. |
| **CON-02** | Schema drift **Pass** vs PATCH **Partial** / untested                             | POST proven؛ PATCH inferred                    | SV-F-03/04 accepted Phase 6 — تناقض نیست؛ یک ticket برای PATCH drift spec.    |
| **CON-03** | Feature-flag degradation **pass** (FF-F-05) vs Rule Engine hard-fail **16** paths | proactive basic OK؛ runtime fallback **no**    | دو لایه مختلف — doc باید «no reactive degrade» را bold کند.                   |
| **CON-04** | Proxy **PI-03 accepted** (not wired) vs **PI-01 Must-Fix**                        | deferred exposure vs systemic when wired       | PI-01 برای **وقتی** map routes wire شود — در wiring checklist اجباری کنید.    |
| **CON-05** | Shutdown static parity **Pass** vs **7** operational gaps                         | main.ts wiring OK؛ runtime contract incomplete | SD-G\* جدا از static audit — هر دو درست.                                      |
| **CON-06** | Resilience **62** vs phase3 **CONDITIONAL** (no numeric score)                    | مقیاس متفاوت                                   | cross-link: phase3 blocks scale؛ phase4 blocks resilience sign-off.           |
| **CON-07** | `atomic_update_paths_db=yes` vs `e2e=no`                                          | DB TX atomic؛ read coherence partial           | PU-03 harness vs production cache — doc E2E gap واضح است.                     |

---

## Must-Fix — blocks multi-tenant production resilience

| Pri    | ID                | Finding                             | Why cascade                                 | Suggested fix                                 |
| ------ | ----------------- | ----------------------------------- | ------------------------------------------- | --------------------------------------------- |
| **P0** | **F-01**          | No stale `processing` reclaim       | OZ-01/02/06 — deploy permanent undelivered  | TTL job `processing`→`pending` or dead-letter |
| **P0** | **F-05**          | Shutdown flush ignores `processing` | SD-G1 — rolling restart **creates** zombies | Extend drain predicate + reclaim (F-01)       |
| **P0** | **F-02**          | Bus publish ≠ `done` update         | Amplifies F-01; outbox never heals          | Pair publish+mark or compensate via reclaim   |
| **P0** | **NN-01 / NN-02** | Noisy-neighbor CPU + pool           | CASCADE-01 innocent tenant outage           | phase3 SCAL-DEBT-01/02                        |
| **P0** | **RL-DOS-01**     | Uncached admin read per rate-limit  | CASCADE-03 admin pool DoS                   | Registry cache on limiter path                |
| **P0** | **SCAL-HF-11**    | Redis fail-closed 500               | Total write failure on blip                 | SH-GAP-13 fail-open policy                    |
| **P1** | **PI-01**         | Unbounded proxy `fetch`             | Hung upstream when wired                    | Timeout + breaker before DI-PROXY-01          |
| **P1** | **PU-F-01**       | No write-path cache invalidation    | Stale flags up to 5s on writes              | Invalidate registry cache on tenant update    |

---

## Top 3 cascading failure scenarios (CASCADE)

### CASCADE-01 — Bulk import noisy-neighbor platform brownout

| Stage           | Narrative                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**     | Tenant A sustained bulk `POST /tours` @ 50 RPS or 10 parallel persist/chunk                                                                                               |
| **Propagation** | RuleEngine monopolizes loop (NN-01) → B latency spikes → pool exhausted (NN-02) → B **503** → outbox backlog → relay competes admin pool → logging amplifies (FOF-LOG-02) |
| **Impact**      | Cross-tenant **availability collapse** — RLS holds (no data leak)                                                                                                         |

### CASCADE-02 — Deploy storm processing zombies (silent projection drift)

| Stage           | Narrative                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**     | SIGTERM mid relay tick; SIGKILL on grace expiry                                                                                                           |
| **Propagation** | Rows stuck `processing` (F-01) → new pods claim only `pending` → flush counts `pending` only, exit 0 (SD-G1) → API **201** but projections never catch up |
| **Impact**      | **Silent multi-hour data-plane divergence** until manual SQL                                                                                              |

### CASCADE-03 — Rate-limiter identity flood + Redis blip

| Stage           | Narrative                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Trigger**     | 100+ unique `x-tenant-id` + Redis blip                                                                |
| **Propagation** | Admin `findUnique` storm → Redis throw → **500** all limited routes → retries amplify → relay starved |
| **Impact**      | **Platform-wide write outage**                                                                        |

---

## باگ‌ها و آسیب‌پذیری‌ها

### Outbox / saga findings (F-\*)

| ID                  | Sev      | Finding                                             | Gap                      |
| ------------------- | -------- | --------------------------------------------------- | ------------------------ |
| **F-01**            | **High** | No stale `processing` reclaim                       | Ops SQL only             |
| **F-02**            | **High** | Publish / mark-done not atomic                      | Bus ahead of DB          |
| **F-03**            | Medium   | `failed` terminal — no auto-retry                   | Admin replay deferred    |
| **F-04**            | Medium   | Projection partial success                          | DEC-008 manual reconcile |
| **F-05**            | **High** | Shutdown flush pending-only                         | SD-G1                    |
| **F-10**            | Partial  | SIGKILL mid canonical TX                            | OZ-A chaos-monitored     |
| **F-11**            | Medium   | Flush silent timeout                                | SD-G3                    |
| **F-12**            | Medium   | In-flight relay tick not awaited                    | SD-G2                    |
| **F-13**            | Low      | No shutdown deadline on `server.close`              | SD-G4                    |
| **F-14**            | Low      | No logger drain on shutdown                         | SD-G5 / FOF-LOG-03       |
| **F-15**            | Medium   | No strict FIFO per tenant in prod relay             | BL-01                    |
| **F-06…F-09, F-16** | **Pass** | Atomicity, idempotency, SKIP LOCKED, backlog dedupe | —                        |

### Graceful shutdown gaps (SD-G)

| ID        | Sev      | Gap                                                |
| --------- | -------- | -------------------------------------------------- |
| **SD-G1** | **High** | Flush counts `pending` only — `processing` zombies |
| **SD-G2** | Medium   | `stop()` doesn't await in-flight tick              |
| **SD-G3** | Medium   | Deadline expiry exit 0 with `pending > 0`          |
| **SD-G4** | Medium   | Hung handler blocks `server.close` forever         |
| **SD-G5** | Low      | No logger flush                                    |
| **SD-G6** | Low      | Worker duplicates shutdown logic                   |
| **SD-G7** | Low      | Worker SIGTERM only vs prod SIGINT                 |

### Zombie event definition (6 scenarios)

| Class        | Examples                       | Reclaim?                    |
| ------------ | ------------------------------ | --------------------------- |
| **OZ-01/02** | Crash after claim, mid-publish | **No** — stuck `processing` |
| **OZ-06**    | SIGTERM during relay           | **No** — SD-G1              |
| **OZ-D**     | Projection after `done`        | Metrics only (F-04)         |
| **OZ-A**     | SIGKILL mid TX                 | Postgres best-effort        |

### Partial tenant-config update (PU-\*)

| ID          | Sev      | Risk                               |
| ----------- | -------- | ---------------------------------- |
| **PU-F-01** | **High** | No write-path cache invalidation   |
| **PU-F-02** | Medium   | Split cache vs uncached flag reads |
| **PU-03**   | Medium   | 5s registry TTL window             |
| **PU-06**   | Medium   | Stale theme on concurrent write    |

**Partial update risk count: 6** · `atomic_update_paths_db=yes` · `atomic_update_paths_e2e=no`

### Rule Engine hard-fail (HF-RE — 16 paths, no runtime degrade)

| Posture               | Detail                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| **Proactive degrade** | `advancedRuleEngine: false` → `basic` variant (DEC-014) — **2 paths**   |
| **Hard-fail**         | Engine init/validate failure → **400/500** — **16 paths** (HF-RE-01…14) |
| **No reactive**       | No downgrade default→basic on runtime failure                           |

### Proxy isolation (PI-\*)

| ID        | Sev      | Finding                                       |
| --------- | -------- | --------------------------------------------- |
| **PI-01** | **High** | Unbounded `fetch` — systemic when on hot path |
| **PI-02** | Medium   | No tenant-scoped upstream timeout config      |
| **PI-03** | Info     | Not wired in `main.ts` today — latent         |

### Schema drift (SV-\*)

| Metric                            |                                                           Value |
| --------------------------------- | --------------------------------------------------------------: |
| **Critical 500 on version drift** |                                                           **0** |
| **Graceful paths**                |                                                          **14** |
| **SV-CRIT-01**                    |                               No proven HTTP 500 on write drift |
| **Gap**                           | PATCH cases untested (SV-F-03); no `migrateCanonical` (SV-F-04) |

### Clock skew (CLK-F)

| ID           | Sev      | Issue                                   |
| ------------ | -------- | --------------------------------------- |
| **CLK-F-01** | **High** | Triple timestamp authority in atomic TX |
| **CLK-F-02** | **High** | `occurredAt` app vs relay DB split      |
| **CLK-F-03** | Medium   | Terminal timestamps app `new Date()`    |
| **CLK-F-04** | Low      | Spec gap at ±5s (uses ±5min)            |

### Bulk import — RuleEngine coupling

**Verdict:** RLS **pass** · noisy-neighbor **fail** · victim SLO **not** gated (BULK-01)

---

## Accepted risks (documented; manual ops or Phase 5+)

| ID               | Finding                                      | Acceptance basis                       |
| ---------------- | -------------------------------------------- | -------------------------------------- |
| **F-03**         | Terminal `failed` outbox                     | Poison payloads; admin replay deferred |
| **F-04**         | Projection partial (OZ-D)                    | DEC-008 metrics + manual reconcile     |
| **F-10**         | SIGKILL mid TX                               | Chaos-monitored OZ-A                   |
| **F-15 / BL-01** | No per-tenant FIFO in prod relay             | Idempotent handlers                    |
| **SD-G4…G7**     | Shutdown watchdog / log drain / worker drift | Low severity                           |
| **PI-03**        | Proxy not on `main.ts`                       | Until DI-PROXY-01                      |
| **PU-03**        | 5s registry TTL                              | Perf trade-off                         |
| **CLK-F-01…04**  | Mixed timestamps                             | Forensic skew; JWT path pass           |
| **SV-F-03/04**   | PATCH untested; no migrateCanonical          | Phase 6                                |

---

## پیشنهادات و اصلاحات (اولویت‌بندی یکپارچه)

### فوری (P0)

1. **F-01 + F-05 + SD-G1** — `processing` reclaim TTL + shutdown drain includes reclaim.
2. **F-02** — atomic publish+`done` or documented compensate.
3. **NN-01/02 + RL-DOS-01 + SCAL-HF-11** — cross-phase3 mitigations (CASCADE-01/03).
4. **PU-F-01** — cache invalidation on tenant theme write.

### کوتاه‌مدت (P1)

5. **PI-01** — timeout/breaker قبل از wiring proxy.
6. **SD-G2/G3** — await relay tick; non-zero exit / metric on flush timeout.
7. **CLK-F-01/02** — unify DB `now()` per TX.
8. **PATCH schema drift spec** — extend `schema-version-compat.spec.ts`.
9. **Victim SLO test** — bulk import ∥ B login/read (phase3 SCAL-DEBT-13).

### میان‌مدت (P2)

10. **F-03** — admin replay tooling for `failed` rows.
11. **F-15** — per-tenant FIFO option for order-sensitive projections.
12. **SD-G4/G5** — shutdown watchdog + `logger.flush`.
13. **Rule Engine reactive degrade** — policy decision (likely Phase 6+).

---

## تأیید شده (PASS)

| Area                           | Evidence                                         |
| ------------------------------ | ------------------------------------------------ |
| **Canonical TX atomicity**     | `withCanonicalTransaction`; integration + chaos  |
| **Outbox enqueue idempotency** | UNIQUE + P2002                                   |
| **Consumer idempotency**       | `processed_domain_events`; INT-BACKLOG-02        |
| **SKIP LOCKED multi-worker**   | `outbox-relay.integration.spec.ts`               |
| **SIGTERM no orphan commit**   | `graceful-shutdown.spec.ts`                      |
| **Backlog 1h replay dedupe**   | `event-backlog-recovery.spec.ts`                 |
| **Schema drift graceful**      | `schema-version-compat.spec.ts` — 0 critical 500 |
| **Feature-flag mid-burst**     | `feature-flag-degradation.spec.ts`               |
| **Data Integrity Breach**      | **0** on idempotent path                         |

---

## Appendix A — Recovery flows (خلاصه)

| Flow                          | Verdict                                          |
| ----------------------------- | ------------------------------------------------ |
| Canonical write saga (happy)  | **Pass**                                         |
| Canonical TX failure rollback | **Pass**                                         |
| Relay failure recovery        | **Partial** — poll only; no reclaim              |
| Crash between relay states    | **Partial** — at-least-once safe; zombies remain |
| Consumer down 1h resume       | **Pass** dedupe; **Partial** FIFO                |

---

## Appendix B — Idempotency / retry summary

| Layer                    | On duplicate/retry                  |
| ------------------------ | ----------------------------------- |
| Outbox insert            | `(tenant_id, domain_event_id)` skip |
| Relay claim              | SKIP LOCKED one worker              |
| Bus delivery             | `processed_domain_events` — once    |
| Per-tenant order         | **Not guaranteed** prod (F-15)      |
| Terminal `done`/`failed` | No re-claim                         |
| HTTP idempotency         | Separate `HttpIdempotencyRecord`    |

**Relay retry:** fixed poll ~1s only — **no** exponential backoff; **no** `processing` timeout.

---

## Appendix C — Phase 5 doc gaps (outbox policy)

سند `5.4-transactional-outbox.md` فعلاً مشخص نمی‌کند:

- Maximum `processing` age / reclaim policy
- Retry policy for `failed`
- Pairing guarantee bus publish ↔ `done`

→ با پیاده‌سازی F-01/F-03 به docs اضافه شود.

---

## Regression pack (verification commands)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

# Core resilience pack
node --import tsx --test \
  test/outbox-transactional.integration.spec.ts \
  test/outbox-relay.integration.spec.ts \
  test/4-integration/saga-rollback.spec.ts \
  test/4-integration/event-backlog-recovery.spec.ts \
  test/4-integration/graceful-shutdown.spec.ts \
  test/1-reliability/domain-event-consistency.spec.ts \
  test/4-integration/schema-version-compat.spec.ts \
  test/4-integration/feature-flag-degradation.spec.ts \
  test/4-integration/dynamic-config-sync.spec.ts

# Graceful shutdown runtime (optional main.ts)
export OUTBOX_RELAY_ENABLED=true
# GRACEFUL_SHUTDOWN_USE_MAIN=1 for production entrypoint

# Proxy (no Postgres)
NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test \
  test/4-integration/proxy-tenant-isolation.spec.ts

# Clock skew
node --import tsx --test test/4-integration/clock-skew-resilience.spec.ts

# Bulk import partition
node --import tsx --test test/4-integration/bulk-import-consistency.spec.ts

# Nightly backlog (1000 rows)
TEST_TIER=nightly node --import tsx --test test/4-integration/event-backlog-recovery.spec.ts
```

---

## شمارش نهایی

| دسته                        |         تعداد |
| --------------------------- | ------------: |
| Resilience score            |        62/100 |
| Verdict                     |   CONDITIONAL |
| Must-Fix                    |             8 |
| Zombie-risk scenarios       |             6 |
| Shutdown gaps (SD-G)        |             7 |
| Findings F-\* (excl. Pass)  | 12 actionable |
| Partial-update risks        |             6 |
| Hard-fail Rule Engine paths |            16 |
| Schema drift critical 500   |             0 |
| CASCADE scenarios           |             3 |
| تناقض/ابهام (CON)           |             7 |
| Data Integrity Breach       |             0 |

---

## پیوند به auditهای دیگر

| موضوع                       | سند                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Pool / NN / RL-DOS          | [`phase3-scalability-stress-audit-fix-list.md`](phase3-scalability-stress-audit-fix-list.md) |
| Self-Heal / rollback        | [`phase5-evolution-audit-fix-list.md`](phase5-evolution-audit-fix-list.md)                   |
| Tenant isolation            | [`phase1-aggressive-audit-fix-list.md`](phase1-aggressive-audit-fix-list.md)                 |
| Observability shutdown logs | [`phase2-paranoid-audit-fix-list.md`](phase2-paranoid-audit-fix-list.md)                     |

---

## Document metadata

| Item               | Value                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Output path**    | `TEMP/phase4-resilience-audit-fix-list.md`                                                                                                            |
| **Code changes**   | None (`docs/TEMP` only)                                                                                                                               |
| **Parent handoff** | `resilience_score=62` · `verdict=CONDITIONAL` · `zombie_risk_count=6` · `shutdown_gap_count=7` · `cascade_scenarios=CASCADE-01,CASCADE-02,CASCADE-03` |
| **Architect note** | Documentation status: **Updated** (extracted from existing audit). Link: `TEMP/phase4-resilience-audit-fix-list.md`                                   |

_این فایل استخراج از `phase4-resilience-audit.md` است و جایگزین سند منبع نیست. برای جزئیات کامل به سند اصلی مراجعه کنید._
