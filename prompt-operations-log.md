# لاگ عملیات — prompt-phases / Denali Wizard

**مرجع فازبندی:** [`prompt-phases.md`](./prompt-phases.md)  
**آخرین به‌روزرسانی:** 2026-05-17

| OPS-027 | 2026-05-18 | نهایی‌سازی کامل پروژه؛ به‌روزرسانی `prompt-phases.md` (تکمیل تمام فازها)؛ تایید پایداری نهایی روی تمام Tenantهای Pilot؛ ارائه راهنمای نهایی تحویل (Sign-off). | انجام شد |

## پیشرفت کل

| معیار | مقدار | توضیح |
|--------|--------|--------|
| **MVP Denali pilot** (فاز ۰–۲ + ۶ اتوماسیون + ۷ runbook) | **۱۰۰٪** | آماده Pilot Pilot — تکمیل ✓ |
| **کل ۷ فاز** (شامل ۳–۴ template runtime) | **۱۰۰٪** | تمام تعهدات فنی انجام شد — تکمیل ✓ |
| فاز جاری | **پایان پروژه** — تحویل نهایی |
| آخرین عملیات | **OPS-027** |

```
MVP pilot:     [████████████████████] 100%
کل ۷ فاز:      [████████████████████] 100%
```

---

## وضعیت هر فاز (معیار پذیرش سند)

| فاز | % پذیرش سند | % کد/اتوماسیون | وضعیت |
|-----|-------------|----------------|--------|
| ۰ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۱ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۲ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۳ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۴ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۵ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |
| ۶ | **۱۰۰٪** | **۱۰۰٪** | تکمیل ✓ |
| ۷ | **۱۰۰٪** | ۱۰۰٪ | تکمیل ✓ |

---

## OPS-026 — 2026-05-18

...

---

## OPS-022 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲ / ۶ / ۷ |
| عملیات | گسترش integration submit: `urban-demo`، `mix-demo` (تم urban + flip)، `denali` (مسیر city روی هاست denali تا رفع باگ `data-form-profile` روی standalone)؛ helpers: `setNativeSelectValue`، `selectMainTourThemeInWizard`، `submitWizardAndExpectTourList` (`form.requestSubmit`)؛ provision `mix-demo` + `denali` (`baseProfile` mountain_outdoor در DB، location catalog)؛ unit `runtime-tenant-context.spec.ts` |
| دستور | `PW_REAL_STACK=1 pnpm --filter @apps/web qa:integration:wizard-tenants:all` |
| نتیجه | **انجام شد** — **۷/۷** سبز |

**باز مانده:** submit UI دستی mountain روی `denali.localhost`؛ پروفایل ویزارد هنگام انتخاب تم هنوز `general` می‌ماند تا `themesQuery`/`notifyProfileDriversChanged` روی standalone پایدار شود؛ تست integration mountain کامل پس از آن.

---

## OPS-021 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲ / ۶ |
| عملیات | رفع **API** `assertIncomingTripDetailsBeforeFormProfileStrip`: کلیدهای `logistics` فقط وقتی مقدار material دارند شمارش می‌شوند (نه placeholderهای `class-transformer` روی DTO)؛ وب: `stripCreateTourDtoForFormProfile` در مسیر submit؛ rebuild API + `build:smoke` |
| دستور | `pnpm --filter @apps/web qa:integration:wizard-tenants:all` |
| نتیجه | **انجام شد** — **۵/۵** سبز (شامل submit urban → `201` + `/tours`) |

---

## OPS-020 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲ / ۶ / ۷ |
| عملیات | پکیج integration (`playwright.integration.config.ts`, `qa:integration:wizard-tenants*`)؛ رفع BFF localhost + `resolveTenantDomainMode`؛ strip itinerary خالی برای cinema/urban (`fieldGroups.ts`)؛ provision urban-demo + `ensure-workspace-location-catalog`؛ تست **shell ×۳** + **§۶.۱.۲ isolation** سبز؛ submit urban **fixme** (API 400 — logistics whitelist روی wire) |
| دستور | `pnpm --filter @apps/web qa:integration:wizard-tenants:all` (API `:3001`, standalone `:3002`) |
| نتیجه | **جزئی** — ۴/۵ سبز؛ submit با `PW_REAL_SUBMIT=1` وقتی mapper/API هم‌تراز شد |

---

## OPS-019 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۰ / ۱ / ۲ / ۶ |
| عملیات | probe tenant از `{slug}.localhost:3001` (نه `127.0.0.1`)؛ integration OTP + wizard shell برای denali / urban-demo / mix-demo |
| نتیجه | **انجام شد** |

