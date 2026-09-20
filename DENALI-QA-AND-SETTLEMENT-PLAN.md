# Denali QA و برنامهٔ کیف پول و تسویه

> سند نهایی ادغام‌شدهٔ دو فایل موقت؛ جزئیات هر دو سند در ادامه حفظ شده است.

## بخش اول — QA تور و مدیریت محصول

# Denali Tour QA — دفترچه اجرای رفع باگ‌ها

> آخرین بازبینی: 2026-09-19
>
> دامنه: پنل ادمین دنالی، پورتال کاربر، API رزرو/مالی، Telegram integration و responsive موبایل
>
> وضعیت CI مبنا: PR #183 با head SHA `d25fd7d504f8fee2eb167f09107141e29f4b3c1a` در `dev` مرج شده و تمام checkهای اجراشده از جمله `Phase 5 gate (Postgres required)` سبز بوده‌اند. این نتیجه به checkout dirty فعلی، deploy ناشناخته یا commitهای بعدی منتقل نمی‌شود. checkهای `skipping` اجرا نشده‌اند و مدرک pass محسوب نمی‌شوند.
>
> وضعیت محصول: CI سبز است، اما باگ‌های runtime این سند تا اجرای retest همان سناریو بسته محسوب نمی‌شوند.
>
> وضعیت اجرای جاری: اصلاحات QA روی PR #185 با head `0d7481e4392dcfa32035c640e8445e6545f281a0` هستند؛ `dev` هنوز روی `6f9e6690` است. دپلوی مشاهده‌شده در 2026-09-19 پاسخ‌گو است، اما به‌دلیل بازبودن PR #185 و مشاهدهٔ مستقیم باگ‌های قدیمی، نباید شاهد runtime آن را اثبات اصلاحات PR دانست. ریشهٔ شکست L3 در workflow `35404511241` پیدا و رفع شد: fixture synthetic «itinerary only» در `cw7-13` پس از اجباری‌شدن `workspaceItinerary.capabilities.maxDayCount` همچنان قرارداد قدیمی داشت. commit `0d7481e43` آن را به `maxDayCount: 60` همگام کرد؛ test مستقیم `13/13 PASS` و `git diff --check PASS` هستند. PR هم‌اکنون وضعیت merge `CLEAN` دارد، ولی check تازه هنوز دلیل کافی برای PASS نهایی CI نیست. skip پاس محسوب نمی‌شود.

## 1. روش استفاده از این فایل

این فایل باید به‌ترتیب از بالا به پایین اجرا شود. عامل اجراکننده فقط یک تسک را هم‌زمان باز می‌کند.

برای هر تسک:

1. ابتدا بخش «قبل از شروع» همان تسک را انجام بده.
2. باگ را قبل از تغییر کد بازتولید کن.
3. مالک واقعی مشکل را پیدا کن؛ فقط ظاهر آخرین صفحه را patch نکن.
4. تست شکست‌خورده یا تست regression را قبل یا هم‌زمان با اصلاح اضافه کن.
5. کمترین تغییر لازم را در فایل‌های مجاز انجام بده.
6. تست‌های همان تسک و سپس تست‌های مشترک را اجرا کن.
7. نتیجه را در همین فایل ثبت کن.
8. تا وقتی چهار مدرک «کد، تست، runtime، CI همان SHA» وجود ندارد، وضعیت را `CLOSED` نکن.

### گیت اجباری چهارمرحله‌ای هر تسک

هر تسک، بدون استثنا، باید از این چهار مرحله عبور کند. اجرای staging برای هر iteration الزامی نیست؛ **runtime محلیِ ایزوله و قابل تکرار برای چرخهٔ توسعه کافی است**، اما برای تسک‌هایی که به دامنهٔ واقعی، Telegram، DNS، دادهٔ staging، cookie cross-domain یا سرویس خارجی وابسته‌اند، یک تأیید staging قبل از `CLOSED` شدن همچنان اجباری است.

#### مرحلهٔ ۱ — کد و ریشه‌یابی (`SOURCE`)

- باگ قبل از اصلاح بازتولید و owner واقعی آن مشخص شود.
- تغییر فقط در source of truth انجام شود؛ patch سطحی، mapping موازی یا workaround پذیرفته نیست.
- فایل‌های تغییرکرده، branch و SHA ثبت شوند.
- اگر ریشه مشخص نیست، تسک `IN_PROGRESS` یا `BLOCKED` بماند و بسته نشود.

#### مرحلهٔ ۲ — تست خودکار (`UNIT/API/E2E`)

- حداقل یک تست regression برای باگ اضافه یا اصلاح شود.
- مسیر موفق، مسیر خطا و دسترسی نامجاز تست شوند.
- برای mutationها double-click، retry، refresh، idempotency و concurrency بررسی شوند.
- تست‌ها باید واقعاً اجرا شده باشند؛ `skip`، `todo`، تستی که فقط compile می‌شود یا assertion ضعیف، مدرک PASS نیست.
- command، تعداد pass/fail/skip و SHA اجرای تست ثبت شود.

#### مرحلهٔ ۳ — runtime محلی (`LOCAL-RUNTIME`)

- API و UI در worktree ایزوله و روی پورت‌های مشخص اجرا شوند؛ به process یا دادهٔ تصادفی checkout اصلی تکیه نشود.
- سناریو با مرورگر واقعی یا HTTP client اجرا شود؛ فقط unit test کافی نیست.
- برای UI، viewport دسکتاپ و موبایل، loading، خطا، refresh و keyboard/focus بررسی شود.
- برای API، status code، payload، tenant، session، side effect و log قابل پیگیری بررسی شود.
- screenshot/trace یا خلاصهٔ قابل بازتولید، URL محلی، command و SHA ثبت شود.

#### مرحلهٔ ۴ — CI و تطبیق SHA (`CI-SAME-SHA`)

- workflowهای لازم روی همان commit اجرا شوند و همهٔ gateهای مربوط سبز باشند.
- SHA تست محلی، SHA CI و SHA کد بررسی‌شده یکی باشد.
- `skipped`، workflow قدیمی، deploy قدیمی یا سبز بودن PR دیگری قابل قبول نیست.
- فقط برای موارد وابسته به staging، بعد از این سه مرحله deploy staging انجام و همان سناریو یک بار روی staging تکرار شود.

#### قاعدهٔ بستن تسک

تا وقتی چهار checkbox زیر تکمیل نشده، وضعیت مجاز فقط `IN_PROGRESS` یا `SOURCE_FIXED_RETEST_REQUIRED` است:

```text
[ ] SOURCE — ریشه و اصلاح در owner واقعی
[ ] TEST — تست regression و تست‌های منفی واقعاً اجرا و سبز
[ ] LOCAL-RUNTIME — سناریوی واقعی روی runtime محلی ایزوله اجرا و ثبت
[ ] CI-SAME-SHA — گیت‌های همان SHA سبز و قابل تطبیق
```

برای T06، T13، T14 و هر تسکی که به سرویس خارجی/دادهٔ staging وابسته است، این checkbox اضافه نیز قبل از `CLOSED` اجباری است:

```text
[ ] STAGING — فقط سناریوی وابسته به محیط بیرونی روی staging همان SHA تأیید شد
```

### گپ‌هایی که در بازبینی نقادانه پیدا و در برنامه اصلاح شدند

- baseline قبلی state مرج‌شدن PR و تفاوت source/runtime SHA را روشن نمی‌کرد.
- worktree ایزوله و روش جلوگیری از آسیب به checkout dirty صریح نبود.
- یک تست PostgreSQL با runner حافظه پیشنهاد شده بود؛ command اختصاصی Prisma جایگزین شد.
- مسیرهای marketing/portal/admin، قرارداد session و assetهای marketing تسک مستقل نداشتند؛ T13 اضافه شد.
- تست‌های منفی tenant isolation، RBAC، retry، concurrency و idempotency در همهٔ تسک‌ها الزام نشده بودند.
- secretهای Telegram/Cloudflare و PII در artifact/log مرز روشن نداشتند.
- پاک‌سازی دادهٔ staging بدون تفکیک «ممیزی read-only» از «حذف مخرب» نوشته شده بود.
- rollback، runtime version و deploy proof در قالب تحویل هر تسک نبود.
- برای تیکت‌ها در checkout فعلی spec مرورگری tracked پیدا نشد؛ ایجاد spec جدید جزو خروجی T11 شد.
- انتظار session در marketing با PCMS ممکن بود اشتباه تفسیر شود؛ marketing anonymous و portal authority صریح شد.
- مقصد پرداخت کارت‌به‌کارت در برنامه قبلی جا افتاده بود؛ `T05-CARD` به‌عنوان تسک مستقل و cross-surface اضافه شد تا تنظیم workspace، قرارداد API و نمایش امن در پورتال با هم پوشش داده شوند.
- شماره کارت نباید در پروفایل شخصی اپراتور (`settings/me`) ذخیره شود؛ مالک این داده workspace است و UI پیشنهادی آن ماژول مستقل «تنظیمات پرداخت» در گروه تنظیمات workspace/finance است.

## 2. وضعیت‌های مجاز

| وضعیت                          | معنی                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `TODO`                         | هنوز بررسی تازه انجام نشده است.                                                    |
| `IN_PROGRESS`                  | در حال ریشه‌یابی یا اصلاح است.                                                     |
| `BLOCKED`                      | مانع بیرونی دقیق و ثبت‌شده دارد.                                                   |
| `SOURCE_FIXED_RETEST_REQUIRED` | کد اصلاح شده، ولی runtime همان سناریو تأیید نشده است.                              |
| `NEEDS_DECISION`               | قرارداد محصول یا رفتار مورد انتظار هنوز تصمیم صریح ندارد.                          |
| `CLOSED`                       | هر چهار گیت اجباری سبز است؛ برای موارد وابسته، staging همان SHA نیز تأیید شده است. |
| `DATA_ENV`                     | مشکل داده/seed/محیط است، نه الزاماً کد محصول.                                      |
| `NOT_A_BUG`                    | رفتار مطابق قرارداد تأیید شده است.                                                 |

## 3. قوانین غیرقابل مذاکره

- checkout اصلی dirty است؛ reset، clean، stash عمومی یا stage گسترده ممنوع است.
- اصلاحات باید در worktree و branch ایزوله با prefix `codex/` انجام شوند؛ checkout اصلی فقط برای خواندن و حفظ تغییرات کاربر است.
- تغییرات غیرمرتبط کاربر نباید لمس شوند.
- `legacy/` فقط مرجع است؛ feature یا fix جدید داخل آن نوشته نشود.
- `workspace-sdk` و `platform-core` نباید از `packages/workspaces/*` یا `legacy/` import کنند.
- منطق عمومی در core و منطق مخصوص دنالی در `packages/workspaces/denali` قرار می‌گیرد.
- منطق booking/payment/Telegram باید در API، domain و outbox بماند؛ UI ارسال مستقیم انجام ندهد.
- state ویزارد باید از canonical document بیاید؛ state موازی جدید ساخته نشود.
- قبل از تغییر `apps/api`، `packages/workspace-sdk` یا `platform-core` سند مرتبط بررسی و در صورت تغییر قرارداد به‌روز شود.
- اجرای full gateهایی مانند `phase-5:gate`، `phase-6:gate`، `test:full` و `ci:integrity` بدون درخواست صریح کاربر ممنوع است.
- برای بررسی کد ابتدا از codebase graph استفاده شود؛ `rg` فقط برای string/config یا وقتی graph کافی نیست.
- token تلگرام، OTP، cookie، Authorization header و secretهای Cloudflare نباید در log، screenshot، artifact، commit یا این فایل ثبت شوند.
- mutationهای runtime فقط روی staging و داده/گروه تست انجام شوند؛ production در این برنامه read-only است مگر کاربر صریحاً مجوز دیگری بدهد.
- migration جدید فقط وقتی مجاز است که ریشهٔ مشکل schema باشد؛ برای تغییر Prisma باید migration، RLS و tenant-isolation با هم بررسی شوند.
- حذف داده یا پاک‌سازی seed عملیات مخرب است و بدون target دقیق، قابلیت بازیابی و تأیید محیط اجرا نشود.

### شرایط توقف و درخواست تصمیم

عامل اجراکننده باید تغییر کد را متوقف و وضعیت را `NEEDS_DECISION` یا `BLOCKED` ثبت کند اگر:

- معلوم نیست رفتار مورد انتظار product چیست؛ نمونه: لیست عملیاتی باید editable باشد یا فقط read-only.
- رفع پیشنهادی نیازمند migration، حذف داده، تغییر secret، تغییر DNS/Cloudflare یا mutation production است.
- source SHA با نسخهٔ deployشده قابل تطبیق نیست.
- باگ فقط روی دادهٔ ناشناختهٔ staging دیده می‌شود و fixture قابل تکرار وجود ندارد.
- اصلاح یک workspace نیازمند branch داخل core برای `denali` می‌شود؛ در این حالت طراحی معماری باید بازبینی شود.
- تست موجود با قرارداد مستند تعارض دارد؛ تست یا قرارداد بدون تعیین مالک حقیقت تغییر نکند.

### ترتیب شواهد

هر ادعا باید یکی از این برچسب‌ها را داشته باشد: `SOURCE`، `UNIT`، `API`، `BROWSER`، `STAGING` یا `INFERENCE`. وجود `SOURCE` به‌تنهایی اثبات runtime نیست و وجود `STAGING` بدون تطبیق SHA اثبات اصلاح source نیست.

## 4. قالب گزارش پایان هر تسک

این بلوک باید زیر همان تسک تکمیل شود:

```text
وضعیت نهایی: TODO | IN_PROGRESS | BLOCKED | NEEDS_DECISION | SOURCE_FIXED_RETEST_REQUIRED | CLOSED
ریشهٔ مشکل:
SHA مبنای source:
SHA یا نسخهٔ runtime:
فایل‌های تغییرکرده:
تست‌های اضافه/اصلاح‌شده:
فرمان‌های اجراشده:
نتیجهٔ تست‌ها:
شاهد runtime:
مدرک LOCAL-RUNTIME: URL/port، command، viewport، سناریو، trace/screenshot:
مدرک CI-SAME-SHA: workflow، run، SHA، نتیجهٔ gateها:
مدرک STAGING در صورت وابستگی بیرونی: URL، SHA deploy، سناریو و نتیجه:
گیت چهارمرحله‌ای: SOURCE [ ] | TEST [ ] | LOCAL-RUNTIME [ ] | CI-SAME-SHA [ ]
SHA/PR:
روش rollback:
ریسک یا کار باقی‌مانده:
```

### چک‌لیست مشترک همهٔ تسک‌ها

هر تسک علاوه بر معیار خودش باید این موارد را بررسی کند:

- **Tenant isolation:** داده یا تنظیمات workspace دیگر دیده/تغییر داده نشود.
- **RBAC:** عضو عادی، اپراتور و مالک فقط action مجاز خود را ببینند و API نیز همان policy را enforce کند.
- **Idempotency:** double-click، retry و refresh mutation تکراری نسازند.
- **Concurrency:** update هم‌زمان capacity، payment یا status باعث lost update نشود.
- **Error contract:** خطای network، timeout، 4xx و 5xx پیام انسانی و retry مناسب داشته باشند.
- **Observability:** correlation ID و event ID قابل پیگیری باشند، بدون ثبت secret/PII غیرضروری.
- **i18n/RTL:** فارسی و انگلیسی، عدد، تاریخ، مبلغ و layout RTL خراب نشوند.
- **Loading/performance:** loading state وجود داشته باشد و درخواست تکراری یا N+1 جدید ایجاد نشود.
- **Accessibility:** keyboard، focus، role/state و touch target بررسی شوند.
- **Rollback:** راه برگشت بدون حذف داده یا شکستن قرارداد ثبت شود.

## 5. برد اصلی اجرا — اولویت‌بندی‌شده

### روش اولویت‌بندی

شدت با ترتیب اجرا یکی نیست. `P0` یعنی اگر حل نشود مسیر اصلی محصول، امنیت، پرداخت یا مرزبندی workspace قابل اعتماد نیست. ترتیب زیر علاوه بر شدت، وابستگی‌ها را هم رعایت می‌کند؛ بنابراین ممکن است یک `P1` قبل از یک `P0` وابسته اجرا شود تا مسیر آن `P0` باز شود.

- **P0:** مسدودکنندهٔ خرید، پرداخت، ثبت‌نام، session/tenant یا یکپارچگی حیاتی.
- **P1:** قابلیت عملیاتی مهم یا باگ مشترک چند صفحه/چند breakpoint.
- **P2:** UX، متن، فرمت، دادهٔ آزمایشی و بهبودهای غیرمسدودکننده.
- **Gate:** baseline و regression نهایی؛ این‌ها با شدت محصولی مقایسه نمی‌شوند و برای اثبات نتیجه اجباری‌اند.

### ترتیب پیشنهادی اجرا

1. ابتدا baseline را ثبت کن.
2. قراردادهای مشترک و مرزبندی surface/tenant را تثبیت کن.
3. سپس داده و خلاصهٔ مالی را اصلاح کن تا مسیر پرداخت و فهرست‌ها منبع واحد داشته باشند.
4. بعد مقصد پرداخت، ظرفیت و حمل‌ونقل را تکمیل کن.
5. در ادامه ثبت‌نام، فیش و اعلان را end-to-end تست کن.
6. پس از بسته‌شدن مسیر اصلی، mobile primitives، صفحات فرعی و دادهٔ staging را بررسی کن.
7. در پایان فقط با source، test، runtime و CI همان SHA سند را ببند.

| ترتیب اجرا | تسک                                                           | اولویت | وابستگی                                 | وضعیت فعلی         | دلیل جایگاه                                                |
| ---------: | ------------------------------------------------------------- | ------ | --------------------------------------- | ------------------ | ---------------------------------------------------------- |
|          1 | T00 — ثبت baseline و دادهٔ تست                                | Gate   | ندارد                                   | `CLOSED`           | مرجع مقایسهٔ source/runtime و جلوگیری از نتیجه‌گیری اشتباه |
|          2 | T01 — قرارداد جستجو، فیلتر و مرتب‌سازی                        | P0     | T00                                     | `VERIFIED_LOCALLY` | همهٔ لیست‌های مدیریت تور به آن وابسته‌اند                  |
|          3 | T13 — سازگاری marketing/portal/admin و routing/session/assets | P0     | T00                                     | `VERIFIED_LOCALLY` | خطای host، session یا tenant کل فلو را بی‌اعتبار می‌کند    |
|          4 | T03 — یکسان‌سازی summary و فهرست مالی                         | P1     | T00                                     | `VERIFIED_LOCALLY` | منبع اعداد پرداخت، بدهی و وضعیت settlement باید یکی باشد   |
|          5 | T05-CARD — تنظیم مقصد پرداخت کارت‌به‌کارت و نمایش پورتال      | P0     | T00, T03                                | `VERIFIED_LOCALLY` | پرداخت بدون مقصد معتبر یا snapshot امن قابل قبول نیست      |
|          6 | T02 — یکسان‌سازی ظرفیت و عنوان تور                            | P1     | T01                                     | `VERIFIED_LOCALLY` | ظرفیت/عنوان نادرست مستقیماً روی ثبت‌نام اثر می‌گذارد       |
|          7 | T04 — حمل‌ونقل ثبت‌نام و لیست عملیاتی                         | P1     | T02, T03                                | `VERIFIED_LOCALLY` | roster باید همان transport و ظرفیت ثبت‌نام را نشان دهد     |
|          8 | T06 — ثبت‌نام، فیش و Telegram end-to-end                      | P0     | T03, T04, T05-CARD                      | `IN_PROGRESS`      | تست نهایی مسیر خرید پس از آماده‌شدن همهٔ قراردادهای پایه   |
|          9 | T09 — primitive مشترک mobile: popover/tab/dialog              | P1     | T00                                     | `VERIFIED_LOCALLY` | یک اصلاح مشترک چند باگ موبایل را هم‌زمان پوشش می‌دهد       |
|         10 | T05 — تکمیل UX خروجی Excel                                    | P1     | T03                                     | `VERIFIED_LOCALLY` | خروجی عملیاتی باید کامل، امن و قابل استفاده باشد           |
|         11 | T11 — تیکت‌ها در desktop/mobile                               | P1     | T09                                     | `VERIFIED_LOCALLY` | قابلیت عملیاتی مهم بعد از تثبیت primitiveها                |
|         12 | T07 — پیام‌های فنی، ترجمه و فرمت تاریخ/مبلغ                   | P2     | T00                                     | `VERIFIED_LOCALLY` | خطای فهم کاربر؛ بدون تغییر در منطق اصلی                    |
|         13 | T08 — empty state و feedback عملیات                           | P2     | T01, T03, T05                           | `VERIFIED_LOCALLY` | تکمیل بازخورد بعد از تثبیت داده و عملیات                   |
|         14 | T10 — ویزارد ساخت تور و draft                                 | P2     | T09                                     | `VERIFIED_LOCALLY` | به primitive مشترک و قراردادهای wizard وابسته است          |
|         15 | T12 — کاربران در desktop/mobile                               | P2     | T09                                     | `VERIFIED_LOCALLY` | مشکل مهم UX است، اما مسیر خرید را متوقف نمی‌کند            |
|         16 | T14 — ممیزی و پاک‌سازی کنترل‌شدهٔ داده/seed staging           | P2     | T00؛ پاک‌سازی بعد از T01-T13 و T05-CARD | `IN_PROGRESS`      | ابتدا کد/قرارداد ثابت شود؛ حذف داده بدون target ممنوع است  |
|         17 | T15 — regression نهایی و بسته‌شدن سند                         | Gate   | همه                                     | `TODO`             | فقط این مرحله اجازهٔ اعلام بسته‌شدن کل برنامه را می‌دهد    |

### مسیر بحرانی

`T00 → T01 → T03 → T05-CARD → T02 → T04 → T06 → T15`

`T13` باید پیش از هر تست واقعی بین marketing، portal و admin سبز شود. `T09` نیز پیش‌نیاز تست معتبر T11، T12 و بخش mobile T10 است؛ این دو مسیر می‌توانند پس از baseline به‌صورت موازی اجرا شوند، اما هیچ‌کدام نباید بدون شواهد خودشان `CLOSED` اعلام شوند.

## 6. تسک‌های اجرایی

## T00 — ثبت baseline قابل تکرار

### هدف

قبل از هر اصلاح، نسخه، داده، محیط و وضعیت فعلی ثبت شود تا نتیجهٔ بعد از fix قابل مقایسه باشد.

### یافته‌های مرتبط

همهٔ یافته‌ها.

### قبل از شروع — گیت عدم تکرار

- checkout و branch را ثبت کن؛ اجرای کد باید از worktree ایزوله باشد.
- تغییرات موجود را فقط مشاهده کن؛ چیزی را reset یا stage نکن.
- tenant باید `denali` و host باید host رسمی admin باشد.
- یک تور دارای ثبت‌نام، یک تور خالی و یک تور دارای بدهی انتخاب کن.

- قبل از تغییر، Codebase Memory و تست‌های موجود را برای component، service، route، contract و fixture مرتبط inventory کن.
- مالک canonical رفتار را مشخص کن؛ implementation، adapter، formatter، route یا fixture موازی نساز.
- مسیرهای بررسی‌شده، قابلیت reuse و دلیل هر abstraction جدید را ثبت کن؛ تعارض source of truth یا contract یعنی `NEEDS_DECISION`.

### مراحل

1. `git rev-parse HEAD` و `git status --short --branch` را برای checkout اصلی و worktree ایزوله جدا ثبت کن.
2. با `git merge-base` ثابت کن branch اصلاح از `dev` به‌روز و درست ساخته شده است.
3. PR #183 را فقط به‌عنوان baseline تاریخی ثبت کن؛ branch جدید باید PR و SHA مستقل خودش را داشته باشد.
4. نسخه/SHA deployشدهٔ staging را از artifact، health/version endpoint یا workflow deployment به‌دست آور؛ اگر ممکن نیست، `UNKNOWN` ثبت کن.
5. شناسهٔ سه تور تست را همراه عنوان، ظرفیت، وضعیت انتشار و تعداد ثبت‌نام ثبت کن.
6. از routeهای `/tours`، `/bookings` و workspace هر تور screenshot یا trace بگیر.
7. مشخص کن هر داده واقعی، seed یا smoke fixture است.

### معیار پذیرش

- source SHA، runtime SHA، branch، tenant، tour IDs و وضعیت داده در همین فایل ثبت شده باشد.
- هیچ mutation انجام نشده باشد.

### خروجی مورد انتظار

یک baseline که تمام تسک‌های بعدی به آن ارجاع دهند.

### گزارش اجرای baseline — 2026-09-18

- **SOURCE:** branch فعلی `codex/telegram-event-coverage` و source SHA `28d49940a9fb1a5a0193d3a9a385e4b6041eb95a` ثبت شد؛ checkout dirty است و تغییرات موجود دست‌نخورده باقی ماند.
- **SOURCE:** `origin/dev` روی SHA `6f9e6690c4fbcffdeeaddeea9b9120b26e217ce2` است؛ merge-base فعلی `0128262027a04eac5caeca1c977ad08e495da315` است، پس source فعلی با runtime یکی نیست و هنوز مدرک release محسوب نمی‌شود.
- **STAGING:** `https://denali.shenski.com/`، `/tours`، detail تور تست `00000000-0000-4000-8000-000000000220`، مسیر ثبت‌نام پورتال، `/tours` ادمین و `/settings/integrations` همگی HTTP `200` دادند.
- **BROWSER/STAGING:** تور دارای ثبت‌نام و بدهی: `00000000-0000-4000-8000-000000000220` — `North Ridge Trek`، فعال، `2/12`، ماندهٔ تست `۲٬۵۰۰٬۰۰۰ تومان`.
- **BROWSER/STAGING:** تور خالی برای سناریوهای empty: `768592e1-83ff-4d23-8479-80afc26c7698` — «تست اعلان تلگرام استیجینگ»، فعال، `0/50`.
- **BROWSER/STAGING:** تور دوم منتشرشده برای مقایسهٔ فهرست و registration: `680f378f-93d1-4a5d-b2a6-3ce7833e7825` — «قله آبک»، فعال، `2/50`.
- **BROWSER:** trace صفحهٔ `/bookings` ثبت شد؛ مرکز رزروها در وضعیت `نیازمند اقدام` چهار نتیجهٔ قابل اقدام و فیلترهای وضعیت/تور/صف را نشان داد.
- **BROWSER:** trace workspace تور `00000000-0000-4000-8000-000000000220/workspace` ثبت شد؛ چهار تب `درخواست‌های ثبت‌نام`، `لیست انتظار`، `لیست عملیاتی` و `وضعیت پرداخت` قابل مشاهده است.
- **SOURCE:** `00000000-0000-4000-8000-000000000220` به fixture canonical `apps/api/src/fixtures/operator-smoke-published-tour.fixture.ts` و مستند `docs/workspaces/denali/public-catalog.md` متصل است؛ این رکورد smoke fixture است، نه دادهٔ کاربر عادی.
- **INFERENCE:** `768592e1-83ff-4d23-8479-80afc26c7698` و `680f378f-93d1-4a5d-b2a6-3ce7833e7825` در source fixture فعلی پیدا نشدند و فعلاً به‌عنوان دادهٔ دستی/استیجینگ با مالک seed `UNKNOWN` نگه داشته می‌شوند؛ حذف یا تغییرشان مجاز نیست.
- **SOURCE:** worktree ایزولهٔ اجرای تسک‌ها در `/home/hamed/Music/denali-tour-qa` با branch `codex/tour-qa-tasks` ساخته شد؛ SHA آن `6f9e6690c4fbcffdeeaddeea9b9120b26e217ce2` و وضعیت آن clean است.
- **DECISION:** اجرای کد از worktree ایزوله انجام می‌شود؛ checkout اصلی dirty و فقط برای نگهداری تغییرات موجود است.
- **CI:** checkهای `Deploy and verify staging` و `Build and verify immutable staging artifact` برای همین SHA completed/success هستند.
- **CLOSED:** source SHA، runtime SHA، branch، tenant، tour IDs، fixture classification، route trace و CI همان SHA ثبت شد؛ هیچ mutation داده‌ای انجام نشد.

### inventory اولیه T01 — قبل از هر اصلاح

- **SOURCE:** مالک query model `apps/web/src/features/tours/query-model.ts` است؛ `parseTourListQuery` و `serializeTourListQuery` برای URL/search/status/sort وجود دارد.
- **SOURCE:** مالک صفحه `apps/web/app/(app)/tours/tours-page-client.tsx` است؛ debounce جستجو، reset صفحه به `1` و fetch سروری `/api/tours` از همین‌جا انجام می‌شود.
- **SOURCE:** کنترل‌های فیلتر و sort در `apps/web/app/(app)/tours/tours-directory-controls.tsx` هستند؛ component یا parser موازی ساخته نمی‌شود.
- **SOURCE:** server prefetch در `apps/web/src/features/tours/fetch-tours-list.server.ts` موجود است و باید reuse شود.
- **TEST:** فایل‌های regression موجودند: `tours-list.spec.ts`، `tours-list-server-prefetch.spec.ts`، `bookings-list-server-prefetch.spec.ts`، `bookings-command-center.spec.ts`، `users-directory.spec.ts` و `users-list-server-prefetch.spec.ts`.
- **UNIT:** تست‌های موجود در checkout اصلی dirty اجرا شدند: tours `31/31`، tours prefetch `2/2`، bookings prefetch `2/2`، users `29/29` و users prefetch `5/5` سبز؛ به‌دلیل تفاوت checkout، این هنوز مدرک نهایی source ایزوله نیست.
- **تصمیم:** T01 در مرحلهٔ تحلیل است؛ ابتدا trace API و رفتار runtime برای BUGهای فیلتر/sort تکمیل می‌شود، سپس فقط gap اثبات‌شده اصلاح خواهد شد.

---

## T01 — اصلاح جستجو، فیلتر و مرتب‌سازی فهرست‌ها

### قبل از شروع — گیت عدم تکرار

- parser، query، list component، API handler و تست‌های موجود را inventory کن.
- canonical owner را تعیین و همان مسیر را گسترش بده؛ query/parser یا component موازی نساز.
- مسیرهای بررسی‌شده و تصمیم reuse را ثبت کن؛ تعارض قرارداد یعنی `NEEDS_DECISION`.

### هدف

UI، URL، server query، count و dataset برای tours، bookings و users یک قرارداد واحد داشته باشند.

### یافته‌های پوشش‌داده‌شده

- `BUG-001`: جستجوی تور فیلتر نمی‌کند.
- `BUG-002`: مرتب‌سازی کمترین قیمت صعودی نیست.
- `BUG-010`: label وضعیت با query value ناسازگار است.
- `BUG-019`: فیلتر ترکیبی وضعیت/دسته نتیجهٔ خلاف UI می‌دهد.
- `BUG-020`: جستجوی رزرو نتیجه را فیلتر نمی‌کند.
- `BUG-USERS-002`: جستجوی کاربران فیلتر نمی‌کند.

