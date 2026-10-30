# برنامهٔ اجرایی tenant دوم Denali در staging

تاریخ: ۲۰۲۶-۱۰-۲۸ — وضعیت: **PLANNED؛ پیاده‌سازی و اجرای جدید انجام نشده است.**

مبنای بررسی کد: `a685ad89c78a21faf367f6afe00e197f4a812a48` در worktree تمیزِ زمان شروع بررسی. وضعیت زندهٔ شبکه، گواهی، دیتابیس و deploy در این مرحله بررسی نشده است. اطلاعات اجرای قبلی در `denali-booking-lifecycle-ledger.md` تاریخی است و در شروع اجرا باید تازه شود.

## ۱. نتیجهٔ مورد انتظار و محدوده

یک tenant مصنوعی به نام پیشنهادی `denali-qa2` با `workspaceType=denali` روی همان برنامه‌های staging و همان PostgreSQL staging ایجاد شود. جداسازی با tenant ID، عضویت، session، query scope و RLS اثبات شود. ایجاد workspace/plugin جدید یا کپی مستقل برنامه/دیتابیس لازم نیست.

پرداخت فقط `offline_receipt` با فیش مصنوعی است. حداقل ماژول‌های لازم برای تور، ثبت‌نام، امور مالی و پورتال فعال شوند. تیکتینگ، کیف پول و سایر ماژول‌ها صرفاً به‌دلیل وجود در seed عمومی فعال نشوند؛ وابستگی ضروری هرکدام پیش از حذف/افزودن بررسی شود.

Tenant A همان Denali موجود است؛ UUID واقعی آن در P0 از staging تأیید می‌شود. Tenant B شناسهٔ ثابت جدیدی دارد که فقط پس از بررسی عدم برخورد رزرو می‌شود. هیچ UUID یا hostname متعلق به A برای B بازاستفاده نشود. حساب‌های تست جدید، مصنوعی و tenant-scoped باشند.

این کار گپ جداسازی tenant در staging را هدف می‌گیرد. قرارداد XLSX مسافر↔راننده، تخصیص صندلی/پرواز، قاعدهٔ شناسهٔ ملی تکراری و همهٔ ترکیب‌های Cartesian، پروژه‌های جداگانه می‌مانند.

## ۲. تصمیم شبکه: همان IP، بدون الزام DNS عمومی

همان VPS/IP کافی است، ولی URL کاملاً یکسان یا صرفاً پورت متفاوت tenant دوم را تعریف نمی‌کند؛ API پورت Host را حذف می‌کند. در مسیر بدون DNS عمومی، نام‌های منطقی با فایل hosts یا resolver اختصاصی runner به IP واقعی staging وصل می‌شوند.

نام‌های پیشنهادی برای تست کاملِ دوطرفه:

| Tenant                     | کاتالوگ               | مدیریت                      | پورتال                       |
| -------------------------- | --------------------- | --------------------------- | ---------------------------- |
| A، alias برای Denali موجود | `denali.staging.test` | `admin.denali.staging.test` | `portal.denali.staging.test` |
| B، tenant جدید             | `qa2.staging.test`    | `admin.qa2.staging.test`    | `portal.qa2.staging.test`    |

هر شش نام به همان staging اشاره می‌کنند. aliasهای A باعث ایجاد tenant سوم نمی‌شوند و امکان تست کوکی میان دو tenantِ زیر یک والد را می‌دهند. اگر فقط دامنهٔ عمومی A و دامنهٔ خصوصی B تست شوند، بخشی از خطر اشتراک کوکی در یک والد مشترک دیده نخواهد شد.

originها باید HTTPS باشند. در حالت خصوصی، CA آزمایشی فقط در trust store اختصاصی runner/profile مورداعتماد قرار گیرد؛ کلید خصوصی روی runner منتشر نشود. Node/APIRequestContext و browser هر دو باید همین مسیر را معتبر بدانند. `ignoreHTTPSErrors` یا خاموش‌کردن web security مدرک TLS معتبر نیست.

**پیش‌نیاز باز:** مالک پورت ۴۴۳، دسترسی شبکه و امکان افزودن TLS خصوصی روی ورودی فعلی هنوز معلوم نیست. Caddy ثبت‌شده در repo، origin HTTP پشت Arvan است؛ وجود HTTPS مستقیم روی IP فرض نمی‌شود. یک portless origin روی ۴۴۳ ترجیح دارد، چون resolver فعلی marketing در production URL دارای پورت را رد می‌کند.

در P0 یکی از دو مسیر قطعی می‌شود:

1. مسیر ترجیحی بدون DNS عمومی: hostnameهای خصوصی + ورودی TLS با مسیرهای دقیق + trust محدود runner، پس از تأیید امکان همزیستی با ورودی موجود.
2. اگر پورت/TLS خصوصی در این topology هزینه یا ریسک بیشتری داشت: زیردامنه‌های staging زیر دامنهٔ موجود و همان مسیر HTTPS عمومی. دامنهٔ جدید خریداری نمی‌شود؛ پوشش DNS، edge و certificate باید واقعاً تأیید شود.

تعویض سراسری root domain، تضعیف HTTPS/cookie، static mapping در کد مشترک یا تغییر tenant از query parameter راه‌حل این طرح نیست. انتخاب مسیر باید پیش از تغییر پیکربندی ثبت شود. در مسیر خصوصی، دسترسی انسان هم به hosts و trust محلی نیاز دارد؛ صرف واردکردن IP در نوار آدرس کافی نیست. backend، frontend و DB همگی روی staging می‌مانند.

## ۳. شواهد کد و گپ‌های مسیر

این شناسه‌ها گپ اجرای طرح هستند؛ گزارش آسیب‌پذیری تأییدشدهٔ runtime محسوب نمی‌شوند.

