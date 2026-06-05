# Phase 5 Evolution Audit — Fix List

**Source:** [`apps/api/docs/phase5-evolution-audit.md`](../apps/api/docs/phase5-evolution-audit.md)  
**Generated:** 2026-06-05  
**Scope:** Autonomous readiness, Self-Heal, Migration Danger, System Rollback, API versioning, Shadow API, Deployment Debt, Catastrophic Admin Error, CI/CD bypass, secrets, auto-scaling limits.

---

## خلاصه اجرایی (فارسی)

| مورد                         | مقدار                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **حکم Autonomous Readiness** | **SEMI** — امتیاز **45/100**                                                   |
| **Operational toil**         | **10** کار دستی تکراری در 30 روز                                               |
| **30-day failure scenarios** | **10** (`AR-30-01` … `AR-30-10`) — **3–5** مورد در ماه معمول **انتظار** می‌رود |
| **Self-Heal gaps**           | **16** (`SH-GAP-01` … `SH-GAP-16`)                                             |
| **Rollback gaps**            | **14** (`RB-GAP-01` … `RB-GAP-14`) — **30s revert: no**                        |
| **Migration Danger**         | **14** (`MD-GAP-01` … `MD-GAP-14`)                                             |
| **Catastrophic Admin**       | **14** (`CAE-GAP-01` … `CAE-GAP-14`) — **soft_delete=no**                      |
| **Deployment Debt**          | **9** (`DEPLOY-DEBT-01` … `09`)                                                |
| **Shadow API**               | **7/7** routes — **100%** بدون OpenAPI                                         |
| **CI/CD bypass**             | **44** (`CI-BYP-01` … `CI-BYP-44`)                                             |
| **Scalability Limits**       | **18** (`SCAL-LIM-01` … `18`)                                                  |
| **Secret management debt**   | **11** — no auto-rotation pipeline                                             |

**جمع‌بندی:** HTTP پایدار + 429/503 کوتاه‌مدت قابل تحمل است؛ **خودکار-بهبود** outbox zombie، migration skew، rollback چندلایه، و overload پایدار **وجود ندارد**. قبل از ادعای AUTONOMOUS: toil #1–4 و SH-GAP-07/08 و RB-GAP-01/10 را ببندید.

---

## Evolution Report — Final Autonomous Readiness

**Audit lens:** آیا `@apps/api` **30 روز متوالی** بدون مداخله انسان (on-call، SQL دستی، firefighting deploy) دوام می‌آورد؟

| Metric                         | Value                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Verdict**                    | **SEMI**                                                                                           |
| **Autonomous readiness score** | **45 / 100**                                                                                       |
| **Operational toil count**     | **10**                                                                                             |
| **30-day failure scenarios**   | **10**                                                                                             |
| **Catalogued gaps (rollup)**   | **71+** across SH(16), SCAL-LIM(18), MD(14), CAE(14), DEPLOY(9), SHADOW(7), RB(14), CI(44), SM(11) |

### Pillar scores (30-day autonomy)

| Pillar                           |  Score | 30-day note                                                        |
| -------------------------------- | -----: | ------------------------------------------------------------------ |
| **Self-Heal (DB/network)**       | **28** | Fail-immediate؛ no circuit breaker (SH-GAP-15)                     |
| **Background recovery**          | **35** | No `processing` reclaim (SH-GAP-08); terminal `failed` (SH-GAP-07) |
| **Scale & overload**             | **40** | Partial shed؛ ~40–200 RPS ceiling (phase3)                         |
| **Deploy, migration & rollback** | **32** | Lockstep deploy؛ forward-only Prisma؛ 30s revert **no**            |
| **Observability & alert**        | **32** | In-process metrics؛ 7/7 Shadow API                                 |
| **Secrets & CI trust**           | **38** | No auto-rotation؛ GHA phase-4/5 omission                           |
| **Data safety & admin**          | **50** | Append-only audit؛ **no soft delete**؛ `db:test-reset` unguarded   |

### Operational Toil — top 10

