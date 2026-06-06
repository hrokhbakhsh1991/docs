# Phase 6 — چک‌لیست تکمیل (Operational · closure → ~100% behavioral)

```yaml
created: "2026-06-06"
updated: "2026-06-06"
source:
  - docs/phase-6/audits/CLOSURE-CHECKLIST.md
  - docs/phase-6/audits/IMPLEMENTATION-TRUTH.md
  - docs/phase-6/appendices/blockers.md
  - TEMP/phase6-entry-checklist.md
truth_ledgers:
  - docs/phase-6/audits/IMPLEMENTATION-TRUTH.md
  - reports/phase-6-forensic-audit-2026-06-06.md
  - reports/phase-6-entry-verified.yaml
current_verdict: BEHAVIORAL_100_LOCAL — smoke 4/4 · minio 4/4 · fast-closure re-run pending commit
target_verdict: VERIFIED_BEHAVIORAL_100 — commit Tier 1 + Tier 2 docs
closure_git_sha: c3e7d70
uncommitted_wip: "~72 files (MinIO + smoke + platform-core UUID fix)"
forbidden_shortcut: "phase-6:gate کامل در لوکال مگر صریحاً درخواست شود — زنجیره ساعتی"
recommended_path: "fast-track + hardening incremental"
```

> **نحوه استفاده:** Tier 0 → Tier 1 → Tier 2 → Tier 3 (اختیاری) → Tier 4 (CI/nightly).  
> هر ردیف را فقط وقتی `[x]` بزنید که **prove_with** exit 0 داده و در صورت نیاز ledger/doc به‌روز شده باشد.  
> **تفاوت closure vs 100%:** closure رسمی با `phase-6:fast-closure` انجام شده؛ این فایل برای **برداشتن waiverها** و **commit WIP** است.

---

## «الان کجاییم؟»

| لایه                                        | وضعیت                        | blocker / waiver                 |
| ------------------------------------------- | ---------------------------- | -------------------------------- |
| Doc pack (`phase-6:guard`)                  | ✅ PASS (score 96)           | —                                |
| Fast-track closure (`phase-6:fast-closure`) | ✅ PASS                      | —                                |
| Subphase 6.1–6.9 ledger                     | ✅ VERIFIED_BEHAVIORAL (doc) | —                                |
| MinIO 6.7 local                             | ✅ 4/4 PASS                  | uncommitted                      |
| Playwright 6.6 (`SMK-P6-01`)                | ✅ 4/4 PASS (2026-06-06)     | commit نشده                      |
| Finance outbox 6.4                          | ⚠️ stub                      | `BLOCKER-P6-OUTBOX-5.4`          |
| Full `phase-6:gate`                         | ❌ deferred                  | CI nightly                       |
| Forensic purity                             | 9.5/10                       | بعد از smoke + truth update → 10 |

---

## Tier 0 — Bootstrap (قبل از هر prove)

| #   | کار               | وضعیت | دستور / معیار                                                            |
| --- | ----------------- | ----- | ------------------------------------------------------------------------ |
| 0.1 | Node 24           | `[ ]` | `nvm use && node -v` → `>=24 <25`                                        |
| 0.2 | Postgres + Redis  | `[ ]` | `docker compose -f docs/phase-4/dev/docker-compose.yml up -d`            |
| 0.3 | MinIO (برای 6.7)  | `[ ]` | `docker compose -f infra/docker-compose.yml up -d minio`                 |
| 0.4 | Bucket عکس        | `[ ]` | `pnpm run infra:minio:ensure-bucket`                                     |
| 0.5 | Env استاندارد     | `[ ]` | export زیر                                                               |
| 0.6 | پورت‌های dev خالی | `[ ]` | `fuser -k 3000/tcp 3001/tcp` قبل از smoke/gate (جلوگیری از `EADDRINUSE`) |

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export STORAGE_DRIVER=prisma NODE_ENV=test
export MINIO_ENDPOINT=http://127.0.0.1:9002
export MINIO_ACCESS_KEY=minioadmin MINIO_SECRET_KEY=minioadmin MINIO_BUCKET=app-tour-dev
```

**DoD Tier 0:** `curl -s http://127.0.0.1:3001/health` (بعد از API) · MinIO bucket موجود · پورت 3000/3001 آزاد.

