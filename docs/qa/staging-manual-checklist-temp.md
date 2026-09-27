# چک‌لیست موقت QA Staging — تفکیک وضعیت

تاریخ: ۲۰۲۶-۰۹-۲۶

این فایل سه وضعیت کاملاً جدا دارد:

- بخش A: باگ قطعی و هنوز اصلاح‌نشده در source.
- بخش B: هنوز قطعی نشده؛ فقط باید توسط QA بررسی و نتیجه‌گذاری شود.
- بخش C: source اصلاح شده، اما بسته‌شدن staging هنوز نیازمند deploy و ریتست است.

هیچ موردی نباید هم‌زمان در دو بخش قرار بگیرد.

## A) باگ‌های قطعی باقی‌مانده برای اصلاح

فعلاً مورد source-confirmed و اصلاح‌نشده‌ای در این بخش باقی نمانده است؛ موارد اصلاح‌شده در بخش C و موارد نیازمند اثبات در بخش B هستند.

### PDP / PLP / Exposure

### ثبت‌نام و Waitlist

## B) مواردی که هنوز تأیید نشده و QA باید بررسی کند

### مالی و Free

- `BUG-STG-021` — duplicate guest برای بعضی حساب‌ها نادرست رد می‌شود؛ runner رسمی API (`pnpm --filter @apps/api run test:file -- test/denali-registration.spec.ts`) `۱۸/۱۸` پاس کرد و تست race واقعی Postgres (`pnpm --filter @apps/api run test:booking-guest-duplicate-http-race`) نیز پاس شد: دو POST هم‌زمان دقیقاً یک `201` و یک `409` دادند. اجرای مستقیم `tsx --test` قبلی معتبر نبود چون bootstrap تست را فعال نمی‌کرد و 401 کاذب می‌داد. Runtime فرم staging برای `QA-STG-20260924-PAID-AUTO` باز شد و مسیر افزودن مهمان را نشان داد، اما submit duplicate با payload/409 خام انجام نشد؛ بنابراین فقط runtime staging هنوز unconfirmed است و اصلاح source جدید لازم نیست.

شواهد اولیهٔ staging در همین sweep (هنوز closure نیست):

- مسیر مستقیم صحیح Portal یعنی `https://portal.denali.shenski.com/catalog/c3a3c778-99ab-4750-8dc6-3172fa5ce034/register` باز شد؛ برای حسابی که قبلاً self ثبت‌نام کرده، با افزودن مهمان فرم نام/موبایل مهمان را نشان داد و هیچ upload فیش یا اطلاعات پرداختی نشان نداد. **در sweep فعلی CTA PDP به host صحیح Portal اشاره می‌کند** و باید بعد از deploy همراه status API دوباره تطبیق داده شود؛ guard واقعی mapping `denali.shenski.com → portal.denali.shenski.com` در source وجود دارد و suite resolver `۱۰/۱۰` پاس است.
- `GET /health` هر سه host یعنی marketing، portal و admin با `200 {"ok":true}` پاسخ دادند؛ health فعلی SHA artifact را ارائه نمی‌کند، پس SHA واقعی deploy هنوز ثبت نشده است.

برای هر دو مورد ثبت شود: URL، registration ID، API response، screenshot و status receipt/registration به‌صورت جدا.

### ظرفیت و لیست عملیاتی

ظرفیت عمداً نمایش داده نمی‌شود؛ `BUG-STG-044` بررسی یا اصلاح نشود.

### Telegram و فایل

- source delivery worker، formatter و Telegram adapter بررسی شد؛ تست متمرکز فعلی `۳۷/۳۷` پاس است: fileKey تصویری به `sendPhoto`، PDF/Document به `sendDocument`، حفظ `message_thread_id`، fail-closed برای General، retry بدون send تکراری، retry topic stale و redaction فیلدهای غیرمجاز پوشش داده شده‌اند. این تست source است و جایگزین ارسال واقعی staging نیست.
- ارسال واقعی receipt تصویری
- ارسال واقعی PDF
- حفظ `message_thread_id`
- عدم ارسال به General
- عدم ارسال تکراری هنگام retry
- تطبیق `fileKey` با `sendPhoto` و `sendDocument`
- تطبیق labelهای رویداد در همه event typeهای واقعی

شاهد runtime فعلی Telegram/file: در Admin یک اتصال جدید Telegram فعال با گروه مقصد `-1004292581496` و توکن ذخیره‌شده تأیید شد؛ جزئیات اتصال نیز «تلگرام فعال است و پیام‌های مجاز می‌توانند به گروه مقصد ارسال شوند» را نشان داد. fixture با booking/registration ID `157aa162-5270-4556-a84e-6686988e78e4` وضعیت `در انتظار` و `پرداخت‌نشده` دارد و در Finance هیچ receipt دستی ثبت‌شده یا صف receipt قابل بررسی ندارد. برای همین ارسال واقعی photo/PDF، تطبیق `fileKey` و بررسی message/thread هنوز انجام‌پذیر نیست؛ ساخت receipt یا approve می‌تواند state و ارسال خارجی را تغییر دهد و باید با fixture receipt آماده و deploy با SHA مشخص انجام شود.

### گیت اجباری برای هر تست QA

- SHA واقعی artifact staging
- registration ID و receipt ID
- API قبل و بعد از approve/resubmit
- Portal detail و list
- Finance و Admin
- Waitlist
- screenshot و AX
- cache key و زمان revalidation
- status receipt و registration به‌صورت جداگانه

آخرین fingerprint read-only این sweep: هر سه host (`denali.shenski.com`، `portal.denali.shenski.com`، `admin.denali.shenski.com`) روی `/health` با `200` و `{"ok":true}` پاسخ دادند، اما header/body هیچ SHA artifact ارائه نکردند. SHA فعلی worktree `c215d739e704578e82d01343c00899a8d0ee4957` است و checkout `۹۸` تغییر dirty دارد؛ بنابراین این SHA را به staging نسبت نمی‌دهم. HTML staging برای free tour `c3a3c778-99ab-4750-8dc6-3172fa5ce034` هیچ‌کدام از markerهای `data-marketing-catalog-card-free` و `data-marketing-catalog-detail-free` را نداشت؛ artifact فعلی fix source را سرو نمی‌کند.

## C) source اصلاح‌شده؛ منتظر deploy و ریتست staging

- `BUG-STG-080` — ریشهٔ parity اصلاح شد: resolver booking detail اکنون همان marker `freeCollectionApplied=true` را که list برای `WAIVED` مصرف می‌کند، به `financialDisplayState=WAIVED` تبدیل می‌کند؛ در نتیجه status مالی detail دیگر از list عقب نمی‌ماند. تست runtime-binding برای `approved + paid + freeCollectionApplied` و تست projection هر دو سبز شدند. پس از deploy با SHA واقعی، API/list/detail Portal و نبود copy پرداخت باید با همان registration دوباره ثبت شود.

