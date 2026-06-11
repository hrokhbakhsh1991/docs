# لیست موقت — اصلاح استایل ویزارد Denali (فازبندی)

> **وضعیت:** باز — 2026-06-10  
> **دامنه:** `/tours/new` · Wizard Bridge · `packages/workspaces/denali/theme/wizard-*.css` · `apps/web/src/wizard/**`  
> **مرجع قرارداد:** [`docs/workspaces/denali/wizard-experience.md`](../docs/workspaces/denali/wizard-experience.md) · DEC-P9-007 · DEC-P9-013  
> **مرجع تم admin (مشترک):** [`docs/workspaces/denali/admin-experience.md`](../docs/workspaces/denali/admin-experience.md)  
> **وضعیت تم فعلی:** core skin ~۹۸٪؛ **مشکلات زیر مانع «production polish» هستند**

---

## خلاصه اجرایی

| لایه | وضعیت | یادداشت |
|------|--------|---------|
| BEM composites (`denali/*.tsx`) | ✅ | بدون Tailwind در rendererها |
| `wizard-skin` / stepper / fields CSS | ⚠️ | popover تقویم scoped اشتباه |
| i18n pickers (`LocalizedDate*`) | ❌ | shadcn + Tailwind داخل ویزارد |
| Wizard Bridge chrome | ⚠️ | theme toggle shadcn |
| `globals.css` fallback | ⚠️ | duplicate با Denali stepper |

**تخمین کل:** ۴ فاز · ~۳–۵ روز کاری (بدون Playwright visual baseline)

---

## راهنمای اولویت

| برچسب | معنی | شروع |
|-------|------|------|
| **P0** | قرارداد شکسته / رنگ اشتباه در production / CSS مرده | فاز ۱ |
| **P1** | ناسازگاری stack / نگهداری / UX محسوس | فاز ۲–۳ |
| **P2** | RTL، جزئیات، polish اختیاری | فاز ۴ |

| نماد | معنی |
|------|------|
| ⬜ | باز |
| 🔄 | در حال کار |
| ✅ | انجام شده |
| ⏭️ | معوق عمدی |

---

## فاز ۱ — P0: تقویم، دارک‌مود، portal (مسدودکننده بصری)

**هدف:** تاریخ/ساعت در ویزارد همان teal Denali را نشان دهد؛ popover از Portal درست استایل بگیرد.

| ID | وضعیت | آیتم | مشکل | فایل‌های هدف | پذیرش / تست |
|----|--------|------|------|--------------|-------------|
| WZ-P0-01 | ✅ | **استایل popover تقویم خارج از `[data-new-tour-wizard]`** | Radix Portal به `body` می‌رود؛ قوانین scoped اعمال نمی‌شوند | `wizard-fields.css` یا `wizard-calendar.css` · سلکتور: `body[data-workspace-plugin="denali"] [data-radix-popper-content-wrapper] …` | دستی: dark/light روی `denali.localhost/tours/new` — روز انتخاب‌شده teal نه آبی |
| WZ-P0-02 | ✅ | **حذف/جایگزینی selector مرده `button[data-selected="true"]`** | `Calendar` از `aria-pressed` + کلاس `bg-primary` استفاده می‌کند | `wizard-fields.css` L79–82 · `calendar.tsx` | `denali-wizard-theme.spec.ts` — assert selectorهای جدید |
| WZ-P0-03 | ✅ | **هم‌ترازی دارک primary برای popover** | re-bind فقط روی `[data-new-tour-wizard]`؛ popover بیرون است | `wizard-skin.css` + popover rules · mirror `admin-skin` dual cascade | `WEB-DENALI-WIZARD-*` + smoke wizard |
| WZ-P0-04 | ✅ | **`data-testid` / attribute روی popover برای تست** | قرارداد تست فعلی فقط فایل CSS را می‌خواند | `popover.tsx` یا `calendar.tsx` — `data-denali-wizard-calendar` | spec جدید در `denali-wizard-theme.spec.ts` |

**خروجی فاز ۱:** تقویم در light/dark با `#0f766e` / `#5eead4`؛ هیچ قانون CSS مرده برای date picker.

---

## فاز ۲ — P0/P1: یکپارچه‌سازی stack (datetime + bridge)