---

## Tier 1 — P0: بستن waiverهای behavioral (ترتیب اجباری)

### 1A — Platform-core: UUID در `RuleContext` (ریشه SMK-P6-01)

| #    | کار          | وضعیت | جزئیات                                                                                          |
| ---- | ------------ | ----- | ----------------------------------------------------------------------------------------------- |
| 1A.1 | doc-first    | `[x]` | `docs/phase-1-platform-core.mdoc` — جدول `tenantId` format                                      |
| 1A.2 | کد           | `[x]` | `packages/platform-core/src/utils/rule-context-tenant.ts` — slug **یا** UUID                    |
| 1A.3 | تست          | `[x]` | `test/unit/utils/rule-context-tenant.spec.ts` — `DENALI_SMOKE_TENANT_ID`                        |
| 1A.4 | build + unit | `[ ]` | `pnpm --filter @app-tour/platform-core run build && pnpm --filter @app-tour/platform-core test` |

**DoD 1A:** `assertTenantId` برای `00000000-0000-4000-8000-000000000003` throw نکند.

---

### 1B — Web bootstrap: جداسازی `/plugin` از barrel (جلوگیری از minio در client bundle)

| #    | کار          | وضعیت | جزئیات                                                                                     |
| ---- | ------------ | ----- | ------------------------------------------------------------------------------------------ |
| 1B.1 | doc-first    | `[x]` | `docs/phase-6/subphases/6.5-bootstrap.md`                                                  |
| 1B.2 | export       | `[x]` | `packages/workspaces/denali/package.json` → `"./plugin"`                                   |
| 1B.3 | lazy import  | `[x]` | `apps/web/src/bootstrap/lazy-denali-plugin.ts` → `@app-tour/workspace-denali/plugin`       |
| 1B.4 | webpack      | `[x]` | `apps/web/next.config.ts` — ignore `minio` روی client؛ barrel فقط وقتی plugin غیرفعال      |
| 1B.5 | smoke env    | `[x]` | `smoke-denali-e2e-servers.mjs` — `ALLOW_DENALI_WEB_PLUGIN=true` + `TOUR_OPS_DEV_TENANT_ID` |
| 1B.6 | build denali | `[ ]` | `pnpm --filter @app-tour/workspace-denali run build`                                       |

**DoD 1B:** compile `/tours/new` بدون `Module not found: fs/promises` در trace مربوط به minio.

---

### 1C — Playwright smoke 6.6 (SMK-P6-01..06)

