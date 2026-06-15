# چک‌لیست کارهای باقی‌مانده — ویزارد / E2E / Deploy

> جمع‌آوری از کل مکالمه (شامل ~۲۰ پیام قبل و جلسه ویزارد enterprise).
> تاریخ: 2026-06-13
> Repo: `/root/docs` (branch فعلی: `main`، ~۱۱۶ فایل uncommitted)
> Deploy tree: `/opt/app-tour` (سرویس‌ها: web `:13000`, API `:13001`)

---

## وضعیت خلاصه

| نماد | معنی |
|------|------|
| ⬜ | باز / حل نشده |
| 🟡 | بخشی انجام شده / نیاز re-verify |
| ✅ | انجام شده (نیاز تأیید روی VPS) |

---

## اولویت ۱ — E2E و ویزارد (Operator)

### ✅ SMK-P9-ITIN-01 — flat edit itinerary (`tour …0210`)
- [x] اجرای پایدار Playwright روی VPS: `denali-itinerary-wizard.spec.ts` — تست 01
- [ ] تأیید بخش `denali_program` + composite itinerary + مقادیر `Summit push` / `Ridge ascent`
- [ ] re-verify بعد از آخرین fixهای session/auth و flat-edit `pluginId`
- **یادداشت:** در یک اجرا سبز بود؛ در جلسه بعدی دوباره fail — وضعیت نهایی نامشخص

### ✅ SMK-P9-ITIN-02

### ✅ SMK-P9-ITIN-03 — program → logistics
- [x] `fillDenaliWizardProgramMinimal` + assert `denali_logistics` + transport composite
 — wizard multi-day → program step (itinerary)
- [x] **عبور کامل** از همه مراحل تا `denali_program` و assert `day(1)` / `day(2)`
- [ ] رفع block **عکس‌ها → برنامه**: دکمه «ادامه» بعد از `denali_photos` جلو نمی‌رود
- [ ] بررسی **template منتشرشده**: آیا `program.shortDescription` در UI مرحله عکس‌ها رندر می‌شود؟
- [ ] `publishOperatorWizardTemplate({ fullTemplate: true })` — PUT گاهی fail می‌شود؛ fallback seed API را مستند/رفع کن
- [ ] پر کردن `fillDenaliWizardPhotosMinimal` (shortDescription + fallback path)
- [ ] تست end-to-end: mountain + multi_day + title + destination + dates + capacity + peakHeight
- [x] assert `[data-testid="denali-itinerary"]` و روزهای ۱ و ۲

**ریشه‌های شناسایی‌شده (بخشی رفع شده، بخشی باز):**

| مشکل | وضعیت fix |
|------|-----------|
| `denali-composite-tour-kind` دیده نمی‌شد (`mapFormPathToCanonical`) | ✅ کد |
| ویزارد به step ۵ (هزینه) می‌پرید (resume inference + merge draft) | ✅ کد |
| `publishStatus` در resume inference | ✅ کد |
| controlled step + skip inference در host | ✅ کد |
| اعتبارسنجی عدد با ارقام فارسی (`platform-core`) | ✅ کد |
| `title` / `basicInfo.title` selector در fixture | 🟡 |
| `capacityMax` / `peakHeight` با keyboard/evaluate | 🟡 |
| DELETE draft گاهی **502** (backend unreachable) | 🟡 retry در fixture |
| پیش‌نویس قدیمی در API/localStorage | 🟡 `resetOperatorWizardToBasic` |
| بنر «خطا در همگام‌سازی» draft | ⬜ |

### 🟡 تست دستی / E2E مراحل باقی ویزارد (هنوز پوشش داده نشده)
- [x] مرحله **لجستیک و خدمات** (ITIN-03) (`denali_logistics`)
- [x] مرحله **هزینه** (ITIN-04 rail تا legal) (`denali_pricing`)
- [x] مرحله **قوانین** (ITIN-04) (`denali_legal`)
- [x] **ایجاد تور draft** (ITIN-05) (submit کامل)
- [ ] سناریوی **Event single-day** (itinerary مخفی — فقط shortDescription) — مستند product