| شناسه  | مشاهده / عدم قطعیت                                                                                                                           | اثر بر اجرا                                                                                                  | تسک بستن گپ            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| S2-G01 | Host در `apps/api/src/middleware/resolve-tenant-from-host.ts` بدون پورت normalize می‌شود.                                                    | IP با دو پورت به‌تنهایی جداسازی نمی‌دهد.                                                                     | P0-03، P1-01           |
| S2-G02 | Caddy فعلی origin HTTP پشت Arvan و دارای wildcardهای production است. وضعیت زندهٔ ۴۴۳ بررسی نشده.                                             | TLS خصوصی و مسیر شبکه باید پیش از rollout اثبات شوند؛ host جدید ممکن است به upstream اشتباه برسد.            | P0-03، P1-02/03        |
| S2-G03 | provisioning توسعه محدودیت NODE_ENV دارد؛ wrapper فعلی seed، فقط برای فرآیند one-off، admin DB و development را تنظیم می‌کند.                | seed مخصوص B باید staging را پیش از استفاده از admin DB محدود کند؛ runtime برنامه نباید development شود.     | P0-04، P2-01/02        |
| S2-G04 | `PlatformDomainRepository.findVerifiedActiveByHostname` فقط `verified` و `sslStatus=active` را resolve می‌کند؛ verification عمومی CNAME است. | hosts محلی اثبات CNAME عمومی نیست. binding خصوصی باید به‌عنوان پیکربندی اپراتوری staging، محدود و audit شود. | P1-04، P2-03           |
| S2-G05 | schema عمومی ایجاد دامنه فقط marketing/portal را می‌پذیرد؛ seed فعلی WRS ردیف admin هم دارد.                                                 | پشتیبانی end-to-end از admin hostname باید trace و تست شود؛ درج رشتهٔ admin در DB به‌تنهایی کافی نیست.       | P3-01/02               |
| S2-G06 | host/session resolverهای web و portal مسیرهای dev map، fallback و نتیجهٔ unresolved دارند.                                                   | کد به‌تنهایی نتیجهٔ امنیتی نهایی را ثابت نمی‌کند؛ caller، bootstrap واقعی، JWT و عضویت باید بررسی شوند.      | P3-01/03، P5-03        |
| S2-G07 | env فعلی URLهای marketing/portal و cookie domain را ثابت می‌کند.                                                                             | B ممکن است به A redirect شود یا مرورگر cookie را رد کند.                                                     | P3-04/05               |
| S2-G08 | URL resolver تولیدی marketing یک origin ثابت allowlist‌شده و بدون پورت می‌خواهد.                                                             | اضافه‌کردن یک URL در env، انتخاب tenant-aware را حل نمی‌کند؛ shared callers هم تحت تأثیرند.                  | P0-03، P3-04           |
| S2-G09 | config فعلی staging، URLهای هر دو tenant را به یک میزبان محدود می‌کند و resolver args مرورگر را حذف می‌کند.                                  | صرف افزودن env متغیر کافی نیست؛ browser، Node و config باید دو میزبانِ مجاز را بشناسند.                      | P4-01/02               |
| S2-G10 | تست موجود `TC-CL-TENANT-01` عمدتاً GET/PATCH tour را بررسی می‌کند.                                                                           | بستن همان تست برای ادعای جداسازی رزرو/مالی/export کافی نیست.                                                 | P5-01 تا P5-06         |
| S2-G11 | seedهای هویت/داده ممکن است tenant ID، resource ID یا role ثابت داشته باشند.                                                                  | کپی مستقیم ممکن است membership یا resource را به A وصل کند.                                                  | P0-04، P2-04/05        |
| S2-G12 | cache، tagهای revalidation، prefix فایل و workerها هنوز برای B در runtime بررسی نشده‌اند.                                                    | نشت cache/فایل، اثر ظرفیت روی A یا ارسال پیام واقعی باید در تست هدفمند بررسی شود.                            | P2-05، P3-06، P5-04/06 |
| S2-G13 | deploy فعلی URL/cookie env را sync و seed را دوباره اجرا می‌کند؛ artifact bundle فهرست مشخص دارد.                                            | اصلاح دستی با deploy بعدی از بین می‌رود یا seed جدید اصلاً در artifact نمی‌رسد.                              | P6-01/02/03            |
| S2-G14 | fingerprint زندهٔ role DB، bypass RLS، ترتیب seed و قابلیت rollback در این بررسی خوانده نشده.                                                | تست با admin DB یا teardown نامحدود، مدرک جداسازی قابل‌اتکا نیست.                                            | P0-02/04، P2-06، P7-02 |

## ۴. فازها و تسک‌های اجرایی

وضعیت اولیهٔ همهٔ تسک‌های اجرایی **TODO / NOT RUN** است. بررسی منبع انجام‌شده در بالا، PASS این تسک‌ها نیست. در ledger اجرا برای هر ID باید وضعیت، SHA، مدرک و blocker ثبت شود.

برای پرهیز از وابستگی دوری، P1 تا P5 ابتدا artifactهای config/code/seed/test را آماده و با بررسی‌های محلی/CI متأثر ارزیابی می‌کنند. معیارهای runtime هر تسک، قرارداد پذیرش آن هستند و در rollout مرحلهٔ P6 روی staging اجرا و ثبت می‌شوند. merge/deploy به پاس‌شدنِ تست staging روی کد هنوز deployنشده وابسته نیست؛ تکمیل پروژه به پاس‌شدن همان تست روی deploy نهایی وابسته است. تا آن زمان وضعیت runtime همان NOT RUN باقی می‌ماند.

### P0 — تثبیت مبنا و قرارداد اجرا