| #    | کار                         | وضعیت | دستور                                                            |
| ---- | --------------------------- | ----- | ---------------------------------------------------------------- |
| 1C.1 | seed tenant                 | `[ ]` | `node apps/web/scripts/seed-denali-smoke-tenant.mjs`             |
| 1C.2 | smoke کامل                  | `[ ]` | `cd apps/web && PW_NO_REUSE_SERVER=1 pnpm run test:smoke:denali` |
| 1C.3 | SMK-P6-01 wizard visible    | `[ ]` | `[data-workspace-wizard][data-plugin-id=denali]`                 |
| 1C.4 | SMK-P6-02 no console errors | `[ ]` | داخل همان spec                                                   |
| 1C.5 | SMK-P6-03..05               | `[x]` | tenant health · golden · POST validation — آخرین اجرا سبز        |

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export STORAGE_DRIVER=prisma NODE_ENV=test PW_NO_REUSE_SERVER=1
pnpm --filter @apps/web run test:smoke:denali
# هدف: 4 passed, 0 failed
```

**نکته:** در spec از `waitUntil: "domcontentloaded"` استفاده شود (dev cold-start؛ `load` گاهی 120s timeout).

**DoD 1C:** **4/4 PASS** · لاگ بدون خطای webpack minio.

---

### 1D — MinIO 6.7 (تأیید مجدد + doc)

| #    | کار                   | وضعیت | دستور                                                                  |
| ---- | --------------------- | ----- | ---------------------------------------------------------------------- |
| 1D.1 | infra compose         | `[x]` | `infra/docker-compose.yml` — سرویس minio پورت 9002                     |
| 1D.2 | scripts root          | `[x]` | `infra:minio:up` · `infra:minio:ensure-bucket` · `test:minio-photo`    |
| 1D.3 | spec بدون silent skip | `[x]` | `apps/api/test/minio-photo.spec.ts`                                    |
| 1D.4 | prove محلی            | `[ ]` | `pnpm run test:minio-photo` → **4/4, 0 skip**                          |
| 1D.5 | doc                   | `[x]` | `docs/phase-6/subphases/6.7-minio-photos.md` · `env-runtime-matrix.md` |

**DoD 1D:** `test:minio-photo` با `MINIO_*` سبز؛ بدون env → fail واضح (نه skip خاموش).

---

### 1E — Commit و doc sync (قبل از truth نهایی)

| #    | کار         | وضعیت | معیار                                                                                           |
| ---- | ----------- | ----- | ----------------------------------------------------------------------------------------------- |
| 1E.1 | stage مرتبط | `[ ]` | Tier 1A–1D + docs/phase-6 + docs/phase-1                                                        |
| 1E.2 | pre-commit  | `[ ]` | `pnpm run pre-commit:fast`                                                                      |
| 1E.3 | commit      | `[ ]` | پیام پیشنهادی: `fix(phase-6): smoke wizard UUID tenant + denali/plugin web entry + minio infra` |
| 1E.4 | guard docs  | `[ ]` | commit شامل `docs/` برای فایل‌های محافظت‌شده                                                    |

**DoD 1E:** `git status` تمیز برای scope فاز ۶؛ یا WIP جدا در commit دوم با برچسب واضح.

---

## Tier 2 — Ledger و forensic (بعد از Tier 1 سبز)

| #   | کار                  | وضعیت | فایل / دستور                                                                   |
| --- | -------------------- | ----- | ------------------------------------------------------------------------------ |
| 2.1 | IMPLEMENTATION-TRUTH | `[ ]` | `docs/phase-6/audits/IMPLEMENTATION-TRUTH.md` — 6.6 بدون blocker · 6.7 تأیید   |
| 2.2 | CLOSURE-CHECKLIST    | `[ ]` | `docs/phase-6/audits/CLOSURE-CHECKLIST.md` — Playwright PASS · waiverها به‌روز |
| 2.3 | blockers.md          | `[ ]` | `BLOCKER-P6-MINIO-ENV` → local PASS committed                                  |
| 2.4 | fast-closure دوباره  | `[ ]` | `pnpm run phase-6:fast-closure`                                                |
| 2.5 | forensic score       | `[ ]` | `reports/phase-6-forensic-audit-*.md` — هدف **10/10** یا honesty table         |

```bash
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
export STORAGE_DRIVER=prisma NODE_ENV=test
pnpm run phase-6:fast-closure
```

**DoD Tier 2:** `phase-6:fast-closure` exit 0 · truth بدون waiver برای 6.6/6.7.

---

## Tier 3 — P1: تکمیل محصول (اختیاری برای «۱۰۰٪ سخت‌گیرانه»)

### 3A — Finance outbox واقعی (`BLOCKER-P6-OUTBOX-5.4` · subphase 6.4)

| #    | کار            | وضعیت | مسیر                                                     |
| ---- | -------------- | ----- | -------------------------------------------------------- |
| 3A.1 | doc-first      | `[ ]` | `docs/phase-6/subphases/6.4-finance-slice.md`            |
| 3A.2 | consumer واقعی | `[ ]` | `packages/workspaces/denali/src/finance/` — جایگزین stub |
| 3A.3 | تست قرارداد    | `[ ]` | `finance-outbox-consumer.spec.ts` — behavioral با outbox |
| 3A.4 | API wiring     | `[ ]` | relay / handler در `apps/api` در صورت نیاز               |

**DoD 3A:** `BLOCKER-P6-OUTBOX-5.4` بسته · ledger 6.4 بدون «stub pending».

---

### 3B — WIP cleanup (~۷۲ فایل unrelated)

| #    | کار                   | وضعیت | معیار                           |
| ---- | --------------------- | ----- | ------------------------------- |
| 3B.1 | دسته‌بندی diff        | `[ ]` | phase-6 core vs phase-4/5 noise |
| 3B.2 | commit یا revert      | `[ ]` | هر دسته جدا · یا stash با برچسب |
| 3B.3 | `main` هم‌تراز origin | `[ ]` | `git push` بعد از review        |

**DoD 3B:** working tree فقط intentional changes یا خالی.

---

## Tier 4 — CI / nightly (عمداً خارج از لوکال)

| #   | کار                                 | وضعیت | توضیح                                                      |
| --- | ----------------------------------- | ----- | ---------------------------------------------------------- |
| 4.1 | MinIO در GitHub Actions             | `[ ]` | matrix service · `BLOCKER-P6-MINIO-ENV`                    |
| 4.2 | Playwright در CI                    | `[ ]` | `.github/workflows/` — smoke denali                        |
| 4.3 | `phase-6:gate` کامل                 | `[ ]` | build + test ×4 زنجیره — nightly فقط                       |
| 4.4 | `phase-5:gate` / `phase-3:api-gate` | `[ ]` | قبل از gate: پورت آزاد؛ آخرین `p3-api-gate` → `EADDRINUSE` |

**DoD Tier 4:** workflow سبز روی `main` · بدون وابستگی به لوکال دستی.

---

## خلاصه ترتیب اجرا (یک نگاه)

```text
Tier 0  bootstrap (DB · MinIO · env · پورت آزاد)
   ↓