- `BUG-STG-040` — اصلاح شد: formatter receipt فقط وقتی note واقعی وجود دارد خط «توضیحات» را اضافه می‌کند؛ برای فایل بدون note هیچ متن جعلی تولید نمی‌شود. source فعلی و تست formatter برای متن، photo بدون note، document بدون note و فایل همراه توضیح بررسی شدند؛ ۱۳ تست pass، TypeScript، Prettier و `git diff --check` pass. delivery واقعی Telegram بعد از deploy با SHA جدید هنوز باید جداگانه retest شود.
- receipt flow پایه نیز با runner رسمی API (`pnpm --filter @apps/api run test:file -- test/p6-member-receipt-flow.spec.ts`) `۷/۷` پاس شد: وضعیت قبل از upload، upload pending، ممنوعیت upload برای booking pending، مالکیت عضو، approve و به‌روزرسانی projection لیست. اجرای مستقیم `tsx --test` قبلی به‌علت نبودن `NODE_ENV=test`/bootstrap با 401 کاذب شکست خورده بود.
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` — اصلاح شد: status card اصلی Portal اکنون client-side به event resubmit گوش می‌دهد و هم‌زمان با کارت receipt از rejected به pending می‌رود؛ `router.refresh()` برای sync server-authoritative باقی مانده است. suite متمرکز Portal/BFF/detail/lifecycle در این sweep `۲۶/۲۶` پاس شد. **Runtime staging:** فیلتر Admin با `status=rejected` هیچ رکوردی نداشت، بنابراین receipt rejected برای اجرای reject → resubmit و تأیید تغییر heading موجود نیست؛ بعد از deploy با SHA واقعی و fixture receipt ردشده retest شود.
- `BUG-STG-RECEIPT-STATUS-LABEL-MIXED` — اصلاح شد: badgeهای Portal اکنون صریحاً با «ثبت‌نام: ...» و «رسید: ...» جدا می‌شوند؛ برای receipt ردشده دیگر «تأیید شده» بدون صاحب کنار پیام اصلاح فیش نمایش داده نمی‌شود. suite متمرکز lifecycle/label در این sweep `۲۶/۲۶` پاس شد؛ runtime receipt rejected در staging fixture ندارد و بعد از deploy باید با screenshot/AX و API response بررسی شود.
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` — اصلاح شد: detail دیگر receipt تأییدشده را به‌تنهایی «پرداخت‌شده» فرض نمی‌کند و finality را از `paymentStatus`/`financialDisplayState` همان projection list می‌گیرد؛ receipt فقط pending/rejected بودن بررسی فیش را تعیین می‌کند. در این sweep Portal projection/label suite `۱۸/۱۸` و API Finance/booking/registration suite `۳۳/۳۳` پاس شدند. **Runtime staging هنوز fail است:** برای registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a`، Portal list متن «برای نهایی‌شدن، پرداخت باید تکمیل شود» دارد، اما detail همان ID «پرداخت شما تأیید شد» و «رسید: تأیید شده» نشان می‌دهد. پس از deploy SHA جدید، list/detail/Finance/API باید برای همین projection یک وضعیت paid یکسان نشان دهند.
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` — اصلاح شد: Finance approve به‌صورت اتمیک `paymentStatus=paid` و finalization را در booking projection ثبت می‌کند؛ Admin row/detail همان projection را مصرف می‌کنند، deadline برای paid حذف می‌شود و BFF لیست booking نیز پاسخ را صریحاً `private, no-store` برمی‌گرداند. در این sweep تست Admin deadline/BFF و follow-up action/cache/load/logic/row/state `۳۹/۳۹` پاس شد؛ تست API projection/payment/list نیز `۹` تست اجراشده را پاس کرد و فقط سناریوهای Finance وابسته به تنظیم خارج از این runner skip شدند. **Runtime staging هنوز fail است:** رکورد `f2144510-bc47-4d1f-b6ad-42002a6ac51a` با نام `QA Guest Discount 20260925` در Admin «پرداخت جزئی (رزرو)» و deadline `۴ مهر ۱۴۰۵` دارد، درحالی‌که Portal detail همان ID «پرداخت شما تأیید شد / رسید: تأیید شده» نشان می‌دهد. بعد از deploy SHA جدید باید Admin/API/Finance/Portal همگی paid، بدون deadline و بدون action unpaid باشند.
- `BUG-STG-EXPORT-SUMMARY` — اصلاح شد: summary خروجی Excel اکنون جمع‌های نهایی‌شده را با label صریح (`مبلغ کل/پرداخت‌شده/مانده نهایی‌شده`) نشان می‌دهد و مبلغ ماندهٔ `unpaidRows` را جداگانه با عنوان `مبلغ مانده بدهکار یا پرداخت ناقص` محاسبه می‌کند؛ تست workbook با fixture بدهکار `۵۰٬۰۰۰`، `۳/۳` pass. **Runtime staging:** Admin پیام «فایل Excel آماده و دانلود شد» را نشان داد و آخرین XLSX واقعی قابل‌خواندن بود؛ شیت `خلاصه گزارش` مقدار مبلغ کل/پرداخت‌شده نهایی `۵٬۰۰۰٬۰۰۰` و مانده `۰` را نشان داد، درحالی‌که بدهکارها در شیت `منتظر پرداخت` جدا بودند. این بخش pass است.
- `BUG-STG-014 / 015 / 016` — اصلاح شد: exporter برای `IRR` همان قرارداد UI را با label «تومان» استفاده می‌کند و برای currency خالی fallback یکنواخت دارد؛ `primary` را «حمل سازمان‌یافته» صادر می‌کند؛ و برای timestamp فاقد مقدار واقعی «تاریخ در دسترس نیست» می‌نویسد. تست workbook `۳/۳` پاس است. **Runtime staging هنوز fail جزئی دارد:** در آخرین XLSX واقعی، مبلغ‌ها با واحد `ریال` صادر شده‌اند، نه `تومان`؛ نوع حمل «حمل‌ونقل اصلی تور» و تاریخ نهایی‌شدن در ردیف‌های نهایی وجود داشتند. پس از deploy SHA جدید، واحد مبلغ باید با قرارداد UI/source به `تومان` اصلاح و دوباره از خود فایل بررسی شود.

### موارد قبلاً حل‌شده و نیازمند فقط ریتست staging