| Rank   | Toil item                               | Trigger                              | Manual action today                              | Ref                               |
| ------ | --------------------------------------- | ------------------------------------ | ------------------------------------------------ | --------------------------------- |
| **1**  | Reclaim stuck outbox `processing`       | Rolling deploy, SIGKILL, relay crash | SQL/TTL reset → `pending`                        | SH-GAP-08, RB-GAP-10, phase4 F-01 |
| **2**  | Replay terminal outbox `failed`         | Poison/transient misclassified       | Inspect; manual re-enqueue                       | SH-GAP-07, phase4 F-03            |
| **3**  | Migration failure recovery              | `migrate deploy` timeout/FK/disk     | Fix + redeploy or `migrate resolve`              | MD-GAP-01…03                      |
| **4**  | Bad-deploy rollback (code+cache+outbox) | SLO breach post-release              | `kubectl undo` + Redis DEL + outbox SQL **>30s** | RB-GAP-01…14                      |
| **5**  | Projection / consumer drift             | `projection_inconsistency_total`     | Manual bus replay                                | phase4 F-04                       |
| **6**  | Lockstep breaking deploy                | schemaVersion / URL break            | Sync API+plugin+clients                          | DEPLOY-DEBT-01…09                 |
| **7**  | JWT / DB credential rotation            | Key expiry                           | Manual PEM + pod restart                         | SM-VUL-01…11                      |
| **8**  | Postgres/Redis incident                 | P1001 blip, pool storm               | Scale/restart infra                              | SH-GAP-04, SH-GAP-13              |
| **9**  | CI vs prod DB bootstrap drift           | `migrate dev` + `infra/sql/001`      | Human judgment                                   | MD-GAP-05…06, CI-BYP-12           |
| **10** | Backup / PITR verification              | Admin wipe, TRUNCATE                 | Out-of-band restore — **undocumented RPO/RTO**   | CAE-GAP-04…06, CAE-GAP-14         |

### Human-dependency — top 5 risks

| Rank  | Risk                                          | Severity |
| ----- | --------------------------------------------- | -------- |
| **1** | Outbox zombie + silent projection drift       | **P0**   |
| **2** | Fail-immediate infra + no circuit breaker     | **P0**   |
| **3** | Forward-only deploy + no 30s rollback         | **P0**   |
| **4** | No autonomous observability (100% Shadow API) | **P1**   |
| **5** | Destructive admin + unguarded `db:test-reset` | **P0**   |

### 30-day failure scenarios (10)

| ID           | Scenario                                             | Day (typical) | Autonomous outcome                              | Human?    |
| ------------ | ---------------------------------------------------- | ------------- | ----------------------------------------------- | --------- |
| **AR-30-01** | Weekly rolling deploy — SIGTERM mid relay            | 7, 14, 21, 28 | `processing` stuck; flush pending-only          | **Yes**   |
| **AR-30-02** | Postgres maintenance restart (5–30 min)              | 10–20         | **500** P1001/P1017; pool storm on recovery     | **Maybe** |
| **AR-30-03** | Redis blip or eviction                               | 5–25          | All limited routes → **500** fail-closed        | **Yes**   |
| **AR-30-04** | Traffic spike > ~40 RPS sustained                    | Any           | Global **503**; validation OOM risk; CASCADE-01 | **Yes**   |
| **AR-30-05** | Schema migration on large `outbox_events`            | 15 (planned)  | ACCESS EXCLUSIVE lock → **503** storm           | **Yes**   |
| **AR-30-06** | Transient publish → `failed` outbox                  | 3–12          | Terminal row; never redelivered                 | **Yes**   |
| **AR-30-07** | Bad deploy after image + migration                   | 12–22         | Code rollback **>30s**; schema skew             | **Yes**   |
| **AR-30-08** | Breaking workspace revision w/o client upgrade       | 20            | Stale `schemaVersion` → **400** all old clients | **Yes**   |
| **AR-30-09** | JWT key expiry w/o staged rotation                   | 25–30         | Auth **401** storm until PEM swap               | **Yes**   |
| **AR-30-10** | Misconfigured `DATABASE_URL_ADMIN` → `db:test-reset` | Rare          | Full **TRUNCATE CASCADE** tenant data + audit   | **Yes**   |

**30-day survival summary:** **3–5** scenarios expected/month (deploy zombies, infra blip, migration/bad deploy). **Zero** fully self-heal without human action.

---

## تناقضات و ابهامات در سند (نیاز به هم‌راستاسازی)

