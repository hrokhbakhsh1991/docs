# Denali Wizard Draft Systemic Fixes: Architectural Blueprint (Revised)

## 1. عارضه‌یابی خط لوله ترانسپورت (Transport Blindness & Gateway Crashes)
### ریشه‌یابی ساختاری:
در متد `patchWorkspaceDraftSnapshot`، اجرای بدون قید و شرط `await response.json()` قبل از بررسی `if (!response.ok)` باعث می‌شود که تمام ارورهای زیرساختی لایه Gateway (مثل HTML 502/504) منجر به بروز `SyntaxError` شوند. این امر ارورهای واقعی HTTP را مخفی کرده و سیستم را نسبت به وضعیت شبکه نابینا می‌کند. همچنین عدم مدیریت لغو (Abort) درخواست‌های قدیمی در پنجره دبانس، ریسک پاسخ‌های موازی زامبی را بالا می‌برد.

### راهکار انترپرایز برای پیاده‌سازی (Phase 1):
1. **اصلاح لایه ترانسپورت PATCH:** متد `PATCH` باید دقیقاً مانند `GET` ابتدا وضعیت `response.ok`، خطای ۴۰۹ و عدم تایید را بررسی کند. پارس کردن جی‌سان فقط در صورتی انجام می‌شود که `Content-Type` حاوی `application/json` باشد، در غیر این صورت خطای صریح `WORKSPACE_DRAFT_PATCH_FAILED:${status}` پرتاب می‌شود.
2. **مدیریت AbortController در زمان Push:** کپسوله‌سازی ابورت نباید صرفاً در زمان ادیت کلاینت باشد (تا گپ ۵۰۰ میلی‌ثانیه‌ای دبانس را پوشش دهد). مکانیسم ابورت باید در `create-workspace-draft-adapter.ts` و دقیقاً در زمان متد `onPush` (شلیک فچ) مدیریت شود تا درخواست‌های موازیِ در جریانِ شبکه لغو شوند.

---

## 2. دیکتاتوری کلیدهای سطح اول و تخریب متقابل (Root-Key Merge Clobbering)
### ریشه‌یابی ساختاری:
تابع `mergeDenaliWizardDraftEnvelope` یک `Shallow Spread` ساده روی کلیدهای سطح اول `form.data` انجام می‌دهد. این امر باعث دو باگ متقارن می‌شود: حذف کل روت‌های سرور در صورتSparse بودن کلاینت (Clobber)، و زنده شدن زامبی‌وار روت‌هایی که کاربر عمداً روی کلاینت حذف کرده است (Resurrection).

### راهکار انترپرایز برای پیاده‌سازی (Phase 1):
1. **ادغام سطح دوم برای روت‌های دنالی:** برای هر روتِ کانونی که در هر دو سمت (لوکال و سرور) وجود دارد، ادغام یک لایه عمیق‌تر می‌رود (تا سطح فیلدهای مستقیم لایه دوم روت) و اولویت تصادم با لوکال خواهد بود تا فیلدهای خواهر (Siblings) تخریب نشوند.
2. **معماری تومبستون با `meta.deletedRoots`:** برای جلوگیری از مسمومیت جی‌سان اصلی (Poisoning)، روت‌های حذف شده توسط کاربر به صورت یک آرایه متنی به آدرس `meta.deletedRoots: string[]` منتقل می‌شوند. در زمان مرج ۴۰۹، اگر روتی در این آرایه باشد، سرور حق احیای زامبی‌وار آن را ندارد.

---

## 3. مدیریت استیت وضعیت خطا و لوپ‌های فانی (State Accumulation Contract)
### ریشه‌یابی ساختاری:
وضعیت `ERROR` در انجین به شدت فرار است؛ با اولین کی‌استروک استیت به `DIRTY` تغییر یافته و ارور پاک می‌شود. دیسایبل کردن عمیق فیلدها کاربر را در بن‌بست (Deadlock) قرار می‌دهد چون جلوی ثبت ادیت جدید برای خروج از ارور را می‌گیرد. از طرفی دکمه Save در استیت `ERROR` عملاً `no-op` است.

### راهکار انترپرایز برای پیاده‌سازی (Phase 2):
1. **قفل نرم لایه هاست (Soft-locking Banner):** فیلدها هرگز دیسایبل نمی‌شوند تا دیتای محلی انباشته شود. یک بنر غیرمسدودکننده در هاست وضعیت را شفاف می‌کند: "تغییرات شما به صورت محلی ذخیره شد؛ همگام‌سازی با سرور موقتاً قطع است".
2. **اصلاح منطق دکمه‌ها:** زمانی که استیت دقیقاً در حالت `ERROR` زیرساختی است، دکمه اصلی روی `retry()` فوکوس دارد. با اولین تغییر کاربر و کوچ استیت به `DIRTY`، دکمه به سیستم خودکار دبانس یا دستی `Save` هدایت می‌شود تا تناقض رفتاری فلاش حل شود.

---

## 4. مسمومیت زبانی در لایه ولیدیشن (Validation i18n Leak)
### ریشه‌یابی ساختاری:
رشته‌های هاردکد شده فارسی یا انگلیسی از لایه پلتفرم بدون عبور از سیستم مترجم کلاینت (`next-intl`) رندر می‌شوند که مرزهای چندزبانی اپلیکیشن را نقض می‌کند. چک کردن لترال استرینگ‌ها نیز به شدت شکننده است.

