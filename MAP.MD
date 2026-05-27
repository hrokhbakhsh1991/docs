# Schema-First Refactor Proposal for Denali Wizard

## Executive Answer

- بله، حرکت به سمت `Schema-First` با یک registry متمرکز برای stepها **پیشنهاد درست و استاندارد** است.
- با توجه به وضعیت فعلی Denali (چند source برای state/validation و fallbackهای تکراری)، این refactor **over-engineering نیست**؛ بلکه یک **تسویهٔ بدهی معماری** برای رسیدن به SSOT واقعی است.
- برای enterprise monorepo، این روش maintainability، testability، onboarding سرعت، و cross-team safety را به‌شکل معنادار بالا می‌برد.

---

## 1) Target Architecture (Schema-First + Centralized Step Registry)

## 1.1 Single Contract

یک قرارداد مرکزی تعریف شود که هر step و هر field را با متادیتای کامل توصیف کند:

- `stepId`
- `canonicalPath`
- `formPath`
- `valueType`
- `visibilityRule`
- `requiredRule` (step/submit/publish scope)
- `defaultStrategy` (نه default پراکنده)
- `normalizer/sanitizer`
- `presentation` (labelKey, formatterKey, display policy)
- `ownership` (which layer writes/reads)

این contract باید **single source of truth** برای:
1) UI rendering
2) sanitize/hydrate
3) validation routing
4) issue-to-step mapping
باشد.

## 1.2 پیشنهادی برای ساختار فایل

```text
apps/web/src/features/tours/wizard/denali/schema/
  denaliWizardSchema.ts                 # root registry
  denaliWizardStepSchema.ts             # step descriptors
  denaliWizardFieldSchema.ts            # field descriptors
  denaliWizardValidationSchema.ts       # submit/step/publish scopes
  denaliWizardSanitizer.ts              # schema-driven sanitize/hydrate
  denaliWizardPresentationSchema.ts     # labels/formatters/display
  generated/
    denaliWizardFormPathIndex.ts
    denaliWizardStepIndex.ts
```

---

## 2) How Provider Changes (`DenaliCanonicalProvider`)

## 2.1 وضعیت فعلی (Current)

- provider همزمان canonical state نگه می‌دارد و از RHF می‌خواند/می‌نویسد.
- sanitize/hydrate با helperهای متعدد انجام می‌شود (`applyCanonicalMvpToForm`, `applyDenaliInvariantState`, `purgeGhostFields`).
- بخشی از fallbackها در adapter hard-code شده‌اند.

## 2.2 وضعیت پیشنهادی (Schema-First Provider)

`DenaliCanonicalProvider` باید فقط orchestration باشد و logic را از schema بخواند:

- `sanitize(form, schema, scope)`  
- `hydrate(canonical, form, schema)`  
- `deriveUiContext(form, schema, ruleSetOverlay)`  
- `deriveValidationScopes(schema, lifecycle)`  

به این ترتیب:
- fallbackها از provider حذف می‌شوند.
- defaults و coercionها فقط از schema می‌آیند.
- provider thin/boring می‌شود (که دقیقاً مطلوب است).

---

## 3) How UI Changes (`DenaliReviewStep` and others)

## 3.1 وضعیت فعلی (Current)

- `DenaliReviewStep` هم از canonical value می‌خواند، هم از RHF watch، هم از form snapshot.
- label/formatterها partially hard-coded هستند.
- visibility checks بخشی rule-driven و بخشی دستی هستند.

## 3.2 وضعیت پیشنهادی

UI باید از `ReviewViewModel` schema-driven استفاده کند:

- هر review row از registry ساخته شود:  
  `registry.reviewRows(stepId, form, canonical, locale)`
- labelها فقط از `labelKey` در schema.
- formatterها key-based باشند (`dateTime`, `money`, `boolYesNo`, ...)
- fallback display policy مرکزی باشد (`hideIfEmpty`, `showDash`, ...)

نتیجه: `DenaliReviewStep` از imperative mapping تبدیل می‌شود به declarative renderer.

---

## 4) Current vs Proposed (Direct Comparison)

1. **Source of Truth**
   - Current: RHF + canonical + snapshot + per-function defaults
   - Proposed: Schema Registry + canonical lifecycle contract

2. **Validation Ownership**
   - Current: submit/publish/UI guard در چند فایل
   - Proposed: scoped validation از یک schema (`step`, `submit`, `publish`)

3. **Fallback Placement**
   - Current: adapter/review/validation هر کدام fallback خودشان را دارند
   - Proposed: fallback strategy فقط در registry (versioned and testable)

4. **Issue Mapping**
   - Current: بخشی registry + بخشی prefix-based fallback
   - Proposed: کامل registry-driven with generated indices

5. **UI Consistency**
   - Current: i18n + hard-coded labels mixed
   - Proposed: labels/formatters مرکزی و typed

6. **Change Cost**
   - Current: افزودن field نیازمند touch در چند لایه
   - Proposed: field-first addition از طریق registry + generators/tests

---

## 5) Is This Over-Engineering?

