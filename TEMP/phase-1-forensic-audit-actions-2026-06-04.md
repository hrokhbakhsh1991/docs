# اقدامات پیشنهادی — بر اساس `audits/phase-1-forensic-audit.md`

تاریخ: ۲۰۲۶-۰۶-۰۴  
منبع: گزارش جنایی فاز ۱ (بخش‌های ۱ تا ۲۰) + تست‌های اضافه‌شده بعد از همان گزارش

---

## خلاصه در یک نگاه

- **امنیت North Star (Denali / React / workspace محصول در `src/`):** تمیز — اقدام اجباری نیست.
- **نشت tenant بین درخواست‌ها در کش RuleEngine:** در کد اثبات شده «نشت نمی‌کند» — با `tenantId` درست.
- **باگ بحرانی کشف‌شده در ممیزی:** خیر — بیشتر «بدهی تست/مستندات/سیاست اعتبارسنجی».
- **کار انسانی باقی‌مانده فاز ۱:** امضای معمار MAP §14.1 (خارج از کد).

---

## ۱. تناقضات — اول هماهنگ کنید

| # | موضوع | تناقض | پیشنهاد اقدام |
|---|--------|--------|----------------|
| T-01 | **Headless / `includeTheme: false`** | متن FT-P1-01 می‌گوید در **`buildRuntime`**؛ کد در **`sanitizePluginAtCreate`** (ساخت engine) است. گیت فقط وجود رشته در فایل را چک می‌کند. | یک جمله در `forensic-template.md` و `phase-1.contract` عنوان تست را با زنجیره واقعی bootstrap (گام ۱ sanitize، گام ۲ validate) هم‌راستا کنید. **کد لازم نیست** مگر بخواهید دوباره parse در `buildRuntime` هم بزنید. |
| T-02 | **نام فایل تست قدیمی** | §۹ هنوز `step.engine.spec.ts` می‌نویسد؛ فایل واقعی **`render-plan.steps.spec.ts`**. | در گزارش جنایی و هر doc که لینک دارد، نام را یکجا عوض کنید تا گیج‌کننده نباشد. |
| T-03 | **«فقط facade روی barrel»** | FT-P1-05 ادعای «فقط PlatformWizardEngine»؛ barrel واقعاً `PlatformCoreError`، `platformOk`، انواع plan/validation هم export می‌کند — با ai-exec §۵ سازگار است، با جمله FT نه. | در forensic-template جمله FT-P1-05 را اصلاح کنید: «موتورهای داخلی export نشوند». |
| T-04 | **آستانه تست facade** | FT-P1-11 / mdoc قدیمی ~۳۰٪؛ repo **`PHASE_1_FACADE_TEST_RATIO_MIN = 0.6`**. | در mdoc §۴.۶ اگر هنوز ۳۰٪ است، با `gate-thresholds.mjs` یکی کنید. |
| T-05 | **`defaultCellId` در doc 1.3** | doc می‌گوید «هیچ match → defaultCellId»؛ کد در عمل **`RULE_CONTEXT_UNMATCHED`** می‌دهد مگر catch-all باشد. | یک خط در `1.3-rule-engine.md` و §۴.۳ mdoc: default فقط وقتی در `cells` هست و از مسیر index استفاده می‌شود — نه auto-pick سکوت‌آمیز. |

---

## ۲. نواقص و پوشش ناکافی تست