| ID         | محل در سند                                                                              | تناقض                  | توضیح / اقدام پیشنهادی                                                                  |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| **CON-01** | «**71+** catalogued gaps» vs شمارش دقیق رجیسترها                                        | rollup تقریبی          | جمع SH+MD+CAE+… ≈ 137 ID — «71+» یعنی unique actionable؛ در doc جدول dedupe اضافه کنید. |
| **CON-02** | Auto-rollback **single migration TX: Yes** vs **chain: No** vs RB-GAP «no migrate down» | سه سطح rollback        | عمدی — یک فایل SQL TX بله؛ زنجیره/اپراتور خیر. در runbook سه سطح جدا بنویسید.           |
| **CON-03** | Data safety pillar **50** (بهترین) vs Autonomous **45** (کل)                            | admin بدون soft delete | CAE خوب نیست اما audit/FK کمک می‌کند — pillar ≠ overall.                                |
| **CON-04** | `test:full` نام «full» vs phase-5 omitted (CI-BYP-13)                                   | naming debt            | rename یا extend به `phase-5:gate`.                                                     |
| **CON-05** | Legacy `openapi.json` vs thin API **7 routes**                                          | false confidence       | SHADOW inverse — doc باید «legacy ≠ apps/api» را در onboarding bold کند.                |
| **CON-06** | SH-GAP-16 **Info** (test retry) در جدول 16 gap vs «no retry prod»                       | test-only exception    | در fix list جدا: not a prod fix.                                                        |
| **CON-07** | phase4 resilience **62** vs evolution autonomous **45**                                 | دامنه متفاوت           | evolution سخت‌گیرتر (30-day zero human) — تناقض نیست.                                   |

---

## Must-Fix — blocks AUTONOMOUS verdict

| Pri    | ID(s)                                  | Area       | Problem                                                | Suggested fix                                       |
| ------ | -------------------------------------- | ---------- | ------------------------------------------------------ | --------------------------------------------------- |
| **P0** | SH-GAP-08, RB-GAP-10, phase4 F-01/F-05 | Outbox     | `processing` never reclaimed                           | TTL reclaim job + shutdown drain fix                |
| **P0** | SH-GAP-07, phase4 F-03                 | Outbox     | Terminal `failed` — no retry                           | Transient vs poison classifier + replay API         |
| **P0** | RB-GAP-01/02/10                        | Rollback   | No migrate down; processing zombies on rollback        | Document forward-only + reclaim before rolling undo |
| **P0** | CAE-GAP-05, CAE-GAP-04                 | Admin      | `db:test-reset` no prod guard; admin cred blast radius | URL blocklist + `CONFIRM_TEST_RESET`                |
| **P0** | CI-BYP-12                              | CI         | No GHA `phase-4:gate` / `phase-5:gate`                 | Add workflows or required self-hosted runners       |
| **P0** | SH-GAP-15, SH-GAP-04                   | Self-Heal  | No circuit breaker; P1001 → 500                        | `isTransientDbError` + breaker + 503 Retry-After    |
| **P1** | DEPLOY-DEBT-01/02/04                   | Versioning | No header routing; lockstep breaking deploy            | Accept Phase 6+ or document lockstep runbook        |
| **P1** | SHADOW-API-05…07                       | Contract   | Primary routes undocumented in OpenAPI                 | `zod-to-openapi` + CI diff gate                     |
| **P1** | MD-GAP-12                              | Migration  | Boot doesn't verify migration head                     | Preflight `_prisma_migrations` vs embedded revision |
| **P1** | RB-GAP-09                              | Shutdown   | `shuttingDown` not at HTTP ingress                     | Reject new work during drain                        |

---

## Self-Heal gap table (SH-GAP — 16)