**هدف:** کاهش shadcn/Tailwind داخل مسیر ویزارد؛ هم‌خانواده با `ui-primitives`.

| ID | وضعیت | آیتم | مشکل | فایل‌های هدف | پذیرش / تست |
|----|--------|------|------|--------------|-------------|
| WZ-P1-01 | ✅ | **BEM layout برای `LocalizedDatetimePicker`** | `grid`, `sm:grid-cols`, `space-y-2`, `text-muted-foreground` | `localized-datetime-picker.tsx` · `wizard-fields.css` (`.denali-wizard-datetime`) | گسترش `WEB-DENALI-WIZARD-08` به `components/i18n/localized-datetime-picker.tsx` وقتی داخل wizard |
| WZ-P1-02 | ✅ | **زمان: `PrimitiveLocalizedNumericInput` به‌جای shadcn** | `LocalizedTimeInput` از Shadcn `LocalizedNumericInput` استفاده می‌کند | `localized-datetime-picker.tsx` | فیلدهای start/end datetime در ویزارد |
| WZ-P1-03 | ✅ | **Theme toggle مخصوص Bridge (primitive یا BEM)** | `OperatorThemeToggleButton` = shadcn در header primitive | `wizard-bridge-shell.tsx` · `wizard-skin.css` | visual: دکمه toggle هم‌خانواده با `wizard-bridge-shell__back` |
| WZ-P1-04 | ✅ | **خواندن/نوشتن ترجیح تم (اختیاری P1)** | state اولیه `false` → flash light | `operator-theme-toggle-button.tsx` یا bridge variant | بدون flash در hard refresh |
| WZ-P1-05 | ✅ | **پل توکن صریح primitives روی `[data-new-tour-wizard]`** | `--color-surface` / `--color-border` فقط از cascade بالادست | `wizard-skin.css` | inspect: input/select همان surface/card ویزارد |

**خروجی فاز ۲:** datetime + bridge بدون Tailwind/shadcn در مسیر بحرانی ویزارد (تقویم popover استثنای مستندشده می‌ماند تا فاز ۱ green شود).

---

## فاز ۳ — P1: UX بصری و کاهش شلوغی

**هدف:** فرم بلند خواناتر؛ کمتر «جعبه در جعبه».

| ID | وضعیت | آیتم | مشکل | فایل‌های هدف | پذیرش / تست |
|----|--------|------|------|--------------|-------------|
| WZ-P1-06 | ✅ | **کاهش تودرتوی photos** | `section` + `__panel` + `__photo-card` = سه border | `denali-photos-field.tsx` · `wizard-fields.css` | ۲ ستونه بدون قاب سنگین |
| WZ-P1-07 | ✅ | **Gear catalog → list compact** | هر آیتم یک `__panel` جدا؛ لیست بلند شلوغ | `denali-gear-field.tsx` · الگوی `__list-item` | هم‌ترازی با `custom-services` |
| WZ-P1-08 | ✅ | **Stepper: تمایز `upcoming`** | فقط current/complete استایل دارند | `wizard-stepper.css` | موبایل: scroll pills خوانا |
| WZ-P1-09 | ✅ | **سلسله‌مراتب heading** | `gathering-points` عنوان با `<p>`؛ itinerary `h4` هم‌اندازه `__title` | composites مربوطه | a11y outline معقول |
| WZ-P1-10 | ✅ | **استایل `input[type=file]`** | native file input در photos | `wizard-fields.css` | هم‌خوان با `ui-primitives` input |

**خروجی فاز ۳:** صفحات steps پرحجم (gear، photos، itinerary) حرفه‌ای‌تر و یکدست.

---

## فاز ۴ — P2: RTL، نگهداری، تست، معوق

**هدف:** بستن گوشه‌ها؛ آماده‌سازی برای visual regression.

