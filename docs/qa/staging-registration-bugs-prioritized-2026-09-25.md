# فهرست اولویت‌بندی‌شدهٔ باگ‌های ثبت‌نام استیجینگ

تاریخ: ۲۰۲۶-۰۹-۲۵
منبع: [گزارش ماتریسی ثبت‌نام استیجینگ](./staging-registration-matrix-2026-09-24.md)

برنامهٔ اجرایی جزئیات فاز ۰: [staging-registration-phase-0-plan-2026-09-25.md](./staging-registration-phase-0-plan-2026-09-25.md)

این اولویت‌بندی برای برنامه‌ریزی اصلاحات تهیه شده و جایگزین وضعیت authoritative گزارش اصلی نیست.

**نکتهٔ مهم:** اولویت‌های P0 تا P3 فعلاً اولویت تریاژ هستند، نه شدت قطعی. اگر در فاز تشخیص معلوم شود رخداد از تنظیم، دادهٔ stale، cache یا fixture است، شناسه باید از فهرست باگ کد خارج یا downgrade شود.

## قاعدهٔ اجباری قبل از شروع هر باگ

هیچ باگی صرفاً بر اساس مشاهدهٔ UI وارد مرحلهٔ اصلاح نمی‌شود. برای هر شناسه، ابتدا یک پروندهٔ تشخیص تکمیل شود:

1. **تأیید واقعی مشکل:** سناریو با دادهٔ مشخص، کاربر مشخص، URL/مسیر مشخص و همان محیط دوباره اجرا شود؛ تفاوت بین رفتار مورد انتظار و واقعی ثبت شود.
2. **بررسی تنظیمات و feature flagها:** تنظیمات تور، Exposure، tenant، policy پرداخت، cache، session و rollout بررسی شوند. اگر رخداد ناشی از تنظیم باشد، به‌عنوان باگ کد ثبت نشود.
3. **بررسی قرارداد و منبع داده:** مشخص شود مقدار صحیح از کدام API، projection، snapshot یا تنظیم باید بیاید و آیا اختلاف ناشی از stale data یا زمان ایجاد ثبت‌نام است.
4. **یافتن مالک واقعی:** مسیر کامل source از تنظیم/داده تا API، egress، renderer و DOM مشخص شود؛ اولین محل ایجاد اختلاف مالک باگ است.
5. **جست‌وجوی پیاده‌سازی موجود:** قبل از افزودن کد، component، helper، formatter، policy، guard، تست و migration موجود پیدا و قابل‌استفاده‌بودن آن بررسی شود. کد تکراری ممنوع است.
6. **انتخاب کم‌پیچیدگی‌ترین اصلاح:** ابتدا اصلاح قرارداد یا binding موجود، سپس اصلاح projection/renderer؛ abstraction جدید، state موازی، cache جدید یا مسیر موازی فقط با دلیل مستند مجاز است.
7. **معیار خروج:** تست focused، تست regression، `git diff --check` و در صورت UI شواهد runtime روی همان artifact/commit ثبت شود.

هر ردیف تا تکمیل این پرونده در وضعیت **تشخیص‌نشده** می‌ماند و مجاز به شروع implementation نیست.

## خلاصهٔ اولویت‌ها

| اولویت | تعداد | تعریف |
| --- | ---: | --- |
| P0 | ۴ | خطر تأیید/ثبت‌نام اشتباه، ظرفیت بیش‌ازحد یا ناسازگاری جدی مالی |
| P1 | ۱۲ | اختلال مستقیم در مسیر ثبت‌نام، پرداخت، waitlist یا نمایش وضعیت نهایی |
| P2 | ۱۰ | ناسازگاری مهم UI، زمان، ترجمه یا خروجی گزارش |
| P3 | ۳ | نقص قراردادی/آزمون یا بهبود کم‌خطرتر |

تعدادهای بالا تعداد رکوردهای تریاژ هستند، نه تعداد root causeهای مستقل؛ گروه‌بندی ریشه‌ای زیر برای جلوگیری از چند بار اصلاح یک مشکل ملاک است.