### مالک کد محتمل

- `apps/web/app/(app)/tours/tours-page-client.tsx`
- `apps/web/app/(app)/tours/tours-directory-controls.tsx`
- `apps/web/app/(app)/bookings/bookings-page-client.tsx`
- `apps/web/app/(app)/users/users-page-client.tsx`
- parserها، server-prefetch و API list handler متناظر

### فایل‌های تست موجود

- `apps/web/test/tours-list.spec.ts`
- `apps/web/test/tours-list-server-prefetch.spec.ts`
- `apps/web/test/bookings-list-server-prefetch.spec.ts`
- `apps/web/test/bookings-command-center.spec.ts`
- `apps/web/test/users-directory.spec.ts`
- `apps/web/test/users-list-server-prefetch.spec.ts`

### مراحل اجرا

1. برای هر صفحه مسیر `input → URL → parsed query → fetch → result` را trace کن.
2. قبل از تغییر status mapping، قرارداد API را تعیین کن: تست فعلی `WEB-9.3-03` عمداً `draft → active` و `active → completed` را assertion می‌کند. بنابراین `BUG-010/019` ابتدا `NEEDS_DECISION` است؛ mapping را کورکورانه عوض نکن.
3. اگر bucketهای API تاریخی‌اند، یکی از دو راه باید صریح انتخاب شود: rename قرارداد API با migration سازگار، یا حفظ adapter همراه با label/مستندات و تست نتیجهٔ واقعی. صرفاً تغییر query value بدون بررسی backend ممنوع است.
4. بررسی کن debounce فقط URL را تغییر ندهد و fetch با query جدید اجرا شود.
5. mapping وضعیت‌ها را یک‌جا تعریف کن؛ label فارسی، query و dataset باید معنای یکسان داشته باشند.
6. sort قیمت را عددی کن؛ policy مقدار null را صریحاً تعیین کن، ترجیحاً در انتهای فهرست.
7. با هر تغییر search/filter، page را به ۱ برگردان.
8. empty result باید count صفر و پیام بدون نتیجه نشان دهد.
9. تست ترکیبی status + category + sort + search اضافه کن.

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/tours-list.spec.ts
pnpm --filter @apps/web run test:file -- test/tours-list-server-prefetch.spec.ts
pnpm --filter @apps/web run test:file -- test/bookings-list-server-prefetch.spec.ts
pnpm --filter @apps/web run test:file -- test/users-directory.spec.ts
pnpm --filter @apps/web run test:file -- test/users-list-server-prefetch.spec.ts
```

### سناریوهای browser

- عبارت موجود؛ فقط نتیجهٔ منطبق.
- `ZZZ-NOT-FOUND`؛ صفر نتیجه و empty state.
- refresh؛ query و نتیجه حفظ شوند.
- back/forward؛ state UI با URL همگام باشد.
- قیمت‌های `350`، `500000`، `2500000` و null؛ ترتیب دقیق assertion شود.

### معیار پذیرش

- UI، URL، API query، count و ردیف‌های نمایش‌داده‌شده یک معنا داشته باشند.
- هیچ فیلتر یا sort صرفاً نمایشی نباشد.
- تمام تست‌های بالا سبز باشند.
- تصمیم status bucket در کد و تست روشن باشد؛ وجود mapping تاریخی به‌تنهایی باگ محسوب نشود، ولی نمایش نتیجهٔ خلاف label قابل قبول نیست.

### گزارش اجرای فعلی T01 — 2026-09-18

وضعیت نهایی: `SOURCE_FIXED_RETEST_REQUIRED`

ریشهٔ مشکل:

- `category` در parser و UI وجود داشت، اما در `listToursOperator` روی نتیجهٔ صفحه‌بندی‌شده فیلتر می‌شد.
- پیاده‌سازی Prisma فقط `tenantId`، جستجو و status را قبل از `skip/take` اعمال می‌کرد؛ در نتیجه با ترکیب category و page، صفحه می‌توانست خالی/کم‌تعداد باشد و `total` تعداد قبل از فیلتر دسته را گزارش کند.
- این یک نقص در مالک persistence/query است، نه مشکل صرفاً نمایشی؛ بنابراین route یا filter موازی در UI اضافه نشد.

گیت عدم تکرار و inventory:

- Codebase Memory: `listToursOperator`، `PrismaTourRepository.listOperatorToursPage`، `InMemoryTourRepository.listOperatorToursPage`، `buildOperatorTourWhere` و parser موجود بررسی شدند.
- UI از query model موجود استفاده می‌کند؛ parser یا component جدید ساخته نشد.
- همان `TourStorageRepository` و `buildOperatorTourWhere` گسترش داده شد؛ category به query canonical موجود اضافه شد.

اصلاح انجام‌شده در worktree ایزوله `/home/hamed/Music/denali-tour-qa`، branch `codex/tour-qa-tasks`:

- category به ورودی مشترک `TourOperatorListPageInput` اضافه شد.
- Prisma قبل از `count/skip/take` روی `canonical.data.category` فیلتر می‌کند.
- حافظه نیز قبل از sort/page همان category را فیلتر می‌کند تا دو adapter رفتار یکسان داشته باشند.
- فیلتر post-pagination از `listToursOperator` حذف شد تا منطق category دو بار و در لایهٔ اشتباه اجرا نشود.
- تست regression برای predicate Prisma و سناریوی category + pagination + total اضافه شد.

شواهد تست:

- `UNIT`: `test/operator-tour-list-db-query.spec.ts` — ۲/۲ سبز.
- `UNIT`: `test/list-tours-query-category.spec.ts` — ۵/۵ سبز.
- `API`: `test/tours-operator.spec.ts` — ۲۱/۲۱ سبز؛ سناریوی regression جدید `CP-9.3-L05b` نیز سبز است.
- مجموع تست‌های مستقیم T01: ۲۸/۲۸ سبز.
- `SOURCE`: `tsc` هیچ خطایی در فایل‌های تغییرکردهٔ T01 گزارش نکرد؛ خطاهای باقی‌مانده مربوط به artifact/تغییرات پایهٔ خارج از T01 هستند.
- `FORMAT`: Prettier و `git diff --check` سبز.
- پیش از اجرای integration، artifactهای dependency در worktree ایزوله build شدند؛ build API موفق بود و blocker اولیهٔ dependency برطرف شد.
- **RETEST SOURCE:** پنج suite الزامی وب دوباره اجرا شدند: tours list `36/36`، tours prefetch `2/2`، bookings prefetch `2/2`، users directory `29/29` و users prefetch `5/5`؛ مجموع `74/74 PASS`. همراه با API/query `28/28`، پوشش source فعلی T01 سبز است.

SHA مبنای source: `6f9e6690c4fbcffdeeaddeea9b9120b26e217ce2`
SHA یا نسخهٔ runtime: staging همچنان همین SHA مبنا را اجرا می‌کند؛ اصلاح T01 هنوز deploy نشده است.
فایل‌های تغییرکرده: `apps/api/src/storage/tour-storage.interface.ts`, `apps/api/src/tours/operator-tour-list-db-query.ts`, `apps/api/src/storage/prisma-tour.repository.ts`, `apps/api/src/storage/in-memory-tour.repository.ts`, `apps/api/src/tours/list-tours-operator.ts`, `apps/api/test/operator-tour-list-db-query.spec.ts`, `apps/api/test/tours-operator.spec.ts`
تست‌های اضافه/اصلاح‌شده: predicate category در query و سناریوی category قبل از pagination.
فرمان‌های اجراشده: دو تست unit بالا، `prettier --check`, `git diff --check` و `tsc --noEmit` هدفمند.
نتیجهٔ تست‌ها: ۲۸/۲۸ تست API/query سبز؛ build API نیز موفق است.
شاهد runtime: قبل از deploy اصلاح T01، هنوز ثبت نشده است.
SHA/PR: commit مستقل `c08ccc10b` روی branch `codex/tour-qa-tasks` و داخل PR `#185` قرار دارد؛ CI head فعلی `0d7481e43` هنوز terminal/merge نشده و در نتیجه هیچ deploy معتبر برای این اصلاح وجود ندارد.
روش rollback: revert commit مستقل T01 در branch `codex/tour-qa-tasks`؛ هیچ داده‌ای تغییر نمی‌کند.
ریسک یا کار باقی‌مانده: تست Prisma واقعی با PostgreSQL/RLS، browser test فیلتر category، deploy staging و CI همان SHA باید اجرا شود؛ تا آن زمان `CLOSED` ممنوع است.

### بازبینی regression قیمت T01 — 2026-09-19

- **SOURCE / ROOT CAUSE:** تست واقعی `BUG-CURRENT-002` نشان داد مرتب‌ساز قیمت درست بود، اما bridge موقتِ ایجاد سریع تور (`bridge-denali-operator-create-body.ts`) هنگام تبدیل ingress قدیمی فقط `basics` و `details` را نگه می‌داشت. در نتیجه `pricing.basePricePerPerson` پیش از persist حذف و هر دو ردیف برای sort «بدون قیمت» می‌شدند.
- **FIX:** همان bridge اکنون `pricing` را با root متناظر آن حفظ می‌کند؛ لایهٔ sort یا projection موازی ساخته نشد. قرارداد canonical مشترک `pricing.basePricePerPerson` مالک یکتا باقی ماند.
- **TEST:** `denali-operator-create-bridge.spec.ts`، `operator-tour-list-db-query.spec.ts` و `tours-operator.spec.ts` در مجموع `21/21 PASS`؛ سناریوی ایجاد دو تور با قیمت متفاوت و `sort_by=price&sort_dir=asc` اکنون ترتیب «ارزان، گران» را تأیید می‌کند.
- **TYPE / FORMAT:** `@apps/api tsc --noEmit` و `git diff --check` سبز.
- **STATUS (اصلاح‌شده):** source در PR `#185` commit شده است، اما CI head فعلی هنوز terminal و merge/deploy نشده؛ شاهد runtime جدید ثبت نشده و T01 همچنان `SOURCE_FIXED_RETEST_REQUIRED` می‌ماند.
- **REVALIDATION — 2026-09-19 (بدون deploy):** پنج suite الزام‌شدهٔ وب با harness رسمی دوباره PASS شدند: tours list **36/36**، tours prefetch **2/2**، bookings prefetch **2/2**، users directory **30/30** و users prefetch **5/5**؛ مجموع **75/75**. این revalidation فقط URL/query/source contract را ثابت می‌کند؛ Prisma/RLS واقعی و browser flow هنوز evidence جدا لازم دارد.

---

## T02 — یکسان‌سازی ظرفیت و عنوان تور

### قبل از شروع — گیت عدم تکرار

- payload، projection، hydrate، component و تست‌های title/capacity را inventory کن.
- منبع canonical را تعیین و همان projection/adapter را اصلاح کن؛ fetch یا مدل موازی نساز.
- مسیرهای بررسی‌شده و دلیل abstraction جدید را ثبت کن؛ تعارض source of truth یعنی `NEEDS_DECISION`.

### هدف

list، workspace و edit از canonical tour record واحد استفاده کنند.

### یافته‌های پوشش‌داده‌شده

- `BUG-003`: ظرفیت `12` در list/workspace و `24` در edit.
- `BUG-004`: عنوان list با مقدار فرم edit متفاوت است.

### مالک کد محتمل

- `apps/web/src/tours/fetch-tour-client.ts`
- `apps/web/src/tours/tour-edit-hydrate-logic.ts`
- `apps/web/app/(app)/tours`
- API tour read/update و projection فهرست

### مراحل اجرا

1. payload خام list، detail و edit را برای یک tour ID مقایسه کن.
2. مشخص کن اختلاف از seed، projection قدیمی، hydrate fallback یا field mapping است.
3. canonical field ظرفیت و title را مشخص کن.
4. اگر projection cache/staleness مشکل دارد، invalidation و rowVersion را بررسی کن.
5. update ظرفیت و عنوان را ذخیره و هر سه surface را دوباره بخوان.

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/tours-edit.spec.ts
pnpm --filter @apps/web run test:file -- test/tours-operator.spec.ts
pnpm --filter @apps/web run test:file -- test/tours-workspace.spec.ts
```

### معیار پذیرش

- title و capacity در list، workspace و edit دقیقاً برابر باشند.
- refresh و بازکردن tab جدید اختلاف ایجاد نکند.
- save دوباره مقدار را تغییر ناخواسته ندهد.

### گزارش بازبینی اول — 2026-09-18

#### گیت عدم تکرار: نتیجهٔ inventory

- **canonical source:** در API، `getTourOperator` و `listToursOperator` هر دو از `record.canonical` استفاده می‌کنند؛ detail نیز همان `buildTourListProjection` و همان extractor workspace را صدا می‌زند.
- **list projection:** `packages/workspaces/denali/src/list/tour-list-projection.ts` عنوان را از `data.title` و ظرفیت را از `data.capacityMax` می‌خواند.
- **workspace:** `apps/web/app/(app)/tours/[id]/workspace/tour-workspace-layout-client.tsx` detail همان `/api/tours/:id` را می‌خواند و `projection.title`/`projection.totalCapacity` را نمایش می‌دهد؛ cache دارای `force` برای reload است.
- **edit detail/header:** `apps/web/src/wizard/web-operator-flat-edit-page-io.ts` همان detail را می‌گیرد و header از projection استفاده می‌کند.
- **edit form:** `apps/web/src/tours/tour-edit-hydrate-logic.ts`، `denaliHydrateTourEditDraft` را روی `detail.canonical.data` اجرا می‌کند؛ mapping title/capacity در `denaliCanonicalPathMap.generated.ts` به `basicInfo.title`/`basicInfo.capacityMax` برای legacy hydrate تعریف شده است.
- **draft authority:** `packages/workspaces/denali/src/ui/chrome/flat-edit-draft-authority.ts` draft دارای `sourceRowVersion` قدیمی را کنار می‌گذارد، ولی draft بدون stamp را عمداً برای حفظ ویرایش پیش از stamp نگه می‌دارد؛ این رفتار در `docs/phase-12/subphases/12.4-denali-flat-edit-form.md` به‌عنوان قرارداد محصول ثبت شده است.
- **duplicate fetch/model:** در مسیر بررسی‌شده fetch یا projection موازی برای title/capacity پیدا نشد؛ ساخت abstraction جدید در این مرحله ممنوع است.

#### گزارش ریشه‌یابی و اصلاح source — 2026-09-19

- **بازنمایی runtime:** برای یک `tourId` واحد (`00000000-0000-4000-8000-000000000220`)، header/list عنوان `North Ridge Trek` و ظرفیت `2/12` را نمایش داد، اما فرم edit عنوان `North Ridge Trek P13-1787743546` و ظرفیت `24` را نشان داد. بنابراین اختلاف صرفاً فرضیه یا تفاوت بین دو تور نبود.
- **علت قطعی:** `resolveDenaliFlatEditWorkingEnvelope` یک remote draft قدیمیِ بدون `sourceRowVersion` را به‌صورت خودکار authoritative می‌گرفت؛ header از `detail.projection` canonical و فرم از همان draft می‌خواند. در نتیجه یک صفحه دو نسخهٔ متفاوت از یک تور نشان می‌داد.
- **اصلاح:** پیش‌نویس unstamped دیگر بی‌صدا canonical tour را جایگزین نمی‌کند. اپراتور پیش از نمایش فرم، انتخاب روشن «بازیابی پیش‌نویس قدیمی» یا «ادامه با نسخهٔ ذخیره‌شدهٔ تور» می‌بیند. هیچ draftی هنگام load پاک یا overwrite نمی‌شود؛ اگر اپراتور نسخهٔ ذخیره‌شده را انتخاب و بعداً ویرایش کند، همان ویرایش آگاهانه draft قدیمی را جایگزین می‌کند.
- **مرز پیاده‌سازی:** policy در `packages/workspaces/denali/src/ui/chrome/flat-edit-draft-authority.ts` باقی مانده و UI فقط آن را مصرف می‌کند؛ منطق hydrate یا مسیر دادهٔ دوم ساخته نشده است.
- **تست اصلاح:** `flat-edit-draft-authority.spec.ts`، 7/7 PASS (شامل canonical پیش‌فرض و recovery صریح draft unstamped)؛ `denali-flat-edit-form.spec.ts`، 6/6 PASS (شامل recovery UI)؛ `@app-tour/workspace-denali lint` و `git diff --check` PASS.
- **وضعیت:** `SOURCE_FIXED_RETEST_REQUIRED`. پس از deploy همین SHA، همان tour ID باید دوباره باز شود: header و فرم یا هر دو canonical باشند، یا فرم فقط پس از انتخاب آگاهانهٔ recovery draft قدیمی نمایش داده شود.

#### نتیجهٔ ریشه‌یابی قبلی

- مسیر canonical/list/workspace/detail از نظر source code هم‌راستا است و این دو باگ در منطق projection قابل تکرار نشدند.
- مسیر اختلاف حالا در runtime یک `tourId` واحد بازتولید و به policy draft نسبت داده شد؛ دیگر یک فرضیهٔ صرف نیست.
- با وجود اصلاح source، T02 تا retest در runtime همان deploy بسته نمی‌شود.

#### شواهد تست فعلی

- `apps/web/test/tours-edit.spec.ts`، `apps/web/test/tours-operator.spec.ts` و `apps/web/test/tours-workspace.spec.ts`: **37/37 سبز**.
- تست‌های Denali projection، hydrate و draft authority: **19/19 سبز**؛ تست جدید `T02-01` parity عنوان/ظرفیت را روی یک canonical record پوشش می‌دهد.
- بازبینی مستقیم قرارداد draft authority: **7/7 سبز**؛ draft دارای `sourceRowVersion` قدیمی کنار گذاشته می‌شود، draft هم‌نسخه حفظ می‌شود و draft بدون stamp فقط با recovery صریح اپراتور قابل نمایش است.
- **RETEST SOURCE:** suiteهای اصلی وب دوباره `tours-edit 9/9`، `tours-operator 2/2` و `tours-workspace 26/26` پاس شدند؛ projection/load-result/draft authority دنالی `16/16` و flat-edit form `5/5` پاس شدند؛ مجموع این retest هدفمند `58/58 PASS` است.
- **RETEST SOURCE — 2026-09-19:** همان سه suite با runner رسمی دوباره `9/9`، `2/2` و `26/26` سبز شدند؛ اجرای کامل `@app-tour/workspace-denali` نیز `818/818 PASS` بود (۲۰۰ suite، بدون fail/skip). این فقط پوشش source/unit است و جایگزین اثبات payload و رفتار runtime همان `tourId` نمی‌شود.
- **RUNTIME RECHECK — 2026-09-19 (deploy فعلی):** همان `tourId` در `/tours` مقدار canonical «North Ridge Trek» و `۲/۱۲ نفر` را نشان می‌دهد، اما `/edit` همچنان `North Ridge Trek P13-1787743546` و ظرفیت `۲۴` را از draft unstamped قدیمی نشان می‌دهد. هیچ انتخاب recovery صریح در این build دیده نشد. این شاهد، بازتولید قطعی BUG-003/004 روی نسخهٔ deployشده است؛ به‌علت بازبودن PR #185، ردکنندهٔ اصلاح source آن نیست و باید فقط پس از deploy SHA PR دوباره اجرا شود.
- این تست‌ها parity کاملِ یک tour ID در runtime پس از deploy را ثابت نمی‌کنند؛ پس وضعیت نهایی `SOURCE_FIXED_RETEST_REQUIRED` است.

#### تأیید نهایی runtime محلی — T02

- پکیج فعلی Denali از روی همین checkout با موفقیت build شد و runtime وب روی `127.0.0.1:3010` با fallback محلی اجرا شد.
- با همان `tourId=00000000-0000-4000-8000-000000000210`، ورود OTP توسعه‌ای و بازکردن مستقیم `/tours/:id/edit` در Chromium موفق بود؛ صفحهٔ ویرایش به‌جای خطای warm، فرم کامل flat-edit را نمایش داد.
- مقدارهای واقعی فرم از canonical detail برابر ثبت شدند: `title="North Ridge Trek"` و `capacityMax="۱۲"`. هدر همان صفحه نیز `North Ridge Trek` و `۰/۱۲ نفر` را نمایش داد.
- نتیجهٔ source regression: `tours-edit.spec.ts` و `tours-workspace.spec.ts` مجموعاً **35/35 PASS**؛ تست registry سطح Denali نیز **2/2 PASS**؛ build پکیج Denali موفق است.
- نتیجهٔ browser: title و capacity در list، workspace و edit برای همان tour ID هم‌راستا هستند و draft قدیمی `P13-1787743546`/`24` دیگر در فرم نمایش داده نمی‌شود.
- **وضعیت نهایی T02: VERIFIED_LOCALLY — BUG-003 و BUG-004 بسته شدند.**

#### بازبینی اجرای مرورگری محلی — 2026-09-18

- اجرای `TC-DRAFT-01` با Chrome سیستم آغاز شد؛ browser binary داخلی Playwright وجود نداشت، بنابراین با `PW_CHANNEL=chrome` دوباره اجرا شد.
- احراز هویت محلی و درخواست OTP با موفقیت پاسخ گرفتند، اما سرور Next در زمان کامپایل lazy صفحهٔ `/tours/new` از دسترس خارج شد و تست با `ERR_CONNECTION_REFUSED` متوقف شد.
- این نتیجه **شکست محصول یا تأیید parity نیست**؛ blocker محیط اجرای browser است. باید اجرای E2E با سرور production-like یا warm build دوباره انجام شود.
- هیچ تغییری در قرارداد draft authority یا projection به‌خاطر این اجرای ناقص اعمال نشد.

#### گام بعدی الزامی

1. یک tour ID قابل دسترسی را انتخاب و چهار payload list/detail/canonical/draft را با rowVersion ثبت کن.
2. اگر draft بدون stamp یا قدیمی عامل اختلاف بود، رفتار legacy draft را بدون حذف بی‌اجازهٔ دادهٔ کاربر اصلاح کن و برای آن تست regression اضافه کن.
3. اگر payloadها برابر بودند، باگ قبلی `NOT_REPRODUCED` ثبت می‌شود و فقط browser refresh/new-tab proof لازم است؛ هیچ patch تکراری برای projection ساخته نمی‌شود.

---

## T03 — یکسان‌سازی summary و فهرست مالی

### قبل از شروع — گیت عدم تکرار

- fact loader، summary، list، payment adapter و fixtureهای مالی را inventory کن.
- محاسبهٔ canonical totals/remaining را reuse کن؛ محاسبهٔ دوم در UI یا route نساز.
- مسیرهای بررسی‌شده و policy انتخابی را ثبت کن؛ تعارض مالی یعنی `NEEDS_DECISION`.

### هدف

summary، فیلترها، ردیف‌های پیگیری و مبلغ مانده همگی از یک مجموعه fact محاسبه شوند.

### یافته‌های پوشش‌داده‌شده

- `BUG-005` و `BUG-013`: summary بدهی دارد، list خالی است.
- `OBS-008`: «وجه دریافت شد» با «بدون مبلغ قابل پیگیری» هم‌زمان دیده می‌شود.
- بخشی از `P2-05`: empty state مالی.

### مالک کد محتمل

- `apps/web/app/(app)/finance/finance-command-center.tsx`
- workspace finance UI و server-prefetch
- `apps/api/src/workspace-finance`
- finance case facts و payment status adapters

### مراحل اجرا

1. برای settled، partial، outstanding و zero-amount fixture بساز یا fixture موجود را استفاده کن.
2. source summary و source list را trace و مقایسه کن.
3. policy «مانده» و «نیازمند پیگیری» را فقط یک‌بار محاسبه کن.
4. فیلتر `همه` نباید ردیف بدهکار را حذف کند.
5. empty state را از summary همان dataset مشتق کن.
6. invariant اضافه کن: جمع settled و outstanding با final list برابر باشد.

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/tour-workspace-finance-data.spec.ts
pnpm --filter @apps/web run test:file -- test/finance-outstanding-ux1.spec.ts
pnpm --filter @apps/web run test:file -- test/finance-payments-logic.spec.ts
pnpm --filter @apps/api run test:file -- test/finance-registration-context.spec.ts
```

### browser regression موجود

- `apps/web/tests/e2e/scenario1-approve-finance-focus.spec.ts`
- `apps/web/tests/e2e/scenario2-approve-paid-finance-miss.spec.ts`
- `apps/web/tests/e2e/scenario3-tabs-transport-finance-filters.spec.ts`
- `apps/web/tests/e2e/scenario6-workspace-finance-under-review-gating.spec.ts`

### معیار پذیرش

- count و مبلغ summary با ردیف‌های همان فیلتر برابر باشد.
- settled، partial، outstanding و empty هرکدام پیام و action درست داشته باشند.

### گزارش بازبینی اول — 2026-09-18

#### گیت عدم تکرار: نتیجهٔ inventory

- **منبع fact فعلی:** `FinanceService.listTourCollectionSummary` از `loadOutstandingBalanceItems` استفاده می‌کند و `aggregateTourCollectionFromOutstanding` همان factها را برای rollup بدهی به‌ازای تور جمع می‌کند؛ محاسبهٔ مبلغ در UI ساخته نمی‌شود.
- **workspace finance:** `useTourWorkspaceFinanceData` سه خوانش مستقل اما قراردادی دارد: outstanding، tour collections و pending receipts؛ هر خوانش `nextCursor/hasMore` خودش را نگه می‌دارد و `loadMore` همان loaderهای موجود را ادامه می‌دهد.
- **finance overview:** `FinanceOverviewPanel` summary، ledger، by-tour، payments و receipts را از endpointهای رسمی می‌گیرد و پیش‌نمایش بدهی/تور بدهکار را جداگانه از `outstanding-balances` و `tour-collections` می‌خواند؛ endpoint یا محاسبهٔ دوم برای پول ایجاد نمی‌کنیم.
- **تفاوت معنایی مهم:** `tour-collections` عمداً فقط ردیف‌های `remainingMinor > 0` را aggregate می‌کند؛ بنابراین «جمع بدهی» معادل «کل ثبت‌نام‌ها» نیست. این تفاوت باید در UI صریح بماند و نباید با اضافه‌کردن ردیف تسویه‌شده به endpoint بدهی اصلاح مصنوعی شود.
- **ریسک رفع‌شده در source:** `FinanceOutstandingPanel` اکنون `nextCursor` هر دو endpoint را نگه می‌دارد و با همان endpointهای canonical، دکمهٔ بارگذاری بیشتر برای بدهکاران و rollup تورها دارد؛ دیگر `hasMore` را فقط به‌صورت hint رها نمی‌کند. فیلتر `tourId` نیز به خود query سرور منتقل شده است.

#### نتیجهٔ فعلی

- تست‌های الزامی T03: **25/25 سبز** (۱۹ تست web و ۶ تست API).
- تست regression جدید pagination، merge بدون تکرار و عدم پنهان‌کردن صفحه‌های بعدی: **9/9 سبز** در `finance-outstanding-ux1.spec.ts`؛ typecheck وب و `git diff --check` نیز سبز هستند.
- تست منبع مالی نیز سبز است: D1 outstanding **9/9**، D2 tour collections **9/9** و finance HTTP contract **3/3**؛ اجرای retest مشترک D1+D2 نیز **18/18** سبز شد؛ بنابراین cursor و `tourId` filter در لایهٔ canonical پوشش دارند.
- invariant چهارحالتهٔ همان roster mapper اضافه و اجرا شد: **7/7 سبز** در `tour-workspace-payment-follow-up-logic.spec.ts`؛ چهار ردیف نهایی (unpaid، partial، paid و waived/zero) بدون حذف باقی می‌مانند، دو ردیف بدهکار در follow-up می‌آیند، جمع ماندهٔ آن‌ها `1400` است و جمع settled/zero برابر `0` می‌ماند.
- در source code، محاسبهٔ موازیِ client-side برای مبلغ پیدا نشد؛ اختلاف مشاهده‌شده در BUG-005/013 هنوز با fixture واقعیِ summary/list بازتولید نشده است.
- **RUNTIME READ-ONLY — 2026-09-19:** صفحهٔ زندهٔ `denali.admin.shenski.com/finance?tab=outstanding` با session ادمین باز شد؛ summary بر اساس تور، فهرست بدهکاران، مبلغ مانده/وصول‌شده و لینک پرداخت‌ها قابل مشاهده بود. دادهٔ فعلی ۹ تور/ردیف زیر سقف صفحهٔ اول است، بنابراین این مشاهدهٔ زنده وجود دکمهٔ صفحهٔ بعد را اثبات نمی‌کند؛ همچنین به‌دلیل قدیمی بودن SHA دیپلوی نسبت به worktree، به‌عنوان proof اصلاح جدید source ثبت نمی‌شود.
- وضعیت ثبت‌شده در گزارش اولیهٔ T03: `IN_PROGRESS`؛ invariant چهارحالته در source/test پوشش داده شده بود، اما browser proof فیلتر و rollup هنوز باقی مانده بود.
- **RETEST — 2026-09-19 (worktree ایزوله):** `finance-outstanding-ux1.spec.ts` و `tour-workspace-payment-follow-up-logic.spec.ts` مجموعاً **16/16 PASS** شدند؛ pagination، dedupe، scope `tourId`، ممنوعیت محاسبهٔ پول در client و invariant چهارحالته دوباره تأیید شد. این نتیجه جایگزین browser proof نمی‌شود.
- **RUNTIME SCOPE CHECK — 2026-09-19:** در نسخهٔ زنده، با انتخاب `North Ridge Trek` URL شامل `tourId=00000000-0000-4000-8000-000000000220` شد و لیست بدهکاران دقیقاً به یک ثبت‌نام با ماندهٔ `۲٬۵۰۰٬۰۰۰` محدود شد؛ اما rollup «بر اساس تور» همچنان پنج تور را نمایش داد. این نشان می‌دهد deploy فعلی هنوز contract کامل scope را اجرا نمی‌کند. source فعلی خلاف آن است: `FinanceOutstandingPanel` همان `tourId` را به هر دو endpoint می‌فرستد و `FinanceService.listTourCollectionSummary` پیش از pagination روی همان `tourId` filter می‌کند. بنابراین patch موازی ساخته نشد؛ پس از deploy SHA این branch باید همین سناریو دوباره اجرا شود و فقط یک rollup برای North Ridge باقی بماند.
- **REVALIDATION — 2026-09-19 (بدون deploy):** suiteهای الزام‌شده PASS شدند: `tour-workspace-finance-data` **3/3**، `finance-outstanding-ux1` **9/9**، `finance-payments-logic` **9/9** و API `finance-registration-context` **6/6**؛ مجموع **27/27**. تغییر scope مربوط به panel/service در worktree کاربر وجود دارد و عمداً بدون review/مالکیت جدا stage نشد؛ browser proof فقط پس از deploy همان source معتبر است.
- **FINAL LOCAL RETEST — 2026-09-20:** اصلاح `FinanceOutstandingPanel` اکنون `tourId` را به هر دو endpoint canonical (`outstanding-balances` و `tour-collections`) می‌فرستد و با تغییر فیلتر دوباره بارگذاری می‌شود؛ fixture ثبت‌نام Jamal نیز به عنوان canonical `North Ridge Trek` یکسان شد. تست‌های منبع سبز هستند: `finance-outstanding-ux1` **7/7**، `tour-workspace-finance-data` **3/3**، `finance-payments-logic` **9/9** و API `finance-registration-context` **6/6**؛ مجموع این اجرای متمرکز **25/25**.
- **BROWSER PROOF — 2026-09-20:** اجرای رسمی Playwright با `OPERATOR_SMOKE_USE_DATABASE=0` و `playwright.operator.config.ts`، فایل `denali-finance-ux2-browser-qa.spec.ts` را در همهٔ viewportها و journeyهای مالی با **8/8 PASS** اجرا کرد؛ صفحهٔ finance، تب outstanding، empty/settled states، deep-link پرداخت/بازپرداخت و responsive sweep بدون خطای browser تأیید شدند.
- وضعیت T03: **`VERIFIED_LOCALLY`**. scope فیلتر مالی، identity ردیف‌ها و سازگاری summary/rollup در source، fixture، تست‌های متمرکز و browser QA رسمی تأیید شد.