- `BUG-STG-008 / 013` — source fix و تست‌ها سبز هستند: Marketing policy/detail suite `۱۷/۱۷` و Denali egress/registration-policy suite `۱۶/۱۶`؛ egress کارت policyهای `paymentCollection` و `registrationApproval` را منتقل می‌کند و PDP از `startDateTime` استفاده می‌کند. **Runtime staging فعلی:** در Exposure جزئیات عمومی، «شروع برنامه» و «تور پولی» روشن‌اند ولی «نیاز به تأیید ادمین» خاموش است؛ پس نبودن approval برای fixture `QA-STG-20260924-PAID-AUTO` قابل نتیجه‌گیری به‌عنوان bug نیست. بااین‌حال در PDP همان fixture فقط تاریخ `۲۱ مهر ۱۴۰۵` دیده شد و روش پرداخت/ساعت شروع در AX نبود؛ این دو مورد بعد از deploy با SHA واقعی باید با API و Exposure روشن تطبیق داده شوند.
- `BUG-STG-025` — source contract در sweep فعلی همراه قرارداد PDP و display در مجموع `۳۹/۳۹` پاس است، اما **runtime staging فعلی fail است:** در PLP تور `c3a3c778-99ab-4750-8dc6-3172fa5ce034` هیچ label «رایگان / بدون نیاز به پرداخت» ندارد و در PDP همان تور نیز label پرداخت رایگان دیده نشد؛ کارت PLP فقط عنوان/مشخصات را نشان داد و PDP نیز rail پرداخت نداشت. بعد از deploy با SHA واقعی باید label در هر دو سطح برای free و برای paid غایب باشد.
- `BUG-STG-026 / 027` — source filter/sort در همین sweep همراه display/query/contract در مجموع `۳۹/۳۹` پاس است، اما **runtime staging فعلی fail است:** با `minPrice=0` URL به `/tours?minPrice=0` رفت ولی نتیجه `۱۳ مورد` شد و fixture رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در نتایج نبود؛ بنابراین sort کم‌به‌زیاد/زیادبه‌کم نیز فعلاً شامل free نیست و قابل قبول نیست. بعد از deploy باید free به‌عنوان قیمت `۰` در filter و هر دو sort وارد شود.
- `BUG-STG-024` — source format test سبز است و runtime staging فعلی نیز پاس شد: PLP و PDP تور `QA-STG-20260924-PAID-AUTO` مبلغ `۲٬۵۰۰٬۰۰۰ تومان` را نشان دادند؛ `IRR` خام در UI دیده نشد. برای closure نهایی، API response با همان fixture و SHA واقعی deploy همچنان باید ثبت شود.
- `BUG-STG-082` — source fix و focused transport/policy tests `۷/۷` پاس است، اما **runtime staging فعلی هنوز fail است:** در کارت PLP تور `ec171184-1877-4501-9a92-857f712838e2` نوع حمل «خودروهای مشترک» دیده شد ولی مبلغ دُنگ در کارت نمایش داده نشد؛ PDP همان session مبلغ دُنگ `۳۰۰٬۰۰۰ تومان` را نشان داد. بعد از deploy با SHA واقعی باید مبلغ دُنگ در PLP و PDP با API یکسان دیده شود.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` — اصلاح شد: labelهای eventهای Telegram در namespace فارسی Admin برای TourCreated/TourPublished/Registration/Receipt تعریف شده‌اند؛ تست label، delivery-template و Exposure UI در این sweep `۱۲/۱۲` پاس شد. **CI root cause تکمیلی:** کلیدهای dotted مثل `registration.approved` و `receipt.rejected` در JSON locale به‌صورت leaf تعریف شده بودند و `next-intl` صفحهٔ operator را با `INVALID_KEY` می‌شکست؛ این کلیدها اکنون به‌صورت nested message tree تعریف شده‌اند و contract test، lint و build Web سبز هستند. **Runtime staging هنوز fail است:** در `admin.denali.shenski.com/settings/exposure` نام‌هایی مثل `Member registered`، `Receipt approved/rejected/submitted` و `Registration approved/created/waitlisted` به انگلیسی دیده شد؛ این نشان می‌دهد artifact فعلی staging fix را ندارد. بعد از deploy با SHA واقعی همان صفحه را retest کن؛ متن انگلیسی یا key خام نباید نمایش داده شود.
- `BUG-STG-039 / 072` — اصلاح شد: متن وضعیت و لغو از registration status و payment projection جداگانه خوانده می‌شود؛ `approved + unpaid` دیگر متن پرداخت‌شده یا لغو نادرست نمی‌گیرد. suite متمرکز Portal/receipt lifecycle در این sweep `۲۶/۲۶` پاس شد. **Runtime فعلی:** registration `98202973-9d76-43c2-99ab-46d8cb06c30e` در حالت approved+paid دو label مستقل «ثبت‌نام: تأیید شده» و «رسید: تأیید شده» و متن لغو مخصوص پرداخت‌شده دارد. در Admin نیز fixture `QA Matrix Auto Guest 20260925` approved+unpaid با بدهی `۲٬۵۰۰٬۰۰۰ تومان`، deadline و بدون receipt upload دیده شد؛ برای closure Portal هنوز لینک/شناسه همین fixture و receipt pending لازم است.
- `BUG-STG-081` — اصلاح شد: preview قیمت عضو بین PLP و PDP مشترک شد و در خطای preview دیگر fallback خاموش به قیمت پایه وجود ندارد؛ تست focused فعلی Marketing `۹/۹` پاس شد و قراردادهای free/policy همان suite نیز سبز هستند. **Runtime staging هنوز fail است:** برای تور `ec171184-1877-4501-9a92-857f712838e2` در همان session، PLP قیمت `۲٬۰۰۰٬۰۰۰ تومان` نشان داد اما PDP تخفیف عضویت `۵۰٪` و «قیمت برای شما» `۱٬۰۰۰٬۰۰۰ تومان` نشان داد. بعد از deploy با SHA واقعی باید PLP هم `۱٬۰۰۰٬۰۰۰ تومان` را نشان دهد و با PDP/sticky/API یکسان شود.
- `BUG-STG-036` — اصلاح شد: Wizard دیگر نمی‌تواند فیلد خارج از deliverable/redaction-safe را وارد Exposure کند؛ redaction مرکب participant/payment/location، تصویر/structured data، زمان بازگشت و ظرفیت مشتق تست شد. suite focused Denali Exposure/Egress/Localization/PR-D در این sweep `۱۸/۱۸` پاس شد؛ staging read-only فعلی فقط تنظیمات exposure را نشان داد و برای اثبات hidden-field redaction نیاز به تغییر تنظیم و deploy SHA جدید دارد.
- `BUG-STG-019` — اصلاح شد: مخفی‌سازی payment، `paymentPlan`/درصد پیش‌پرداخت، `paymentCollection`، `registrationApproval`، بیمه و مبلغ پایه را از کارت عمومی حذف می‌کند؛ suite focused همراه redaction در این sweep `۱۸/۱۸` پاس شد. runtime با تنظیم فعلی که «تور پولی» را فعال دارد قابل closure نیست؛ برای retest باید همان فیلدها عمداً hidden شوند و API/PLP/PDP مقایسه شوند.
- `BUG-STG-006` — اصلاح شد و مسیر visible روی staging فعلی پاس شد: تور `ec171184-1877-4501-9a92-857f712838e2` در PLP mode «خودروهای مشترک» را نشان داد؛ PDP همان mode، هزینه حمل و دُنگ `۳۰۰٬۰۰۰ تومان` را نشان داد. تست صریح visible/hidden transport و suite Exposure پاس است. **باقی‌مانده:** با خاموش‌کردن `denali.transport-mode` در Exposure، حذف کامل mode/هزینه/دُنگ از PLP و PDP با SHA واقعی deploy دوباره تأیید شود.
- `BUG-STG-035` — source fix و تست instant/formatter با مقایسهٔ Tehran و UTC سبز است؛ Portal display suite `۴/۴` و Marketing display/detail suite `۲۴/۲۴` پاس شدند. **Runtime evidence فعلی:** Portal برای registration `98202973-9d76-43c2-99ab-46d8cb06c30e` زمان حرکت `۲۱ مهر ۱۴۰۵، ۶:۳۰` را نمایش داد؛ این با `Asia/Tehran` سازگار است. برای closure هنوز raw API/Admin instant و SHA واقعی deploy باید با همین نمایش تطبیق داده شود.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` — اصلاح شد: توضیح `denali.location-zones` از namespace فارسی Denali ترجمه می‌شود و متن انگلیسی registry مستقیماً در UI نمایش داده نمی‌شود؛ تست package localization/exposure `۱۳/۱۳` و تست host Web localization/Telegram labels `۵/۵` پاس شدند. **Runtime staging هنوز fail است:** در `settings/exposure` و سطح «جزئیات کاتالوگ عمومی»، فیلد فعال «نقطه شروع» description خام `Start, summit, camp and end location zones.` را نشان می‌دهد. بعد از deploy با SHA واقعی باید همین description فارسی شود.
- `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` — اصلاح شد: `registrationState: "waitlist"` از detail API به Portal flow و فرم Denali منتقل می‌شود؛ فرم ظرفیت‌پر پیام صریح لیست انتظار و دکمهٔ «ثبت درخواست لیست انتظار» دارد و CTA PDP نیز `عضویت در لیست انتظار` را نگه می‌دارد. supporting batch فعلی Portal `۱۸/۱۸`، Marketing `۱۷/۱۷` و Denali `۱۰/۱۰` پاس شد. در staging، PDP تور North Ridge مقدار `۰ جای خالی` را نشان داد اما همان session قبلاً ثبت‌نام‌شده بود و فقط «مشاهده ثبت‌نام من» داشت؛ فرم مهمان/CTA مستقل با این session قابل اثبات نیست، بنابراین نتیجه runtime هنوز تأییدنشده و به session مهمان نیاز دارد.
- `BUG-STG-064 / 065` — اصلاح شد: API/BFF status نهایی (`pending`/`approved`/`waitlisted`) را عبور می‌دهد؛ Portal بر اساس status واقعی پیام مخصوص Waitlist نشان می‌دهد و بنر Admin رفتار واقعی ثبت‌نام عمومی را توضیح می‌دهد. supporting batch فعلی Portal `۱۸/۱۸`، Denali `۱۰/۱۰` و Web `۴۷/۴۷` پاس شد؛ lint/Prettier و `git diff --check` نیز سبز هستند. Runtime read-only Admin نیز پاس شد: North Ridge با ظرفیت `۱۲/۱۲`، banner «صف ظرفیت — تأیید پس از آزاد شدن جا»، متن «مهمانانی که ظرفیت پر است — با تأیید به ثبت‌نام تأییدشده منتقل می‌شوند» و ۸ ردیف با label «در لیست انتظار» نمایش داده شد. صفحه موفقیت Portal و status پاسخِ یک ثبت‌نام جدید هنوز به session مهمان و اجرای mutation نیاز دارد.
- `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` — اصلاح شد: renderer لیست عملیاتی `registrationStatus=waitlisted` را با label مستقل «در لیست انتظار / Waitlisted» نشان می‌دهد، آن ردیف را approved/final فرض نمی‌کند و action نهایی‌سازی را پنهان می‌کند. تست contract عملیاتی و Web `۴۷/۴۷`، lint، Prettier و `git diff --check` پاس شدند. در staging، فیلتر `لیست انتظار` روی North Ridge هشت ردیف را نشان داد؛ همه با وضعیت حضور «تأییدشده»، نکته «هنوز شرکت‌کننده نهایی نیست» و بدون action نهایی‌سازی نمایش داده شدند. نتیجه runtime: پاس مشروط به deploy شدن SHA جدید.
- `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` — اصلاح شد: fetch لیست PLP و detail PDP هر دو برای `registrationState`/`spotsRemaining` با `cache: "no-store"` انجام می‌شوند و cache مستقل با عمر متفاوت ندارند. supporting batch فعلی Marketing `۱۷/۱۷` و Portal `۱۸/۱۸` پاس شد؛ پس از deploy با SHA جدید، بعد از ثبت Waitlist و سپس آزادشدن ظرفیت، PLP و PDP را هم‌زمان با API response مقایسه کن؛ state باید یکسان باشد.
- `BUG-STG-037` — اصلاح شد: badge تب Transport اکنون از شمارش واقعی `filter=operational` می‌آید؛ KPI «نهایی‌شده» همچنان جداگانه از `filter=final` نمایش داده می‌شود، پس ردیف‌های approved/unpaid در لیست عملیاتی از شمارنده جا نمی‌مانند. تست contract شمارنده/فیلتر و workspace در مجموع `۵۳/۵۳` پاس شدند؛ lint/tsc Web، Prettier و `git diff --check` نیز پاس شدند. **Runtime staging فعلی fail است:** North Ridge در header/tab مقدار `لیست عملیاتی ۳` دارد، اما پس از حذف فیلتر Waitlist، جدول همان صفحه ۱۲ ردیف operational (۳ نهایی + ۹ تأییدشده/پرداخت‌نشده) نشان می‌دهد؛ بنابراین شمارنده و جدول هم‌خوان نیستند. بعد از deploy با SHA واقعی و API response باید badge برابر تعداد واقعی operational و KPI نهایی جداگانه باشد.
- `BUG-STG-022` — اصلاح شد: pricing preview برای هر participant با ترکیب `registrantTarget + transportKind` مستقل درخواست و نگهداری می‌شود؛ API فقط برای participant خودِ عضو (`self`) تخفیف membership اعمال می‌کند و مهمان (`other`) بدون تخفیف محاسبه می‌شود؛ مبلغ پایه، تخفیف، حمل/دُنگ و payable هر participant جداگانه رندر می‌شوند. در این sweep تست‌های API ثبت‌نام `۱۸/۱۸`، Portal pricing/registration `۱۷/۱۷` و Denali transport/settlement `۲۴/۲۴` پاس شدند. پس از deploy با SHA جدید، تور تخفیف‌دار را با self تخفیف‌دار + مهمان بدون تخفیف و تور بدون تخفیف را با هر دو participant retest کن؛ این بخش هنوز runtime staging closure ندارد.
- `BUG-STG-063` — اصلاح شد: promotion صف اکنون داخل همان approve transaction ظرفیت canonical تور و `partySize` کامل candidate را با policy workspace بررسی می‌کند؛ گروهی که در صندلی آزاد جا نشود `waitlisted` می‌ماند و hold/quote برای آن ساخته نمی‌شود. تست رسمی API همراه approve/hold و capacity، `۵/۵` پاس شد؛ سناریوی عادی promotion، over-capacity و idempotent approve پوشش داده شدند. اجرای staging هنوز نیازمند سناریوی واقعی آزادشدن یک صندلی برای گروه چندنفره است؛ بدون انجام approve/release روی داده staging آن را بسته اعلام نمی‌کنم.
- `BUG-STG-063` — اصلاح شد: promotion صف اکنون داخل همان approve transaction ظرفیت canonical تور و `partySize` کامل candidate را با policy workspace بررسی می‌کند؛ گروهی که در صندلی آزاد جا نشود `waitlisted` می‌ماند و hold/quote برای آن ساخته نمی‌شود. تست DP1 waitlist/idempotency `۴/۴` و تست رسمی PostgreSQL capacity `۶/۶` پاس شدند؛ lock، parallel approve، bulk approve، cancel+approve و گروه بزرگ‌تر از ظرفیت پوشش داده شدند. اجرای staging هنوز نیازمند سناریوی واقعی آزادشدن یک صندلی برای گروه چندنفره است؛ بدون انجام approve/release روی داده staging آن را بسته اعلام نمی‌کنم.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` — اصلاح شد: Portal برای `paymentCollection === "free"`، پس از عبور از وضعیت pending/waitlisted، دیگر به فرم upload فیش، مقصد پرداخت یا دکمهٔ ارسال نمی‌رسد و کارت «نیازی به پرداخت نیست» نمایش می‌دهد؛ suite متمرکز Portal/BFF/deadline در این sweep `۲۸/۲۸` پاس شد. پس از deploy با SHA جدید، یک free registration در وضعیت approved و یک free pending را با API response، Portal detail و screenshot/AX بررسی کن؛ pending باید فقط پیام انتظار مناسب free را داشته باشد و هیچ upload/payment control نداشته باشد.
- `BUG-STG-080` — source fix برقرار است: علاوه بر حذف مسیر receipt upload برای `paymentCollection === "free"`، status resolver نیز برای free approved مستقل از projection ناسازگار `paid/unpaid` کارت «بدون نیاز به پرداخت» را برمی‌گرداند؛ تست resolver، Portal registration، receipt BFF و deadline contract در این sweep `۲۸/۲۸` پاس شد. **Runtime staging fail است:** free registration `4190860a-9948-4c62-b29b-85d3e494e765` در detail هنوز «پرداخت شما تأیید شد» و «رسید: تأیید شده» و در Portal list نیز «برای نهایی‌شدن، پرداخت لازم است» نشان می‌دهد؛ در همان list، free fixtureهای دیگر متن درست «پرداخت لازم نیست» دارند. بعد از deploy با SHA واقعی، free approved/pending باید در list و detail بدون payment status، مبلغ، مقصد کارت‌به‌کارت یا upload نمایش داده شود.

## Follow-up runtime verification — ۲۰۲۶-۰۹-۲۷

با وجود باز بودن PR و نبودن deploy از SHA اصلاحی، چهار مورد روی artifact فعلی staging دوباره مشاهده شدند:

- `BUG-STG-025`: PDP `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در AX هیچ label «رایگان/بدون نیاز به پرداخت» ندارد و در بخش «پیش از ثبت‌نام» هنوز «روش پرداخت: رسید / پرداخت آفلاین» دیده می‌شود.
- `BUG-STG-026/027`: آدرس `/tours?minPrice=0&sort=price_asc` تعداد `۱۳ مورد` نشان می‌دهد، اما تور رایگان `QA-STG-20260924-FREE-MANUAL` در نتایج نیست.
- `BUG-STG-081/082`: PDP تور `ec171184-1877-4501-9a92-857f712838e2` قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و دُنگ `۳۰۰٬۰۰۰ تومان` را نشان می‌دهد؛ کارت PLP همان تور «قیمت برای این عضو در دسترس نیست» دارد و مبلغ دُنگ ندارد.
- `BUG-STG-080`: Portal detail ثبت‌نام رایگان `4190860a-9948-4c62-b29b-85d3e494e765` هنوز متن ارسال رسید و وضعیت‌های پرداخت/رسید تأییدشده را نمایش می‌دهد.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: در صفحه فارسی Admin نام eventهای `Member registered`، `Receipt approved/rejected/submitted` و `Registration approved/created/waitlisted` هنوز انگلیسی است.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: در فهرست فیلدهای «جزئیات کاتالوگ عمومی»، description فیلد «نقطه شروع» هنوز `Start, summit, camp and end location zones.` است.
- `BUG-STG-035`: Portal ثبت‌نام `98202973-9d76-43c2-99ab-46d8cb06c30e` زمان حرکت `۲۱ مهر ۱۴۰۵، ۸:۰۰` را نشان می‌دهد که با timezone تهران سازگار است؛ raw API/Admin و SHA واقعی deploy برای closure نهایی هنوز لازم است.
- `BUG-STG-037` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`: در Admin، فیلتر «در لیست انتظار» مقدار `۸` و جدول `۸ از ۸` دارد و هر ردیف label «در لیست انتظار» و ظرفیت `۱۲/۱۲` دارد؛ حالت «نیازمند اقدام» `۱۲` ردیف دارد که شامل ۸ waitlist و ۴ pending است. این صفحه internally consistent است، اما fixture قبلیِ اختلاف «لیست عملیاتی ۳» و ۱۲ ردیف دوباره بازتولید نشد؛ closure نهایی به SHA واقعی و همان fixture نیاز دارد.
- گیت fingerprint: هر دو `denali.shenski.com/health` و `portal.denali.shenski.com/health` با `200 {"ok":true}` پاسخ دادند، اما header/body هیچ SHA artifactی ارائه نمی‌کند. HTML فقط hashهای Next static مانند `page-f8664cc272dd6ac5.js` دارد؛ این hashها به‌تنهایی به commit قابل انتساب نیستند، پس `staging artifact SHA = UNKNOWN` باقی می‌ماند.
- GitHub deploy evidence: آخرین اجرای موفق workflow `Deploy staging (dev)` با run `36273529557` روی SHA `a37f38cd89576b17b07808c45279788eab63b3a1` است؛ head فعلی PR #211 و commit‌های بعدی روی staging deploy نشده‌اند. بنابراین failureهای runtime این دور به artifact قدیمی نسبت داده می‌شوند، نه به source head فعلی.
- cache control follow-up: responseهای PDP رایگان، PDP تخفیف‌دار و PLP همگی `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` دارند؛ بااین‌حال HTML/AX همان fixtureها هنوز خروجی قدیمی را render می‌کند. بنابراین mismatch فعلی از cache key/revalidation نیست و به artifact deployنشده نسبت داده می‌شود.
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` و Telegram واقعی: تب «رسیدها» در `admin.denali.shenski.com/finance?tab=receipts` باز شد، اما صف «صف بررسی فیش» هیچ ردیف receipt ندارد؛ fixture rejected/pending برای اجرای reject→resubmit، تطبیق `fileKey` و ارسال واقعی photo/PDF موجود نیست. ساخت receipt یا تغییر وضعیت در staging انجام نشد.
- source retest این دسته با runner رسمی سبز است: Portal lifecycle/status `۱۸/۱۸`، API receipt flow `۷/۷` و Telegram API/adapter/worker/topic/retry/file routing `۵۰/۵۰`. در receipt flow فقط هشدار محیطی `MINIO_NOT_CONFIGURED` ثبت شد؛ بنابراین این نتایج قرارداد/source هستند و جایگزین ارسال واقعی فایل روی staging نمی‌شوند.
- source retest PDP/فرم نیز سبز است: Marketing policy/preview `۱۲/۱۲`، Portal registration/pricing/waitlist `۱۱/۱۱` و API registration matrix `۱۸/۱۸`. این نتایج `BUG-STG-008/013` و `BUG-STG-022` را در source پوشش می‌دهند؛ مقایسهٔ دو حساب واقعی روی staging بعد از deploy هنوز لازم است.