## گروه‌بندی ریشه‌ای و aliasها

| گروه ریشه‌ای | رکوردهای وابسته | قاعدهٔ جلوگیری از دوباره‌کاری |
| --- | --- | --- |
| قرارداد PDP برای شروع و policy پرداخت | `BUG-STG-008/013`، `BUG-STG-EXPOSURE-PDP-START-PAYMENT-CURRENT-2026-09-25`، `BUG-STG-025` | یک تشخیص و یک قرارداد egress/renderer؛ `BUG-STG-025` alias حالت رایگان است، نه fix مستقل |
| state و CTA مربوط به waitlist | `BUG-STG-062/047`، `BUG-STG-064/065`، `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL-FRESH-2026-09-25-1220` | یک state mapping و renderer مشترک؛ فقط تفاوت مالکیت در همان پرونده ثبت شود |
| هم‌ترازی projection مالی | `BUG-STG-080`، `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH-CURRENT-2026-09-25`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE-FRESH-2026-09-25-1150`، `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE-FRESH-2026-09-25-1205` | ابتدا state contract و منبع projection مشخص شود؛ برای هر صفحه patch جدا ساخته نشود |
| receipt و status presentation | `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS-CURRENT-2026-09-25`، `BUG-STG-RECEIPT-STATUS-LABEL-MIXED-FRESH-2026-09-25-1135`، `BUG-STG-040` | receipt status و registration status جدا اما از یک response معتبر مصرف شوند |
| ترجمه و locale registry | `BUG-STG-ADMIN-WAITLIST`، `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`، `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE-CURRENT-2026-09-25-1132` | یک registry/fallback locale؛ هر صفحه locale مستقل نسازد |
| parity قیمت و حمل | `BUG-STG-081`، `BUG-STG-082`، `BUG-STG-REGISTRATION-TRANSPORT-COST-LABEL-CURRENT-2026-09-25` | منبع canonical قیمت و enum حمل تعیین شود؛ label یا preview موازی اضافه نشود |

`BUG-STG-013` و `BUG-STG-EXPOSURE-PDP-START-PAYMENT-CURRENT-2026-09-25` در فهرست اولویت برای traceability جدا مانده‌اند، اما implementation آن‌ها باید یک تسک مشترک باشد.

## P0 — بحرانی

1. **BUG-STG-080** — ثبت‌نام رایگان در Portal جزئیات پرداخت/رسید نشان می‌دهد، اما Admin آن را بدون پرداخت می‌داند. باید قرارداد واحد `zero-obligation` و projection مشترک تعریف شود.
2. **BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH-CURRENT-2026-09-25** — ثبت‌نام رایگانِ pending، متن فعال‌شدن پرداخت و بارگذاری رسید نشان می‌دهد. شرط payment policy در pending و projection باید اصلاح شود.
3. **BUG-STG-063** — promotion صف بدون guard برای `partySize` می‌تواند گروهی بزرگ‌تر از ظرفیت آزاد را تأیید کند. guard سمت سرور و تست چندنفره لازم است.
4. **BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE-FRESH-2026-09-25-1205** — Finance و Portal مانده صفر دارند، اما Admin هنوز پرداخت جزئی و deadline نشان می‌دهد؛ خطر تصمیم عملیاتی و مالی اشتباه.

## P1 — بالا

1. **BUG-STG-008/013** — PDP و فرم روش پرداخت و نوع تأیید ثبت‌نام را منتقل نمی‌کنند؛ policyهای رایگان، پرداخت دستی و خودکار از دید کاربر مبهم‌اند.
2. **BUG-STG-EXPOSURE-PDP-START-PAYMENT-CURRENT-2026-09-25** — شروع برنامه و وضعیت پرداخت در Exposure فعال‌اند، اما در PDP حاضر نیستند.
3. **BUG-STG-062/047** — PLP ظرفیت‌پر را waitlist می‌کند، ولی PDP و فرم مهمان اقدام صریح waitlist ندارند.
4. **BUG-STG-064/065** — banner ادمین و صفحهٔ موفقیت کاربر انتقال واقعی به waitlist را اعلام نمی‌کنند.
5. **BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC** — state ظرفیت/صف انتظار در snapshotهای list و detail برای ظرفیت یکسان متفاوت است.
6. **BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE-FRESH-2026-09-25-1150** — detail پرداخت‌شده است، اما list هنوز «پرداخت باید تکمیل شود» نمایش می‌دهد.
7. **BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS-CURRENT-2026-09-25** — بعد از ارسال مجدد receipt، heading صفحه همچنان «اصلاح فیش لازم است» می‌ماند.
8. **BUG-STG-RECEIPT-STATUS-LABEL-MIXED-FRESH-2026-09-25-1135** — receipt ردشده است، اما badge کلی ثبت‌نام «تأیید شده» دیده می‌شود.
9. **BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL-FRESH-2026-09-25-1220** — ردیف‌های waitlist در ستون حضور «تأییدشده» نمایش داده می‌شوند.
10. **BUG-STG-022** — محاسبهٔ حمل و دُنگ در فرم چندنفره فقط participant اول و `partySize=1` را لحاظ می‌کند.
11. **BUG-STG-021** — ثبت مهمان برای برخی حساب‌ها duplicate رد می‌شود، اما با حساب کنترل موفق است؛ payload، پاسخ 409 و fixture داده باید مقایسه شوند.
12. **BUG-STG-039/072** — متن و eligibility لغو ثبت‌نام با وضعیت‌های approved/unpaid سازگار نیست.

## P2 — متوسط

1. **BUG-STG-081** — قیمت عضو در PLP با قیمت تخفیف‌دار PDP یکسان نیست.
2. **BUG-STG-082** — مبلغ دُنگ در PLP نمایش داده نمی‌شود، درحالی‌که در PDP/API موجود است.
3. **BUG-STG-REGISTRATION-TRANSPORT-COST-LABEL-CURRENT-2026-09-25** — هزینهٔ اتوبوس با label «خودرو» نمایش داده می‌شود.
4. **BUG-STG-035** — زمان حرکت بین Workspace ادمین و Portal حدود ۹۰ دقیقه تا دو ساعت اختلاف دارد.
5. **BUG-STG-024** — مبلغ قابل‌استرداد با واحد خام `IRR` نمایش داده می‌شود، درحالی‌که سایر مبالغ تومان هستند.
6. **BUG-STG-036** — registry فیلدهای Exposure از binding و redaction واقعی کامل‌تر است؛ بعضی detail fieldها قابل پنهان‌سازی اثبات‌شده نیستند.
7. **BUG-STG-ADMIN-WAITLIST** — علت waitlist به‌صورت خام `actionReason.capacityFull` نمایش داده می‌شود.
8. **BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS** — نام eventهای Telegram در پنل فارسی انگلیسی نمایش داده می‌شود.
9. **BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE-CURRENT-2026-09-25-1132** — توضیح location zone در صفحهٔ فارسی انگلیسی است.
10. **BUG-STG-EXPORT-SUMMARY** — تعداد بدهکاران با «مبلغ مانده» در Excel هم‌خوان نیست و مبلغ مانده برای همان فایل صفر می‌شود.

## P3 — پایین‌تر / قراردادی و تستی

1. **BUG-STG-040** — پیام receipt فایل‌دار متن جعلی یا اضافی اضافه می‌کند؛ renderer باید فقط دادهٔ واقعی receipt را نمایش دهد.
2. **BUG-STG-037** — شمارندهٔ نهایی و دامنهٔ تب «لیست عملیاتی» از filterهای متفاوت می‌آیند.
3. **BUG-SOURCE-TEST-TELEGRAM-FORMAT** — چهار fail در CI مربوط به assertion قالب فارسی/انگلیسی است؛ قرارداد قالب باید مشخص و تست/formatter هم‌تراز شود.

## موارد خارج از فهرست باگ فعال

- `BUG-STG-067` در گزارش به «باگ نیست» اصلاح شده است.
- `OBS-STG-FINANCE-BUSINESS-MEANING-ROLLOUT` طبق rollout مستند باگ نیست.
- `PASS-STG-TEXT-RETRY-REJECT-E2E` سبز است.
- مورد snapshot اولیهٔ تب مالی پس از پایان loading باگ قطعی تشخیص داده نشد.
- شناسه‌های تاریخی و checkpointهای تکراری، جداگانه شمرده نشده‌اند.

## ترتیب پیشنهادی اجرا

1. یکسان‌سازی policy و projection ثبت‌نام رایگان/پرداخت/رسید بین Portal، Admin و Finance.
2. بستن guard ظرفیت و اصلاح state/CTA/copy مربوط به waitlist.
3. اصلاح projectionهای list/detail/admin بعد از approve یا resubmit رسید.
4. تکمیل قرارداد PDP برای زمان شروع، پرداخت و نوع تأیید.
5. اصلاح محاسبات چندنفره و اختلاف زمان/واحد پول.
6. اصلاح parity کارت PLP با PDP، labelهای حمل و ترجمه‌ها.
7. افزودن assertionهای runtime و locale برای جلوگیری از بازگشت باگ‌ها.

## فازبندی و تسک‌های اجرایی

### فاز ۰ — آماده‌سازی و جلوگیری از دوباره‌کاری

**هدف:** ساختن baseline مشترک و جداکردن باگ واقعی از تنظیم، cache، snapshot یا گزارش تکراری.

- **F0.1 — ساخت ماتریس تشخیص:** برای هر شناسه ستون‌های سناریو، محیط، کاربر/tenant، fixture، تنظیمات مؤثر، endpoint، projection، renderer، مالک، شواهد و وضعیت اضافه شود.
- **F0.2 — بازبینی تکراری‌ها:** شناسه‌های گروهی و checkpointهای تکراری با یک root cause واحد ادغام شوند؛ از یک fix مشترک برای چند مشاهده استفاده شود.
- **F0.3 — baseline تنظیمات:** وضعیت Exposure، payment policy، approval، ظرفیت، transport، locale، cache و rollout با ابزار و artifact موجود ثبت شود؛ برای این کار ابزار یا زیرساخت جدید ساخته نشود.
- **F0.4 — baseline نسخه:** SHA واقعی staging از CI/deploy به‌دست آید؛ تا قبل از آن، نتیجهٔ runtime به branch یا commit خاص نسبت داده نشود.
- **F0.5 — ثبت مالکیت:** برای هر باگ دقیقاً یکی از این مالکان انتخاب شود: config، data/projection، API/egress، renderer/UI، localization یا test contract.

**گیت خروج:** هر مورد یا به «باگ واقعی و قابل‌اصلاح» تبدیل شده، یا به «تنظیم/داده/false positive/نیازمند شواهد» منتقل شده باشد.

تا عبور از این گیت هیچ implementation، migration، تغییر تنظیم staging یا تولید side effect خارجی مجاز نیست.

### فاز ۱ — یکپارچگی مالی و وضعیت ثبت‌نام

**هدف:** جلوگیری از نمایش یا تصمیم مالی اشتباه.

- **F1.1:** تشخیص `BUG-STG-080` و `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH-CURRENT-2026-09-25` و فقط پس از تأیید، اصلاح با یک قرارداد مشترک برای `zero-obligation`، payment state و receipt eligibility.
- **F1.2:** تشخیص `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE-FRESH-2026-09-25-1205` و `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE-FRESH-2026-09-25-1150` و فقط پس از تأیید، اصلاح از منبع projection مشترک؛ از patch جدا برای هر صفحه پرهیز شود.
- **F1.3:** تشخیص `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS-CURRENT-2026-09-25` و `BUG-STG-RECEIPT-STATUS-LABEL-MIXED-FRESH-2026-09-25-1135` با بررسی revalidation و تفکیک receipt status از registration status؛ اصلاح فقط پس از تأیید root cause.
- **F1.4:** تشخیص `BUG-STG-024` با ردیابی formatter واحدهای پولی؛ formatter جدید فقط در صورت نبود قرارداد موجود و فقط پس از تأیید root cause ایجاد شود.

**گیت خروج:** Portal، Admin، Finance و list/detail برای free، pending، approved، rejected و paid یک state contract و شواهد یکسان داشته باشند.

### فاز ۲ — ظرفیت، Waitlist و promotion

**هدف:** جلوگیری از ثبت‌نام یا تأیید بیش از ظرفیت و اعلام شفاف وضعیت صف.

- **F2.1:** تشخیص `BUG-STG-063` با بررسی guard فعلی promotion، ظرفیت باقی‌مانده، `partySize` و race condition؛ ابتدا ثابت شود مشکل در harness یا داده نیست.
- **F2.2:** تشخیص `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` با مقایسهٔ cache key، TTL، invalidation و source response؛ بدون افزودن cache جدید.
- **F2.3:** تشخیص مشترک و فقط پس از تأیید، اصلاح state/CTA/copy برای `BUG-STG-062/047`، `BUG-STG-064/065` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL-FRESH-2026-09-25-1220`.
- **F2.4:** بررسی `BUG-STG-037` و تعیین اینکه اختلاف شمارنده ناشی از قرارداد filter است یا projection؛ فقط پس از تأیید، یک منبع شمارش canonical انتخاب شود.