| # | موضوع | وضعیت در ممیزی | اقدام پیشنهادی |
|---|--------|----------------|----------------|
| G-01 | **۱۴ قرارداد closure** | ۶ مورد فقط ساختاری (grep / fs) — رفتار runtime کم. | برای `field-validation-contract` و `fresh-starter-fixture` حداقل یک `it` رفتاری واقعی اضافه کنید (نه فقط `includes` در فایل). |
| G-02 | **`passesHiddenFieldKindGate`** (BL-01) | export هست؛ engine استفاده نمی‌کند. | یا **حذف/ادغام** با `isEmptyCanonicalValue`، یا **وصل** به `validate-canonical-field` + جدول تست kindها. |
| G-03 | **`isEmptyRuleDimensions`** (BL-02) | مرده — هیچ call site. | حذف از `rule-resolution.ts` یا استفاده در `RuleEngineScope`؛ یکی را انتخاب کنید. |
| G-04 | **داده اضافی در سند (orphan path)** | MUT-01: مسیر ثبت‌نشده در registry → **`ok: true`**. | اگر محصول باید «فقط فیلدهای ثبت‌شده» را بپذیرد: سیاست را در doc بنویسید. اگر باید رد شود: اسکن اضافی keys زیر root یا violation جدید. |
| G-05 | **`fieldId` جعلی داخل composite** | MUT-03: `ok: true`. | همانند G-04 — تصمیم محصول؛ در صورت نیاز اعتبارسنجی semantic روی composite. |
| G-06 | **`validateCanonicalDocument` مستقیم** | هیچ unit مستقیم؛ فقط از facade. | یک spec کوچک `validate-canonical-document` با engine واقعی (اختیاری؛ facade کافی است اگر closure قوی باشد). |
| G-07 | **شاخه‌های defensive بدون پوشش** | `toRenderFieldPlan` L73–77؛ `pickBestMatchingCell` L132–136, L143–148. | فقط اگر سیاست ۱۰۰٪ خط می‌خواهید: دو تست مستقیم `pickBestMatchingCell`؛ تست render با سناریوی غیرممکن `getById` — اولویت پایین. |
| G-08 | **تست‌های «ضعیف» (ST-WEAK)** | با stub اعتبارسنجی سبز می‌مانند — درست نیستند که validation را ثابت کنند. | `inactiveFieldGroups` را با assertion روی **نوع** violation تقویت کنید؛ lazy-init را جدا از «validation واقعی» نام‌گذاری کنید. |
| G-09 | **تاریخ / SHA گزارش** | هدر هنوز `ac12e3f` و ۲۰۲۶-۰۶-۰۳؛ append تا §۲۰ است ۰۶-۰۴. | یک pass به‌روزرسانی metadata گزارش یا یادداشت «§۱–۸ snapshot اولیه؛ §۹–۲۰ ممیزی بعدی». |

**یادآوری:** بخشی از §۹ (مثلاً inactive group، hidden composite) **بعد از نوشتن §۹** در کد تست شده — قبل از بستن فاز ۱، `pnpm test` و §۹ را با واقعیت repo هم‌خوان کنید.

---

## ۳. ساده‌سازی کد (بدون شکستن قرارداد فاز ۱)

| # | مورد | چرا | اقدام |
|---|------|-----|--------|
| S-01 | **`listStepIds` در `render-plan.steps.ts`** (AT-RPS-01) | الگوریتم partition + sort پیچیده‌تر از نیاز doc. | **RP-1** در ممیزی §۱۱.۵: همان رفتار با دو فیلتر ساده؛ بعد `render-plan.steps.spec.ts`. |
| S-02 | **`PlatformWizardEngineOptions` خالی** (AT-PWE-01) | `Record<string, never>` فقط برای آینده. | JSDoc «فاز ۲+» (PW-1 گزینه A) — یا حذف پارامتر در semver بعدی (گزینه B شکست API). |
| S-03 | **گزارش جنایی ۱۵۰۰+ خط** | برای انسان سخت مرور می‌شود. | فایل TEMP (همین) + یک صفحه «خلاصه اجرایی» در `TEMP/` با فقط P0/P1 — نه حذف append-only audit. |

---

## ۴. چیزهایی که عمداً دست نزنید

- **حذف کلاس `PlatformWizardEngine`** — doc §۴.۶ اجازه نمی‌دهد.
- **برگرداندن `fromPlugin`** — ممنوع (FT-P1-02).
- **کلاس `StepEngine`** — ممنوع (FT-P1-12).
- **Export کردن `RuleEngine` روی barrel** — شکست Single Facade.
- **Lexicographic fallback برای rule tie** — doc و کد هر دو «throw ambiguous» — درست است؛ تست `rule-resolution.spec.ts` اضافه شده.
- **Mock کردن RuleEngine در unit** — ممیزی §۱۴: لازم نیست؛ واقعی است.