این چهار مشاهده، failure runtime artifact فعلی هستند و تا deploy شدن SHA اصلاحی به‌عنوان failure source جدید تفسیر نمی‌شوند؛ پس از deploy باید با API response، SHA واقعی و screenshot/AX دوباره بسته شوند.

## Retest بعد از deploy واقعی `a37f38cd89576b17b07808c45279788eab63b3a1`

- Artifact: `app-tour-staging-a37f38cd89576b17b07808c45279788eab63b3a1.tar.zst`; digest: `7245def80b7ff8fdf253aee2fd2824d50e96ef8cf57e7d2732862fe55520d198`; health هر سه host با `200` پاس شد.
- `BUG-STG-025`: **FAIL runtime**. PDP رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در AX هیچ `رایگان`/`بدون نیاز به پرداخت`/`۰ تومان` ندارد؛ بخش قبل از ثبت‌نام هنوز `روش پرداخت: رسید / پرداخت آفلاین` را نشان می‌دهد. PLP همان fixture نیز label رایگان ندارد.
- `BUG-STG-026`: **FAIL runtime**. `https://denali.shenski.com/tours?maxPrice=0` مقدار `۰ مورد در این صفحه` و پیام نبود تور دارد، درحالی‌که fixture رایگان منتشر و قابل ثبت‌نام است.
- `BUG-STG-027`: **FAIL runtime**. `https://denali.shenski.com/tours?minPrice=0&sort=price_asc` مقدار `۱۳ مورد` دارد و fixture رایگان در نتایج نیست؛ sort قیمت صعودی آن را به‌عنوان قیمت صفر وارد نکرده است.
- `BUG-STG-081`: **FAIL runtime**. در PDP `ec171184-1877-4501-9a92-857f712838e2` همان نشست عضو، قیمت پایه `۲٬۰۰۰٬۰۰۰`، تخفیف `۵۰٪` و قیمت نهایی `۱٬۰۰۰٬۰۰۰ تومان` است؛ کارت PLP همان تور `قیمت برای این عضو در دسترس نیست` نشان می‌دهد.
- `BUG-STG-082`: **FAIL runtime**. PDP همان تور `خودروهای مشترک` و `هزینه دونگی ۳۰۰٬۰۰۰ تومان` دارد؛ کارت PLP نوع حمل را نشان می‌دهد اما مبلغ دُنگ را ندارد.
- `BUG-STG-080`: **FAIL runtime**. Portal detail رکورد رایگان `4190860a-9948-4c62-b29b-85d3e494e765` هنوز `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید`، `پرداخت تأیید شد` و `رسید شما تأیید شد` را نشان می‌دهد.