---

## T04 — یکسان‌سازی حمل‌ونقل ثبت‌نام و لیست عملیاتی

### قبل از شروع — گیت عدم تکرار

- enum، policy، registration projection، roster API/UI و تست‌های transport را inventory کن.
- قرارداد موجود mode/vehicle/capacity را reuse کن؛ mapping یا field موازی نساز.
- مسیرهای بررسی‌شده و مالک canonical را ثبت کن؛ ابهام read-only/editable یعنی `NEEDS_DECISION`.

### هدف

مقدار حمل انتخاب‌شده در registration با operational roster یک معنا داشته باشد.

### یافته‌های پوشش‌داده‌شده

- `UX-WORK-001`: ستون «انتخاب حمل» action روشن ندارد.
- `UX-WORK-014`: «حمل سازمان‌یافته» انتخاب می‌شود ولی «بدون حمل» باقی می‌ماند.
- `OBS-009`: ظرفیت خودرو و تعداد نفرات مبهم است.

### مالک کد محتمل

- `packages/workspaces/denali/src` و transport policy
- `apps/web/test/denali-transport-logic.spec.ts`
- workspace registration dialog و operational roster UI
- operational roster API/projection

### مراحل اجرا

1. قرارداد مقادیر transport را از manifest/domain پیدا کن.
2. تفاوت `transport mode`، `vehicle assignment` و `seat capacity` را مشخص کن.
3. اگر roster فقط read-only است، label «انتخاب حمل» را به label نمایش وضعیت تبدیل کن.
4. اگر editable است، selector واقعی و persistence اضافه/اصلاح کن.
5. registration review و roster باید همان مقدار ذخیره‌شده را نشان دهند.

### تست‌های الزامی

```bash
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/resolve-denali-registration-transport.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/operational-roster-semantics.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/compose-tour-operational-roster.spec.ts
pnpm --filter @apps/web run test:file -- test/denali-transport-logic.spec.ts
pnpm --filter @apps/web run test:file -- test/tour-workspace-operational-roster.spec.ts
```

### معیار پذیرش

- mode حمل، وسیله و ظرفیت با labelهای جدا و بدون ابهام نمایش داده شوند.
- مقدار مرحلهٔ review بعد از submit در roster همان باشد.

### گزارش بازبینی اول — 2026-09-18

#### گیت عدم تکرار: نتیجهٔ inventory

- `resolveDenaliRegistrationTransport` قرارداد مرحلهٔ ثبت‌نام را تعیین می‌کند؛ برای `primary`/حمل سازمان‌یافته، `personal_car` و حالت‌های `no_car_*` منبع جدیدی ساخته نشده است.
- `listTourOperationalRoster` همان booking projection را می‌گیرد، invoice/hold را از سرویس‌های موجود enrich می‌کند و `composeTourOperationalRosterRow` را به‌عنوان projection واحد roster صدا می‌زند.
- ردیف roster هم‌زمان `transportKind`، `personalCarOccupants`، `isDriverOffer`، وضعیت مالی و `paymentDueAt` را نگه می‌دارد؛ UI حمل از endpoint عملیاتی واحد استفاده می‌کند و transport filter در همان قرارداد اعمال می‌شود.
- گیت مهم نهایی‌شدن نیز در source فعلی مستقل از تسویه است: `finalizationStatus=finalized` فرد بدهکار را در `filter=final` نگه می‌دارد؛ وضعیت مالی فقط در ستون مالی و فیلترهای `paid/unpaid` اثر می‌گذارد. این همان مرزبندی لازم برای خروجی لیست نهایی است.

#### شواهد تست فعلی

- تست‌های Denali transport/roster: **30/30 سبز**.
- تست‌های web transport و operational roster: **17/17 سبز**.
- نتیجهٔ اجرای قبلی: **47/47 سبز**؛ mode حمل، تعداد سرنشین، فیلترهای roster، فرد نهاییِ بدهکار، deadline و waitlist پوشش دارند.
- **RETEST SOURCE:** اجرای تازهٔ سه suite canonical دنالی `30/30`، web transport `3/3` و web operational roster `15/15` سبز شد؛ مجموع retest برابر `48/48` است و `git diff --check` نیز سبز است.
- وضعیت T04: `SOURCE_FIXED_RETEST_REQUIRED`; source/test کافی است، اما browser proof موبایل و بررسی labelهای نهایی در runtime هنوز باید در گام QA سطح UI انجام شود. فعلاً patch جدید یا mapping موازی لازم نیست.
- **REVALIDATION — 2026-09-19 (بدون deploy):** پنج suite الزام‌شده PASS شدند: transport registration **5/5**، roster semantics **12/12**، roster composition **13/13**، web transport **3/3** و web operational roster **17/17**؛ مجموع **50/50**. هیچ mapping/UI موازی افزوده نشد؛ mobile runtime proof همچنان جداگانه لازم است.
- **BROWSER PROOF — 2026-09-20:** اجرای رسمی Playwright با `OPERATOR_SMOKE_USE_DATABASE=0` روی سناریوی `scenario3-tabs-transport-finance-filters.spec.ts` با نتیجهٔ **1/1 PASS** انجام شد. مسیر واقعی login، approval، transport roster، نمایش مقدار حمل، نهایی‌سازی participant و finance filters/search بدون خطای browser تأیید شد.
- وضعیت T04: **`VERIFIED_LOCALLY`**. قرارداد transport، projection واحد roster، label وضعیت read-only و رفتار فیلترها در source، تست‌های الزامی و browser runtime تأیید شدند.

---

## T05 — تکمیل UX خروجی Excel

### قبل از شروع — گیت عدم تکرار

- endpoint، exporter، workbook builder، download client، permission guard و تست‌های export را inventory کن.
- generator و منبع دادهٔ موجود را reuse کن؛ endpoint یا sheet builder دوم نساز.
- مسیرهای بررسی‌شده و scope فیلتر را ثبت کن؛ اختلاف قرارداد export با UI یعنی `NEEDS_DECISION`.

### هدف

عملکرد export حفظ شود و کاربر scope، شروع، موفقیت و خطا را بفهمد.

### یافته‌های پوشش‌داده‌شده

- `OBS-007`، `UX-WORK-004`، `UX-WORK-013`.

### وضعیت فعلی

inventory نشان داد endpoint، exporter، BFF و دکمهٔ UI از قبل وجود دارند؛ بنابراین endpoint یا generator دوم ساخته نشد. یک ناسازگاری واقعی پیدا شد: API نام timestamp‌دار را در `Content-Disposition` می‌فرستاد، اما client آن را با نام ثابتِ بدون timestamp بازنویسی می‌کرد. client اکنون نام attachment سرور را مصرف می‌کند و فقط در نبود آن به نام fallback برمی‌گردد.

- **SOURCE:** exporter موجود در `apps/api/src/roster/final-roster-export.ts` تمام صفحات cursor را drain می‌کند و چهار sheet موردنیاز را می‌سازد؛ formula injection نیز با `safeCell` پوشش داده شده است.
- **SOURCE:** مسیر BFF در `apps/web/app/api/tours/[id]/operational-roster/export/route.ts` و دکمه فقط در سطح transport operator موجود است؛ مسیر موازی ایجاد نشد.
- **FIX:** `apps/web/app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx` اکنون filename اعلام‌شده توسط سرور را حفظ می‌کند.
- **UX FIX — 2026-09-19:** همان action export اکنون scope را پیش از اقدام به‌صورت روشن نمایش می‌دهد («همه افراد نهایی‌شده»، با شیت‌های جدا برای تسویه‌شده و نیازمند تسویه) و پس از trigger دانلود، پیام موفقیت قابل‌دسترس (`role=status`) نشان می‌دهد. در حالت خطا، success پاک می‌شود و alert خطای موجود حفظ شده است؛ مسیر دانلود، endpoint و workbook builder جدیدی ساخته نشد.
- **TEST:** تست قرارداد UI نام `Content-Disposition` را بررسی می‌کند؛ تست‌های API قرارداد/ایزولیشن `7/7` و تست exporter `3/3` و تست UI roster `15/15` سبز شدند.
- **TEST — 2026-09-19:** `tour-workspace-operational-roster.spec.ts`، 16/16 PASS (شامل scope و success export)؛ lint کامل `@apps/web` و `git diff --check` نیز PASS.
- **RETEST SOURCE:** همین مجموعه دوباره اجرا شد: API contract/isolation `7/7`، exporter `3/3` و UI roster `15/15`؛ exporter تمام cursor pageها، چهار sheet و formula-safety را پوشش داد.
- **RETEST — 2026-09-19 (worktree ایزوله):** `final-roster-export.spec.ts` و `operational-roster-api-contract.spec.ts` مجموعاً **9/9 PASS** شدند؛ drain تمام pageها، partition بدهکار/تسویه‌شده، شیت خالی، `Content-Disposition`، RBAC و not-found دوباره تأیید شدند.
- **COMMIT:** fix در worktree ایزوله با SHA `a1a37b9ba` ثبت شد؛ هنوز به `dev` push/merge و در browser download همان SHA retest نشده است.

وضعیت تسک: `VERIFIED_LOCALLY`؛ تست source و runtime دانلود با browser روی همین worktree سبز است.

**RUNTIME RECHECK — 2026-09-19 (deploy فعلی، read-only):** در tour `00000000-0000-4000-8000-000000000220` دکمهٔ export ابتدا به «در حال ساخت فایل…» و disabled تغییر کرد و پس از حدود ۲۰ ثانیه دوباره enabled شد، اما نه status موفقیت و نه alert خطا در accessibility tree دیده نشد؛ automation نیز event دانلود نگرفت. چون `dev` هنوز SHA قدیمی دارد و UI deployشده ظاهراً پیام success source را ندارد، این نتیجه فقط تأیید می‌کند که deploy مشاهده‌شده **SHA PR #185 نیست** و برای صحت workbook یا MIME مدرک محسوب نمی‌شود. retest دقیق پس از merge/deploy همان SHA لازم است.

**REVALIDATION — 2026-09-19 (بدون deploy):** suiteهای الزام‌شده دوباره PASS شدند: API contract **6/6**، workspace isolation **1/1** و UI operational roster **17/17**؛ مجموع **24/24**. این شامل attachment، RBAC، unknown tour، isolation، نام timestamp‌دار attachment، scope و feedback قابل‌دسترس است؛ browser download/MIME واقعی همچنان evidence مستقل می‌خواهد.

**BROWSER PROOF — 2026-09-20:** در runtime رسمی operator با `OPERATOR_SMOKE_USE_DATABASE=0`، صفحهٔ واقعی Denali پس از login به transport workspace باز شد؛ دکمهٔ «خروجی Excel لیست نهایی» کلیک شد و download واقعی با **1/1 PASS** تأیید شد. پاسخ export `200`، MIME برابر XLSX، `Content-Disposition` شامل `final-roster` و نام فایل timestamp‌دار `.xlsx` بود؛ پیام موفقیت قابل‌دسترس نیز نمایش داده شد.

وضعیت T05: **`VERIFIED_LOCALLY`**. scope خروجی، loading/success/error feedback، filename سرور، MIME، isolation و محتوای workbook در source، تست‌های API/UI و browser runtime تأیید شدند.

### مراحل اجرا

1. کنار دکمه توضیح بده خروجی «همه افراد نهایی» است یا تابع فیلتر فعلی.
2. هنگام درخواست دکمه disabled/loading شود.
3. موفقیت و خطای قابل‌فهم فارسی نمایش بده.
4. دانلود فایل و محتوای چهار sheet را بدون regression نگه دار.
5. فایل بیش از 50 ردیف را تست کن.

### تست‌های الزامی

- API auth، role/ability و workspace isolation؛ ادمین workspace دیگر باید `403/404` امن بگیرد.
- ردیف‌های بیش از page اول.
- sheetهای خلاصه، لیست نهایی، نیازمند تسویه و تسویه‌شده.
- محافظت Formula Injection برای `=`, `+`, `-`, `@`.
- browser download، filename و MIME type.

```bash
pnpm --filter @apps/api run test:file -- test/dp2/operational-roster-api-contract.spec.ts
pnpm --filter @apps/api run test:file -- test/dp2/operational-roster-isolation.spec.ts
pnpm --filter @apps/web run test:file -- test/tour-workspace-operational-roster.spec.ts
```

### معیار پذیرش

- کاربر scope و نتیجهٔ export را بدون بررسی downloads مرورگر بفهمد.
- محتوای فایل با list و totals پنل برابر بماند.

---

## T05-CARD — تنظیم مقصد پرداخت کارت‌به‌کارت و نمایش در پورتال

### قبل از شروع — گیت عدم تکرار

- تنظیمات workspace، schema، RLS/ability، receipt projection و upload form فعلی را inventory کن.
- مالک داده را workspace و seam موجود قرار بده؛ `settings/me` یا config/field موازی نساز.
- مسیرهای بررسی‌شده، دادهٔ حساس و دلیل migration جدید را ثبت کن؛ ابهام مالکیت یعنی `NEEDS_DECISION`.

### چرا این تسک مستقل است

این تغییر فقط افزودن یک input به UI نیست. هم‌زمان مالکیت داده، RBAC پنل ادمین، persistence، قرارداد API، projection امن پورتال، وضعیت‌های مالی ثبت‌نام، cache و تجربهٔ آپلود فیش را تغییر می‌دهد. برای جلوگیری از patch پراکنده، این کار مستقل اجرا می‌شود؛ ولی قبل از اثبات end-to-end فیش و Telegram در T06 باید بسته شده باشد.

### نتیجهٔ inventory اولیه

- **موجود:** `settings/me` فقط پروفایل اپراتور (`displayName`، جنسیت و avatar) را مدیریت می‌کند؛ شماره کارت در این مدل وجود ندارد و به آن اضافه نمی‌شود.
- **موجود / تصمیم اصلاح‌شده:** `TenantConfig` store نسخه‌دارِ تنظیمات workspace برای wizard/preset است و implementation فعلی از key خصوصی `payment_destination` برای **config جاری** استفاده می‌کند. این reuse فقط با policy admin/owner و projection member محدود پذیرفته است؛ `TenantConfig` public egress نیست. اما به‌دلیل overwrite شدن payload، محل تاریخچهٔ immutable revision یا snapshot receipt نیست و نباید به آن تبدیل شود.
- **موجود:** workspace commerce فعلی فقط `paymentMode`، provider و currency را تعریف می‌کند؛ شماره کارت و دارندهٔ کارت در قرارداد آن وجود ندارد.
- **موجود:** مسیر پورتال فیش از `GET /api/me/registrations/:id` و receipt panel استفاده می‌کند و محل طبیعی افزودن projection حداقلی مقصد پرداخت همان پاسخ registration/payment جاری است، نه تنظیمات عمومی.
- **فقدان قطعی در baseline:** در source اولیه هیچ persistence، endpoint، ability، UI ادمین یا projection پورتال برای مقصد کارت‌به‌کارت وجود نداشت؛ patch تکراری پیدا نشد.
- **اصلاح source در worktree ایزوله:** config versioned با کلید `payment_destination` روی `TenantConfig`، ability/manifest تنظیمات، نرمال‌سازی و checksum شماره کارت، projection محدود به ثبت‌نام approved با مانده مثبت، کپی شماره کارت، حالت unavailable، جلوگیری API از آپلود بدون مقصد معتبر و ثبت `destinationRevision` روی PaymentReceipt اضافه شد. در بازبینی تکمیلی، خواندن config کامل هم به policy ادمین/مالک محدود شد تا نقش غیرمجاز نتواند شماره کارت را از endpoint تنظیمات بخواند.
- **تصمیم ادامه:** مسیر واحد settings → member registration projection → receipt upload حفظ شده است؛ شماره کارت در outbox/Telegram، export یا config عمومی قرار نمی‌گیرد. browser matrix محلی سبز است و وضعیت این بخش `VERIFIED_LOCALLY` است؛ runtime staging و CI همان SHA هنوز برای `CLOSED` لازم‌اند.

### گزارش اجرای source و تست‌های فعلی

- `pnpm --filter @app-tour/finance-http-contracts build` — PASS.
- `pnpm --filter @app-tour/finance-core build` — PASS.
- `pnpm --filter @apps/web build` — PASS؛ route `/settings/payment-destination` در artifact ساخته شد.
- `pnpm --filter @apps/portal build` — PASS؛ receipt BFF و صفحهٔ registration ساخته شد.
- `pnpm --filter @apps/api build` — PASS؛ migration/client و routeهای receipt ساخته شدند.
- typecheck مستقل API، portal و web — PASS.
- `finance-http-contracts.spec.ts` — 3/3 PASS؛ قرارداد revision و re-export بررسی شد.
- **RETEST CANONICAL RUNNER:** تست‌های API با runner رسمی و هر suite در process مستقل سبز شدند: settings config/card `12/12`، member receipt flow `7/7`، offline gate `4/4`، member projection `2/2` و revision persistence `1/1`. اجرای چند فایل در یک process به‌دلیل اشتراک bootstrap/auth چند `401` کاذب ایجاد کرد و به‌عنوان شکست محصول پذیرفته نشد.
- `settings-config-version.spec.ts` — 12/12 PASS؛ normalization، read-after-write، checksum و منع خواندن config کامل برای نقش غیرمجاز بررسی شد.
- `payment-destination-member-projection.spec.ts` — 2/2 PASS؛ شرط approved/payable و tenant isolation بررسی شد.
- `payment-destination-revision.spec.ts` — 1/1 PASS؛ revision روی receipt مستقل از config فعلی ذخیره و tenant-isolated است.
- **BROWSER RETEST — 2026-09-20:** اجرای رسمی `t05-card-settings-browser.spec.ts` روی runtime محلی Denali با owner login، بازکردن `/settings/payment-destination`، فعال‌سازی مقصد و ذخیرهٔ شماره کارت/دارنده/بانک — **1/1 PASS**؛ پیام موفقیت `مقصد پرداخت با موفقیت ذخیره شد.` نمایش داده شد و خطای UI وجود نداشت. Screenshot نهایی در artifact مرورگر `apps/web/test-results/t05-card-payment-destination.png` ثبت شد.
- `p6-offline-receipt-gate.spec.ts` — 4/4 PASS؛ unavailable gate و header revision در زنجیرهٔ receipt ثبت شد.
- portal receipt BFF/registrations tests — 18/18 PASS؛ ارسال revision، copy و unavailable marker بررسی شد.
- **REVALIDATION — 2026-09-19:** API suites در processهای مستقل دوباره PASS شدند: settings/card `12/12`، member receipt `7/7`، offline gate `4/4`، member projection `2/2` و revision persistence `1/1`. Portal receipt BFF و registrationها نیز `18/18 PASS` شدند. warning رسانهٔ Telegram در receipt test، fail-safe مربوط به media test fixture است و failure test یا افشای card data نیست.
- Prisma schema validation — PASS با `DATABASE_URL` معتبر؛ migration `20260918193000_payment_receipt_destination_revision` اضافه شد.
- **RETEST / LEAK AUDIT — 2026-09-19:** همهٔ suiteهای API بالا دوباره با runner رسمی هر app اجرا شدند و `26/26 PASS` بودند؛ portal runner اختصاصی نیز `18/18 PASS` شد (portal عمداً script `test:file` ندارد). جست‌وجوی مصرف‌کنندگان `cardNumber`/`paymentDestination`/`destinationRevision` بیرون از settings، portal receipt و finance فقط قراردادهای لازم را نشان داد؛ در formatter/worker Telegram و exporter roster هیچ referenceی پیدا نشد. بنابراین شمارهٔ کارت به Telegram/Excel اضافه نشده است. این audit جایگزین اجرای runtime migration/staging نیست.
- **GAP FOUND — 2026-09-19:** معیار «revision A پس از تغییر مقصد به B قابل تطبیق با مقصد A بماند» هنوز کامل نیست. پیاده‌سازی فعلی فقط `destinationRevision` opaque را روی receipt ذخیره می‌کند؛ `putPaymentDestinationConfig` config قبلی را overwrite می‌کند و audit settings فقط summary دارد، نه snapshot کارت. بنابراین receipt پس از تغییر کارت به A نسبت داده می‌شود، اما هیچ store tenant-scoped برای بازیابی/تطبیق snapshot A ندارد. این با تستِ سادهٔ persistence revision پوشانده نشده بود. راه‌حل موردنیاز: history/snapshot immutable و tenant-scoped برای هر revision، نگهداری receipt به همان snapshot (بدون ارسال کارت به client/Telegram/Excel)، و تست race «A→B سپس ارسال receipt با A». این کار نباید با اضافه‌کردن history در response عضو یا تکیه بر audit text حل شود. فایل‌های feature در checkout فعلی تغییراتِ مالک دیگر دارند؛ تا مرزبندی تغییرات/مهاجرت روشن نشود، patch هم‌پوشان زده نشده و وضعیت T05-CARD `IN_PROGRESS` می‌ماند.
- **ROOT CAUSE / INTEGRITY GAP — 2026-09-19:** `readPaymentDestinationRevision` در route فقط regex/طول header را می‌سنجد و `assertMemberManualPaymentDestination` فقط وجود config جاری را بررسی می‌کند. هیچ lookup tenant-scoped برای اثبات تعلق revision به مقصد A/B وجود ندارد؛ در نتیجه revision معتبر از نظر syntax اما ساختگی قابل persist شدن است، و revision A پس از جایگزینی config با B قابل validate/retrieve نیست. تست `payment-destination-revision.spec.ts` صرفاً ذخیره‌سازی opaque value را پوشش می‌دهد، نه ownership/race. این یک P0 data-integrity gap است؛ snapshot/lookup اتمیک باید آن را ببندد.

#### زیرتسک T05-CARD-RACE — snapshot غیرقابل‌تغییر مقصد پرداخت

> **Implementation update (2026-09-20):** immutable tenant-scoped destination revision history,
> one-to-one receipt snapshots, server-side revision resolution, fail-closed unknown/cross-tenant
> handling, and idempotent A→B race coverage are now wired for the finance memory and Prisma
> repositories. Card fields remain server-only and are excluded from receipt DTOs/outbox payloads.

**گیت عدم تکرار:** پیش از تغییر، migration موجود `20260918193000_payment_receipt_destination_revision`، contract `CreateReceiptInput`، repositoryهای memory/Prisma و مسیر submit را trace کن؛ table/history موازی یا cache دوم نساز.

**طرح داده:** snapshot حداقلی مقصد (revision، شمارهٔ کارت canonical، نام دارنده، بانک اختیاری) باید فقط server-side و tenant-scoped، هم‌زمان با create receipt ذخیره شود. نگهداری آن روی خود `payment_receipts` یا table یک‌به‌یک receipt قابل قبول است؛ history آزاد در `tenant_config` یا audit متن قابل قبول نیست. snapshot نباید به `MemberRegistrationItem`، response receipt عضو، formatter Telegram، Excel exporter یا log راه پیدا کند.

**تصمیم اجراییِ لازم برای بستن race:** دو رکورد مجزا لازم است، نه فقط یک فیلد روی receipt:

1. `payment_destination_revisions`: تاریخچهٔ immutable و tenant-scoped هر مقصد معتبر؛ شامل `tenant_id`، `revision` یکتا، شمارهٔ کارت canonical، نام دارنده، بانک/راهنما، actor و timestamp. با هر `PUT payment_destination`، config جاری و revision تازه در یک تغییر سازگار ساخته می‌شوند؛ update هرگز row تاریخچه را overwrite نمی‌کند.
2. `payment_receipt_destination_snapshots`: snapshot یک‌به‌یک با `payment_receipt_id` یکتا، `tenant_id`، `revision` و سه فیلد حداقلی مقصد. این table فقط در transaction create receipt نوشته می‌شود و هیچ repository/list/member DTO عمومی آن را select نمی‌کند.

**قرارداد submit:** اگر header revision وجود داشت، فقط revision تاریخچهٔ همان tenant پذیرفته می‌شود؛ revision صرفاً خوش‌فرمت ولی ناشناخته باید `409 PAYMENT_DESTINATION_REVISION_UNAVAILABLE` بگیرد. اگر header قدیمی نبود، سرور revision فعلی workspace را resolve و همان را snapshot می‌کند تا client قدیمی crash نکند. پس از تغییر A→B، header A هنوز از history خوانده و snapshot A ثبت می‌شود؛ B فقط برای درخواست تازه استفاده می‌شود. غیرفعال‌شدن یا جایگزینی مقصد نباید receiptی را که قبلاً با revision شناخته‌شده پرداخت شده بی‌دلیل رد کند؛ سیاست grace آن باید در test صریح باشد.

**مرز transaction:** service فقط revision immutable را resolve می‌کند؛ `CreateReceiptInput` snapshot server-resolved را به finance repository می‌دهد و repository Prisma/Memory در همان transactionی که receipt/idempotency را می‌سازد، snapshot را insert-or-return می‌کند. این طراحی از ارسال card data از client و از race بین create receipt و write snapshot جلوگیری می‌کند.

**ترتیب اجرا:**

1. هنگام PUT مقصد A، revision A ساخته می‌شود؛ هنگام submit receipt، مقصد فعلی A همراه revision آن atomically snapshot می‌شود.
2. پس از PUT مقصد B، receipt قبلی همچنان snapshot A را دارد؛ receipt تازه فقط B را می‌گیرد.
3. submission با revision نامعتبر یا متعلق به tenant دیگر fail-closed شود؛ submission با A که صفحه قبل از تغییر B دیده بود، به snapshot A متصل شود، نه به B.
4. Prisma و in-memory یک قرارداد واحد را اجرا کنند؛ migration additive و RLS tenant-scoped باشد.
5. تست‌ها: A→B race، revision syntactically-valid اما ناشناخته، cross-tenant revision، idempotent retry همان receipt، عدم‌افشای snapshot در BFF/member/Telegram/Excel و migration/read-after-write.

**معیار بسته‌شدن:** اپراتورِ بررسی‌کننده بتواند از مسیر server-only receipt، revision A و snapshot A را ببیند؛ عضو فقط مقصد جاری مجاز را می‌بیند و هیچ سطح عمومی/خروجیِ غیرمالی شماره کارت تاریخی را دریافت نمی‌کند.

**یادداشت payment mode:** بررسی source نشان داد Denali فعلی فقط `free` یا `offline` را از `pricing.paymentCollection` resolve می‌کند؛ gateway فعال برای Denali هنوز مدل/مسیر runtime ندارد. بنابراین «gateway نباید کارت‌به‌کارت ببیند» در نسخهٔ فعلی با نبود gateway برقرار است، نه با یک branch پنهان در UI. اگر gateway به Denali اضافه شود، باید هم‌زمان payment mode را به projection member برساند و حالت gateway را صریحاً از receipt/card-destination جدا کند؛ این اضافه‌کردن خارج از scope اصلاح race فعلی است.

### باقی‌ماندهٔ اجباری قبل از CLOSED

- اجرای migration و API/Prisma receipt flow روی staging واقعی.
- browser E2E دسکتاپ و موبایل: ذخیره/ویرایش/غیرفعال‌سازی مقصد، refresh پورتال، کپی، unavailable و upload فیش.
- تست revision race با مقصد A سپس تغییر به B و اثبات اتصال فیش به A.
- CI و deploy proof برای همان SHA؛ سپس ثبت runtime evidence و تغییر وضعیت به `CLOSED` فقط در صورت سبز بودن همهٔ موارد.

### تصمیم معماری

- شماره کارت «اطلاعات شخصی اپراتور» نیست؛ مقصد پرداخت متعلق به workspace است، حتی اگر نام دارندهٔ کارت همان Owner باشد.
- در پنل ادمین یک ماژول/کارت مستقل با عنوان «تنظیمات پرداخت» در گروه workspace یا finance قرار گیرد؛ لینک آن می‌تواند کنار اطلاعات workspace دیده شود، اما persistence آن به `/settings/me` و عمر حساب یک اپراتور وابسته نشود.
- پیاده‌سازی دنالی در `packages/workspaces/denali` بماند. فقط اگر قرارداد واقعاً عمومی و قابل استفاده برای چند workspace است، seam عمومی در `workspace-sdk` تعریف شود؛ core نباید Denali-specific شود.
- پورتال فقط projection لازم برای پرداخت ثبت‌نام جاری را دریافت کند؛ response عمومی تنظیمات نباید کل config داخلی workspace را افشا کند.
- نسخهٔ اول یک مقصد فعال دارد. طراحی persistence نباید بدون نیاز محصول وارد مدیریت چند کارت شود، ولی جایگزینی مقصد قبلی باید auditپذیر باشد.

### مدل دادهٔ حداقلی

- `enabled`: فعال/غیرفعال بودن پرداخت کارت‌به‌کارت.
- `cardNumber`: شماره کارت normalize‌شدهٔ 16 رقمی؛ ورودی با ارقام فارسی/عربی، فاصله و خط تیره پذیرفته و به رقم ASCII canonical تبدیل شود.
- `cardHolderName`: نام صاحب حساب/کارت که کاربر باید قبل از انتقال تطبیق دهد.
- `bankName`: اختیاری، برای کاهش خطای انتقال.
- `instructions`: متن کوتاه اختیاری برای توضیح پرداخت؛ HTML دلخواه یا script پذیرفته نشود.
- `revision/id`: شناسهٔ غیرقابل‌حدس نسخهٔ مقصد پرداخت برای اتصال receipt به مقصدی که کاربر هنگام پرداخت دیده است.
- `updatedAt` و actor تغییر برای audit.