| ID            | Layer       | Scenario                      | Current                     | Class            | Sev  |
| ------------- | ----------- | ----------------------------- | --------------------------- | ---------------- | ---- |
| **SH-GAP-01** | Prisma      | No reconnect / health probe   | Stale handles               | No retry         | P1   |
| **SH-GAP-02** | TX          | Disconnect mid-`$transaction` | Immediate rollback          | No retry         | P1   |
| **SH-GAP-03** | TX          | Pool timeout                  | 503; no server retry        | No retry         | P2   |
| **SH-GAP-04** | Error map   | P1001/P1002/P1017             | **500**                     | Misclassified    | P1   |
| **SH-GAP-05** | HTTP        | 503 pool saturation           | No `Retry-After`            | Backoff missing  | P2   |
| **SH-GAP-06** | Outbox      | Relay tick claim disconnect   | Fixed poll                  | Fixed interval   | P2   |
| **SH-GAP-07** | Outbox      | Publish failure               | → **`failed`** permanent    | No retry         | P1   |
| **SH-GAP-08** | Outbox      | Crash after claim             | Stuck **`processing`**      | No retry         | P1   |
| **SH-GAP-09** | Outbox      | Repeated failures             | 1s poll forever             | Backoff missing  | P2   |
| **SH-GAP-10** | Shutdown    | Flush under DB blip           | 50ms loop; may exit pending | Backoff missing  | P2   |
| **SH-GAP-11** | Idempotency | Poll DB error                 | Aborts wait                 | No retry         | P2   |
| **SH-GAP-12** | Idempotency | 25ms poll 30s                 | Fixed interval              | Backoff missing  | P3   |
| **SH-GAP-13** | Redis RL    | Redis disconnect              | Fail-closed **500**         | Single retry max | P2   |
| **SH-GAP-14** | Registry    | Admin lookup failure          | Throws                      | No retry         | P2   |
| **SH-GAP-15** | Platform    | No circuit breaker            | Pool storms under outage    | CB missing       | P1   |
| **SH-GAP-16** | Tests       | Pool retry once in spec       | **Test-only**               | Info             | Info |

**Has exponential backoff in production DB/relay: No**

---

## Rollback Strategy gap table (RB-GAP — 14)

| ID            | Layer   | Scenario                                   | 30s feasible?          | Sev |
| ------------- | ------- | ------------------------------------------ | ---------------------- | --- |
| **RB-GAP-01** | DB      | Operator expects `migrate down`            | **No**                 | P0  |
| **RB-GAP-02** | DB      | Revert applied migration (RLS, audit, FKs) | **No** (PITR minutes+) | P0  |
| **RB-GAP-03** | DB      | No rollback runbook in checklist           | **No**                 | P1  |
| **RB-GAP-04** | DB+code | Schema/code skew partial chain             | **No**                 | P1  |
| **RB-GAP-05** | Code    | No blue/green or canary                    | **No**                 | P1  |
| **RB-GAP-06** | Code    | No parallel old handler / version routing  | **No**                 | P1  |
| **RB-GAP-07** | Code    | Image pull + multi-replica rolling         | **Unlikely**           | P2  |
| **RB-GAP-08** | Code    | Shutdown drain vs 30s budget               | **No**                 | P1  |
| **RB-GAP-09** | Code    | `shuttingDown` not at HTTP ingress         | **No**                 | P1  |
| **RB-GAP-10** | Code+DB | Outbox `processing` at pod kill            | **No**                 | P0  |
| **RB-GAP-11** | Cache   | No feature-flag freeze on rollback         | **No**                 | P2  |
| **RB-GAP-12** | Cache   | No registry invalidation API               | **Partial**            | P2  |
| **RB-GAP-13** | Cache   | No Redis rate-limiter flush API            | **No**                 | P2  |
| **RB-GAP-14** | Code    | Colocated outbox relay                     | **No**                 | P1  |

**Rollback 30s feasible (DB + code + cache): No**

---

## Migration Danger gap table (MD-GAP — 14)

| ID            | Scenario                                        | TX rollback on fail?        | Sev         |
| ------------- | ----------------------------------------------- | --------------------------- | ----------- |
| **MD-GAP-01** | Blocking INDEX/FK on large `outbox_events`      | **Yes** within file         | P1          |
| **MD-GAP-02** | `row_version NOT NULL DEFAULT` on large `tours` | **Yes**                     | P1          |
| **MD-GAP-03** | Migration N fails after N-1 applied             | **No** chain rollback       | P1          |
| **MD-GAP-04** | No `migrate deploy` script in package.json      | N/A                         | P2          |
| **MD-GAP-05** | CI `migrate dev` + `infra/sql/001`              | Diverges prod path          | P2          |
| **MD-GAP-06** | `infra/sql` parallel track                      | Drift vs Prisma             | P2          |
| **MD-GAP-07** | RLS DDL with `app_tour` role                    | TX abort if permission fail | P1          |
| **MD-GAP-08** | No shadow DB on `migrate deploy`                | No rehearsal                | P2          |
| **MD-GAP-09** | `IF NOT EXISTS` + manual recovery               | Checksum risk               | P2          |
| **MD-GAP-10** | Four FK adds one file                           | Rollback all four on fail   | P2          |
| **MD-GAP-11** | Checksum mismatch after hotfix                  | Deploy hard-fail            | P1          |
| **MD-GAP-12** | App boot during partial chain                   | No schema version check     | P1          |
| **MD-GAP-13** | Future `CREATE INDEX CONCURRENTLY`              | Breaks single-TX            | P1 (future) |
| **MD-GAP-14** | OOM / `pg_terminate_backend` mid-migration      | TX rollback (current SQL)   | P2          |

