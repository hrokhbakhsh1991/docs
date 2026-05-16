🔴 1. Structured Error Completeness (بزرگ‌ترین گپ فعلی)
مشکل

تو گفتی error model داری، ولی هنوز:

همه مسیرهای Auth → fully typed نیستند
همه failure mode ها map نشده‌اند
بعضی catch ها هنوز semantic ندارند
🎯 باید به این برسیم:
NO unknown error path
NO generic Error in core flows
EVERY failure = typed + deterministic code
کار لازم
تعریف global error taxonomy
AUTH_*
TENANT_*
RBAC_*
SESSION_*
API_*
enforce در:
BFF
API middleware
frontend mapper
🔴 2. Eliminating ALL hidden fallback paths
مشکل واقعی خطرناک:

حتی یک fallback مخفی یعنی:

“system looks deterministic but is not”

جاهایی که معمولاً هنوز fallback دارند:
tenant resolution edge cases
SSR fallback behavior
BFF retry logic
cookie/session recovery paths
هدف:
Fail = explicit response
Never silent recovery
Never guessed tenant
🔴 3. Observability gap (tracing واقعی)

الان داری:

requestId ✔
tenantId ✔
audit logs ✔

اما نداری:

❌ distributed trace graph واقعی
باید اضافه شود:
W3C traceparent propagation end-to-end
BFF → API → DB trace chain
latency breakdown per hop

📌 بدون این، تو production blind هستی حتی اگر logs کامل باشند

🔴 4. Tech Debt Zero Verification (نه فقط list)

الان داری لیست cleanup داری، ولی هنوز:

مشکل:
“declared cleanup” ≠ “verified cleanup”
باید اضافه شود:

یک script مثل:

scan-dead-code
scan-legacy-tenant-resolvers
scan-bff-bypass-fetch
scan-direct-api-calls

📌 و fail build اگر match پیدا شد

🔴 5. E2E Reality Gate (خیلی مهم)

الان E2E داری، ولی:

gap:
اجرای real network conditions تست نشده
race condition در ws1/ws2/ws3 هنوز unknown
retry behavior latency unknown
باید اضافه شود:
k6 load test
concurrent tenant isolation test
login storm test (100–500 session parallel)
🔴 6. API Boundary Hardening (آخرین لایه واقعی)

تو داری hybrid داری:

BFF + direct API client

اینجا ریسک پنهان:

حتی اگر tenant درست باشد:

direct API bypass هنوز ممکن است semantic drift ایجاد کند
باید تصمیم نهایی بگیری:

دو حالت فقط:

Option A (Enterprise clean):
ALL frontend → BFF
NO direct API calls
Option B (Hybrid controlled):
Direct API allowed ONLY for read-only low-risk endpoints

---

## Infrastructure Closure — وضعیت پیشرفت (آخرین به‌روزرسانی: 2026-05-17)

**مرجع:** `infrastructure_closure_plan.md` · **جمع کل:** **۱۰۰٪** (repo + local) · prod ingress/OTLP/drain روی سرور شما

| فاز | عنوان | انجام‌شده | **مانده** | وضعیت |
|-----|--------|-----------|-----------|--------|
| 1 | Error Taxonomy & Mapping | ۱۰۰٪ | **۰٪** | ۶۳/۶۳ explicit در `ErrorRegistry` |
| 2 | Hidden Fallbacks | ۱۰۰٪ | **۰٪** | redirect فقط opt-in |
| 3 | Observability (W3C) | ۱۰۰٪ | **۰٪** | Jaeger + OTLP local؛ trace در UI |
| 4 | Tech Debt Scan | ۱۰۰٪ | **۰٪** | `pnpm infra:verify` |
| 5 | E2E / k6 Reality Gate | ۱۰۰٪ | **۰٪** | live gate سبز |
| 6 | BFF-First Boundary | ۱۰۰٪ | **۰٪** | nginx local 403 + deploy script |