ذخیره یا دریافت `CVV2`، تاریخ انقضا، رمز اول/دوم، OTP بانکی یا هر credential بانکی در این feature ممنوع است. شماره کارت نیز نباید در log، analytics، error payload یا Telegram message تکرار شود.

### رفتار مورد انتظار

| وضعیت                                                                       | رفتار پورتال                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| پرداخت دستی فعال + مقصد معتبر + مانده بیشتر از صفر + ثبت‌نام مجاز به پرداخت | شماره کارت، نام دارنده، بانک اختیاری، مبلغ مانده و دکمهٔ «کپی شماره کارت» قبل از آپلود فیش نمایش داده شود؛ آپلود فعال است.                                       |
| تنظیم غیرفعال، ناقص یا نامعتبر                                              | card-to-card به‌شکل شکسته یا خالی نمایش داده نشود؛ پیام انسانی «پرداخت کارت‌به‌کارت فعلاً در دسترس نیست» نشان داده و آپلود فیشی که مقصد معتبر ندارد غیرفعال شود. |
| تور رایگان، پرداخت waived، مانده صفر یا ثبت‌نام paid                        | شماره کارت و action آپلود فیش نمایش داده نشود.                                                                                                                   |
| ثبت‌نام pending/waitlisted که هنوز اجازهٔ پرداخت ندارد                      | مطابق policy فعلی حالت انتظار نمایش داده شود؛ شماره کارت زودتر از مجازشدن پرداخت افشا نشود.                                                                      |
| registration rejected/cancelled/expired                                     | مقصد پرداخت و آپلود مخفی باشد و همان state بستهٔ فعلی حفظ شود.                                                                                                   |
| روش پرداخت آنلاین                                                           | کارت‌به‌کارت مزاحم gateway نشود و نمایش داده نشود.                                                                                                               |
| پرداخت ناقص/قسطی با مانده مثبت                                              | مقصد پرداخت نمایش داده شود و مبلغ «مانده» مبنای راهنما باشد، نه مبلغ اولیهٔ تور.                                                                                 |

### مالک کد محتمل

- inventory تنظیمات: `packages/workspaces/denali/src/settings/denali-settings.manifest.ts`
- UI و access پنل: `apps/web/app/(app)/settings` و loader/plugin تنظیمات Owner دنالی
- API/persistence تنظیم workspace: پس از trace مسیر موجود `tenant_config` یا workspace settings؛ schema جدید فقط اگر store موجود پاسخ‌گو نباشد
- projection مالی عضو: API ثبت‌نام/receipt که اکنون `MemberReceiptPanel` را می‌سازد
- قرارداد client-safe: `apps/portal/src/me/member-receipt-status.ts`
- UI پرداخت: `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx`
- composition صفحه: `apps/portal/app/me/registrations/[id]/page.tsx`
- ترجمه‌ها و CSS پورتال/وب مربوط به settings و receipt

### مراحل اجرا

1. مسیر فعلی persistence تنظیمات workspace، RLS و abilityها را trace کن؛ قبل از شناخت store موجود migration نساز.
2. قرارداد versioned مقصد پرداخت و default امن `disabled/null` را تعریف کن تا workspaceهای قبلی بدون backfill اجباری خراب نشوند.
3. ability اختصاصی برای خواندن/ویرایش تنظیم پرداخت تعیین کن؛ UI و API باید یک policy را enforce کنند. Owner یا نقش مجاز می‌تواند ویرایش کند، عضو عادی خیر.
4. صفحه/کارت «تنظیمات پرداخت» را به manifest و settings hub اضافه کن؛ مقادیر ناقص ذخیره نشوند و خطای فارسی کنار field مربوطه نمایش داده شود.
5. input شماره کارت را normalize کن و دقیقاً 16 رقم نگه دار؛ نمایش پنل با گروه‌بندی `XXXX-XXXX-XXXX-XXXX` باشد. checksum معتبر کارت بانکی در API و UI enforce شود و fixtureها از شمارهٔ تست معتبرِ غیرواقعی استفاده کنند.
6. update را audit کن، cache مرتبط را invalidate کن و اطمینان بده تغییر تنظیم بدون rebuild/redeploy در درخواست بعدی پورتال دیده می‌شود.
7. API عضو فقط وقتی registration متعلق به همان member/workspace و در وضعیت قابل پرداخت است، projection حداقلی مقصد پرداخت را کنار receipt panel برگرداند.
8. در پورتال card info را قبل از input فیش قرار بده؛ copy button، feedback قابل‌خواندن با screen reader و fallback انتخاب/کپی دستی داشته باشد.
9. آپلود receipt در حالت unavailable از UI و API سازگار باشد؛ فقط disabled کردن دکمه در browser کافی نیست و endpoint نباید proof بدون payment channel معتبر را بپذیرد، مگر policy مستند دیگری وجود داشته باشد.
10. projection پورتال یک `destinationRevision` opaque برگرداند و upload فیش همان revision را ثبت کند. اگر کارت بعد از نمایش صفحه تغییر کرد، فیشِ پرداخت‌شده به revision قبلی گم یا خودکار رد نشود؛ برای تطبیق به history همان workspace متصل بماند و UI در درخواست تازه مقصد جدید را نشان دهد.
11. اثر روی free tour، waived، paid، rejected، cancelled، expired، pending approval، auto-approved، partial payment، manual و online را با matrix تست کن.
12. staging را با workspace دنالی و یک workspace دوم تست کن تا هیچ مقصد پرداختی بین tenantها نشت نکند.

### تست‌های الزامی

- unit: normalize ارقام فارسی/عربی، حذف فاصله/خط تیره، رد طول یا checksum نامعتبر، trim نام دارنده و sanitize توضیحات.
- API: خواندن/ویرایش فقط با ability مجاز؛ `403/404` امن برای workspace دیگر؛ default غیرفعال برای config قدیمی؛ update و read-after-write.
- API عضو: projection فقط برای registration متعلق به عضو و همان workspace؛ عدم افشای config کامل یا audit metadata.
- portal: نمایش مقصد برای manual + remaining، عدم نمایش برای free/waived/paid/online/closed، و حالت unavailable برای config ناقص یا غیرفعال.
- receipt: endpoint در حالت unavailable رفتار مستند داشته باشد و flow فعلی pending/rejected/resubmit خراب نشود.
- revision race: کاربر revision A را می‌بیند، ادمین مقصد را به B تغییر می‌دهد و فیش A ارسال می‌شود؛ receipt به A قابل‌ردیابی بماند، درخواست تازه B را نشان دهد و هیچ داده‌ای بین workspaceها جابه‌جا نشود.
- browser desktop/mobile: ذخیره در پنل، refresh، مشاهده در پورتال، کپی، آپلود فیش و بازگشت به صفحه.
- cache: تغییر شماره کارت در پنل در درخواست تازهٔ پورتال دیده شود و دادهٔ tenant قبلی cache نشود.
- regression: Excel، Telegram و logها شماره کارت را ناخواسته شامل نشوند؛ receipt notification موجود همچنان ارسال شود.

### معیار پذیرش

- ادمین مجاز بتواند مقصد پرداخت را برای workspace ذخیره، ویرایش، فعال و غیرفعال کند.
- عضوِ دارای ثبت‌نام قابل پرداخت و مانده مثبت، قبل از ارسال فیش شماره کارت و نام دارنده را واضح ببیند و با یک action امن کپی کند.
- در حالت غیرفعال/نامعتبر، UI آپلود فیش مقصد جعلی یا خالی نسازد و پیام قابل‌فهم نشان دهد.
- تور رایگان، پرداخت کامل/waived، روش آنلاین و registration بسته شماره کارت را نشان ندهند.
- تغییر Owner یا پروفایل شخصی اپراتور مقصد پرداخت workspace را حذف یا جابه‌جا نکند.
- workspace دیگر تحت هیچ host/session/cache key شماره کارت دنالی را دریافت نکند.
- receipt قدیمی بعد از تغییر شماره کارت، با `destinationRevision` همان زمان قابل تطبیق باشد و به شمارهٔ جدید نسبت داده نشود.
- هیچ دادهٔ بانکی ممنوع، شماره کارت در log/Telegram/export یا config داخلی اضافه در response عضو وجود نداشته باشد.
- unit، API، portal و browser testهای بالا سبز و runtime staging همان SHA تأیید شده باشند.

---

## T06 — اثبات ثبت‌نام، فیش و Telegram end-to-end

### قبل از شروع — گیت عدم تکرار

- event catalog، producer، outbox، policy، formatter، worker، provider و تست‌های Telegram را inventory کن.
- dispatch/outbox فعلی را reuse کن؛ ارسال مستقیم UI، webhook دوم یا mapping مبتنی بر متن نساز.
- مسیرهای بررسی‌شده و جدول event→topic را ثبت کن؛ اختلاف topic/policy یعنی `NEEDS_DECISION`.

### هدف

هر رویداد محصول دقیقاً یک پیام به topic درست workspace بفرستد.

### رویدادهای اجباری

- ثبت‌نام اولیه.
- ثبت‌نام نیازمند تأیید.
- ثبت‌نام تأیید/نهایی‌شده.
- ارسال فیش.
- تأیید فیش.
- رد فیش.
- مانده یا پرداخت ناقص.
- تیکت جدید و پاسخ تیکت، اگر در policy فعال است.

### مالک کد محتمل

- `apps/api/src/bookings`
- `apps/api/src/integrations`
- `apps/api/src/integrations/providers/telegram`
- integration worker/outbox
- `apps/portal/app/api/me/registrations/[id]/receipt`

### مراحل اجرا

1. event catalog و topic mapping را استخراج کن.
2. برای هر event، producer، outbox record، policy decision، formatter و provider call را trace کن.
3. mapping نباید بر اساس متن پیام حدس زده شود؛ event type باید topic را تعیین کند.
4. workspace/token/chat/topic باید tenant-scoped باشند.
5. retry نباید duplicate بسازد؛ idempotency key را assertion کن.
6. تست connection را جدا از event delivery نگه دار.
7. token فقط در server/provider boundary خوانده شود؛ client bundle و response نباید token را برگردانند.
8. relay/Cloudflare فقط transport باشد و event/topic business logic روی سرور بماند.
9. log باید correlation/event ID داشته باشد، ولی token، متن حساس فیش یا اطلاعات غیرضروری عضو را ثبت نکند.
10. timeout، Telegram 429/5xx و relay failure را با retry/backoff تست کن.
11. در staging با یک registration و یک receipt واقعی، پیام و thread مقصد را بررسی کن.

### inventory و ریشه‌یابی اولیه — 2026-09-18

- **SOURCE:** مسیر تنظیم اتصال و ساخت topicها در `apps/api/src/integrations/http/integrations.service.ts` است؛ onboarding مقدارهای `chatId`، `topicThreadIds` و `topicNames` را در همان اتصال workspace ذخیره می‌کند.
- **SOURCE:** نگاشت رویداد به topic در `packages/workspaces/denali/src/integrations/denali-integration.surface.ts` و `apps/api/src/integrations/platform/integration-event-mapping.ts` انجام می‌شود؛ برای `registration.*` تاپیک `registration` و برای `receipt.*` تاپیک `receipts` ثبت شده است. mapping متنی یا webhook موازی ساخته نشد.
- **SOURCE:** صف و ارسال واقعی در `apps/api/src/integrations/worker/process-integration-delivery-once.ts` است؛ تست اتصال از `chatId` به‌عنوان مقصد استفاده می‌کرد.
- **ROOT CAUSE:** worker فقط `connection.config.channelId` را می‌خواند، درحالی‌که onboarding/forum connection مقصد پایدار گروه را در `chatId` ذخیره می‌کند. در نتیجه تست اتصال سبز بود، اما delivery واقعی پیش از تماس Telegram با `INTEGRATION_CONFIG_INCOMPLETE` متوقف می‌شد؛ این با علامت «پیام تست می‌رسد ولی ثبت‌نام/فیش نمی‌رسد» منطبق است.
- **SOURCE FIX:** helper واحد `resolveIntegrationDeliveryChannelId` اضافه شد؛ اول `channelId` صریح را حفظ می‌کند و فقط برای provider تلگرام به `chatId` fallback می‌کند. سایر providerها از `chatId` استفاده نمی‌کنند.
- **TEST:** `apps/api/src/integrations/worker/process-integration-delivery-once.spec.ts` اکنون fallback تلگرام، اولویت `channelId`، ارسال واقعی worker به thread ذخیره‌شده، عدم ارسال در نبود mapping و چرخهٔ retry/dead-letter را پوشش می‌دهد؛ نتیجهٔ اجرای مستقیم: `11/11 PASS` و `git diff --check` سبز.
- **REGRESSION FOUND/FIXED:** اجرای `test/p6-member-receipt-flow.spec.ts` بعد از الزام مقصد پرداخت، به‌علت نداشتن config کارت در fixture با `409 PAYMENT_DESTINATION_UNAVAILABLE` شکست خورد. fixture تست با مقصد پرداخت معتبر و revision مستقل seed شد؛ نتیجهٔ فعلی `7/7 PASS` است. warning مربوط به media داخلی در این تست، رفتار fail-safe موجود است و خطای تست نیست.
- **TEST:** forum config `3/3`، provider adapter `2/2`، event mapping `4/4` و policy engine `8/8` (هر دو شامل جدول صریح هر ۱۵ event و topic مقصد)، formatter `12/12` و portal receipt BFF `6/6` سبز هستند؛ API typecheck و Prettier نیز سبز است.
- **CHAIN TEST:** `apps/api/src/integrations/telegram-registration-receipt-chain.spec.ts` با `1/1 PASS` ثابت می‌کند `registration.created` به thread ثبت‌نام و `receipt.submitted` به thread فیش می‌رسند؛ dispatch و worker در یک مسیر تست شده‌اند و مقصد General fallback ندارد.
- **RETEST SOURCE — 2026-09-19:** suiteهای policy `8/8`، mapping `4/4`، formatter `12/12`، worker/routing/retry `11/11` و زنجیرهٔ registration/receipt `1/1` با runner رسمی و process مستقل دوباره سبز شدند. این نتیجه routing و fail-closed بودن topic را در source تأیید می‌کند، نه دریافت پیام در گروه Telegram واقعی.
- **REVALIDATION — 2026-09-19:** همان پنج suite روی worktree فعلی بدون تماس با Telegram واقعی دوباره اجرا شدند: policy `8/8`، mapping `4/4`، formatter `12/12`، worker/routing/retry `11/11` و chain `1/1` همگی PASS. خروجی chain همچنان `field_exposure.runtime_truth` را در حالت `shadow/engine_missing` گزارش می‌کند؛ این log یک pass ساختگی نیست و gap profile واقعی staging را حفظ می‌کند.
- **COVERAGE FIX — 2026-09-19:** chain قبلی فقط `registration.created` و `receipt.submitted` را از dispatch تا provider می‌برد. بدون ایجاد producer یا mapping جدید، همان test به `registration.approved`، `receipt.approved`، `receipt.rejected`، `ticket.created` و `ticket.message.posted` گسترش یافت و سه thread ثبت‌نام/فیش/تیکت را با `chatId` forum واحد بررسی کرد. test PASS و lint کامل `@apps/api` نیز PASS است.
- **CHAIN LIMIT:** این chain با memory fixture بدون exposure profile اجرا شد؛ log حالت `shadow` مقدار `engineSelectorMissing=true` و `activeFieldIdCount=0` داشت. این مانع routing/topic نیست، اما اثبات field-exposure سفارشی staging محسوب نمی‌شود و باید در retest با profile واقعی بررسی شود.
- **ENVIRONMENT LIMIT:** تست PostgreSQL `test:booking-approve-outbox-relay-effect` اجرا شد اما به‌صورت TODO باقی ماند چون این worktree `DATABASE_URL` و `DATABASE_URL_ADMIN` ندارد؛ آن را سبز فرض نکردیم.
- **GAP FIXED (SOURCE):** وضعیت داخلی `partial/paid` هنگام approve اکنون در payload رویداد `receipt.approved` با نام `bookingPaymentStatus` قرار می‌گیرد و template دنالی آن را به‌صورت «وضعیت پرداخت» نشان می‌دهد؛ بنابراین پرداخت ناقص به‌صورت صریح اطلاع‌رسانی می‌شود. مبلغ عددی مانده هنوز از قرارداد این رویداد جداست و فقط در صورت نیاز محصول باید به‌عنوان فیلد مستقل اضافه شود.
- **TEST:** تست finance برای approve جزئی `13/13 PASS` و تست formatter برای نمایش وضعیت `12/12 PASS` است؛ payload در مسیر memory و Prisma هر دو اصلاح شد.
- **TEST GAP RETEST:** در runtime ایزوله، تماس مستقیم API روی پورت `3311` با tenant دنالی و شمارهٔ QA مجاز challenge ساخت؛ اما BFF وب به‌علت خواندن `apps/web/.env.local` همچنان به API موجود روی `3001` وصل شد و `AUTH_PHONE_NOT_AUTHORIZED` داد. این اختلاف fixture/پیکربندی اجرای QA است، نه اثبات شکست مسیر event؛ تا اجرای BFF با همان API و سپس ثبت‌نام/فیش واقعی، browser/staging را `UNVERIFIED` نگه می‌داریم.
- **REMAINING:** تست integration واقعی worker با اتصال memory/adapter، سناریوی registration و receipt، و browser/staging همان SHA هنوز انجام نشده است؛ بنابراین وضعیت T06 فعلاً `IN_PROGRESS` می‌ماند.
- **REVALIDATION — 2026-09-19 (بدون Telegram خارجی):** مجموعهٔ policy، mapping، formatter، chain، worker/routing/retry و جریان receipt عضو با runner رسمی API دوباره اجرا شد: **43/43 PASS**. chain هفت event عملیاتی را تا provider fake و سه topic forum دنبال کرد؛ receipt flow نیز مالکیت عضو، pending، approval و منع upload پیش از approval را پوشش داد. warning رسانهٔ داخلی `RECEIPT_PROOF_KEY_SCOPE_INVALID` در fixture به‌صورت fail-safe ثبت شد و failure تست نیست. ارسال به گروه واقعی و runtime همان SHA همچنان جداگانه لازم است.
- **RETEST — 2026-09-19 (worktree ایزوله):** mapping `4/4`، formatter `12/12`، worker `11/11`، registration/receipt chain `1/1` و receipt flow عضو `7/7` دوباره PASS شدند. `field_exposure.runtime_truth` با `shadow/engine_missing` فقط profile fixture را گزارش می‌کند؛ اثبات Telegram واقعی نیست.
- **REVALIDATION — 2026-09-19 (بدون deploy):** contract رویدادهای اجباری دوباره با surface و chain تطبیق داده شد: «نیازمند تأیید» event تازه‌ای ندارد و همان `registration.created.approvalStatus` است؛ تأیید نهایی `registration.approved`؛ پرداخت ناقص، payloadِ `receipt.approved.bookingPaymentStatus=partial` است. chain، destination دقیقِ `registration.created/approved → registration`، `receipt.submitted/approved/rejected → receipts` و `ticket.created/message.posted → tickets` را با یک `chatId` و threadهای `101/202/303` assertion می‌کند. اجرای تازهٔ forum config `3/3`، adapter `2/2`، worker/topic/retry `11/11`، member receipt flow `7/7`، portal receipt BFF `6/6` و chain `1/1` همگی PASS شد. هیچ event، route یا mapping موازی اضافه نشد.
- **BROWSER RETEST — 2026-09-20:** زنجیرهٔ رسمی `p6-vertical-slice-browser-chain.spec.ts` روی runtime محلی Denali با ثبت‌نام API، تأیید در UI اپراتور، ثبت فیش و تأیید در مرکز مالی — **1/1 PASS**. Screenshot نهایی در artifact مرورگر `apps/web/test-results/t06-registration-receipt-finance-chain.png` ثبت شد. این شواهد browser محلی مسیر محصول را تأیید می‌کند؛ دریافت پیام در Telegram واقعی و staging همان SHA هنوز برای `CLOSED` لازم است.

### تست‌های الزامی

```bash
pnpm --filter @apps/api run test:file -- src/integrations/providers/telegram/telegram-forum.config.spec.ts
pnpm --filter @apps/api run test:file -- src/integrations/providers/telegram/telegram-provider.adapter.spec.ts
pnpm --filter @apps/api run test:booking-approve-outbox-relay-effect
pnpm --filter @apps/api run test:file -- test/p6-member-receipt-flow.spec.ts
pnpm --filter @apps/portal exec node --import ./test/css-hook.mjs --import tsx --test test/portal-member-receipt-bff.spec.ts
```

### معیار پذیرش

- جدول event→topic در تست وجود داشته باشد.
- هر event در topic درست دیده شود.
- retry فقط یک پیام مؤثر ایجاد کند.
- failure قابل مشاهده و قابل retry باشد.

---

## T07 — حذف پیام‌ها و مقادیر فنی از UI

### قبل از شروع — گیت عدم تکرار

- formatter، error map، message namespace و componentهای نمایش را inventory کن.
- formatter/translator مرکزی را reuse کن؛ mapping فنی صفحه‌ای یا namespace دوم نساز.
- مسیرهای بررسی‌شده و مالک نمایش را ثبت کن؛ تعارض locale/contract یعنی `NEEDS_DECISION`.

### هدف

کاربر فقط متن انسانی، تاریخ محلی و مبلغ دارای واحد ببیند.

### یافته‌های پوشش‌داده‌شده

- `BUG-006` و `BUG-017`: تاریخ ISO خام.
- `BUG-007`: نمایش `GUEST_REQUIRED`.
- `BUG-012`: مبلغ بدون «تومان».
- `BUG-ADMIN-MSG-001`: نمایش `INTEGRATION_TEST_SUCCEEDED`.
- `BUG-ADMIN-MSG-002`: نمایش «ناعدد».
- `BUG-ADMIN-MSG-003` و `004`: namespace، UUID، event key و timestamp خام.

### مالک کد محتمل

- `apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx`
- `apps/web/messages/fa/*.json` و `apps/web/messages/en/*.json`
- `apps/web/src/draft`
- formatterهای مشترک date/money/error

### مراحل اجرا

1. code فنی را از متن اصلی UI حذف کن؛ در صورت نیاز فقط داخل diagnostic disclosure بگذار.
2. mapping خطاها را central کن؛ raw code fallback کاربرپسند داشته باشد.
3. formatter تاریخ/زمان با timezone workspace استفاده کن.
4. formatter مبلغ همیشه واحد و policy صفر/null را مشخص کند.
5. interpolation شمارنده‌ها برای صفر، یک و چند تست شود.

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/settings-integrations.spec.ts
pnpm --filter @apps/web run test:file -- test/integrations-settings-logic.spec.ts
pnpm --filter @apps/web run test:file -- test/tours-register.spec.ts
pnpm --filter @apps/web run test:file -- test/tours-workspace.spec.ts
```

### معیار پذیرش

- هیچ raw error/event key در مسیرهای بررسی‌شده دیده نشود.
- فارسی و انگلیسی هر دو مقدارهای interpolate‌شدهٔ معتبر داشته باشند.

### گزارش اجرای فعلی — 2026-09-18

- **BUG-ADMIN-MSG-001 — source fixed:** `testResult.code` دیگر در نتیجهٔ تست اتصال به‌عنوان متن عادی کاربر render نمی‌شود؛ عنوان و پیام انسانی همچنان نمایش داده می‌شوند. پیام واقعی تلگرام برای این اصلاح دوباره ارسال نشد و retest runtime هنوز لازم است.
- **BUG-ADMIN-MSG-002 — source already covered:** متن summary اتصال در namespace فارسی و انگلیسی از interpolation معتبر `integrationCount` و `legacyCount` استفاده می‌کند؛ عبارت خراب «ناعدد» در source فعلی یافت نشد. browser retest همان build هنوز لازم است.
- **BUG-ADMIN-MSG-004 — source fixed:** audit trail اکنون action و نوع منبع را از mapping متمرکز و محلی‌سازی‌شده نمایش می‌دهد و UUID/resource ID خام را در متن عادی نشان نمی‌دهد. برای action/resource ناشناخته fallback انسانی وجود دارد.
- **تست‌ها:** `settings-audit-trail.spec.ts` با 3/3، `settings-integrations.spec.ts` با 4/4 و `integrations-settings-logic.spec.ts` با 11/11 سبز شدند؛ `prettier` و `git diff --check` نیز موفق بودند.
- **محدودیت اثبات:** این اصلاحات در worktree ایزولهٔ `codex/tour-qa-tasks` هستند و هنوز روی `dev` deploy نشده‌اند؛ بنابراین وضعیت کل T07 فعلاً `IN_PROGRESS` و موارد بالا `SOURCE_FIXED_RETEST_REQUIRED` هستند.
- **RETEST — 2026-09-19 (worktree ایزوله):** `settings-integrations`، `integrations-settings-logic`، `settings-audit-trail`، `tours-register` و `tours-workspace` مجموعاً **49/49 PASS** شدند. browser retest همان SHA همچنان لازم است.
- **REVALIDATION — 2026-09-19 (بدون deploy):** چهار suite الزام‌شدهٔ T07 با harness رسمی دوباره PASS شدند: `settings-integrations` **4/4**، `integrations-settings-logic` **11/11**، `tours-register` **5/5** و `tours-workspace` **26/26**؛ مجموع **46/46**. این نتیجه fallbackهای source را تأیید می‌کند، نه render/runtime واقعی فارسی یا انگلیسی.
- **BROWSER RETEST — 2026-09-20:** مسیر `/settings/integrations` روی runtime محلی Denali با owner login و marker صفحه **1/1 PASS** شد؛ صفحهٔ فارسی، empty state اتصال و فرم تنظیم Telegram بدون raw event/error code قابل مشاهده بود. Screenshot نهایی در `apps/web/test-results/t07-integrations-settings.png` ثبت شد. ماتریس کامل settings به‌دلیل شاخهٔ دسترسی مستقل `/settings/workspace-owner` متوقف شد و این failure به integrations نسبت داده نمی‌شود.
- **BROWSER REVALIDATION — 2026-09-20:** ماتریس واقعی Chromium برای settings با owner login برابر **18/18 PASS** شد. شانزده route قابل‌نمایش Denali marker خود را render کردند و `/settings/workspace-owner` نیز طبق قرارداد canonical Urban با marker `data-workspace-wizard-forbidden` به‌صورت fail-closed access denied تأیید شد؛ انتظار marker پنل Denali برای این route نادرست بود، چون قرارداد `canLoadUrbanSettings` فقط `pluginId=urban` و `workspaceType=urban` را می‌پذیرد. نتیجهٔ تست در `apps/web/test-results/` ثبت شد.

---

## T08 — تفکیک empty state، error state و feedback

### قبل از شروع — گیت عدم تکرار

- state machine، data hook، feedback، empty/error component و تست‌های موجود را inventory کن.
- primitive مشترک را reuse کن؛ برای هر صفحه state component موازی نساز.
- مسیرهای بررسی‌شده و قرارداد action هر state را ثبت کن؛ ابهام empty/error یعنی `NEEDS_DECISION`.

### هدف

کاربر بفهمد «داده وجود ندارد»، «فیلتر نتیجه ندارد» یا «درخواست شکست خورده» است.

### یافته‌های پوشش‌داده‌شده

- `BUG-008`، `BUG-014`، `OBS-005`, `UX-WORK-006`.
- refresh مالی بدون feedback.
- actionهای ایجاد/تأیید با feedback ناکافی.

### مراحل اجرا

1. برای هر list سه state جدا تعریف کن: empty dataset، empty filtered result، fetch error.
2. action هر state را مشخص کن: ایجاد، پاک‌کردن فیلتر یا retry.
3. refresh باید loading، success یا failure قابل مشاهده داشته باشد.
4. actionهای نهایی مانند «ایجاد و تأیید» effect خود را قبل از اجرا توضیح دهند.

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/tours-workspace.spec.ts
pnpm --filter @apps/web run test:file -- test/finance-outstanding-ux1.spec.ts
pnpm --filter @apps/web run test:file -- test/resolve-finance-error-message.spec.ts
```

### معیار پذیرش

- متن و CTA هر state با علت واقعی یکسان باشد.
- هیچ empty state بدون filter کاربر را به پاک‌کردن filter دعوت نکند.

### گزارش inventory و تست source — 2026-09-18

- `resolveBookingsCommandCenterBodyState` مسیرهای `loading`، `error`، `empty` و `emptyFiltered` را جدا می‌کند و برای بازهٔ حرکت، `emptyUpcoming` را نیز از نتیجهٔ فیلترشده جدا نگه می‌دارد.
- `BookingsCommandCenterShell` برای stateها از primitive مشترک `OperatorEmptyState` و `OperatorSkeleton` استفاده می‌کند؛ empty dataset، نتیجهٔ خالی فیلترشده و خطای دریافت پیام جدا دارند.
- خطای mutation با `resolveCodedErrorMessage` به پیام انسانی تبدیل می‌شود و refresh بعد از عملیات approve/reject/waitlist/bulk از `refreshData` مشترک انجام می‌شود؛ کامپوننت یا مسیر refresh موازی لازم نیست.
- تست موجود `bookings-command-center.spec.ts` سناریوهای empty، emptyFiltered و emptyUpcoming، error gate، action error test id و interpolation پیام‌های فارسی/انگلیسی را پوشش می‌دهد؛ تست `tours-workspace.spec.ts` نیز مسیرهای workspace را پوشش می‌دهد.
- **نتیجه:** source این بخش `SOURCE_FIXED_RETEST_REQUIRED` است؛ retest مرورگر روی staging/live برای مشاهدهٔ واقعی stateها و feedback باقی مانده است. هیچ تغییر کدی برای T08 لازم تشخیص داده نشد.
- **REVALIDATION — 2026-09-19 (بدون deploy):** suiteهای الزام‌شده دوباره PASS شدند: `tours-workspace` **26/26**، `finance-outstanding-ux1` **9/9** و `resolve-finance-error-message` **10/10**؛ مجموع **45/45**. نتیجه فقط state/error contract است؛ مشاهدهٔ feedback در browser و دادهٔ واقعی همچنان جداگانه لازم است.
- **BROWSER RETEST — 2026-09-20:** ماتریس مالی Denali در browser محلی برای نمای فارسی desktop و انگلیسی desktop — **2/2 PASS**؛ hierarchy وضعیت‌ها، empty refund state، help/feedback، outstanding و تب‌های مالی بررسی شدند. Screenshotهای ماتریس در `apps/web/test-results/finance-ux2-browser-qa/` ثبت شدند.

---

## T09 — اصلاح primitiveهای مشترک responsive

### قبل از شروع — گیت عدم تکرار

- مصرف‌کننده‌های primitive، tokenها، media queryها و تست‌های responsive را inventory کن.
- primitive canonical را اصلاح کن؛ CSS یا breakpoint صفحه‌ای تکراری برای مشکل مشترک نساز.
- مسیرهای بررسی‌شده و blast radius را ثبت کن؛ تغییر عمومی بدون matrix یعنی `NEEDS_DECISION`.