| ID | وضعیت | آیتم | مشکل | فایل‌های هدف | پذیرش / تست |
|----|--------|------|------|--------------|-------------|
| WZ-P2-01 | ✅ | **RTL فلش «بازگشت به تورها»** | `ArrowRight` بدون `rtl:rotate-180` | `wizard-bridge-shell.tsx` | `fa` locale manual |
| WZ-P2-02 | ✅ | **Dedup `globals.css` vs `wizard-stepper.css`** | دو منبع stepper | `globals.css` · doc در `wizard-experience.md` | Urban/starter fallback حفظ شود |
| WZ-P2-03 | ✅ | **`data-wizard-step-state` تنها SoT** | هر دو `data-step-state` و `data-wizard-step-state` | `wizard-step-shell.tsx` · globals | migrate + grep صفر برای قدیمی |
| WZ-P2-04 | ✅ | **Map preview polish** | `__map` 12rem ثابت؛ iframe بدون loading | `denali-map-preview.tsx` | skeleton اختیاری |
| WZ-P2-05 | ✅ | **انیمیشن step — ملایم‌تر یا opt-out** | fade کل step هر navigation | `wizard-interactions.css` | `prefers-reduced-motion` OK؛ بررسی UX |
| WZ-P2-06 | ⬜ | **Playwright visual snapshot baseline** | در `admin-experience` معوق | `tests/smoke/denali-wizard.spec.ts` | ⏭️ تا Architect YES |
| WZ-P2-07 | ⬜ | **framer-motion page transitions** | معوق در roadmap admin | — | ⏭️ |

**خروجی فاز ۴:** RTL + نگهداری CSS؛ visual baseline اختیاری.

---


## فاز ۴b — Hardening زیرساخت (پس از بازبینی enterprise)

| ID | وضعیت | آیتم |
|----|--------|------|
| WZ-P2-08 | ✅ | HTTPS-only photo URL (`denaliFileAssetSchema` + UI) |
| WZ-P2-09 | ✅ | UUID wizard session (`createDenaliWizardDraftSessionId`) |
| WZ-P2-10 | ✅ | Lazy Denali composites (`next/dynamic`) |
| WZ-P2-11 | ✅ | heading/a11y + gear `__error` |

## وابستگی بین فازها

```text
فاز ۱ (popover + dark)
    ↓
فاز ۲ (datetime BEM + bridge toggle + tokens)
    ↓
فاز ۳ (UX composites)
    ↓
فاز ۴ (RTL + dedup + tests)
```

فاز ۲.WZ-P1-01 می‌تواند موازی با فاز ۱ شروع شود؛ **WZ-P0-01 باید قبل از release بصری datetime کامل شود.**

---

## مستندات (Doc-First)

| تغییر | سند |
|-------|-----|
| popover / calendar scope | `docs/workspaces/denali/wizard-experience.md` § Date picker |
| datetime BEM | همان + جدول data attributes |
| bridge theme toggle | `wizard-experience.md` § Wizard Bridge |
| dedup globals | `wizard-experience.md` § Platform fallback |

پس از هر فاز:

```bash
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs \
  --test test/denali-wizard-theme.spec.ts

PW_EXTERNAL_SERVERS=1 PLAYWRIGHT_BASE_URL=http://denali.localhost:3000 \
  pnpm exec playwright test -c playwright.operator.config.ts -g "SMK-P9-WIZARD-THEME"
```

---

## چک‌لیست بستن (Definition of Done)

- [x] فاز ۱ — تقویم light/dark teal؛ CSS مرده حذف
- [x] فاز ۲ — datetime بدون Tailwind در layout؛ bridge toggle primitive
- [ ] فاز ۳ — photos/gear/stepper UX
- [ ] فاز ۴ — RTL back + globals dedup
- [ ] `wizard-experience.md` به‌روز با data attributes جدید
- [ ] `denali-wizard-theme.spec.ts` ≥ ۱۰ تست سبز

---

## پیوست — نگاشت مشکل → ID

| مشکل (ممیزی 2026-06-10) | ID |
|-------------------------|-----|
| shadcn در bridge + datetime | WZ-P1-01 … WZ-P1-03 |
| popover خارج scope | WZ-P0-01 |
| selector `data-selected` مرده | WZ-P0-02 |
| dark primary فقط روی page root | WZ-P0-03 |
| globals duplicate stepper | WZ-P2-02 |
| photos triple border | WZ-P1-06 |
| gear wall of panels | WZ-P1-07 |
| upcoming step بی‌تمایز | WZ-P1-08 |
| RTL back arrow | WZ-P2-01 |
| file input native | WZ-P1-10 |