موارد `BUG-STG-001`، `BUG-STG-067` و `OBS-STG-FINANCE-BUSINESS-MEANING-ROLLOUT` نیز فعلاً باگ قطعی نیستند.

## Source verification after remediation — ۲۰۲۶-۰۹-۲۷

در HEAD فعلی branch اصلاحی، ریشه‌های source برای failureهای runtime دوباره‌دیده‌شده پوشش داده شدند؛ اجرای artifact قدیمی staging هنوز معیار closure نیست:

- Marketing catalog/display/pricing/filter/sort contract: `۳۷/۳۷` پاس.
- Portal pricing/receipt/status contract: `۲۴/۲۴` پاس.
- API registration و receipt flow رسمی: `۲۵/۲۵` پاس.
- کل suite workspace Denali: `۸۳۴/۸۳۴` پاس.

نتیجهٔ تفکیکی source:

- `BUG-STG-025/026/027`: free marker در PLP/PDP و قیمت صفر در filter/sort در source پوشش دارند.
- `BUG-STG-080`: free collection از canonical `paymentCollection` و legacy `requiresPayment=false` resolve می‌شود و مسیر receipt/payment برای free بسته است.
- `BUG-STG-081/082`: preview قیمت authoritative عضو و ancillary transport/dong برای list/detail از API خوانده می‌شوند و تست parity دارند.
- labelهای Telegram و description فارسی location-zones در source و contractها اصلاح شده‌اند.

پس از این اجرای source، باگ قطعی جدیدی برای patch باقی نماند. موارد runtime بالا فقط پس از deploy همین HEAD با SHA واقعی staging باید دوباره بررسی و بسته شوند؛ health بدون SHA و hash فایل‌های Next برای closure کافی نیستند. فایل نامرتبط `docs/phase-19/architecture-truth-drift-report.json` عمداً تغییر داده نشد.

## Continuation read-only sweep — ۲۰۲۶-۰۹-۲۷

برای ادامهٔ بررسی مستقل از deploy، HTML و header خام staging دوباره خوانده شد:

- PDP رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` با `HTTP 200`، `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` پاسخ داد، اما register preview هنوز `روش پرداخت: رسید / پرداخت آفلاین` و `تأیید ثبت‌نام: دستی` دارد؛ marker رایگان اصلاح‌شده در خروجی واقعی detail دیده نشد.
- PLP با `/tours?minPrice=0&sort=price_asc` نیز `HTTP 200` و `x-cache: BYPASS` داد، اما هنوز `۱۳ مورد در این صفحه` دارد و fixture رایگان در grid خروجی نبود.
- `/health` با `HTTP 200` پاسخ داد اما SHA artifact را ارائه نکرد.
- آخرین workflow deploy staging همچنان run `36273529557` روی SHA `a37f38cd89576b17b07808c45279788eab63b3a1` است؛ PR head `e8a15c965e4bf619e7776b5cdc0de00b919f0595` deploy نشده است.

نتیجه: sweep read-only ادامه یافت و failure فعلی دوباره ثبت شد؛ این failure همچنان به artifact قدیمی نسبت داده می‌شود، نه به source HEAD اصلاحی. ریتست با SHA اصلاحی بعد از deploy باقی است.

## CI stale-run follow-up — ۲۰۲۶-۰۹-۲۷

- runهای PR روی HEAD `49fa7c14dc22bffedc1e33a22904f5477db84043` از `۲۳:۱۳` در stepهای build بدون تغییر مانده‌اند؛ checkهای پاس‌شده جداگانه سبز هستند و failure source ثبت نشده است.
- تلاش برای cancel همان runها با GitHub API به `403 Resource not accessible by personal access token` خورد.
- تلاش برای rerun همان runها نیز با پیام `workflow file may be broken` پذیرفته نشد.
- این مورد CI/permission است و به source bug یا staging artifact نسبت داده نمی‌شود. پس از اجرای تازهٔ workflowها، نتیجهٔ هر check باید دوباره ثبت شود.

## Current-SHA read-only retest — ۲۰۲۶-۰۹-۲۷

- Deploy gate: run `36293581001` سبز؛ artifact `app-tour-staging-24efe34c4a5f484d45a3e4bd7407250cec9f3cb5.tar.zst`; release SHA `24efe34c4a5f484d45a3e4bd7407250cec9f3cb5`; digest `9e3a6bf15597edb20f682603b21beeebe403a1c80a6782dc2363dfcfea99cd72`; remote log `INSTALL_ARTIFACT_OK`، health چهار سرویس، P10 و adapter سبز. `health` عمومی `HTTP 200` و PDP/PLP با `x-cache: BYPASS` پاسخ دادند؛ PDP `no-store` و PLP `s-maxage=60, stale-while-revalidate=60` داشت.
- `BUG-STG-008/013`: **PASS read-only current SHA**. PDP `00000000-0000-4000-8000-000000000220` در AX روش پرداخت «رسید / پرداخت آفلاین»، تأیید «دستی» و ساعت شروع `۳ مهر ۱۴۰۵، ۱۰:۰۰` را نشان داد.
- `BUG-STG-025/026/027`: **PASS read-only current SHA**. PDP و PLP fixture رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` label `رایگان / بدون نیاز به پرداخت` دارند؛ با اعمال واقعی حداقل قیمت `۰` و sort «قیمت (کم به زیاد)»، URL `?minPrice=0&sort=price_asc` شد، تعداد `۱۵` و fixture رایگان در نتایج بود و دو تور رایگان ابتدای فهرست قرار گرفتند.
- `BUG-STG-081/082`: **PASS جزئی read-only current SHA**. PDP عضو برای `ec171184-1877-4501-9a92-857f712838e2` قیمت پایه `۲٬۰۰۰٬۰۰۰`، تخفیف `۵۰٪`، قیمت نهایی `۱٬۰۰۰٬۰۰۰ تومان` و دُنگ `۳۰۰٬۰۰۰ تومان` را نشان می‌دهد؛ PLP همان تور کارت قیمت `۲٬۰۰۰٬۰۰۰` و `۱٬۰۰۰٬۰۰۰` و برچسب تخفیف را نشان می‌دهد. مبلغ دُنگ در AX کارت PLP به‌صورت مستقل دیده نشد و برای closure کامل هنوز screenshot/DOM detail لازم است.
- `BUG-STG-022`: **PASS read-only boundary current SHA**. در فرم همان تور، عضو قیمت `۱٬۰۰۰٬۰۰۰` می‌گیرد و با افزودن ردیف مهمان، قیمت مهمان `۲٬۰۰۰٬۰۰۰ تومان` نمایش داده شد؛ درخواست ثبت ارسال نشد.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` و `BUG-STG-080`: **PASS read-only boundary current SHA**. فرم free هیچ مبلغ، upload فیش، مقصد پرداخت یا کنترل پرداختی ندارد و دکمهٔ ثبت تا تغییر فرم disabled است؛ ثبت/تغییر وضعیت واقعی انجام نشد.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: **FAIL confirmed current SHA**. در `admin.denali.shenski.com/settings/exposure` با locale فارسی، `Member registered`، `Receipt submitted`، `Registration created` و eventهای `Ticket ...` هنوز انگلیسی render شدند. ریشهٔ فعلی: lookup با eventType دارای فاصله به‌جای locale key پایدار؛ اصلاح در PR #215 انجام شد و deploy/retest همان PR باقی است.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: **UNCONFIRMED current SHA**. صفحهٔ Exposure و سطح «جزئیات کاتالوگ عمومی» باز شد، اما با تنظیم پیش‌فرض فیلدهای registry قابل مشاهده نبودند؛ تغییر تنظیم ذخیره نشد. برای اثبات نهایی باید با fixture تنظیم‌شده یا snapshot فیلدهای فعال بررسی شود.
- ثبت‌نام واقعی مهمان، approve/reject/resubmit رسید، ارسال واقعی Telegram image/PDF، حفظ `message_thread_id`، عدم General، retry بدون duplicate، export/Excel و projectionهای post-approve هنوز mutation/دادهٔ واقعی می‌خواهند؛ بدون اجرای side effect به‌عنوان pass یا fail بسته نشدند.

## Continuation source/runtime sweep — ۲۰۲۶-۰۹-۲۷

- `BUG-STG-025`: **PASS read-only فعلی**. PDP تور رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` عبارت `رایگان / بدون نیاز به پرداخت` و نبود کنترل پرداخت را نشان داد؛ PLP نیز همین label را نشان داد.
- `BUG-STG-026/027`: **PASS read-only فعلی**. `?minPrice=0&sort=price_asc` تعداد `۱۵` مورد داشت و دو تور رایگان ابتدای فهرست بودند؛ `?minPrice=0&sort=price_desc` نیز هر دو تور رایگان را در انتهای فهرست نگه داشت.
- `BUG-STG-081`: **FAIL قطعی و order-dependent فعلی**. PDP تور `ec171184-1877-4501-9a92-857f712838e2` قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` را نشان داد. در PLP با `sort=price_desc` همین قیمت نمایش داده شد، اما با `sort=price_asc` فقط قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان` نمایش داده شد.
- `BUG-STG-082`: **FAIL/باز فعلی**. PDP همان تور دُنگ `۳۰۰٬۰۰۰ تومان` را نشان داد، اما مقدار دُنگ در کارت PLP در AX دیده نشد.
- `BUG-STG-080`: **FAIL قطعی فعلی**. Detail ثبت‌نام رایگان `4190860a-9948-4c62-b29b-85d3e494e765` درست و بدون پرداخت است، اما همان registration در Portal list هنوز `برای نهایی‌شدن، پرداخت لازم است` دارد؛ list و detail هم‌قرارداد نیستند.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: **FAIL قطعی فعلی**. صفحهٔ فارسی Admin هنوز `Member registered`، `Receipt submitted`، `Registration created` و eventهای Ticket را انگلیسی render می‌کند.
- `BUG-STG-037` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`: **PASS read-only فعلی در Admin**. صف `نیازمند اقدام` مقدار `۱۲` و فیلتر `در لیست انتظار` مقدار `۸` دارد؛ همهٔ ردیف‌های waitlist label `در لیست انتظار` و ظرفیت `۱۲/۱۲` دارند. approve/promotion واقعی اجرا نشد.
- receipt موجود قابل بررسی شد: booking/registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147`، receipt `b1f05b8f-bbdd-47fb-8191-5a414273e74b`، فایل PNG با `fileKey` موجود و لینک فایل با عنوان `file (1672×941)` باز شد. reject→resubmit، PDF و ارسال واقعی Telegram هنوز اجرا نشدند.
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`: **FAIL قطعی فعلی**. Portal detail برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هم‌زمان «رسید تأیید شده» و «رسید پرداخت را ارسال کنید» دارد؛ Portal list همان رکورد را «پرداخت باید تکمیل شود» نشان می‌دهد.
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: **FAIL قطعی فعلی**. Admin همان booking را «پرداخت جزئی (رزرو)»، با deadline و «پیگیری پرداخت» نشان می‌دهد؛ با detail Portal هم‌خوان نیست.
- فرم مهمان Waitlist، approve/reject/resubmit receipt، ارسال واقعی Telegram و Excel/projectionهای post-approve هنوز کامل اجرا نشدند؛ session فعلی قبلاً برای خود ثبت‌نام دارد و اجرای mutationها side effect ایجاد می‌کند.

### اصلاحات source این دور

- مسیر قیمت رایگان اصلاح شد تا `pricing.unavailable` برای تور `paymentCollection=free` نمایش داده نشود؛ label رایگان تنها پیام مالی کارت/جزئیات می‌ماند.
- batch endpoint قیمت عضو با `settleWithConcurrency(..., 4)` محدود شد تا resolve هم‌زمان ۱۵ تا ۵۰ تور باعث از دست‌رفتن order-dependent preview نشود؛ fallback حدسی در UI اضافه نشد.
- تست Marketing pricing: `۷/۷`، تست API pricing route: `۸/۸`، typecheck هر دو package و `git diff --check` پاس شدند.

این اصلاحات هنوز commit، PR یا deploy نشده‌اند؛ بنابراین سه failure فعلی staging (`081`، `082` و `080`) تا بعد از deploy همین source و ریتست با SHA واقعی باز می‌مانند.

## Continuation read-only sweep — ۲۰۲۶-۰۹-۲۷ (بدون mutation)

- `North Ridge Trek` با شناسهٔ تور `00000000-0000-4000-8000-000000000220` به‌صورت read-only بررسی شد. Admin صف Waitlist مقدار `۸` دارد؛ هر ردیف label «در لیست انتظار»، ظرفیت `۱۲/۱۲` و وضعیت جدا از approved/final دارد. `BUG-STG-037` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در این مرز pass هستند؛ promotion اجرا نشد.
- فرم Portal همین تور ظرفیت‌پر، با session موجودِ عضو، پیام «قبلاً برای خودتان ثبت‌نام کرده‌اید» و امکان «افزودن همراه» را نشان داد. چون submit واقعی و ایجاد guest mutation است، `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` با حساب تازه هنوز closure ندارند.
- دکمهٔ `خروجی Excel لیست نهایی` در Admin Tour Workspace بدون تغییر state اجرا شد و پیام «فایل Excel آماده و دانلود شد» داد. قرارداد export source و `BUG-STG-EXPORT-SUMMARY` pass هستند؛ بررسی محتوای فایلِ همین دانلود در محیط مرورگر به artifact قابل‌خواندن دسترسی نداد و برای closure نهایی واحد مبلغ `014/015/016` باید فایل دانلودشده با شناسه/مسیر قابل‌بازخوانی بررسی شود.
- تور ظرفیت‌پر PDP هنوز اطلاعات زمان/روش پرداخت و state عملیاتی را درست نشان می‌دهد؛ ظرفیت عمداً بخشی از قرارداد این sweep نیست و `BUG-STG-044` بررسی نمی‌شود.
- regression source بعد از اصلاحات: API `16/16`، Portal `16/16`، Marketing `14/14`، Web `41/41`، Denali `10/10` و `git diff --check` pass شد.
- نتیجهٔ فعلی: باگ‌های runtime باز همان `081`، `082`، `080`، labelهای Telegram و دو projection پس از approve هستند؛ بقیهٔ flowهای mutation واقعی (duplicate guest، promotion، reject→resubmit، Telegram photo/PDF/thread/retry/General) هنوز تست‌نشده‌اند. هیچ commit، PR یا deploy انجام نشد.
- regression source مسیر Telegram/file در این ادامه `49/49` pass شد: انتخاب `sendPhoto/sendDocument` بر اساس فایل، حفظ topic/thread، fail-closed برای General، retry بدون ارسال دوم، stale-thread recovery و receipt formatter پوشش داده شدند؛ این نتیجه جایگزین ارسال واقعی روی staging نیست.
- regression source Waitlist/ظرفیت `13/13` API، `6/6` Portal و `14/14` Denali pass شد؛ ازجمله `BUG-STG-063` برای نگه‌داشتن گروه بزرگ‌تر از صندلی آزاد در Waitlist و قرارداد CTA فرم مهمان `BUG-STG-062/047`. promotion و submit واقعی staging همچنان اجرا نشده‌اند.
- در بازبینی source، Simulation برای eventهای approval/rejection کلید label مستقل نداشت؛ mapping مشترک eventها و labelهای فارسی/انگلیسی `tourCreated`، `tourPublished`، `registrationApproved`، `receiptApproved` و `receiptRejected` اضافه شد. تست قرارداد Web `3/3` و typecheck Web pass شد. این اصلاح هنوز deploy و در Admin staging retest نشده است.
- ریتست runtime بعد از آخرین deploy موفق staging (`run 36297112069`, SHA `9a7df3408c9698ebb2391133cf2a42ee2a4c6d0e`) انجام شد: PLP فعلاً free label، فیلتر `minPrice=0` و sort صعودی را درست نشان می‌دهد؛ اما `BUG-STG-081` در کارت `ec171184-1877-4501-9a92-857f712838e2` هنوز فقط قیمت پایه دارد، `BUG-STG-082` مبلغ دُنگ را در PLP ندارد، `BUG-STG-080` برای registration `4190860a-9948-4c62-b29b-85d3e494e765` در list هنوز «پرداخت لازم است» دارد ولی detail «نیازی به پرداخت نیست» نشان می‌دهد، و labelهای Telegram در Admin همچنان انگلیسی‌اند.
- receipt/projection source retest در این ادامه: رسمی API receipt flow `7/7`، Finance service `14/14`، booking-list/free projection `8/8`، Portal receipt/status `11/11` و Portal registration/resubmit markers `13/13` pass شد. هشدار `MINIO_NOT_CONFIGURED` فقط محدودیت محیط تست فایل است؛ ارسال واقعی staging هنوز انجام نشده است.
- buildهای واقعی Web، Marketing و Portal با اصلاحات فعلی هر سه pass شدند؛ guardهای import-boundary/architecture نیز pass بودند. هشدار build فقط نبودن تشخیص Next.js در تنظیم ESLint بود و failure نبود.

## Excel artifact read-only verification — ۲۰۲۶-۰۹-۲۷

- آخرین فایل واقعی دانلودشده از staging: `~/Downloads/denali-final-roster-20260927060500.xlsx`؛ فقط read-only بررسی شد.
- `BUG-STG-EXPORT-SUMMARY`: **PASS**. شیت خلاصه، مبلغ کل نهایی‌شده `۱۰٬۰۰۰٬۰۰۰ تومان`، مبلغ پرداخت‌شده نهایی‌شده، مانده نهایی‌شده `۰ تومان` و بدهی/پرداخت ناقص `۲٬۵۰۰٬۰۰۰ تومان` را جداگانه نشان می‌دهد.
- `BUG-STG-014`: **PASS**. واحد همهٔ مبلغ‌های export‌شده `تومان` است و `ریال` خام دیده نشد.
- `BUG-STG-015`: **PASS**. ستون نوع حمل‌ونقل وجود دارد و مقدار fixture نهایی `حمل سازمان‌یافته` است.
- `BUG-STG-016`: **PASS**. ستون تاریخ نهایی‌شدن وجود دارد و برای ردیف‌های نهایی مقدار timestamp ثبت شده است.
- این نتیجه فقط artifact همین دانلود را می‌بندد؛ export بعد از approve/reject جدید و projection post-approve همچنان به fixture mutation-safe و deploy با SHA مشخص نیاز دارد.

## Deploy gate recheck — ۲۰۲۶-۰۹-۲۷

- آخرین deploy موفق staging همچنان run `36297112069` با SHA `9a7df3408c9698ebb2391133cf2a42ee2a4c6d0e` است؛ deploy جدیدی برای اصلاحات فعلی انجام نشده است.
- بنابراین failureهای runtime `BUG-STG-081`، `BUG-STG-082`، `BUG-STG-080` و labelهای Telegram هنوز به‌عنوان failure artifact فعلی باز می‌مانند؛ source testهای همان اصلاحات سبز هستند و برای closure باید روی deploy بعدی با SHA واقعی retest شوند.

## Source quality gate recheck — ۲۰۲۶-۰۹-۲۷

- lint/typecheck کامل packageهای تغییرکرده پاس شد: API، Marketing، Portal و Web؛ guardهای import-boundary و guardهای اختصاصی هر package نیز سبز بودند.
- این gate هیچ اصلاح جدیدی لازم نکرد؛ source فعلی بدون commit یا PR قابل build/test است.

## Current read-only runtime retest — ۲۰۲۶-۰۹-۲۷

- Free PDP/PLP: **PASS**. تور `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در PDP و PLP برچسب `رایگان / بدون نیاز به پرداخت` دارد و کنترل پرداخت/فیش ندارد.
- `BUG-STG-081`: **FAIL**. PDP تور `ec171184-1877-4501-9a92-857f712838e2` قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و تخفیف ۵۰٪ دارد، اما PLP با `sort=price_asc` فقط `۲٬۰۰۰٬۰۰۰ تومان` نشان می‌دهد.
- `BUG-STG-082`: **FAIL**. PDP همان تور اطلاعات حمل/دُنگ دارد؛ مبلغ دُنگ در کارت PLP و AX آن دیده نمی‌شود.
- `BUG-STG-080`: **FAIL**. برای registration `4190860a-9948-4c62-b29b-85d3e494e765`، detail می‌گوید «نیازی به پرداخت نیست / رسید: لازم نیست»، اما list هنوز «برای نهایی‌شدن، پرداخت لازم است» دارد.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: **FAIL**. صفحهٔ فارسی Admin هنوز event labelهایی مانند `Member registered`، `Receipt submitted` و `Registration created` را انگلیسی render می‌کند.