**گیت خروج:** ظرفیت صفر، waitlist، promotion و وضعیت عملیاتی در PLP، PDP، فرم و Admin با یک state machine و یک پاسخ معتبر هم‌خوان باشند.

### فاز ۳ — قرارداد PDP، فرم و محاسبات

**هدف:** انتقال کامل policy و مبلغ صحیح به کاربر.

- **F3.1:** تشخیص مشترک `BUG-STG-008/013` و `BUG-STG-EXPOSURE-PDP-START-PAYMENT-CURRENT-2026-09-25` از Exposure تا DOM؛ ابتدا بررسی شود field واقعاً فعال و payload متعلق به همان artifact است.
- **F3.2:** تشخیص `BUG-STG-022` با بررسی محاسبهٔ client preview در برابر محاسبهٔ server-side؛ اصلاح فقط پس از تأیید و مبلغ نهایی فقط از مسیر canonical سرور معتبر باشد.
- **F3.3:** تشخیص `BUG-STG-021` با مقایسهٔ payload، session، tenant، duplicate key و پاسخ 409؛ قبل از تغییر منطق duplicate fixtureها اصلاح نشوند.
- **F3.4:** تشخیص `BUG-STG-035` با مقایسهٔ instant خام، timezone و snapshot زمان ایجاد ثبت‌نام؛ قبل از تغییر formatter، مالک اختلاف مشخص شود.
- **F3.5:** تشخیص `BUG-STG-039/072` و `BUG-STG-040` با ردیابی lifecycle و دادهٔ receipt؛ اصلاح فقط پس از تأیید و copy مستقل و موازی برای هر صفحه ایجاد نشود.

