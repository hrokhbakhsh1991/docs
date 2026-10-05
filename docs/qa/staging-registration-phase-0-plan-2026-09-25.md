# پلن اجرایی فاز ۰ — تشخیص و آماده‌سازی اصلاحات ثبت‌نام استیجینگ

تاریخ: ۲۰۲۶-۰۹-۲۵
منبع اصلی: [فهرست اولویت‌بندی‌شدهٔ باگ‌ها](./staging-registration-bugs-prioritized-2026-09-25.md)
مرز فاز: **فقط read-only و تشخیص**

## هدف فاز ۰

قبل از هر implementation ثابت کنیم:

1. رخداد هنوز در staging قابل‌بازتولید است.
2. رخداد واقعاً باگ محصول است، نه تنظیم، fixture، دادهٔ قدیمی، cache، session یا تفاوت artifact.
3. root cause و مالک واقعی مشخص است.
4. راه‌حل موجود در کد، قرارداد یا component دوباره قابل‌استفاده است.
5. برای اصلاح، کم‌پیچیده‌ترین مسیر و تست regression مشخص شده است.

## چیزهایی که در فاز ۰ ممنوع است

- تغییر application code، migration، تنظیم staging یا locale
- تغییر Exposure، payment policy، ظرفیت، transport یا rollout
- ایجاد ثبت‌نام، پرداخت، receipt یا پیام Telegram جدید مگر اینکه بعداً یک سناریوی read-only بدون side effect تأیید شود
- اضافه‌کردن cache، state، abstraction، helper یا test صرفاً برای جلو بردن تشخیص
- نسبت‌دادن رفتار staging به branch/commit بدون deploy SHA معتبر
- بستن باگ فقط با screenshot، health 200 یا unit test

## خروجی‌های فاز ۰

| خروجی                | محل ثبت               | شرط اعتبار                                             |
| -------------------- | --------------------- | ------------------------------------------------------ |
| ledger تشخیص         | همین فایل، بخش پیگیری | هر شناسه یک ردیف و یک وضعیت نهایی دارد                 |
| baseline نسخه و محیط | بخش F0.2              | staging SHA، زمان، host، tenant و session ثبت شده باشد |
| ماتریس تنظیمات       | بخش F0.3              | تنظیمات مؤثر بدون تغییر و با شاهد ثبت شده باشند        |
| نقشهٔ root cause     | بخش F0.4              | aliasها و رکوردهای یک ریشه ادغام شده باشند             |
| تصمیم ورود به اصلاح  | بخش F0.6              | فقط موارد `confirmed bug` وارد فاز بعد شوند            |

## ترتیب اجرای فاز ۰

### F0.0 — قفل‌کردن محدوده و سلامت checkout

**هدف:** جلوگیری از مخلوط‌شدن شواهد QA با تغییرات کاری موجود.

**اقدام‌ها:**

- ثبت `git status --short` و جداکردن تغییرات موجود از artifact گزارش QA
- ثبت `HEAD`، branch، remote SHA و مسیر فایل‌های درگیر
- اجرای `git diff --check` فقط برای کنترل whitespace
- عدم reset، clean، stash یا stage کردن تغییرات کاربر

**خروجی:** snapshot اولیهٔ checkout و فهرست فایل‌های خارج از scope.

**گیت توقف:** اگر تغییر application هم‌زمان وجود دارد و artifact staging قابل‌تفکیک نیست، تشخیص runtime متوقف و به `blocked-by-version` منتقل شود.

### F0.1 — تبدیل فهرست باگ به ledger قابل‌اجرا

**هدف:** هیچ شناسه‌ای بدون سناریو و مالک باقی نماند.

برای هر رکورد این ستون‌ها تکمیل شود:

| ستون          | مقدار لازم                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| شناسه و alias | شناسهٔ اصلی و مشاهده‌های وابسته                                                         |
| اولویت فعلی   | P0 تا P3، با برچسب `provisional`                                                        |
| سناریو        | URL/route، تور، کاربر/tenant، اقدام و دادهٔ مورد استفاده                                |
| انتظار        | قرارداد یا رفتار مورد انتظار با منبع آن                                                 |
| مشاهده        | رفتار واقعی، زمان و artifact                                                            |
| شواهد         | screenshot/AX، API، source، تنظیمات و log در صورت وجود                                  |
| وضعیت تشخیص   | `unverified`، `reproduced`، `config/data`، `false-positive`، `confirmed-bug`، `blocked` |
| مالک          | config، data/projection، API/egress، renderer/UI، locale یا test contract               |
| next action   | دقیقاً یک اقدام بعدی و شرط اجرای آن                                                     |

**گیت:** شناسه‌های فاقد سناریو یا انتظار قابل‌استناد هنوز bug محسوب نمی‌شوند.

### F0.2 — baseline نسخه، محیط و هویت داده

**هدف:** معلوم شود شواهد از چه artifact و چه contextای آمده‌اند.

**اقدام‌ها:**

- ثبت زمان UTC و local، hostهای staging، tenant/workspace، نقش کاربر و session context
- ثبت SHA واقعی deploy از CI یا سرویس انتشار؛ `health 200` به‌تنهایی کافی نیست
- ثبت شناسهٔ تور، registration، receipt و snapshot زمان ایجاد آن‌ها در صورت وجود
- ثبت اینکه شواهد قبل/بعد از تغییر ظرفیت، policy یا پرداخت گرفته شده‌اند یا نه
- مقایسهٔ staging SHA با branch/commit فقط بعد از داشتن هر دو مقدار

**خروجی:** یک baseline غیرقابل‌ابهام برای هر sweep؛ sweepهای مختلف با هم مخلوط نشوند.

**گیت توقف:** اگر deploy SHA یا هویت tenant/session نامشخص باشد، نتیجه فقط `observed-unattributed` است و اصلاح شروع نمی‌شود.

### F0.3 — baseline تنظیمات بدون تغییر

**هدف:** جداکردن مشکل تنظیمات از مشکل کد.

برای هر سناریو فقط خواندن و ثبت شود:

- Exposure fieldها و custom selection
- payment mode، payment plan، `requiresPayment` و approval policy
- ظرفیت، `availability`، waitlist و promotion rules
- transport enum و هزینهٔ حمل/دُنگ
- locale و fallback keyها
- cache/session/authorization context
- rollout و feature flagهای مؤثر

**قانون:** تنظیمات برای «دیدن اینکه باگ رفع می‌شود یا نه» تغییر داده نشوند. اگر رخداد با تنظیم فعلی طبق قرارداد درست است، رکورد به `config/data issue` منتقل شود.

### F0.4 — trace ریشه از داده تا UI

**هدف:** محل مشاهدهٔ مشکل با محل ایجاد مشکل اشتباه نشود.

**ترتیب trace:**

1. source تنظیم یا fixture
2. API/route و response واقعی
3. projection یا snapshot دامنه
4. egress/adapter
5. component/renderer
6. DOM/AX و متن قابل‌مشاهده

برای discovery کد، ابتدا از Codebase Memory استفاده شود: `search_graph`، سپس `trace_path` و در نهایت `get_code_snippet`. فقط برای string/config/non-code از `rg` استفاده شود.

**خروجی:** یک root cause دقیق با فایل/نماد/قرارداد؛ صرفاً نام صفحه یا component کافی نیست.

### F0.5 — بررسی reuse و کمینه‌سازی تغییر

قبل از پیشنهاد fix، این موارد جست‌وجو و نتیجه ثبت شوند:

- component/renderer موجود
- formatter و mapping موجود
- policy/state machine موجود
- projection/contract موجود
- guard و test موجود
- migration یا schema موجود

**تصمیم اجباری:**

- اگر مسیر موجود قابل‌استفاده است: همان مسیر اصلاح شود.
- اگر چند مشاهده یک root cause دارند: یک fix مشترک تعریف شود.
- اگر قرارداد مبهم است: ابتدا قرارداد و test contract روشن شود، نه اینکه state موازی ساخته شود.
- اگر فقط تنظیم/داده مشکل دارد: هیچ کد جدیدی نوشته نشود.