**خروجی:** هویت A/B، مسیر دسترسی، محدودهٔ seed و baseline قابل‌برگشت مشخص باشد.

| تسک   | کار و تحویل                                                                                                                                                | وابستگی | معیار پایان                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| P0-01 | ثبت branch/HEAD و dirty inventory، دستورهای native و nested instructions؛ استفاده از checkout جدا از تغییرات کاربر.                                        | —       | فایل‌های کاربر محفوظ؛ SHA مبنای اجرا ثبت شده.                                                                               |
| P0-02 | read-only inventory staging: release SHA/digest، چهار سرویس، DB name و app role، وضعیت RLS، tenant/domain/identity فعلی؛ بدون خروجی secrets.               | P0-01   | A واقعی و نقش runtime DB مشخص؛ countهای baseline ثبت شده.                                                                   |
| P0-03 | probe فقط‌خواندنی DNS/resolver، edge، ۴۴۳، TLS/SNI موجود، redirects و شبکهٔ runner؛ انتخاب خصوصی یا عمومی از بخش ۲.                                        | P0-02   | مالک پورت، مسیر شبکه و روش trust مشخص؛ topology و تغییر لازم ثبت شده. اثبات hostname جدید پس از آماده‌سازی P1 انجام می‌شود. |
| P0-04 | inventory provisioning، certification guards، tenant/domain uniqueness، seed identity/resource dependencies و worker policies؛ رزرو UUID/slug بدون برخورد. | P0-02   | قرارداد seed، roleها، کمینهٔ ماژول‌ها، منع ارسال واقعی و محدودهٔ teardown مشخص.                                             |

تصمیم دربارهٔ transport، TLS و نگاشت admin، وابستگی واقعی است؛ مبهم‌بودن آن نباید با skip یا خاموش‌کردن guard حل شود. تحلیل کد، طراحی seed و طراحی تست در همین فاصله قابل ادامه‌اند.

### P1 — ورودی، hostname و TLS

**خروجی:** نام‌ها به staging و surface درست می‌رسند؛ tenant دیگری به‌صورت fallback انتخاب نمی‌شود.

| تسک   | کار و تحویل                                                                                                                         | وابستگی      | معیار پایان                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| P1-01 | manifest واحد hostname→tenant→surface؛ bootstrap و حذف hosts/resolver برای runner و دسترسی انسانی.                                  | P0-03/04     | هر شش hostname با IP مقصد ثبت‌شده resolve می‌شود؛ IP یا کلید در کد مشترک hardcode نشده.                      |
| P1-02 | TLS خصوصی با trust محدود runner یا edge عمومی تأییدشده؛ ثبت expiry و مسئول renewal.                                                 | P0-03        | browser و API request بدون bypass TLS موفق؛ مسیر خصوصی به public CNAME certification تعبیر نشده.             |
| P1-03 | routeهای دقیق web/marketing/portal به upstreamهای staging؛ preserve Host و forwarded proto فقط از proxy معتبر؛ validate سپس reload. | P1-01/02     | هر surface fingerprint درست دارد؛ هیچ‌کدام روی production wildcard/upstream نمی‌افتد؛ A baseline برقرار است. |
| P1-04 | تعریف روش binding اپراتوریِ private hostname، ownership/collision check و audit؛ عمومی و خصوصی از نظر مدرک verification روشن باشند. | P0-04، P1-02 | binding بدون stub سراسری verification و فقط برای allowlist این طرح قابل اجراست.                              |

### P2 — ساخت tenant و دادهٔ مستقل

**خروجی:** B قابل provision و seed مجدد است و دادهٔ A تغییر نمی‌کند.

پیش از اجرای wrapperهای staging، `DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST` باید از تنظیمات کنترل‌شدهٔ staging به‌صورت فهرست میزبان‌های دقیق و جداشده با کاما تأمین شود. مقدارهای wildcard، scheme و port پذیرفته نمی‌شوند؛ میزبان هر دو URL برنامه و admin باید عضو این فهرست باشد. URLهای اتصال در گزارش یا لاگ چاپ نشوند.

| تسک   | کار و تحویل                                                                                                                                                                                                                                                                          | وابستگی      | معیار پایان                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| P2-01 | wrapper مخصوص staging با بررسی target، env/deploy path، DB نام و میزبان مجاز، و tenant ID ثابت؛ dry-run و رد production/mismatch.                                                                                                                                                  | P0-04        | ورودی نامعتبر پیش از هر mutation و پیش از تغییر DB URL به admin رد می‌شود.                                                   |
| P2-02 | استفاده از primitiveهای provisioning موجود؛ کنترل certification/guard؛ reconciliation فقط روی B، transaction یا جبران مراحل ناقص.                                                                                                                                                    | P2-01        | اجرای دوباره ID تازه یا رکورد تکراری نمی‌سازد؛ تعارض slug/UUID به خطا می‌رسد و tenant دیگر را تصاحب نمی‌کند.                 |
| P2-03 | binding دامنه‌های alias A و دامنه‌های B طبق manifest؛ TLS state پس از اثبات P1 فعال شود؛ cache registry invalidate شود.                                                                                                                                                              | P1-04، P2-02 | API هر hostname را به tenant/surface مورد انتظار resolve می‌کند؛ host ناشناس خطا دارد.                                       |
| P2-04 | Owner، Finance و Member مصنوعی و tenant-scoped؛ برای Owner B حساب تازه با شمارهٔ رزروشدهٔ `+1555` بساز؛ حساب قدیمی/manifest را بازاستفاده نکن؛ membership/status و login policy بررسی شود؛ موبایل با user/موبایل دیگر یا challenge قبلی OTP برخورد نکند؛ credentials خارج از report. | P2-02        | login واقعی هر نقش را با هویت مصنوعی خودش ثابت کند؛ Owner عمومی/platform یا حساب B با شمارهٔ خارج از namespace استفاده نشود. |
| P2-05 | resourceهای لازم wizard، policyها، تور رایگان/پولی و رزروهای مستقل با runId؛ outbox/integration تست به مقصد واقعی ارسال نکند.                                                                                                                                                        | P2-04        | مسیر مثبت B کار می‌کند؛ FKها/کلیدها tenant-scoped؛ baseline A بدون تغییر غیرمجاز.                                            |
| P2-06 | dry-run cleanup و rollback seed با manifest رکوردهای task-owned؛ accountهای مشترک/دادهٔ غیرتستی حفاظت شوند.                                                                                                                                                                          | P2-03/05     | teardown فقط رکورد/فایل ثبت‌شدهٔ B و aliasهای اضافه‌شدهٔ A را هدف می‌گیرد؛ بدون TRUNCATE یا CASCADE کور.                     |