**گیت خروج:** policy پرداخت/تأیید، زمان، حمل، دُنگ و lifecycle از یک قرارداد قابل‌ردیابی به UI برسند.

### فاز ۴ — Parity، حمل، ترجمه و خروجی

**هدف:** حذف اختلاف‌های قابل مشاهده و خروجی‌های گمراه‌کننده پس از تثبیت قراردادهای اصلی.

- **F4.1:** تشخیص `BUG-STG-081` و `BUG-STG-082` با بررسی session، preview pricing، fallback و منبع canonical کارت PLP؛ اصلاح فقط پس از تأیید و fallback خام نباید بی‌صدا قیمت پایه را جایگزین کند.
- **F4.2:** تشخیص `BUG-STG-REGISTRATION-TRANSPORT-COST-LABEL-CURRENT-2026-09-25` با بررسی enum/mapping واقعی transport؛ label جدید فقط در صورت نبود mapping مشترک و پس از تأیید ایجاد شود.
- **F4.3:** تشخیص `BUG-STG-036` با تطبیق registry، binding، redaction و persistence؛ اصلاح فقط پس از تأیید و هر field فقط یک تعریف canonical داشته باشد.
- **F4.4:** تشخیص و فقط پس از تأیید، اصلاح locale برای `BUG-STG-ADMIN-WAITLIST`، `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` و `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE-CURRENT-2026-09-25-1132` از یک registry ترجمهٔ مشترک.
- **F4.5:** تشخیص `BUG-STG-EXPORT-SUMMARY` با تعریف صریح totals نهایی، عملیاتی و pending؛ اصلاح فقط پس از تأیید و از جمع‌زدن دوباره در renderer Excel جلوگیری شود.