**Auto-rollback single migration TX: Yes** · **Chain: No** · **Corrupted schema from failed TX: No** (current SQL)

---

## Catastrophic Admin Error (CAE-GAP — 14, soft_delete=no)

| Question                    | Answer                                  |
| --------------------------- | --------------------------------------- |
| **Soft delete exists?**     | **No** — no `deleted_at` / `is_deleted` |
| **Production HTTP DELETE?** | **None**                                |
| **Audit undo?**             | **No** — append-only evidence           |
| **RLS on admin?**           | **No** — owner bypasses all policies    |
| **Recovery**                | Ops-layer PITR/backup only              |

| ID             | Scenario                                                   | Severity |
| -------------- | ---------------------------------------------------------- | -------- |
| **CAE-GAP-01** | Buggy `deleteMany({})` on `tours`                          | **P0**   |
| **CAE-GAP-02** | No soft delete / tombstone                                 | **P0**   |
| **CAE-GAP-03** | `row_version` mistaken for history                         | P1       |
| **CAE-GAP-04** | `getPrismaAdmin()` credential leak — full cross-tenant     | **P0**   |
| **CAE-GAP-05** | `db:test-reset` against prod URL — TRUNCATE all six tables | **P0**   |
| **CAE-GAP-06** | `TRUNCATE CASCADE` on audit — bypasses row trigger         | **P0**   |
| **CAE-GAP-07** | Ordered delete children then tenant                        | P1       |
| **CAE-GAP-08** | `/internal/tenants/provision` NODE_ENV mis-set             | P1       |
| **CAE-GAP-09** | `seedDevTenants` upsert overwrites theme/status            | P2       |
| **CAE-GAP-10** | Audit as undo log — evidence only                          | P1       |
| **CAE-GAP-11** | No DELETE routes → false comfort                           | P1       |
| **CAE-GAP-12** | Test teardown `deleteMany` copy-paste hazard               | P2       |
| **CAE-GAP-13** | Non-prod admin pool fallback to app role                   | P2       |
| **CAE-GAP-14** | No documented RPO/RTO for canonical SoT                    | P2       |

### CAE target-state recommendations (خلاصه)

1. Soft delete / tombstone on `tours` (optional `tenants`).
2. Canonical history table (`tour_revisions`).
3. `withAdminMutationGuard({ requireWhere: true })`.
4. `db:test-reset` prod URL blocklist.
5. Revoke TRUNCATE from app roles.
6. Audit to WORM storage async.
7. Backup contract in production checklist.
8. Service JWT for `/internal/*` before any delete HTTP API.

---

## Deployment Debt register (DEPLOY-DEBT — 9)

| ID                 | Scenario                                           | Severity |
| ------------------ | -------------------------------------------------- | -------- |
| **DEPLOY-DEBT-01** | No `Accept-Version` / header routing               | P1       |
| **DEPLOY-DEBT-02** | Tours unversioned `/tours`                         | P1       |
| **DEPLOY-DEBT-03** | Split prefix (`/api/v2/tenant-config` vs `/tours`) | P2       |
| **DEPLOY-DEBT-04** | Strict `schemaVersion` equality on write           | P1       |
| **DEPLOY-DEBT-05** | `migrateCanonical` not wired                       | P1       |
| **DEPLOY-DEBT-06** | MAP §8.3 dual-read not implemented                 | P1       |
| **DEPLOY-DEBT-07** | `WorkspacePlugin.contractVersion` absent           | P2       |
| **DEPLOY-DEBT-08** | No deprecation / `Sunset` headers                  | P3       |
| **DEPLOY-DEBT-09** | Breaking plugin registry bump — no version fan-out | P1       |

**Header routing exists: No** · **Breaking deploy: lockstep required**

---

## Shadow API risk register (SHADOW-API — 7)

**OpenAPI generator: No** · **Shadow endpoint count: 7** (100% of `dispatchRequest`)