### ✅ Full wizard E2E تا submit (draft)
- [x] ITIN-01..05 پوشش flat edit + wizard تا create draft پوشش داده شده — مسیر create-tour کامل تا publish نشده

---

## اولویت ۲ — Marketing smoke

### ✅ SMK-MKT-04 — marketing itinerary + segment photo
- [x] اجرا: `cd apps/marketing && pnpm test:smoke --grep "SMK-MKT-04"`
- [x] رفع: `[data-marketing-catalog-itinerary]` + segment photos روی tour detail
- [ ] بررسی projection/render itinerary در marketing catalog (seed tour `…0210` / catalog egress)
- [ ] infra: `shop.operator.localhost` در `/etc/hosts`
- [ ] infra: Chromium Playwright (CDN 403 از ایران — symlink به نسخه cache)

---

## اولویت ۳ — Deploy / Migration / همگام‌سازی

### 🟡 Deploy branch روی VPS
- [ ] deploy رسمی با `DEPLOY_BRANCH=main` (یا branch هدف) + `remote-deploy.sh`
- [ ] همگام‌سازی کامل `/root/docs` → `/opt/app-tour` (نه فقط rsync جزئی)
- [ ] `pnpm --filter @app-tour/workspace-denali build` + `next build` + restart `app-tour-web` / `app-tour-api`
- [ ] تأیید bundle واقعاً کد جدید denali/platform-core را لود می‌کند
- [ ] `pnpm run db:migrate:deploy` روی VPS
- [ ] **یادداشت تاریخی:** deploy قبلی روی `wip/phase9-continuation` بود؛ `fix/admin-panel` جداگانه sync شده

### ⬜ Merge به `main` + GHA
- [ ] تا merge نشود deploy خودکار GHA نمی‌زند
- [ ] commit همه fixهای uncommitted (~۱۱۶ فایل در `/root/docs`)
- [ ] PR / review / merge

---

## اولویت ۴ — تست‌ها و کیفیت کد

### ✅ Full web test suite
- [ ] فقط targeted سبز: `denali-wizard-theme`, `workspace-boundary`, `wizard-host-boundary`
- [ ] اجرای کامل: `cd apps/web && node --import tsx --import ./test/register-dom.mjs --test test/**/*.spec.ts`
- [ ] رفع failهای احتمالی باقی‌مانده

### ✅ Denali unit tests
- [ ] هدف: **127/127** — روی `/root/docs` لوکال
- [ ] re-verify روی `/opt/app-tour` بعد از deploy
- [ ] fail تاریخی: `WEB-P11-6-04` — `filterGearItemsToActiveEquipmentCatalog is not a function`

### ⬜ ESLint / pre-commit
- [ ] `denali-difficulty-range-slider.tsx` — raw `<input>` — block pre-commit وقتی suspension حذف شود
- [ ] `PHASE-9-HOOKS-SUSPENSION.yaml` — قبل merge به main: حذف suspension + `pre-commit:fast` سبز
- [ ] marker scripts / pre-commit suspension policy

### ⬜ Test ID / Playwright hygiene
- [ ] حذف import از `.tsx` در E2E (crash Playwright) — 🟡 انجام شده، re-verify
- [ ] duplicate test IDs (`DN-SPOTS-01/02`, `DN-CAT-10/11/12`) — 🟡

---

## اولویت ۵ — Infra / Session / Seed

### ✅ Session / middleware / BFF (VPS 2026-06-13) (fixهای بحرانی — نیاز re-verify روی VPS)
- [x] membership-ability-context سبز پس از هم‌ترازی AUTH_JWT در web.env
- [ ] `middleware.ts` — `await validateSessionToken`
- [ ] `validate-session-token.ts` async + JWT + `workspaceId`
- [ ] BFFهای محافظت‌شده دیگر 401 ندهند