### F0.6 — تصمیم نهایی ورود به فاز اصلاح

هر رکورد باید یکی از این تصمیم‌ها را بگیرد:

| تصمیم                   | معنی                                               | اقدام بعدی                                 |
| ----------------------- | -------------------------------------------------- | ------------------------------------------ |
| `confirmed-bug`         | بازتولید، قرارداد، root cause و artifact تأیید شده | ورود به فاز مالک مربوط                     |
| `config/data issue`     | رفتار از تنظیم یا دادهٔ معتبر ناشی شده             | اصلاح کد ممنوع؛ owner تنظیم/داده تعیین شود |
| `false-positive`        | انتظار اولیه با قرارداد محصول سازگار نیست          | از backlog باگ خارج و قرارداد ثبت شود      |
| `observed-unattributed` | مشاهده هست اما SHA/context کافی نیست               | تکمیل baseline، بدون implementation        |
| `blocked`               | شواهد لازم با دسترسی/دادهٔ فعلی ممکن نیست          | blocker دقیق ثبت شود                       |

## تخصیص رکوردها به مسیر تشخیص

| مسیر                 | رکوردها                                                                                                    | خروجی مورد انتظار                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| policy/PDP           | `BUG-STG-008/013`، `BUG-STG-EXPOSURE-PDP-START-PAYMENT-CURRENT-2026-09-25`، `BUG-STG-025`                  | یک قرارداد egress/renderer و تعیین alias         |
| مالی/projection      | `BUG-STG-080`، free pending، paid list، admin after approve، `BUG-STG-024`                                 | state contract و منبع projection canonical       |
| receipt/status       | resubmit stale، mixed status، `BUG-STG-040`                                                                | تفکیک receipt و registration status              |
| capacity/waitlist    | `BUG-STG-063`، `BUG-STG-062/047`، `BUG-STG-064/065`، nondeterministic state، waitlist label، `BUG-STG-037` | state machine، cache evidence و guard ownership  |
| form/data/time       | `BUG-STG-022`، `BUG-STG-021`، `BUG-STG-035`، `BUG-STG-039/072`                                             | مالک محاسبه/duplicate/timezone/lifecycle         |
| parity/locale/export | `BUG-STG-081`، `BUG-STG-082`، transport label، `BUG-STG-036`، سه باگ locale، `BUG-STG-EXPORT-SUMMARY`      | منبع canonical، mapping و formatter موجود        |
| test contract        | `BUG-SOURCE-TEST-TELEGRAM-FORMAT`                                                                          | تفکیک fail تست از باگ محصول و تصمیم قرارداد قالب |

## معیار عبور فاز ۰

فاز ۰ فقط وقتی تمام‌شده است که:

- برای همهٔ رکوردهای active، ledger تکمیل شده باشد.
- هر رکورد `confirmed-bug` یک root cause، owner، artifact و reproduction evidence داشته باشد.
- رکوردهای config/data، false positive و alias از backlog اصلاح کد جدا شده باشند.
- هیچ رکورد unresolved با priority قطعی وارد فاز ۱/۲ نشده باشد.
- برای هر confirmed bug یک مسیر اصلاح کمینه، فایل‌های احتمالی و تست regression پیشنهاد شده باشد؛ هنوز اجرا نشده باشد.
- baseline SHA، environment و session/tenant برای sweep معتبر ثبت شده باشد.
- تغییرات فاز ۰ فقط مستندات/شواهد read-only باشند.

## وضعیت اجرای فاز ۰

### شاهد اجرای F0.0 — ۲۰۲۶-۰۹-۲۵T09:18:24Z

- branch: `codex/payment-follow-up-receipt-telegram`
- HEAD: `ed8ec8f479095bc99269a6ee333eee1fe6d25068`
- تغییر موجود کاربر: `docs/qa/staging-registration-matrix-2026-09-24.md`
- artifactهای جدید این برنامه: همین فایل و `staging-registration-bugs-prioritized-2026-09-25.md`
- `git diff --check`: سبز
- هیچ reset، clean، stash، stage، تغییر application یا تغییر staging انجام نشد.