### هدف

clipping و overflow در tab، popover، dialog، select و navigation یک‌بار در primitive مشترک حل شود.

### یافته‌های پوشش‌داده‌شده

- `UX-MOB-001`، `002` و `003`.
- `UX-MOB-WORK-001`، `003`، `005` تا `011`.
- `UX-MOTION-001` و `002`.
- نام مهمان truncateشده و جدول operational roster فشرده (`UX-WORK-002`, `003`).
- badge دسته با کنتراست پایین (`UX-010`).
- touch targetهای کمتر از 44px.

### مالک کد محتمل

- operator select/popover/dialog primitiveها
- `packages/design-tokens/src/operator-select-motion.css`
- shell/navigation و workspace tabs در `apps/web`

### مراحل اجرا

1. همهٔ مصرف‌کننده‌های primitive را فهرست کن.
2. عرض panel را به viewport با safe margin محدود کن.
3. footer dialog را داخل scroll container و safe-area نگه دار.
4. active tab همیشه داخل viewport scroll شود و hint وجود تب‌های پنهان دیده شود.
5. targetهای اصلی حداقل `44×44px` باشند.
6. motion مشترک 150–200ms با `prefers-reduced-motion` استفاده شود.
7. نام مهمان قابلیت wrap یا disclosure داشته باشد و ستون‌های status هویت مهمان را حذف نکنند.
8. کنتراست badgeها در light/dark بررسی شود.
9. fix صفحه‌ای تکراری ایجاد نکن.

### matrix اجباری

| عرض | ارتفاع پیشنهادی | touch | keyboard | zoom/font |
| --: | --------------: | ----- | -------- | --------- |
| 320 |             568 | بله   | بله      | 200%      |
| 360 |             800 | بله   | بله      | بزرگ      |
| 390 |             844 | بله   | بله      | عادی      |
| 412 |             915 | بله   | بله      | عادی      |

### معیار پذیرش

- `scrollWidth <= clientWidth` برای صفحه‌های هدف.
- panel و dialog داخل viewport باشند.
- CTA و close همیشه قابل مشاهده/دسترسی باشند.

### گزارش inventory و اصلاح source — 2026-09-18

- مالک مشترک دیالوگ `apps/web/src/components/ui/dialog.tsx` و مالک مشترک popover `apps/web/src/components/ui/popover.tsx` مشخص شد؛ بنابراین برای clipping دیالوگ‌های دعوت، فیلتر و ثبت‌نام دستی patch صفحه‌ای ساخته نشد.
- `DialogContent` در موبایل اکنون حاشیهٔ امن `1rem`، ارتفاع محدود به viewport، اسکرول داخلی و center alignment مخصوص breakpoint دسکتاپ دارد؛ این مانع بیرون‌زدن محتوای بلند و footer از viewport می‌شود.
- `PopoverContent` اکنون حداکثر عرض و ارتفاع وابسته به viewport و اسکرول داخلی دارد؛ رفتار collision خود Radix همچنان حفظ شده است.
- تست structural primitive در `denali-confirm-dialog.spec.ts` با 3/3 سبز شد؛ تست‌های source مرتبط bookings `13/13`، workspace `26/26` و responsive controlها در این checkout قابل اجرا با runner Playwright هستند، نه `node:test`.
- **محدودیت:** اجرای runtime Playwright این دور به‌دلیل نبود deploy همین worktree انجام نشد؛ پس T09 فعلاً `IN_PROGRESS` می‌ماند و بعد از deploy باید matrix `320/360/390/412` و اندازه‌گیری overflow دوباره اجرا شود.
- **RETEST ATTEMPT:** اجرای isolated با API روی پورت `3311` و وب روی `3310` انجام شد؛ API روی `/health` پاسخ `200` داد، اما Next در lazy compile مسیر `/auth/login` بیش از ۳۰ ثانیه بدون response ماند. فرآیندها متوقف شدند؛ این نتیجه blocker اجرای browser است، نه شکست محصول، و T09 همچنان runtime `UNVERIFIED` است.
- **اصلاح `BUG-TOUR-MOBILE-003` — 2026-09-19:** inventory نشان داد هر دو نمای desktop table و mobile card از کلید مشترک `tours.workspace.table.transportIntake` استفاده می‌کنند؛ بنابراین تغییر صفحه‌ای یا کنترل ساختگی اضافه نشد. مقدار فارسی از `انتخاب حمل` به `وضعیت حمل` و مقدار انگلیسی از `Transport choice` به `Transport status` تغییر کرد تا دادهٔ read-only شبیه action قابل کلیک دیده نشود. تست contract `tour-workspace-operational-roster.spec.ts` نیز صراحتاً هر دو ترجمه را کنترل می‌کند؛ **17/17 سبز**. retest مرورگر بعد از رسیدن SHA همین اصلاح به staging باقی است.
- **اصلاح `BUG-TOUR-MOBILE-001` — 2026-09-19:** نوار تب پیش‌تر `overflow-x-auto` و قرارداد ARIA/keyboard داشت، ولی active tab را به محدودهٔ دید برنمی‌گرداند و hint کشیدن نوار نداشت. utility جدید `scrollHorizontalItemIntoView` در لایهٔ UI ایجاد شد و wrapper ویزارد نیز به همان utility واگذار شد؛ `TourWorkspaceLayoutInner` با هر تغییر `visibleActiveTab` تب فعال را بدون تکان‌دادن scroll عمودی در مرکز نوار می‌آورد و mobile hint قابل‌دیدن دارد. تست‌های `tours-workspace` و `wizard-step-rail-scroll` مجموعاً **30/30 سبز** و `@apps/web lint` سبز است. retest runtime در viewportهای T09 پس از deploy الزامی است.
- **REVALIDATION — 2026-09-19:** اجرای رسمی `@apps/web test:file` برای dialog، wizard rail و tours workspace، **33/33 PASS** شد. یک اجرای دستیِ ناقصِ `node --test` ابتدا با `HTMLElement is not defined` شکست خورد، اما این باگ محصول یا spec نبود: runner رسمی `test/register-dom.mjs` را load می‌کند. هیچ mock یا patch جدیدی برای پنهان‌کردن آن خطا اضافه نشد.
- **RUNTIME MOBILE SMOKE — 2026-09-19 (deploy فعلی، read-only):** در `/tours/:id/workspace` با viewport `320×568`، `documentElement.scrollWidth=305` و `innerWidth=320` بود؛ پس صفحه overflow افقی نداشت. پیش از انتخاب، دو تب انتهایی خارج محدودهٔ دید بودند؛ با انتخاب «لیست عملیاتی» و سپس «وضعیت پرداخت»، tab فعال به بازهٔ `left=20` رسید و کاملاً visible شد. این smoke رفتار مورد انتظار utility مشترک را تأیید می‌کند، اما به‌علت تطبیق‌نداشتن SHA دپلوی با PR #185، معیار نهایی T09 نیست. matrix dialog/popover و عرض‌های 360/390/412 هنوز باقی است.
- **BROWSER RETEST — 2026-09-20:** ماتریس مالی محلی در viewportهای `390×844` و `375×812` برای فارسی/انگلیسی — **2/2 PASS**؛ بدون overflow افقی و با نمایش صحیح نمای مالی/بازپرداخت. Screenshotهای mobile در `apps/web/test-results/finance-ux2-browser-qa/` ثبت شدند. این فقط پوشش finance است؛ matrix کامل T09 برای workspace/dialog/popover و عرض‌های `320/360/390/412` هنوز باز است.
- **WORKSPACE BROWSER RETEST — 2026-09-20:** `denali-workspace-gap-coverage.spec.ts` روی runtime محلی **4/4 PASS** شد: تب waitlist، فیلترهای roster حمل‌ونقل، رد ثبت‌نام تا خروج از صف و بنر degraded مالی. assertion قدیمی `aria-current` با قرارداد واقعی tab (`aria-selected`) همسان شد و رد موفق با حذف row از صف تأیید می‌شود. Screenshot رد نهایی در `apps/web/test-results/t09-workspace-reject-terminal.png` ثبت شد؛ matrix کامل عرض‌های `320/360/390/412` و dialog/popover همچنان باز است.
- **WORKSPACE MOBILE RETEST — 2026-09-20:** همان سناریوی workspace در Chromium واقعی با viewportهای `320×568`، `360×800`، `390×844` و `412×915` هرکدام **4/4 PASS** شدند. تست رد ثبت‌نام برای پنل mobile sheet به selector قراردادی همان دکمهٔ قابل مشاهده محدود شد؛ مسیرهای waitlist، transport filters، reject terminal و finance degraded در هر چهار عرض سبز هستند. بررسی مستقل dialog/popover همچنان باقی است.
- **RESPONSIVE CONTROLS RETEST — 2026-09-20:** suite مرورگر `bookings-directory-controls-responsive.spec.ts` با config رسمی runtime برابر **1/1 PASS** شد. selector صفحه‌بندی به خود پنل محدود شد تا دکمهٔ Next.js Dev Tools با دکمهٔ «بعدی» اشتباه نشود؛ فیلتر پرداخت، active filter، pagination و عدم overflow در breakpointهای suite تأیید شدند.
- **STATUS:** `VERIFIED_LOCALLY`؛ primitiveهای dialog/popover، workspace actionها و کنترل‌های responsive در Chromium واقعی با matrix چهار عرض `320/360/390/412` تأیید شدند. تأیید staging با SHA نهایی جداگانه است.

---

## T10 — ویزارد ساخت تور و draft

### قبل از شروع — گیت عدم تکرار

- canonical document، wizard state، draft persistence، step component و تست‌های resume را inventory کن.
- همان canonical state را reuse کن؛ RHF mirror، draft store یا step flow موازی نساز.
- مسیرهای بررسی‌شده و مالک state را ثبت کن؛ اختلاف source of truth یعنی `NEEDS_DECISION`.

### هدف

ویزارد روی موبایل قابل فهم باشد و draft ناقص بدون توضیح ایجاد نشود.

### یافته‌های پوشش‌داده‌شده

- `OBS-003`، `BUG-009`.
- `BUG-011`: بخش‌های عکس و لجستیک در edit بدون کنترل یا توضیح دیده می‌شوند.
- `BUG-018`: ظاهر/semantics انتخاب دسته و مدت مبهم است.
- `UX-001`، `002`، `004`، `006`.
- `UX-MOB-004` تا `006`.
- `UX-MOTION-003`.

### مراحل اجرا

1. رفتار auto-save و زمان ساخت draft را مستند کن.
2. اگر draft خودکار لازم است، banner «ادامه پیش‌نویس» و action پاک‌سازی نشان بده.
3. دسته و مدت تک‌انتخابی باید radio semantics داشته باشند.
4. مقصد lazy-search باید راهنما و empty/loading state روشن داشته باشد.
5. CTA مرحله بعد روی فرم بلند در دسترس باشد.
6. بخش‌های عکس و لجستیک یا کنترل واقعی داشته باشند، یا read-only/خارج از scope بودنشان صریح اعلام شود.
7. canonical document را تنها source state نگه دار.

### تست‌های الزامی

```bash
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts tests/e2e/custom-create-tours.spec.ts --workers=1
pnpm --filter @apps/web run smoke:denali-draft-unification
pnpm --filter @apps/web run test:file -- test/tours-edit.spec.ts
```

### معیار پذیرش

- reload/resume draft قابل فهم باشد.
- انتخاب‌ها keyboard و screen reader friendly باشند.
- mobile matrix T09 سبز بماند.

### گزارش inventory و تست source — 2026-09-18

- مالک state واحد است: canonical document داخل `DenaliWizardDraftEnvelope`، persistence از `persistDenaliWizardDraftChange` و merge/resume از `mergeDenaliWizardDraftEnvelope` انجام می‌شود؛ RHF mirror یا draft store موازی در مسیر اصلی پیدا نشد.
- رفتارهای مهم از قبل در source و test پوشش دارند: `freshStart`، step inference، merge conflict، tombstone/delete، clear در زمان PATCH، جلوگیری از save-loop و category rebase.
- semantics و شروط ویزارد نیز در تست‌ها پوشش دارند: default category، انتخاب نوع تور، فیلدهای شرطی طبیعت/کوهستان، multi-day، validation تاریخ و minimum age، و navigation step.
- نتایج تست: contract `17/17`، persist `4/4`، resume `6/6`، save-loop `3/3`، unification closure `9/9`، systemic closure `12/12`، conditional `6/6`، validation `10/10` و step shell `7/7` سبز شدند.
- **نتیجه:** برای شکاف‌های source این بخش patch تکراری لازم نیست و وضعیت `SOURCE_FIXED_RETEST_REQUIRED` است؛ اجرای smoke/e2e واقعی و mobile matrix بعد از deploy همچنان برای بستن نهایی باقی مانده است.
- **RETEST — 2026-09-19 (worktree ایزوله):** `tours-edit.spec.ts` برابر **9/9 PASS** شد؛ gate نقش، shell ویرایش، primary action واحد و warm-failure قابل‌بازیابی دوباره تأیید شدند. smoke Playwright ویزارد اجرا نشد، زیرا browser دانلودشدهٔ Playwright در این محیط وجود ندارد؛ Chrome سیستم موجود است و باید با config/runtime ایزوله استفاده شود.
- **BROWSER RETEST — 2026-09-20:** اجرای کامل `denali-itinerary-wizard.spec.ts` روی runtime محلی Denali — **9/9 PASS**؛ ساخت draft، navigation، validation، retry خطای draft و حفظ دادهٔ itinerary بین روزها تأیید شد. Screenshot نهایی در `apps/web/test-results/t10-wizard-itinerary.png` ثبت شد.

---

## T11 — اصلاح تیکت‌ها

### قبل از شروع — گیت عدم تکرار

- ticket route/API، query parser، feature component، dialog/composer و specهای موجود را inventory کن.
- contract و component موجود را reuse کن؛ route، search parser یا composer دوم نساز.
- مسیرهای بررسی‌شده و دلیل ایجاد spec جدید را ثبت کن؛ تعارض contract یعنی `NEEDS_DECISION`.

### هدف

جستجو، breadcrumb، history و composer در desktop/mobile درست کار کنند.

### یافته‌های پوشش‌داده‌شده

- `BUG-TICKET-001` و `002`.
- `UX-TICKET-003` تا `006`.

### مالک کد محتمل

- `apps/web/app/(app)/tickets/tickets-page-client.tsx`
- ticket detail/composer در `apps/web/src/features/tickets`
- ticketing HTTP/API query parser

### مراحل اجرا

1. search را از input تا API `q` trace کن.
2. breadcrumb صفحه را از dashboard به context تیکت تغییر بده.
3. history و composer را در 320px به دو ناحیهٔ بدون overlap تبدیل کن.
4. tabهای mode پاسخ `aria-controls` و `tabpanel` داشته باشند.
5. وضعیت فعلی و actionهای حل/بستن/بازگشایی semantic باشند.

### تست‌های الزامی

```bash
pnpm --filter @app-tour/ticketing-core test
pnpm --filter @app-tour/ticketing-http-contracts test
pnpm --filter @app-tour/ticketing-http test
pnpm --filter @apps/api exec env NODE_ENV=test STORAGE_DRIVER=prisma TENANT_MAX_CONCURRENT_DB_OPS=32 node --import tsx --env-file=.env --env-file=.env.local --test --test-force-exit test/ticketing-http-postgres.spec.ts
```

- چون در checkout فعلی spec مرورگری tracked برای `/tickets` پیدا نشد، قبل از بستن تسک یک spec جدید زیر `apps/web/tests/e2e/` و config سازگار با operator اضافه کن.
- spec جدید باید viewportهای 320 و 390، history طولانی، search ناموجود و keyboard باز را پوشش دهد.
- تست PostgreSQL بالا را با runner حافظه اجرا نکن؛ `STORAGE_DRIVER=prisma` و database تست ایزوله الزامی است.

### معیار پذیرش

- search ناموجود empty state بدهد.
- قبل از ارسال پاسخ، history قابل خواندن بماند.

### گزارش اجرای T11 — 2026-09-18

- **SOURCE:** مسیر query موجود از `buildOperatorTicketsApiQuery`، `parseOperatorTicketsCommandCenterQuery` و `proxyTicketsApiGet` استفاده می‌کند؛ route، parser یا API موازی ساخته نشد.
- **SOURCE:** empty/error/retry، pagination/load-more، idempotency و labelهای event در مسیر موجود inventory و تست شدند؛ تغییر تکراری در این بخش لازم نشد.
- **SOURCE FIXED:** تب‌های public/internal در `apps/web/src/features/tickets/operator-tickets-composer.tsx` اکنون شناسهٔ پایدار، `aria-controls` و panel دارای `role="tabpanel"` و `aria-labelledby` دارند؛ محتوای composer دوباره‌نویسی نشد.
- **TEST:** مجموعهٔ unit/structural وب شامل `operator-tickets.spec.ts`، `operator-ticket-label-fallback.spec.ts` و `dashboard-smoke.spec.ts` برابر `15/15`، `resolve-operator-tickets-middleware-access.spec.ts` برابر `2/2`، `@app-tour/ticketing-core` برابر `75/75`، `@app-tour/ticketing-http-contracts` برابر `38/38` و `@app-tour/ticketing-http` برابر `2/2` سبز شدند؛ typecheck و `git diff --check` نیز سبز است.
- **SOURCE:** برخلاف inventory اولیه، specهای مرورگری tracked وجود دارند: `apps/web/tests/e2e/operator-ticketing-inbox.spec.ts`، `operator-ticketing-a11y.spec.ts` و config مستقل `playwright.operator-ticketing.config.ts`. تست جدید search ناموجود، empty state و keyboard navigation به همان spec رسمی اضافه شد؛ config نیز اجرای Chromium سیستم از طریق `PW_CHROMIUM_EXECUTABLE_PATH` را پشتیبانی می‌کند.
- **GAP:** اجرای E2E در این نوبت به runtime نرسید؛ ابتدا browser داخلی Playwright به‌دلیل CDN منطقه‌ای با `403` نصب نشد، و اجرای Chromium سیستم به علت اشغال بودن `127.0.0.1:3001` توسط API توسعه‌ای checkout اصلی با `socket hang up` متوقف شد. process کاربر عمداً متوقف نشد. برای proof نهایی، اجرای isolated با API روی پورت آزاد و viewportهای 320/390 لازم است.
- **RETEST ATTEMPT:** API isolated روی `3311` سالم بالا آمد، اما وب isolated روی `3310` هنگام lazy compile مسیر `/auth/login` بیش از ۳۰ ثانیه بدون response ماند؛ بنابراین E2E هنوز اجرا نشد و فرآیندهای isolated بعد از ثبت نتیجه متوقف شدند. این blocker محیط اجرای browser است، نه pass یا fail محصول.
- **STATUS:** `IN_PROGRESS`؛ source، unit/contract و تست ساختاری اصلاح و سبز شده‌اند؛ E2E/mobile runtime هنوز `UNVERIFIED` است و تا اجرای isolated نباید بسته اعلام شود.
- **RETEST — 2026-09-19 (worktree ایزوله):** `@app-tour/ticketing-core` **75/75**، `@app-tour/ticketing-http-contracts` **38/38**، `@app-tour/ticketing-http` **2/2** و testهای UI ticket/dashboard **15/15** دوباره PASS شدند؛ مجموع **130/130**. اجرای PostgreSQL و browser matrix همچنان runtime evidence جدا می‌خواهد.
- **REVALIDATION — 2026-09-19 (بدون deploy):** همان چهار suite با harness رسمی دوباره **130/130 PASS** شد. `DATABASE_URL` و `DATABASE_URL_ADMIN` در worktree حاضر نیستند؛ بنابراین `ticketing-http-postgres.spec.ts` عمداً اجرا نشد و با memory runner جایگزین نشد. status E2E/mobile و PostgreSQL همچنان `UNVERIFIED` است، نه سبز.
- **BROWSER RETEST — 2026-09-20:** PostgreSQL محلی روی پورت `5434` بالا آمد، همهٔ migrationها اعمال شد و fixtureهای ticketing seed شدند. اجرای واقعی Chromium روی runtime جداگانهٔ Denali با `apps/web/tests/e2e/operator-ticketing-inbox.spec.ts` برابر **2/2 PASS** شد؛ شامل triage ادمین، دسترسی viewer/member، نمای mobile و mutation conflict. Screenshotهای اجرای موفق در `apps/web/test-results/` ثبت شدند.
- **STATUS:** `VERIFIED_LOCALLY`؛ T11 در محیط محلی PostgreSQL و browser واقعی تأیید شد. تأیید staging/production جدا از این تسک است.

---

## T12 — اصلاح صفحه کاربران

### قبل از شروع — گیت عدم تکرار

- users query/parser، directory controls، dialog primitive، permission و تست‌ها را inventory کن.
- shared dialog و list query موجود را reuse کن؛ invite/search موازی نساز.
- مسیرهای بررسی‌شده و مالک policy را ثبت کن؛ اختلاف RBAC/query یعنی `NEEDS_DECISION`.

### هدف

جستجو و dialog دعوت در تمام عرض‌ها درست باشند.

### یافته‌های پوشش‌داده‌شده

- `BUG-USERS-002` در T01.
- `UX-USERS-003` و `004`.
- `OBS-USERS-001` به‌عنوان مسیر موجود، نه باگ حذف صفحه.

### مالک کد محتمل

- `apps/web/app/(app)/users/users-page-client.tsx`
- `apps/web/app/(app)/users/users-directory-controls.tsx`
- dialog دعوت و shared dialog primitive

### تست‌های الزامی

```bash
pnpm --filter @apps/web run test:file -- test/users-directory.spec.ts
pnpm --filter @apps/web run test:file -- test/users-directory-controls-responsive.spec.ts
pnpm --filter @apps/api run test:file -- test/users-directory-sort.spec.ts
```

### معیار پذیرش

- dialog در 320px داخل viewport باشد.
- close و submit قابل دسترسی باشند.
- search، role filter و pagination هم‌زمان درست کار کنند.

### گزارش اجرای T12 — 2026-09-19

- **SOURCE:** مالک query و کنترل‌ها همان `users-page-client.tsx`، `users-directory-controls.tsx` و `fetch-users-list.server.ts` است؛ dialog مشترک و permission gate موجود reuse شده و مسیر موازی ساخته نشد.
- **SOURCE:** تست‌های موجود برای landmarks صفحه، gate نقش، invite role، query round-trip، pending tab، CSV فیلترشده، pagination، dialog description، mobile bulk action و role filter inventory شدند؛ مورد جدیدی که نیازمند کپی منطق باشد پیدا نشد.
- **TEST:** `users-directory.spec.ts` و `users-list-server-prefetch.spec.ts` در مجموع `34/34`، `users-directory-sort.spec.ts` برابر `3/3` سبز شدند؛ type/contract پوشش‌های موجود برای invite و permission نیز در همین suite‌ها فعال‌اند.
- **SOURCE:** spec ریسپانسیو tracked در `apps/web/test/users-directory-controls-responsive.spec.ts` وجود دارد و viewportهای 1440، 1024، 768 و 390، overflow، filters toggle و pagination را بررسی می‌کند؛ اجرای مرورگری آن در این نوبت به‌دلیل همان محدودیت browser/پورت runtime هنوز انجام نشده است.
- **GAP:** اثبات نهایی dialog در عرض 320px و submit/close با browser runtime، و اجرای هم‌زمان search + role filter + pagination، هنوز `UNVERIFIED` است.
- **STATUS:** `IN_PROGRESS`؛ source و unit coverage سبز است، اما matrix مرورگری mobile هنوز باید در runtime ایزوله اجرا شود.
- **RETEST — 2026-09-19 (worktree ایزوله):** `users-directory.spec.ts` و `users-directory-sort.spec.ts` مجموعاً **36/36 PASS** شدند. spec ریسپانسیو عمداً با `node:test` اجرا نمی‌شود و runner آن خطا را صریحاً گزارش داد؛ اجرای درست آن Playwright با Chrome سیستم و server ایزوله است، نه تغییر کد یا fail محصول.
- **REVALIDATION — 2026-09-19 (بدون deploy):** اجرای رسمی `users-directory.spec.ts` برابر **30/30 PASS** و `users-directory-sort.spec.ts` برابر **3/3 PASS** شد. `users-directory-controls-responsive.spec.ts` دوباره توسط runner به‌درستی `PLAYWRIGHT_RUNTIME` تشخیص داده شد؛ config رسمی `apps/web/playwright.runtime-sweep.config.ts` آن را در `test:runtime-sweep` شامل می‌کند. پس هیچ test/middleware موازی لازم نیست؛ browser matrix فقط با server ایزوله و Chromium اجرا خواهد شد.
- **RUNTIME RECHECK — 2026-09-19 (deploy فعلی، read-only):** dialog دعوت در viewport `320×568` با `top=-88`، `bottom=656` و ارتفاع `744` بیرون viewport بود و dismiss control خام `Close` نمایش داد؛ `scrollWidth=320` بود، پس مشکل overflow افقی نیست. source فعلی در contrast از Dialog مشترک `top-4/bottom-4/overflow-y-auto` و `closeLabel={tCommon("cancel")}` استفاده می‌کند. تست‌های تازهٔ source `users-directory + denali-confirm-dialog` نیز **33/33 PASS** شدند. بنابراین باگ runtime قدیمی بازتولید شد، اما patch موازی یا موضعی لازم نیست؛ retest همان dialog پس از deploy SHA PR شرط بسته‌شدن T12 است.
- **BROWSER FINAL — 2026-09-20:** با runtime محلی همین SHA، Chromium matrix کنترل‌های users در viewportهای `1440×900`، `1024×768`، `768×1024` و `390×844` برابر **1/1 PASS** شد؛ بدون overflow افقی، filters toggle فعال و pagination در breakpointهای لازم قابل مشاهده بود. تست مستقل dialog دعوت در `320×568` نیز **1/1 PASS** شد: dialog داخل viewport (`top >= 0` و `bottom <= 568`)، فیلد تلفن و دکمهٔ ارسال قابل دسترسی، دکمهٔ انصراف قابل استفاده و بستن dialog موفق بود. Screenshot در `apps/web/test-results/t12-users-invite-320.png` ثبت شد.
- **STATUS:** `VERIFIED_LOCALLY`; تست browser proof برای dialog به `playwright.operator.config.ts` اضافه شد تا regression موبایل در اجرای بعدی حفظ شود.

---

## T13 — سازگاری marketing، portal و admin

### قبل از شروع — گیت عدم تکرار

- host resolver، middleware، session authority، cross-surface link، asset loader و guardها را inventory کن.
- resolver/guard canonical را reuse کن؛ redirect، session bridge یا asset allowlist موازی نساز.
- مسیرهای بررسی‌شده و قرارداد هر host را ثبت کن؛ تعارض PCMS یعنی `NEEDS_DECISION`.

### هدف

سه surface با host canonical درست کار کنند، routeها به surface اشتباه نروند، session authority نقض نشود و assetهای marketing بدون 404 لود شوند.

### قراردادهای مرجع

- marketing: `https://denali.shenski.com`
- portal: `https://portal.denali.shenski.com`
- admin: `https://denali.admin.shenski.com`
- WRS-001: routing workspace و ممنوعیت egress به hostهای stale.
- PCMS-001: portal مالک session عضو است؛ marketing به‌طور پیش‌فرض anonymous است.

### گپ‌هایی که این تسک می‌بندد

- ناسازگاری host و redirect بین marketing، portal و admin.
- انتظار اشتباه برای نمایش session عضو داخل marketing برخلاف PCMS، مگر قرارداد جدید تصویب شود.
- 404 یا لودنشدن تصاویر marketing.
- از دست‌رفتن `portalReturn` بعد از login/register.
- اشتباه tenant هنگام ورود از catalog به registration.

### مالک کد محتمل

- `packages/guest-surface-host`
- `packages/tenant-kernel`
- `apps/marketing`
- `apps/portal`
- middleware و host routing در `apps/web`

### مراحل اجرا

1. host canonical هر surface را از standard و resolverها استخراج کن؛ از حدس‌زدن ترتیب subdomain خودداری کن.
2. تمام لینک‌های cross-surface و redirectها را برای Denali بررسی کن.
3. مشخص کن marketing باید anonymous بماند؛ اگر محصول login state در marketing می‌خواهد، وضعیت را `NEEDS_DECISION` ثبت کن و PCMS را بی‌اجازه تغییر نده.
4. flow `marketing tour → portal login/register → portalReturn → registration` را تست کن.
5. asset URL، image host allowlist، status code، content-type و cache header تصاویر marketing را بررسی کن.
6. tenant mismatch و open redirect را با host/return URL مخرب تست کن.
7. admin route نباید landing یا portal را render کند و portal route نباید admin session را قبول کند.

### تست‌های الزامی

```bash
pnpm --filter @app-tour/guest-surface-host test
pnpm --filter @app-tour/tenant-kernel test
pnpm --filter @apps/marketing test
pnpm --filter @apps/portal test
pnpm run guard:wrs-routing
pnpm run guard:wrs-stale-docs
pnpm run guard:pcms-authority
```

### browser matrix

- ورود مستقیم هر سه host در حالت logout.
- marketing → portal registration و بازگشت به همان tour.
- portal login با OTP تست و refresh session.
- admin logout/login و dashboard صحیح.
- تصویر hero، destination و tour cover: status 200 و ابعاد غیرصفر.
- host/tenant اشتباه: fail closed، بدون نشت داده.

### معیار پذیرش

- هیچ redirect loop، host اشتباه یا asset 404 وجود نداشته باشد.
- authority session مطابق PCMS باقی بماند.
- tenant و return URL validation تست منفی داشته باشند.

### گزارش اجرای T13 — 2026-09-19