| ID                | Endpoint                           | Severity |
| ----------------- | ---------------------------------- | -------- |
| **SHADOW-API-01** | `GET /health`                      | P2       |
| **SHADOW-API-02** | `GET /api/v2/tenant-config`        | P1       |
| **SHADOW-API-03** | `POST /internal/tenants/provision` | P1       |
| **SHADOW-API-04** | `GET /internal/test/db-pool-hold`  | P2       |
| **SHADOW-API-05** | `POST /tours`                      | P1       |
| **SHADOW-API-06** | `GET /tours/:id`                   | P1       |
| **SHADOW-API-07** | `PATCH /tours/:id`                 | P1       |

**Legacy `openapi.json` false confidence:** Nest monolith ≠ thin `@apps/api` — inverse shadow (documented-but-dead routes).

---

## CI/CD god-mode bypass audit (CI-BYP — 44)

### Highest-risk bypasses (Must reject for trunk)

| ID            | Bypass                                          | Severity     | Action                                  |
| ------------- | ----------------------------------------------- | ------------ | --------------------------------------- |
| **CI-BYP-01** | `git commit --no-verify` at tooling level       | **High**     | Branch protection required checks       |
| **CI-BYP-11** | `ci:integrity` phases 0→3 only                  | **High**     | Rename or extend to phase-4 minimum     |
| **CI-BYP-12** | **GHA-phase-4/5-omission** — no workflows       | **Critical** | Add `phase-4:gate` / `phase-5:gate` GHA |
| **CI-BYP-13** | `test:full` excludes phase-5                    | **High**     | Align alias with `phase-5:gate`         |
| **CI-BYP-17** | ~35 specs skip without Postgres                 | **High**     | CI must provide DB service              |
| **CI-BYP-19** | `P5_PERF_GATE_SKIP=true` in CI                  | **High**     | Reject in CI                            |
| **CI-BYP-28** | Header auth god-mode when `NODE_ENV≠production` | **Critical** | Reject for staging                      |
| **CI-BYP-32** | DI-RAW-01 `resolveById` admin probe             | **Critical** | Tenant-scoped read only for GA          |
| **CI-BYP-33** | `P5_ATOMIC_TX_TEST_ABORT` ungated in `src/`     | **Critical** | Gate to test-only                       |
| **CI-BYP-34** | `P5_CHAOS_ABORT` ungated in `src/`              | **Critical** | Gate to test-only                       |

### Accepted mitigations (sample)

| ID               | Mitigation                                    | Status                       |
| ---------------- | --------------------------------------------- | ---------------------------- |
| **CI-BYP-02/03** | `HUSKY=0` / `SKIP_HOOKS` blocked              | Accept                       |
| **CI-BYP-04**    | Husky fast path only                          | Accept + mandatory CI parity |
| **CI-BYP-23**    | `guardSubprocessEnv` strips secrets           | Accept                       |
| **CI-BYP-30**    | `production-runtime-env` blocks memory driver | Accept                       |

**Full register:** CI-BYP-01 … CI-BYP-44 in source doc (44 rows).

---

## Scalability Limit register (SCAL-LIM — 18, traffic spike)

| ID              | Limit                                      | Owner                             |
| --------------- | ------------------------------------------ | --------------------------------- |
| **SCAL-LIM-01** | Single Node process ~40–200 RPS            | K8s HPA + multi-replica           |
| **SCAL-LIM-02** | No autoscale metrics export                | Platform Prometheus               |
| **SCAL-LIM-03** | HPA can't observe pool saturation          | Platform + `db.pool.wait` metric  |
| **SCAL-LIM-04** | CPU/event-loop RuleEngine saturation       | In-app worker pool                |
| **SCAL-LIM-05** | No low-priority tenant shed                | In-app priority tier              |
| **SCAL-LIM-06** | High-priority starved by bulk low-priority | Global admission + pool semaphore |
| **SCAL-LIM-07** | Rotating tenant UUID flood                 | REDIS_URL + cache (RL-DOS-01)     |
| **SCAL-LIM-08** | Memory RL without Redis → OOM              | In-app Redis + prod guard         |
| **SCAL-LIM-09** | Validation queue burst unbounded           | In-app depth cap                  |
| **SCAL-LIM-10** | Pool storm 503 no Retry-After              | SH-GAP-05 + circuit breaker       |
| **SCAL-LIM-11** | Redis unavailable → 500 all limited routes | SH-GAP-13 fail-open               |
| **SCAL-LIM-12** | No global admission controller             | Ingress semaphore                 |
| **SCAL-LIM-13** | Outbox relay vs HTTP spike                 | Relay budget / split Deployment   |
| **SCAL-LIM-14** | Large JSON under spike                     | 413 body limit                    |
| **SCAL-LIM-15** | `/health` on wedged CPU loop               | Sidecar probe                     |
| **SCAL-LIM-16** | Feature degrade not spike-triggered        | Load-based policy                 |
| **SCAL-LIM-17** | Scheduler ALS gap under spike              | phase1 DM-CT-05 wrap              |
| **SCAL-LIM-18** | DB fail-immediate + no CB                  | SH-GAP-03/15                      |