| تسک  | وضعیت     | شاهد                                           | تصمیم/مانع                                                            |
| ---- | --------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| F0.0 | انجام‌شده | branch، HEAD، status و diff check در همین فایل | تغییرات موجود حفظ شد؛ برای نسبت‌دادن runtime هنوز deploy SHA لازم است |
| F0.1 | شروع‌نشده | —                                              | ledger باید از بخش authoritative ساخته شود                            |
| F0.2 | شروع‌نشده | —                                              | deploy SHA staging هنوز باید مستقل ثبت شود                            |
| F0.3 | شروع‌نشده | —                                              | تنظیمات فقط read-only بررسی شوند                                      |
| F0.4 | شروع‌نشده | —                                              | trace با graph و سپس source انجام شود                                 |
| F0.5 | شروع‌نشده | —                                              | reuse قبل از هر proposal بررسی شود                                    |
| F0.6 | شروع‌نشده | —                                              | بدون تصمیم نهایی، فاز اصلاح شروع نمی‌شود                              |

## شاهد اجرای فاز ۱ — ۲۰۲۶-۰۹-۲۵

- SHA: `ed8ec8f479095bc99269a6ee333eee1fe6d25068`
- وضعیت source: در دامنهٔ مالی فاز ۱ هیچ تغییر application اعمال نشد؛ قراردادهای موجود و consumerها با تست بررسی شدند.
- تست‌های متمرکز: Finance Core `17/17`، Web Finance `13/13`، Portal `18/18`.
- `pnpm run phase-1:gate`: سبز؛ شامل build کامل، Platform Core `242` تست، Phase-1 contract `22` تست، architecture/import-boundary/symlink و `phase-1-guard`.
- گزارش guard: `reports/phase-1-guard-2026-09-25.json`؛ workspace-sdk `485` تست، closure `79` تست، facade ratio `64%`، adversarial سبز.
- API health: `GET http://127.0.0.1:3001/health` با `200` و `status: ok`.
- runtime UI: قابل closure نیست؛ Browser Use برای `admin.denali.localhost:3000` با `ERR_CONNECTION_REFUSED` مواجه شد. curl اولیهٔ محلی redirect تولید کرد، اما login/acceptance معتبر از مسیر UI به‌دلیل این مانع ثبت نشد.
- مشاهدهٔ مهم: در زمان build کامل، dev server وب به‌علت حذف/بازسازی موقت `packages/workspace-sdk/dist` چند خطای transient source-read نشان داد؛ این evidence معتبر برای bug محصول نیست و processها بعد از gate متوقف شدند.

| دامنه                                       | نتیجهٔ فعلی                                   | تصمیم                                                            |
| ------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| free/zero obligation و `WAIVED`             | قرارداد و تست موجود سبز                       | `observed-unattributed` برای staging claim؛ source bug تأیید نشد |
| paid/list/admin projection بعد از approve   | mapping و balance contract در source/test سبز | `observed-unattributed`؛ runtime staging لازم است                |
| receipt resubmit و تفکیک labelها            | BFF/logic تست سبز؛ UI runtime تأیید نشد       | `observed-unattributed`                                          |
| currency/refund/remaining و receipt content | formatter/logic تست‌شده؛ runtime UI تأیید نشد | `observed-unattributed`                                          |

نتیجهٔ اجرایی: بدون staging SHA و runtime acceptance معتبر، هیچ patch، endpoint، state موازی، cache جدید یا schema change قابل توجیه نیست. فاز اصلاح کد برای این شناسه‌ها باز نمی‌شود؛ گام بعدی فقط اجرای runtime acceptance روی artifact معتبر و همان SHA است.

### شاهد تکمیلی runtime — ۲۰۲۶-۰۹-۲۵T10:31Z