- **SOURCE:** ownerهای canonical در `guest-surface-host`، `tenant-kernel`، marketing shell/auth و portal session/profile inventory شدند؛ resolver یا session bridge موازی ساخته نشد.
- **FINDING:** `guard:pcms-authority` در دو نقطه با PCMS-001 تناقض داشت: provider را اشتباهاً در root layout می‌خواست، درحالی‌که provider باید PDP-scoped باشد؛ و wrapper SSR را به self-fetch `/api/me/profile` مجبور می‌کرد، درحالی‌که استاندارد و تست‌های SSR استفاده از `fetchMemberProfileUpstreamForHost` را الزام می‌کنند.
- **SOURCE FIXED:** guard اصلاح شد تا provider canonical در detail route را بررسی کند و classifier را در helper upstream ببیند؛ self-fetch loopback را برای SSR رد می‌کند. این اصلاح رفتار محصول را تغییر نمی‌دهد و فقط false negative guard را حذف می‌کند.
- **TEST/GUARD:** suiteهای canonical سبز شدند: `@app-tour/guest-surface-host` برابر `71/71`، `@app-tour/tenant-kernel` برابر `80/80`، `@apps/marketing` برابر `336/336` و `@apps/portal` برابر `371/371`؛ یک تست portal به‌صورت صریح به‌دلیل نصب‌نبودن Chromium skip است، نه pass جعلی. `guard:wrs-routing`، `guard:wrs-stale-docs`، `guard:pcms-authority` و `guard:surface-cohesion` نیز سبز شدند؛ surface cohesion بدون baseline warning گزارش شد.
- **REVALIDATION — 2026-09-19:** روی worktree فعلی، `@app-tour/guest-surface-host` دوباره `71/71 PASS`، `@app-tour/tenant-kernel` دوباره `80/80 PASS` و guardهای `wrs-routing`، `wrs-stale-docs` و `pcms-authority` همگی PASS شدند. این evidence فقط قرارداد source است و browser/runtime را جایگزین نمی‌کند.
- **GAP:** browser matrix سه host، cross-surface login/register، asset status/content-type، tenant mismatch و open-redirect هنوز runtime `UNVERIFIED` است؛ دپلوی فعلی هم SHA اصلاحات این worktree را ندارد.
- **RUNTIME CHECK محدود:** روی deploy فعلی، `GET https://denali.shenski.com/tours` برابر `200` بود؛ هر ۱۰ URL optimizer تصویر استخراج‌شده با `GET` برابر `200` و `image/webp` برگشتند و fallbackهای مستقیم نیز `200` بودند. خطای `HEAD 400` ابزار بررسی معتبر برای مرورگر نیست و به‌عنوان باگ ثبت نشد. این فقط asset smoke است و جایگزین matrix کامل host/session/tenant نیست.
- **STATUS:** `IN_PROGRESS`؛ source contract/guards اصلاح و سبز شده‌اند، اما P0 تا اثبات browser/runtime و تطبیق SHA بسته نمی‌شود.
- **REVALIDATION — 2026-09-19 (بدون deploy):** `@app-tour/guest-surface-host` با `71/71` و `@app-tour/tenant-kernel` با `80/80` دوباره PASS شدند؛ `guard:wrs-routing`، `guard:wrs-stale-docs` و `guard:pcms-authority` نیز PASS شدند. این pass فقط canonical host/cookie/egress contract را اثبات می‌کند؛ matrix واقعی سه host و تصاویر همچنان runtime evidence لازم دارد.
- **RUNTIME HOST SMOKE — 2026-09-19 (deploy فعلی، read-only):** marketing روی `denali.shenski.com/tours` فهرست منتشرشده و linkهای canonical به portal را render کرد؛ مسیر registration پورتال روی `portal.denali.shenski.com/catalog/:tourId/register` tenant درست و session عضو را نگه داشت؛ admin روی `denali.admin.shenski.com/tours` به پنل اپراتور همان workspace رسید. این فقط smoke سه host است؛ login/logout، open-redirect منفی و تطبیق SHA اصلاحات T13 هنوز باقی است.
- **FINAL LOCAL BROWSER PROOF — 2026-09-20:** اجرای واقعی Chromium با runtimeهای محلی تازه‌شده، هر سه surface را سبز کرد: marketing `/tours` با host canonical، portal `/login?portalReturn=%2Fme%2Fregistrations` با status `200` و حفظ return URL، و admin `/dashboard` با redirect صحیح به `/auth/login`. نتیجه `1 passed` و screenshot نهایی در `apps/marketing/test-results/` ثبت شد.
- **FINAL GUARDS — 2026-09-20:** `guard:pcms-authority`، `guard:surface-cohesion`، `guard:surface-cohesion-smoke`، `guard:wrs-routing` و `guard:wrs-stale-docs` همگی PASS شدند. guardها برای مسیر canonical provider در PDP، helper upstream پروفایل SSR و parser واقعی YAML matrix اصلاح شدند؛ رفتار محصول تغییر نکرد.
- **STATUS:** `VERIFIED_LOCALLY`؛ T13 با source contracts، guardها و browser proof Chromium روی runtime محلی تأیید شد. تطبیق deploy SHA همچنان خارج از این تأیید محلی است.

---

## T14 — ممیزی و پاک‌سازی داده و seedهای staging

### قبل از شروع — گیت عدم تکرار

- seed، fixture، migration، smoke data و guardهای محیط را inventory کن.
- seed/guard موجود را reuse کن؛ script پاک‌سازی یا fixture موازی نساز.
- مسیرهای بررسی‌شده و target دقیق را ثبت کن؛ حذف/migration بدون rollback یعنی `NEEDS_DECISION`.

### هدف

باگ‌های داده از باگ‌های کد جدا و داده‌های smoke از دادهٔ قابل نمایش به اپراتور تفکیک شوند.

### یافته‌های پوشش‌داده‌شده

- `OBS-001`: تاریخ epoch.
- `OBS-002` و `BUG-015`: نام‌های آزمایشی.
- `BUG-016`: قیمت‌های مشکوک.
- بخش داده‌ای `OBS-009`.

### مراحل اجرا

1. payload API را قبل از formatter بررسی کن.
2. seed سازندهٔ هر رکورد آزمایشی را پیدا کن.
3. نتیجهٔ ممیزی را قبل از هر حذف گزارش کن؛ ممیزی read-only می‌تواند زود انجام شود.
4. fixtureها را namespace‌گذاری و عمر آن‌ها را محدود کن.
5. حذف داده فقط با target دقیق، قابلیت بازیابی، تأیید staging و اجازهٔ صریح انجام شود.
6. guard اضافه کن که seedهای staging وارد production نشوند.

### معیار پذیرش

- هیچ timestamp epoch یا عنوان smoke بدون label در فهرست عملیاتی نباشد.
- null/zero price policy مشخص باشد.

### گزارش ممیزی T14 — 2026-09-19

- **READ-ONLY SOURCE:** fixture canonical `operator-smoke-published-tour.fixture.ts` با شناسه‌های tenant-scoped و namespace مشخص inventory شد؛ `North Ridge Trek`، شناسه‌های `…0210/…0220` و رکوردهای finance با markerهای `P7 staging` دادهٔ smoke هستند، نه دادهٔ عادی کاربر.
- **SOURCE:** تاریخ تور canonical با `resolveOperatorSmokePublishedTourWindow(now)` از زمان فعلی ساخته می‌شود و epoch ثابت ندارد؛ قیمت `2,500,000` و `offline_receipt` policy صریح fixture است، نه مقدار تصادفی formatter. cover `cdn.example` نیز عمداً برای fallback/asset smoke است و نباید به‌عنوان تصویر واقعی production تلقی شود.
- **SEED SAFETY:** seedهای staging عموماً idempotent و tenant-scoped هستند. برای بستن gap، helper مشترک `apps/api/scripts/assert-staging-seed-environment.ts` به entrypointهای اصلی staging متصل شد؛ development/test آزاد است و production فقط با `STAGING_SEED_ALLOW=1` و مسیر صریحی که staging را مشخص کند مجاز می‌شود.
- **DECISION:** هیچ حذف یا تغییر داده‌ای انجام نشد؛ رکوردهای دستی استیجینگ با مالک `UNKNOWN` همچنان خارج از دامنهٔ mutation باقی می‌مانند تا target و rollback صریح تعیین شود.
- **TEST:** `staging-seed-environment.spec.ts` برابر `4/4` سبز شد و `git diff --check` نیز سبز است.
- **REVALIDATION — 2026-09-19:** `staging-seed-environment.spec.ts` روی worktree فعلی دوباره `4/4 PASS` شد؛ production بدون اثبات صریح staging رد می‌شود و تمام entrypointهای staging از guard مشترک عبور می‌کنند.
- **GUARDS RETEST:** `guard:wrs-routing`، `guard:wrs-stale-docs`، `guard:pcms-authority` و `guard:surface-cohesion` همگی سبز شدند؛ surface cohesion بدون baseline warning و با `6` static + `4` e2e hook پاس شد.
- **GAP:** audit payload واقعی operational roster برای رکوردهای دستی و تعیین target/rollback cleanup باقی است؛ تا آن زمان T14 بسته نمی‌شود.
- **STATUS:** `IN_PROGRESS`؛ ممیزی read-only و تفکیک fixture/داده انجام شد، پاک‌سازی عمداً انجام نشده است.
- **RUNTIME READ-ONLY — 2026-09-19:** فهرست زندهٔ ادمین دنالی، رکورد smoke `North Ridge Trek` را با زمان به‌روزرسانی «۱۱ دی ۱۳۴۸ · ۰۳:۳۰» و چند عنوان آزمایشی دیگر نشان داد. این شاهد، `OBS-001/OBS-002` را روی deploy فعلی تأیید می‌کند؛ هیچ mutation انجام نشد، زیرا target/مالک و rollback پاک‌سازی هنوز صریح نیست.

---

## T14.1 — حفاظت از بازهٔ غیرعادی itinerary در داده و UI

### قبل از شروع — گیت عدم تکرار

- سقف روزها، sync rows، عکس‌های چندروزه، validation API و manifest را با هم inventory کن.
- حد جدید را در component یا validator جدا hard-code نکن؛ یک authority قابل تولید از manifest لازم است.
- دادهٔ staging فعلی را بدون target، مالک و rollback تغییر نده؛ ابتدا جلوی تکرار و انفجار UI را بگیر.

### یافتهٔ runtime — 2026-09-19

- مسیر زندهٔ `/tours/00000000-0000-4000-8000-000000000220/edit` برای تور smoke `North Ridge Trek`، `۱٬۱۹۱` روز برنامه و بیش از هزار کنترل accordion/itinerary رندر کرد.
- ریشهٔ source: `buildDefaultItineraryDays` و `syncDenaliItineraryRows` سقف ۶۰ داشتند، اما `estimateDenaliTourDayCount` مقدار بازهٔ تاریخ را بدون سقف به عکس‌ها و itinerary می‌داد؛ اگر دادهٔ ذخیره‌شده همان تعداد طول داشت، `DenaliItineraryField` آن را بدون trim نمایش می‌داد. validator API نیز طول array را محدود نمی‌کرد.
- این یک مشکل داده/مسیر قدیمی staging است، اما نبود guard باعث می‌شد payload ساختگی نیز همین وضعیت را بازتولید کند.

### اجرای source — 2026-09-19

1. `workspaceItinerary.capabilities.maxDayCount` به manifest دنالی اضافه شد؛ codegen آن را به `WorkspaceItineraryCapabilities` منتقل می‌کند.
2. `DENALI_MAX_ITINERARY_DAY_COUNT` و `clampDenaliItineraryDayCount` از capability تولیدشده گرفته می‌شوند و تنها authority UI برای ساخت، sync و تخمین روزها هستند.
3. API برای همان workspace payload بزرگ‌تر از `maxDayCount` را با `WORKSPACE_ITINERARY_INVALID` رد می‌کند.
4. دادهٔ موجود mutate نشد. پس از deploy، editor حداکثر ۶۰ روز نمایش می‌دهد؛ پاک‌سازی دائمی رکوردهای قدیمی همچنان زیر T14 و نیازمند target/rollback است.

### تست و معیار پذیرش

- مدل دنالی: بازهٔ ۱٬۱۹۱‌روزه در ساخت و sync به ۶۰ محدود شود.
- UI: date range بزرگ هیچ‌وقت بیش از ۶۰ section عکس/itinerary نسازد.
- API: payload ۶۱روزه رد و payload ۶۰روزه معتبر بماند.
- codegen: مقدار manifest در type/runtime generated SDK ظاهر شود.
- runtime: پس از deploy، همان تور بدشکل بدون بیش از ۶۰ control باز شود؛ سپس فقط در صورت تعیین owner/rollback دربارهٔ repair persisted تصمیم بگیر.

### وضعیت

- `SOURCE_FIXED_RETEST_REQUIRED`: سه commit جدا روی branch مربوط به PR ایجاد و push شدند: `afe9c80ea` (سقف ۶۰ روز در manifest/UI/API)، `64bc403bc` (codegen برای هر workspace دارای itinerary، `maxDayCount` را اجباری و fail-fast می‌کند) و `76d4d9e95` (artifact generated جاافتاده). CI نخستین بار با `generate:workspace-registry --check` روی همان artifact stale شکست خورد؛ علت از log استخراج و بدون bypass رفع شد. بازتولید محلی `generate:workspace-registry -- --check` و مسیر کامل `workspace:onboard -- guest-club --guest --from=build` شامل build، test، guest conformance و workspace certification همگی PASS هستند. `generate:workspace-registry`، API capability validator (`13/13`)، codegen itinerary (`4/4`) و Denali itinerary/day-count (`15/15`) سبز هستند؛ `workspace-sdk build`، `workspace-denali lint` و `apps/api tsc --noEmit` نیز بدون خطا تمام شدند. runtime deploy و repair دادهٔ persisted همچنان مدرک نهایی لازم دارند.
- **ANTI-DUPLICATION AUDIT — 2026-09-19:** branch فعلی تأیید شد که `buildDefaultItineraryDays`، `syncDenaliItineraryRows` و `estimateDenaliTourDayCount` همگی `clampDenaliItineraryDayCount` را صدا می‌زنند؛ آن utility تنها از `denaliItineraryCapabilities.maxDayCount` generated از manifest استفاده می‌کند. API نیز `workspaceItinerary.capabilities.maxDayCount` را مستقیماً برای reject payload بلند مصرف می‌کند. بنابراین عدد ۶۰ در source این flow به‌صورت hard-code موازی باقی نمانده است.
- `RUNTIME RECHECK — 2026-09-19 (deploy فعلی)`: همان editor هنوز `۱٬۱۹۱` روز و بیش از هزار control عکس/accordion رندر می‌کند؛ `روز ۱ از ۱۲۰` و دکمهٔ reset `۱٬۱۹۱ ردیف روز` نیز هم‌زمان دیده می‌شوند. این اثبات می‌کند build فعلی guard جدید PR #185 را ندارد. هیچ داده‌ای در runtime تغییر داده نشد؛ retest معتبر فقط پس از deploy SHA PR، با سقف `۶۰` control یا کمتر، قابل ثبت است.

---

## T15 — regression نهایی و بسته‌شدن سند

### قبل از شروع — گیت عدم تکرار

- وضعیت تسک‌ها، تست‌ها، artifactها، PRها و runtime evidence را inventory کن.
- suite و browser flow موجود را reuse کن؛ تست موازی برای پوشاندن gap یا سبزسازی نساز.
- مسیرهای بررسی‌شده و gapهای باقی‌مانده را ثبت کن؛ مدرک ناقص باید بسته نشود.

### هدف

اثبات شود اصلاحات یکدیگر را خراب نکرده‌اند و هر آیتم مدرک بسته‌شدن دارد.

### ترتیب اجرا

1. همهٔ تست‌های targeted هر تسک.
2. تست‌های مشترک سریع:

```bash
pnpm run test:changed
pnpm run guard:import-boundary
pnpm run pre-commit:fast
```

3. build فقط برای appهای تغییرکرده.
   - تغییر web: `pnpm --filter @apps/web build`
   - تغییر portal: `pnpm --filter @apps/portal build`
   - تغییر marketing: `pnpm --filter @apps/marketing build`
   - تغییر API: `pnpm --filter @apps/api build`
4. browser regression مسیر کامل:
   - ساخت/انتشار تور.
   - نمایش در marketing.
   - login/register در portal.
   - ثبت‌نام تور.
   - وضعیت نیازمند تأیید یا auto-approval.
   - حمل و اطلاعات تکمیلی.
   - مشاهدهٔ مقصد پرداخت workspace و کپی شماره کارت فقط در حالت manual/قابل پرداخت.
   - ارسال فیش.
   - تأیید/رد فیش.
   - نهایی‌شدن و حضور در operational roster.
   - Excel export.
   - Telegram event در topic درست.
5. desktop و mobile matrix.
6. `git diff --check` و audit فایل‌های تغییرکرده؛ فایل غیرمرتبط نباید وارد commit شود.
7. هر commit باید فقط یک تسک یا یک علت مشترک را پوشش دهد؛ پیام commit شناسهٔ تسک را داشته باشد.
8. push/PR به base مورد انتظار و انتظار برای checkهای همان SHA؛ force-push فقط در صورت نیاز روشن و بدون حذف کار دیگران.
9. بعد از deploy، runtime SHA را با PR head تطبیق بده و سپس staging smoke را اجرا کن.

### معیار پذیرش نهایی

- هیچ P0 یا P1 در وضعیت `TODO/IN_PROGRESS/BLOCKED` نباشد.
- هر `CLOSED` چهار مدرک کد، تست، runtime و CI همان SHA داشته باشد.
- checkهای required همان HEAD سبز باشند.
- skipها به‌عنوان pass گزارش نشوند.
- staging smoke برای registration، receipt و Telegram انجام شده باشد.
- تنظیم مقصد پرداخت، حالت‌های فعال/غیرفعال و نمایش شرطی آن در پورتال طبق T05-CARD تأیید شده باشند.
- مسیرهای marketing/portal/admin و assetهای marketing طبق T13 تأیید شده باشند.
- tenant isolation، RBAC، idempotency و خطاهای منفی برای مسیرهای تغییرکرده تست شده باشند.
- source SHA، artifact/deploy SHA و runtime evidence به یک نسخه اشاره کنند.

## 7. نگاشت یافته‌های قدیمی به تسک‌ها

| شناسه‌های قبلی                                                                                                                                        | تسک جدید |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `BUG-001`, `002`, `010`, `019`, `020`, `BUG-USERS-002`                                                                                                | T01      |
| `BUG-003`, `004`                                                                                                                                      | T02      |
| `BUG-005`, `013`, `OBS-008`                                                                                                                           | T03      |
| `UX-WORK-001`, `014`, `OBS-009`                                                                                                                       | T04      |
| `OBS-007`, `UX-WORK-004`, `013`                                                                                                                       | T05      |
| گپ مقصد پرداخت کارت‌به‌کارت در تنظیمات workspace و پورتال عضو                                                                                         | T05-CARD |
| رویدادهای registration/receipt/Telegram                                                                                                               | T06      |
| `BUG-006`, `007`, `012`, `017`, `BUG-ADMIN-MSG-001..004`, `UX-SELECT-001`                                                                             | T07      |
| `BUG-008`, `014`, `OBS-005`, `UX-WORK-005..007`, `009..012`, `016`                                                                                    | T08      |
| `OBS-004`, `UX-003`, `007..010`, `012`, `UX-MOB-001..003`, `007..008`, `UX-WORK-002..003`, `008`, `015`, `UX-MOB-WORK-001..011`, `UX-MOTION-001..002` | T09      |
| `OBS-003`, `BUG-009`, `011`, `018`, `UX-001`, `002`, `004`, `006`, `UX-MOB-004..006`, `UX-MOTION-003`                                                 | T10      |
| `BUG-TICKET-001..002`, `UX-TICKET-003..006`                                                                                                           | T11      |
| `OBS-USERS-001`, `UX-USERS-003..004`                                                                                                                  | T12      |
| ناسازگاری host/route/session و لودنشدن assetهای marketing                                                                                             | T13      |
| `OBS-001..002`, `BUG-015..016`                                                                                                                        | T14      |

### موارد چندمالکی

- `UX-WORK-008` هم فرمت تاریخ (T07) و هم layout dialog (T09) را دربرمی‌گیرد؛ هر دو تسک باید بسته شوند.
- `UX-WORK-011` هم scope/feedback فیلتر (T08) و هم placement popover (T09) را دربرمی‌گیرد.
- `UX-011` هم count/query فهرست (T01) و هم hierarchy ظاهری (T09) را دربرمی‌گیرد.
- `BUG-018` و `UX-004` باید در T10 از نظر رفتار و در T09 از نظر semantics/accessibility کنترل شوند.
- `OBS-006` یافتهٔ اجرایی مستقل نیست؛ مدرک آن ورودی matrix موبایل T09 است.

## 8. موارد بسته یا تأییدشدهٔ قبلی

### CLOSED — تغییر پوسته

- شناسهٔ قبلی: `UX-005`.
- شاهد: class `dark` و رنگ پس‌زمینه با کلیک تغییر کرد و با کلیک دوم برگشت.

### VERIFIED — عملکرد پایه export و navigation workspace

- کارت‌های summary به tab متناظر هدایت شدند.
- فیلتر operational roster روی `نهایی` کار کرد و پاک شد.
- Excel با نام استاندارد دانلود شد.
- dialog ثبت‌نام focus trap و labelهای متصل داشت.

### NOT_A_BUG — صفحه کاربران حذف نشده است

- `/users` مستقیم باز شد و tab دعوت‌ها و role filter کار کردند.
- مشکلات باقی‌مانده متعلق به search/responsive هستند و در T01/T12 پیگیری می‌شوند.

## 9. وضعیت جاری CI

- baseline تاریخی: PR `#183` به `dev` merge شده بود؛ evidence آن جایگزین evidence تغییرات فعلی نیست.
- PR فعال: `#185` با head `0d7481e4392dcfa32035c640e8445e6545f281a0` به base `dev` است. در snapshot نخست 2026-09-19، هیچ check شکست‌خورده‌ای نداشت اما L3 و چند gate دیگر هنوز `IN_PROGRESS` بودند؛ بنابراین merge status `UNSTABLE` بود. در snapshot بعدی، `Production readiness L3 release gate` از active خارج شد و failure نداشت؛ ریشهٔ `cw7-13` بنابراین روی SHA جدید رفع‌شده است. با این حال چند gate دیگر هنوز `IN_PROGRESS` هستند و تا پایان آن‌ها نباید status نهایی سبز گزارش شود.
- ریشهٔ شکست پیشین L3 در head قبلی استخراج شد: test synthetic `cw7-13` با قرارداد تازهٔ `maxDayCount` همگام نبود. اصلاحِ commit `0d7481e43` فقط همان fixture را تغییر داده و test مستقیم `13/13 PASS` است.
- jobهای `SKIPPED` اجرا نشده‌اند و در گزارش نهایی نباید pass شمرده شوند؛ همین‌طور checkهای `IN_PROGRESS` یا workflow صرفاً triggerشده مدرک release نیستند.
- تا merge و deploy همین SHA، CI فعلی صرفاً source evidence است. T00/T06/T13/T15 هنوز به تطبیق deploy SHA و runtime smoke نیاز دارند.
- **مرز تحویل / جلوگیری از نتیجه‌گیری نادرست — 2026-09-19:** PR `#185` فقط تغییرهای commit‌شدهٔ تور/Excel/responsive/itinerary را حمل می‌کند (از جمله `c08ccc10b` تا `0d7481e43`). تغییرهای هنوز commit‌نشدهٔ مقصد پرداخت، receipt/portal، worker Telegram، تنظیمات integration، ticket، finance و guard/seed staging در `git diff` محلی‌اند و داخل head این PR نیستند. بنابراین هر دپلوی `dev` پیش از commit و PR مستقل آن‌ها، نه می‌تواند T05-CARD/T06/T07/T11/T13/T14 را release کند و نه failure آن‌ها را به PR #185 نسبت داد. قبل از runtime retest، ابتدا باید برای هر دستهٔ owner یک commit/PR ایزوله، scope review و SHA قابل ردیابی وجود داشته باشد؛ squash یا stage گروهیِ این diff ممنوع است.
- **CI live recheck — 2026-09-19:** `Phase 4 gate (Postgres required)` روی همان head با موفقیت تمام شد؛ وضعیت اکنون `27 successful / 0 failed / 3 in progress` (`Phase 5`، `Marketing Playwright smoke` و `Phase 0 integration`) و merge status همچنان `UNSTABLE` است. این update، دپلوی یا merge را اثبات نمی‌کند.
- **مرز اعتبار `test:changed`:** اجرای محلیِ در حال انجام targetها را از `origin/main...HEAD` برمی‌گزیند، اما فایل‌های dirty همان worktree را اجرا می‌کند. نتیجه برای کشف regression میان تغییرهای فعلی مفید است، ولی به‌علت وجود تغییرهای commit‌نشده، نباید به‌عنوان CI یا runtime proof خالصِ SHA `0d7481e43` گزارش شود. برای release proof فقط checkهای remote همان SHA و پس از merge، runtime همان artifact معتبرند.

### ماتریس تحویل و retest

| بخش                                 | وضعیت source                  | محل تحویل فعلی            | شرط retest معتبر                                                 |
| ----------------------------------- | ----------------------------- | ------------------------- | ---------------------------------------------------------------- |
| T01، T04/T05 UX، T09، T14.1         | commit شده                    | PR #185، head `0d7481e43` | تمام‌شدن CI، merge به `dev` و deploy همان SHA                    |
| T05-CARD config/portal/receipt      | local dirty؛ race هنوز باز    | هیچ PR مستقل ندارد        | اول completion زیرتسک `T05-CARD-RACE`، سپس commit ایزوله و CI    |
| T06 worker/topic/formatter Telegram | local dirty؛ source tests سبز | هیچ PR مستقل ندارد        | commit ایزوله، CI، سپس registration/receipt واقعی در forum group |
| T07، T11، T13، T14 guard/seed       | local dirty یا source-only    | هیچ PR مستقل ندارد        | تفکیک owner، commit/PR ایزوله و test همان SHA                    |
| همهٔ browser/Telegram/seed runtime  | نیازمند runtime               | خارج از source proof      | deploy همان SHA، host/session/data مناسب و evidence قابل ثبت     |

**قاعدهٔ تصمیم:** اجرای retest هر ردیف فقط زمانی مجاز است که build/runtime شامل SHA همان ردیف باشد. test یا دپلوی PR #185 نباید به‌عنوان تأیید تغییرهای local dirty گزارش شود.

### پارتیشن commit برای تغییرهای local موجود

| commit مستقل      | فایل‌های مجاز                                                                                                                                                                 | وابستگی                                                 | حداقل اثبات پیش از PR                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `T05-CARD-base`   | `apps/api/{prisma,schema,settings,bookings,workspace-finance}`, `packages/{booking-http-contracts,finance-*}`, `apps/{portal,web}/...payment-destination...` و testهای متناظر | ندارد                                                   | API/portal/web targeted tests، migration validate، leak audit |
| `T05-CARD-RACE`   | migration history/snapshot، finance repository/port، receipt submit/review و testهای A→B/cross-tenant/idempotency                                                             | `T05-CARD-base`                                         | race + unknown revision + isolation + no-egress tests         |
| `T06-Telegram`    | `apps/api/src/integrations/**`، `packages/workspaces/denali/src/integrations/**` و testهای integration/chain                                                                  | T05-CARD فقط برای receipt fixture، نه برای routing core | policy/mapping/worker/chain suites و contract payload         |
| `T07-UI-messages` | integration settings، audit trail، `messages/*/settings.json` و testهای settings                                                                                              | ندارد                                                   | i18n/fallback and settings/audit tests                        |
| `T11-tickets`     | ticket shell/composer، ticket tests و Playwright config متناظر                                                                                                                | T09 primitive فقط از API مشترک                          | unit + targeted operator ticketing E2E                        |
| `T13-T14-guards`  | host guard و staging seed script/testها                                                                                                                                       | ندارد                                                   | guard suites + seed production-deny tests                     |

فایل یا تستی که در بیش از یک ردیف قرار می‌گیرد، قبل از stage باید به کوچک‌ترین علت مشترک منتقل یا در PR جدا با dependency صریح ثبت شود؛ `git add -A` یا stage کردن کل worktree مجاز نیست.

## 10. اعتبارسنجی خود این برنامه

- تمام 16 تسک عددی `T00` تا `T15` به‌اضافهٔ تسک‌های مستقل `T05-CARD` و `T14.1` دقیقاً یک‌بار در فایل وجود دارند؛ در مجموع 18 تسک اجرایی. هر 18 تسک دقیقاً یک «گیت عدم تکرار» دارد.
- تمام مسیرهای spec نوشته‌شده در commandها روی filesystem فعلی وجود دارند.
- اسکریپت‌های `guard:wrs-routing`، `guard:wrs-stale-docs`، `guard:pcms-authority`، `test:changed`، `guard:import-boundary` و `pre-commit:fast` در root تعریف شده‌اند.
- command نمونهٔ web واقعاً اجرا شد: `test/tours-list.spec.ts` با 31 تست سبز.
- command هدفمند portal واقعاً اجرا شد: `test/portal-member-receipt-bff.spec.ts` با 6 تست سبز.
- اجرای web نشان داد mapping تاریخی status عمداً در تست فعلی وجود دارد؛ به همین دلیل تصمیم قرارداد در T01 قبل از هر تغییر الزامی شد.
- سند با Prettier و `git diff --check` بررسی شده است.

## 11. بازبینی مجدد نسخهٔ به‌روزشدهٔ پروژه — 2026-09-18

> این بخش نتیجهٔ retest فعلی است و در صورت تعارض، وضعیت این بخش بر یافتهٔ قدیمی‌تر مقدم است. بررسی روی محیط فعلی admin با viewportهای `320×568` و `390×844` انجام شد. هیچ کد برنامه‌ای تغییر نکرد.

### وضعیت موارد قبلی

| مورد                                       | وضعیت فعلی                                       | شاهد جدید                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| جستجوی لیست تورها (`BUG-001`)              | **حل شده در runtime فعلی**                       | مقدار `ZZZ-NOT-FOUND` به URL `?search=ZZZ-NOT-FOUND` رفت و empty state `توری با این فیلترها پیدا نشد` نمایش داده شد.            |
| جستجوی کاربران (`BUG-USERS-002`)           | **حل شده در runtime فعلی**                       | retest در `2026-09-19`: `/users?search=ZZZ-NOT-FOUND` جدول بدون ردیف نشان داد؛ URL، fetch و empty-result اکنون هم‌سو هستند.     |
| جستجوی تیکت (`BUG-TICKET-001`)             | **حل شده در runtime فعلی**                       | retest در `2026-09-19`: `/tickets?q=ZZZ-NOT-FOUND` inbox را بدون کارت تیکت و با متن empty state نشان داد.                       |
| مرتب‌سازی کمترین قیمت (`BUG-002`)          | **هنوز باز / نیازمند ریشه‌یابی**                 | انتخاب `کمترین قیمت` URL را به `sort_by=price` برد، اما اولین تور `۲٬۵۰۰٬۰۰۰ تومان` بود و تورهای ارزان‌تر پایین‌تر قرار داشتند. |
| dialog دعوت کاربران (`UX-USERS-003`)       | **هنوز باز**                                     | در `320×568` dialog با `y=-88` و دکمهٔ بستن با `y=-71` خارج viewport است.                                                       |
| پنل فیلتر تورها (`UX-MOB-001/002`)         | **هنوز باز**                                     | پنل در `390px` تا `right=390` می‌رسد و حاشیهٔ راست داخل فضای امن نیست.                                                          |
| کلید موفقیت تلگرام (`BUG-ADMIN-MSG-001`)   | **source اصلاح شد؛ retest runtime لازم است**     | render مستقیم `testResult.code` حذف شد؛ تست اتصال واقعی عمداً تکرار نشد چون پیام خارجی ارسال می‌کند.                            |
| متن اتصال تلگرام (`BUG-ADMIN-MSG-002`)     | **source پوشش داده شد؛ retest runtime لازم است** | namespaceهای فعلی فارسی/انگلیسی interpolation معتبر دارند و عبارت خراب در source فعلی وجود ندارد.                               |
| event keyهای حسابرسی (`BUG-ADMIN-MSG-004`) | **source اصلاح شد؛ retest runtime لازم است**     | UI از label انسانی action/resource استفاده می‌کند و UUID خام را در متن عادی حذف کرده است.                                       |