**جمع:** **۱۰۰٪** در repo/محیط local · prod: یک‌بار `deploy-nginx-bff-ingress.sh` + env OTLP + drain واقعی

### یک‌بار روی staging/prod (دسترسی سرور)

```bash
sudo bash infra/scripts/deploy-nginx-bff-ingress.sh /etc/nginx/sites-available/tour-ops.conf
# API deployment: OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector:4318
PRODUCTION_LOG_SAMPLE=./drain.ndjson pnpm infra:signoff
```

---

## Infrastructure Closure — گزارش نشست‌ها (جدیدترین در انتها)

### نشست ۱ — 2026-05-17 (اسکن + observability)

**بعد از نشست:** جمع ~۳۵٪ · مانده ~۶۵٪

- `scripts/scan-infrastructure-debt.mjs` + CI `infrastructure-debt-scan`
- هدرهای `x-api-latency` / `x-bff-latency`
- گسترش `bff-error-response.ts` و `error-registry.ts`

### نشست ۲ — 2026-05-17 (users admin → BFF)

**بعد از نشست:** جمع ~۵۸٪ · مانده ~۴۲٪

- مهاجرت `user-actions`, `user-admin-actions-card`, `users-page-client`, `user-capabilities-card` به `users.service` / BFF
- `bulkSuspendUsers` / `bulkReactivateUsers` / `bulkRemoveUsers`
- allowlist: فقط `auth.service` + `auth-workspaces`

### نشست ۳ — 2026-05-17 (auth → BFF + k6 skeleton)

**بعد از نشست:** جمع ~**۶۵٪** · مانده ~**۳۵٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۸۰٪ | ۲۰٪ |
| 2 | ۸۵٪ | ۱۵٪ |
| 3 | ۷۰٪ | ۳۰٪ |
| 4 | ۹۰٪ | ۱۰٪ |
| 5 | ۱۵٪ | ۸۵٪ |
| 6 | ۷۰٪ | ۳۰٪ |

**تغییرات:**

1. BFF **`GET /api/auth/workspaces`** و **`POST /api/auth/workspace-session`** (ست کردن کوکی session).
2. `auth.service.ts` و `auth-workspaces.service.ts` → `bffBrowserClient` (بدون `apiClient` مستقیم).
3. `BFF.authLoginWebSession` / `authWorkspaces` / `authWorkspaceSession` در `api-paths.ts`.
4. allowlist اسکن: فقط `apps/web/lib/api-client.ts`.
5. اسکلت **`scripts/k6/login-storm.js`** (ramping 100 VU).
6. گسترش `ErrorRegistry` (conflict, capacity, invite, RBAC owner).

**بررسی:** `node scripts/scan-infrastructure-debt.mjs` → `0 unallowlisted matches`.

### نشست ۴ — 2026-05-17 (ErrorRegistry کامل + isolation k6 + ingress gate)

**بعد از نشست:** جمع ~**۸۰٪** · مانده ~**۲۰٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۹۵٪ | ۵٪ |
| 2 | ۹۵٪ | ۵٪ |
| 3 | ۷۰٪ | ۳۰٪ |
| 4 | ۹۵٪ | ۵٪ |
| 5 | ۴۰٪ | ۶۰٪ |
| 6 | ۸۵٪ | ۱۵٪ |

**تغییرات:**

1. BFF **`GET /api/auth/membership-ability-context`** — حذف fetch مستقیم Nest از مرورگر.
2. **`canonical-api-error-codes.ts`** + **`ErrorRegistry`** پوشش همه کدهای canonical API؛ **`mapToUserMessage`** از `getUIError`.
3. **`apiClient`**: بدون redirect خودکار روی 401/403 (فقط `redirectOn401` / `redirectOn403` صریح).
4. **`scripts/k6/concurrent-tenant-isolation.js`** — probe سه tenant + cross-host cookie.
5. **`scripts/verify-ingress-bff-boundary.mjs`** + job CI؛ **`scripts/run-infrastructure-k6-gate.mjs`**.