**گیت خروج:** PLP/PDP/فرم/Admin/Excel از منبع داده و labelهای سازگار استفاده کنند.

### فاز ۵ — قرارداد تست و closure

- **F5.1:** تعیین علت چهار fail در `BUG-SOURCE-TEST-TELEGRAM-FORMAT` و تصمیم‌گیری دربارهٔ قرارداد قالب قبل از اصلاح assertion.
- **F5.2:** برای هر باگ واقعی، تست regression نزدیک به مالک ریشه اضافه شود؛ تست صرفاً snapshot UI نباشد.
- **F5.3:** اجرای focused test، typecheck/lint/build مرتبط، `git diff --check` و تست runtime روی همان SHA.
- **F5.4:** مرور نهایی برای حذف abstraction، helper، state یا کد تکراری اضافه‌شده و ثبت شواهد closure در همین سند.

## وابستگی و ترتیب اجرای فازها

ترتیب اجباری اجرای کار این است: **فاز ۰ → فاز ۱ و ۲ → فاز ۳ → فاز ۴ → فاز ۵**.

- فازهای ۱ و ۲ فقط پس از گیت فاز ۰ شروع می‌شوند و می‌توانند با دو owner جدا موازی اجرا شوند.
- فاز ۳ به قرارداد state و ظرفیت فازهای ۱ و ۲ وابسته است؛ اگر policy یا waitlist هنوز نامشخص باشد، اصلاح PDP شروع نمی‌شود.
- فاز ۴ پس از تثبیت منبع canonical داده در فازهای ۱ تا ۳ اجرا می‌شود؛ در غیر این صورت parity فقط ظاهر را patch می‌کند.
- فاز ۵ پس از هر اصلاح focused اجرا می‌شود، اما closure نهایی فقط بعد از پایان همهٔ اصلاحات و تأیید runtime همان SHA صادر می‌شود.