### Projection evidence — same staging session

- Portal detail برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: «رسید تأیید شده» و پیام «رسید پرداخت را ارسال کنید» را هم‌زمان نشان می‌دهد.
- Admin با فیلتر `status=approved` همان booking را «پرداخت جزئی (رزرو)» با deadline و پیگیری پرداخت نشان می‌دهد.
- Portal list همان registration را «برای نهایی‌شدن، پرداخت باید تکمیل شود» نمایش می‌دهد. بنابراین دو failure projection همچنان قطعی و reproducible هستند؛ هیچ mutation اجرا نشد.

### Receipt read-only evidence — same staging session

- فیلتر `registrationId=4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` در Finance، یک receipt در انتظار بررسی با receipt ID `b1f05b8f-bbdd-47fb-8191-5a414273e74b` نشان داد.
- وضعیت «در انتظار بررسی»، مبلغ این پرداخت `۸۴۴٬۴۴۴ تومان`، روش `Manual` و دکمه‌های approve/reject موجود است؛ هیچ‌کدام اجرا نشدند.
- فایل واقعی این fixture قبلاً با `fileKey` ثبت‌شده باز شده است؛ preview/ارسال Telegram و reject→resubmit هنوز عمدی اجرا نشده‌اند چون side effect دارند.

### Focused regression recheck — ۲۰۲۶-۰۹-۲۷

- Marketing suite با transport/PLP/PDP: `353/353` pass؛ شامل `BUG-STG-082` transport contract و `BUG-STG-027` free-price sorting.
- API receipt flow رسمی: `7/7` pass؛ شامل projection update بعد از operator approval.
- Web Telegram event-label contract: `3/3` pass.
- این نتایج source/contract هستند و failureهای artifact staging را که در بخش runtime ثبت شده‌اند، جایگزین نمی‌کنند.

### Denali egress coverage hardening — ۲۰۲۶-۰۹-۲۷

- برای `BUG-STG-082` assertion رفتاری به `packages/workspaces/denali/test/denali-catalog-card.spec.ts` اضافه شد تا public card egress واقعاً `transport.mode=shared_cars` و `dongAmount=300000` را حفظ کند؛ تست فقط string/regex نیست.
- کل suite Denali بعد از این تغییر `835/835` pass شد.

## Current continuation verification — ۲۰۲۶-۰۹-۲۷

- Regression suites after the latest source fixes: API focused `۱۳/۱۳`، Portal `۳۸۵/۳۸۵`، Denali `۸۳۵/۸۳۵` و Web `۲۱۰۰/۲۱۰۰`؛ همه pass و `git diff --check` سبز است.
- Runtime Admin Exposure دوباره با AX بررسی شد؛ روی artifact staging فعلی هنوز `Member registered`، `Receipt submitted`، `Registration created` و eventهای `Ticket ...` انگلیسی render می‌شوند. این failure همان `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` است.
- آخرین deploy موفق staging: run `36297112069`، SHA `9a7df3408c9698ebb2391133cf2a42ee2a4c6d0e`. HEAD کاری فعلی `2d4a99342c7a10e06efe4e48c311afd22c2d70c2` است و هنوز deploy نشده؛ بنابراین source contract سبز، closure runtime محسوب نمی‌شود.
- Source quality gate در همین ادامه برای API، Marketing، Portal و Web اجرا شد؛ guardهای import/architecture و lint/typecheck هر چهار package سبز هستند. در source mapping تمام eventهای runtime دیده‌شده (`Member registered`، `Receipt submitted`، `Registration created` و `Ticket ...`) به label فارسی متصل است.
- Receipt/Telegram focused regression در همین ادامه: API `۴۹/۴۹` و Web `۳۰/۳۰` pass؛ شامل fileKey→sendPhoto/sendDocument، حفظ `message_thread_id`، fail-closed برای General، stale-thread recovery، retry بدون ارسال دوم، receipt formatter و labelهای فارسی eventها. این نتیجه source/integration است و جایگزین ارسال واقعی روی staging نیست.
- Registration/Waitlist focused regression در همین ادامه: Denali registration/duplicateهای معمول `۳۱/۳۱`، Waitlist expiry و promotion گروه بزرگ‌تر از ظرفیت `۲/۲` و Portal suite `۳۸۵/۳۸۵` pass. تست race هم‌زمان duplicate مهمان به‌دلیل unset بودن `DATABASE_URL` و `DATABASE_URL_ADMIN` اجرا نشد و به‌عنوان pass یا fail بسته نشد.