### BUG-CURRENT-001 — دکمهٔ بستن dialog دعوت هنوز با متن انگلیسی `Close` نمایش داده می‌شود

- **شدت:** متوسط
- **محل دقیق UI:** `/users` → `دعوت` → dialog `دعوت هم‌تیمی` در موبایل
- **شاهد runtime:** در متن dialog علاوه بر `انصراف` و `ارسال دعوت`، دکمهٔ جداگانهٔ `Close` با همین متن انگلیسی وجود دارد.
- **ریسک:** در رابط فارسی دو affordance بستن وجود دارد و یکی از آن‌ها ترجمه نشده است؛ کاربر ممکن است نفهمد آیا `Close` همان بستن dialog است یا action دیگری.

#### گزارش ریشه‌یابی و اصلاح source — 2026-09-19

- **ریشه:** primitive مشترک `DialogContent` نام قابل‌دسترسی close را به‌صورت ثابت `Close` رندر می‌کرد؛ dialog دعوت از همان primitive استفاده می‌کرد و label موضعی نداشت.
- **اصلاح:** prop اختیاری `closeLabel` به primitive اضافه شد و dialog دعوت مقدار locale موجود `common.cancel` را به آن می‌دهد. default انگلیسی برای consumerهای قدیمی حفظ شد؛ ترجمه یا Dialog موازی ایجاد نشد.
- **تست source:** `apps/web/test/users-directory.spec.ts`، 30/30؛ `apps/web/test/denali-confirm-dialog.spec.ts`، 3/3.
- **وضعیت:** `SOURCE_FIXED_RETEST_REQUIRED`؛ retest فارسی runtime پس از deploy همین SHA لازم است.

### BUG-CURRENT-002 — مرتب‌سازی قیمت با label درست، query ناقص/مبهم ارسال می‌کند

- **شدت:** زیاد
- **محل دقیق UI:** `/tours`، select مرتب‌سازی، گزینهٔ `کمترین قیمت`
- **شاهد runtime:** گزینهٔ قابل‌مشاهده `کمترین قیمت` است اما URL به `sort_by=price` می‌رود و ترتیب نتیجه ascending نیست؛ تور ۲٫۵ میلیون قبل از تورهای ۸۵۸٬۸۸۸ و ۱۲۳٬۳۳۳ نمایش داده شد.
- **ریسک:** متن select با رفتار واقعی backend هم‌خوان نیست و کاربر نمی‌تواند به نتیجهٔ مرتب‌سازی اعتماد کند.

#### گزارش ریشه‌یابی و اصلاح source — 2026-09-19

- **ریشه:** در `apps/api/src/tours/operator-tour-list-db-query.ts` حالت `price` به‌جای قیمت به `createdAt` متصل بود؛ comparator حافظه نیز قیمت را پوشش نمی‌داد. بنابراین label و query درست به نظر می‌رسیدند اما ترتیب واقعی غلط بود.
- **اصلاح:** comparator عددی مشترک بر اساس قرارداد canonical (`pricing.basePricePerPerson` با fallbackهای سازگار) اضافه شد؛ repository حافظه و Prisma از همان comparator استفاده می‌کنند. مقدار بدون قیمت در هر دو جهت انتهای فهرست می‌ماند و tie-breaker پایدار با `id` انجام می‌شود؛ منطق جداگانهٔ UI یا workspace ساخته نشد.
- **تست source:** `apps/api/test/operator-tour-list-db-query.spec.ts`، 3/3؛ `apps/api/test/tours-operator.spec.ts`، 15/15. regression شامل قیمت ۱۲۳٬۳۳۳ و ۲٬۵۰۰٬۰۰۰ است.
- **وضعیت:** `SOURCE_FIXED_RETEST_REQUIRED`؛ چون `origin/dev` هنوز روی SHA قدیمی است، بسته‌شدن نهایی منوط به deploy همین commit و تکرار تست در runtime است.
- **retest runtime فعلی:** در `2026-09-19`، صفحهٔ زنده هنوز `۲٬۵۰۰٬۰۰۰` را پیش از `۸۵۸٬۸۸۸`، `۱۲۳٬۳۳۳` و `۳۵۰` نشان داد؛ پس این deploy اصلاح source را شامل نمی‌شود.

### وضعیت فعلی selectها

- label و optionهای native select در پروفایل، پریست تور، کاربران و تیکت‌ها در این pass انسانی بودند؛ raw key داخل optionهای این مسیرها مشاهده نشد.
- مشکل ظاهری/حرکتی selectها همچنان باقی است: پنل فیلتر تورها بدون animation وارد می‌شود، در حالی‌که combobox مقصد انیمیشن `0.18s` دارد؛ این ناهماهنگی به‌عنوان `UX-MOTION-001/002/003` در بخش mobile ثبت شده است.
- source عمومی enum select هنوز fallback فنی دارد: در `apps/web/src/wizard/wizard-field.tsx:50-73` مقدار داخلی option در صورت نبود ترجمه به‌عنوان label استفاده می‌شود (`label: ... ?? value`). این مورد در optionهای فعلیِ pass حاضر raw key تولید نکرد، اما باید با همهٔ enumهای workspace retest شود.

### مواردی که در بازبینی فعلی حل‌شده یا سالم بودند

- جستجوی لیست تورها و empty state آن در نسخهٔ فعلی درست کار کرد.
- مسیرهای `/settings/me`، `/settings/integrations` و `/settings/audit-trail` قابل دسترسی بودند.
- optionهای قابل‌مشاهدهٔ native selectهای بررسی‌شده در این pass متن انسانی داشتند.

### محدودیت‌های این retest

- تست دوبارهٔ دکمهٔ `آزمایش اتصال` تلگرام انجام نشد، چون پیام واقعی به کانال ارسال می‌کند؛ وضعیت کلید raw از source فعلی و مشاهدهٔ قبلی ثبت شده و برای بستن نهایی نیازمند retest کنترل‌شده است.
- عملیات ذخیره، دعوت، تغییر وضعیت تیکت، تغییر پروفایل و تغییر تنظیمات انجام نشد.

## 12. بازبینی تکمیلی «مدیریت یک تور» در موبایل — 2026-09-18

> مسیر اصلی بررسی‌شده: `/tours/00000000-0000-4000-8000-000000000220/workspace` در viewportهای `390×844` و `320×568`.

### BUG-TOUR-MOBILE-001 — تب‌های مدیریت تور در عرض ۳۲۰px خارج از دید اولیه قرار می‌گیرند

- **شدت:** متوسط تا زیاد
- **محل دقیق UI:** نوار تب‌های `درخواست‌های ثبت‌نام`، `لیست انتظار`، `لیست عملیاتی` و `وضعیت پرداخت`
- **شاهد runtime در `320×568`:** tablist عرض `280px` و `overflow:auto` دارد؛ مختصات تب‌ها در حالت اولیه: `درخواست‌های ثبت‌نام x=154.98`، `لیست انتظار x=51.79`، `لیست عملیاتی x=-63.03` و `وضعیت پرداخت x=-188.26`. دو تب آخر خارج viewport هستند و scrollbar/affordance واضحی برای ادامهٔ تب‌ها دیده نمی‌شود.
- **ریسک:** کاربر ممکن است نداند تب‌های عملیاتی و پرداخت وجود دارند؛ مخصوصاً چون header و کارت اطلاعات تور بخش زیادی از ارتفاع موبایل را مصرف کرده‌اند.
- **پیشنهاد:** تب‌ها در موبایل به‌صورت carousel/scroll با fade یا arrow hint نمایش داده شوند، یا به select/segmented navigation قابل‌مشاهده تبدیل شوند؛ تب فعال همیشه در مرکز/محدودهٔ دید نگه داشته شود.

### BUG-TOUR-MOBILE-002 — فیلتر لیست عملیاتی در موبایل به لبهٔ راست می‌چسبد

- **شدت:** متوسط
- **محل دقیق UI:** تب `لیست عملیاتی` → دکمهٔ `فیلترها`
- **شاهد runtime در `390×844`:** dialog فیلتر با `x=70`, `width=320`, `right=390` باز شد؛ بنابراین مرز و shadow سمت راست روی لبهٔ viewport قرار گرفت.
- **محتوا:** select `نمای لیست` با گزینه‌های `همه عملیاتی`، `نهایی`، `نیازمند پرداخت`، `تسویه‌شده`، `مهلت نزدیک` و `لیست انتظار`.
- **ریسک:** لمس گزینه‌های سمت راست و تشخیص مرز dialog سخت‌تر می‌شود؛ همین الگوی clipping در filterهای دیگر مدیریت تور هم قابل تکرار است.

### BUG-TOUR-MOBILE-003 — «انتخاب حمل» در کارت عملیاتی شبیه کنترل انتخابی است اما قابل تعامل نیست

- **شدت:** متوسط
- **محل دقیق UI:** تب `لیست عملیاتی`، کارت `hamed rokhbakhsh` در نمای موبایل
- **شاهد runtime:** کارت عبارت label `انتخاب حمل` و مقدار `حمل سازمان‌یافته` را نشان می‌دهد، اما داخل کارت `button`، `input`، `select` یا `combobox` وجود ندارد؛ کل کارت نیز link/action ندارد.
- **ریسک:** کاربر تصور می‌کند می‌تواند حمل را از همین محل تغییر دهد، ولی هیچ affordance یا توضیحی دربارهٔ read-only بودن وجود ندارد.
- **پیشنهاد:** اگر کارت فقط read-only است، label به `وضعیت حمل` تغییر کند؛ اگر باید editable باشد، کنترل واضح با مقدار فعلی، گزینه‌ها و feedback ذخیره اضافه شود.

### UX-TOUR-MOBILE-004 — بارگذاری کارت خلاصهٔ مدیریت تور در عرض ۳۲۰ با تأخیر محسوس دیده می‌شود

- **شدت:** کم تا متوسط / نیازمند تکرار در شبکه‌های مختلف
- **شاهد runtime:** در `320×568` بعد از حدود `800ms` کارت خلاصهٔ تور هنوز skeleton/فضای خالی نشان می‌داد؛ عنوان `North Ridge Trek` حدود `1.5s` بعد قابل مشاهده شد. در `390px` همین عنوان حدود `0.9s` بعد دیده شد.
- **ریسک:** کاربر در ابتدای ورود تصور می‌کند صفحه ناقص یا بدون داده است، چون تب‌ها و actionها قبل از context اصلی تور دیده می‌شوند.
- **پیشنهاد:** skeleton باید ساختار واقعی کارت (عنوان، تاریخ، ظرفیت و وضعیت‌ها) را شبیه‌سازی کند؛ اگر داده دیر می‌رسد، loading label یا progress context اضافه شود.

### وضعیت بخش‌های بررسی‌شده در مدیریت تور

- header، وضعیت تور، ظرفیت، تب‌های چهارگانه، ثبت‌نام دستی، جستجوی ثبت‌نام‌ها، فیلتر لیست عملیاتی، خروجی Excel و کارت عملیاتی بررسی شدند.
- روی کارت موجود هیچ تغییر حمل، پرداخت، وضعیت ثبت‌نام یا ذخیره‌ای انجام نشد.
- dialog ثبت‌نام دستی در این pass جدید به‌دلیل timeout ابزار کامل اندازه‌گیری نشد و باید در retest مستقل با viewport `320px` بررسی شود؛ این مورد به‌عنوان یافتهٔ قطعی جدید اعلام نشده است.

## 13. pass متمرکز روی تب اول «درخواست‌های ثبت‌نام» — 2026-09-18

> مسیر: `/tours/00000000-0000-4000-8000-000000000220/workspace`، تب `درخواست‌های ثبت‌نام`، viewportهای `390×844` و `320×568`.

### BUG-REQUESTS-MOBILE-001 — فیلتر تب درخواست‌های ثبت‌نام به لبهٔ راست موبایل می‌چسبد

- **شدت:** متوسط
- **محل دقیق UI:** تب اول → دکمهٔ `فیلترها`
- **شاهد runtime در `390×844`:** پنل فیلتر با `x=70`, `width=320`, `right=390` باز شد؛ در نتیجه border و shadow سمت راست دقیقاً روی لبهٔ viewport قرار گرفت.
- **محتوای پنل:** `وضعیت پرداخت` با گزینه‌های `همه وضعیت‌های تسویه`، `پرداخت‌نشده (رزرو)`، `پرداخت جزئی (رزرو)`، `وجه دریافت شد` و select `مرتب‌سازی`.
- **ریسک:** popup در موبایل فضای امن راست ندارد و با الگوی فیلترهای دیگر مدیریت تور ناسازگار/چسبیده دیده می‌شود.

### BUG-REQUESTS-MOBILE-002 — dialog ثبت‌نام دستی در متن کاربر-facing timestamp فنی نشان می‌دهد

- **شدت:** متوسط
- **محل دقیق UI:** تب اول → `ثبت‌نام دستی` → dialog `ثبت‌نام دستی در ورک‌اسپیس تور`
- **شاهد runtime:** زیر عنوان `North Ridge Trek` مقدار خام `2026-09-25T08:00:00.000Z` نمایش داده شد؛ در همان کارت قیمت به قالب فارسی نمایش داده شده است.
- **ریسک:** timestamp برای کاربر فارسی ناخوانا است و با فرمت تاریخ/ساعت محلی بقیهٔ صفحه یکدست نیست؛ همچنین timezone برای کاربر مشخص نیست.

### BUG-REQUESTS-MOBILE-003 — دکمهٔ بستن dialog ثبت‌نام دستی ترجمه نشده و duplicate affordance دارد

- **شدت:** متوسط
- **محل دقیق UI:** همان dialog ثبت‌نام دستی در تب اول
- **شاهد runtime در `320×568`:** هم `انصراف` در footer و هم دکمهٔ جداگانهٔ `Close` در header وجود داشت؛ متن header انگلیسی و بدون ترجمه است.
- **ریسک:** دو راه بستن با زبان و جایگاه متفاوت، hierarchy dialog را مبهم می‌کند؛ در رابط فارسی باید دکمهٔ header فقط icon با aria-label فارسی یا متن `بستن` باشد.

### UX-REQUESTS-004 — انتخاب «عضو موجود / مهمان جدید» ظاهر انتخابی دارد اما state semantic ندارد

- **شدت:** متوسط
- **محل دقیق UI:** ابتدای dialog ثبت‌نام دستی، بخش `ثبت‌نام برای`
- **شاهد runtime:** دکمه‌های `عضو موجود` و `مهمان جدید` با تفاوت رنگی نمایش داده شدند، اما هیچ‌کدام `aria-pressed`، `aria-selected`، `role=tab` یا `role=radio` نداشتند.
- **ریسک:** کاربر keyboard یا screen reader state فعال را قابل‌اعتماد تشخیص نمی‌دهد؛ این مسئله برای انتخاب مسیر فرم ثبت‌نام مهم است.

### UX-REQUESTS-005 — در حالت بدون درخواست، actionهای تب اول قبل از empty state قرار گرفته‌اند

- **شدت:** کم تا متوسط
- **محل دقیق UI:** تب اول در `390×844`
- **شاهد بصری/runtime:** پس از کارت‌های وضعیت، ترتیب صفحه به `ثبت‌نام دستی`، جستجو، `فیلترها` و سپس کارت empty state می‌رسد؛ کاربر برای دیدن نتیجهٔ «درخواستی وجود ندارد» باید پایین‌تر اسکرول کند.
- **ریسک:** در حالت خالی، primary action ثبت‌نام دستی قبل از توضیح empty state دیده می‌شود و پیام اصلی صفحه در پایین‌تر قرار می‌گیرد؛ بهتر است empty state و action مرتبط یک بلوک واحد و نزدیک باشند.

### وضعیت این pass تب اول

- تب اول، empty state، جستجوی نام/موبایل/ایمیل، فیلتر پرداخت/مرتب‌سازی و dialog ثبت‌نام دستی بررسی شد.
- در دادهٔ فعلی این تور درخواست pending برای نمایش کارت واقعی وجود نداشت؛ بنابراین layout کارت درخواست واقعی و actionهای تأیید/رد در این pass قابل ارزیابی کامل نبود و نیازمند fixture یا تور دارای درخواست است.
- هیچ ثبت‌نامی ایجاد، تأیید، رد یا ذخیره نشد.

### اصلاح source ثبت‌نام دستی — 2026-09-19

- `BUG-REQUESTS-MOBILE-002`: `AdminAssistedRegistrationDialog` تاریخ raw `requirements.departureAt` را مستقیم render می‌کرد. اکنون از formatter مشترک `formatTourDeparture(..., locale)` استفاده می‌کند؛ مسیر فرمت موازی ساخته نشد.
- `BUG-REQUESTS-MOBILE-003`: close control shared dialog اکنون `closeLabel={t("actions.cancel")}` می‌گیرد؛ در فارسی screen-reader label انگلیسی `Close` نمایش/اعلام نمی‌شود. وجود دکمهٔ footer «انصراف» همچنان action روشن و مستقل برای بستن dialog است.
- `UX-REQUESTS-004`: دکمه‌های عضو/مهمان اکنون `aria-pressed` متناسب با mode فعال دارند؛ semantic state بدون تغییر در state machine موجود اضافه شد.
- تست UI-contract جدید و تست logic موجود، مجموعاً **8/8 سبز** هستند؛ `@apps/web lint` نیز سبز است. تست مرورگری 320px بعد از deploy برای بستن runtime این سه مورد باقی است.

## بخش دوم — مسیر کیف پول و تسویهٔ راننده

# مسیر موقت اجرای راننده، تسویه، کیف پول و برداشت

> وضعیت: فاز صفر در حال تحلیل — هنوز مجوز تغییر منطق مالی یا واریز واقعی نیست.
>
> تاریخ: ۱۴۰۵/۰۶/۲۸ (2026-09-19)

## 0. فاز صفر — تطبیق با وضعیت فعلی و دروازه تصمیم

### 0.1 واقعیت فعلی کد و سندهای رسمی

این مسیر از صفر شروع نمی‌شود. پیاده‌سازی فعلی DP-5 وجود دارد، ولی برای هدف این سند کافی نیست:

| بخش           | وضعیت فعلی                                             | فاصله تا هدف این سند                                                    |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| مبنای مبلغ    | `min(offeredSeats, assignedPassengers)` در زمان freeze | باید با تعداد **واقعیِ ثبت‌شده** در اجرای تور جایگزین شود.              |
| زمان payable  | freeze → تأیید اپراتور → پرداخت دستی                   | باید بعد از پایان واقعی تور و تأیید تسویه باشد.                         |
| نگه‌داری داده | allocation و settlement در حافظه                       | باید با دیتابیس، RLS، version و audit پایدار شود.                       |
| ذی‌نفع پرداخت | `driverRegistrationId`                                 | باید به `memberUserId` پایدار وصل شود؛ راننده مهمان نباید بستانکار شود. |
| مقصد پول      | Finance payable و ثبت مدرک پرداخت دستی                 | ابتدا wallet credit اتمیک، سپس withdrawal مستقل.                        |
| کیف پول عضو   | در جهت محصول قبلی deferred/hidden بوده است             | باید به یک bounded context صریح با ledger و رزرو موجودی تبدیل شود.      |

منبع فعلی: `docs/workspaces/denali/driver-settlement.mdoc` و `docs/dev/dp-5-execution-plan.md`.

### 0.2 تضادهای عمدی که باید قبل از کدنویسی حل شوند

این سند یک **تغییر محصول** نسبت به تصمیم‌های فعلی DP-5 است، نه صرفاً تکمیل UI. تا زمانی که موارد زیر امضا نشده‌اند، هیچ migration، endpoint پولی یا دکمه واریز ساخته نمی‌شود:

| شناسه | تصمیم لازم            | پیشنهاد این سند                                                  | تصمیم فعلی که جایگزین می‌شود   |
| ----- | --------------------- | ---------------------------------------------------------------- | ------------------------------ |
| DW-01 | مبنای پرداخت راننده   | `min(actualPassengers, offeredPassengerCapacity)`                | assignment در roster freeze    |
| DW-02 | زمان قابل‌واریز شدن   | فقط پس از `tour.completed` و تأیید ادمین                         | operator confirm بعد از freeze |
| DW-03 | مقصد اولیه سهم راننده | کیف پول عضو با credit اتمیک                                      | Finance manual payable         |
| DW-04 | سیاست راننده مهمان    | تا اتصال به `memberUserId` فقط «نیازمند اتصال حساب»؛ بدون credit | registration ID به‌تنهایی      |
| DW-05 | مدل برداشت            | reserve → approve/reject → paid با snapshot مقصد پرداخت          | در مدل فعلی وجود ندارد         |

**قانون جلوگیری از دوباره‌کاری:** تا قبل از تصویب DW-01 تا DW-05، فقط قرارداد، طراحی تست و discovery انجام می‌شود. پیاده‌سازی DP-5 قبلی نباید برای رسیدن به کیف پول به‌صورت وصله‌ای گسترش یابد.

### 0.3 مرزهای مالی غیرقابل‌مذاکره

- allocation و ثبت حضور، هیچ‌گاه خودشان wallet یا ledger را تغییر نمی‌دهند.
- فقط فرمان settlementِ تأییدشده، در یک transaction، credit اتمیک و idempotent ایجاد می‌کند.
- `driver-fuel:{tourId}:{memberUserId}:{settlementVersion}` یک کلید پیشنهادی است؛ unique constraint دیتابیس نیز الزامی است.
- credit کیف پول، برداشت راننده، و پرداخت بانکی سه رویداد جدا با audit جدا هستند.
- مبلغ، کارت کامل، داده حساب و شناسه‌های داخلی به UI حمل‌ونقل، Telegram، Excel یا لاگ عمومی نشت نمی‌کنند.
- اصلاح بعد از credit فقط با entry اصلاحی/برگشتی انجام می‌شود؛ row یا ledger قبلی edit/delete نمی‌شود.

### 0.4 Definition of Ready برای فاز یک

فاز یک فقط وقتی آغاز می‌شود که همه موارد زیر مشخص باشند:

- [ ] DW-01 تا DW-05 تأیید شده‌اند.
- [ ] منبع مبلغ «دونگ هر نفر» و امکان/عدم امکان تغییر آن پس از پایان تور تعیین شده است.
- [ ] نقش‌های مجاز برای پایان تور، تأیید settlement، رد/تأیید برداشت و ثبت پرداخت مشخص شده‌اند.
- [ ] سیاست راننده مهمان و روند اتصال او به حساب عضو مشخص شده است.
- [ ] نوع مقصد برداشت MVP (کارت، شبا یا هر دو)، حداقل/حداکثر و قانون تطبیق مالکیت مشخص شده است.
- [ ] مدل wallet عضو از booking wallet و از کارت دریافت وجه تور جدا و نام‌گذاری شده است.

**خروجی فاز صفر:** قرارداد نسخه‌دار، state machine نهایی، ماتریس نقش/مجوز و ماتریس تست. فقط پس از آن این فایل به سند رسمی محصول/معماری تبدیل می‌شود.

### 0.5 قابلیت‌های قابل استفاده و فاصله‌های قطعی

#### قابلیت‌هایی که باید reuse شوند

- `WalletAccount` از قبل به `tenantId + workspaceId + userId + currency` متصل و یکتا است؛ برای حساب IRR عضو مناسب است.
- `WalletTransaction` از قبل `creationIdempotencyKey` یکتای tenant-scoped، `referenceType/referenceId`، actor و مسیر reversal دارد.
- درگاه entitlement پرتال برای ماژول wallet وجود دارد؛ بنابراین نمایش «کیف پول من» باید با grant واقعی فعال شود، نه با route عمومی یا bypass.

#### فاصله‌هایی که نباید با workaround پوشانده شوند

- settlement و payable فعلی in-memory هستند؛ هیچ قابلیت مالی جدید نباید به آن store متکی باشد.
- routeهای DP-5 فعلی فقط `requireOperatorSession` دارند. برای مسیر جدید، «ثبت اجرای تور»، «تأیید credit»، «رسیدگی به برداشت» و «ثبت پرداخت بانکی» مجوزهای جدا می‌خواهند.
- ledger و account فعلی دلیل کافی برای فعال‌سازی withdrawal نیستند: reservation، payout request، encrypted destination، snapshot و admin review هنوز مدل مستقل ندارند.
- booking wallet نباید به‌عنوان member-driver wallet بازاستفاده شود؛ owner، reference و معنای اقتصادی آن متفاوت است.

### 0.6 ماتریس نقش پیشنهادی — نیازمند تأیید محصول

| عمل                                | نقش پیشنهادی                                   | حق مالی                    |
| ---------------------------------- | ---------------------------------------------- | -------------------------- |
| ثبت/اصلاح تعداد واقعی و وضعیت حضور | `tour_operator`                                | ندارد                      |
| ثبت پایان واقعی تور                | `tour_manager`                                 | ندارد                      |
| تأیید مبلغ سهم راننده              | `tour_manager`                                 | فقط تأیید، نه پرداخت بانکی |
| credit به کیف پول پس از تأیید      | `finance_operator` یا فرمان سرویس با مجوز صریح | ایجاد credit append-only   |
| تأیید/رد درخواست برداشت            | `finance_operator`                             | رزرو را نهایی/آزاد می‌کند  |
| ثبت پرداخت بانکی                   | `finance_operator` دوم یا نقش `finance_payer`  | تکمیل payout با مدرک       |
| مشاهده موجودی خود                  | راننده/عضو صاحب حساب                           | فقط خواندن حساب خودش       |

**پیشنهاد کنترل داخلی:** فردی که مبلغ settlement را تأیید می‌کند، نباید بتواند همان درخواست withdrawal را `paid` کند؛ اگر تیم کوچک است، این جداسازی حداقل به‌صورت audit و هشدار اعمال شود. تصمیم نهایی با محصول/عملیات است.

### 0.7 ماتریس تست اجباری برای طراحی بعدی

| دسته     | سناریوی حداقلی                            | نتیجه غیرقابل‌قبول               |
| -------- | ----------------------------------------- | -------------------------------- |
| ظرفیت    | ظرفیت ۲، واقعی ۱                          | credit برای ۲ نفر                |
| حضور     | راننده غایب/لغوشده                        | امکان تأیید مبلغ مثبت            |
| زمان     | قبل از پایان واقعی تور                    | نمایش یا اجرای credit            |
| اصلاح    | تغییر تعداد قبل از credit                 | باقی‌ماندن مبلغ preview قدیمی    |
| retry    | دوبار کلیک/timeout بعد از credit          | دو WalletTransaction             |
| هم‌زمانی | دو تأیید هم‌زمان settlement               | بیش از یک credit یا وضعیت متناقض |
| restart  | restart بین ثبت حضور و تأیید              | گم‌شدن execution facts/audit     |
| tenant   | تلاش workspace دیگر با settlementId معتبر | مشاهده یا تغییر داده             |
| مهمان    | راننده بدون `memberUserId`                | ایجاد حساب یا credit ناشناس      |
| برداشت   | مبلغ بیش از available balance             | reserve یا پرداخت منفی           |
| برداشت   | رد/لغو درخواست                            | آزاد نشدن reserve                |
| snapshot | تغییر کارت پس از درخواست                  | تغییر مقصد درخواست قبلی          |
| امنیت    | portal/UI/Telegram/Excel/log              | نمایش کارت کامل یا کلید داخلی    |

### 0.8 ترتیب PRها پس از تأیید تصمیم‌ها

1. **PR-A — قرارداد و persistence اجرای تور:** migrations، RLS، audit، version، API read/write؛ بدون wallet credit و بدون UI مالی.
2. **PR-B — اجرای تور در پنل:** تب موبایل‌محور، draft/attendance/completion و E2E؛ بدون جابه‌جایی پول.
3. **PR-C — settlement → member wallet:** identity binding، credit اتمیک، reversal و تست concurrency.
4. **PR-D — Wallet Ops ادمین:** جست‌وجوی انسانی عضو و تاریخچه خواندنی؛ UUID فقط ابزار پیشرفته.
5. **PR-E — payout destination و withdrawal:** encryption، reserve، queue مالی، snapshot، approval/payment evidence.

هیچ PR نباید چند مورد از این مرزها را با هم ترکیب کند؛ به‌خصوص PR-E فقط بعد از سبزشدن PR-C آغاز می‌شود.

### 0.9 مدل داده پیشنهادی برای قرارداد — هنوز migration نیست

`TourExecution` نباید در lifecycle انتشار تور ادغام شود. انتشار/لغو فروش و واقعیت اجرای روز سفر دو مفهوم متفاوت‌اند. مدل پیشنهادی:

```text
TourExecution
  tenantId, tourId (unique)
  status: scheduled | in_progress | completed | cancelled
  startedAt, completedAt, cancelledAt
  version
  createdByUserId, completedByUserId

DriverExecutionFact
  tenantId, executionId, driverRegistrationId (unique)
  memberUserId?                 // snapshot identity; null = credit blocked
  offeredPassengerCapacity      // snapshot، نه مقدار mutable registration
  actualPassengerCount          // از صفر شروع می‌شود
  attendanceStatus: not_arrived | present | departed | cancelled
  version
  lastEditedByUserId, lastEditedAt

DriverExecutionFactAudit
  tenantId, factId, sequence (unique)
  previousActualPassengerCount, nextActualPassengerCount
  reason?, actorUserId, createdAt

DriverSettlementV2
  tenantId, settlementId
  executionId, tourId, driverRegistrationId, memberUserId
  settlementVersion
  payableQuantity, unitAmountMinor, totalMinor, currency
  status: draft | attendance_recorded | confirmed | wallet_credited | voided | corrected
  walletTransactionId?
  idempotencyKey (unique per tenant)
  correctionOfSettlementId?

WalletWithdrawalRequest
  tenantId, accountId, destinationSnapshotId
  amountMinor, reservedMinor
  status: requested | approved | rejected | cancelled | paid
  requestedAt, decidedAt, paidAt
  idempotencyKey (unique per tenant)
```

#### قواعد persistence