### راهکار انترپرایز برای پیاده‌سازی (Phase 2):
* **نگاشت ساختاری بر اساس `code`:** پنل‌های نمایش خطا (مانند `DenaliReviewValidationSummary`) باید پیام‌ها را بر اساس کدهای ساختاری موجود در ویولیشن‌ها (مثل `REQUIRED_FIELD_EMPTY` یا `CANONICAL_TYPE_MISMATCH`) به فایل‌های ترجمه متصل کنند:
  `t(\`validation.\${code}\`, { field: label })`
  استرینگ‌های هاردکد شده فعلی صرفاً به عنوان Fallback نهایی عمل خواهند کرد.

---

## 5. مدیریت خروج ناگهانی کاربر (Lifecycle Visibility Flush)
### ریشه‌یابی ساختاری:
در حال حاضر رها کردن یا بستن ناگهانی تب مرورگر در پنجره ۵۰۰ میلی‌ثانیه‌ای دبانس، منجر به حذف بی‌صدای آخرین تغییرات کاربر می‌شود.

### راهکار انترپرایز برای پیاده‌سازی (Phase 3):
* **هوک اختصاصی لایف‌سایکل:** توسعه هوک `useDraftVisibilityFlush` که با گوش دادن به رویداد `visibilitychange` یا `pagehide` مرورگر، در صورتی که استیت انجین `DIRTY` باشد، فوراً دیتای سانیتایزشده را فلاش کند. برای سازگاری با رفتارهای مدرن مرورگرها، اکستنشن ترانسپورت باید قابلیت ارسال با پرچم `keepalive: true` در `fetch` را پشتیبانی کند.

---

## 6. بستن برنامه و Definition of Done (Phase 4 — Closure)

### ریشه‌یابی:
پس از پیاده‌سازی فازهای ۱–۳، شکاف‌های merge-readiness باقی مانده بود: flat edit هنوز `issue.message` خام رندر می‌کرد، `test-changed` پکیج‌های draft را map نمی‌کرد، و guard واحدی برای regression قراردادهای فاز ۱–۳ وجود نداشت.

### راهکار انترپرایز برای پیاده‌سازی (Phase 4):
1. **i18n parity در flat edit:** کامپوننت `DenaliFlatEditValidationList` با همان قرارداد `resolveWizardValidationIssueMessage` + `denali.review.validation.*` که در create-tour review panel است.
2. **نگاشت test-changed:** `packages/draft-engine`, `packages/wizard-navigation`, `packages/workspaces/denali` در [`scripts/test-changed.sh`](../scripts/test-changed.sh).
3. **Regression guards:** [`apps/web/test/denali-draft-systemic-closure.spec.ts`](../apps/web/test/denali-draft-systemic-closure.spec.ts) — `WEB-P11-CLOSE-01` … `05`.
4. **Doc pack نهایی:** جدول DoD در [`docs/phase-11/denali-wizard-draft-binding.md`](../docs/phase-11/denali-wizard-draft-binding.md) و cross-link در [`docs/phase-11/web-draft-host.md`](../docs/phase-11/web-draft-host.md).

### صریحاً خارج از scope (Phase 4):
- UX کامل flat edit (soft-lock banner + Save/retry) — فقط create-tour wizard
- پاکسازی پیام‌های hardcoded در لایه source Denali (Zod / `publishReadinessRules`)
- رفع blockers `@apps/api` (Phase 8 genericity، integrity audit) روی branch

---

## وضعیت پیاده‌سازی (Implementation Status)

| بخش blueprint | فاز | وضعیت | PR / commit |
| --------------- | --- | ----- | ----------- |
| 1 Transport | 1 | **Done** | `da9b91e9` |
| 2 Merge / tombstones | 1 | **Done** | `da9b91e9` |
| 3 Error UX | 2 | **Done** | `da9b91e9` |
| 4 Validation i18n | 2 | **Done** | `da9b91e9` |
| 5 Visibility flush | 3 | **Done** | `da9b91e9` |
| 6 Closure / DoD | 4 | **Done** | `da9b91e9` |

**Pull request:** https://github.com/hrokhbakhsh1991/docs/pull/18 (`feat/denali-draft-systemic-fixes` → `fix/admin-panel`)

---

## نقشه فاز → فایل کلیدی

| Phase | فایل‌های اصلی |
| ----- | -------------- |
| 1 | `apps/web/src/draft/workspace-draft-client.ts`, `create-workspace-draft-adapter.ts`, `denali-wizard-draft-merge.ts`, `packages/workspaces/denali/src/draft/` |
| 2 | `draft-sync-soft-lock-banner.tsx`, `draft-manual-sync-button.tsx`, `denali-review-validation-summary.tsx`, `resolve-wizard-validation-issue-message.ts` |
| 3 | `use-draft-visibility-flush.ts`, `draft-visibility-flush-logic.ts`, `packages/draft-engine` (`flushKeepalive`) |
| 4 | `denali-flat-edit-validation-list.tsx`, `denali-draft-systemic-closure.spec.ts`, `scripts/test-changed.sh` |

---

## تأیید سریع (Fast-track)

```bash
pnpm --filter @app-tour/draft-engine exec node --import tsx --test test/engine.spec.ts
pnpm --filter @app-tour/wizard-navigation exec node --import tsx --test test/map-validation-result.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/denali-wizard-draft-binding.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/workspace-draft-client.spec.ts \
  test/create-workspace-draft-adapter.spec.ts \
  test/draft-visibility-flush-logic.spec.ts \
  test/denali-wizard-draft-resume.spec.ts \
  test/denali-draft-systemic-closure.spec.ts \
  test/resolve-wizard-validation-issue-message.spec.ts \
  test/denali-flat-edit-validation-list.spec.ts \
  test/draft-manual-sync-button-logic.spec.ts
bash scripts/guard-docs.sh
```

**Canonical docs (Markdoc source of truth for covenant):** `docs/phase-11/web-draft-host.md`, `docs/phase-11/denali-wizard-draft-binding.md`