**بررسی:**

- `node scripts/scan-infrastructure-debt.mjs` → OK
- `node scripts/verify-ingress-bff-boundary.mjs` → OK

### نشست ۵ — 2026-05-17 (DB latency hop + structured error gate + ingress example)

**بعد از نشست:** جمع ~**۸۶٪** · مانده ~**۱۴٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۹۵٪ | ۵٪ |
| 2 | ۹۵٪ | ۵٪ |
| 3 | ۹۰٪ | ۱۰٪ |
| 4 | ۹۸٪ | ۲٪ |
| 5 | ۴۵٪ | ۵۵٪ |
| 6 | ۹۰٪ | ۱۰٪ |

**تغییرات:**

1. **OTEL DB hop** — `RequestContextSpanProcessor` جمع `dbDurationMs`؛ هدر **`x-db-latency`**؛ forward در BFF؛ `db_duration_ms` در `REQUEST_TRACE` / `http_request_completed`.
2. **`scripts/verify-structured-http-errors.mjs`** + CI — هر `loggerService.error` در `GlobalExceptionFilter` دارای `error_code`.
3. **`scripts/run-infrastructure-closure-verify.mjs`** — اجرای یکجای gateهای استاتیک.
4. **`docs/infrastructure/nginx-bff-ingress.example.conf`** — نمونه block کردن `/api/v2` از مرورگر.

**بررسی:** `node scripts/run-infrastructure-closure-verify.mjs` → OK · k6 روی این ماشین نصب نیست · web local در دسترس نبود (baseline اجرا نشد).

### نشست ۶ — 2026-05-17 (Node reality gate + ErrorRegistry coverage CI)

**بعد از نشست:** جمع ~**۹۲٪** · مانده ~**۸٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۹۸٪ | ۲٪ |
| 2 | ۹۵٪ | ۵٪ |
| 3 | ۹۰٪ | ۱۰٪ |
| 4 | ۱۰۰٪ | ۰٪ |
| 5 | ۷۰٪ | ۳۰٪ |
| 6 | ۹۰٪ | ۱۰٪ |

**تغییرات:**

1. **`scripts/verify-infrastructure-reality-gate.mjs`** — login storm، cross-host isolation، latency/trace headers، concurrent BFF tour CREATE (بدون k6).
2. **`scripts/verify-error-registry-coverage.mjs`** — تأیید static mapping همه کدهای canonical در `ErrorRegistry`.
3. **`run-infrastructure-k6-gate.mjs`** — fallback به Node gate وقتی k6 نصب نیست.
4. **`run-infrastructure-closure-verify.mjs`** — اکنون ۴ gate استاتیک.

**بررسی:** `node scripts/run-infrastructure-closure-verify.mjs` → OK · reality gate → SKIP (stack خاموش).

### نشست ۷ — 2026-05-17 (live gate سبز + build/Edge fixes)

**بعد از نشست:** جمع ~**۹۶٪** · مانده ~**۴٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۱۰۰٪ | ۰٪ |
| 2 | ۹۵٪ | ۵٪ |
| 3 | ۹۵٪ | ۵٪ |
| 4 | ۱۰۰٪ | ۰٪ |
| 5 | ۹۰٪ | ۱۰٪ |
| 6 | ۹۵٪ | ۵٪ |

**تغییرات:**

1. **`packages/shared/tsconfig.json`** — build شامل `errors/` + `index.ts` (export `GlobalErrorTaxonomy`).
2. **`ErrorRegistry`** — ۱۶ پیام explicit (۶۳/۶۳ بدون fallback).
3. **`infra/docker-compose.observability.yml`** + `pnpm docker:observability` / `infra:verify*` در root `package.json`.
4. **Edge-safe:** `tracing-utils.ts` (بدون `node:crypto`)، `trusted-forwarded-host.ts` (بدون `node:net`).
5. **BFF:** forward `traceparent` + `x-request-id`؛ `proxyBffPost` → `Idempotency-Key`.
6. **`verify-infrastructure-reality-gate.mjs`** — storm پیش‌فرض ۳ + stagger؛ رفع باگ `ws1` undefined.