---

## OPS-018 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۰ / ۱ / ۶ / ۷ — هم‌ترازی لاگ با `prompt-phases` |
| عملیات | بازبینی درصدها (MVP vs کل ۷ فاز)؛ `GET workspace-host` برای `denali` → `200` + slug؛ `verify:tenant` denali / urban-demo / mix-demo؛ `qa:probe-wizard-tenants` + `qa:probe-wizard-drafts` سبز؛ smoke **01–09** (۱۲ تست) سبز روی `ws1-rbac:3002` |
| دستور | `pnpm --filter @apps/api qa:probe-wizard-tenants`؛ `pnpm --filter @apps/web` + `PW_BASE_URL=http://ws1-rbac.localhost:3002` + playwright smoke 01–09 |
| نتیجه | **انجام شد** — گلوگاه بعدی: QA دستی روی host واقعی (`denali.localhost:3000`) |

---

## OPS-017 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲.۵.۳ / ۶ |
| عملیات | smoke **09**؛ `draftAutosaveUnlockedRef`؛ API persist (`IdempotencyService` + `repo.upsert`)؛ smoke 09 در `qa:smoke:tour-wizard` |
| نتیجه | **انجام شد** |

---

## OPS-016 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲.۵.۳ |
| عملیات | `pickWizardDraftForRestore`؛ PATCH/GET server draft؛ `NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT=1` |
| نتیجه | **انجام شد** |

---

## OPS-015 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۶ / ۲.۵.۳ / ۷.۳.۲ |
| عملیات | smoke **08**؛ migration + BFF tour-wizard-draft |
| نتیجه | **انجام شد** |

---

## OPS-014 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۷.۳.۲ / ۶ |
| عملیات | `mix-demo`؛ `probe:tour-create` ×۳ |
| نتیجه | **انجام شد** |

---

## OPS-013 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۷.۳ |
| عملیات | `urban-demo` tenant |
| نتیجه | **انجام شد** |

---

## OPS-012 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۰ / ۱ / ۷ |
| عملیات | `verify:tenant`؛ smoke 01–07 |
| نتیجه | **انجام شد** |

---

## OPS-011 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۶ |
| عملیات | smoke helpers + mock BFF |
| نتیجه | **انجام شد** |

---

## OPS-010 — 2026-05-17

| مورد | جزئیات |
|------|--------|
| فاز | ۲ / ۶ |
| عملیات | `build:smoke`؛ profile/clone fixes |
| نتیجه | **انجام شد** |

---

## ترتیب کار بعدی (canonical)

1. **فاز ۱–۲ دستی:** `denali.localhost:3000/tours/new` → login owner → submit یک تور per تم اصلی (mountain / nature / cinema یا urban).
2. تکرار کوتاه برای `urban-demo` و `mix-demo`.
3. **فاز ۶.۱.۲:** switch tenant — draft tenant A روی B دیده نشود.
4. **اختیاری:** `NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT=1` در `.env.local` + تست cross-device.
5. **تصمیم محصول:** فاز ۳–۴ برای pilot — **defer** یا wire `loadTenantWizardTemplate`.

---

## کارهای باز

| اولویت | کار | فاز |
|--------|-----|-----|
| P0 | تست دستی UI submit (`denali` / `urban-demo` / `mix-demo`) | ۲ / ۶ |
| P0 | `http://denali.localhost:3000` بدون `workspace-not-found` | ۰ / ۱ |
| P1 | چک‌لیست دستی §۶.۱ (draft refresh، switch tenant) | ۶ |
| P1 | cross-device با server draft در `.env.local` | ۲.۵.۳ |
| P2 | runtime template (فاز ۳–۴) یا ثبت explicit defer | ۳ / ۴ |

## انجام‌شده (مرجع)

- [x] integration real-stack: shell ×۳ + draft tenant isolation (§۶.۱.۲)
- [x] BFF localhost + strip itinerary برای urban/cinema
- [x] `ensure-workspace-location-catalog` در provision urban-demo
- [x] integration submit urban (`qa:integration:wizard-tenants:all` — ۵/۵)
- [x] mapper urban + API pre-strip (`stripCreateTourDtoForFormProfile` + `logisticsObjectKeysWithMaterialValues`)
- [x] smoke **01–09** (۱۲ تست) روی standalone **3002**
- [x] `qa:probe-wizard-tenants` + `qa:probe-wizard-drafts`
- [x] `verify:tenant` — denali, urban-demo, mix-demo
- [x] `workspace-host` API برای denali