Tier 1A platform-core UUID
   ↓
Tier 1B denali /plugin web entry
   ↓
Tier 1C smoke 4/4
   ↓
Tier 1D minio-photo تأیید
   ↓
Tier 1E commit + pre-commit
   ↓
Tier 2  truth · closure checklist · fast-closure · forensic
   ↓
Tier 3  (اختیاری) outbox 5.4 · WIP cleanup
   ↓
Tier 4  CI nightly · full phase-6:gate
```

---

## معیار «فاز ۶ تمام شد» (تعریف عملیاتی)

| سطح                       | معیار                                         | وضعیت فعلی  |
| ------------------------- | --------------------------------------------- | ----------- |
| **A — Closure رسمی**      | `phase-6:fast-closure` + `phase_closed: true` | ✅          |
| **B — Behavioral محلی**   | smoke 4/4 · minio 4/4 · WIP committed         | ❌          |
| **C — Zero waiver doc**   | truth/forensic بدون 6.6/6.7 waiver            | ❌          |
| **D — Production parity** | outbox 5.4 · CI matrix · full gate            | ❌ deferred |

**حداقل برای اعلام «تمام» به تیم:** سطح **B + C** (Tier 1 + Tier 2).  
**سطح D** برای enterprise hardening بعد از merge است.

---

## مراجع سریع

| سند            | مسیر                                            |
| -------------- | ----------------------------------------------- |
| Smoke map      | `docs/phase-6/appendices/SMOKE-SCENARIO-MAP.md` |
| Env matrix     | `docs/phase-6/appendices/env-runtime-matrix.md` |
| Entry (تاریخی) | `TEMP/phase6-entry-checklist.md`                |
| Forensic       | `reports/phase-6-forensic-audit-2026-06-06.md`  |
