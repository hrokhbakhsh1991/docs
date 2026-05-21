# Denali 6-tab wizard — rollout and legacy compatibility

مرجع اجرا: [`map-phase.md`](../../map-phase.md) فاز ۸ · نگاشت فیلد: [`denali-wizard-field-mapping.md`](./denali-wizard-field-mapping.md)

## فعال‌سازی ویزارد

| مسیر | شرط |
|------|-----|
| Subdomain `denali.{root}` | `NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD=1` در production (در dev اگر env خالی باشد، پیش‌فرض روشن است) |
| تم با `formProfile: denali_pilot` | همیشه rail ۶ تب (مستقل از flag) |
| `wizardMode: "denali"` | همیشه (تست / override صریح) |

تابع مرجع: `denaliSixTabWizardTenantGatingEnabled()` در `apps/web/lib/config/feature-flags.ts` و `isDenaliWizardContext()` در `apps/web/src/features/tours/wizard/isDenaliWizardContext.ts`.

## Rollback

برای بازگشت موقت tenant `denali` به ویزارد ۹ گام کلاسیک:

```bash
NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD=0
```

تم‌های `denali_pilot` همچنان rail Denali را نگه می‌دارند؛ برای rollback کامل تم‌ها را به profile دیگر تغییر دهید یا flag را روی محیط staging آزمایش کنید.

## تورهای قدیمی (بدون `denaliTourKind`)

- **خواندن:** API همان `tripDetails` JSONB را برمی‌گرداند؛ فیلدهای جدید (`overview.denaliTourKind`, `logistics.privateCarMode`) اختیاری هستند.
- **نمایش جزئیات:** پنل trip فقط فیلدهای موجود را نشان می‌دهد؛ نبود `denaliTourKind` خطا ایجاد نمی‌کند.
- **ویرایش / کپی:** اگر `formProfileSnapshot` یا تم `denali_pilot` باشد، inverse mapper از `tourType` + تاریخ‌های logistics نوع Denali را حدس می‌زند (`transformTourToDenaliWizardValues.ts`). تورهای ساخته‌شده با profile قدیمی (`mountain_outdoor` روی tenant denali) از مسیر clone کلاسیک ۹ گام استفاده می‌کنند مگر snapshot به `denali_pilot` مهاجرت شده باشد.
- **ایجاد جدید:** فقط از ویزارد ۶ تب (وقتی rail فعال است)؛ payload از `mapDenaliWizardToCreateTourPayload` و strip `denali_pilot` در سرور.

## Provisioning

```bash
pnpm --filter @apps/api migrate:run
pnpm --filter @apps/api qa:denali:provision
# اختیاری — کاتالوگ مقصد و تجهیزات:
pnpm --filter @apps/api qa:denali:enrichment
```

Production: پس از deploy وب، `NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD=1` را روی محیط Denali ست کنید.

## تست

| لایه | دستور |
|------|--------|
| Unit (web) | `cd apps/web && node --import tsx --test src/features/tours/wizard/schemas/denaliTourCreateSchema.spec.ts src/features/tours/clone/transformTourToDenaliWizardValues.spec.ts` |
| Unit (api) | `cd apps/api && node --import tsx --test src/modules/tours/utils/assert-create-tour-invariants.spec.ts` |
| Integration e2e | `pnpm --filter @apps/web qa:integration:wizard-submit-denali` (نیاز به API + `PW_REAL_STACK=1`) |
| Smoke shell | `PW_BASE_URL=http://denali.localhost:3000 pnpm --filter @apps/web exec playwright test -c playwright.smoke.config.ts tests/smoke/10-denali-wizard-shell.spec.ts` |
| API probe | `pnpm --filter @apps/api probe:tour-create -- --slug=denali` (API در حال اجرا) |

## سایر workspaceها

`ws*-rbac`, `urban-demo`, `mix-demo` و غیره بدون تغییر از ویزارد ۹ گام کلاسیک استفاده می‌کنند مگر تم workspace به `denali_pilot` تنظیم شود (غیرمعمول).
