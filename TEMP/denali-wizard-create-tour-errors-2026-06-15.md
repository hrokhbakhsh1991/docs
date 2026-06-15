# Denali — لیست خطاهای ساخت تور + ترتیب اجرا

**تاریخ ثبت:** 2026-06-15  
**محیط:** DEV `http://89.45.89.206:3000` (API `3001`) — همان سرور CI/CD  
**وضعیت:** E-01 رفع و تأیید شد (2026-06-15) — بقیه در صف  
**مسیر ویزارد:** `/tours/new`  
**لاگین smoke معتبر:** `+989121000001` / OTP `1234`

---

## خلاصه اجرایی

| دسته | تعداد | بلوکر ساخت تور |
|------|-------|----------------|
| زیرساخت / محیط | 5 | بله |
| لود ویزارد | 1 | بله |
| اپلود عکس | 7 | جزئی |
| اعتبارسنجی مرحله‌ای | 16 | بله (در submit) |
| review + error links | 8 | جزئی |
| submit نهایی | 5 | بله |
| **جمع** | **42** | — |

---

## ترتیب اجرا (فازبندی)

> قانون: هر فاز قبل از فاز بعدی باید قابل تست دستی در مرورگر باشد.  
> بعد از هر فاز: `GET /tours/new` → ویزارد لود → حداقل یک مرحله جلو/عقب.

### فاز 0 — پیش‌نیاز (بلوکر تست دستی)

| اولویت | ID | کار | فایل/محل کلیدی | معیار پذیرش |
|--------|-----|-----|----------------|-------------|
| P0.1 | E-01 | ~~رفع گیر کردن «در حال بارگذاری ویزارد workspace…»~~ ✅ **رفع شد** | `apps/web/src/wizard/workspace-wizard-host.tsx`, `apps/web/app/tours/new/new-tour-wizard-client.tsx` | `[data-workspace-wizard]` ظاهر شود؛ مرحله `denali_basic` در ≤۵ ثانیه |
| P0.2 | E-02 | فعال‌سازی MinIO در DEV | `apps/api/.env`, `docker-compose` / `pnpm infra:up` | `POST /api/tours/wizard-photos` → `201` (نه `503 MINIO_NOT_CONFIGURED`) |
| P0.3 | E-03 | بالا آوردن MinIO در production (همان سرور) | `/etc/app-tour/api.env`, docker | `docker ps` سرویس minio؛ آپلود روی پورت `13001` موفق |
| P0.4 | E-04 | هم‌خوان کردن شماره لاگین dev | `apps/web/.env.local`, `apps/api/.env.local` (`OPERATOR_OWNER_MOBILE`) | شماره نمایش‌داده‌شده در UI در BFF هم `200` بدهد |
| P0.5 | E-05 | رفع UI لاگین (دکمه «ارسال رمز») | `apps/web/app/auth/login/` | کلیک روی دکمه → مرحله OTP بدون fetch دستی |

---

### فاز 1 — اپلود عکس (مشکل اصلی گزارش‌شده)

| اولویت | ID | کار | فایل/محل کلیدی | معیار پذیرش |
|--------|-----|-----|----------------|-------------|
| P1.1 | E-06 | رفع `MINIO_NOT_CONFIGURED` در مسیر BFF → API | `apps/api/src/tours/tour-wizard-photos.routes.ts` | آپلود JPEG از UI بدون خطا |
| P1.2 | E-07 | پیش‌نمایش بعد از آپلود (`storageKey` → signed URL) | `denali-photo-preview.tsx`, `denali-photo-upload-client.ts` | thumbnail بعد از آپلود نمایش داده شود |
| P1.3 | E-08 | UX موفقیت آپلود (نه فقط متن «ذخیره در object storage») | `denali-photos-field.tsx` | کاربر ببیند عکس آپلود شده |
| P1.4 | E-09 | بررسی `Input type=file` در ui-primitives | `denali-photos-field.tsx` | file picker در Chrome/Firefox پایدار |
| P1.5 | E-10 | پیام خطای واضح برای URL غیر HTTPS | `denali-photos-field.tsx`, schema `file-asset` | `http://` پیام فارسی واضح |
| P1.6 | E-11 | تست E2E واقعی آپلود عکس | `test/fixtures/denali-itinerary-wizard-fixture.ts` | fixture عکس آپلود کند یا MinIO mock |
| P1.7 | E-12 | جداسازی UX: `themeIds` از مرحله photos | `denaliFullWizardTemplate.ts` | کاهش سردرگمی اپراتور |

---

### فاز 2 — اعتبارسنجی و عبور از مراحل

