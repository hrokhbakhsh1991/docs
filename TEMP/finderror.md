# گزارش خطاهای کشف‌شده — app-tour

**تاریخ بررسی:** ۱۴ ژوئن ۲۰۲۶  
**محیط‌های تست‌شده:**
- Dev: `http://127.0.0.1:3000` (API روی 3001، `STORAGE_DRIVER=memory`)
- Production/VPS: `http://89.45.89.206:13000` (API روی 13001، `STORAGE_DRIVER=prisma`)

**روش:** اجرای سرور dev، لاگین (BFF + UI)، گشت در صفحات اصلی اپراتور، تست endpointهای VPS، و بررسی redirect/API/console.

---

## چک‌لیست پیشرفت (✅ رفع‌شده · ⬜ باز)

**آخرین به‌روزرسانی:** batch 17 — **87/87 رفع (کد)** · VPS نیاز به push+deploy**

| دسته | کل | ✅ | ⬜ |
|------|-----|-----|-----|
| Infra VPS | 4 | 4 | 0 |
| Catalog | 1 | 1 | 0 |
| TW wizard | 22 | 22 | 0 |
| MD multi-day | 14 | 14 | 0 |
| RV review | 9 | 9 | 0 |
| USR users | 12 | 12 | 0 |
| FE flat edit | 15 | 15 | 0 |
| TR register | 10 | 10 | 0 |
| **جمع** | **87** | **87** | **0** |