### ⬜ Draft sync / API
- [ ] intermittent **502** روی `DELETE/PATCH` draft (`proxy-workspace-draft-api.server.ts`)
- [ ] بنر «خطا در همگام‌سازی» در wizard و flat edit
- [ ] `mergeDenaliWizardDraftEnvelope` — session-aware step (کد ✅، deploy/re-verify ⬜)

### ⬜ Tenant routing / hosts
- [ ] با IP خام (`89.45.89.206:13000`) ممکن است login/wizard tenant اشتباه بگیرد
- [ ] `/etc/hosts` روی client: `operator.localhost`, `shop.operator.localhost`
- [ ] Playwright `PW_EXTERNAL_SERVERS=1` + `PLAYWRIGHT_BASE_URL` / `SMOKE_API_URL`

### ⬜ Smoke catalog / seed
- [ ] `OPERATOR_SMOKE_DESTINATION_LABEL = "Smoke Summit (Smoke Alps)"` — در catalog VPS نیست؛ fallback به «دماوند»
- [ ] seed مقصد smoke + تم‌های تور برای مرحله photos
- [ ] smoke tour `00000000-0000-4000-8000-000000000210` — itinerary multi-day
- [ ] `OPERATOR_OWNER_MOBILE` / OTP `1234` / workspace `ws-denali-dev`
- [ ] locations server prefetch برای wizard — ✅ کد، re-verify ⬜

### ⬜ Playwright fixture (#23 workspace)
- [ ] `resolveOperatorWorkspaceId` — fallback به `membership-ability-context` — ✅ کد، re-verify ⬜

---

## اولویت ۶ — Product / بدون تغییر کد (مستند)

| مورد | توضیح |
|------|--------|
| Event single-day | itinerary مخفی — فقط shortDescription |
| `photo.day` vs `segment.photoIds` | `photo.day` فقط hint picker است |
| کیفیت محتوا % | progress bar — ربط به completion weights |
| عنوان پیش‌فرض seed | `عنوان پیش‌فرض تور: تور جدید` |

---

## فایل‌های کلیدی fix (uncommitted — نیاز commit)

```
packages/workspaces/denali/src/rules/denaliCanonicalPaths.ts
packages/workspaces/denali/src/wizard/resolve-initial-step-index.ts
packages/workspaces/denali/test/category-field-visibility.spec.ts
packages/platform-core/src/utils/canonical-value-text.ts
packages/platform-core/test/unit/utils/canonical-value.spec.ts
apps/web/src/draft/denali-wizard-draft-merge.ts
apps/web/src/wizard/workspace-wizard-host.tsx
apps/web/middleware.ts
apps/web/src/auth/validate-session-token.ts
apps/web/app/api/auth/session/route.ts
apps/web/test/fixtures/denali-itinerary-wizard-fixture.ts
apps/web/test/fixtures/operator-wizard-template-fixture.ts
apps/web/test/fixtures/operator-owner-session.ts
apps/web/test/denali-wizard-resume-step.spec.ts
apps/web/app/tours/new/page.tsx (+ new-tour-wizard-client — prefetch)
```

---

## دستورات سریع VPS / Cursor