## جواب کوتاه: خیر، اگر bounded اجرا شود.

این over-engineering نیست چون:

1. **Problem-fit دارد**  
   سیستم فعلی عملاً drift و duplicated logic دارد؛ schema-first مستقیماً همین درد را حل می‌کند.

2. **Scale-fit دارد**  
   در monorepo enterprise، چند تیم روی API/UI/validation کار می‌کنند. contract مرکزی جلوی divergence را می‌گیرد.

3. **Operational-fit دارد**  
   incidentهای production معمولاً از inconsistency و fallback divergence می‌آیند، نه از کمبود abstraction.

4. **Evolution-fit دارد**  
   rollout profile/template overlay وقتی پایدار است که schema-first contract وجود داشته باشد.

## چه زمانی over-engineering می‌شود؟

فقط اگر:
- domain کوچک و ثابت باشد،
- تیم یک‌نفره باشد،
- یا registry به DSL پیچیده و غیرقابل‌فهم تبدیل شود.

Denali فعلی این شرایط را ندارد؛ complexity واقعی است، پس centralized schema توجیه فنی دارد.

---

## 6) Why This Is the Standard Enterprise Pattern

در enterprise monorepo الگوی استاندارد این است:

- **Contract-first / schema-first**
- **Code generation for path/index safety**
- **Declarative UI from metadata**
- **Centralized validation scopes**
- **Thin orchestration layers**

دلیل استاندارد بودن:
- blast-radius کمتر
- predictable migrations
- easier auditing/compliance
- deterministic testing
- faster onboarding

---

## 7) Migration Plan (Practical, Low-Risk)

## Phase 0 - Freeze Contract

- تعریف `DenaliWizardSchema v1` با map کامل fieldها (بدون تغییر behavior).
- مستندسازی fallbackهای فعلی داخل schema (as-is capture).

## Phase 1 - Read Path First

- `DenaliReviewStep` را به read-only schema-driven view model منتقل کنید.
- هیچ write logic تغییر نکند.

## Phase 2 - Sanitize/Hydrate Centralization

- `DenaliCanonicalProvider` از `denaliWizardSanitizer` و `denaliWizardHydrator` schema-driven استفاده کند.
- helperهای پراکنده deprecate شوند.

## Phase 3 - Validation Unification

- submit/publish/step validation از یک registry-scoped engine بیاید.
- UI guardها فقط consumer همان engine باشند.

## Phase 4 - Remove Legacy Fallback Duplication

- fallbackهای hard-coded از adapter/review حذف و به registry منتقل شوند.
- assertion tests برای هر fallback strategy اضافه شود.

## Phase 5 - Generate Indices + Enforce

- تولید `formPathIndex`, `stepIndex`, `labelIndex` از schema.
- CI checks: هیچ field خارج از registry اجازه استفاده نداشته باشد.

---

## 8) Risks and Mitigations

1. **Risk:** Registry خیلی بزرگ و noisy شود  
   **Mitigation:** schema را per-step module کنید + generated index.

2. **Risk:** DX افت کند  
   **Mitigation:** helperهای typed + docs + templates برای افزودن field جدید.

3. **Risk:** Migration regression  
   **Mitigation:** golden tests روی output parity (before/after) برای review + submit issues.

4. **Risk:** Circular dependency با types/shared-contracts  
   **Mitigation:** ownership واضح: schema در web layer، domain contracts در shared packages.

---

## 9) Definition of Done (for this refactor)

- هر field در Denali دقیقاً یک entry در registry داشته باشد.
- `DenaliCanonicalProvider` هیچ default/fallback business-level hard-code نداشته باشد.
- `DenaliReviewStep` بدون mapping دستی fieldها render شود.
- submit/publish/step validations از یک schema-scoped engine تولید شوند.
- issue-to-step mapping 100% registry-driven شود.
- hard-coded labels در review صفر شود.
- CI rule: استفاده از canonical/form path خارج از registry fail شود.

---

## 10) Final Recommendation

این refactor را انجام دهید.  
برای Denali در وضعیت فعلی، schema-first centralized registry نه فقط «خوب»، بلکه **مسیر استاندارد و maintainable** برای enterprise monorepo است. این کار complexity را اضافه نمی‌کند؛ complexity موجود را **مرئی، کنترل‌پذیر و قابل‌حکمرانی** می‌کند.

---

## Architectural Standard: Schema-First Model

این بخش «استاندارد نهایی و الزام‌آور» برای هر تغییر آینده در Denali Wizard است.

- **Single Source of Truth:** تمام تصمیم‌های مربوط به field/step باید از schema/registry مرکزی بیاید، نه از شرط‌های پراکنده در UI یا adapter.
- **Model-First Sanitization:** sanitize/coercion فقط در لایه Model/Adapter انجام می‌شود؛ UI مجاز به جبران دادهٔ خراب به‌عنوان راه‌حل اصلی نیست.
- **Schema-Owned Defaults/Fallbacks:** هر default یا fallback باید در registry ثبت، versioned و تست‌شده باشد.
- **Hydration Contract:** مسیر `form -> canonical -> form` باید idempotent و deterministic باشد و فقط از schema تبعیت کند.
- **Visibility/Requiredness Contract:** `step`, `submit`, `publish` scope باید از یک منبع rule/schema resolve شوند.
- **No Direct Field Logic Outside Registry:** افزودن field جدید بدون entry در schema و تست parity ممنوع است.