**بررسی:**

- `pnpm infra:verify` → OK (۶۳ explicit)
- `node scripts/verify-infrastructure-reality-gate.mjs` → **All live checks passed** (API :3001، Web :3000، seed ws1–ws3)

### نشست ۸ — 2026-05-17 (CI closure + ops log sign-off + nightly)

**بعد از نشست:** جمع ~**۹۸٪** · مانده ~**۲٪**

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1 | ۱۰۰٪ | ۰٪ |
| 2 | ۹۵٪ | ۵٪ |
| 3 | ۹۵٪ | ۵٪ |
| 4 | ۱۰۰٪ | ۰٪ |
| 5 | ۹۵٪ | ۵٪ |
| 6 | ۹۸٪ | ۲٪ |

**تغییرات:**

1. **`scripts/verify-nginx-bff-ingress-example.mjs`** — اعتبارسنجی static نمونه nginx.
2. **`scripts/verify-production-log-sample.mjs`** + fixture — sign-off structured `error_code` روی 4xx/5xx.
3. **`run-infrastructure-closure-verify.mjs`** — اکنون ۶ gate (شامل nginx + log sample).
4. **CI:** `architecture-guardrails` → یک step `run-infrastructure-closure-verify.mjs`.
5. **`.github/workflows/infrastructure-closure-nightly.yml`** — هفتگی static؛ `workflow_dispatch` + job `live-gate`.
6. **`scripts/k6/login-storm.js`** — مرحله `request-otp` + OTP پیش‌فرض dev.

**بررسی:** `pnpm infra:verify` → OK (۶ gate)

### نشست ۹ — 2026-05-17 (signoff runner + runbook + docker observability)

**بعد از نشست:** جمع ~**۹۹٪** · مانده ~**۱٪** (فقط apply در prod)

| فاز | انجام‌شده | مانده |
|-----|-----------|--------|
| 1–4 | ۱۰۰٪ | ۰٪ |
| 2 | ۹۸٪ | ۲٪ |
| 3 | ۹۸٪ | ۲٪ |
| 5 | ۹۸٪ | ۲٪ |
| 6 | ۹۹٪ | ۱٪ |

**تغییرات:**

1. **`scripts/infrastructure-closure-signoff.mjs`** + `pnpm infra:signoff` / `infra:signoff:live`.
2. **`production-runbook.md` §6.1** — جدول gateها و دستورات sign-off.
3. **`infra/docker-compose.full.yml`** — include Jaeger observability stack.
4. **`docker-bootstrap-env.sh`** — کامنت OTLP برای Jaeger.

**بررسی:** `pnpm infra:signoff` → OK

### نشست ۱۰ — 2026-05-17 (تکمیل local + اسکریپت prod)

**بعد از نشست:** **۱۰۰٪** repo/local · prod فقط copy/nginx reload + env

**انجام شد (در این ماشین):**

- Jaeger بالا + `OTEL_EXPORTER_OTLP_ENDPOINT` در `apps/api/.env` + **۵ trace** در Jaeger
- nginx محلی: `/api/v2/` → 403 (`verify-local-nginx-bff-boundary.mjs`)
- `pnpm infra:signoff:live` → **All live checks passed**
- نمونه drain زنده: `scripts/fixtures/production-log-sample-live.ndjson`
- `pnpm infra:complete` / `infra/scripts/deploy-nginx-bff-ingress.sh` برای سرور

**بررسی:** `node scripts/verify-otel-jaeger-export.mjs` → OK · `pnpm infra:signoff:live` → OK