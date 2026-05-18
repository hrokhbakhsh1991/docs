Execution Plan: Multi-Tenant Tour Wizard — Denali
۱. ساخت Tenant و User اولیه

هدف: اطمینان از این که tenant دنالی و یوزر مالک (01234567890) درست تعریف شده‌اند.

Tasks
ثبت tenant:
tenantId = "denali"
name = "Denali"
تعریف ماژول‌ها: tour_form_builder, finance، سایر ماژول‌های لازم
ثبت یوزر owner:
userId = "01234567890"
role = owner
assign tenant denali
تست دسترسی:
ورود با یوزر owner
بررسی توانایی ایجاد تور جدید و دسترسی به Wizard
Observability setup:
فعال کردن NEXT_PUBLIC_TOUR_PROFILE_OBSERVABILITY=1 برای tenant دنالی در staging

Outcome: Tenant دنالی و user owner آماده و دسترسی‌ها درست هستند.

۲. آماده‌سازی Wizard دنالی (tenant-specific MVP)

هدف: Wizard فعلی برای دنالی آماده شود بدون تغییر ساختار فرم فعلی.

Tasks
Namespace:
LocalStorage draft: tour-create-wizard-draft-v1:denali
React Query keys tenant-aware: settingsTourThemesKeys.list(tenantId)
Validation:
Zod + ProfileRules طبق baseProfile دنالی (mountain_outdoor, general یا mix)
Step checks:
همه stepها (Basic Info, Theme, Capacity, Location, Itinerary, Participation, Logistics, Policies, Review) ظاهر صحیح و مرتب
اطمینان از proper visibility با getVisibleWizardStepsForProfile(denali)
Draft handling:
بازیابی و save در tenant-specific namespace
Clear draft on tenant switch/logout
Autosave optimization:
FieldGroup level autosave
Payload کوچک با patch
Theme & Presets:
Load tenant-specific catalog
Sync theme step و preset با tenant
Clone tours:
Verify clone works correctly tenant-aware
Submit:
POST /api/v2/tours tenant-aware
Verify stripCreateTourDtoForFormProfile و assertCreateTourInvariants

Outcome: Wizard دنالی functional و tenant-specific، فرم‌ها مناسب MVP هستند.

۳. زیرساخت TenantWizardTemplate

هدف: ایجاد پایه template قابل توسعه برای همه tenants آینده

Tasks
Database/JSON row:
{
  "tenantId": "denali",
  "baseProfile": "mountain_outdoor",
  "stepOverrides": {
    "skip": [],
    "insert": []
  },
  "fieldRulesOverlay": {},
  "presetId": null,
  "wizardContractVersion": "v1"
}
Runtime:
Wizard دنالی روی template overlay اعمال شود
هیچ step جدید کدنویسی نشود
Versioning:
formProfileVersion, wizardContractVersion مدیریت شود
Tenant-specific patches:
فقط overrideهای minimal برای دنالی، بقیه template خالی بماند

Outcome: Template پایه آماده، overlay دنالی minimal و امن است

۴. هماهنگی Template و Wizard دنالی

هدف: هماهنگی بین Wizard فعلی و Template ایجاد شود

Tasks
Runtime:
Wizard دنالی = compose(wizardStepEngine.getStepsForProfile(baseProfile), template.stepOverrides)
Rules = merge(BASE_FIELD_RULES, template.fieldRulesOverlay)
Field visibility:
FieldGate روی همه stepها (Capacity, Itinerary, Location, Policies) اطمینان حاصل شود
Draft & cache:
فقط tenant دنالی را target کند
Observability:
Wizard دنالی گزارش stepها و validation errors را ارسال کند

Outcome: Wizard دنالی کاملاً با template هماهنگ و آماده تست می‌باشد

۵. مدیریت تمپلیت و تم

هدف: تصمیم‌گیری درباره استفاده از تم و template موجود در settings

Tasks
بررسی تم‌ها:
اگر تم‌ها tenant-specific هستند، همین‌ها استفاده شود
اگر global هستند، tenant overlay اعمال شود
Template:
اگر tenant دنالی نیاز به تغییر stepها یا fieldها دارد، فقط patch اعمال شود
Copy تورهای ساخته‌شده:
بررسی اگر مسیر Wizard و فرم‌ها tenant-aware هستند، نیازی به تغییر نیست
در غیر اینصورت، migration script برای update

Outcome: تم و template فعلی دنالی مناسب استفاده در Wizard هستند

۶. تست و QA

هدف: مطمئن شدن از عملکرد صحیح Wizard دنالی و Template پایه

Tasks
Draft:
ذخیره و بازیابی tenant-aware
Steps:
همه stepها مطابق profile دنالی نمایش داده شوند
Submit:
API tenant-aware
Strip/Validation درست کار کنند
Clone:
تورهای موجود دنالی clone شود بدون مشکل
Presets & Theme:
Load صحیح tenant-specific
Observability:
Submit errors correlated با x-request-id
Step timing و wizard events گزارش شوند

Outcome: Wizard دنالی و Template پایه بدون مشکل، آماده استفاده و توسعه tenants بعدی

۷. Roadmap برای tenants بعدی
هر tenant جدید:
ایجاد TenantWizardTemplate جدید
BaseProfile tenant-specific انتخاب شود
Step overrides و field overlay minimal
Wizard دنالی یا جدید runtime روی overlay اعمال شود
هیچ کد جدید Wizard لازم نیست
Draft و cache tenant-aware باشند