### P3 — سازگاری runtime با دو tenant

**خروجی:** Host، domain registry، bootstrap، JWT/membership، لینک‌ها و session یک tenant واحد را بیان می‌کنند.

| تسک   | کار و تحویل                                                                                                                                                | وابستگی      | معیار پایان                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| P3-01 | trace واقعی edge→web/portal/marketing→bootstrap→API→DB؛ بررسی همهٔ callerهای host/session و admin recognition.                                             | P0-04        | قرارداد هر surface و مسیر public/protected مشخص؛ هیچ نتیجهٔ unresolved به‌اشتباه PASS فرض نشده.                           |
| P3-02 | حداقل اصلاح لازم برای resolve شدن admin hostname و domain mapping B از قرارداد معتبر؛ بدون افزودن slug جدید به dev static map.                             | P3-01، P2-03 | مدیریت A/B tenant context مستقل دارند و refresh/deep-link کار می‌کند.                                                     |
| P3-03 | host/JWT/membership mismatch و host ناشناس در protected routeها طبق قرارداد reject شوند؛ header ورودی مشتری نتواند tenant عوض کند.                         | P3-02        | مسیر مثبت درست و replay منفی دوطرفه پاس؛ رفتار platform-admin خارج از scope تصادفاً خراب نشده.                            |
| P3-04 | لینک‌سازی و redirects مبتنی بر tenant/domain معتبر؛ env موجود فقط fallback محدود؛ origin allowlist از registry معتبر، بدون open redirect.                  | P3-01، P2-03 | A→A و B→B در کاتالوگ، ورود، ثبت‌نام، پورتال و لینک admin؛ URL ورودی مخرب رد می‌شود.                                       |
| P3-05 | domain/name/path/Secure/SameSite کوکی، refresh و logout بر اساس surface/tenant؛ سازگاری با public A حفظ و تست شود.                                         | P3-03/04     | login→refresh→logout روی A/B درست؛ کوکی B برای apex tenant A صادر نمی‌شود؛ token A روی B مجوز نمی‌دهد.                    |
| P3-06 | cache keys/tags، SSR/bootstrap branding، fetch dedup، storage prefix و scoped download/export را فقط در مسیرهای مصرف‌شده بررسی و در صورت اثبات اصلاح کنیم. | P3-01، P2-05 | پس از refresh/revalidate و جابه‌جایی tenant، دادهٔ اشتباه مشاهده نمی‌شود؛ منابع مشترکِ عمدی از دادهٔ خصوصی تفکیک شده‌اند. |

تغییر shared helper فقط پس از inventory callerها و تست قراردادهای A و B انجام شود. primitiveهای platform-core/workspace-sdk نباید به Denali یا اسم hostnameهای تست import وابسته شوند. تغییر API/قرارداد با مستند متناظر همراه باشد. ایجاد migration تنها در صورت اثبات فقدان پشتیبانی schema، با plan/rollback مستقل بررسی شود؛ جزء فرض اولیه نیست.

### P4 — fixture و ابزار تست دو tenant

**خروجی:** یک دستور قابل‌تکرار با target کنترل‌شده و دادهٔ خودکار وجود دارد.

| تسک   | کار و تحویل                                                                                                                                      | وابستگی         | معیار پایان                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------- |
| P4-01 | config اختصاصی two-tenant-staging با allowlist manifest، بررسی واقعی A≠B و external servers؛ رفع محدودیت فعلیِ یک host بدون بازکردن مقصد دلخواه. | P0-03/04        | URL یکسان، production target و host خارج allowlist قبل از تست رد می‌شود.                                 |
| P4-02 | resolver و CA trust برای browser، Node، APIRequestContext و ابزار request؛ بررسی proxy env/no_proxy و منابع cross-origin.                        | P1-01/02، P4-01 | هر ابزار به همان مقصد می‌رسد؛ `curl` تنها مدرک browser نیست؛ security مرورگر فعال می‌ماند.               |
| P4-03 | factory پارامتری tenant/identity/resource/runId؛ seed API/offline برای داده، UI فقط برای رفتار wizard/ورود/رسید مورد قبول.                       | P2-04/05        | دادهٔ دو اجرا تداخل ندارد؛ دستی ساختن تور شرط اجرا نیست.                                                 |
| P4-04 | manifest artifacts با runtime SHA، test SHA، tenant labels، runId و status؛ trace/screenshot برای رفتار لازم و شکست‌ها، بدون secrets/PII.        | P4-01/03        | نتیجه از fixture و screenshot ساختگی به runtime PASS ارتقا داده نشده؛ artifact directory قابل‌نوشتن است. |

### P5 — مجموعهٔ اثبات جداسازی و مسیرهای مثبت

**خروجی پیش از deploy:** suite آماده و بررسی‌های focused logic/DB با دادهٔ مستقل انجام شده باشد. **خروجی runtime پس از P6-03:** ماتریس زیر در staging با app DB role واقعی اجرا شود. هیچ تست بحرانی صرفاً با mock یا admin DB پاس staging محسوب نشود.