---

## Secret management (SM-VUL — 11, خلاصه)

| Gap                           | Detail                                |
| ----------------------------- | ------------------------------------- |
| **Auto-rotation pipeline**    | **No** — manual JWT runbook only      |
| **Per-tenant key derivation** | **No** — global RS256 PEM             |
| **Dual-key JWT verify**       | **No** — single `AUTH_JWT_PUBLIC_KEY` |
| **Vault integration**         | **No**                                |
| **Count**                     | **11** (`SM-VUL-01` … `SM-VUL-11`)    |

---

## پیشنهادات و اصلاحات (اولویت‌بندی یکپارچه)

### فوری (P0 — SEMI → conditional autonomous)

1. **SH-GAP-08/07** + **RB-GAP-10** — outbox reclaim + failed replay policy.
2. **SH-GAP-15/04/05** — transient classifier, circuit breaker, Retry-After on 503.
3. **CAE-GAP-05/04** — test-reset prod guard; admin credential separation.
4. **CI-BYP-12/13/17** — GHA phase-4/5 + Postgres CI service.
5. **MD-GAP-12** — boot migration head check.

### کوتاه‌مدت (P1)

6. **RB-GAP-01…04** — forward-only rollback runbook + expand/contract discipline.
7. **SHADOW-API** — `openapi:generate` + dispatchRequest CI gate.
8. **DEPLOY-DEBT-01/02** — version strategy Phase 6 decision.
9. **RB-GAP-09/08** — ingress `shuttingDown` + grace period docs.
10. **SH-GAP-13** — Redis fail-open policy (phase3 RL-DOS-04).

### میان‌مدت (P2/P3 — Phase 6+)

11. **CAE-GAP-01/02** — soft delete + canonical history.
12. **RB-GAP-13/14** — Redis flush API; split relay Deployment.
13. **SM-VUL** — dual-key JWT + rotation pipeline.
14. **SCAL-LIM-02/03** — export pool/lag metrics for HPA.
15. **CI-BYP-01/28/32/33/34** — trunk policy hardening.

---

## تأیید شده (PASS / partial OK)

| Area                                | Evidence                                          |
| ----------------------------------- | ------------------------------------------------- |
| **Equal-tier 429/503 shed**         | Per-tenant RL + pool mapping DEC-012              |
| **Single migration TX rollback**    | Prisma wraps PostgreSQL TX — MD auto-rollback yes |
| **Append-only audit + FK RESTRICT** | CAE partial protection                            |
| **Production boot guards**          | CI-BYP-30 memory driver block                     |
| **Idempotent HTTP boundary**        | Client retry + outbox dedupe                      |
| **Husky hook bypass blocked**       | CI-BYP-02/03                                      |
| **RLS on retry (future)**           | Whole-TX replay safe if GUC reapplied             |

---

## Appendix A — Self-Heal target recommendations (خلاصه)

1. **`isTransientDbError`** classifier — P1001/P1017 → 503 + Retry-After.
2. **`withTransientDbRetry`** — max 3 attempts, jitter, idempotent boundaries only.
3. **Outbox reclaim** — `processing` age > TTL → `pending`.
4. **Circuit breaker** — open on sustained DB failure; fail-fast ingress.
5. **Redis fallback** — bounded memory bucket when Redis unhealthy.

---

## Appendix B — Rollback target recommendations (خلاصه)