### قوانین اجرایی (Guardrails)

1. هر field جدید: `canonicalPath`, `formPath`, `valueType`, `required/visibility`, `fallback policy`, `presentation key`.
2. هر migration: تست parity قبل/بعد روی submit issues + review view model.
3. هر refactor UI: فقط consumer view-model باشد، نه مالک rule یا sanitation.
4. CI باید استفادهٔ pathهای خارج از registry را fail کند.

---

## Implementation Update: Ghost Fields & Data Hydration Fix

این بخش وضعیت fix اخیر را به‌عنوان مرجع رسمی ثبت می‌کند.

### چه پیاده‌سازی شد

- فایل جدید `denaliCanonicalSchemaRegistry.ts` اضافه شد و به‌عنوان هستهٔ schema-driven sanitizer استفاده می‌شود.
- `sanitizeDenaliCanonicalModel(...)` اضافه شد و اکنون canonical string normalization را مرکزی انجام می‌دهد.
- `denaliCanonicalFormAdapter.ts` در سه مسیر اصلی به sanitize مرکزی متصل شد:
  - `createInitialDenaliCanonicalModel(...)`
  - `denaliFormToCanonical(...)`
  - `mergeDenaliCanonicalPartial(...)`
- `DenaliReviewStep.tsx` به canonical مدل sanitize‌شده متصل شد و نقاط crash-prone trim روی دادهٔ خام حذف شدند.

### نتیجهٔ رفتاری

- crash کلاسیک `Cannot read properties of undefined (reading 'trim')` در مسیر review برای itinerary/gathering data مهار شد.
- sanitation در مبدا داده اعمال می‌شود (Model/Adapter-level)، بنابراین fix صرفاً UI guard نیست.
- داده‌های ghost/malformed در hydrate مسیر canonical بهتر کنترل می‌شوند و احتمال drift نمایشی کاهش یافته است.

### شواهد اعتبارسنجی

- تست `denaliCanonicalFormAdapter.spec.ts` پاس شد.
- تست جدید sanitation اضافه شد: malformed itinerary/gathering strings را به canonical امن/coerced تبدیل می‌کند.
- lint برای فایل‌های تغییر یافته بدون خطا است.

---

## Remaining Technical Debt / Audit Gaps (Phase C)

موارد زیر هنوز باز هستند و باید در Phase C closure برنامه‌ریزی شوند:

1. **Provider هنوز کاملاً schema-orchestrated نیست**
   - `DenaliCanonicalProvider` هنوز چند مسیر sync/read/write موازی دارد (`RHF`, canonical state, snapshot).

2. **Validation ownership هنوز fully unified نشده**
   - submit/publish/UI guard هنوز در چند pipeline اجرا می‌شوند و 100% از یک engine schema-scoped نمی‌آیند.

3. **Issue-to-step mapping هنوز fallback دستی دارد**
   - بخشی از resolve مسیرها prefix-based است و کامل registry-driven نشده.

4. **Review presentation هنوز metadata-driven کامل نیست**
   - `DenaliReviewStep` هنوز declarative row registry کامل ندارد (field map دستی باقی‌مانده).

5. **Hard-coded labels/styles باقی‌مانده**
   - بخشی از labelها و presentation fallbackها خارج از schema presentation policy هستند.

6. **Fallback policy registry هنوز partial است**
   - registry فعلی عمدتاً string sanitation را پوشش می‌دهد؛ باید برای کل field taxonomy (enum/number/array/object) تکمیل شود.

7. **Generated indices/compile-time enforcement هنوز نهایی نشده**
   - `formPathIndex`, `stepIndex`, `labelIndex` و policy lint rules باید enforce شوند.

8. **Golden parity suite ناقص است**
   - تست‌های before/after parity برای کل review rendering و publish readiness هنوز کامل نیست.

9. **Ghost-field purge هنوز چند نقطهٔ authority دارد**
   - بخشی در invariant engine و بخشی در normalization/adapters اجرا می‌شود؛ نیاز به authority واحد schema دارد.

10. **ADR/ownership رسمی ثبت نشده**
   - مالکیت schema بین web/shared packages باید با ADR نهایی و enforceable تعریف شود.

---

## Final Standard for Future Wizard Changes

از این نقطه به بعد، هر تغییر در wizard باید با این ترتیب انجام شود:

1. تغییر schema/registry
2. بروزرسانی model sanitizer/hydrator
3. بروزرسانی validation scopes
4. بروزرسانی UI view-model consumer
5. افزودن/آپدیت parity tests

هر PR که ترتیب بالا را رعایت نکند یا منطق business/fallback را خارج از schema اضافه کند، با استاندارد این سند سازگار نیست.