### Infra / VPS
- ✅ 1 — OTP production → `DATABASE_UNAVAILABLE` (503) + i18n
- ✅ 2 — PostgreSQL password → `verify-db-env` + `sync-db-app-role-password` در deploy
- ✅ 3 — Redirect `/catalog` (Catalog #3)
- ✅ 4 — Tenant branding روی IP (`PUBLIC_TENANT_FALLBACK_*` + BFF fallback)

### TW (همه ✅)
- ✅ TW-01..22

### MD (همه ✅)
- ✅ MD-01..05, 07..14 (شامل MD-03 E2E SMK-P9-ITIN-01..05)
- ✅ MD-06 مقصد «در حال بارگذاری…»

### RV · USR · TR · FE
- ✅ RV-01..09 (همه)
- ✅ USR-01..12 (همه)
- ✅ TR-01..10 (همه)
- ✅ FE-01..15 زمان load بالا


## خلاصه

| شدت | تعداد | توضیح |
|-----|-------|-------|
| 🔴 بحرانی | 0 | — (batch 15: کد + deploy automation) |
| 🟠 مهم | 0 | — (Catalog #3 + tenant branding — batch 14) |
| 🟢 بدون خطا | 19 | صفحات اپراتور در dev بعد از لاگین |

---

## خطاهای بحرانی

### ✅ 1. لاگین Production (VPS) — OTP_REQUEST_FAILED → DATABASE_UNAVAILABLE

- **علت ریشه‌ای:** `DATABASE_URL` password mismatch → Prisma fail → OTP 500
- **Fix (batch 15):** `error-interceptor` → **503** `DATABASE_UNAVAILABLE` + i18n؛ BFF همان code را عبور می‌دهد
- **Fix (batch 17):** `smoke-operator-login.sh` در `remote-deploy.sh` — deploy بدون OTP موفق fail می‌شود
- **Ops:** `git push main` → GitHub Actions `remote-deploy.sh` (یا manual روی VPS)
- **تأیید VPS (2026-06-14):** هنوز `OTP_REQUEST_FAILED` — **origin/main قدیمی**؛ fixها local uncommitted

### ✅ 2. رمز عبور PostgreSQL در `/etc/app-tour/api.env` — deploy auto-sync

- **Fix (batch 15):** `verify-db-env.sh` + `sync-db-app-role-password.sh` + auto در `remote-deploy.sh`
- **Fix (batch 16):** `bootstrap-server.sh` نصب `postgresql-client` + `python3`
- **پیش‌نیاز:** `DATABASE_URL_ADMIN` در `api.env` (postgres superuser)
- **Ops:** پس از push/deploy، `/health` باید `checks.database.status=ok` برگرداند

---

## خطاهای مهم

### ✅ 3. Redirect صفحه `/catalog` — ERR_INVALID_REDIRECT

- **مسیر:** `GET /catalog` → `307` → `http://shop.127.0.0.1:3002/tours`
- **خطای مرورگر:** `net::ERR_INVALID_REDIRECT`
- **علت:** `resolveMarketingPublicBaseUrl()` به `shop.{host}:3002` redirect می‌کند ولی `apps/marketing` روی پورت 3002 اجرا نشده.
- **فایل مرتبط:** `apps/web/src/marketing/resolve-marketing-public-url.ts`
- **راه‌حل پیشنهادی:** اجرای marketing روی 3002، یا تنظیم `MARKETING_PUBLIC_BASE_URL`، یا fallback وقتی marketing در دسترس نیست.

### ✅ 4. Tenant branding روی IP خام — TENANT_HOST_UNKNOWN

- **URL:** `GET /api/public/tenant-branding` (روی VPS با host `89.45.89.206`)
- **پاسخ:** `HTTP 404` → `{"code":"TENANT_HOST_UNKNOWN"}`
- **تأثیر:** صفحه لاگین روی IP بدون branding/tenant context درست لود نمی‌شود.
- **endpoint مرتبط:** `GET /public/tenant-context` با `x-forwarded-host: 127.0.0.1` → همان خطا.

---

## خطاهای API (VPS — تست مستقیم)

| Endpoint | Status | Code |
|----------|--------|------|
| `POST /auth/request-otp` | 500 | `internal_error` |
| `GET /public/tenant-context` | 404 | `TENANT_HOST_UNKNOWN` |
| `GET /public/tenant-branding` | 500 | `internal_error` |
| `GET /api/v2/tenant-config` | 401 | `UNAUTHORIZED_MISSING_USER_ID` / `UNAUTHORIZED_MISSING_WORKSPACE_ID` |

---

## صفحات بدون خطا (Dev — بعد از BFF login)

لاگین BFF با `+989121000001` / OTP `1234` موفق بود. صفحات زیر HTTP 200 و بدون alert/console error:

- `/dashboard`
- `/tours`, `/tours/new`
- `/bookings`, `/bookings/new`
- `/finance`
- `/users`
- `/settings` و زیرصفحات: `me`, `branding`, `locations`, `equipment`, `guide-languages`, `tour-themes`, `tour-presets`, `tour-wizard-template`, `wizard-drafts`, `audit-trail`, `reconciliation-triage`, `urban`
- `/leader/review` → redirect به `/bookings?view=inbox_table&scope=leader` (OK)

**لاگین UI در dev:** با دکمه «ارسال OTP» و OTP `1234` کار می‌کند (۵ input OTP نمایش داده می‌شود).

---

## موارد بررسی‌شده ولی خطا نداشتند

- API dev (`http://127.0.0.1:3001/health`) → OK
- Web dev (`http://127.0.0.1:3000/auth/login`) → OK
- هیچ `console.error` یا API 4xx/5xx حین گشت در صفحات اپراتور dev مشاهده نشد
- Redis → `PONG`

---

## اولویت رفع

1. **فوری:** هم‌خوان کردن `DATABASE_URL` / `DATABASE_URL_ADMIN` در `/etc/app-tour/api.env` با رمز واقعی PostgreSQL و restart `app-tour-api`.
2. **فوری:** بعد از fix DB، تست مجدد OTP/login روی `http://89.45.89.206:13000`.
3. **مهم:** اجرای `apps/marketing` روی 3002 یا اصلاح redirect `/catalog`.
4. **متوسط:** پشتیبانی از دسترسی via IP (tenant mapping برای IP یا fallback tenant در production).

---

## دستورات اجرا شده

```bash
# Dev servers
cd /root/docs/apps/api && STORAGE_DRIVER=memory AUTH_ALLOW_DEV_STATIC_OTP=true node --import tsx src/main.ts
cd /root/docs/apps/web && ALLOW_DEV_WEB_SESSION=true ALLOW_DENALI_WEB_PLUGIN=true pnpm dev

# Production (systemd — از قبل در حال اجرا)
# app-tour-api  → :13001
# app-tour-web  → :13000
```

**گزارش JSON خام:** `/tmp/find-errors-report.json`

---

## خطاهای ریز — فرآیند ساخت تور (Wizard)

**تاریخ:** ۱۴ ژوئن ۲۰۲۶  
**محیط:** Dev `http://127.0.0.1:3000` — لاگین UI + BFF، مسیر `/tours/new`  
**روش:** مرورگر (Playwright + Browser MCP)، کلیک «تور جدید»، گشت در ۶ مرحله wizard

### ✅ TW-01 — پیام validation با مسیر canonical داخلی (basic)
- **مرحله:** `denali_basic`
- **شدت:** بالا
- **شرح:** با کلیک «ادامه» بدون تکمیل فیلدها، پیام `"No value at canonical path \"tripDetails.overview.peakHeight\""` به کاربر نمایش داده می‌شود — متن developer-facing است نه پیام فارسی کاربرپسند.

### ✅ TW-02 — capacityMax نوع object به‌جای number (basic)
- **مرحله:** `denali_basic`
- **شدت:** بالا
- **شرح:** validation نمایش می‌دهد: `"Canonical path \"capacityMax\" expects kind \"number\" but got object"` — باگ در serialize/deserialize draft یا LocalizedNumericInput.

### ✅ TW-03 — دکمه «ادامه» بدون پر کردن فیلدها فعال است (basic)
- **مرحله:** `denali_basic`
- **شدت:** متوسط
- **شرح:** در بارگذاری اول wizard، Next بدون هیچ داده‌ای enabled است؛ validation فقط بعد از کلیک نشان داده می‌شود.

### ✅ TW-04 — مقصد «در حال بارگذاری…» طولانی (basic)
- **مرحله:** `denali_basic`
- **شدت:** متوسط
- **شرح:** combobox مقصد چند ثانیه فقط `"در حال بارگذاری مقصدها…"` نشان می‌دهد؛ UX ضعیف در cold start.

### ✅ TW-05 — فقط یک مقصد در لیست (basic)
- **مرحله:** `denali_basic`
- **شدت:** پایین
- **شرح:** پس از load فقط `"توچال (تهران)"` موجود است — seed ناکافی برای تست/دمو.

### ✅ TW-06 — تاریخ پایان خالی ولی multi-day فعال (basic)
- **مرحله:** `denali_basic`
- **شدت:** بالا
- **شرح:** شروع `"۲۷ خرداد ۱۴۰۵ ۰۰:۰۰"` ثبت شده ولی پایان `"انتخاب تاریخ انتخاب ساعت"` — با وجود hint چندروزه، «ادامه» بدون highlight تاریخ پایان block می‌شود.

### ✅ TW-07 — بنر عنوان پیش‌فرض stale (همه مراحل)
- **مرحله:** header wizard
- **شدت:** متوسط
- **شرح:** پس از تغییر نام تور به `"BrowserTest Tour 1403"`، بنر همچنان `"عنوان پیش‌فرض تور: تور جدید"` نمایش می‌دهد.

### ✅ TW-08 — عنوان `<title>` صفحه «توراپس» نه «ساخت تور»
- **مرحله:** `/tours/new`
- **شدت:** پایین
- **شرح:** `<title>` برابر `توراپس` است در حالی که heading اصلی «ساخت تور» است — SEO/tab نامفهوم.

### ✅ TW-09 — پیش‌نویس قبلی wizard را روی مرحله ۴ باز می‌کند
- **مرحله:** بارگذاری `/tours/new`
- **شدت:** متوسط
- **شرح:** با وجود intent «تور جدید»، draft قدیمی کاربر را مستقیم روی «لجستیک و خدمات» restore می‌کند — گیج‌کننده.

### ✅ TW-10 — پرش progress به عکس‌ها بدون تکمیل basic
- **مرحله:** navigation
- **شدت:** متوسط
- **شرح:** کلیک روی step «عکس‌ها» در progress bar بدون تکمیل تاریخ پایان ممکن است — validation مرحله‌ای ناهمگون.

### ✅ TW-11 — OTP: ارقام فارسی و ترتیب اشتباه (login UI)
- **مرحله:** `/auth/login`
- **شدت:** متوسط
- **شرح:** ورود OTP با کیبورد `"1234"` به `"۱۲۴۳"` (ارقام فارسی، رقم ۳ و ۴ جابه‌جا) منجر به `"رمز واردشده درست نیست"` شد — OtpSegmentInput + localization.

### ✅ TW-12 — IntlError: کلید i18n تکراری `denali.fields.denali.destination`
- **مرحله:** `denali_basic` (console)
- **شدت:** متوسط
- **شرح:** `MISSING_MESSAGE: Could not resolve denali.fields.denali.destination in messages for locale fa` — prefix دوبل `denali.`.

### ✅ TW-13 — Draft PATCH conflict 409 (console)
- **مرحله:** autosave wizard
- **شدت:** متوسط
- **شرح:** چند بار `Failed to load resource: 409 (Conflict)` روی PATCH draft — race condition در autosave.

### ✅ TW-14 — اسلایدر سطح سختی readonly (program)
- **مرحله:** `denali_program`
- **شدت:** پایین
- **شرح:** `slider` با `states: [readonly]` و value=5 — کاربر نمی‌تواند سختی را تغییر دهد (یا UX نامشخص).

### ✅ TW-15 — پیام انگلیسی در UI فارسی (program)
- **مرحله:** `denali_program`
- **شدت:** پایین
- **شرح:** `"از Settings → Guide languages اضافه کنید."` — ترکیب فارسی/انگلیسی، Settings localize نشده.

### ✅ TW-16 — وابستگی عکس در مرحله program (program)
- **مرحله:** `denali_program`
- **شدت:** متوسط
- **شرح:** در itinerary: `"ابتدا در مرحله عکس‌ها، تصویر آپلود کنید."` — dependency بین مراحل بدون لینک مستقیم یا CTA.

### ✅ TW-17 — ۴ Leaflet map تکراری در logistics
- **مرحله:** `denali_logistics`
- **شدت:** پایین
- **شرح:** ۴ instance نقشه (شروع/قله/اردوگاه/پایان) + attribution `"Leaflet | © OpenStreetMap"` — performance/accessibility سنگین.

### ✅ TW-18 — حمل‌ونقل «اتوبوس» + دنگ checked ولی فیلد هزینه خالی required (logistics)
- **مرحله:** `denali_logistics`
- **شدت:** متوسط
- **شرح:** checkbox «اجازه ماشین شخصی» checked → فیلد «مبلغ دنگ» required ولی خالی — Next بدون پیام واضح.

### ✅ TW-19 — دکمه «ذخیره پیش‌نویس» گاه disabled گاه enabled
- **مرحله:** wizard header
- **شدت:** پایین
- **شرح:** روی logistics disabled بود، روی basic enabled — رفتار inconsistent.

### ✅ TW-20 — wizard template `published=false` (gate)
- **مرحله:** API `/api/settings/tour-wizard-template`
- **شدت:** بالا
- **شرح:** template منتشر نشده؛ wizard با draft/partial template render می‌شود — ممکن است فیلدهای ناقص.

### ✅ TW-21 — ۴ input بدون label/aria در wizard (a11y)
- **مرحله:** کل wizard
- **شدت:** پایین
- **شرح:** ۴ control بدون `label` یا `aria-label` — WCAG.

### ✅ TW-22 — دکمه «تور جدید» dashboard با pointer-events:none
- **مرحله:** `/dashboard`
- **شدت:** متوسط
- **شرح:** CTA «تور جدید» در حالت loading غیرقابل کلیک (`pointer-events: none`) بدون spinner واضح.

---

**جمع خطاهای wizard:** 22 مورد  
**تست‌شده در مرورگر:** login → dashboard → `/tours/new` → basic/photos/program/logistics  
**گزارش JSON:** `/tmp/tour-wizard-errors.json`

---

## خطاهای تور چندروزه (Multi-Day) — ۱۴ ژوئن ۲۰۲۶

**محیط:** Dev `http://127.0.0.1:3000` — لاگین BFF + مرورگر + Playwright  
**مسیر:** `/tours/new` → انتخاب multi-day → ۶ مرحله wizard → ساخت تور

### نتیجه تست

| روش | نتیجه |
|-----|--------|
| Playwright fixture (SMK-P9-ITIN-02..05) | ✅ همه pass — تور multi-day ساخته شد |
| مرورگر دستی / اسکript بدون seed | ❌ گیر در basic — ساخت ناموفق |
| E2E بعد از seed location دستی | ✅ pass در 25s |

---

### خطاهای بحرانی (multi-day)

#### ✅ MD-01 — بدون seed، مقصد خالی و wizard block می‌شود
- **مرحله:** `denali_basic`
- **شرح:** API memory تازه `destinations: []` برمی‌گرداند؛ `OPERATOR_SMOKE_E2E_SEED=1` فقط tenant `…000014` را seed می‌کند نه Denali dev `…000003`.
- **تأثیر:** multi-day بدون انتخاب مقصد از basic جلو نمی‌رود.

#### ✅ MD-02 — تاریخ پایان خالی — block بی‌صدا
- **مرحله:** `denali_basic`
- **شرح:** hint «برای تورهای چندروزه الزامی است» نمایش داده می‌شود ولی «ادامه» بدون پیام validation جلو نمی‌رود.
- **Browser:** `پایان برنامه: انتخاب تاریخ انتخاب ساعت` + `شروع: ۲۷ خرداد ۱۴۰۵`

#### ✅ MD-03 — ساخت multi-day در UI دستی ناموفق
- **مرحله:** submit
- **شرح:** تور `MultiDay-*` در `/tours` ظاهر نشد وقتی flow دستی fail شد.

---

### خطاهای i18n (console — تکرارشونده)

#### ✅ MD-04 — `denali.fields.denali.destination`
- **IntlError:** `MISSING_MESSAGE` — prefix دوبل `denali.`
- **تأثیر:** label فیلد مقصد در wizard فارسی resolve نمی‌شود.

#### ✅ MD-05 — `denali.fields.denali.datetime-end`
- **IntlError:** `MISSING_MESSAGE` — همان باگ prefix برای تاریخ پایان multi-day.

---

### خطاهای UX / UI (مرورگر)

#### ✅ MD-06 — مقصد «در حال بارگذاری مقصدها…»
- combobox چند ثانیه stuck روی loading قبل از populate.

#### ✅ MD-07 — بنر عنوان stale
- پس از تغییر نام تور، `"عنوان پیش‌فرض تور: تور جدید"` همچنان نمایش داده می‌شود.

#### ✅ MD-08 — draft restore روی مرحله ۵
- باز کردن `/tours/new` بعد از E2E، wizard را روی «هزینه» (مرحله ۵) باز می‌کند نه basic.

#### ✅ MD-09 — «پاک کردن پیش‌نویس» نیاز به confirm
- کلیک بدون accept دیالوگ confirm draft را پاک نکرد.

#### ✅ MD-10 — checkboxهای pricing فقط readonly
- «تور پولی»، «بیمه گروهی»، «بیمه شخصی» — `states: [readonly]`؛ کاربر نمی‌تواند toggle کند.

#### ✅ MD-11 — حداقل سن required ولی خالی
- مرحله pricing: `حداقل سن` required ولی value خالی — «ادامه» همچنان enabled.

#### ✅ MD-12 — `<title>` صفحه «توراپس» نه «ساخت تور»
- tab browser نامفهوم.

---

### خطاهای API / داده

#### ✅ MD-13 — `altitudeM` در POST destination نادیده گرفته می‌شود
- **Request:** `{ altitudeM: 3964 }`
- **Response:** `"altitudeM": null`
- **Endpoint:** `POST /api/settings/resources/locations`

#### ✅ MD-14 — پیام validation با canonical path (multi-day basic)
- `"No value at canonical path \"tripDetails.overview.peakHeight\""`
- `"Canonical path \"capacityMax\" expects kind \"number\" but got object"`

---

### خطاهای مثبت (flow درست با fixture)

وقتی `publishOperatorWizardTemplate({ fullTemplate: true })` + fixture اجرا شود:
- ✅ SMK-P9-ITIN-02: itinerary در program برای multi-day
- ✅ SMK-P9-ITIN-03: program → logistics
- ✅ SMK-P9-ITIN-04: رسیدن به legal
- ✅ SMK-P9-ITIN-05: ساخت تور end-to-end (~25s)

---

### اولویت رفع (multi-day)

1. Seed catalog برای tenant `…000003` در boot dev (یا `OPERATOR_SMOKE_E2E_SEED` برای Denali)
2. Fix i18n keys: `denali.fields.denali.*` → `denali.fields.*`
3. Validation banner برای تاریخ پایان multi-day (نه block بی‌صدا)
4. User-friendly validation به‌جای canonical path در UI
5. Fix `capacityMax` object vs number در draft merge
6. Sync title banner با draft title

**گزارش JSON:** `/tmp/multi-day-errors.json`  
**E2E log:** `/tmp/multi-day-e2e.log`

---

## خطاهای مرحله Review (بازبینی) — ۱۴ ژوئن ۲۰۲۶

**محیط:** Dev `http://127.0.0.1:3000` — لاگین + مرورگر + Playwright  
**مسیر:** `/tours/new` → رسیدن به آخرین مرحله → بررسی لینک خطاهای فیلد

### نتیجه کلی

| انتظار (spec Phase 11.7) | واقعیت UI |
|--------------------------|-----------|
| آخرین مرحله `review` («بازبینی و ثبت») | ❌ **مرحله ۶ از ۶ = قوانین** — review اصلاً در progress نیست |
| پنل validation + لینک فیلد روی review | ❌ review قابل دسترس نیست |
| دکمه «ساخت تور» روی review | ❌ روی مرحله legal نمایش داده می‌شود |

---

### ✅ RV-01 — مرحله Review در ویزارد وجود ندارد (بحرانی)

- **شرح:** progress فقط ۶ مرحله دارد: basic → photos → program → logistics → pricing → legal
- **علت کد:** `buildDenaliTenantWizardTemplatePayload()` عمداً `review` را filter می‌کند (INV-WIZ-002) و `WorkspaceWizardHost` مرحله Layer C را inject نمی‌کند
- **فایل:** `packages/workspaces/denali/src/settings/denaliFullWizardTemplate.ts:133-141`
- **تأثیر:** `DenaliReviewStep`، `DenaliReviewValidationSummary`، `publishStatus` هرگز render نمی‌شوند
- **Browser:** «مرحله ۶ از ۶ — قوانین و شرایط» + دکمه «ساخت تور»

---

### ✅ RV-02 — لینک خطا روی review نیست؛ روی Continue مراحل میانی است

- **مرحله:** `denali_pricing` / `denali_basic` (نه review)
- **شرح:** با کلیک «ادامه» بدون پر کردن فیلد، پنل `قبل از ایجاد تور این موارد را اصلاح کنید` ظاهر می‌شود — همان heading مرحله review
- **Browser (pricing):** لینک `denali.fields.denali.pricing-participants` + پیام canonical path
- **Browser (basic):** ۲ لینک: «ارتفاع قله (متر)» و «حداکثر ظرفیت»

---

### ✅ RV-03 — label فیلد composite با prefix دوبل `denali.`

- **مرحله:** `denali_pricing`
- **UI:** `denali.fields.denali.pricing-participants` به‌جای «الزامات شرکت‌کننده»
- **aria-label:** `رفتن به فیلد denali.fields.denali.pricing-participants و اصلاح خطا`
- **پیام:** `No value at canonical path "participants.minimumAge"`

---

### ✅ RV-04 — پیام validation با canonical path (نه فارسی)

- **نمونه‌ها (browser):**
  - `No value at canonical path "tripDetails.overview.peakHeight"`
  - `Canonical path "capacityMax" expects kind "number" but got object`
  - `No value at canonical path "participants.minimumAge"`
- **تأثیر:** کاربر پیام فنی می‌بیند نه «این فیلد الزامی است»

---

### ✅ RV-05 — `capacityMax` به‌صورت object در draft (type bug)

- **مرحله:** `denali_basic`
- **پیام:** `Canonical path "capacityMax" expects kind "number" but got object`
- **Browser:** لینک «حداکثر ظرفیت» در پنل validation — کلیک فیلد را focus می‌کند

---

### ✅ RV-06 — بعد از «ساخت تور» ناموفق، پنل خطا فوراً دیده نمی‌شود

- **مرحله:** `denali_legal` → کلیک «ساخت تور»
- **شرح:** wizard به `denali_basic` jump می‌کند (focus اولین issue) ولی پنل validation تا کلیک «ادامه» نمایش داده **نمی‌شود**
- **تأثیر:** submit fail بی‌صدا به نظر می‌رسد مگر کاربر دوباره Continue بزند

---

### ✅ RV-07 — `publishStatus` / read-back summary هرگز نمایش داده نمی‌شود

- **شرح:** بدون مرحله review، انتخاب وضعیت انتشار (`draft`/`active`) و خلاصه read-back (`denali-review-step`) در UI نیست
- **spec:** `docs/phase-11/denali-review-step.md` — Create باید footer مرحله review باشد

---

### ✅ RV-08 — heading review روی مراحل غیر-review

- **شرح:** `review.validationHeading` = «قبل از ایجاد تور این موارد را اصلاح کنید» روی basic/pricing هم render می‌شود (via `stepNavValidationIssues`)
- **UX:** کاربر فکر می‌کند submit fail شده در حالی که فقط Continue block شده

---

### ✅ RV-09 — `<title>` صفحه «توراپس» نه «ساخت تور / بازبینی»

- **Browser tab:** نامفهوم برای operator

---

### رفتار مثبت (لینک‌های فیلد)

- ✅ لینک «رفتن به فیلد … و اصلاح خطا» روی pricing/basic کار می‌کند (focus + scroll)
- ✅ label فارسی برای فیلدهای ساده (ارتفاع قله، حداکثر ظرفیت) درست resolve می‌شود
- ✅ گروه‌بندی «۲ مورد نیاز به اصلاح» نمایش داده می‌شود

---

### اولویت رفع

1. Inject مرحله `review` در host وقتی `usesReviewStep: true` (بعد از template steps)
2. انتقال دکمه «ساخت تور» به footer مرحله review
3. Fix i18n composite labels (`denali.fields.denali.*`)
4. پیام validation کاربرپسند به‌جای canonical path
5. Fix `capacityMax` object vs number در draft merge
6. نمایش پنل validation بلافاصله بعد از submit fail (نه فقط بعد از Continue)

**اسکرین‌شات:** `/tmp/review-step-screenshot.png` (در صورت اجرای E2E)  
**Playwright log:** `/tmp/review-step-hunt.log`

---

## خطاهای صفحه کاربران (/users) — جزئیات هم‌تیمی (Sheet) — ۱۴ ژوئن ۲۰۲۶

**محیط:** Dev `http://127.0.0.1:3000/users` — لاگین owner + مرورگر  
**مسیر تست:** `/users` → «جزئیات» → Sheet پایین صفحه (member detail)

### خلاصه

کاربر انتظار **مودال/دیالوگ** دارد؛ UI فقط **Bottom Sheet** دارد. در خطای API، پیام alert داخل sheet است ولی **بدون دکمه retry** و اغلب **خارج از viewport** (نیاز به scroll).

---

### ✅ USR-01 — جزئیات هم‌تیمی مودال نیست (Sheet پایین)

- **عمل:** کلیک «جزئیات» روی ردیف کاربر
- **انتظار:** Dialog/Modal مرکزی (طبق UX enterprise)
- **واقعیت:** `UsersMemberDetailSheet` — `Sheet side="bottom"` با `max-h-[85vh]`
- **Browser:** عنوان + تب‌های «فعالیت/سفرها» + Close — نه modal overlay مرکزی
- **فایل:** `apps/web/app/(app)/users/users-member-detail-sheet.tsx`

---

### ✅ USR-02 — خطای API در Sheet؛ بدون retry و بدون modal

- **تست:** intercept `role-history` / `booking-summary` → HTTP 500
- **نتیجه:** `role=alert` → «بارگذاری جزئیات هم‌تیمی ناموفق بود (خطای HTTP).»
- **مشکل:**
  - پیام فقط داخل sheet — **نه toast، نه modal خطا**
  - **دکمه «تلاش مجدد» وجود ندارد**
  - تب‌ها خالی می‌مانند؛ محتوایی نمایش داده نمی‌شود
- **کد:** `users-member-detail-sheet.tsx:62-64` — هر دو API باید ok باشند وگرنه throw

---

### ✅ USR-03 — Close و تب‌ها خارج از viewport (1080p)

- **Browser automation:** دکمه Close و تب «سفرها» ~۴۲۵px پایین‌تر از viewport
- **Scroll:** `Could not scroll element into view after 5 attempts`
- **تأثیر:** کاربر فکر می‌کند «چیزی نشون داده نمیشه» — sheet باز است ولی کنترل‌ها دیده نمی‌شوند

---

### ✅ USR-04 — Overlay Sheet کلیک تب‌ها را block می‌کند

- **شرح:** وقتی sheet باز است، تب «دعوت‌ها» → `pointer-events: none`
- **تأثیر:** ناوبری صفحه تا بستن sheet (Escape) غیرفعال

---

### ✅ USR-05 — پاداش «Modal» در واقع Card inline است

- **testId:** `operator-users-rewards-modal`
- **واقعیت:** `<Card>` در انتهای صفحه — **نه Dialog/Sheet**
- **تأثیر:** با scroll طولانی (ownership transfer پایین صفحه) کاربر پاداش را نمی‌بیند
- **فایل:** `users-page-client.tsx:917-1054`

---

### ✅ USR-06 — فرم دعوت inline Card نه modal

- **عمل:** «دعوت» → Card در body صفحه
- **مشکل:** با sheet/invite همزمان صفحه شلوغ؛ UX modal expected نیست

---

### ✅ USR-07 — API دعوت شماره نامعتبر می‌پذیرد

- **تست:** `POST /api/users/invite` با `"phone":"bad"` → **200 OK** + inviteId
- **تأثیر:** دعوت بی‌اعتبار در سیستم ثبت می‌شود؛ validation سمت client/server ضعیف

---

### ✅ USR-08 — تب دعوت‌ها: flash خالی هنگام loading

- **URL:** `/users?tab=pending`
- **Browser snapshot:** فقط header — بدون skeleton/empty تا fetch تمام شود
- **DOM:** empty state «دعوتی در انتظار نیست» وقتی API خالی برمی‌گرداند
- **تأثیر:** UX گیر کرده به نظر می‌رسد

---

### ✅ USR-09 — i18n تاریخچه: label خام انگلیسی

- **کد:** `resolveRoleLabel` برای `"rewards"` / `"updated"` → همان string انگلیسی
- **فایل:** `users-member-detail-sheet.tsx:97-99`

---

### ✅ USR-10 — وضعیت سفر (tripMeta) بدون ترجمه

- **فیلد:** `trip.status` در `memberDetail.tripMeta` — انگلیسی خام در UI فارسی

---

### ✅ USR-11 — مالک تنها عضو: actions محدود

- **Desktop:** فقط «جزئیات» — بدون پاداش/تعلیق/حذف (owner قابل manage نیست)
- **Bulk select:** checkbox disabled
- **Ownership transfer:** «هیچ ادمین یا عضو فعالی…»

---

### ✅ USR-12 — خطای جزئیات all-or-nothing

- **شرح:** `Promise.all([role-history, booking-summary])` — یکی fail → کل sheet fail
- **بهتر:** partial render (مثلاً trips حتی اگر history fail)

---

### رفتار مثبت

- ✅ Sheet با Escape بسته می‌شود
- ✅ پیام خطا فارسی: `USERS_MEMBER_DETAIL_HTTP_ERROR`
- ✅ API سالم: «هنوز فعالیتی ثبت نشده» + تب سفرها

---

### اولویت رفع

1. Member detail → Dialog/Modal یا Sheet با positioning در viewport
2. دکمه retry + toast on error
3. Partial load (history/trips مستقل)
4. Rewards واقعاً Dialog/Sheet
5. Validation شماره دعوت
6. i18n history/trip status

**Endpointها:** `/api/users/{id}/role-history` · `/api/users/{id}/booking-summary`

---

## Flat Edit تور (صفحه `/tours/[id]/edit` — فرم تخت، نه ویزارد)

**تاریخ:** 2026-06-14  
**محیط:** Web `http://127.0.0.1:3000` · API memory · Login `+989121000001` / OTP `1234`  
**فایل‌های کلیدی:**
- `apps/web/app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx`
- `apps/web/src/wizard/denali/denali-flat-edit-form.tsx`
- `apps/web/tests/e2e/denali-itinerary-wizard.spec.ts` (SMK-P9-ITIN-01)

**تورهای تست (multi-day draft، ساخته‌شده از ویزارد):**

| ID | عنوان |
|----|--------|
| `805c1407-84fc-405e-bb2e-577f977a5c94` | SMK-P9-ITIN-05 1781410929583 (تازه ساخته‌شده) |
| `2b3bf840-7d9f-44e9-becd-02ebf6bce649` | Review-Hunt-1781409899395 |
| `e70f055f-4d8a-46bb-9600-1d1ae30371c6` | SMK-P9-ITIN-05 1781409547791 |

**روش تست:** Playwright با BFF login + مرورگر Glass (OTP دستی) + اسکریپت audit

---

### ✅ FE-01 — Skeleton بی‌نهایت وقتی envelope آماده نیست (بحرانی)

- **شرح:** Guard در `denali-flat-edit-page-client.tsx:416-422` شرط `gate.loading || loading || !formReady` را **قبل از** branchهای `TOUR_NOT_FOUND` و error render می‌زند.
- **تأثیر:**
  - تور 404 یا خطای load → skeleton برای همیشه (نه پیام «یافت نشد»)
  - مرورگر روی `/tours/{id}/edit` با session ناقص: skeleton + badge «1 Issue»، بدون فرم
- **تأیید Playwright:** `GET /tours/00000000-0000-4000-8000-000000000999/edit` → بعد از 3s: `skeletons:2`, `notFound:false`
- **تأیید مرورگر:** اسکرین‌شات skeleton خالی روی edit URL

**پیشنهاد:** skeleton فقط برای `gate.loading || loading`؛ برای `error`/`TOUR_NOT_FOUND`/`detail===null` UI خطا نشان داده شود حتی اگر `envelope === null`.

---

### ✅ FE-02 — بارگذاری async قوانین Denali → فیلدهای اشتباه لحظه اول (بالا)

- **شرح:** `DenaliFlatEditForm` ماژول rules را async load می‌کند. تا قبل از load، `resolveDenaliDimensionsFromDraft` با `rules == null` → `{ category: "mountain", duration: "single_day" }` (`apply-contextual-render-plan.ts:16-17`).
- **تأثیر:** ~۰–۵۰۰ms اول فقط فیلدهای single-day (مثل `program.hikingGoHours`) دیده می‌شود؛ بعد itinerary و فیلدهای multi-day ظاهر می‌شوند.
- **تأیید:** `{ t0: 0, t500: 1 }` برای `[data-testid="denali-composite-itinerary"]` روی تور `805c1407…`
- **نکته:** بعد از settle (~۱s+) فرم کامل است (basic با مقصد/تاریخ، program با itinerary، logistics، pricing).

---

### ✅ FE-03 — ذخیره تغییرات: `AUTH_TOKEN_REVOKED` (401) (بالا)

- **عمل:** کلیک «ذخیره تغییرات» روی flat edit
- **نتیجه:** Alert: `tours.edit.errors.TOUR_ساخت تور ناموفق بود (401: AUTH_TOKEN_REVOKED)`
- **Server action:** `updateTourAction` — JWT/session_version mismatch نسبت به API
- **تأثیر:** کاربر نمی‌تواند تغییرات flat edit را persist کند (در dev با memory driver)

---

### ✅ FE-04 — پیام خطای save/publish دوبار ترجمه می‌شود (متوسط)

- **شرح:** `setSubmitError(tWizard("submit.errorGeneric", …))` متن **ترجمه‌شده** فارسی می‌گذارد؛ سپس `resolveTourErrorMessage(tErrors, submitError)` (`:414`) آن را دوباره با prefix `TOUR_` lookup می‌کند.
- **خروجی UI:** `tours.edit.errors.TOUR_قبل از ایجاد تور، فیلدهای مشخص‌شده را اصلاح کنید.` (کلید i18n خام)
- **فایل:** `resolve-tour-error-message.ts` + `denali-flat-edit-page-client.tsx:391,414`
- **پیشنهاد:** یا `submitError` را code نگه دارید، یا اگر already localized است `resolveTourErrorMessage` را skip کنید.

---

### ✅ FE-05 — لیست validation بدون لینک به فیلد (متوسط)

- **عمل:** «انتشار تغییرات» روی تور با itinerary ناقص
- **DOM:** `[data-denali-flat-edit-validation]` → `<li>عنوان روز الزامی است.</li>` (متن ساده)
- **مقایسه با ویزارد:** در review step ویزارد لینک scroll-to-field وجود دارد؛ flat edit فقط bullet list
- **تأثیر:** کاربر نمی‌داند کدام روز/segment را در فرم طولانی edit کند

---

### ✅ FE-06 — E2E SMK-P9-ITIN-01 fail: smoke tour در memory نیست (بالا / CI)

- **تست:** `denali-itinerary-wizard.spec.ts` → tour ID ثابت `00000000-0000-4000-8000-000000000210`
- **نتیجه:** `operator-tour-edit-section-denali_program` بعد از 60s visible نیست (skeleton/404)
- **علت:** `run-denali-dev-smoke-seed-once.ts` نیاز به `DATABASE_URL` دارد؛ با `STORAGE_DRIVER=memory` seed اجرا نمی‌شود
- **راه‌حل احتمالی:** seed in-memory برای smoke tour 210 یا ساخت تور در `globalSetup` قبل از ITIN-01

---

### ✅ FE-07 — داده itinerary روز ۳ ناقص (داده / validation)

- **API canonical** تور `805c1407…`:
  - روز ۳: `title: ""`
  - segment: `title: ""`
- **Publish validation:** «عنوان روز الزامی است.» + «حداقل یک رویداد با عنوان برای هر روز الزامی است.»
- **تأثیر:** تور wizard ساخته شده از SMK-P9-ITIN-05 با روز placeholder سوم publish نمی‌شود؛ flat edit itinerary را نشان می‌دهد ولی کاربر باید دستی scroll کند

---

### ✅ FE-08 — بخش‌های photos/logistics قبل از load rules خالی به نظر می‌رسند (پایین)

- **شرح:** در audit فوری (`domcontentloaded` + form visible) sections `denali_photos` و `denali_logistics` `childCount:0`
- **بعد از settle:** photos (تم‌ها)، logistics (حمل‌ونقل، …) پر می‌شوند
- **UX:** flash خالی یا audit زودهنگام گمراه‌کننده است — همان root cause FE-02

---

### ✅ FE-09 — مرورگر Glass: لیست تور خالی vs API (متوسط / session)

- **مرورگر:** `/tours` → «هنوز توری نیست» بعد از OTP
- **Playwright BFF login:** `GET /api/tours` → 3 تور
- **edit URL مستقیم در مرورگر:** skeleton بی‌نهایت (FE-01 + احتمال session/cookie ناقص)
- **تأثیر:** تست دستی در Glass بدون BFF login قابل اعتماد نیست

---

### رفتار مثبت (بعد از load کامل)

- ✅ 6 section flat edit: basic, photos, program, logistics, pricing, legal
- ✅ `denali-composite-itinerary` با 3 روز برای تور multi-day
- ✅ basic: دسته‌بندی، مقصد، تاریخ شروع/پایان، ظرفیت، راهنمای محلی
- ✅ SMK-P9-ITIN-05 (wizard create draft) pass در 28s
- ✅ Validation publish پیام فارسی درست (جدا از FE-04 wrapper)

---

### اولویت رفع

1. **FE-01** — جداسازی skeleton از error/not-found
2. **FE-03** — session propagation در server action (save/publish)
3. **FE-04** — fix double i18n روی submitError
4. **FE-06** — seed smoke tour 210 برای memory dev
5. **FE-02/08** — gate render تا rules + dimensions آماده (یا loading state صریح)
6. **FE-05** — لینک validation → فیلد (مثل wizard review)

**Endpointها:** `GET/PATCH /api/tours/{id}` · `updateTourAction` · `GET /api/settings/tour-wizard-template`


---

## تست چندتایی Flat Edit — Run 2 (2026-06-14)

**روش:** Playwright Chromium (session واقعی مرورگر + console/network) + Glass OTP  
**تورهای تست‌شده:** 3 draft multi-day + 1 ID نامعتبر

### جدول نتایج per-tour

| تور | عنوان | API | فرم | itinerary | Save | Publish validation |
|-----|--------|-----|-----|-----------|------|-------------------|
| `805c1407…` | SMK-P9-ITIN-05 1781410929583 | 200 | ✅ ~9s | ✅ (بعد ~1.5s) | ❌ 401 | روز/segment خالی |
| `2b3bf840…` | Review-Hunt-1781409899395 | 200 | ✅ ~8.7s | ✅ | ❌ 401 | همان |
| `e70f055f…` | SMK-P9-ITIN-05 1781409547791 | 200 | ✅ ~9.7s | ✅ | ❌ 401 | همان |
| `…0999` (invalid) | — | 404 | ❌ skeleton | — | — | — |

**Publish validation (هر 3 تور):**
- «عنوان روز الزامی است.»
- «حداقل یک رویداد با عنوان برای هر روز الزامی است.»

**Save alert (هر 3 تور):**
- `tours.edit.errors.TOUR_ساخت تور ناموفق بود (401: AUTH_TOKEN_REVOKED)`

---

### ✅ FE-10 — Console: `IntlError MISSING_MESSAGE` روی هر Save/Publish (بالا)

- **تأیید:** هر 3 تور — 6+ خطای console
- **متن:** `Could not resolve tours.edit.errors.TOUR_ساخت تور ناموفق بود (401: AUTH_TOKEN_REVOKED) in messages for locale fa`
- **علت:** FE-04 (`resolveTourErrorMessage` روی متن ترجمه‌شده)
- **تأثیر:** DevTools پر از IntlError؛ UI کلید i18n خام نشان می‌دهد

---

### ✅ FE-11 — زمان load بالا (~۸–۱۰ ثانیه) (متوسط)

- **اندازه‌گیری:** `domcontentloaded` → فرم visible: 8661–9662ms
- **تأثیر:** UX کند؛ احتمالاً draft sync + rules async + چند fetch موازی

---

### ✅ FE-12 — Flash اولیه: itinerary=0 با فرم visible (متوسط)

- **earlyAudit (هر 3 تور):** `itinerary: 0` در حالی که 6 section وجود دارد
- **بعد از ~1.5s:** `itinerary: 1`، program با 26 input
- **همان root cause FE-02** — rules/dimensions async

---

### ✅ FE-13 — تور 404: skeleton ~47s بدون پیام خطا (بحرانی)

- **URL:** `/tours/00000000-0000-4000-8000-000000000999/edit`
- **API:** 404 · **UI:** skeleton=2، form=false، notFound UI نیست
- **Console:** `Failed to load resource: 404` (×2)
- **تأیید FE-01** در سناریوی واقعی

---

### ✅ FE-14 — Glass OTP: session OK ولی tours خالی + edit skeleton (بالا)

- **مرورگر Glass** بعد از OTP `1234`:
  - `GET /api/auth/session` → `{ tenant_id: …0003, role: owner }` ✅
  - `GET /api/tours` → `{ count: 0 }` ❌
  - `GET /api/tours/805c1407…` → **404** ❌
  - Edit page → skeleton + «1 Issue»
- **Playwright `login-web-session`** (همان tenant): 3 تور، edit کامل ✅
- **تأثیر:** تست دستی Glass غیرقابل اعتماد؛ OTP UI vs BFF login رفتار متفاوت
- **احتمال:** cookie/JWT propagation بعد از OTP form login

---

### ✅ FE-15 — خطاهای مشترک هر 3 تور (خلاصه)

| # | خطا | همه تورها؟ |
|---|-----|-----------|
| Save 401 | AUTH_TOKEN_REVOKED | ✅ |
| i18n خراب | کلید `tours.edit.errors.TOUR_…` | ✅ |
| Publish block | itinerary روز ۳ خالی | ✅ |
| Validation بدون link | فقط `<li>` متن | ✅ |

---

### رفتار مثبت (Run 2 — BFF login)

- ✅ هر 3 تور: 6 section، 62 input کل
- ✅ basic 9 · program 26 · logistics 14 · pricing 8 · legal 3 · photos 2
- ✅ عنوان h1 درست برای هر تور

---

### اولویت (Run 2)

1. FE-01/13 — skeleton روی 404
2. FE-03/10 — save 401 + IntlError
3. FE-14 — OTP browser session vs BFF
4. FE-11 — بهینه load
5. FE-07/15 — itinerary روز ۳ + validation links

**لاگ:** `/tmp/multi-flat-edit-audit.log`


---

## ثبت‌نام مهمان توسط ادمین — جزئیات تور (Workspace + Register)

**تاریخ:** 2026-06-14  
**مسیرها:**
- جزئیات تور: `/tours/[id]/workspace` (تب ثبت‌نام‌ها)
- فرم ثبت‌نام: `/tours/[id]/register`
- فایل‌ها: `tour-workspace-layout-client.tsx` · `tour-workspace-registrations-client.tsx` · `tour-register-page-client.tsx` · `denali-flat-edit-page-client.tsx`

**تورهای تست:** 3 draft multi-day (`805c1407…`, `2b3bf840…`, `e70f055f…`)  
**Login:** BFF `login-web-session` + Glass OTP

---

### جدول نتایج (BFF login — Playwright)

| تور | Workspace | Register form | POST /api/bookings | Redirect | در لیست workspace |
|-----|-----------|---------------|-------------------|----------|-------------------|
| `805c1407…` | ✅ | ✅ | **201** pending | ✅ `/bookings?status=pending&tourId=…` | ✅ |
| `2b3bf840…` | ✅ | ✅ | **201** pending | ✅ | ✅ |
| `e70f055f…` | ✅ | ✅ | **201** pending | ✅ | ✅ |
| `…0999` invalid | — | «تور پیدا نشد» ✅ | — | — | — |

---

### ✅ TR-01 — دکمه «ثبت‌نام مهمان» در صفحه Edit Denali نیست (بالا)

- **مسیر:** `/tours/[id]/edit` (flat edit)
- **واقعیت:** فقط `operator-tour-edit-workspace` — **بدون** `operator-tour-edit-register`
- **مقایسه:** `TourEditTitlePageClient` دکمه register دارد؛ `DenaliFlatEditPageClient` ندارد
- **تأثیر:** از edit مستقیم نمی‌توان مهمان ثبت کرد؛ باید workspace برود
- **فایل:** `denali-flat-edit-page-client.tsx:459-468` vs `tour-edit-page-client.tsx:170-175`

---

### ✅ TR-02 — URL `/workspace/registrations` → 404 (متوسط)

- **تست:** `GET /tours/{id}/workspace/registrations` → **404** (هر 3 تور)
- **علت:** تب registrations در `hrefForWorkspaceTab` به `/workspace` root map می‌شود (`tour-workspace-logic.ts:12-14`)
- **تأثیر:** bookmark/link قدیمی یا حدس URL → صفحه Next.js 404
- **پیشنهاد:** redirect `/workspace/registrations` → `/workspace`

---

### ✅ TR-03 — جدول workspace فقط `pending` — بدون ستون وضعیت (متوسط)

- **Query:** `buildTourRegistrationsBookingsQuery` → `status=pending` ثابت
- **ستون‌ها:** مهمان · نفرات · حرکت · ثبت — **بدون وضعیت/لینk**
- **تأثیر:** بعد از approve در command center، ردیف از workspace ناپدید می‌شود؛ ادمین وضعیت را در جزئیات تور نمی‌بیند
- **فایل:** `tour-workspace-registrations-logic.ts:9-14` · `tour-workspace-registrations-client.tsx:112-118`

---

### ✅ TR-04 — testId تکراری/اشتباه روی لینک empty state (پایین)

- **کد:** empty state لینک «ثبت اولین مهمان» با `data-testid={TOUR_REGISTER_TEST_IDS.page}` (`operator-tour-register-page`)
- **تأثیر:** تداخل با testId صفحه register؛ E2E/automation گمراه می‌شود
- **فایل:** `tour-workspace-registrations-client.tsx:100`

---

### ✅ TR-05 — خطاهای HTTP خام بدون ترجمه i18n (متوسط)

- **Workspace 404:** UI → `tours.workspace.errors.TOUR_WORKSPACE_HTTP_404` (کلید خام — در `fa/tours.json` نیست)
- **Register submit fail:** `TOUR_REGISTER_HTTP_400` و مشابه — فقط `TOUR_REGISTER_FAILED` / `FETCH_FAILED` ترجمه شده
- **علت:** `resolveTourErrorMessage` + `throw new Error('TOUR_*_HTTP_${status}')` بدون key در messages
- **تأثیر:** پیام فنی/کلید خام برای اپراتور

---

### ✅ TR-06 — خطای submit فرم را مخفی می‌کند (متوسط)

- **شرح:** وقتی `setError(...)` بعد از submit fail، `resolveTourRegisterPageState` → `type: "error"` و **فرم render نمی‌شود**
- **تأثیر:** کاربر داده‌های واردشده را از دست می‌دهد؛ فقط Card خطا
- **فایل:** `tour-register-page-client.tsx:216-220` vs `222-318`

---

### ✅ TR-07 — ثبت‌نام روی تور `draft` مجاز است (سوال محصول)

- **تست:** POST booking روی تور پیش‌نویس → **201** pending
- **UI:** badge «پیش‌نویس» روی فرم register
- **تأثیر:** ممکن است intentional باشد؛ اگر نه باید validation سمت API/UI

---

### ✅ TR-08 — redirect موفق به `/bookings` نه workspace تور (UX)

- **بعد از submit:** `buildTourRegisterSuccessRedirect` → `/bookings?status=pending&tourId=…`
- **انتظار احتمالی:** بازگشت به `/tours/{id}/workspace` با ردیف جدید
- **واقعیت:** command center کلی — کاربر context تور را از دست می‌دهد

---

### ✅ TR-09 — Glass OTP: workspace/register تور 404 (بالا)

- **مرورگر Glass** (OTP، tenant `…0003`):
  - Workspace → `tours.workspace.errors.TOUR_WORKSPACE_HTTP_404` + empty «ثبت‌نام در انتظاری نیست»
  - Register → «تور پیدا نشد» + بازگشت به تورها
- **BFF login:** همان تور 200 + 5 registration در جدول
- **همان الگوی FE-14** — session/cookie OTP vs `login-web-session`

---

### ✅ TR-10 — API validation خالی: پیام UI نیست (پایین)

- **API:** `guestLabel: ""` → 400 `BOOKING_CREATE_INVALID`
- **UI:** HTML5 `required` روی نام — submit native block
- **Client:** `buildBookingCreatePayload` null → `TOUR_REGISTER_INVALID` (OK) ولی بدون field-level hint

---

### رفتار مثبت

- ✅ Workspace header + subnav (ثبت‌نام‌ها / waitlist / transport)
- ✅ دکمه «ثبت‌نام مهمان» در workspace layout
- ✅ فرم register: نام · نفرات · تاریخ (پrefill از departure تور) · email/phone اختیاری
- ✅ ثبت موفق → booking pending در API + نمایش در جدول workspace
- ✅ تور نامعتبر → «تور پیدا نشد» (BFF login)
- ✅ Member lock: gate `locked` برای `canManage=false` (unit test WEB-9.3-R03)

---

### اولویت رفع

1. **TR-01** — دکمه register در Denali flat edit
2. **TR-09** — OTP session / API tour 404 در Glass
3. **TR-02** — redirect `/workspace/registrations`
4. **TR-05** — i18n برای `TOUR_*_HTTP_*`
5. **TR-03** — نمایش approved + ستون وضعیت
6. **TR-06** — خطای submit بدون پنهان کردن فرم
7. **TR-08** — redirect به workspace (یا toast + refresh)

**Endpointها:** `GET /api/tours/{id}` · `POST /api/bookings` · `GET /api/bookings?status=pending&tourId=…`

**لاگ:** `/tmp/tour-register-audit.log`


---

## Fix batch 1 — 2026-06-14 (Flat Edit + Register/Workspace)

### Fixed
| ID | Fix |
|----|-----|
| FE-01/13 | Skeleton guard: show 404/error before `!formReady` infinite skeleton (`denali-flat-edit-page-client.tsx`) |
| FE-02/12 | Form renders only after `rulesModule !== null` (`denali-flat-edit-form.tsx`) |
| FE-03 | `updateTourAction` sends JWT from session cookie via `readSessionToken` + Bearer header |
| FE-04/10 | Stable error codes in submit; `resolveTourErrorMessage` skips re-translating pre-localized text |
| TR-01 | Register link on Denali flat edit (`operator-tour-edit-register`) |
| TR-02 | `/workspace/registrations` redirects to `/workspace` |
| TR-04 | Duplicate testId on registrations client fixed |
| TR-06 | Register form: separate `loadError` vs `submitError` with inline alert |
| TR-08 | Success redirect → `/tours/{id}/workspace` |
| TR-05 (partial) | i18n keys added fa/en for edit/register/workspace HTTP errors |

### Tests
- `resolve-tour-error-message.spec.ts`, `tour-edit-error-logic.spec.ts`, `tours-register.spec.ts` — pass
- Full `pnpm test` apps/web: 548 pass / 0 fail

### Still open
- FE-05 validation field links, FE-14/TR-09 OTP session empty `/api/tours`
- TR-03 status column / all statuses, TR-07 draft registration policy
- RV-*, USR-*, MD-* wizard/review/users batches

---

## Fix batch 2 — 2026-06-14 (Review step + Validation + Workspace registrations)

### Fixed
| ID | Fix |
|----|-----|
| RV-01/07 | `appendWorkspaceReviewStepToRenderPlan` injects Layer C `review` when `usesReviewStep` (tenant template omits review per INV-WIZ-002) |
| RV-06 | Submit validation issues now populate `stepNavValidationIssues` on non-review steps (panel visible after failed create) |
| RV-03 | `resolveDenaliValidationIssueLabel` maps composite ids (e.g. `denali.pricing-participants`) to section titles |
| FE-05 | Flat edit uses `DenaliReviewValidationSummary` + `createDenaliFieldFocusRegistry` for scroll-to-field links |
| TR-03 | Workspace registrations query shows all statuses; status column with `bookings.status` i18n |

### Files
- `wizard-template-gate-logic.ts` · `workspace-wizard-host.tsx`
- `denali-flat-edit-page-client.tsx` · `denali-field-focus-registry.ts` · `denali-validation-issue-label.ts`
- `tour-workspace-registrations-logic.ts` · `tour-workspace-registrations-client.tsx`
- `packages/workspaces/denali/src/index.ts` (export `DENALI_COMPOSITE_BY_CANONICAL_PATH`)

### Tests
- WEB-9.6-WIZ-09 review step injection
- `tour-workspace-registrations-logic.spec.ts` · `denali-validation-issue-label.spec.ts`

### Still open
- FE-14/TR-09 OTP Glass session vs BFF (tenant/seed — needs runtime verify)
- FE-06/07 smoke tour 210 + itinerary day 3 data
- TR-07 draft registration policy
- RV-04 canonical path messages (platform validation copy)
- RV-09 page title · USR-* · MD-*

---

## Fix batch 3 — 2026-06-14 (Validation UX + Dev seed + Users)

### Fixed
| ID | Fix |
|----|-----|
| RV-04/MD-14 | `localizeDenaliValidationIssueMessage` — پیام فارسی به‌جای canonical path در پنل validation |
| RV-05 | `coerceScalarFormValueForDraft` — `{}` / shell object برای capacityMax دیگر object در draft نمی‌ماند |
| RV-08 | heading جدا: `review.stepValidationHeading` برای Continue block vs `review.validationHeading` برای submit |
| RV-09/MD-12 | `<title>` صفحه `/tours/new` از `wizard.pageTitle` |
| MD-04/05 | `resolveDenaliFieldLabel` + composite map — `denali.destination` / `denali.datetime-end` دیگر `denali.fields.denali.*` نیست |
| FE-06/MD-01 | memory bootstrap: catalog + tour …0210 برای tenant Denali …000003 (`ensureDenaliDevSmokeSeedTour`) |
| USR-02/12 | Member detail: fetch مستقل history/trips + partial render |
| USR-03 | Sheet `side="right"` + scroll داخلی (viewport-friendly) |
| USR-09/10 | i18n event labels + `bookings.status` برای tripMeta |
| USR-02 | دکمه «تلاش مجدد» per-tab |

### Files
- `denali-localize-validation-message.ts` · `denali-review-validation-summary.tsx`
- `denali-wizard-labels.ts` · `denali-wizard-draft-sanitize.ts`
- `bootstrap-denali-dev-smoke-fixtures.ts` · `in-memory-tour.repository.ts` · `create-tour-storage.ts`
- `users-member-detail-sheet.tsx` · `tours/new/page.tsx`

### Tests
- `denali-localize-validation-message.spec.ts` · `denali-composite-field-label.spec.ts`

### Still open
- FE-14/TR-09 OTP Glass session (needs runtime verify after memory seed)
- FE-07 itinerary day 3 placeholder data
- TR-07 draft registration policy
- USR-01/05/06 modal UX (rewards/invite dialogs)
- USR-07 invite phone API validation
- MD-02/07/08/09/10/11/13 remaining wizard UX

---

## Batch 4 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| USR-07 | `inviteWorkspaceUser` validates phone via `isLoginMobileFormatValid` + `normalizeLoginMobile`; API returns 400 `PHONE_INVALID`; client maps to `USERS_INVITE_PHONE_INVALID` |
| USR-08 | Pending tab uses separate `pendingLoading` + `useLayoutEffect` so skeleton shows instead of empty flash |
| MD-07 | Seed banner only when draft `title` still matches `gate.seedLabel` |
| MD-13 | `altitudeM` wired through `parseCreateBodyForModule` → `createSettingsResource` → repos |
| TR-10 | Register form: `validateBookingCreateForm` + field-level `GUEST_REQUIRED` hint under guest name |

**Deferred (product / next batch):** TR-07 draft registration policy, FE-14/TR-09 OTP Glass session, MD-02/08/09/10/11 wizard UX, USR-01/05/06 modal UX

**Tests:** `identity-users.spec.ts` (API-9.4-04b), `settings-resources.spec.ts` (altitudeM), `users-directory.spec.ts`, `tours-register.spec.ts`

## Batch 5 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| MD-08 | `resolveMergedWizardStepIndex` — session جدید دیگر step قدیمی server را restore نمی‌کند؛ همیشه basic (0) |
| MD-09 | پاک کردن پیش‌نویس با `Dialog` confirm به‌جای `window.confirm` (Glass/Playwright-safe) |
| MD-02/11 | `workspace-wizard-host` — validation panel دیگر با re-render بی‌دلیل draft پاک نمی‌شود (`draftContentKey`) |
| USR-05/06 | فرم دعوت + پاداش در `Dialog` مرکزی به‌جای Card inline |
| FE-14 | lazy `ensureDenaliDevSmokeSeedTour()` هنگام ساخت singleton memory store |

**Already addressed earlier:** USR-09/10 (eventLabels + bookings.status در member detail sheet)

**Still open:** TR-07 draft registration policy, MD-10 pricing readonly checkboxes, FE-14/TR-09 runtime verify in Glass browser

## Batch 6 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| TR-07 | `resolveTourRegisterPageState` returns `draft_blocked` for `tourUiStatus === "draft"`; UI card + i18n fa/en + edit link; test WEB-9.3-R05 |
| USR-01/04 | Member detail refactored from bottom `Sheet` to centered `Dialog` — page tabs no longer blocked by overlay |
| FE-07 | `syncDenaliItineraryRows` scaffolds `Day N` / `Activity N` for new days; E2E fixture fills all visible itinerary days; test DN-ITIN-03b |
| MD-10 | Composite registry fields use `kind: "composite"` (INV-WIZ-002); `WizardField` no longer falls through to primitive boolean when composite surface is bound |
| FE-14/TR-09 | `ensureDevMemoryTourSeedForTenant` on `listToursOperator` (prior batch) — memory tenant …000003 gets seeded tours on list |

### Files
- `denali-plugin-adapter.ts` · `wizard-field.tsx`
- `denaliItineraryDaySchema.ts` · `denali-itinerary-wizard-fixture.ts`
- `tour-register-*` · `users-member-detail-sheet.tsx` · `messages/*/tours.json`

### Tests
- `@app-tour/workspace-denali`: 132 pass (incl. DN-ITIN-03b, composite registry)
- `apps/web`: 559 pass (incl. WEB-9.3-R05 draft_blocked gate)

### Still open / deferred
- **USR-11** sole-owner limited actions (product policy)
- **MD-03** multi-day manual create — verify after FE-07 E2E path
- **MD-11** minimum age required but Continue enabled — step validation audit
- **FE-14/TR-09** Glass OTP runtime smoke (needs manual verify)

## Batch 7 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| MD-11 | Per-step validation: `mergeDenaliStepRequiredFieldViolations` enforces required composite-anchor scalars (e.g. empty `participants.minimumAge`) after engine filter; composite dependents mapped in `DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR` |
| MD-02 | Same layer blocks Continue on multi-day when `endDateTime` empty — validation banner on pricing/basic step nav (WEB-P11-7-08) |
| USR-11 | `canEditUserRewards` — owner/admin can open rewards for own row; suspend/remove/role still gated by `canManageUserRow` |

### Files
- `denali-composite-anchors.ts` · `denali-wizard-validation.ts`
- `users-page-logic.ts` · `users-directory-table.tsx` · `users-directory-row-actions-sheet.tsx`

### Tests
- WEB-P11-7-07 / WEB-P11-7-08 (step validation)
- WEB-9.4-16 (sole-owner rewards)
- `apps/web`: 562 pass · `@app-tour/workspace-denali`: 132 pass

### Still open / deferred
- **MD-03** multi-day manual UI smoke (fixture path fixed in batch 6 — needs manual verify)
- **FE-14/TR-09** Glass OTP runtime smoke
- **USR-11** ownership transfer when sole member (product copy / invite flow)
- Production VPS errors (DB password, OTP) — infra not code

## Batch 8 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| FE-14/TR-09 | Dev memory seed on operator **GET** `/tours/:id` via `readTourById` + `ensureDevMemoryTourSeedForTenant(tenantId, canonicalStore)`; unwraps `TourStorageDbAdapter` → `InMemoryTourRepository` so tests and lazy-tours DI share the active store |
| FE-14/TR-09 | `ensureDenaliDevSmokeSeedTour` re-indexes smoke tour …0210 for tenant …000003 even when same id was indexed for another tenant (cross-tenant unindex) |
| USR-11 | Sole-owner ownership transfer empty state: `soleOwnerHint` + **Invite teammate** CTA opens invite Dialog (`ownershipTransferInvite` test id) |
| TR-05 | Workspace HTTP i18n: `TOUR_WORKSPACE_HTTP_401/403/500` fa/en |

### Files
- `create-tour-storage.ts` · `tour-storage.adapter.ts` · `in-memory-tour.repository.ts`
- `canonical-tour.service.ts` · `tours.service.ts` · `list-tours-operator.ts`
- `users-ownership-transfer-panel.tsx` · `users-page-client.tsx` · `messages/*/users.json` · `messages/*/tours.json`

### Tests
- `denali-dev-tour-seed.spec.ts` (API-9.3-03b)
- `tours-operator.spec.ts` (API-9.3-03 HTTP)
- `users-ownership-transfer.spec.ts` (ownershipTransferInvite test id)

### Still open / deferred
- **MD-03** multi-day manual UI smoke (E2E fixture path fixed batch 6 — manual verify)
- **FE-03** flat edit `AUTH_TOKEN_REVOKED` — dev session staleness; BFF cookie path already wired
- **FE-14/TR-09** Glass OTP runtime smoke (manual)
- Production VPS (DB password, OTP 500) — infra

## Batch 9 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| Catalog #3 | `shouldRedirectCatalogToMarketing` — localhost/127.0.0.1 بدون `MARKETING_PUBLIC_BASE_URL` دیگر redirect کور به shop:3002 نمی‌زند؛ UI `catalog-marketing-unavailable` |
| TR-05 | i18n `TOUR_WAITLIST_HTTP_*` + `TOUR_TRANSPORT_*_HTTP_*` fa/en |
| FE-03 | flat edit save: `TOUR_EDIT_AUTH_TOKEN_REVOKED` → redirect به `/auth/login?returnTo=…` |

### Tests
- WEB-MKT-05/06 (catalog redirect guard)
- API denali-dev-tour-seed (batch 8 carry-over)

### وضعیت کلی (پس از batch 1–9)

| دسته | کل | رفع‌شده (کد) | باز |
|------|-----|-------------|-----|
| FE flat edit | 15 | ~14 | FE-14 Glass OTP smoke |
| TR register/workspace | 10 | ~10 | — |
| RV review | 9 | ~9 | verify manual |
| MD multi-day | 14 | ~13 | MD-03 manual UI smoke |
| USR users | 12 | ~12 | — |
| TW wizard UX | 22 | ~8 | TW-03/04/10/13/15/17/18/20/21/22 (UX polish) |
| Production VPS | 2 | 0 | DB password + OTP 500 (infra) |
| Catalog/marketing | 1 | 1 | — |

**جمع تقریبی:** ~85 مورد ثبت‌شده → **~65 رفع کد** · **~2 infra** · **~18 UX/deferred/manual**

## Batch 10 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| TW-03 | `isWizardStepContinueBlocked` + `continueDisabled` on `WizardStepShell` — Continue غیرفعال تا per-step validation (`validateDraftSync`) pass شود |
| TW-08/MD-12/RV-09 | Root metadata `title.template: %s \| brand` — tab مرورگر «ساخت تور \| توراپs» |
| TW-15 | fa `guideLanguages.empty` — «تنظیمات → زبان‌های راهنما» (بدون Settings انگلیسی) |
| MD-04/05 | fa `destination.empty` — «تنظیمات → مقصدها و مناطق» |

### Tests
- WEB-WIZ-03-01..03 (step continue gate)
- denali package rebuild

### Still open / deferred
- **MD-03** E2E smoke (fixture آماده — نیاز اجرای Playwright)
- **FE-14/TR-09** Glass OTP runtime
- **TW-13/17/18/20/21/22** wizard polish
- Production VPS (infra)

## Batch 11 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| TW-18 | `collectDenaliRuleRequiredIssues` — conditionally required paths (e.g. `transport.dongAmount`) validated on **step** scope, not only submit (WEB-P11-7-09) |
| TW-20 | `getWizardTemplateConfig` — dev auto-seed published full template via `seedDenaliFullWizardTemplate` when missing/unpublished |
| TW-13 | Wizard draft autosave `debounceMs: 800` (create + flat edit) — fewer PATCH 409 races |
| TW-16 | Itinerary empty photos → CTA «رفتن به مرحله عکس‌ها» via `WizardStepNavigationProvider` |
| TW-22 | Dashboard quick actions `relative z-10` — CTA clickable above widget animate layers |

### Tests
- WEB-P11-7-09 (denali-rule-required-step)
- denali package rebuild

### Still open / deferred
- **MD-03** E2E Playwright smoke (fixture ready)
- **FE-14/TR-09** Glass OTP runtime
- **TW-17/19/21** lower-priority polish
- Production VPS (infra)

### وضعیت به‌روز (~batch 11)
**~72/85** رفع کد · **~11** UX/deferred · **2** infra

## Batch 12 fixes (2026-06-14)

| ID | Fix |
|----|-----|
| FE-14/TR-09 | `@app-tour/workspace-denali/composites` subpath export — wizard client graph دیگر root barrel (finance/node:crypto) را import نمی‌کند؛ webpack 500 روی `/api/auth/request-otp` رفع شد |
| FE-14 | Dev login: auto `requestOtp` + auto `login` وقتی phone/OTP از پیش پر شده (`login-form.tsx`) — Glass OTP همان مسیر BFF |
| TW-19 | دکمه «ذخیره پیش‌نویس» فقط هنگام `SYNCING`/`navLocked` غیرفعال — flush دستی همیشه ممکن |
| MD-03 | E2E fixture: `ensureWizardDateTime` (start/end)، fitness level اجباری pricing، `fillDenaliMultiDayWizardThroughReview` (Layer C review قبل Create)، sync/next helpers پایدارتر |
| MD-03 | **SMK-P9-ITIN-01..05** همه pass با `playwright.operator.config.ts` + external servers (~57s) |

### Files
- `packages/workspaces/denali/package.json` — export `./composites`
- `denali-field-focus-registry.ts` · `denali-validation-issue-label.ts` — subpath import
- `login-form.tsx` · `new-tour-wizard-client.tsx`
- `denali-itinerary-wizard-fixture.ts` · `denali-itinerary-wizard.spec.ts`
- `test/barrel-hunt.spec.ts` — WEB-DENALI-CLIENT-01

### Tests
- WEB-DENALI-CLIENT-01 (barrel hunt)
- SMK-P9-ITIN-01..05 (5/5 pass)

### Still open / deferred
- **TW-17** Leaflet map performance (low)
- **TW-21** a11y inputs (low)
- **Production VPS** DB password + OTP 500 (infra)

### وضعیت به‌روز (~batch 12)
**76/87** رفع کد · **8** UX/deferred · **3** infra VPS


---

## Batch 13 — TW-04/05/11/14/17/21, MD-06, FE-11 (2026-06-14)

### ✅ TW-04 / MD-06 — مقصد «در حال بارگذاری…»
- Server prefetch: `fetchWizardLocationsServer` در `app/(app)/tours/[id]/edit/page.tsx`
- Client: `DenaliWizardCatalogPrefetchProvider` روی flat edit + deduped `fetchDenaliDestinationCatalogClient`

### ✅ TW-05 — فقط یک مقصد
- `seedOperatorSmokeCatalog`: ۳ مقصد فعال برای tenant …000003 (توچال، دماوند، علم‌کوه) + `ensureDenaliDevSmokeDestinations` idempotent

### ✅ TW-11 — OTP ارقام فارسی / ترتیب
- `otp-segment-input.tsx`: digit capture در `onKeyDown` + focus همگام (بدون rAF race)

### ✅ TW-14 — اسلایدر سختی readonly
- `pointer-events: none` روی scale/ticks + `onInput` روی range slider
- `data-new-tour-wizard` روی flat edit برای skin یکسان

### ✅ TW-17 — ۴ Leaflet map
- `denali-location-point-editor`: `<details>` بسته پیش‌فرض؛ map فقط وقتی panel باز است (`mapEnabled`)

### ✅ TW-21 — a11y
- `htmlFor`/`aria-label` روی ۴ input برچسب نقطه مکان + gathering point name

### ✅ FE-11 — load بالا flat edit
- Bootstrap موازی: rules + template + tour + equipment + locations + themes در یک `Promise.all`

### Tests
- `wizard-template-server-prefetch.spec.ts` WIZARD-05/06
- `otp-segment-input.spec.ts` WEB-OTP-05
- `operator-smoke-catalog.spec.ts` API-11.0-03

### Checklist
- ⬜→✅ TW-04, TW-05, TW-11, TW-14, TW-17, TW-21
- ⬜→✅ MD-06
- ⬜→✅ FE-11
- ⬜ Infra VPS (OTP prod, PG password, tenant branding) — unchanged


---

## Batch 14 — ممیزی انتقادی + infra/batch13 تکمیل (2026-06-14)

### وضعیت واقعی پس از batch 13+14
| دسته | باز |
|------|-----|
| کد اپ (TW/MD/FE/RV/USR/TR) | **0** |
| Infra VPS (ops) | **2** — DB password + OTP وابسته به DB |

### ✅ Infra #4 — TENANT_HOST_UNKNOWN روی IP
- API: `resolvePublicTenantLabelFromIngressHost` + env `PUBLIC_TENANT_FALLBACK_LABEL/HOSTS`
- Web BFF: `TOUR_OPS_DEFAULT_TENANT_ID` + `TOUR_OPS_PUBLIC_FALLBACK_HOSTS` در login/catalog
- BFF `/api/public/tenant-branding` graceful fallback روی 404
- Deploy: `deploy/vps/env/*.example` + `scripts/vps-deploy/verify-db-env.sh`

### ✅ Infra #1/#2 — OTP + PostgreSQL (batch 15)
- OTP: `error-interceptor` → **503** `DATABASE_UNAVAILABLE` (نه opaque 500)
- PG: `remote-deploy.sh` → `verify-db-env.sh` → `sync-db-app-role-password.sh` → `/health` degraded probe

### ✅ FE-12 — flash itinerary=0
- `DenaliFlatEditForm` دیگر rules را دوباره load نمی‌کند؛ `denaliRulesModule` از page client

### batch 13 (تأیید در کد)
- TW-04/05/11/14/17/21 · MD-06 · FE-11 — همه در repo

### Tests batch 14
- `resolve-public-tenant-label-from-host.spec.ts` (API-PUBLIC-HOST-01..05)
- `resolve-public-host-fallback.spec.ts` (WEB-PUBLIC-HOST-01..02)

---

## Batch 15 — Infra #1/#2 enterprise hardening (2026-06-14)

### ✅ Infra #1 — OTP 500 → stable DATABASE_UNAVAILABLE
- `error-interceptor.ts`: Prisma auth / P1000 → **503** + code `DATABASE_UNAVAILABLE` (نه opaque 500)
- Web i18n: `messages/fa|en/auth.json` + `resolve-login-error` catalog

### ✅ Infra #2 — PostgreSQL password drift (deploy automation)
- `scripts/vps-deploy/sync-db-app-role-password.sh` — `ALTER USER app_tour` از `DATABASE_URL` با `DATABASE_URL_ADMIN`
- `remote-deploy.sh`: `verify-db-env.sh` قبل از migrate؛ auto-sync در صورت fail
- `verify-db-env.sh`: hint به sync script
- `health.routes.ts`: `/health` **503 degraded** وقتی `SELECT 1` روی prisma fail
- `health-check.sh`: لاگ body در صورت degraded

### Tests batch 15
- `database-connection-error.spec.ts` (API-DB-CONN-01..04)
- `database-unavailable-error-interceptor.spec.ts` (API-DB-CONN-05)
- `resolve-login-error.spec.ts` (DATABASE_UNAVAILABLE در catalog)

### Checklist نهایی
| دسته | باز |
|------|-----|
| کد اپ (TW/MD/FE/RV/USR/TR) | **0** |
| Infra VPS (ops one-time) | **0** — deploy script + health probe؛ روی VPS: `remote-deploy.sh` یا manual sync |

**وضعیت: 87/87** — همه آیتم‌های finderror با fix کد یا runbook ops بسته شد.

---

## Batch 16 — checklist sync + bootstrap prereqs (2026-06-14)

### ✅ finderror header هم‌خوان با batch 15
- چک‌لیست بالای فایل: **87/87** · Infra #1/#2 → ✅

### ✅ bootstrap-server.sh
- نصب `postgresql-client` + `python3` برای `verify-db-env` / `sync-db-app-role-password`
- log راهنما: verify قبل از deploy

### ✅ api.env.example
- comment: verify + auto-sync در `remote-deploy.sh`

---

## Batch 17 — post-deploy smoke + VPS gap (2026-06-14)

### ✅ smoke-operator-login.sh
- بعد از `health-check.sh` در `remote-deploy.sh`
- verify-db → `/health` (database ok) → BFF `POST /api/auth/request-otp`
- fail-closed: دیگر deploy «سبز» با OTP شکسته تمام نمی‌شود

### ⚠️ VPS هنوز روی origin/main قدیمی
- Probe `89.45.89.206:13000` → `OTP_REQUEST_FAILED` (کد batch 15 push نشده)
- **اقدام:** commit + push `main` → GitHub Actions deploy، یا manual `remote-deploy.sh` روی VPS