## Finance/projection/export source verification — ۲۰۲۶-۰۹-۲۷

- API finance/payment-hold suites: `۲۲/۲۲` pass؛ approve projection، reject event، partial/full/overpay و idempotency پوشش داده شد.
- API projection/operational-roster suites: `۱۵/۱۵` pass، با یک integration تست‌شده اما `SKIP` به‌دلیل نبود دیتابیس؛ projection inconsistency و roster filterهای approved/partial/paid/waived/waitlist سبز هستند.
- Finance-core suite: `۲۷۱/۲۷۱` pass.
- Excel export suite: `۳/۳` pass؛ شامل summary، واحد مبلغ، نوع حمل و تاریخ نهایی‌شدن.
- در این مرحله failure جدیدی در source testها پیدا نشد؛ warningهای `MINIO_NOT_CONFIGURED` و `BOOKINGS_DB_UNAVAILABLE` مربوط به سناریوهای عمدیِ تست خطا هستند.
- این نتایج closure staging نیستند: post-approve/resubmit واقعی، export پس از mutation، receipt upload واقعی و Telegram delivery هنوز روی artifact جدید staging اجرا نشده‌اند.

## Latest continuation runtime/source check — ۲۰۲۶-۰۹-۲۷

- Deploy state دوباره از GitHub بررسی شد: آخرین Deploy staging (dev) موفق run 36297112069 با SHA 9a7df3408c9698ebb2391133cf2a42ee2a4c6d0e است؛ source working tree روی اصلاحات بعدی است و deploy نشده.
- Headerهای read-only فعلی برای Marketing، Portal و PDP همگی x-cache: BYPASS و no-store بودند؛ cache stale از CDN به‌عنوان علت نتیجه ثبت نشد.
- Runtime PDP تور تخفیف‌دار ec171184-1877-4501-9a92-857f712838e2 قیمت پایه ۲٬۰۰۰٬۰۰۰، تخفیف ۵۰٪ و قیمت عضو ۱٬۰۰۰٬۰۰۰ تومان را نشان داد؛ PLP همان تور در sort=price_asc فقط ۲٬۰۰۰٬۰۰۰ تومان را نشان داد. BUG-STG-081 روی artifact فعلی همچنان باز است.
- Runtime PLP با ۱۵ نتیجه و sort قیمت صعودی باز شد؛ دو تور رایگان label «رایگان / بدون نیاز به پرداخت» داشتند. این بخش BUG-STG-025/026/027 را pass نگه می‌دارد.
- Runtime Admin Exposure فارسی دوباره Member registered، Receipt submitted، Registration created و eventهای Ticket ... را انگلیسی render کرد. BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS روی artifact فعلی باز است.
- Runtime Portal فرم تور ظرفیت‌پر با session موجود فقط ثبت قبلی عضو و CTA «افزودن همراه» را نشان داد؛ هیچ submit یا mutation انجام نشد. Waitlist guest form و duplicate واقعی هنوز closure ندارند.
- Regression source بعد از این بررسی: Marketing commercial pricing ۷/۷، Web Telegram labels ۳/۳ و Denali suite ۸۳۵/۸۳۵ pass شدند. اجرای نامعتبر script test:file برای Marketing خروجی تست محسوب نشد و با command رسمی package جبران شد.

## Remaining source flow verification — ۲۰۲۶-۰۹-۲۷

- Postgres guest duplicate race runner رسمی: ۱/۱ pass؛ دو POST هم‌زمان دقیقاً یک 201 و یک 409 تولید کردند. BUG-STG-021 در source/backend بسته است؛ runtime staging هنوز submit واقعی ندارد.
- Waitlist/payment-hold runner: ۲/۲ pass؛ expiry promotion و جلوگیری از promotion گروه بزرگ‌تر از ظرفیت آزاد پوشش داده شد (BUG-STG-063).
- Telegram registration/receipt chain و Finance review: ۱۴/۱۴ pass؛ approve/reject event chain، payment projection و خطاهای sync پوشش داده شدند.
- Portal registration/receipt: ۱۳/۱۳ pass؛ BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS، BFF، label مبلغ و تفکیک receipt/registration پوشش داده شد.
- این اجراها هیچ اصلاح source جدیدی لازم نکردند. Warningهای engine_missing و BOOKINGS_DB_UNAVAILABLE در سناریوهای کنترل‌شدهٔ تست هستند و failure تست نیستند.

## Staging reject/resubmit mutation — ۲۰۲۶-۰۹-۲۷

- Fixture قبل از mutation: registration/booking 4ae40b3e-dcdf-4b6c-bc24-30f7706d4147، receipt b1f05b8f-bbdd-47fb-8191-5a414273e74b، وضعیت در انتظار بررسی و فایل PNG موجود.
- Admin با action «رد» پاسخ موفق داد؛ Finance وضعیت را «رد شد» و Portal وضعیت را «اصلاح فیش لازم است» نشان داد. receipt قبلی جدا از registration باقی ماند.
- Portal سپس resubmit را با توضیح QA staging resubmit 20260927 انجام داد؛ بدون upload تصویر، چون UI صراحتاً ارسال توضیح متنی را مجاز می‌داند. Portal به «فیش شما در حال بررسی است / رسید: در انتظار بررسی» تغییر کرد.
- Finance پس از refresh یک receipt جدید 4ffb2534-70cd-4be0-b244-09e991a598ae را با وضعیت «در انتظار بررسی» و متن «این رسید به‌صورت متنی ارسال شده است» نشان داد.
- نتیجه: BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS و تفکیک status receipt/registration در runtime فعلی **PASS**. approve عمداً انجام نشد تا side effect مالی و Telegram ایجاد نشود.
- upload واقعی PNG/PDF، approve، بررسی projection بعد از approve و ارسال Telegram هنوز نیازمند اجرای جداگانه روی deploy اصلاح‌شده هستند.

## Final source quality gate recheck — ۲۰۲۶-۰۹-۲۷

- API lint/typecheck و guardهای package: PASS؛ شامل tenant isolation، import boundary، storage/forensic، outbox، concurrency، roster budget و production config guards.
- Marketing lint/typecheck و import boundary: PASS.
- Portal lint/typecheck، import boundary، member-profile boundary و architecture truth: PASS.
- Web lint/typecheck، import boundary، UI boundary و no-raw-wizard-input: PASS.
- این گیت‌ها failure جدیدی نشان ندادند؛ کد فعلی بدون commit یا PR از نظر source quality سبز است.

## Receipt upload follow-up — ۲۰۲۶-۰۹-۲۷

- همان fixture پس از reject دوباره با resubmit متنی به وضعیت «رسید: در انتظار بررسی» برگشت داده شد؛ receipt و registration همچنان جدا گزارش می‌شوند.
- input واقعی Portal نوع‌های image و PDF را با accept image/*,.pdf اعلام می‌کند، اما در این اجرای browser file chooser قابل set شدن نبود؛ بنابراین upload باینری PNG/PDF به‌عنوان PASS ثبت نشد.
- fixture در پایان در وضعیت pending باقی ماند و approve انجام نشد.

## Remaining API contract verification — ۲۰۲۶-۰۹-۲۷

- Operational roster/export API، registration capacity و booking-management matrix: ۱۷/۱۷ pass؛ waitlist when full، rejection when full، filterهای roster، XLSX contract و dispatcher action/status پوشش داده شدند.
- این تست‌ها failure source جدیدی نشان ندادند. upload باینری، approve مالی و Telegram delivery همچنان فقط با runtime mutation واقعی قابل closure هستند.

## Receipt binary/Telegram source gate — ۲۰۲۶-۰۹-۲۷

- API receipt upload، ownership/authz، BFF binary proxy و P6 offline receipt flow: ۴۳/۴۳ pass.
- پوشش شامل putProof بعد از authorization، cleanup در خطای submit، GET pending بعد از upload، جلوگیری از upload برای مالک دیگر و approval projection است.
- Telegram adapter/worker نیز در همین اجرا sendPhoto/sendDocument multipart، fileKey، topic/thread، stale-thread recovery، General fail-closed و retry بدون send دوم را pass کرد.
- بنابراین source contract برای upload و Telegram استاندارد و سبز است؛ تنها تأیید باقی‌مانده، اجرای واقعی PNG/PDF و delivery روی staging با artifact جدید است.