- همه جدول‌ها `tenant_id` دارند، RLS و composite foreign keyهای tenant-scoped اجباری‌اند.
- `version` برای optimistic concurrency است؛ PATCH با version قدیمی باید `409` بدهد و داده جدید را برگرداند.
- audit append-only است؛ دلیل برای تغییر count اختیاری و برای تغییر capacity یا correction مالی اجباری است.
- settlement در `wallet_credited` immutable است. اصلاح فقط یک row جدید با `correctionOfSettlementId` و WalletTransaction reversal/adjustment ایجاد می‌کند.
- `WalletTransaction` فعلی برای credit/reversal reuse می‌شود؛ `WalletWithdrawalRequest` جایگزین transaction نیست و فقط reserve/approval/payment workflow را مالک است.
- رکوردهای in-memory DP-5 به data migration نیاز ندارند؛ در زمان cutover فقط settlementهای جدید وارد V2 می‌شوند. اگر داده production موقت وجود دارد، قبل از حذف مسیر قدیمی باید export و reconciliation مستقل انجام شود.

### 0.10 قرارداد HTTP پیشنهادی — برای طراحی تست، نه پیاده‌سازی

| روش   | مسیر                                                  | مسئول            | قاعده کلیدی                           |
| ----- | ----------------------------------------------------- | ---------------- | ------------------------------------- |
| GET   | `/tours/:tourId/execution`                            | tour operator    | فقط همان tenant                       |
| POST  | `/tours/:tourId/execution/start`                      | tour manager     | idempotent؛ فقط در زمان مجاز          |
| PATCH | `/tours/:tourId/execution/drivers/:registrationId`    | tour operator    | `If-Match`/version؛ بدون اثر مالی     |
| POST  | `/tours/:tourId/execution/complete`                   | tour manager     | close زمان اجرا، نه publish lifecycle |
| POST  | `/tours/:tourId/driver-settlements/:id/confirm`       | tour manager     | فقط execution completed               |
| POST  | `/tours/:tourId/driver-settlements/:id/credit-wallet` | finance operator | transaction اتمیک و idempotent        |
| POST  | `/me/wallet/withdrawals`                              | account owner    | reserve balance و snapshot مقصد       |
| POST  | `/finance/wallet-withdrawals/:id/approve`             | finance operator | تصمیم immutable audit شده             |
| POST  | `/finance/wallet-withdrawals/:id/pay`                 | finance payer    | مدرک پرداخت لازم؛ idempotent          |

نام نهایی routeها باید با قراردادهای HTTP موجود هماهنگ شود؛ اصل مهم جداسازی commandهای اجرایی از commandهای پولی است.

### 0.11 state machine نهایی و پاسخ‌های قابل‌فهم UI

#### اجرای تور

| از                           | به            | فرمان مجاز      | قاعده                                                                           |
| ---------------------------- | ------------- | --------------- | ------------------------------------------------------------------------------- |
| `scheduled`                  | `in_progress` | شروع اجرا       | فقط role اجرایی؛ قبل از زمان شروع فقط با دلیل ثبت‌شده                           |
| `in_progress`                | `completed`   | ثبت پایان واقعی | زمان پایان و actor اجباری؛ اگر پایان دستی زودتر از زمان برنامه است، دلیل اجباری |
| `scheduled` یا `in_progress` | `cancelled`   | لغو اجرای تور   | settlement مثبت جدید ممنوع؛ credit نشده‌ها void می‌شوند                         |
| `completed`                  | —             | —               | پایان اجرا immutable است؛ فقط settlement correction مجاز است                    |

#### تسویه راننده

| از                                            | به                    | پیش‌شرط                                                              |
| --------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| `draft`                                       | `attendance_recorded` | count و attendance معتبر ذخیره شده است؛ count صفر هم مقدار معتبر است |
| `attendance_recorded`                         | `confirmed`           | اجرای تور `completed` و راننده `departed` است                        |
| `confirmed`                                   | `wallet_credited`     | `memberUserId` فعال، حساب IRR، role مالی، transaction idempotent     |
| `draft` / `attendance_recorded` / `confirmed` | `voided`              | راننده/تور لغو شده یا مبلغ صفر با تصمیم صریح                         |
| `wallet_credited`                             | `corrected`           | فقط با reversal/adjustment و settlement جایگزین                      |

**قاعده صفر:** `actualPassengerCount = 0` به‌خودی‌خود خطا نیست؛ فقط credit مثبت را ناممکن می‌کند. UI باید آن را «۰ مسافر ثبت شده» نشان دهد، نه «داده ناقص».

#### پاسخ‌های استانداردی که UI باید نشان دهد

| کد پیشنهادی                         | HTTP    | متن قابل‌فهم                                                                   |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `EXECUTION_NOT_STARTED`             | 409     | «ثبت تعداد مسافر از زمان شروع تور فعال می‌شود.»                                |
| `EXECUTION_NOT_COMPLETED`           | 409     | «ابتدا پایان واقعی تور را ثبت کنید.»                                           |
| `DRIVER_MEMBER_REQUIRED`            | 422     | «این راننده به حساب عضو متصل نیست؛ واریز کیف پول ممکن نیست.»                   |
| `ATTENDANCE_CAPACITY_EXCEEDED`      | 422     | «تعداد واقعی از ظرفیت اعلام‌شده بیشتر است؛ ابتدا ظرفیت را با دلیل اصلاح کنید.» |
| `STALE_EXECUTION_VERSION`           | 409     | «اطلاعات توسط شخص دیگری تغییر کرده است؛ صفحه را تازه کنید.»                    |
| `SETTLEMENT_ALREADY_CREDITED`       | 200/409 | replay امن با نمایش شناسه و زمان credit قبلی، نه credit جدید                   |
| `INSUFFICIENT_WITHDRAWABLE_BALANCE` | 422     | «موجودی قابل برداشت برای این مبلغ کافی نیست.»                                  |
| `WITHDRAWAL_ALREADY_FINALIZED`      | 409     | «این درخواست قبلاً نهایی شده و قابل تغییر نیست.»                               |

### 0.12 cutover، rollback و مشاهده‌پذیری

#### cutover ایمن

1. migrationهای add-only و RLS منتشر شوند، ولی capability برای همه workspaceها خاموش بماند.
2. فقط برای یک workspace آزمایشی و فقط تورهای جدید، `TourExecution V2` فعال شود؛ مسیر DP-5 قدیمی هم‌زمان برای همان تور قابل استفاده نباشد.
3. قبل از credit واقعی، execution و settlement preview با شمارش عملیاتی و مبلغ مورد انتظار reconcile شود.
4. فعال‌سازی credit wallet فقط پس از عبور تست‌های concurrency، restart و tenant isolation انجام شود.
5. withdrawal آخرین قابلیت است؛ نبود آن نباید credit یا settlement را متوقف کند، اما موجودی باید به‌وضوح «قابل برداشت پس از فعال‌شدن سرویس» نمایش داده شود.

#### rollback

- rollback کد نباید migration یا transactionهای ثبت‌شده را حذف کند.
- اگر بعد از credit خطا دیده شد، feature flag خاموش می‌شود، داده‌ها read-only باقی می‌مانند و اصلاح فقط با reversal ثبت می‌شود.
- هیچ fallbackی به پرداخت دوباره دستی یا mutate کردن WalletTransaction قبلی مجاز نیست.
- پیش از حذف DP-5 قدیمی، report تطبیق settlement، wallet transaction و withdrawal باید برای هر tenant صفر اختلاف نشان دهد.

#### لاگ، audit و رخدادها

- هر command مالی باید `requestId`، `tenantId`، `actorUserId`، `settlementId/withdrawalId` و نتیجه idempotency را در audit ساخت‌یافته ثبت کند.
- لاگ‌ها فقط amount، currency، شناسه‌های داخلی و چهار رقم آخر مقصد ماسک‌شده را دارند؛ شماره کارت کامل، payload رمزگذاری‌شده و secret هرگز log نمی‌شوند.
- شاخص‌های هشدار: replay credit، conflict نسخه، credit blocked به‌دلیل guest، withdrawal reserve failure، payment بدون evidence و اختلاف reconciliation.
- اعلان Telegram یا پیامک فقط بعد از ثبت موفق domain event ارسال می‌شود و نباید مبلغ حساس یا شماره کارت را حمل کند. شکست اعلان نباید settlement یا پرداخت را rollback کند.

#### شواهد لازم برای پذیرش هر PR

| PR   | شواهد حداقلی                                                                               |
| ---- | ------------------------------------------------------------------------------------------ |
| PR-A | migration/RLS integration test، restart persistence، tenant-isolation test                 |
| PR-B | mobile browser E2E برای ثبت count، conflict و completion                                   |
| PR-C | transaction/retry/concurrency test، ledger/wallet reconciliation، reversal test            |
| PR-D | authorization test، جست‌وجوی انسانی، عدم افشای UUID یا داده حساس                           |
| PR-E | encryption-at-rest test، reserve race، snapshot destination، approval/payment evidence E2E |

## 1. هدف

ساخت یک جریان ساده و قابل‌ردیابی برای این مسیر:

```text
اعلام ظرفیت راننده
→ ثبت تعداد مسافر واقعی در محل تجمع
→ امکان اصلاح تا پایان تور
→ تأیید پایان تور
→ محاسبه و تأیید سهم راننده
→ واریز به کیف پول
→ درخواست برداشت توسط راننده
→ پرداخت بانکی توسط ادمین مالی
```

## 2. تصمیم‌های محصولی که تا اینجا گرفته‌ایم

### 2.1 ظرفیت و مبلغ راننده

- راننده هنگام ثبت‌نام اعلام می‌کند چند **مسافر** می‌تواند با خود ببرد.
- عدد اعلامی فقط سقف است و به‌تنهایی مبنای پرداخت نیست.
- متن UI باید بدون ابهام باشد: «چند مسافر می‌توانید با خود ببرید؟ راننده حساب نمی‌شود.»
- مبلغ براساس تعداد مسافر واقعی ثبت‌شده محاسبه می‌شود:

```text
تعداد قابل پرداخت = کمینه(تعداد مسافر واقعی، ظرفیت اعلامی)
مبلغ نهایی = تعداد قابل پرداخت × دونگ هر نفر
```

مثال:

```text
ظرفیت اعلامی: ۲ مسافر
مسافر واقعی: ۱ نفر
مبلغ قابل پرداخت: یک دونگ
```

- ظرفیت اولیه نباید به‌صورت خودکار تعداد واقعی در نظر گرفته شود؛ مقدار واقعی از صفر شروع می‌شود.
- در MVP لازم نیست نام تک‌تک مسافران به راننده متصل شود؛ ادمین تعداد واقعی را ثبت می‌کند.
- در نسخه آینده می‌توان تخصیص شخص‌به‌شخص مسافر و راننده را اضافه کرد.
- ثبت‌نام چندنفره باید `participantCount` واقعی داشته باشد؛ یک registration هرگز معادل یک مسافر برای کنترل مجموع نیست.

### 2.2 زمان ثبت تعداد واقعی

- روز اجرای تور و در محل تجمع، ادمین تعداد مسافران هر راننده را ثبت می‌کند.
- این ثبت اولیه مالی نیست و فقط واقعیت عملیاتی را ذخیره می‌کند.
- مقدار ثبت‌شده در طول تور و بعد از تور، تا قبل از تسویه نهایی، قابل اصلاح است.
- هر تغییر باید شامل مقدار قبلی، مقدار جدید، زمان، کاربر تغییر‌دهنده و دلیل اختیاری باشد.

### 2.3 زمان واریز

- ثبت تعداد مسافر نباید همان لحظه باعث واریز شود.
- واریز فقط بعد از ثبت پایان واقعی تور و تأیید نهایی ادمین انجام می‌شود.
- بعد از واریز، تسویه قفل می‌شود.
- اصلاح بعد از واریز باید با برگشت/اصلاح مالی انجام شود؛ تراکنش قبلی نباید ویرایش یا حذف شود.

## 3. تب جدید «اجرای تور»

### 3.1 جایگاه

در مدیریت هر تور یک تب مستقل با نام «اجرای تور» اضافه شود. این تب مسئول اجرای روز تور و تسویه بعد از تور است. هماهنگی‌های قبل از سفر در تب حمل‌ونقل/لیست عملیاتی باقی می‌ماند.

### 3.2 وضعیت قبل از تور

- تب قابل مشاهده ولی غیرفعال یا فقط خواندنی باشد.
- متن: «از روز حرکت فعال می‌شود.»
- هیچ عملیات مالی در دسترس نباشد.

### 3.3 وضعیت روز تور

- از زمان شروع تور فعال شود.
- اگر ادمین بدون پارامتر تب وارد مدیریت تور شد و اقدام باز وجود داشت، «اجرای تور» می‌تواند تب پیش‌فرض باشد.
- سیستم نباید ادمینی را که در تب دیگری کار می‌کند ناگهانی جابه‌جا کند.
- کارت هر راننده شامل این موارد باشد:

```text
نام و تصویر راننده
ظرفیت اعلامی
تعداد مسافر واقعی با کنترل منفی/مثبت
وضعیت: نرسیده / حاضر / حرکت کرده / لغوشده
مبلغ تخمینی
آخرین زمان ذخیره
```

- ذخیره تعداد و واریز پول دو اقدام کاملاً جدا باشند.

### 3.4 وضعیت بعد از تور

- دکمه «ثبت پایان تور» نمایش داده شود.
- اگر زمان پایان تور موجود است، پس از آن دکمه فعال شود.
- اگر زمان پایان موجود نیست، بعد از زمان شروع امکان ثبت دستی پایان وجود داشته باشد.
- پس از ثبت پایان، تعدادها همچنان تا قبل از تسویه قابل اصلاح باشند.
- برای هر راننده مبلغ نهایی و دکمه «تأیید و واریز به کیف پول» نمایش داده شود.

### 3.5 بعد از تسویه

- تب حذف نشود و سابقه را به‌صورت خواندنی نمایش دهد.
- وضعیت‌های اصلی:

```text
نیازمند ثبت تعداد
نیازمند تأیید
آماده واریز
واریزشده به کیف پول
اصلاح‌شده
لغوشده
```

## 4. قواعد اعتبارسنجی

- تعداد واقعی عدد صحیح و نامنفی باشد.
- تعداد واقعی از ظرفیت اعلامی بیشتر نباشد.
- اگر ظرفیت اشتباه بوده، ابتدا با ثبت دلیل ظرفیت اصلاح شود.
- مجموع مسافران ثبت‌شده برای راننده‌ها از تعداد شرکت‌کنندگان حاضر بیشتر نباشد.
- ظرفیتِ snapshot‌شده در `DriverExecutionFact` پس از شروع اجرا مستقیم edit نمی‌شود؛ اصلاح آن یک رخداد audit مستقل با مقدار قدیم، مقدار جدید، دلیل و actor است.
- راننده غایب یا راننده‌ای که حرکت نکرده، تعداد قابل پرداخت صفر داشته باشد.
- تور لغوشده قابل تسویه نباشد.
- یک تسویه با یک کلید یکتای مالی فقط یک بار به کیف پول واریز شود.
- خطای شبکه یا تکرار درخواست نباید واریز دوباره ایجاد کند.

## 5. کیف پول راننده

### 5.1 ایجاد حساب

- ماژول کیف پول روی سرور فعال است، اما ممکن است عضو حساب کیف پول نداشته باشد.
- هنگام اولین بستانکاری، حساب فعال IRR به‌صورت تراکنشی و خودکار ساخته شود.
- راننده باید به یک `memberUserId` پایدار متصل باشد؛ `driverRegistrationId` به‌تنهایی برای کیف پول کافی نیست.
- راننده مهمان تا زمان اتصال به حساب عضو قابل واریز نباشد و UI باید دلیل را واضح نمایش دهد.

### 5.2 واریز از مدیریت تور

ادمین نباید برای واریز سهم راننده وارد صفحه کیف پول شود یا UUID را کپی کند. دکمه روی کارت راننده باید مسیر کامل را انجام دهد:

```text
یافتن userId عضو
→ ساخت/یافتن حساب کیف پول
→ ثبت تراکنش بستانکاری یکتا
→ ثبت مرجع تور و تسویه
→ تغییر وضعیت تسویه به واریزشده
```

این فرمان باید با transaction دیتابیس واحد اجرا شود: ساخت/یافتن حساب، درج `WalletTransaction`، درج ledger entryهای متوازن، ثبت audit و تغییر وضعیت settlement همگی commit می‌شوند یا هیچ‌کدام commit نمی‌شوند. درج مستقیم در جدول wallet بدون سرویس/قواعد ledger ممنوع است.

مرجع پیشنهادی:

```text
referenceType = driver_fuel_share
referenceId = settlementId
idempotencyKey = driver-fuel:{tourId}:{driverUserId}:{settlementVersion}
```

## 6. اصلاح صفحه کیف پول ادمین

### مشکل فعلی

صفحه کیف پول فقط UUID عضو را می‌خواهد. UUID شناسه داخلی است و برای ادمین قابل فهم یا قابل کشف نیست؛ این یک باگ UX با شدت بالا و یک مانع عملیاتی است.

### رفتار مورد انتظار

- جستجو با نام، شماره موبایل یا کد عضویت انجام شود.
- نتیجه شامل نام، موبایل ماسک‌شده، کد عضویت، وضعیت حساب و موجودی باشد.
- UUID فقط در پشت صحنه یا بخش پیشرفته قابل استفاده باشد.
- انتخاب نتیجه، حساب کیف پول را باز کند.
- عملیات دستی کیف پول برای پشتیبانی و اصلاح باقی بماند، نه مسیر اصلی تسویه راننده.

## 7. برداشت از کیف پول

### 7.1 تجربه کاربر

در پرتال عضو یک بخش «کیف پول من» وجود داشته باشد:

```text
موجودی کل
موجودی قابل برداشت
مبلغ رزروشده
[درخواست برداشت]
```

در اولین درخواست:

- مبلغ برداشت وارد شود.
- شماره کارت دریافت شود.
- گزینه «ذخیره برای دفعات بعد» ارائه شود.

در دفعات بعد کارت‌های ذخیره‌شده به‌صورت پیشنهاد ماسک‌شده نمایش داده شوند:

```text
ملت •••• ۶۲۱۳
سامان •••• ۱۸۴۲
+ افزودن کارت جدید
```

### 7.2 محل نگهداری روش تسویه

- اقدام اصلی برداشت داخل «کیف پول من» باشد.
- مدیریت کارت‌های ذخیره‌شده داخل «پروفایل ← اطلاعات تسویه» باشد.
- شماره کامل کارت فقط هنگام ورود/ویرایش برای خود کاربر قابل مشاهده باشد.
- اطلاعات حساس در ذخیره‌سازی رمزگذاری و در پاسخ‌ها ماسک شود.

### 7.3 وضعیت درخواست برداشت

```text
requested → approved → paid
    ├─────→ rejected
    └─────→ cancelled
```

- هنگام درخواست، مبلغ رزرو شود تا دوباره خرج یا برداشت نشود.
- در رد یا لغو، رزرو آزاد شود.
- در پرداخت موفق، بدهی کیف پول قطعی تسویه شود.
- درخواست باید snapshot کارت ماسک‌شده را نگه دارد تا تغییر کارت پیش‌فرض، درخواست قبلی را عوض نکند.

**تعریف موجودی:**

```text
availableToWithdraw = postedCredits − postedDebits − activeWithdrawalReservations
```

- reservation یک hold است، نه debit قطعی و نه کاهش قابل‌برگشتِ دستی.
- هر درخواست withdrawal تنها یک reservation فعال دارد.
- `paid` دقیقاً یک debit/ledger effect متناظر ایجاد می‌کند؛ retry پرداخت همان نتیجه قبلی را برمی‌گرداند.
- `rejected` و `cancelled` فقط hold همان درخواست را آزاد می‌کنند؛ credit اصلی را تغییر نمی‌دهند.

### 7.4 پنل مالی ادمین

- صفحه مستقل «مالی ← درخواست‌های برداشت» ایجاد شود.
- ادمین مبلغ، عضو، کارت ماسک‌شده، زمان درخواست و وضعیت را ببیند.
- شماره کارت و عملیات برداشت در تب مدیریت تور نمایش داده نشود.
- مدیریت تور فقط وضعیت خلاصه را نشان دهد: کیف پول ندارد، آماده واریز، واریزشده، درخواست برداشت، برداشت پرداخت‌شده.

## 8. مدل وضعیت پیشنهادی

### اجرای تور

```text
scheduled → in_progress → completed
                    └──→ cancelled
```

### تسویه راننده

```text
draft → attendance_recorded → confirmed → wallet_credited
  └──────────────────────────────────────→ voided
wallet_credited → corrected (با تراکنش برگشت و تسویه جایگزین)
```

## 9. مشکلات فعلی که باید رفع شوند

- تسویه راننده فعلی به تراکنش کیف پول متصل نیست.
- پایان واقعی تور قبل از تسویه کنترل نمی‌شود.
- تعداد تخصیص‌ها شمرده می‌شود، نه تعداد واقعی افراد.
- ثبت‌نام چندنفره ممکن است فقط یک تخصیص حساب شود.
- UI فعلی عملاً اولین راننده و تعداد محدودی مسافر را در نظر می‌گیرد.
- اطلاعات تخصیص، تسویه و payable فعلی حافظه‌ای و غیردائمی است.
- تسویه با registration ID ساخته می‌شود ولی کیف پول متعلق به user ID است.
- ساخت خودکار حساب کیف پول عضو مشخص و کامل نیست.
- مدل کارت بانکی و درخواست برداشت هنوز وجود ندارد.
- جستجوی کیف پول ادمین فقط با UUID انجام می‌شود.

## 10. مسیر اجرایی پیشنهادی

### فاز صفر — تثبیت قرارداد محصول

- تعریف دقیق «ظرفیت مسافر» و حذف ابهام occupants.
- تعریف شروع و پایان عملیاتی تور.
- تعیین مبلغ دونگ هر نفر و منبع آن.
- تعیین مجوز نقش‌هایی که پایان تور و تسویه را تأیید می‌کنند.
- تعیین سیاست راننده مهمان و تبدیل او به عضو.

خروجی: سند قرارداد و معیارهای پذیرش؛ بدون UI و بدون تغییر مالی.

### فاز یک — داده پایدار و حسابرسی

- ساخت `TourExecution`، `DriverExecutionFact`، audit و `DriverSettlementV2` در دیتابیس.
- allocation پیش‌سفر، اگر باقی بماند، فقط دادهٔ برنامه‌ریزی حمل‌ونقل است و نباید جای `actualPassengerCount` یا مبنای credit را بگیرد.
- افزودن RLS/tenant isolation.
- افزودن audit log و optimistic concurrency/version.
- تعریف اتصال راننده از registration به member user.

خروجی: API پایدار و قابل بازیابی بعد از restart.

### فاز دو — تب «اجرای تور»

- افزودن تب جدید و lifecycle زمانی.
- کارت راننده و ثبت تعداد واقعی موبایل‌محور.
- ذخیره draft، نمایش آخرین ذخیره و امکان اصلاح.
- ثبت پایان تور و محاسبه مبلغ نهایی.
- هنوز واریز واقعی انجام نشود؛ فقط preview و تأیید داده.

خروجی: جریان عملیاتی کامل بدون ریسک جابه‌جایی پول.

### فاز سه — اتصال تسویه به کیف پول

- ساخت خودکار حساب در اولین بستانکاری.
- تراکنش بستانکاری idempotent و اتمیک.
- قفل تسویه بعد از موفقیت واریز.
- مسیر correction/reversal.
- حذف نیاز به UUID در تسویه راننده.

خروجی: واریز واقعی و قابل حسابرسی به کیف پول.

### فاز چهار — اصلاح Wallet Ops ادمین

- جستجو با نام، موبایل و کد عضویت.
- نمایش نتایج قابل انتخاب و اطلاعات ماسک‌شده.
- نگه‌داشتن UUID فقط برای ابزار پیشرفته.

خروجی: عملیات پشتیبانی کیف پول برای ادمین قابل استفاده می‌شود.

### فاز پنج — کارت و درخواست برداشت

- مدل payout destination رمزگذاری‌شده.
- مدیریت کارت‌ها در پروفایل عضو.
- درخواست برداشت و رزرو موجودی.
- صف بررسی و پرداخت در پنل مالی.
- ثبت مدرک پرداخت، رد، لغو و آزادسازی رزرو.

خروجی: چرخه کامل کیف پول تا پرداخت بانکی.

## 11. ترتیب پیشنهادی تحویل

```text
1. قرارداد و وضعیت‌ها
2. persistence و audit
3. تب اجرای تور و ثبت تعداد واقعی
4. پایان تور و تأیید تسویه
5. واریز کیف پول
6. جستجوی انسانی Wallet Ops
7. کارت ذخیره‌شده و برداشت
8. اصلاح، برگشت و گزارش مالی
```

برداشت بانکی نباید قبل از پایدارشدن ledger کیف پول و رزرو موجودی پیاده‌سازی شود.

## 12. معیار پذیرش نهایی

- ادمین در محل تجمع بتواند روی موبایل تعداد مسافر هر راننده را ثبت کند.
- مقدار تا پیش از واریز قابل اصلاح باشد و تاریخچه تغییرات باقی بماند.
- قبل از پایان تور امکان واریز وجود نداشته باشد.
- ظرفیت اعلامی فقط سقف باشد، نه تعداد واقعی پیش‌فرض.
- یک تسویه با retry دوباره واریز نشود.
- restart سرور هیچ داده تسویه‌ای را از بین نبرد.
- ادمین برای یافتن عضو به UUID نیاز نداشته باشد.
- راننده پس از واریز، موجودی را در پرتال خود ببیند.
- راننده بتواند کارت ذخیره کند و درخواست برداشت بدهد.
- موجودی رزروشده دوباره قابل برداشت یا مصرف نباشد.
- ثبت‌نام چندنفره در کنترل مجموع مسافران به تعداد نفرات محاسبه شود، نه تعداد registrationها.
- conflict هم‌زمان در ثبت count یا credit با پیام قابل‌فهم به ادمین نمایش داده شود و داده یا پول دوبار ثبت نشود.
- قطع سرویس پس از ثبت درخواست و قبل از پاسخ، با retry idempotent به همان نتیجه برسد.
- پرداخت withdrawal فقط با مدرک پرداخت و بدون نمایش شماره کامل کارت قابل نهایی‌شدن باشد.
- اطلاعات کامل کارت در مدیریت تور یا Wallet Ops عمومی افشا نشود.
- تمام واریزها، اصلاح‌ها، برداشت‌ها و تغییر وضعیت‌ها audit trail داشته باشند.

## 13. decision log پیش از پیاده‌سازی

هیچ موردی در این جدول با حدس توسعه‌دهنده یا تنظیم مخفی فعال نمی‌شود. «پیش‌فرض امن» فقط رفتار سیستم تا زمان تصمیم است، نه تصمیم محصول.

| شناسه | تصمیم                     | گزینه‌ها و اثر                                  | پیشنهاد برای MVP                                                                  | پیش‌فرض امن تا تأیید                        | مالک تصمیم          |
| ----- | ------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- | ------------------- |
| DW-01 | مبنای مبلغ راننده         | assignment freeze در برابر تعداد واقعی          | تعداد واقعیِ ثبت‌شده، با سقف ظرفیت                                                | credit غیرفعال                              | محصول/عملیات        |
| DW-02 | زمان credit               | قبل/بعد از پایان واقعی تور                      | فقط پس از completion و تأیید settlement                                           | credit غیرفعال                              | محصول/مالی          |
| DW-03 | مقصد سهم راننده           | پرداخت دستی یا member wallet                    | member wallet سپس withdrawal                                                      | مسیر دستی DP-5 قدیمی فقط برای تورهای legacy | محصول/مالی          |
| DW-04 | راننده مهمان              | credit به registration یا فقط عضو               | فقط عضو با `memberUserId` پایدار                                                  | blocked با پیام واضح                        | محصول/عضویت         |
| DW-05 | چرخه برداشت               | کارت، شبا یا هر دو؛ reserve و approval          | کارت رمزگذاری‌شده + reserve + approval                                            | withdrawal غیرفعال، wallet read-only        | محصول/مالی/حقوقی    |
| DW-06 | تفکیک نقش‌ها              | یک operator یا نقش‌های جدا                      | execution و finance جدا؛ ثبت پرداخت بانکی مستقل                                   | فقط read-only برای فرمان مالی جدید          | مالک workspace      |
| DW-07 | نرخ و منبع دونگ           | ثابت در تور، editable پس از تور، یا بودجه مسافر | snapshot نرخ در زمان confirm؛ تغییر بعدی correction                               | preview بدون credit                         | محصول/مالی          |
| DW-08 | کنترل مجموع واقعی         | تعداد ثبت‌نام، افراد تأییدشده یا headcount حاضر | headcount حاضرِ مستقل از allocation؛ ثبت‌نام چندنفره باید تعداد واقعی نفر را بدهد | اگر denominator معتبر نیست، confirm مسدود   | عملیات/محصول        |
| DW-09 | تطبیق مالک مقصد برداشت    | آزاد، شماره کارت با کد ملی، یا بررسی دستی       | MVP بررسی دستی و audit؛ اتوماسیون فقط پس از منبع معتبر                            | payment نهایی نیازمند تأیید مالی            | مالی/حقوقی          |
| DW-10 | حداقل/حداکثر برداشت و SLA | سقف روزانه/ماهانه و زمان پرداخت                 | تنظیم tenant-scoped با مقدار اولیه صریح                                           | request خارج از policy رد می‌شود            | مالی/مالک workspace |

### پاسخ‌هایی که قبل از فاز یک لازم‌اند

برای آغاز PR-A فقط DW-01، DW-02، DW-04، DW-06، DW-07 و DW-08 لازم‌اند. DW-03 برای PR-C و DW-05/DW-09/DW-10 برای PR-E لازم می‌شوند؛ بنابراین نبود تصمیم برداشت نباید ساخت اجرای تور و ثبت حضور را متوقف کند.

---

## 14. ثبت وضعیت پیشرفت این سند

| بخش                               | وضعیت              | توضیح                                                       |
| --------------------------------- | ------------------ | ----------------------------------------------------------- |
| تحلیل وضعیت فعلی و تضاد با DP-5   | کامل               | مسیر in-memory/manual در برابر مسیر پایدار/wallet مستند شد. |
| قرارداد data/state/API پیشنهادی   | کاملِ پیشنهادی     | تا تأیید DWها، authority اجرا نیست.                         |
| نقش‌ها، امنیت، cutover و rollback | کاملِ پیشنهادی     | نقش‌های واقعی باید در policy مجوزها نگاشت شوند.             |
| طراحی تست و معیار پذیرش           | کامل برای planning | تست‌ها هنگام هر PR به spec و E2E واقعی تبدیل می‌شوند.       |
| migration و implementation        | شروع نشده          | منتظر تصمیم‌های لازم و PR مستقل.                            |
| واریز یا برداشت واقعی             | شروع نشده          | عمداً تا گذر از PRهای پایه ممنوع است.                       |

---

این فایل موقت است. پس از تأیید decision log، باید به سند رسمی محصول/معماری تبدیل و سپس پیاده‌سازی مرحله‌ای آغاز شود.