- بعد از build کامل، Admin dashboard و Finance در تب دوم Browser Use با session محلی نمایش داده شدند.
- Finance endpointهای summary، payments، pending receipts، ledger و outstanding balances پاسخ `200` دادند؛ دادهٔ قابل بررسی برای registration در این runtime وجود نداشت.
- widgetهای bookings/tours/branding در session قدیمی پاسخ `401` دادند؛ پس login مجدد از مسیر UI انجام شد.
- ارسال OTP با هویت مجاز QA یعنی `+15550001001` پاسخ `403` و متن نمایشی «امکان ورود با این شماره وجود ندارد» داد.
- API log همان درخواست را به `POST /auth/request-otp` با `403` ثبت کرد؛ source مسیر `isPhoneAuthorizedForTenantLogin` فقط user فعال یا invite معتبر tenant را مجاز می‌کند.
- `apps/web/.env.local` مقدار `NEXT_PUBLIC_DEV_LOGIN_PHONE=09174070937` دارد، درحالی‌که skill QA هویت مجاز را `+15550001001` تعیین می‌کند؛ این mismatch تنظیم/داده است و بدون تصمیم مالک تغییر داده نشد.

تصمیم runtime: `blocked` برای acceptance UI این نوبت، نه `confirmed-bug` محصول. برای ادامه باید هویت QA و seed/tenant مجاز با محیط محلی هم‌تراز شود؛ استفاده از شمارهٔ دیگر یا bypass مجاز نیست.

### شاهد تکمیلی runtime Portal — ۲۰۲۶-۰۹-۲۵T10:42Z

- برای رعایت محدودیت منابع، Web قبل از اجرای Portal متوقف شد و فقط API و Portal فعال بودند.
- host نادرست `denali.portal.localhost:3003` به host canonical یعنی `portal.denali.localhost:3003` redirect شد؛ این رفتار routing موجود است و باگ مالی محسوب نمی‌شود.
- در Portal، `phone-preflight`، `request-otp` و `verify-otp` با هویت مجاز `+15550001001` به‌ترتیب `200` شدند.
- پس از ورود، `GET /identity/me` و `GET /api/me/registrations` با `200` پاسخ دادند و صفحهٔ `ثبت‌نام‌های من` با session tenant `00000000-0000-4000-8000-000000000003` نمایش داده شد.
- empty state واقعی UI: `هنوز ثبت‌نامی ندارید`; در seed حافظه‌ای هیچ registration/free/paid/receipt برای اجرای سناریوهای فاز ۱ وجود نداشت.
- چند خطای اولیهٔ `401/404` در حین redirect/compile قبل از تثبیت host و session دیده شد و پس از ورود مجدد/تکمیل compile تکرار نشد؛ بنابراین فعلاً `confirmed-bug` نیست و به‌عنوان runtime setup/transient ثبت می‌شود.

تصمیم نهایی runtime آن نوبت: سناریوی Portal بدون registration داده‌ای `blocked` بود؛ شواهد موجود برای Admin/Finance و Portal فقط سلامت login، routing، projection خالی و endpointهای پایه را ثابت می‌کرد. این تصمیم قبل از دریافت شواهد معتبر staging و شروع فاز ۱ ثبت شده بود. پس از آن، اصلاح‌های محدود فاز ۱ فقط برای شناسه‌هایی که در staging به‌صورت `confirmed-bug` ثبت شده‌اند انجام شد؛ اجرای runtime محلی همچنان برای سناریوهای بدون fixture معتبر `blocked` است.

### شاهد تکمیلی runtime Web operator — ۲۰۲۶-۰۹-۲۵T11:01Z