| تسک   | کار و تحویل                                                                                                                           | وابستگی             | معیار پایان                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| P5-01 | smoke مثبت A/B و قراردادهای Host→tenant→surface؛ branding، فهرست و detail بعد از refresh.                                             | P3-02/04، P4        | tenant IDs واقعاً متفاوت‌اند؛ هر دو قابل استفاده‌اند.                                                  |
| P5-02 | GET/PATCH و منابع child دوطرفه؛ status مجاز طبق قرارداد و عدم mutation را با read دوبارهٔ مالک ثابت کنیم.                             | P5-01               | denial ناشی از login خراب/500 نیست؛ مالک همچنان read/write مجاز دارد.                                  |
| P5-03 | session/token replay، role و membership، deep links، logout/refresh، Host/forwarded-host mismatch و host ناشناس.                      | P3-03/05، P5-01     | mismatch در protected route رد؛ public catalog مجازِ B با همین تست اشتباه forbidden اعلام نشده.        |
| P5-04 | رزرو، ظرفیت، waitlist، ثبت/بررسی فیش، invoice، list/filter/page/count و roster/export دوطرفه.                                         | P2-05، P3-06، P5-01 | هیچ row/count خصوصیِ دیگری دیده/تغییر نکند؛ concurrency کنترل‌شده ظرفیت tenant دیگر را تغییر ندهد.     |
| P5-05 | مسیر کامل B: wizard→publish→catalog→member registration→receipt→Finance→paid؛ رایگان یک مسیر کوتاه؛ read-back API/portal/roster/XLSX. | P3، P4              | paid flow با فیش مصنوعی و مبلغ/وضعیت صحیح؛ refresh پس از مرحلهٔ نهایی پایدار است.                      |
| P5-06 | RLS با app role واقعی در scope A/B، interleaving درخواست‌ها/ALS، cache warm/revalidate و دسترسی فایل/export.                          | P0-02، P3-06، P4    | query business-path بدون bypass انجام شده؛ signed URL اشتراکیِ عمدی با نشت metadata خصوصی اشتباه نشود. |

تست‌های مرورگری stateful روی tenant مشترک serial اجرا شوند؛ تست‌های logic و DB با دیتای مستقل می‌توانند موازی اجرا شوند. یک failure ابتدا با trace/DOM/شبکه تحلیل و سپس فقط سناریوی متأثر rerun شود. retry بی‌حد و عبور از خطا با skip مجاز نیست.

### P6 — تحویل تکرارپذیر از dev به staging

**خروجی:** تمام تنظیمات و seed در artifact/deploy path شناخته‌شده موجود و پس از deploy پایدار باشند.

| تسک   | کار و تحویل                                                                                                                                             | وابستگی                                              | معیار پایان                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P6-01 | افزودن entrypoint seed و manifest به artifact build، wrapper و check وجود فایل؛ seed opt-in و محدود B؛ CA key جزء artifact نباشد.                       | P2، P4                                               | artifact از checkout تمیز و SHA مشخص ساخته شود؛ bundle جدید واقعاً داخل artifact باشد.                                     |
| P6-02 | هماهنگ‌کردن sync env و نصب artifact تا overrideهای دستی و URL/cookie ثابت تغییرات B را از بین نبرند؛ QA ingress template ماندگار.                       | P1، P3، P6-01                                        | install و deploy بعدی mappingها/روابط را حفظ کند؛ config drift قابل تشخیص باشد.                                            |
| P6-03 | diff review تازه، focused type/lint/test/architecture checks، PR به dev، build/deploy استاندارد با artifact digest.                                     | آماده‌بودن suite P5 و نتایج local/CI متأثر؛ P6-01/02 | checkهای متأثر پاس؛ فقط مسیرهای task-owned stage شوند؛ deploy SHA/digest دقیق ثبت شود. اجرای staging P5 پس از این تسک است. |
| P6-04 | پس از deploy: فعال‌سازی کنترل‌شدهٔ ingress/seed طبق runbook، اثبات معیارهای runtime P1 تا P4، health چهار سرویس، اجرای P5 روی دو tenant و مسیر حیاتی A. | P6-03                                                | مدرک runtime روی SHA نهایی؛ health به‌تنهایی closure نیست؛ هیچ تغییر جدید به main/production لازم نیست.                    |

قبل از نوشتن code در API/shared packages مستند قراردادهای مربوط به host/session/provisioning به‌روز شود. full gateهای تو در تو فقط در صورت الزام واقعی و مجوز مربوط اجرا شوند؛ هدف روزمره focused check است. هزینهٔ deploy با تجمیع تغییرات سازگار و بررسی محلی کم شود؛ نتیجهٔ نهایی حتماً روی artifact نهایی تأیید شود.

### P7 — پایداری، rollback و بستن شواهد

**خروجی:** راه‌حل قابل نگهداری است و گپ دومین tenant از ledger با مدرک بسته می‌شود.