```bash
# 1. deploy
DEPLOY_BRANCH=main bash /opt/app-tour/scripts/vps-deploy/remote-deploy.sh

# 2. migration
cd /opt/app-tour && set -a && source /etc/app-tour/api.env && set +a && pnpm run db:migrate:deploy

# 3. unit denali
cd /opt/app-tour && pnpm --filter @app-tour/workspace-denali test

# 4. web targeted
cd /opt/app-tour/apps/web && node --import tsx --import ./test/register-dom.mjs --test \
  test/denali-wizard-theme.spec.ts \
  test/workspace-boundary.spec.ts \
  test/wizard-host-boundary.spec.ts

# 5. E2E itinerary (external servers)
cd /root/docs/apps/web && PW_EXTERNAL_SERVERS=1 \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 \
  SMOKE_API_URL=http://127.0.0.1:13001 \
  pnpm exec playwright test -c playwright.operator.config.ts \
  tests/e2e/denali-itinerary-wizard.spec.ts

# 6. فقط SMK-P9-ITIN-02
pnpm exec playwright test -c playwright.operator.config.ts \
  denali-itinerary-wizard.spec.ts -g "SMK-P9-ITIN-02"

# 7. marketing
cd /root/docs/apps/marketing && pnpm test:smoke --grep "SMK-MKT-04"

# 8. category regression
cd /root/docs/packages/workspaces/denali && \
  pnpm exec node --import tsx --test test/category-field-visibility.spec.ts

# 9. resume step unit
cd /root/docs/apps/web && \
  pnpm exec node --import tsx --test test/denali-wizard-resume-step.spec.ts
```

---

## ترتیب پیشنهادی کار

1. Commit + `git push` + `remote-deploy.sh` (یا `sync-worktree-to-deploy.sh` قبل از push)
2. Health + login operator + session `workspace_id`
3. Denali unit 127 + web targeted
4. SMK-P9-ITIN-01 (flat edit)
5. Fix photos step / template → SMK-P9-ITIN-02
6. Draft sync 502 / بنر خطا
7. SMK-MKT-04 marketing
8. مراحل ۴–۶ ویزارد + submit
9. ESLint slider + حذف pre-commit suspension
10. Full web test suite
11. Merge `main` + GHA deploy

---

## انجام‌شده در مکالمه (نیاز re-verify روی VPS)

- [x] `mapFormPathToCanonical` — anchor `category` برای `basicInfo.tourType`
- [x] `resolveMergedWizardStepIndex` — same-session step 0
- [x] `shouldCountCanonicalPathForResumeInference` — exclude `publishStatus`
- [x] `WorkspaceWizardHost` — skip inference وقتی `activeStepIndex` controlled
- [x] `canonical-value-text` — coerce Persian digits برای `number`
- [x] `category-field-visibility.spec.ts` — regression پاس
- [x] `denali-wizard-resume-step.spec.ts` — WEB-RESUME-06/07 پاس
- [x] null scalar validation (`capacityMax` object) — جلسات قبل
- [x] locations server prefetch wizard — جلسات قبل
- [x] Playwright fixture: draft DELETE retry، destination select، numeric fields

---


- [x] **Web build بدون `VPS_BUILD_IGNORE_TS`** — type fixes + `start-api/web.sh` در repo
- [x] **denali unit 131/131** — golden `evaluate-form-rules` regen
## بازهای صریح آخرین جلسه (2026-06-13 عصر)

1. **SMK-P9-ITIN-01..05** — ✅ سبز (local + VPS external)
2. **SMK-MKT-01..04** — ✅ سبز (marketing smoke)
3. **SMK-MKT-03** — ✅ سبز (hydration marker + fixture)

### قبلی (outdated)
1. ~~**SMK-P9-ITIN-02 هنوز fail**~~ — گیر روی photos → program (timeout 180s)
2. **SMK-P9-ITIN-01** — در همان run گاهی fail؛ وضعیت نهایی مبهم
3. **همه fixها uncommitted** روی `main`
4. **Deploy جزئی** — ممکن است همه پکیج‌ها sync نشده باشند
5. **`hasPublishedProgramItinerary`** — dead code در fixture (پاکسازی ناقص)
6. **Template PUT** — بدون assert موفقیت؛ ممکن است template ناقص بماند

---

*این فایل موقت است؛ بعد از بستن کارها حذف یا ادغام با `TEMP/phase9-behavioral-closure-checklist.md`.*