- فقط Web و API حافظه‌ای اجرا شد؛ Portal هم‌زمان اجرا نشد و پس از پایان، همهٔ processها متوقف و پورت‌های ۳۰۰۰ تا ۳۰۰۳ آزاد شدند.
- با fixture موجود، registration `00000000-0000-4000-8000-000000000310` در صف pending با invoice `۵٬۰۰۰٬۰۰۰` تومان و balance برابر مبلغ invoice دیده شد؛ این مورد paid/manual نبود و برای free claim معتبر نیست.
- دکمهٔ approve پاسخ `POST /bookings/:id/approve` با `200` گرفت. پس از اتمام action و reload معتبر، صف pending به empty state رسید و شمارندهٔ approval افزایش یافت؛ snapshot فوری حین busy به‌عنوان stale-state bug ثبت نشد.
- ادامهٔ ساخت free booking از مسیر UI به login برگشت، چون API حافظه‌ای جدید هویت قبلی را معتبر نمی‌دانست و OTP هویت مجاز `+15550001001` برای tenant اپراتور با `403` رد شد. این همان mismatch seed/tenant است، نه رفتار مالی محصول.
- نتیجهٔ همان اجرای محلی: برای `BUG-STG-080` و projection-after-approve در آن محیط `confirmed-bug` نداشتیم؛ classification محلی `observed-unattributed`/`blocked` باقی ماند و patch بر اساس آن runtime اعمال نشد. این نتیجه با evidence معتبر staging که بعداً در matrix ثبت شد، جایگزین نشده بلکه به‌عنوان محدودیت محیط محلی باقی است.

## قالب ثبت یک رکورد در ledger

```text
شناسه/alias:
مسیر تشخیص:
اولویت موقت:
سناریو و context:
رفتار مورد انتظار + منبع:
رفتار واقعی + زمان:
تنظیمات/flag/cache/session:
staging SHA و branch comparison:
API/projection/egress/renderer/DOM evidence:
root cause:
مالک:
کد یا قرارداد موجود قابل reuse:
تغییر پیشنهادی حداقلی:
تغییرات ممنوع/غیرلازم:
تست regression پیشنهادی:
تصمیم: unverified | reproduced | config/data issue | false-positive | confirmed-bug | observed-unattributed | blocked
```

## Phase 1 implementation checkpoint — 2026-09-25

پس از تأیید `confirmed-bug` در staging، اصلاح‌های کم‌دامنهٔ زیر در source انجام شد:

- free-pending: `paymentCollection` از canonical Denali (`pricing.paymentCollection`) به detail response موجود اضافه شد؛ Portal برای `free` متن صرفاً انتظار تأیید نشان می‌دهد، CTA/متن پرداخت و deadline را نشان نمی‌دهد و مسیر paid pending بدون تغییر باقی ماند.
- receipt resubmit: بعد از submit موفق، parent Server Component با `router.refresh()` دوباره projection receipt/registration را می‌خواند؛ state محلی child به‌عنوان منبع heading استفاده نمی‌شود.
- refund currency: formatter مشترک Portal ساخته شد و مبلغ refund با قرارداد نمایشی `IRR → تومان` نمایش داده می‌شود؛ currency خام جداگانه چاپ نمی‌شود.
- receipt delivery message: formatter فقط evidence واقعی را اضافه می‌کند؛ note خالی به «بدون توضیحات» تبدیل نمی‌شود و receipt متن‌تنها به‌صورت فایل fallback نمی‌شود.
- approve projection: پاسخ approve اکنون `registrationId` را در همان response موجود حفظ می‌کند؛ wrapper مشترک finance با همین کلید، hold باز را بعد از balance صفر می‌بندد و `paymentDueAt` projection را پاک می‌کند. این اصلاح برای جلوگیری از stale deadline در Admin/list انجام شد و endpoint/cache موازی ایجاد نکرد.

شواهد source بعد از این checkpoint:

- `packages/workspaces/denali/test/registration-read-services.spec.ts`: 7/7 pass، شامل free canonical collection و بدون due amount.
- `apps/portal/test/portal-member-registrations.spec.ts`: 13/13 pass؛ suite ترکیبی با `portal-payment-deadline.spec.ts` پیش از آخرین case نیز 17/17 pass بود.
- `apps/api/src/integrations/platform/format-integration-delivery-message.spec.ts` با test-name focused: 1/1 pass.
- `apps/api/src/finance/wrap-finance-service-payment-hold.spec.ts`: 2/2 pass، شامل receipt approve و پاک‌شدن hold/deadline.
- `@app-tour/workspace-denali lint`: pass؛ `@apps/portal lint`: pass؛ `git diff --check`: pass.