---

## ۵. لیست اقدام — اولویت‌بندی

### P0 — قبل از اعلام «فاز ۱ بسته» (کم‌هزینه، پرارزش)

1. ✅ هم‌راستایی **مستندات** با T-01, T-03, T-04, T-05 — `forensic-template.md`, `closure-contracts.md`, `1.3-rule-engine.md`, `phase-1.contract` عنوان headless.
2. ✅ **G-04 / G-05** — پاراگراف «registry-scoped only / accept orphan» در `phase-1-platform-core.mdoc` §validateCanonical.
3. ✅ **BL-01** — قبلاً wire شده؛ audit §9.3 به‌روز شد.
4. ⏳ امضای انسانی **MAP §14.1** — فقط معمار؛ technical checklist در `phase-1-architect-signoff-checklist-2026-06-03.md` سبز است.
5. ✅ `pnpm run phase-1:gate` — ۱۶/۱۶ PASS (۲۰۲۶-۰۶-۰۴).

### P1 — کیفیت و اعتماد به تست

6. تقویت closure: تست رفتاری برای قراردادهای `field-validation` و `fresh-starter`.
7. ✅ **`isEmptyRuleDimensions`** — قبلاً حذف شده؛ audit BL-02 بسته شد.
8. به‌روزرسانی ارجاعات **`step.engine` → `render-plan.steps`** در audit و docs.
9. نگه‌داشتن در `test:closure`: `validate-canonical-mutation.spec.ts`, `rule-resolution.spec.ts`, تست دو engine در `runtime-isolation.spec.ts`.
10. ✅ **RP-1** — `listStepIds` دو فیلتر (roots ∩ union سپس discovery \ roots).

### P2 — سخت‌گیری بیشتر (فقط اگر سیاست امنیتی/محصول بخواهد)

11. اسکن دادهٔ canonical برای کلیدهای خارج از registry.
12. تست مستقیم شاخه‌های unreachable `pickBestMatchingCell`.
13. اسکن `dist/` بعد از build در pipeline (نقطه کور §۴.۲).
14. g3 را برای `denali` داخل `test/**` هم سخت‌تر کنید (پیشنهاد ممیزی §۴.۲).

### P3 — نگهداری

15. metadata و SHA گزارش جنایی (G-09).
16. یک خلاصه یک‌صفحه‌ای در TEMP برای onboarding تیم.

---

## ۶. ثبت یافته‌ها — نیاز به «فیکس کد» ندارند (فقط آگاهی)

| شناسه | معنی ساده |
|--------|-----------|
| CTL-00 | نشت tenant از کش RuleEngine دیده نشد. |
| SRF-19-00 | ورودی مخرب canonical باعث `TypeError` خام نشد. |
| NDE-20-00 | ابهام rule → همیشه همان خطا؛ تصادفی نیست. |
| CV-P1-01 | تناقض **نام‌گذاری doc** با محل `includeTheme: false` — رفتار headless درست است. |
| ST-WEAK | تست‌هایی که فقط «موفق بودن» را چک می‌کنند، نه عمق validation. |

---

## ۷. فایل‌ها و تست‌هایی که الان خوب پوشش می‌دهند (دست نزنید مگر عمدی)

- `test/unit/engine/rule-resolution.spec.ts` — specificity + ambiguous + ۲۰۰ بار deterministic
- `test/validate-canonical-mutation.spec.ts` — robustness مسیر validate
- `test/runtime-isolation.spec.ts` — دو instance موازی field A hidden/visible
- `test/adversarial-validation.spec.ts`, `facade-integration.spec.ts`, `rule-engine-concurrency.spec.ts`

---

## ۸. دستور پیشنهادی برای تأیید بعد از اقدامات

```bash
nvm use 24
pnpm --filter @app-tour/platform-core test
pnpm run phase-1:gate
pnpm run ci:integrity   # قبل از commit
```

---

*این سند جایگزین `audits/phase-1-forensic-audit.md` نیست؛ نقشه کار عملیاتی از روی آن است.*