## معیار تکمیل هر تسک

هر تسک فقط زمانی `done` است که این خروجی‌ها در پروندهٔ همان تسک ثبت شده باشد:

1. بازتولید موفق یا دلیل معتبر رد مشکل.
2. تنظیمات، fixture، cache/session و SHA بررسی‌شده.
3. root cause و مالک دقیق، نه فقط محل مشاهدهٔ UI.
4. کد/قرارداد موجودی که reuse شده یا دلیل روشن نبودن آن.
5. یک تغییر حداقلی با فهرست فایل‌های درگیر و مواردی که عمداً تغییر نکرده‌اند.
6. تست regression و شواهد runtime متناسب با ریسک.
7. نتیجهٔ نهایی یکی از این حالت‌ها: `confirmed bug`، `config/data issue`، `false positive`، `blocked` یا `fixed`.

تسکی که فقط با screenshot یا فقط با unit test بسته شود، closure معتبر ندارد.

## قالب اجباری هر تسک

```text
شناسه:
اولویت:
فرضیهٔ اولیه:
سناریوی بازتولید و شواهد:
تنظیمات/feature flagهای بررسی‌شده:
منبع داده و قرارداد مورد انتظار:
مالک ریشه‌ای:
کد/کامپوننت/تست موجود قابل‌استفاده:
راه‌حل کم‌پیچیدگی انتخاب‌شده:
مواردی که عمداً اضافه نمی‌شوند:
تست و شواهد قبل/بعد:
وضعیت: تشخیص‌نشده | باگ واقعی | ناشی از تنظیم/داده | false positive | اصلاح‌شده
```