برای `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE-FRESH-2026-09-25-1205` root cause source مشخص شد: wrapper payment-hold به‌دلیل نبودن `registrationId` در پاسخ approve، hold و `paymentDueAt` را پاک نمی‌کرد؛ این مسیر اصلاح و با تست `2/2` تأیید شد. تأیید نهایی staging همان SHA هنوز لازم است.

`BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE-FRESH-2026-09-25-1150` هنوز بدون root cause قابل انتساب به source فعلی باقی است؛ مسیر list و BFF هر دو `no-store` هستند و مسیر approve نیز `raisePaidInTx` را در همان transaction اجرا می‌کند. چون runtime local fixture معتبرِ همان staging را نداشت و cache key/response/SHA مشترک ثبت نشده، برای Portal list تغییر حدسی اعمال نمی‌شود.

### Phase 1 source gate — 2026-09-25

- `pnpm run phase-1:gate`: pass.
- Full build و تولید artifact: pass.
- `@app-tour/platform-core` closure: `79/79` pass.
- `@app-tour/platform-core` unit: `163/163` pass.
- Phase-1 contract: `22/22` pass.
- `phase-1:guard`: pass؛ شامل workspace-sdk، architecture، import-boundary و symlink guard.
- `git diff --check`: pass.

این gate فقط صحت source، قراردادها و guardهای repository را ثابت می‌کند؛ closure فاز ۱ هنوز به runtime acceptance روی همان staging SHA نیاز دارد. اجرای محلی به‌دلیل نبود fixture معتبر free/paid/receipt، همچنان `blocked` است و برای Portal list نیز patch حدسی اضافه نشده است.

### Runtime recheck و اصلاح labelها — 2026-09-25

- در staging، free approved با registration `c26e18b7-bf20-4fce-a186-b874b0af9872` بدون receipt upload، deadline یا balance قابل پرداخت نمایش داده شد؛ این کنترل مثبت مسیر `free/WAIVED` است.
- در staging، registration `5951d23f-1aac-4601-9ea3-5b2f89707322` در حالت receipt rejected هنوز هم‌زمان heading `اصلاح فیش لازم است` و متن مبهم `تأیید شده` داشت. این finding محصولی و قابل بازتولید است، نه config/data صرف.
- برای رفع آن، status card فعلی Portal اکنون دو label مستقل render می‌کند: `ثبت‌نام: ...` و `رسید: ...`. هیچ state، endpoint یا cache جدیدی اضافه نشد.
- تست Portal `13/13`، lint/typecheck و guardهای Portal سبز شدند؛ پس از این تغییر `pnpm run phase-1:gate` نیز دوباره سبز شد.
- همان staging artifact هنوز `BUG-STG-085` را روی registration پرداخت‌شده `b254c01f-e5ce-4a27-b7d4-202b9a4fd432` با deadline باقی‌مانده نشان می‌دهد. چون source اصلاح‌شده هنوز با SHA قابل‌اتکا روی staging deploy نشده، این مشاهده برای تأیید fix محسوب نمی‌شود و به‌عنوان artifact قدیمی نگه داشته می‌شود.
- Portal list در همان artifact برای بعضی رکوردهای paid مقدار `پرداخت ثبت شد` و برای رکوردهای قدیمی دیگر `پرداخت لازم است` نشان می‌دهد؛ source فعلی list و BFF `no-store` هستند و approve path در transaction وضعیت booking را به‌روز می‌کند. بدون response/SHA مشترک برای همان artifact، patch حدسی برای list اضافه نشد.
- برای جلوگیری از تکرار این gap در source، `apps/api/test/p6-member-receipt-flow.spec.ts` اکنون بعد از approve، همان registration را از `GET /bookings?view=mine` نیز می‌خواند و `paymentStatus=paid` را assert می‌کند؛ اجرای استاندارد با `NODE_ENV=test` برابر `7/7` pass شد.
