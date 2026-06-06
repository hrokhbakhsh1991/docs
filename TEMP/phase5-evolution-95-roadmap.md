# نقشه راه موقت — رساندن Autonomous Readiness به ۹۵+

```yaml
status: draft-temp
created: 2026-06-05
baseline_score: 58/100
baseline_verdict: SEMI
target_score: "≥95/100"
target_verdict: AUTONOMOUS
source_audit: apps/api/docs/phase5-evolution-audit.md
source_fix_list: TEMP/phase5-evolution-audit-fix-list.md
closed_phases: evolution P0/P1/P2 (DEC-071…109) — score 45→58
gap_to_close: ~37 points + verdict flip
```

> **هدف:** فایل کار موقت برای برنامه‌ریزی اجرا — قبل از هر تغییر در `apps/api` باید appendix در `docs/phase-5/` نوشته شود (Doc-First Covenant).

---

## ۱. وضعیت فعلی (پس از فازهای ۱–۳)

| متریک                   | مقدار                          |
| ----------------------- | ------------------------------ |
| امتیاز کل               | **58 / 100**                   |
| حکم                     | **SEMI** (نه AUTONOMOUS)       |
| Toil دستی               | **6** + **4** نیمه‌خودکار      |
| Self-Heal gaps بسته‌شده | ۵ از ۱۶                        |
| Rollback ۳۰ثانیه‌ای     | **خیر**                        |
| Soft delete             | **خیر**                        |
| Auto JWT rotation       | **خیر**                        |
| Priority load shed      | **خیر**                        |
| Prod scrape/alert       | **خیر** (فقط scaffold DEC-108) |

### امتیاز ستون‌ها (هدف برای ۹۵+)

| Pillar                 | الان | هدف فاز ۷ | دلیل اصلی شکاف                                      |
| ---------------------- | ---: | --------: | --------------------------------------------------- |
| Self-Heal (DB/network) |   44 |   **≥92** | TX retry، backoff relay، auto-retry قبل از `failed` |
| Background recovery    |   58 |   **≥95** | classifier transient/poison، projection auto-heal   |
| Scale & overload       |   42 |   **≥88** | priority shed، admission gate، HPA روی متریک سفارشی |
| Deploy & rollback      |   48 |   **≥93** | Argo Rollouts، relay جدا، cache invalidate prod     |
| Observability & alert  |   52 |   **≥94** | Alertmanager + SLO rules + OTel trace               |
| Secrets & CI trust     |   54 |   **≥92** | auto-rotation، `ci:integrity`→phase-5، vault/ESO    |
| Data safety & admin    |   58 |   **≥93** | soft delete، admin guard، RPO/RTO اثبات‌شده         |

**تخمین امتیاز پس از هر فاز** (مدل audit — weighted + toil penalty):

| پایان فاز    | امتیاز تخمینی | حکم                  |
| ------------ | ------------: | -------------------- |
| الان (فاز ۳) |            58 | SEMI                 |
| فاز ۴        |         72–76 | SEMI+                |
| فاز ۵        |         82–86 | SEMI→AUTONOMOUS مرزی |
| فاز ۶        |         90–93 | AUTONOMOUS مرزی      |
| فاز ۷        |     **95–98** | **AUTONOMOUS**       |

---

## ۲. راه‌حل‌های صنعتی به‌روز (۲۰۲۵–۲۰۲۶) — مرجع انتخاب

این بخش از منابع معاصر استخراج شده و با معماری `apps/api` (Node 24، Prisma، outbox in-DB، tenant RLS، monorepo gate) تطبیق داده شده است.

### ۲.۱ مدل «اتونومی تدریجی» (Crawl → Walk → Run)

