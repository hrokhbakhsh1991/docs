# چک‌لیست کارهای باقی‌مانده — ویزارد / Smoke / Deploy

> **تاریخ:** 2026-06-13  
> **منبع:** کل مکالمه (چندین جلسه) + وضعیت repo `/root/docs` (branch `main`, ~۱۱۶ فایل uncommitted)  
> **هدف:** همه موارد حل‌نشده یا نیمه‌حل — با **اولویت** و **workspace**

---

## راهنمای اولویت

| سطح | معنی |
|-----|------|
| **P0** | مسیر اصلی محصول یا smoke بحرانی — بدون آن release/اعتماد نداریم |
| **P1** | E2E/کیفیت/enterprise parity — باید قبل merge نهایی |
| **P2** | Deploy/infra/کیفیت کد — بعد از P0/P1 |
| **P3** | بهبود، مستندات، پاکسازی |

## راهنمای workspace

| Workspace | مسیر تقریبی |
|-----------|-------------|
| `web` | `apps/web` |
| `api` | `apps/api` |
| `denali` | `packages/workspaces/denali` |
| `platform` | `packages/platform-core`, `packages/wizard-navigation` |
| `marketing` | `apps/marketing` |
| `deploy` | `/opt/app-tour`, `scripts/vps-deploy` |
| `repo` | git, pre-commit, merge |

---

## P0 — بحرانی (ویزارد + smoke اصلی)

### Workspace: `web` + `denali`

- [ ] **SMK-P9-ITIN-02** — E2E ویزارد multi-day تا مرحله **برنامه (itinerary)**
  - وضعیت آخر: مرحله **اطلاعات پایه** و **عکس‌ها** باز می‌شوند؛ از عکس‌ها به برنامه نمی‌رود (timeout ۱۸۰s)
  - علت محتمل: `program.shortDescription` در template منتشرشده در UI نیست **یا** validation مرحله `denali_photos` block می‌کند
  - فایل‌ها: `test/fixtures/denali-itinerary-wizard-fixture.ts`, `test/fixtures/operator-wizard-template-fixture.ts`

- [ ] **Template wizard کامل** — publish فیلدهای مرحله عکس‌ها (`program.shortDescription` الزامی در rule set)
  - PUT template گاهی fail؛ fallback seed API
  - پاکسازی `hasPublishedProgramItinerary` مرده در fixture

- [ ] **تست ویزارد مراحل ۲–۶ + دکمه «ایجاد تور»** (logistics, pricing, legal, review, submit)

- [ ] **SMK-P9-ITIN-01** — flat edit itinerary روی tour `00000000-0000-4000-8000-000000000210`
  - یک‌بار ۲/۲ passed؛ بعد از fixهای این session **بازتأیید نشده**

### Workspace: `marketing`

- [ ] **SMK-MKT-04** — `[data-marketing-catalog-itinerary]` + segment photo
  - tour detail 200 ولی itinerary در catalog نیست
  - infra: `shop.operator.localhost` در hosts، Chromium (CDN 403)

---

## P1 — enterprise / parity / باگ‌های نیمه‌حل

### Workspace: `web`

- [ ] Draft DELETE گاهی **502** (`proxy-workspace-draft-api.server.ts`) — retry در fixture فقط
- [ ] خطای **«همگام‌سازی پیش‌نویس»** در UI ویزارد
- [ ] **ورودی عددی فارسی** — validation در platform اصلاح شد؛ لایه UI/state ممکن است هنوز Persian string ذخیره کند
- [ ] **ارتفاع قله خالی** بعد از انتخاب دماوند — `altitudeM` در catalog
- [ ] **Smoke destination** — `Smoke Summit` در catalog نیست (fallback دماوند)
- [ ] **`pickWizardDate`** — نام ISO در تقویم جلالی شکننده
- [ ] **Server prefetch** template/locations — تأیید deploy
- [ ] **Session `workspace_id`** — fix اعمال شده؛ تأیید production VPS

### Workspace: `denali`

- [ ] **Rebuild dist** در pipeline deploy (`@app-tour/workspace-denali`)
- [ ] **Unit کامل** 127 تست — روی deploy قدیمی `filterGearItemsToActiveEquipmentCatalog` fail

### Workspace: `platform`

- [ ] تست CI برای Persian digits در `canonical-value-text.ts`

### Workspace: `web` (fixture)

- [ ] `resetOperatorWizardToBasic` / `advanceWizardToStep` — بدون گزارش validation در fail
- [ ] `fillDenaliWizardPhotosMinimal` — اگر shortDescription در DOM نباشد ناقص است
- [ ] `resolveOperatorWorkspaceId` — fallback membership-ability-context

---

## P2 — deploy / infra / کیفیت

### Workspace: `deploy`

- [ ] Deploy پایدار — `remote-deploy.sh`, `build:operator-vps`, API tsc
- [ ] Sync `/root/docs` ↔ `/opt/app-tour` (branch VPS قبلاً `wip/phase9-continuation`)
- [ ] `db:migrate:deploy` بعد از deploy
- [ ] Health: web `:13000`, API `:13001` / production `89.45.89.206`

### Workspace: `web` (lint/tests)

- [ ] ESLint `denali-difficulty-range-slider.tsx` (pre-commit block)
- [ ] ESLint suspension (runbook)
- [ ] `WEB-DENALI-WIZARD-11`, `WEB-DENALI-WIZARD-08`, `workspace-boundary` روی deploy قدیمی
- [ ] Full web `test/**/*.spec.ts`

### Workspace: `api`

- [ ] Smoke template GET — login 401 در یک اجرا
- [ ] تغییرات uncommitted identity / phone-login

---

## P3 — repo / ops

### Workspace: `repo`

- [ ] **Commit** ~۱۱۶ فایل uncommitted روی `main`
- [ ] هم‌راستایی branch: `main` / `fix/admin-panel` / VPS `wip/phase9-continuation`
- [ ] pre-commit marker (runbook قدیم)

### Workspace: `deploy`

- [ ] Playwright chromium روی VPS (CDN 403)
- [ ] `/etc/hosts` برای operator / shop subdomains

---

## Fixهای اعمال‌شده (نیاز commit/deploy نهایی)

| موضوع | Workspace | تأیید |
|--------|-----------|--------|
| mapFormPathToCanonical → category | denali | unit ✅ |
| merge draft wizardSessionId | web | unit ✅ |
| exclude publishStatus از resume | denali | unit ✅ |
| skip inference (controlled step) | web | E2E partial |
| Persian digits validation | platform | unit ✅ |
| session workspace_id + middleware | web | API ✅ |
| null scalar capacityMax | denali/web | جلسات قبل |
| locations prefetch | web | deploy partial |
| fixture draft/destination/numeric | web | E2E partial |

---

## ترتیب پیشنهادی

1. P0: ITIN-02 → ITIN-01 → ویزارد کامل → MKT-04  
2. P1: draft 502, catalog, UI numeric  
3. P2: deploy + tests + ESLint  
4. P3: commit + branch VPS  

---

## دستورات سریع

```bash
cd /root/docs/apps/web && PW_EXTERNAL_SERVERS=1 \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 SMOKE_API_URL=http://127.0.0.1:13001 \
  pnpm exec playwright test -c playwright.operator.config.ts denali-itinerary-wizard.spec.ts

cd /root/docs/apps/marketing && pnpm test:smoke --grep "SMK-MKT-04"
```

---

**وضعیت آخر چت:** SMK-P9-ITIN-02 fail روی `denali_program`؛ commit نشده.
