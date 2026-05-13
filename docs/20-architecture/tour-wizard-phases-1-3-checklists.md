# چک‌لیست‌های اجرایی — فازهای ۱، ۲ و ۳ (`prompt.md` §۱۴)

دو لیست زیر برای **پیگیری محصول/مهندسی** کنار هم قرار گرفته‌اند:  
**لیست الف** = فاز ۱ + فاز ۲ (زیرساخت پروفایل و رجیستری گروه‌ها) · **لیست ب** = فاز ۳ (موتور UX ویزارد).

---

## لیست الف — فاز ۱ (Form Profile) + فاز ۲ (Field group registry)

| # | کار | وضعیت | یادداشت / مسیر کد |
|---|-----|--------|-------------------|
| 1 | ستون `form_profile` + مهاجرت DB | انجام | `apps/api/.../migrations/*WorkspaceTourThemesFormProfile*` |
| 2 | اعتبارسنجی API (CRUD تم) | انجام | DTOها + `tour-themes-settings.service` |
| 3 | انتخاب پروفایل در UI ایجاد/ویرایش تم | انجام | `apps/web/.../tour-themes/tour-theme-form.tsx` |
| 4 | resolve پروفایل در ویزارد + context | انجام | `tourWizardProfileResolve.ts`, `TourWizardProfileContext.tsx` |
| 5 | نشان (badge) پروفایل در ویزارد | انجام | `TourCreateWizard.tsx` — اختیاری: محدود کردن به dev با feature flag در آینده |
| 6 | نسخهٔ `formProfileVersion` در پیش‌نویس/کلون | انجام | `tourWizardDraftEnvelope.ts`, wrapper کلون |
| 7 | ماژول **`fieldGroups.ts`**: شناسهٔ گروه‌ها، متادیتا، نقشهٔ گروه → ریشه‌های RHF | انجام | `apps/web/src/features/tours/wizard/fieldGroups.ts` |
| 8 | نقشهٔ **`profile` → گروه‌های غیرفعال** (و فعال) در کد | انجام | همان فایل؛ هم‌تراز با `tour-wizard-field-groups.md` §۶ |
| 9 | کمک‌کنندهٔ **ریشه‌های فرم برای strip** (آمادهٔ فاز ۴) | انجام | `inactiveTourCreateRootKeysForProfile()` در `fieldGroups.ts` |
| 10 | تست واحد: هر پروفایل حداقل `basic_info` فعال دارد | انجام | `fieldGroups.spec.ts` |
| 11 | یک منبع حقیقت برای **گام‌های مخفی** ویزارد از رجیستری گروه | انجام | `fieldGroups.ts` (`getSkippedWizardStepsForProfile` + `getVisibleWizardStepsForProfile`؛ re-export در `tourWizardStepPlan.ts`) |

**خروج فاز ۱ (طبق سند):** تم‌ها پروفایل معتبر دارند؛ تغییر اختیاری «بدون تغییر UI در prod» با واقع فعلی پروژه ممکن است نادیده گرفته شده باشد (ویزارد الان پروفایل‌محور است).

**خروج فاز ۲ (طبق سند):** رجیستری در کد + تست؛ هنوز **Zod pick/omit پویا** و **strip قبل از DTO** در فاز ۴ می‌آید.

---

## لیست ب — فاز ۳ (Wizard step engine / UX)

| # | کار | وضعیت | یادداشت |
|---|-----|--------|---------|
| 1 | جایگزینی ریل ثابت با **`visibleSteps` وابسته به پروفایل** | انجام | `getVisibleWizardStepsForProfile` + `TourCreateWizard` |
| 2 | منبع حقیقت مشترک: **پروفایل → گام‌های حذف‌شده** از رجیستری گروه | انجام | `fieldGroups.ts` + `tourWizardStepPlan.ts` |
| 3 | **اعتبارسنجی سازگار با پروفایل** وقتی گام لجستیک/برنامه پنهان است | بخشی | پرچم `tourCreateValidationPolicy.ts`: استراحت «حداقل یک روز برنامه» برای سینما/شهری + اجبار نبودن `primaryTransportMode` برای `urban_event` |
| 4 | گام پوستهٔ **«Theme Details»** (`theme`) بعد از `basic` + کامپوننت `ThemeDetailsStep` | انجام | `stepConfig.ts`, `ThemeDetailsStep.tsx`, `TourCreateWizard.tsx` |
| 5 | پرش گام وقتی **کاتالوگ تم فعال خالی** است (بدون صفحهٔ خالی) | انجام | `pruneWizardStepsWithoutActiveThemes` در `fieldGroups.ts` |
| 5b | حذف گام وقتی **همهٔ triggerهای گام** به ریشه‌های فرم غیرفعال پروفایل می‌رسند | انجام | `getVisibleWizardStepsForProfile` → `isWizardStepRedundantForInactiveTourRoots` + `stepTriggerFields`؛ تست `fieldGroups.spec.ts` |
| 5c | Smoke Playwright برای بارگذاری `/tours/new` بدون خطای سرور | انجام | `apps/web/tests/smoke/tour-wizard-new.spec.ts`؛ `data-testid="tour-create-wizard"` روی `TourCreateWizard` |
| 6 | پرش خودکار گام وقتی **هیچ فیلد فعالی** در آن گام نیست (بر پایهٔ گروه، عمومی) | انجام | `isWizardStepRedundantForProfile` در `fieldGroups.ts` (v1: برای `urban_event` / `cinema_event` گام `capacity` حذف می‌شود چون triggerها فقط `pricing.basePrice` + `logistics.groupSize*` هستند در حالی که UI این پروفایل‌ها آن فیلدها را در گام capacity رندر نمی‌کند)؛ تست‌ها در `fieldGroups.spec.ts` |
| 7 | **فیلمنامهٔ QA** به تفکیک هر پروفایل | **بخشی:** اسکریپت `pnpm qa:tour-wizard-smoke` (ریشهٔ monorepo) چند smoke ویزارد را اجرا می‌کند؛ پوشش کامل per-profile هنوز دستی/گسترش‌پذیر است. |
| 8 | **آنالیتیکس** نرخ تکمیل گام‌ها | **بخشی:** رویدادهای DOM `tour_wizard_analytics` (`wizard_step_view` / `wizard_step_next`) از `emitTourWizardAnalytics`؛ اتصال به محصول/آداپتر اختیاری است. |

**خروج فاز ۳ (طبق سند):** برای ship فعلی کافی است؛ آیتم **۶** بسته شد؛ گسترش **۷–۸** هنوز می‌تواند عمیق‌تر شود (اسکریپت smoke + اتصال آنالیتیکس محصول).

---

## ارجاع سریع

| موضوع | فایل |
|--------|------|
| رجیستری گروه + پروفایل | `apps/web/src/features/tours/wizard/fieldGroups.ts` |
| گام‌های قابل مشاهده (+ فیلتر trigger) | `fieldGroups.ts` (`getVisibleWizardStepsForProfile`)؛ re-export `tourWizardStepPlan.ts` |
| Smoke ویزارد | `apps/web/tests/smoke/tour-wizard-new.spec.ts` |
| پرچم اعتبارسنجی پروفایل | `apps/web/src/components/tours/wizard/schemas/tourCreateValidationPolicy.ts` |
| گام `theme` + prune کاتالوگ خالی | `apps/web/src/components/tours/wizard/steps/ThemeDetailsStep.tsx`، `fieldGroups.ts` (`pruneWizardStepsWithoutActiveThemes`) |