| اولویت | ID | کار | مرحله | معیار پذیرش |
|--------|-----|-----|-------|-------------|
| P2.1 | E-13 | `category` — انتخاب نوع تور | denali_basic | Continue فعال بعد از انتخاب |
| P2.2 | E-14 | `title` اجباری | denali_basic | خطای واضح اگر خالی |
| P2.3 | E-15 | `destinationId` اجباری | denali_basic | combobox مقصد فعال |
| P2.4 | E-16 | `startDateTime` اجباری | denali_basic | date/time picker کار کند |
| P2.5 | E-17 | `endDateTime` برای multi-day | denali_basic | تست MD-02 |
| P2.6 | E-18 | `capacityMax` اجباری | denali_basic | — |
| P2.7 | E-19 | `peakHeight` برای mountain | denali_basic | — |
| P2.8 | E-20 | `program.shortDescription` اجباری | denali_photos | بدون آن به program نرود |
| P2.9 | E-21 | `program.difficultyLevel` | denali_program | — |
| P2.10 | E-22 | `program.hikingHoursApprox` | denali_program | — |
| P2.11 | E-23 | `program.itinerary` برای multi-day | denali_program | E2E SMK-P9-ITIN-02 |
| P2.12 | E-24 | `transport.mode` اجباری | denali_logistics | — |
| P2.13 | E-25 | `transport.dongAmount` (personal car) | denali_logistics | تست TW-18 |
| P2.14 | E-26 | `participants.minimumAge` | denali_pricing | تست MD-11 |
| P2.15 | E-27 | `participants.fitnessLevel` | denali_pricing | — |
| P2.16 | E-28 | `pricing.basePricePerPerson` (اگر پرداخت فعال) | denali_pricing | — |

---

### فاز 3 — مرحله review و error handling

| اولویت | ID | کار | فایل/محل کلیدی | معیار پذیرش |
|--------|-----|-----|----------------|-------------|
| P3.1 | E-29 | inject مرحله `review` توسط host | `workspace-wizard-host.tsx` | مرحله آخر `review` با پنل بازبینی |
| P3.2 | E-30 | `publishStatus` اجباری | template + validation | بدون انتخاب وضعیت submit نشود |
| P3.3 | E-31 | نگاشت step برای composite violations | `wizard-field-step-resolver.ts` | لینک `denali.destination` به basic |
| P3.4 | E-32 | یکسان‌سازی resolver در submit و review | `new-tour-wizard-client.tsx` | focus یکسان |
| P3.5 | E-33 | رفع گروه `unknown` در validation summary | `group-validation-issues-by-step.ts` | label فارسی مرحله |
| P3.6 | E-34 | `focusWizardField` برای composite paths | `denali-field-focus-registry.ts` | scroll به فیلد |
| P3.7 | E-35 | پایداری banner خطا | `workspace-wizard-host.tsx` | خطا تا رفع فیلد بماند |
| P3.8 | E-36 | `DenaliReviewValidationSummary` | `denali-review-validation-summary.tsx` | لیست کامل + لینک‌ها |

---

### فاز 4 — submit نهایی و ساخت تور

| اولویت | ID | کار | فایل/محل کلیدی | معیار پذیرش |
|--------|-----|-----|----------------|-------------|
| P4.1 | E-37 | پیام‌های فارسی همه publish violations | `denali-wizard-validation.ts`, i18n | submit fail خوانا |
| P4.2 | E-38 | هشدار به‌جای silent drop در catalog sanitize | `denali-wizard-catalog-sanitize.ts` | گزارش حذف leader/theme/gear |
| P4.3 | E-39 | itinerary photo refs شکسته | `sanitizeItineraryPhotoIdsOnDraft` | ref نامعتبر در UI دیده شود |
| P4.4 | E-40 | E2E end-to-end SMK-P9-ITIN-05 | `tests/e2e/denali-itinerary-wizard.spec.ts` | تور draft ساخته شود |
| P4.5 | E-41 | Playwright webServer / base URL | `playwright.config.ts` | ۵ تست بدون Invalid URL |

---

## ثبت کامل خطاها (مرجع)

### A — زیرساخت

- **E-01** ~~ویزارد روی loading گیر می‌کند~~ ✅ **رفع شد** — preloaded plugin + render plan همگام (`useMemo`)
- **E-02** MinIO DEV → `503 MINIO_NOT_CONFIGURED`
- **E-03** MinIO prod: env هست، docker نیست
- **E-04** `+989190082452` در UI ولی API فقط `+989121000001`
- **E-05** دکمه «ارسال رمز» در UI به OTP نمی‌رود

### B — اپلود عکس

- **E-06** آپلود فایل fail در DEV
- **E-07** پیش‌نمایش خالی با storageKey
- **E-08** UX بدون thumbnail
- **E-09** file input روی ui-primitives
- **E-10** URL فقط HTTPS
- **E-11** photos در rules اجباری نیست
- **E-12** themeIds روی مرحله photos

### C — اعتبارسنجی مراحل

- **E-13** تا **E-28** — فیلدهای اجباری هر مرحله (جدول فاز 2)

### D — Review و error links

- **E-29** تا **E-36** — review inject، publishStatus، لینک خطا، focus

### E — Submit

- **E-37** تا **E-41** — publish validation، sanitize، E2E

---

## چک‌لیست تست نهایی

- [ ] لاگین از UI
- [x] `/tours/new` ویزارد ≤۵s (E-01)
- [ ] همه مراحل تا review
- [ ] آپلود عکس + preview
- [ ] submit ناقص → لیست خطا + لینک
- [ ] submit کامل → تور ساخته شود
- [ ] Playwright 5/5 سبز

---

*ثبت از audit 2026-06-15 — بدون fix اعمال‌شده*
