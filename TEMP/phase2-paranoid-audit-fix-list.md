# Phase 2 Paranoid Audit — Fix List

**Source:** [`apps/api/docs/phase2-paranoid-audit.md`](../apps/api/docs/phase2-paranoid-audit.md)  
**Generated:** 2026-06-05  
**Scope:** `apps/api` observability sinks, trace/tenant ALS, metrics, HTTP error surfaces, audit trail, middleware context, unstructured I/O, verification scripts.

---

## خلاصه اجرایی (فارسی)

| مورد                       | مقدار                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **امتیاز اعتماد Red Team** | **78 / 100** (باند 75–89: ship با Must-Fix)                                                                       |
| **حکم**                    | **شرطی برای Phase 2 integration** روی Postgres با هدر correlation؛ **امضا نشده** برای forensics/billing تولیدی    |
| **ستون‌های امتیاز**        | Observability coverage **38/50** · Leak resistance **40/50**                                                      |
| **Must-Fix (امضای prod)**  | **۳ مورد:** LOG-V-01/STD-BYPASS-02، TRACE-REGEN-01/TRACE-CONTEXT-SPLIT، AUDIT-GAP-01                              |
| **Fix-next (parity کامل)** | **۵ مورد:** TRACE-LOST-03، AUDIT-GAP-02، TRACE-LOST-01، STD-BYPASS-01، MET-API-01                                 |
| **وضعیت حوزه‌ها**          | Amber: logging، trace، audit · Green: metrics، HTTP errors، ALS، log backpressure (fast sink)، automated evidence |
| **نقاط قوت**               | OBS-LOG-01، opaque 500/503، metrics با `tenant_id`، ALS HTTP cleanup PASS، append-only audit                      |

**جمع‌بندی:** مسیر درخواست HTTP از نظر لاگ ساخت‌یافته و سطح خطا قوی است؛ سه شکاف **P0** قبل از بستن observability برای production اجباری است. پنج Fix-next trace، audit به‌روزرسانی، access log و گاردهای CI را تکمیل می‌کند. زیر sink کند لاگ (Phase 3) وضعیت **Fatal** است — با Green فاز ۲ در تضاد ظاهری است (بخش تناقضات).

### شمارش یافته‌ها

| سطل                         |   تعداد | توضیح                                                                                      |
| --------------------------- | ------: | ------------------------------------------------------------------------------------------ |
| **Must-Fix (P0)**           |   **3** | مسدودکننده امضای Red Team                                                                  |
| **Fix-next (P1)**           |   **5** | جدول Red Team — parity observability                                                       |
| **P1 (سایر)**               |   **7** | LOG-V-02/03، TRACE-REGEN-02، LOG-BP hardening، ERR-BYPASS-01، ALS-FOOTGUN-01               |
| **P2**                      |  **18** | LOG-V-04…07، MET-COV/VALID، AUDIT-GAP-03/05/06، ERR-_، LOG-BP-03/04/05، CTX-MW-LOW-01، H-_ |
| **P3 / Phase 7**            |  **12** | TRACE-LOST-02، MET-EXPORT-01، AUDIT-GAP-04/07، ERR-400-01، LOG-BP defer، CTX-MW-P3         |
| **Pass / OK / Info**        | **35+** | Appendix A                                                                                 |
| **شناسه‌های یکتا (ردیابی)** | **~81** | شامل aliasهای گروه‌بندی‌شده                                                                |

---

## تناقضات و ابهامات در سند (نیاز به هم‌راستاسازی)