| تسک   | کار و تحویل                                                                                                                           | وابستگی             | معیار پایان                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| P7-01 | اجرای مجدد seed و smoke بعد از restart و یک نصب مجدد کنترل‌شدهٔ artifact؛ عدم تغییر دادهٔ کاری B.                                     | P6-04               | بدون رکورد تکراری، credential reset یا بازنویسی رزرو/فیش کاربر.                                  |
| P7-02 | اجرای امن rollback روی داده/پیکربندی مصنوعیِ همین task؛ ثبت restoration fingerprint و اثبات دسترسی A.                                 | P2-06، P6-04        | config، ingress، trust و aliases به‌صورت مستقل قابل بازگشت؛ cleanup محدود و read-back انجام شده. |
| P7-03 | به‌روزرسانی matrix/ledger/evidence با scenario→test→result→environment→runtime/test SHA→artifact؛ انتقال skip tenant به نتیجهٔ واقعی. | P5، P6-04، P7-01/02 | هیچ NOT RUN یا شکست critical باقی نمانده؛ gaps خارج scope همچنان صریح‌اند.                       |
| P7-04 | runbook دسترسی انسان/CI، اجرای one-command، renewal TLS، health و بازیابی؛ diff review نهایی و ثبت موارد deferred.                    | P7-03               | فرد دیگر بتواند setup و اجرا را تکرار کند؛ اسرار از گزارش/کامیت حذف‌اند.                         |

## ۵. ماتریس سناریوهای پذیرش

برای هر ردیف status اولیه NOT RUN است. denial باید همراه اثبات موفقیت مسیر مالک و در موارد mutation با عدم تغییر read-back شود.

| شناسه  | سناریو                                                       | نتیجهٔ لازم                                                                                  |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| S2-E01 | Resolve هر شش hostname و تطبیق fingerprint و tenant ID       | همان staging، سه surface درست، دو tenant مستقل                                               |
| S2-E02 | host ناشناس/forwarded host جعلی                              | بدون fallback به tenant معتبر؛ طبق قرارداد خطای کنترل‌شده                                    |
| S2-E03 | ورود Owner/Finance/Member هر tenant                          | نقش و عضویت tenant درست؛ دسترسی مثبت برقرار                                                  |
| S2-E04 | tour detail/edit از A→B و B→A                                | 403/404 مطابق قرارداد؛ عنوان/version مالک تغییر نکند                                         |
| S2-E05 | list/search/filter/pagination/count مدیریتی                  | داده و count خصوصی دیگری دیده نشود                                                           |
| S2-E06 | child IDs متعلق به tenant دیگر در ثبت‌نام، فیش و عملیات مالی | نه read غیرمجاز و نه write/FK غیرمجاز                                                        |
| S2-E07 | token/session A روی protected host B و برعکس                 | رد دسترسی؛ redirect/refresh باعث برگشت به context غلط نشود                                   |
| S2-E08 | login/refresh/logout و returnTo در admin/catalog/portal      | همان tenant؛ returnTo خارجی و cookie domain نامعتبر رد شود                                   |
| S2-E09 | جابه‌جایی دو tenant در browser و public sibling aliases      | بدون stale data؛ توزیع کوکی مطابق قرارداد؛ test context مستقل و replay عمدی هر دو پوشش دارند |
| S2-E10 | wizard create/edit/publish/catalog B                         | state canonical بعد از refresh و catalog همخوان                                              |
| S2-E11 | ثبت‌نام رایگان B                                             | ظرفیت/approval/waitlist مطابق policy همان B                                                  |
| S2-E12 | paid receipt→Finance→paid روی B                              | invoice، member، roster و XLSX سازگار؛ پول/پیام واقعی ارسال نشود                             |
| S2-E13 | capacity/waitlist interleaving A/B                           | تغییر ظرفیت/صف در scope دیگر رخ ندهد                                                         |
| S2-E14 | roster/XLSX/receipt download endpoints                       | درخواست مجاز فقط metadata/rowهای همان tenant؛ file namespace بررسی شود                       |
| S2-E15 | RLS/app role و interleaving tenant contexts                  | business path tenant-scoped؛ شاهد با admin/bypass ساخته نشود                                 |
| S2-E16 | cache warm→switch→revalidate→refresh                         | scope خصوصی درست؛ منابع public عمدی به‌عنوان leak گزارش نشوند                                |
| S2-E17 | seed دوباره و deploy/restart                                 | ID ثابت، دادهٔ مصنوعی مستقل، config پایدار، credential و پرداخت موجود حفظ شود                |
| S2-E18 | rollback/cleanup محدود + A smoke                             | حذف task-owned، اثر خارج scope صفر، A قابل استفاده                                           |

نقش‌ها و endpointهای دقیق پس از inventory P0/P3 در قرارداد تست ثبت می‌شوند؛ این جدول مجوز اختراع endpoint، وضعیت HTTP یا business rule جدید نیست. endpoint دانلود signed URL الزاماً پس از صدور از bearer capability استفاده می‌کند؛ آزمون مجوزِ صدور لینک با اعتبار خود لینک یکی تلقی نشود.

## ۶. اثرهای جانبی، کنترل و بازگشت