1. Document forward-only in production checklist.
2. Expand/contract migrations — schema before code.
3. Blue/green platform pattern — N-1 stack 5 min.
4. Readiness fails on `shuttingDown` + migration mismatch.
5. Outbox reclaim before rolling rollback.
6. Split relay Deployment.
7. Redis `ratelimit:*` flush runbook.
8. Boot migration head check.
9. Rollback drill integration test — gate >30s as known debt.

---

## Appendix C — OpenAPI / Shadow API target (Phase 6+)

1. `zod-to-openapi` from Zod + `dispatchRequest` inventory.
2. `pnpm run openapi:generate` in package.json.
3. `x-internal: true` for `/internal/*`.
4. Unify `/api/v2` prefix before publishing spec.
5. Contract spec: shadow count **0** at gate.

---

## Regression pack (verification commands)

```bash
cd apps/api

# Graceful shutdown / rollback posture
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma OUTBOX_RELAY_ENABLED=true NODE_ENV=test
node --import tsx --test test/4-integration/graceful-shutdown.spec.ts

# Migration forward-only inventory (static)
ls apps/api/prisma/migrations/*/migration.sql   # expect no down.sql

# Cache flush API — static (expect no matches)
rg -l 'flush.*cache|invalidate.*registry|resetTenantRegistry' apps/api/src/ --glob '!**/*.spec.ts'

# CI gate parity (local)
pnpm run phase-4:gate    # requires DATABASE_URL
pnpm run phase-5:gate    # includes db:test-reset — dev only

# Schema version graceful paths
node --import tsx --test test/4-integration/schema-version-compat.spec.ts

# Audit trail append-only
node --import tsx --test test/security/audit-trail-integrity.spec.ts

# Provisioning production block
node --import tsx --test test/4.3-provisioning.spec.ts

# Autoscale / spike proxies (phase3 cross-ref)
node --import tsx --test test/3-performance/db-pool-saturation.spec.ts
node --import tsx --test test/3-performance/tenant-rate-limiting.spec.ts

# OpenAPI static — expect zero generator
rg -i 'openapi|swagger|tsoa|zod-to-openapi' apps/api/package.json apps/api/src/
```

---

## شمارش نهایی

| دسته                            |  تعداد |
| ------------------------------- | -----: |
| Autonomous readiness score      | 45/100 |
| Verdict                         |   SEMI |
| Operational toil                |     10 |
| 30-day failure scenarios        |     10 |
| Self-Heal (SH-GAP)              |     16 |
| Rollback (RB-GAP)               |     14 |
| Migration Danger (MD-GAP)       |     14 |
| Catastrophic Admin (CAE-GAP)    |     14 |
| soft_delete                     | **no** |
| Deployment Debt                 |      9 |
| Shadow API                      |      7 |
| CI/CD bypass (CI-BYP)           |     44 |
| Scalability Limits (SCAL-LIM)   |     18 |
| Secret vulnerabilities (SM-VUL) |     11 |
| Must-Fix (P0+P1 evolution)      |     10 |
| تناقض/ابهام (CON)               |      7 |

---

## پیوند به auditهای دیگر

| موضوع                              | سند                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Pool / break-point / NN            | [`phase3-scalability-stress-audit-fix-list.md`](phase3-scalability-stress-audit-fix-list.md) |
| Outbox zombies / CASCADE           | [`phase4-resilience-audit-fix-list.md`](phase4-resilience-audit-fix-list.md)                 |
| Tenant isolation / admin backdoors | [`phase1-aggressive-audit-fix-list.md`](phase1-aggressive-audit-fix-list.md)                 |
| Trace / audit gaps                 | [`phase2-paranoid-audit-fix-list.md`](phase2-paranoid-audit-fix-list.md)                     |

---

## Document metadata

| Item               | Value                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Output path**    | `TEMP/phase5-evolution-audit-fix-list.md`                                                                                                                               |
| **Code changes**   | None (`docs/TEMP` only)                                                                                                                                                 |
| **Parent handoff** | `autonomous_readiness_score=45` · `autonomous_verdict=SEMI` · `operational_toil_count=10` · `soft_delete_exists=no` · `ci_bypass_count=44` · `rollback_30s_feasible=no` |
| **Architect note** | Documentation status: **Updated** (extracted from existing audit). Link: `TEMP/phase5-evolution-audit-fix-list.md`                                                      |

_این فایل استخراج از `phase5-evolution-audit.md` است و جایگزین سند منبع نیست. برای جزئیات کامل به سند اصلی مراجعه کنید._