| ID            | محل در سند                                                                                                                                                                                     | تناقض                           | توضیح / اقدام پیشنهادی                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CON-P2-01** | Red Team Must-Fix #2 (**P0**) vs جدول trace **TRACE-REGEN-01 = High**                                                                                                                          | همان باگ با severity متفاوت     | **High** = شدت فنی؛ **P0** = اولویت remediation. در سند اصلی یک ستون «Remediation priority» اضافه کنید تا خواننده گیج نشود.                                                                                                                                                                                                                             |
| **CON-P2-02** | Red Team Fix-next **STD-BYPASS-01 = P1** vs Console bypass remediation **P2** («Add CI grep»)                                                                                                  | اولویت CI grep در دو بخش متفاوت | Fix-next Red Team معتبرتر است — CI grep باید **P1** باشد (هم‌راستا با STD-BYPASS-01 severity **P1**).                                                                                                                                                                                                                                                   |
| **CON-P2-03** | **AUDIT-GAP-02** در جدول audit **P1** vs Red Team **Fix-next (not Must-Fix)**                                                                                                                  | آیا update audit blocker است؟   | عمدی: DEC-007 فقط create را پوشش می‌دهد؛ **P1 parity** نه **P0 prod sign-off**. در doc محصول صریح کنید: «update audit = product gap، نه compliance blocker امروز».                                                                                                                                                                                      |
| **CON-P2-04** | Red Team summary **Log backpressure = Green** vs Phase 3 [`phase3-scalability-stress-audit.md`](../apps/api/docs/phase3-scalability-stress-audit.md) **FOF-LOG-01…03 = Fatal** under slow sink | Green محلی vs Fatal تحت فشار    | **تناقض ظاهری، نه منطقی:** Phase 2 فقط burst 1000× `/health` روی **fast stdout** را اندازه گرفته (**LOG-BP-01**). Phase 3 sink کند / RPS بالا را مدل می‌کند (**FOF-LOG-01** unbounded buffer، **FOF-LOG-02** sync `finish`، **FOF-LOG-03** no flush on SIGTERM). **پیشنهاد:** در Phase 2 summary بنویسید «Green (fast sink only; see Phase 3 FOF-LOG)». |
| **CON-P2-05** | **TRACE-LOST-01** remediation trace § **P2** vs Red Team Fix-next **P1**                                                                                                                       | اولویت access log traceId       | Red Team Fix-next **P1** را مبنا بگیرید؛ جدول remediation trace را به P1 هم‌راستا کنید.                                                                                                                                                                                                                                                                 |
| **CON-P2-06** | Phase 1 trust **84/100** ([`phase1-aggressive-audit-fix-list.md`](phase1-aggressive-audit-fix-list.md)) vs Phase 2 **78/100**                                                                  | اعداد متفاوت                    | دامنه متفاوت (tenant isolation vs observability) — **تناقض نیست**؛ در گزارش مدیریتی جدا گزارش دهید.                                                                                                                                                                                                                                                     |
| **CON-P2-07** | **LOG-V-01** (Phase 2) vs **LOG-COL-01…04** (Phase 1)                                                                                                                                          | همپوشانی console/PII            | همان ریسک shutdown unstructured — **یک PR** برای `graceful-shutdown.ts` + policy console در `src/`.                                                                                                                                                                                                                                                     |
| **CON-P2-08** | **AUDIT-GAP-01** (Phase 2 Must-Fix) vs **DM-CT-01 / DI-MEM-01** (Phase 1 P0)                                                                                                                   | memory driver در دو audit       | همان policy: `STORAGE_DRIVER=prisma` در prod — ticket واحد با aliases.                                                                                                                                                                                                                                                                                  |
| **CON-P2-09** | Console bypass claim «no console in apps/api» vs **45** `console.*` sites                                                                                                                      | ادعای مطلق vs policy scoped     | سند console § خودش **FAIL** می‌گوید — فقط **src/** باید zero-console باشد؛ ادعای global در docهای قدیمی‌تر را اصلاح کنید.                                                                                                                                                                                                                               |
| **CON-P2-10** | Middleware § «**no critical bugs**» vs **TRACE-REGEN-01** split-brain                                                                                                                          | middleware سبز؛ trace کهربایی   | middleware ALS fork ندارد؛ split-brain از **bind-request-context** است نه middleware — در doc cross-link واضح‌تر.                                                                                                                                                                                                                                       |

---

## Must-Fix (P0) — blocks production sign-off

### MF-1 — LOG-V-01 / STD-BYPASS-02

| Field             | Value                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**            | LOG-V-01, STD-BYPASS-02                                                                                                                                                                               |
| **Severity**      | **P0**                                                                                                                                                                                                |
| **File**          | `apps/api/src/server/graceful-shutdown.ts:69`                                                                                                                                                         |
| **Problem**       | تنها bypass unstructured در production `src/`: ``console.error(`graceful-shutdown: failed: ${message}`)`` — `message` = `Error.message` ممکن است Prisma/SQL/path را در stderr بریزد (SIGTERM/SIGINT). |
| **Suggested fix** | `logger.error({ event: "graceful_shutdown.failed", code?, correlation_id? }, "graceful shutdown failed")` — هرگز `Error.message` خام را در `console` interpolate نکنید.                               |
| **Cross-ref**     | Audit § Logger privacy، § Console bypass، Red Team Must-Fix #1                                                                                                                                        |

### MF-2 — TRACE-REGEN-01 / TRACE-CONTEXT-SPLIT

| Field             | Value                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**            | TRACE-REGEN-01, TRACE-CONTEXT-SPLIT                                                                                                                                           |
| **Severity**      | **P0** (remediation) / **High** (finding table)                                                                                                                               |
| **Files**         | `apps/api/src/app.ts` L75–76؛ `apps/api/src/http/bind-request-context.ts` L28–29؛ `apps/api/src/tours/tours.routes.ts` (catch → `handleHttpError`)                            |
| **Problem**       | `resolveTraceIdFromHeaders` **دو بار** — بدون هدر ingress هر بار `randomUUID()` جدا → GUC/inner ALS ≠ `correlationId` روی خطای route بعد از teardown inner ALS (split-brain). |
| **Suggested fix** | trace را **یک بار** در `app.ts` resolve کنید و به `runWithHttpRequestContext` پاس دهید؛ فراخوانی دوم در `bind-request-context.ts` را حذف کنید.                                |
| **Cross-ref**     | Audit § Trace lifecycle، § Middleware CTX-MW-LOW-01، Red Team Must-Fix #2                                                                                                     |

### MF-3 — AUDIT-GAP-01

| Field             | Value                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**            | AUDIT-GAP-01                                                                                                                                                                             |
| **Severity**      | **P0 (production)**                                                                                                                                                                      |
| **Files**         | deploy config؛ `apps/api/src/storage/create-tour-storage.ts`؛ `production-runtime-env` policy                                                                                            |
| **Problem**       | `STORAGE_DRIVER=memory` (پیش‌فرض بدون `DATABASE_URL`) هرگز `appendAuditEvent` نمی‌زند — create/update **صفر** ردیف `audit_events`؛ CI ممکن است سبز باشد در حالی که forensic غیرفعال است. |
| **Suggested fix** | در production: اجبار `STORAGE_DRIVER=prisma` + `DATABASE_URL` (fail boot یا reject writes)؛ memory را **non-forensic** مستند کنید.                                                       |
| **Cross-ref**     | Audit § Audit events، Red Team Must-Fix #3؛ Phase 1 DM-CT-01                                                                                                                             |

---

## Fix-next (P1) — Red Team parity table

| ID                | File / area                                                      | Problem                                                                                     | Suggested fix                                                                       |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **TRACE-LOST-03** | `apps/api/src/canonical/atomic-canonical-tour-persist.ts` L91–98 | `correlationId` در `enqueueOutboxEvent` حذف شده — `outbox_events.correlation_id` همیشه NULL | `correlationId: getActiveTraceId()` (یا `requireActiveTraceId()`) در create         |
| **AUDIT-GAP-02**  | `PATCH /tours` → `CanonicalTourService.updateTour`               | بدون `appendAuditEvent` — بدون `TOUR_UPDATED`                                               | `AUDIT_ACTION_TOUR_UPDATED` در همان TX با update                                    |
| **TRACE-LOST-01** | `apps/api/src/http/request-logging.ts` → `logHttpRequest`        | access log بدون `traceId` / `correlation_id`                                                | فیلد structured از `getActiveTraceId()` در `finish` یا child logger در شروع request |
| **STD-BYPASS-01** | CI / `apps/api/src/**`                                           | 45 site `console.*` در repo؛ فقط 1 در `src/` اما بدون گارد CI                               | grep/lint: ممنوعیت `console.` زیر `apps/api/src/`                                   |
| **MET-API-01**    | `apps/api/src/observability/metrics.ts` + call sites             | `increment(name, labels?)` — labels اختیاری؛ ریسک سری unlabeled برای billing                | CI/lint: incrementهای tenant-scoped باید `tenant_id` داشته باشند (HT-11)            |

---

## باگ‌ها و آسیب‌پذیری‌ها (تمام شناسه‌های violation/gap)

### Logger privacy — LOG-V-\*

| ID           | Sev    | File:line                                            | Problem                                        | Suggested fix                               |
| ------------ | ------ | ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| **LOG-V-01** | **P0** | `src/server/graceful-shutdown.ts:69`                 | `console.error` با interpolate `Error.message` | MF-1 — structured `logger.error`            |
| **LOG-V-02** | P1     | `scripts/db-seed.ts:12`                              | `console.log` با UUID tenant                   | فقط `subdomain` یا JSON بدون UUID؛ `logger` |
| **LOG-V-03** | P1     | `scripts/db-seed.ts:17`                              | `console.error(error)` — stack/message خام     | structured error با code ثابت               |
| **LOG-V-04** | P2     | `test/4-integration/graceful-shutdown-worker.ts:100` | همان الگوی LOG-V-01 در harness                 | `{ event, code }` یا exit code              |
| **LOG-V-05** | P2     | `test/4-integration/graceful-shutdown.spec.ts:462`   | `console.warn` با `\n${message}`               | warn با code ثابت                           |
| **LOG-V-06** | P2     | `test/chaos/atomic-tx-crash-child.ts:40`             | `console.error(message)` خام                   | event + code                                |
| **LOG-V-07** | P2     | `test/chaos/atomic-crash-worker.ts:59`               | همان LOG-V-06                                  | همان                                        |

### Advisories — H-\* (structured hygiene, not OBS-LOG-01 violations)

| ID       | Sev      | File                                            | Problem                                                        | Suggested fix                                   |
| -------- | -------- | ----------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| **H-01** | Advisory | `src/observability/logger.ts`                   | `http.path` = full `req.url` — query ممکن است token داشته باشد | normalize/redact path                           |
| **H-02** | Advisory | `start-outbox-relay.ts`, `error-interceptor.ts` | `message: error.message` در JSON structured — PII کاربر        | `error_code` پایدار + detail server-side        |
| **H-03** | Advisory | `scripts/reliability-outbox-relay-profile.ts`   | dump `P5_RELIABILITY_SAMPLES` به stderr                        | اطمینان از نبود UUID tenant در samples مشترک CI |

### Trace lifecycle — TRACE-\*

| ID                      | Sev               | File:line / boundary                            | Problem                                          | Suggested fix                                 |
| ----------------------- | ----------------- | ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| **TRACE-REGEN-01**      | **High** / P0 fix | `app.ts` + `bind-request-context.ts`            | double `resolveTraceIdFromHeaders` → split-brain | MF-2                                          |
| **TRACE-REGEN-02**      | Medium            | `error-interceptor.ts` `resolveCorrelationId()` | `getActiveTraceId() ?? randomUUID()` خارج ALS    | mitigated by MF-2؛ یا require trace ALS       |
| **TRACE-LOST-01**       | Low / P1          | `request-logging.ts` `finish`                   | access log بدون traceId                          | Fix-next                                      |
| **TRACE-LOST-02**       | Info (Phase 7)    | `start-outbox-relay.ts` tick                    | relay بدون trace ALS                             | `runWithTraceContext` از `correlation_id` row |
| **TRACE-LOST-03**       | Medium / P1       | `atomic-canonical-tour-persist.ts` L91–98       | outbox بدون HTTP correlation                     | Fix-next                                      |
| **TRACE-CONTEXT-SPLIT** | Medium            | `tours.routes.ts` catch                         | error بعد از inner ALS teardown                  | MF-2                                          |
| **TRACE-SCHED-01**      | Pass              | `validation-scheduler.ts`                       | awaited `setImmediate` — ALS OK                  | نگه دارید؛ `trace-isolation.spec.ts`          |
| **TRACE-IDEM-01**       | Pass              | `http-idempotency.ts` poll                      | trace در closure HTTP                            | —                                             |
| **TRACE-TENANT-NEST**   | Pass              | `canonical-tour.service.ts`                     | nested tenant ALS جدا از trace                   | —                                             |

### Metrics — MET-\*

| ID                | Sev         | File / area              | Problem                                             | Suggested fix                              |
| ----------------- | ----------- | ------------------------ | --------------------------------------------------- | ------------------------------------------ |
| **MET-OK-01**     | Pass        | all live counters        | همه `tenant_id` دارند                               | —                                          |
| **MET-API-01**    | Medium / P1 | `metrics.ts`             | labels اختیاری — ریسک unlabeled                     | Fix-next CI lint                           |
| **MET-EXPORT-01** | Medium (P7) | `snapshot()`             | naive sum بدون label → mis-billing                  | exporter: `sum by (tenant_id)`             |
| **MET-VALID-01**  | Low         | `recordTourCreated`      | empty `tenantId` → `tenant_id=` bucket              | `requireActiveTenantId()` قبل از increment |
| **MET-COV-01**    | Low         | `tenant-metrics.spec.ts` | `projection_inconsistency_total` بدون OBS-MET guard | extend spec                                |
| **MET-SCOPE-01**  | Info        | `updateTour`             | update meter نمی‌شود                                | product decision — under-report            |
| **MET-SCOPE-02**  | Info        | failed TX                | increment نمی‌شود                                   | correct behavior                           |

### HTTP errors — ERR-\*

| ID                | Sev      | File / area                                                  | Problem                                        | Suggested fix               |
| ----------------- | -------- | ------------------------------------------------------------ | ---------------------------------------------- | --------------------------- |
| **ERR-PASS-01**   | Pass     | `/tours` 500                                                 | opaque `internal_error`                        | —                           |
| **ERR-PASS-02**   | Pass     | pool saturation                                              | client: `service_unavailable` only             | —                           |
| **ERR-PASS-03**   | Pass     | plugin not found                                             | 500 opaque                                     | —                           |
| **ERR-PASS-04**   | Pass     | canonical sync                                               | stable code                                    | —                           |
| **ERR-400-01**    | Info     | ValidationFailure 400                                        | rule text در body — intentional                | lint path-like در rule copy |
| **ERR-400-02**    | Info     | Zod 400                                                      | field paths                                    | —                           |
| **ERR-400-03**    | Info     | schema version                                               | version echo                                   | —                           |
| **ERR-BYPASS-01** | Low / P1 | `/internal/tenants/provision`, `/internal/test/db-pool-hold` | بدون `correlationId`؛ bypass `handleHttpError` | route through shared mapper |
| **ERR-BYPASS-02** | Low      | `app.ts` 404                                                 | empty body                                     | optional JSON envelope      |
| **ERR-429-01**    | Low      | `sendTenantRateLimitExceeded`                                | `sendJson` not `sendHttpError`                 | align envelope if needed    |
| **ERR-LOG-01**    | Info     | `logInternalServerError`                                     | message+stack در log فقط                       | acceptable ops              |
| **ERR-GAP-01**    | Low      | default 4xx branch                                           | echo `Error.message` اگر mapping اشتباه شود    | CI guard on `sendJson` 5xx  |

### Log backpressure — LOG-BP-\*

| ID            | Sev              | File / area                        | Problem                         | Suggested fix                            |
| ------------- | ---------------- | ---------------------------------- | ------------------------------- | ---------------------------------------- |
| **LOG-BP-01** | Pass (fast sink) | burst 1000 `/health`               | no measurable BP                | —                                        |
| **LOG-BP-02** | Info             | same burst                         | tail = HTTP queueing            | —                                        |
| **LOG-BP-03** | Medium (future)  | `request-logging.ts` sync `finish` | full Sonic-Boom → stall sockets | `setImmediate` defer؛ Phase 3 FOF-LOG-02 |
| **LOG-BP-04** | Medium (future)  | `error-interceptor.ts` 500 storm   | larger records than access      | sample/truncate errors                   |
| **LOG-BP-05** | Low              | `logger.ts`                        | implicit Pino defaults          | explicit `pino.destination`              |
| **LOG-BP-06** | Info             | access logs                        | no traceId yet                  | cheap add — TRACE-LOST-01                |

**Phase 3 cross-ref (slow sink):**

| ID             | Sev                 | Maps to   | Problem                                |
| -------------- | ------------------- | --------- | -------------------------------------- |
| **FOF-LOG-01** | Fatal (adversarial) | LOG-BP-05 | unbounded buffer؛ no drop/drain policy |
| **FOF-LOG-02** | Fatal (adversarial) | LOG-BP-03 | HTTP coupled to sync logging on loop   |
| **FOF-LOG-03** | Fatal (adversarial) | shutdown  | no `logger.flush()` on SIGTERM         |

### Audit events — AUDIT-\*

| ID               | Sev         | File / mutation         | Problem                          | Suggested fix                        |
| ---------------- | ----------- | ----------------------- | -------------------------------- | ------------------------------------ |
| **AUDIT-OK-01**  | Pass        | Prisma create TX        | `TOUR_CREATED` + tenant + entity | —                                    |
| **AUDIT-OK-02**  | Pass        | DB trigger              | append-only                      | —                                    |
| **AUDIT-OK-03**  | Pass        | RLS                     | tenant isolation on reads        | —                                    |
| **AUDIT-GAP-01** | **P0 prod** | memory driver           | zero audit rows                  | MF-3                                 |
| **AUDIT-GAP-02** | P1          | `PATCH /tours`          | no `TOUR_UPDATED`                | Fix-next                             |
| **AUDIT-GAP-03** | P2          | provision / seed        | no tenant provision audit        | `TENANT_PROVISIONED` event           |
| **AUDIT-GAP-04** | P3          | outbox relay            | status transitions unlogged      | Phase 7 ops audit                    |
| **AUDIT-GAP-05** | Low         | `actor_id` nullable     | background null actor            | `requireActiveActorId()` or document |
| **AUDIT-GAP-06** | Low         | indexes                 | no `actor_id` index              | `(tenant_id, actor_id, created_at)`  |
| **AUDIT-GAP-07** | Info        | no DB trigger on domain | app-only coverage                | document bypass paths                |

### Middleware ALS — CTX-MW-\*

| ID                 | Sev  | File                     | Problem                          | Suggested fix                         |
| ------------------ | ---- | ------------------------ | -------------------------------- | ------------------------------------- |
| **CTX-MW-OK-01**   | Pass | `middleware/*`           | no ALS fork                      | —                                     |
| **CTX-MW-OK-02**   | Pass | `tenant-rate-limiter.ts` | fail-closed without ALS          | —                                     |
| **CTX-MW-INFO-01** | Info | architecture             | helpers not stack middleware     | bind policy in `bind-request-context` |
| **CTX-MW-INFO-02** | Info | `error-interceptor`      | consumes ALS, does not establish | by design                             |
| **CTX-MW-LOW-01**  | Low  | `tours.routes` catch     | correlation after inner teardown | MF-2                                  |

### Console bypass — STD-\*

| ID                | Sev  | File / area               | Problem                       | Suggested fix                  |
| ----------------- | ---- | ------------------------- | ----------------------------- | ------------------------------ |
| **STD-BYPASS-01** | P1   | repo-wide claim           | «no console» false (45 sites) | CI grep `src/` only — Fix-next |
| **STD-BYPASS-02** | P1   | `graceful-shutdown.ts:69` | single prod bypass            | MF-1                           |
| **STD-BYPASS-03** | Info | `test/`, `scripts/`       | `*_EMIT=1` harness OK         | document policy                |
| **STD-BYPASS-04** | Info | `db-seed.ts`, guards      | CLI console                   | keep out of `src/`             |
| **STD-OK-01**     | Pass | tour/health handlers      | no `console` in hot path      | —                              |

### ALS verification — ALS-FOOTGUN-\*

| ID                 | Sev         | File / scenario                | Problem                                  | Suggested fix                          |
| ------------------ | ----------- | ------------------------------ | ---------------------------------------- | -------------------------------------- |
| **ALS-FOOTGUN-01** | Medium / P1 | fire-and-forget `setImmediate` | stale tenant/trace after `run()` settled | ban unawaited scheduling from handlers |
| **ALS-FOOTGUN-02** | Info        | impact description             | wrong RLS/audit tenant                   | policy + code review                   |
| **ALS-FOOTGUN-03** | Pass        | `validation-scheduler.ts`      | only awaited `setImmediate` in `src/`    | document header in file                |

**HTTP ALS cleanup (script):** `verify-als-request-cleanup.ts` — **PASS** 2026-06-05 (post-request zero residual).

---

## پیشنهادات (hardening و CI)

### LOG-BP / observability hardening

| Pri    | Action                                                                     | IDs / rationale                               |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------- |
| **P1** | `logger.ts`: `pino.destination({ dest: 1, sync: false, minLength: 4096 })` | LOG-BP-05، FOF-LOG-01 mitigation              |
| **P1** | `graceful-shutdown.ts`: `logger.flush()` after outbox drain                | LOG-BP-HARDEN-02، FOF-LOG-03                  |
| **P2** | `res.on("finish", () => setImmediate(() => logHttpRequest(...)))`          | LOG-BP-03، FOF-LOG-02، SCAL-DEBT-07 (Phase 3) |
| **P2** | Sample/truncate `logInternalServerError` under 500 storm                   | LOG-BP-04                                     |
| **P3** | `LOG_LEVEL=warn` یا sample `/health` تحت load                              | LOG-BP-DEFER-02                               |
| **P4** | Phase 7: `pino.transport` + `drain` handling                               | LOG-BP-DEFER-03                               |
| **P4** | Monitor Sonic-Boom `drop` / `writeBufferLen` in K8s                        | ops signal                                    |

### CI / lint guards

| Pri    | Guard                                                                     | IDs                        |
| ------ | ------------------------------------------------------------------------- | -------------------------- |
| **P1** | Forbid `console.` under `apps/api/src/`                                   | STD-BYPASS-01              |
| **P1** | `metricsRegistry.increment` tenant paths require `tenant_id`              | MET-API-01                 |
| **P2** | Forbid `sendJson(res, 5xx, { error: error.message })` outside interceptor | ERR-GAP-01                 |
| **P3** | Nightly: `verify-als-request-cleanup.ts` (`STORAGE_DRIVER=memory`)        | ALS regression             |
| **P3** | Re-run `log-backpressure-burst.ts` with **slow stdout** consumer          | stress LOG-BP-03 / FOF-LOG |

### Phase 7 deferred

| ID                | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| **TRACE-LOST-02** | Outbox relay: `runWithTraceContext` per row from `correlation_id` |
| **MET-EXPORT-01** | Prometheus exporter: never unlabeled global `tour_creation_count` |
| **AUDIT-GAP-04**  | Audit outbox `processing`/`done`/`failed` if compliance requires  |
| **ERR-400-01**    | Lint rule-engine violation strings for path-like substrings       |
| **CTX-MW-P3-01**  | Optional `runWithHttpRequestContext` on internal routes with auth |

### Policy recommendations (console)

| Environment              | Allow `console`?                                   |
| ------------------------ | -------------------------------------------------- |
| `src/` production server | **No** — pino only                                 |
| `scripts/`, `test/`      | Optional؛ prefer `*_EMIT` JSON + stderr            |
| Subprocess workers       | `process.stdout.write` OK for `*_READY` handshakes |

---

## Appendix A — Pass / OK / Green (no fix required now)

| ID                                                   | Type     | Summary                                                                         |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| **OBS-LOG-01**                                       | Contract | Pino: tenant/userId structured only, not in `msg` — `log-privacy.spec.ts`       |
| **OBS-MET-01**                                       | Test     | Unlabeled `tour_creation_count` = 0 — `tenant-metrics.spec.ts`                  |
| **OBS-ERR-01…05**                                    | Tests    | Correlation echo, no engine leak, no stack in JSON — `error-enrichment.spec.ts` |
| **ERR-PASS-01…04**                                   | Pass     | Opaque 500/503, pool opaque, plugin opaque, canonical stable                    |
| **ERR-400-02, ERR-400-03**                           | Info OK  | Zod paths, schema version — intentional                                         |
| **ERR-LOG-01**                                       | Info OK  | 500 logs server-side only                                                       |
| **MET-OK-01**                                        | Pass     | All live counters labeled `tenant_id`                                           |
| **MET-SCOPE-01, MET-SCOPE-02**                       | Info     | Billing scope documented                                                        |
| **LOG-BP-01, LOG-BP-02**                             | Pass     | Fast-sink burst green                                                           |
| **LOG-BP-06**                                        | Info     | traceId omission — cheap fix pending                                            |
| **AUDIT-OK-01…03**                                   | Pass     | Create audit, append-only, RLS reads                                            |
| **TRACE-SCHED-01, TRACE-IDEM-01, TRACE-TENANT-NEST** | Pass     | Async trace propagation verified                                                |
| **CTX-MW-OK-01, CTX-MW-OK-02**                       | Pass     | No middleware ALS fork; rate limit fail-closed                                  |
| **CTX-MW-INFO-01, CTX-MW-INFO-02**                   | Info     | Architecture notes                                                              |
| **STD-OK-01**                                        | Pass     | HTTP handlers no console                                                        |
| **ALS-FOOTGUN-03**                                   | Pass     | Scheduler awaited only                                                          |
| **ALS HTTP cleanup**                                 | Pass     | `verify-als-request-cleanup.ts` 2026-06-05                                      |
| **Production pino**                                  | Pass     | 7 compliant call sites in `src/`                                                |
| **Object spread logging**                            | Pass     | No unstructured spread leak                                                     |
| **Phase 2 area greens**                              | Status   | Metrics, HTTP errors, ALS, log BP (fast), automated evidence                    |

### Red Team area summary (verbatim status)

| Area                   | Status                                |
| ---------------------- | ------------------------------------- |
| Structured logging     | **Amber** (LOG-V-01)                  |
| Trace / correlation    | **Amber** (TRACE-REGEN-01)            |
| Metrics / usage        | **Green**                             |
| HTTP error surface     | **Green**                             |
| Audit (`audit_events`) | **Amber**                             |
| ALS / tenant isolation | **Green**                             |
| Log backpressure       | **Green** (fast sink — see CON-P2-04) |
| Automated evidence     | **Green**                             |

---

## Appendix B — Verification regression pack

```bash
cd apps/api
NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/verify-als-request-cleanup.ts
NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/log-backpressure-burst.ts
NODE_ENV=test node --import tsx --test \
  test/2-observability/log-privacy.spec.ts \
  test/2-observability/trace-isolation.spec.ts \
  test/2-observability/tenant-metrics.spec.ts \
  test/0-security/context-resilience.spec.ts
```

Optional strict ALS footgun: `ALS_VERIFY_STRICT=1` on verify script (default WARN only).

Slow-sink stress (Phase 3 alignment): re-run `log-backpressure-burst.ts` with stdout piped to slow consumer (`pv -L`, saturated docker log driver).

---

## Appendix C — Completeness checklist vs audit doc

| Audit section (phase2-paranoid-audit.md)                                                            | Extracted in this list                         |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Red Team closure (Trust 78, pillars, area summary, Must-Fix 1–3, Fix-next 5, verification commands) | Yes — § خلاصه، Must-Fix، Fix-next، Appendix B  |
| § Logger privacy (LOG-V-01…07, H-01…03, inventory, spread review, compliant pino sites)             | Yes — § باگ‌ها LOG-V/H                         |
| § Trace lifecycle (TRACE-\*, mermaid flow, GUC, remediation)                                        | Yes — § باگ‌ها TRACE + MF-2                    |
| § Metrics (MET-\*, billing scenarios, OBS-MET-01)                                                   | Yes — § باگ‌ها MET + Fix-next MET-API-01       |
| § Global HTTP errors (ERR-\*, bypass matrix, mermaid flow)                                          | Yes — § باگ‌ها ERR                             |
| § Log backpressure empirical (LOG-BP-\*, async-buffer suggestions, reproduce)                       | Yes — § LOG-BP + پیشنهادات + FOF-LOG cross-ref |
| § Audit events (schema, mutation inventory, AUDIT-GAP-\*, identity mapping)                         | Yes — § باگ‌ها AUDIT + MF-3                    |
| § Middleware ALS (CTX-MW-\*, per-file review, propagation matrix)                                   | Yes — § باگ‌ها CTX-MW                          |
| § Console bypass (STD-\*, 45-site inventory, policy table)                                          | Yes — § STD + CON-P2-09                        |
| § ALS verification script (ALS-FOOTGUN-\*, diagram, related tests)                                  | Yes — § ALS-FOOTGUN + Appendix pass            |

**Not duplicated here (remain in source doc):** full mermaid sequence/flow diagrams; complete 45-site `console.*` line matrix; per-line compliant pino inventory table (audit lines 147–154).

---

## Document metadata

| Item                  | Value                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source document**   | `apps/api/docs/phase2-paranoid-audit.md`                                                                                                     |
| **Source line count** | **971** lines (wc -l 2026-06-05)                                                                                                             |
| **Generated**         | 2026-06-05                                                                                                                                   |
| **Output path**       | `TEMP/phase2-paranoid-audit-fix-list.md`                                                                                                     |
| **Style reference**   | `TEMP/phase1-aggressive-audit-fix-list.md`                                                                                                   |
| **Cross-doc**         | `apps/api/docs/phase3-scalability-stress-audit.md` (FOF-LOG-01…03); `TEMP/phase1-aggressive-audit-fix-list.md` (LOG-COL, DM-CT-01, trust 84) |
| **Code changes**      | None (docs-only consolidation)                                                                                                               |

---

Architect, documentation status: Not Needed. Link to docs: `TEMP/phase2-paranoid-audit-fix-list.md` (consolidated from `apps/api/docs/phase2-paranoid-audit.md`).