| مرحله          | الگوی صنعتی                                                         | معادل در app-tour                                      |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **Observe**    | Agent/SRE در shadow mode — فقط لاگ اقدام پیشنهادی                   | Guard + spec جدید بدون فعال‌سازی prod flag             |
| **Assist**     | Human-in-the-loop برای replay/rollback                              | `POST /internal/outbox/:id/replay` (موجود DEC-086)     |
| **Autonomous** | Policy envelope + blast-radius + auto-rollback اگر verify شکست خورد | relay auto-retry، Argo analysis abort، circuit breaker |

منبع: [Nova AI Ops — Self-Healing 2026](https://novaaiops.com/self-healing-infrastructure)، [Microsoft Agent SRE — error budgets](https://techcommunity.microsoft.com/blog/linuxandopensourceblog/applying-site-reliability-engineering-to-autonomous-ai-agents/4521357)

### ۲.۲ Resilience لایه اپلیکیشن (الزامی در ۲۰۲۶)

| الگو                        | جزئیات مدرن                                              | وضعیت پروژه      | اقدام                                      |
| --------------------------- | -------------------------------------------------------- | ---------------- | ------------------------------------------ |
| Circuit breaker             | پنجره لغزان درصدی (نه شمارش مطلق)؛ trip روی slow-call هم | DEC-094 ✅ جزئی  | گسترش به slow-call + per-dependency        |
| Retry budget                | token bucket روی retry؛ jitter exponential               | ❌               | `withTransientDbGuard` + relay backoff     |
| Named fallback              | stale cache / degraded / outbox — نه raw 500             | Redis DEC-083 ✅ | theme registry stale-read روی breaker open |
| Backpressure قبل از breaker | رد کار کم‌اولویت قبل از open شدن CB                      | ❌ SCAL-LIM-05   | `priorityTier` weighted fair queue         |

منبع: [Modern Backend #108 — Circuit Breakers](https://modernbackend.substack.com/p/microservices-re-explained-108-circuit)

### ۲.۳ Transactional Outbox (به‌روز)

| الگو                         | توصیه ۲۰۲۶                              | وضعیت پروژه                    |
| ---------------------------- | --------------------------------------- | ------------------------------ |
| Poll + `SKIP LOCKED`         | مناسب حجم فعلی (<10k evt/s)             | ✅ reclaim DEC-071             |
| Exponential backoff + jitter | جلوگیری از retry storm                  | ❌ poll ثابت ~1s               |
| Transient vs poison          | retry در relay؛ `failed` فقط poison     | ❌ همه → `failed`              |
| DLQ / admin replay           | poison به صف جدا + API replay           | نیمه‌خودکار DEC-086            |
| Relay جدا از HTTP            | deploy مستقل؛ graceful `shutdown_grace` | ❌ colocated RB-GAP-14         |
| CDC (Debezium)               | فقط اگر lag/latency <100ms لازم شد      | **defer** — حجم فعلی کافی نیست |

منابع: [AWS Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)، [pg-outbox reference impl](https://github.com/senku-tech/pg-outbox)، [Outbox vs CDC](https://prepstack.co.in/interview/system-design/outbox-transactional-vs-cdc)

### ۲.۴ Deploy & Rollback سریع (<۳۰s)

| الگو                                     | ابزار ۲۰۲۶                            | fit پروژه                                                |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| Blue/Green + `scaleDownDelaySeconds: 30` | Argo Rollouts v1.9                    | RB-GAP-05/08 — **platform** (خارج repo ولی gate در repo) |
| Canary + Prometheus analysis             | AnalysisTemplate روی `http_5xx_rate`  | جلوگیری از bad deploy بدون انسان                         |
| GitOps rollback                          | Argo CD `rollback` یا Rollout abort   | تکمیل DEC-098 runbook با automation                      |
| Forward-only DB                          | بدون `migrate down` — expand/contract | قبلاً تصمیم DEC-098 ✅                                   |

منبع: [Argo Rollouts Analysis](https://argoproj.github.io/argo-rollouts/features/analysis/)

### ۲.۵ Observability & Autoscale

| الگو                     | جزئیات                                                  | fit پروژه           |
| ------------------------ | ------------------------------------------------------- | ------------------- |
| Prometheus text          | `GET /internal/metrics`                                 | DEC-108 ✅ scaffold |
| Prometheus Adapter → HPA | scale روی `outbox_pending_total`، `http_inflight`       | SCAL-LIM-01/02      |
| KEDA                     | scale-to-zero relay worker                              | اختیاری فاز ۵       |
| OTel traces              | propagation `traceparent` در outbox relay               | فاز ۶               |
| Alertmanager SLO         | `projection_inconsistency_total`، `outbox_failed_total` | فاز ۵               |

منبع: [K8s HPA Custom Metrics 2026](https://devopsil.com/articles/2026-03-21-kubernetes-hpa-custom-metrics-guide)

### ۲.۶ Secrets & Identity

| الگو                                     | fit                                            |
| ---------------------------------------- | ---------------------------------------------- |
| Dual-key verify window                   | DEC-107 ✅                                     |
| External Secrets Operator + cert-manager | JWT PEM sync بدون restart دستی                 |
| Per-tenant keys                          | **defer Phase 8** — هزینه بالا                 |
| Vault dynamic DB creds                   | **defer** — فعلاً rolling restart کافی برای ۹۵ |

---

## ۳. فازبندی اجرا (اختصاصی app-tour)

```mermaid
flowchart LR
  P3[فاز ۳ ✅ 58] --> P4[فاز ۴ In-App P0]
  P4 --> P5[فاز ۵ Platform Ops]
  P5 --> P6[فاز ۶ Data + Secrets]
  P6 --> P7[فاز ۷ Contract + CI closure]
  P7 --> T95[≥95 AUTONOMOUS]
```

---

### فاز ۴ — In-App P0 باقی‌مانده (امتیاز هدف: ~۷۴)

**مدت تخمینی:** ۲–۳ هفته · **دامنه:** `apps/api` + guards + specs

| #      | Gap IDs                | راه‌حل (مدرن)                                                                          | Deliverable                                                     | DEC پیشنهادی             |
| ------ | ---------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------ |
| 4.1 ✅ | SH-GAP-07, phase4 F-03 | Classifier transient/poison در relay؛ N retry با backoff قبل از `failed`               | `classifyOutboxPublishError()` + `max_attempts` در relay config | **DEC-110** — 2026-06-05 |
| 4.2 ✅ | SH-GAP-06, 09, 10      | Exponential backoff + jitter روی poll relay، shutdown flush، idempotency poll          | `computeRelayBackoff(attempt)` مشترک                            | **DEC-111** — 2026-06-05 |
| 4.3 ✅ | SH-GAP-01, 02, 03      | Retry budget داخل `withCanonicalTransaction` برای P1001/P1017 (حداکثر ۲، فقط whole-TX) | `withTransientTxRetry()` + RLS-safe                             | **DEC-112** — 2026-06-05 |
| 4.4 ✅ | SH-GAP-05              | `Retry-After` روی 503 pool saturation (تکمیل DEC-094)                                  | `DbPoolSaturatedError` + tenant budget 503                      | **DEC-113** — 2026-06-05 |
| 4.5 ✅ | SCAL-LIM-05, 12        | Priority tier از `theme.priorityTier` — low tier 429/503 اول                           | `weightedFairAdmission()` در ingress                            | **DEC-114** — 2026-06-05 |
| 4.6 ✅ | phase4 F-04            | Projection auto-reconcile دوره‌ای (نه فقط manual replay)                               | `reconcileTourProjection()` scheduler + metric                  | **DEC-115** — 2026-06-05 |
| 4.7 ✅ | SH-GAP-11, 12          | Idempotency poll backoff (نه 25ms ثابت 30s)                                            | `sleepIdempotencyPollBackoff` (DEC-111)                         | **DEC-116** — 2026-06-05 |
| 4.8 ✅ | CI                     | Guards جدید + `phase-5:evolution-gate` گسترش                                           | `phase-5:evolution-phase4-gate` rollup                          | **DEC-117** — 2026-06-05 |

**Verify:**

```bash
cd apps/api
pnpm run phase-5:evolution-gate
pnpm run test:full   # DATABASE_URL set
```

**خروجی امتیاز:** Self-Heal 44→~68، Background 58→~82، Scale 42→~55

---

### فاز ۵ — Platform & Observability (امتیاز هدف: ~۸۵)

**مدت تخمینی:** ۳–۴ هفته · **دامنه:** `infra/` یا `deploy/` + Helm/Rollout YAML + alert rules (ممکن است repo جدا)

| #      | Gap IDs             | راه‌حل (مدرن)                                                   | Deliverable                             |
| ------ | ------------------- | --------------------------------------------------------------- | --------------------------------------- | ------------------------ |
| 5.1 ✅ | RB-GAP-05, 08, 14   | Argo Rollout blue-green API + Deployment جدا `outbox-relay`     | `deploy/argo-rollouts/api-rollout.yaml` | **DEC-118** — 2026-06-05 |
| 5.2 ✅ | RB-GAP-12, 13       | Cache invalidate **prod** با service JWT + feature freeze flag  | گسترش DEC-106 به prod path محدود        | **DEC-120** — 2026-06-05 |
| 5.3 ✅ | SCAL-LIM-01, 02, 15 | ServiceMonitor + Prometheus Adapter rules روی متریک‌های DEC-108 | `deploy/prometheus/adapter-rules.yaml`  | **DEC-121** — 2026-06-05 |
| 5.4 ✅ | SCAL-LIM-01         | HPA: `outbox_pending_total` + `http_requests_in_flight`         | `deploy/hpa/api-hpa.yaml`               | **DEC-122** — 2026-06-05 |
| 5.5 ✅ | Observability       | Alertmanager: outbox_failed، projection drift، DB circuit open  | `deploy/alerts/phase5-slo.yaml`         | **DEC-123** — 2026-06-05 |
| 5.6 ✅ | CI-BYP-11           | `ci:integrity` شامل `phase-4:guard` + `phase-5:evolution-gate`  | `scripts/ci-integrity-check.sh`         | **DEC-119** — 2026-06-05 |
| 5.7 ✅ | MD-GAP-05, 06       | یکسان‌سازی CI با `migrate deploy` only — حذف drift `infra/sql`  | doc + script guard                      | **DEC-124** — 2026-06-05 |
| 5.8 ✅ | CAE-GAP-14          | RPO/RTO در production checklist + job ماهانه restore drill      | appendix + optional GHA cron            | **DEC-125** — 2026-06-05 |

**Verify:**

```bash
pnpm run ci:integrity          # باید phase-5 را هم بزند
# cluster: kubectl argo rollouts status api-rollout
# prom: alert test — amtool alert add ...
```

**خروجی امتیاز:** Deploy 48→~78، Observability 52→~82، Scale 42→~72 (با HPA)

---

### فاز ۶ — Data Safety & Secrets (امتیاز هدف: ~۹۲)

**مدت تخمینی:** ۳–۴ هفته · **دامنه:** Prisma migration + admin guards + secrets pipeline

| #   | Gap IDs           | راه‌حل (مدرن)                                                      | Deliverable                                              |
| --- | ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 6.1 | CAE-GAP-01, 02    | Soft delete `tours.deleted_at` + query filter default              | migration + repository filter (DEC-105 اجرا)             |
| 6.2 | CAE-GAP-04, 06    | `withAdminMutationGuard({ requireWhere: true })` + revoke TRUNCATE | admin wrapper + migration GRANT                          |
| 6.3 | CAE-GAP-03, 10    | `tour_revisions` append-only (اختیاری ولی +امتیاز بالا)            | history table                                            |
| 6.4 | SM-VUL-01…04      | ESO یا cert-manager: `AUTH_JWT_PUBLIC_KEY` rotate بدون دستی        | `deploy/external-secrets/jwt.yaml`                       |
| 6.5 | SM-VUL            | Runbook → pipeline: staged dual-key → promote → retire previous    | GitHub Action یا CronJob                                 |
| 6.6 | AR-30-09          | Alert ۷ روز قبل از JWT expiry                                      | Prometheus rule                                          |
| 6.7 | DEPLOY-DEBT-01…04 | **تصمیم Phase 6:** header routing یا lockstep automated checklist  | appendix تصمیم (اگر header: `Accept-Version` middleware) |

**Verify:**

```bash
pnpm run guard:tenant-isolation
pnpm run phase-5:evolution-gate
# integration: soft-deleted tour invisible in list API
```

**خروجی امتیاز:** Data safety 58→~90، Secrets 54→~88

---

### فاز ۷ — Contract Closure & امتیاز ۹۵+ (امتیاز هدف: ≥۹۵)

**مدت تخمینی:** ۲–۳ هفته · **دامنه:** OpenAPI richness + residual gaps + re-baseline audit

| #   | Gap IDs              | راه‌حل                                                            | Deliverable                          |
| --- | -------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| 7.1 | SHADOW / DEPLOY-DEBT | `zod-to-openapi` از route schemas موجود                           | generator v2 + CI diff gate          |
| 7.2 | SH-GAP-13, 14        | Redis RL: stale allow + registry read-through cache TTL           | تکمیل fallback paths                 |
| 7.3 | SH-GAP-15            | CB sliding window + slow-call trip (تکمیل)                        | breaker config + metrics             |
| 7.4 | SCAL-LIM-09          | Validation queue reject وقتی depth > watermark                    | `validation-queue-saturated` → 503   |
| 7.5 | CI-BYP residual      | بستن ۴۴ bypass — اولویت env leak `P5_*_ABORT` gated               | `guard-production-chaos-env.mjs`     |
| 7.6 | Toil                 | کاهش toil دستی ۶→۰–۱                                              | re-baseline `operational_toil_count` |
| 7.7 | Audit                | به‌روزرسانی `phase5-evolution-audit.md` executive + pillar scores | score ≥95 ثبت رسمی                   |

**Verify:**

```bash
pnpm run phase-5:evolution-gate
pnpm run doc-gate
pnpm run test:full
# manual: autonomous_readiness_score recalc in audit doc
```

---

## ۴. چک‌لیست اولویت‌دار (خلاصه اجرایی)

### P0 — بدون این‌ها به ۹۵ نمی‌رسیم

- [x] **4.1** Auto-retry outbox قبل از `failed` (SH-GAP-07) — DEC-110
- [x] **5.1** Rollback <30s با Argo Rollouts (RB-GAP-05/08) — DEC-118
- [x] **5.5** Alerting prod روی outbox + projection (observability) — DEC-123
- [ ] **6.1** Soft delete tours (CAE-GAP-02)
- [x] **5.4** HPA روی custom metrics (SCAL-LIM-01) — DEC-122

### P1 — امتیاز را از ~۸۵ به ~۹۲ می‌برد

- [x] **4.2** Backoff relay/shutdown/idempotency — DEC-111
- [x] **4.3** TX retry budget (SH-GAP-01/02) — DEC-112
- [x] **4.5** Priority load shed (SCAL-LIM-05) — DEC-114
- [x] **5.2** Prod cache invalidate + freeze (RB-GAP-11/13) — DEC-120
- [ ] **6.4–6.5** JWT auto-rotation pipeline
- [x] **5.6** `ci:integrity` → phase-4 guard + evolution — DEC-119

### P2 — polish برای ۹۵–۹۸

- [ ] **7.1** zod-to-openapi
- [ ] **6.2** Admin mutation guard
- [x] **4.6** Projection auto-reconcile — DEC-115
- [x] **4.7** Idempotency backoff — DEC-116 (via DEC-111)
- [x] **4.8** Evolution phase-4 gate rollup — DEC-117
- [ ] **7.5** CI bypass env leaks
- [ ] **7.7** Re-baseline audit رسمی

### Defer (بعد از ۹۵ یا Phase 8+)

- CDC/Debezium برای outbox (حجم فعلی کافی نیست)
- Per-tenant JWT/DB credentials
- Vault dynamic secrets
- `Accept-Version` کامل (اگر lockstep automated شود، امتیاز کافی است)
- AI agentic SRE tier (Nova-style) — خارج scope

---

## ۵. وابستگی‌ها و ریسک

| ریسک                           | تأثیر                                                 | Mitigation                                       |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------ |
| فاز ۵ نیاز به cluster K8s دارد | بدون آن Deploy pillar سقف ~۷۰ می‌ماند                 | حداقل: documented Argo manifests + staging proof |
| TX retry + RLS                 | replay کل TX باید `applyTenantRlsSessionVars` حفظ کند | spec integration per tenant                      |
| Soft delete breaking change    | clients قدیمی `deleted` را می‌بینند                   | default filter + migration backfill              |
| امتیاز ۹۵ مدل subjective است   | audit دستی re-baseline لازم                           | فاز ۷ حتماً `phase5-evolution-audit.md` update   |
| Doc-first hook                 | commit بدون `docs/` block می‌شود                      | هر DEC قبل از کد                                 |

---

## ۶. ترتیب پیشنهادی اجرا (Sprint)

| Sprint | فاز     | تمرکز                             | امتیاز تجمعی |
| ------ | ------- | --------------------------------- | ------------ |
| S1     | 4.1–4.2 | Outbox auto-retry + backoff       | ~65          |
| S2     | 4.3–4.5 | TX retry + priority shed          | ~72          |
| S3     | 4.6–4.8 | Projection heal + gates           | ~76          |
| S4     | 5.1–5.2 | Argo + prod cache                 | ~82          |
| S5     | 5.3–5.6 | Metrics HPA + CI integrity        | ~86          |
| S6     | 6.1–6.3 | Soft delete + admin guard         | ~90          |
| S7     | 6.4–6.6 | JWT rotation auto                 | ~92          |
| S8     | 7.x     | OpenAPI v2 + bypass + re-baseline | **≥95**      |

---

## ۷. منابع مرجع (خارجی)

1. [Self-Healing Infrastructure 2026 — phased autonomy](https://novaaiops.com/self-healing-infrastructure)
2. [Microsoft — SRE error budgets for autonomous systems](https://techcommunity.microsoft.com/blog/linuxandopensourceblog/applying-site-reliability-engineering-to-autonomous-ai-agents/4521357)
3. [Circuit breakers — sliding window + named fallback](https://modernbackend.substack.com/p/microservices-re-explained-108-circuit)
4. [AWS — Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
5. [Argo Rollouts — automated rollback via analysis](https://argoproj.github.io/argo-rollouts/features/analysis/)
6. [K8s HPA custom metrics — Prometheus Adapter 2026](https://devopsil.com/articles/2026-03-21-kubernetes-hpa-custom-metrics-guide)
7. [pg-outbox — relay shutdown_grace + max_attempts reference](https://github.com/senku-tech/pg-outbox)

---

## ۸. لینک‌های داخلی پروژه

- Audit: [`apps/api/docs/phase5-evolution-audit.md`](../apps/api/docs/phase5-evolution-audit.md)
- Fix list: [`TEMP/phase5-evolution-audit-fix-list.md`](./phase5-evolution-audit-fix-list.md)
- Phase 1–3 closure: [`docs/phase-5/appendices/`](../docs/phase-5/appendices/)
- Gate: `pnpm run phase-5:evolution-gate`
- Deploy runbook: [`docs/phase-4/production-deploy-checklist.md`](../docs/phase-4/production-deploy-checklist.md)

---

_Architect, documentation status: Not Needed (TEMP working doc only). Link to docs: N/A — promote to `docs/phase-5/appendices/phase5-evolution-95-roadmap.md` when execution starts._