| اثر جانبی محتمل                               | چه چیزی آسیب می‌بیند                              | کنترل / تشخیص                                                                  | اقدام برگشت                                                                     |
| --------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| hostname جدید به wildcard production می‌افتد  | درخواست روی سرویس/DB غلط                          | exact route، fingerprint مثبت پیش از login/seed                                | حذف route QA و بازگردانی config snapshot                                        |
| reload ورودی مشترک اشتباه است                 | سطح‌های staging و احتمالاً مسیرهای دیگر همان edge | validate config، reload اتمیک، smoke A بعد از reload                           | config قبلی؛ بدون restart کور سرویس مشترک                                       |
| اعتماد CA بیش‌ازحد گسترده                     | محیط دستگاه یا runner                             | trust اختصاصی job/profile، فقط public CA cert                                  | حذف trust و profile آزمایشی؛ key سرور محفوظ                                     |
| نام‌ها فقط در browser resolve می‌شوند         | Node/API E2E به مقصد متفاوت می‌رود                | probe مستقل browser و Node و proxy env                                         | حذف mapping همان task؛ fail سریع                                                |
| seed روی DB نادرست یا با admin business-test  | دادهٔ خارج staging یا مدرک کاذب RLS               | guard target/DB/path پیش از mutation؛ app role برای business proof             | متوقف‌کردن seed؛ rollback محدود manifest، نه restore کور کل DB                  |
| ID/slug/host collision و upsert تصاحب‌کننده   | tenant/domain موجود                               | collision check و compare owner پیش از write                                   | transaction rollback؛ هیچ reassignment خودکار                                   |
| کپی کل theme/modules/identity A               | grant/role و قابلیت ناخواسته B                    | کمینهٔ ماژول‌ها، user/membership جدید و inventory dependency                   | restore B-owned config/grants قبلی                                              |
| global env/fallback به B تغییر کند            | A یا همهٔ hostها                                  | tenant-aware map؛ unknown host reject؛ regression A                            | snapshot env؛ reload/restart فقط سرویس متأثر                                    |
| URL resolver مشترک عوض شود                    | لینک‌ها در workspaceهای دیگر/production contract  | inventory callers، حفظ fallback قدیمی برای contract موجود، focused regressions | revert تغییر helper با config سازگار                                            |
| کوکی از tenant دیگر share یا اشتباه clear شود | login، logout و session                           | aliases هم‌والد، scope/path/name و replay test                                 | بازگشت cookie policy و پاکسازی فقط cookieهای آزمایشی؛ revocation B در صورت نیاز |
| cache key/tag tenant ندارد                    | branding، catalog، private data                   | warm-switch-refresh/revalidate و trace                                         | invalidate محدود cache متأثر پس از fix؛ حذف کلی Redis راه‌حل نیست               |
| storage/export prefix مشترک                   | فیش‌ها و خروجی‌های خصوصی                          | prefix/runId، authorization صدور URL و بررسی metadata                          | حذف فقط objectهای task-owned؛ revoke لینک در صورت پشتیبانی                      |
| ارسال OTP/SMS/Telegram/webhook واقعی          | مخاطب بیرونی و هزینه                              | policy تست staging و synthetic identity، بررسی outbox/adapter قبل از اجرا      | توقف delivery برای B؛ حذف فقط jobهای مصنوعی مجاز                                |
| race در ALS/pool یا seed همزمان               | query در tenant context غلط، fixture flaky        | interleaving هدفمند با app role؛ قفل seed و serial UI stateful                 | توقف اجرای متداخل و fix مسیر context؛ failure پنهان نشود                        |
| deploy بعدی config را برگرداند                | B از دسترس خارج یا به A redirect شود              | artifact integration و replay نصب؛ drift check                                 | release قبلی + snapshot config مستقل                                            |
| cleanup یا cascade حذف گسترده کند             | دادهٔ A یا identity مشترک                         | manifest و ownership، dry-run counts، ترتیب childها                            | پیشگیری با transaction؛ بازیابی محدود task-owned از snapshot در صورت نیاز       |
| رشد log/blob/fixture و بار DB                 | کندی staging و هزینهٔ artifact                    | runId، retention، اجرای محدود و teardown مشخص                                  | پاکسازی artifacts همان run و کاهش concurrency                                   |

## ۷. موازی‌سازی و مسیر بحرانی

سه مسیر پس از baseline قابل پیشبرد مستقل هستند:

- **زیرساخت:** P0-03 → P1؛ مسیر hostname، TLS و edge.
- **داده:** P0-04 → P2؛ seed، identity، resource و cleanup.
- **runtime/test:** P3-01 و طراحی P4/P5؛ inventory callerها و fixture config. رفع host/session/link وابسته به manifest نهایی P1/P2 است.

ویرایش یک shared file توسط چند مجری همزمان مجاز نیست؛ مالک فایل مشخص باشد. عملیات mutation staging، seed و browser tests روی دادهٔ مشترک serial شوند. موازی‌سازی تست‌های logic و PostgreSQL با fixture مستقل مجاز است.

مسیر بحرانی: `P0 → تصمیم TLS/Host → آماده‌سازی P1+P2 → P3+P4 → suite P5 و local/CI → P6 deploy → فعال‌سازی و اجرای runtime P1…P5 → P7`.

اگر TLS خصوصی blocker شد، کد seed، fixture، قرارداد session و تست‌های DB با دو tenant پیش می‌روند. اگر seed وابستگی resource داشت، host resolution و config مستقل جلو می‌رود. تست محلی/CI در این فاصله PASS staging محسوب نمی‌شود. اگر نتیجهٔ امنیتی critical fail شد، branch متأثر fix و retest می‌شود؛ افزودن حالت‌های کم‌اولویت منتظر این fix نمی‌ماند. هیچ درصد یا زمان قطعی پیش از بسته‌شدن P0 اعلام نمی‌شود.

## ۸. بسته‌های تحویل و ترتیب rollout

1. قرارداد و manifest و seed/guard/cleanup + focused tests.
2. resolve میزبان، session، cookie و URLها + تست قرارداد callerهای متأثر.
3. config ورودی/runner و بسته‌بندی seed در artifact + قرارداد deploy.
4. suite staging دو tenant + ledger/result نهایی.

این‌ها مرزهای بررسی هستند و الزام به چهار PR/deploy مستقل ندارند. می‌توان تغییرات سازگار را در یک PR قابل‌بررسی و یک deploy جمع کرد. ingress/seed به‌صورت opt-in و در ترتیب وابستگی فعال شود. تغییر مشترک فقط وقتی بدون QA hosts هم با Denali موجود سازگار است merge شود.

Runbook rollout:

1. تازه‌سازی SHA/baseline و ثبت snapshot config/ownership قبل از mutation.
2. ساخت artifact از commit ثبت‌شده و تأیید digest/وجود seed.
3. آماده‌کردن resolver/trust و validate ورودیِ QA، بدون فعال‌کردن binding فاقد TLS.
4. نصب artifact، تأیید سلامت A، سپس guarded seed B و domain binding.
5. فعال‌کردن exact ingress و probe hostname/surface/tenant، سپس هویت‌ها.
6. اجرای smoke مثبت A/B و اولین تست منفی GET/PATCH پیش از مسیر مالی.
7. اجرای مجموعهٔ P5؛ شکستِ critical مانع closure است و با skip جبران نمی‌شود.
8. بررسی persistence با rerun seed و restart/install کنترل‌شده، سپس smoke متأثر.
9. dry-run/تمرین rollback محدود و restore setup نهایی؛ smoke A/B پس از restore.
10. ثبت runtime SHA و test SHA و مدارک؛ redact secrets و نگهداری artifacts مجاز.

## ۹. سیاست rollback

rollback چهار جزء مستقل دارد: app release، env/edge config، DB/seed، client resolver/trust. برگشت app release، ردیف tenant یا config بیرونی را خودکار برنمی‌گرداند.

در شکست P1: QA route/aliases و trust همان task برگردند؛ A smoke اجرا شود.

در شکست seed: writeهای مرحلهٔ جاری transaction rollback یا از manifest جبران شوند؛ private tenant B غیرفعال بماند تا completion. دادهٔ A یا اشخاص مشترک حذف نشود.

در شکست app/session: release قبلی و env snapshot سازگار restore، route B بسته و domain activation B غیرفعال شود؛ sessionهای B در صورت نیاز revoke؛ A مثبت تست شود. private-key material از روی artifact یا repo بازیابی نمی‌شود و در storage امن باقی می‌ماند.

در cleanup نهایی: ابتدا manifest/dry-run و count، سپس childهای task-owned، objectها، bindingهای افزوده‌شده و در آخر tenant B طبق FK contract حذف یا غیرفعال شود. aliasهای افزوده‌شدهٔ A فقط با ID ثبت‌شده حذف شوند. حذف tenant فعال حاوی دادهٔ غیرتستی یا purge مشترک بخشی از این طرح نیست.

## ۱۰. معیار تکمیل و بستهٔ مدرک

- A و B واقعاً tenant ID متفاوت روی shared staging runtime/DB دارند.
- سه surface هر دو tenant و مسیرهای مثبت بعد از refresh کار می‌کنند.
- hostnameها در browser و request stack واقعاً تا staging resolve می‌شوند؛ TLS بدون bypass معتبر است.
- حساس‌ترین read/writeها، child resources، مالی و صادرات در هر دو جهت scope درست دارند.
- RLS/ALS و authorization با app role و real middleware ثابت شده‌اند؛ admin فقط در provisioning محدود استفاده می‌شود.
- `TC-CL-TENANT-01` یا جایگزین معادلش دیگر برای همسان‌بودن host skip ندارد؛ بقیهٔ ماتریس هم status واقعی دارد.
- lifecycle B با فیش مصنوعی پاس است؛ مسیر حیاتی A regression ندارد.
- seed دوباره، deploy/restart، cleanup و rollback محدود قابل‌تکرار هستند.
- مدرک شامل environment، runtime SHA، test SHA، artifact digest، command، نتیجه، runId و trace/screenshot متناسب است.
- هیچ failure/BLOCKED/NOT RUN بحرانی با health، source inspection یا mock پوشانده نشده؛ گپ‌های محصول خارج scope صریح باقی‌اند.

فرمان‌های نهایی seed/test/verify پس از انتخاب topology در P0 به root package scripts یا ابزار native موجود اضافه/متصل می‌شوند. در این سند فرمان ساختگیِ ظاهراً قابل اجرا ارائه نشده است.

## ۱۱. وضعیت بررسی این سند و مراجع

بررسی منبع A/B/D/E انجام شد؛ C (طراحی بصری جدید) در این درخواست موضوعیت ندارد؛ F/G/H/I پیاده‌سازی و runtime/test هنوز NOT RUN هستند؛ J بازبینی سازگاری خود برنامه انجام شده و review تغییر کد در P6/P7 آینده است. این وضعیت هیچ PASS runtime جدیدی ادعا نمی‌کند.

مراجع کد روی مبنای ذکرشده:

- `apps/api/src/middleware/resolve-tenant-from-host.ts` — normalize کردن Host.
- `apps/api/src/internal/provisioning.service.ts` و `provisioning-guard.ts` — primitiveها و محدودیت provisioning.
- `apps/api/scripts/seed-operator-staging.ts` و `scripts/vps-deploy/seed-staging-artifact.sh` — seed one-off موجود.
- `apps/api/src/platform/platform-domain.repository.ts` — شرط verified/active.
- `apps/api/src/platform/create-tenant-domain.schema.ts` و `apps/api/scripts/seed-wrs-denali-club-domains.ts` — تفاوت سطح admin و قرارداد عمومی domain.
- `apps/web/src/tenant/session-host-binding.ts` و `apps/portal/src/tenant/session-host-binding.ts` — host/session و مسیرهای resolve.
- `apps/portal/src/auth/build-session-cookie.ts` — تقدم cookie domain تنظیم‌شده.
- `packages/guest-surface-host/src/resolve-marketing-public-base-url.ts` و `resolve-portal-public-base-url.ts` — لینک‌های cross-surface.
- `deploy/vps/caddy/Caddyfile` — ورودی مشترک و exact staging hosts.
- `scripts/vps-deploy/sync-staging-profile-b-public-urls.sh`، `install-staging-artifact.sh` و `build-staging-artifact.sh` — persistence و بسته‌بندی.
- `apps/web/test/fixtures/tour-creation-staging-config.ts`، `tour-creation-closure-fixture.ts` و `apps/web/tests/e2e/tour-creation-closure.spec.ts` — محدودیت config فعلی و تست GET/PATCH موجود.
