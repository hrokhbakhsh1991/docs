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

### P0 canonical projection contract

The member-owned registration detail must carry the same additive
`financialDisplayState` projection as the booking list. In particular,
`financialDisplayState=WAIVED` is authoritative for free registrations and
must not be reconstructed from `paymentStatus` or receipt state in Portal
detail. The P0 implementation therefore keeps the field in the neutral
`BookingPublicOwnedDetail` contract and forwards it through the host adapter
and Denali registration detail service.

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

> این بخش فقط evidence تست source/backend است و به‌تنهایی closure staging محسوب نمی‌شود؛ status نهایی staging در ماتریس انتهای فایل تعیین می‌شود.

- Postgres guest duplicate race runner رسمی: ۱/۱ pass؛ دو POST هم‌زمان دقیقاً یک 201 و یک 409 تولید کردند. BUG-STG-021 در source/backend بسته است؛ runtime staging هنوز submit واقعی ندارد.
- Waitlist/payment-hold runner: ۲/۲ pass در source/backend؛ expiry promotion و جلوگیری از promotion گروه بزرگ‌تر از ظرفیت آزاد پوشش داده شد. این evidence جایگزین fixture/runtime staging نیست؛ `BUG-STG-063` در staging همچنان `UNVERIFIED` است.
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
- input واقعی Portal نوع‌های image و PDF را با accept image/\*,.pdf اعلام می‌کند، اما در این اجرای browser file chooser قابل set شدن نبود؛ بنابراین upload باینری PNG/PDF به‌عنوان PASS ثبت نشد.
- fixture در پایان در وضعیت pending باقی ماند و approve انجام نشد.

## Remaining API contract verification — ۲۰۲۶-۰۹-۲۷

- Operational roster/export API، registration capacity و booking-management matrix: ۱۷/۱۷ pass؛ waitlist when full، rejection when full، filterهای roster، XLSX contract و dispatcher action/status پوشش داده شدند.
- این تست‌ها failure source جدیدی نشان ندادند. upload باینری، approve مالی و Telegram delivery همچنان فقط با runtime mutation واقعی قابل closure هستند.

## Receipt binary/Telegram source gate — ۲۰۲۶-۰۹-۲۷

- API receipt upload، ownership/authz، BFF binary proxy و P6 offline receipt flow: ۴۳/۴۳ pass.
- پوشش شامل putProof بعد از authorization، cleanup در خطای submit، GET pending بعد از upload، جلوگیری از upload برای مالک دیگر و approval projection است.
- Telegram adapter/worker نیز در همین اجرا sendPhoto/sendDocument multipart، fileKey، topic/thread، stale-thread recovery، General fail-closed و retry بدون send دوم را pass کرد.
- بنابراین source contract برای upload و Telegram استاندارد و سبز است؛ تنها تأیید باقی‌مانده، اجرای واقعی PNG/PDF و delivery روی staging با artifact جدید است.

## P0 source hardening — stale payment deadline fail-closed — ۲۰۲۶-۰۹-۲۸

- ریشه‌یابی: API projection و Portal Detail در صورت باقی‌ماندن `paymentDueAt` قدیمی، آن را بدون توجه به `paymentStatus=paid` یا `financialDisplayState=WAIVED` منتشر می‌کردند.
- اصلاح: resolver مشترک `resolvePaymentDueAtForProjection` در API service و public adapter اضافه شد؛ Portal نیز فقط برای registration تأییدشده، غیررایگان و تسویه‌نشده deadline را render می‌کند.
- تست focused API: `24/24 pass` شامل finance projection؛ تست resolver deadline: `3/3 pass`.
- تست focused Portal: `20/20 pass`؛ Portal lint/typecheck، import boundary و architecture truth: PASS.
- این اصلاح source-level است و جایگزین deploy با SHA جدید و recheck API/List/Detail/Admin/Finance روی staging نمی‌شود.

## P2 merchandising implementation gate — ۲۰۲۶-۰۹-۲۸

- محدودهٔ P2 شامل `BUG-STG-081`، `BUG-STG-082`، `BUG-STG-025` و `BUG-STG-026 / 027` است؛ P0/P1، Telegram، فایل، ظرفیت نمایشی و `BUG-STG-024` در این batch نیستند.
- HEAD source فعلی `8df27fd4a15991587e6aba9bef12eb5f72495727` است. منطق canonical قیمت عضو، قیمت صفر برای free، filter/sort بر اساس همان قیمت، label رایگان و snapshot حمل مشترک بین PLP/PDP در source موجود است؛ patch تکراری ایجاد نشد.
- تست رسمی Marketing: `38/38` pass، شامل free label، free filter/sort، member payable، transport mode/dong و organized transport.
- تست رسمی Denali: `8/8` pass، شامل public card egress با `shared_cars` و `dongAmount=300000`.
- runtime read-only فعلی: PDP تور `ec171184-1877-4501-9a92-857f712838e2` قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان`، نوع حمل `خودروهای مشترک` و دُنگ `۳۰۰٬۰۰۰ تومان` را نشان می‌دهد؛ HTML/AX کارت PLP همان تور هنوز قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان` را بدون transport/dong می‌دهد. `BUG-STG-081 / 082` روی artifact فعلی closure نشده‌اند.
- runtime read-only فعلی: تور رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در PLP label `رایگان / بدون نیاز به پرداخت` دارد و تست `minPrice=0`/sort قیمت صعودی نیز fixture رایگان را وارد نتایج می‌کند؛ `BUG-STG-025 / 026 / 027` فعلاً pass runtime هستند.
- هدرهای فعلی هر سه host `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` دارند؛ بنابراین این مشاهده به‌تنهایی stale CDN نیست. SHA runtime از خود host در header/HTML ارائه نشد. آخرین deploy ثبت‌شده staging `9a7df3408c9698ebb2391133cf2a42ee2a4c6d0e` است؛ تا deploy دقیق HEAD و fingerprint runtime، P2 بسته نمی‌شود.
- گیت باقی‌مانده: deploy همین HEAD، ثبت SHA واقعی artifact از runtime، مقایسهٔ API PLP/PDP و screenshot/AX/HTML برای همان fixture، سپس recheck هر چهار BUG. اگر transport در API list هم غایب باشد، owner API/exposure است؛ اگر API حاضر و HTML غایب باشد، owner Marketing artifact است.

## P1 implementation follow-up — ۲۰۲۶-۰۹-۲۸

- `BUG-STG-047`: مسیر مستقیم `/catalog/:tourId/register` باید پیش از auth/intake، `registrationState=past|closed` را gate کند؛ `waitlist` همچنان باید به فرم ادامه دهد.
- این تغییر فقط route guard و regression test است؛ ظرفیت کل، Telegram، PDF و فایل تصویری در این batch تغییر نمی‌کنند.

## Final source gate — ۲۰۲۶-۰۹-۲۷

- آخرین HEAD source gate شد: Marketing `356/356`، Denali `837/837`، Portal `385/385`، Web `2050/2050` و API `3147 pass / 0 fail / 7 skip`.
- API skipها فقط به PostgreSQL یا tier شبانه نیاز داشتند؛ هیچ تست fail نشد. تست‌های مرتبط با pricing/PLP، free projection، Exposure redaction، timezone، payment/receipt projection، Waitlist، Telegram/file routing و export در همین gate سبز بودند.
- worktree بعد از تست‌ها clean است و artifact گزارش تولیدیِ timestamp-only به مقدار قبلی برگردانده شد.
- این checkpoint source/integration closure است؛ deploy staging، runtime SHA و ریتست نهایی staging هنوز عمداً انجام نشده‌اند.

## Source remediation checkpoint — ۲۰۲۶-۰۹-۲۷ (قبل از staging نهایی)

- `BUG-STG-081/082`: PLP preview عضو را قبل از filter/sort می‌گیرد؛ قیمت payable عضو مبنای price filter/sort است و line نوع حمل/دُنگ در شاخهٔ member-price هم حفظ می‌شود. Marketing package `356/356` pass.
- Exposure/Waitlist/Finance/Portal/Admin source suites: Denali `837/837`، Portal/API/Web تست‌های هدف‌گذاری‌شده بدون failure pass شدند؛ side effectهای payment hold، free collection، capacity guard و redaction پوشش دارند.
- این checkpoint **تأیید staging نیست** و هیچ registration/receipt mutation انجام نشده است. Deploy با SHA نهایی و sweep staging فقط بعد از تکمیل همهٔ اصلاحات انجام می‌شود.

## Staging continuation — ۲۰۲۶-۰۹-۲۷ — بدون Telegram و بدون upload

- Waitlist count/filter: Admin North Ridge با فیلتر `status=waitlisted` و `tourId=00000000-0000-4000-8000-000000000220` هم در KPI و هم در heading مقدار `۷`، صفحه `۱ از ۱` و لیست `۷ از ۷` نشان داد؛ هر ۷ ردیف label «در لیست انتظار» داشتند. `BUG-STG-037` در این fixture internally consistent است؛ اختلاف قبلی ۳ در برابر ۱۲ روی این fixture تکرار نشد و برای closure نهایی همان fixture قبلی و API/SHA لازم است.
- Waitlist transport status: ردیف‌های Waitlist در Admin با label مستقل «در لیست انتظار» نمایش داده شدند و «تأییدشده» یا action نهایی‌سازی به آن‌ها نسبت داده نشد؛ `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در این مشاهده PASS است.
- Finance receipt queue: `admin.../finance?tab=receipts` پس از load پیام «فیشی در انتظار بررسی نیست» نشان داد. به‌دلیل نبود fixture rejected/pending، reject→resubmit مجدد، approve، upload باینری و Telegram delivery اجرا نشدند؛ این موارد **UNVERIFIED / خارج از scope این دور** هستند.
- Multi-person pricing: Portal registration تور `ec171184-1877-4501-9a92-857f712838e2` با عضو واردشده و یک مهمان، برای مهمان preview مستقل `۲٬۰۰۰٬۰۰۰ تومان` نشان داد؛ تخفیف ۵۰٪ عضو به مهمان منتقل نشد. ثبت نهایی انجام نشد؛ `BUG-STG-022` برای تفکیک قیمت participant PASS جزئی دارد، اما محاسبه transport/dong چندنفره هنوز runtime closure ندارد.
- Artifact ثابت این sweep: SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a`، digest `dc09e5ce749cab87042526e8ac52340806d29ddc72af278d37546e315fe34678`، deploy run `36308810354`. health هر سه host `200` و `x-cache: BYPASS` است.

- Free projection follow-up: در Admin فیلتر همهٔ `QA-STG-20260924-FREE-MANUAL` هشت ردیف داشت؛ ۶ ردیف free با label «بدون نیاز به پرداخت» بودند، اما booking `4190860a-9948-4c62-b29b-85d3e494e765` در همان تور «پرداخت‌نشده (رزرو)» نشان داد. Portal list همین رکورد «برای نهایی‌شدن، پرداخت لازم است» و Portal detail آن `status=waived`/«نیازی به پرداخت نیست» نشان می‌دهد. این projection mismatch برای `BUG-STG-080` قطعی و باز است.
- Free pending fixture: در وضعیت `در انتظار` برای همین تور هیچ رکوردی پیدا نشد؛ سناریوی free-pending بدون upload/payment control هنوز **UNVERIFIED** است و بدون ساخت یا تغییر receipt ادامه داده نشد.
- Time raw follow-up: در Public PDP، structured data مقدار `startDate=2026-09-25T08:00:00.000Z` دارد؛ این instant در Asia/Tehran برابر ۱۱:۳۰ است و با Admin workspace (`۳ مهر ۱۴۰۵ · ۱۱:۳۰`) هم‌خوان است، اما Public PDP مقدار ۱۰:۰۰ را render می‌کند. `BUG-STG-035` با raw/SSR + Admin evidence قطعی و باز است.
- Exposure locale follow-up: با بازکردن موقت سطح سفارشی «فهرست کاتالوگ عمومی»، AX description خام `Start, summit, camp and end location zones.` را کنار checkbox «نقطه شروع» نشان داد؛ تغییر ذخیره نشد و checkbox سفارشی به حالت قبل برگشت. `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان FAIL runtime است.
- Paid projection follow-up: Finance برای registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` پرداخت `۸۴۴٬۴۴۴ تومان` با وضعیت «ثبت‌شده (این پرداخت)» نشان داد؛ لینک refund همان ردیف `currency=IRR` دارد. Portal detail `paid`/receipt approved است، اما Admin booking هنوز «پرداخت جزئی (رزرو)» و deadline دارد و Portal list «پرداخت باید تکمیل شود» نشان می‌دهد. `BUG-STG-024` و `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` باز هستند.
- Status/cancellation comparison: registration `017b4cb2-3970-488e-b79d-265f28e9b29d` در حالت approved+unpaid متن درست «ثبت‌نام: تأیید شده / رسید: ارسال نشده»، مانده بدهی و upload receipt دارد و cancellation را با `cancellation_cutoff_passed` مسدود می‌کند. در مقابل `f2144510-bc47-4d1f-b6ad-42002a6ac51a` در detail paid/receipt approved است اما هنوز متن «رسید پرداخت را ارسال کنید» و deadline دارد؛ `BUG-STG-039/072` runtime FAIL و بازتولید شد.
- Waitlist state follow-up: SSR Portal list برای registration `256183c5-9b73-4921-b8ea-290394c0e58b` state/badge `waitlisted` و departure `۱۱:۳۰` دارد. بازکردن مستقیم همان detail URL با 404 برگشت، اما کلیک روی همان ردیف از داخل list detail را باز کرد و `ثبت‌نام: لیست انتظار / رسید: لازم نیست` و «منتظر تأیید باشگاه» نشان داد. این تفاوت navigation/list-detail، به‌همراه heading عمومی detail، `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` را runtime FAIL نگه می‌دارد.
- Promotion fixture follow-up: تور `QA WAITLIST GROUP 20260927` فقط ۳ رکورد لغوشدهٔ یک‌نفره با ظرفیت `۰/۱` دارد؛ هیچ booking با `partySize>1` یا candidate چندنفرهٔ قابل promotion باقی نمانده است. `BUG-STG-063` برای سناریوی گروه بزرگ‌تر از ظرفیت **UNVERIFIED** است؛ fixture جدید یا approve/release ساخته نشد تا side effect و Telegram ایجاد نشود.
- Duplicate guest follow-up: در همان تور `c2690b98-d8be-404c-b2e8-9c4d6f62fb03`، رکورد موجود `c508f22e-77bc-4e8f-8ce0-2ceab3c67fd7` با موبایل duplicate شناخته‌شدهٔ `09179900002` وجود داشت؛ اجرای قبلی فرم مهمان با همان موبایل alert «قبلاً برای این تور ثبت‌نام کرده‌اید» داد و رکورد جدید نساخت. تلاش recheck این دور به‌دلیل مقدارپذیر نبودن کنترل موبایل در automation به submit نرسید؛ همان evidence قبلی معتبر است و `BUG-STG-021` runtime PASS در همان fixture دارد.
- Export follow-up: فایل واقعی `/home/hamed/Downloads/denali-final-roster-20260927060500.xlsx` با SHA256 `3c2a262f04c7495fa8a551f26d49bd35e52b35daad8c2d879ef320b3d0b690da` دوباره parse شد؛ شیت خلاصه `۱۰٬۰۰۰٬۰۰۰ تومان` کل/پرداخت‌شده، `۰ تومان` مانده نهایی‌شده و `۲٬۵۰۰٬۰۰۰ تومان` بدهی جداگانه دارد. ردیف‌های نهایی واحد تومان، نوع حمل و تاریخ نهایی‌شدن دارند؛ `BUG-STG-EXPORT-SUMMARY` و `BUG-STG-014/015/016` در این artifact PASS هستند.
- No-discount party follow-up: Portal فرم تور `b595933d-cf84-4d60-9f5d-f1072aa947cc` برای مهمان بدون تخفیف preview پایه `۱۰٬۰۰۰٬۰۰۰ تومان` و حمل خودرو `۱٬۰۰۰٬۰۰۰ تومان`، جمع `۱۱٬۰۰۰٬۰۰۰ تومان` نشان داد؛ تخفیف عضو به مهمان منتقل نشد و transport جداگانه محاسبه شد. ثبت نهایی انجام نشد؛ بخش participant pricing `BUG-STG-022` PASS runtime برای این مسیر دارد، اما همهٔ ترکیب‌های transport چندنفره هنوز پوشش کامل ندارند.
- Free PLP recheck: روی `https://denali.shenski.com/tours?minPrice=0&sort=price_asc` مقدار `۱۶ مورد`، fixture `QA-STG-20260924-FREE-MANUAL` و label `رایگان / بدون نیاز به پرداخت` دیده شد؛ همان fixture در `sort=price_desc` نیز حاضر بود. `BUG-STG-025` و `BUG-STG-026/027` روی artifact فعلی PASS runtime هستند؛ failureهای قدیمی این سه مورد به artifact قبلی مربوط‌اند.
- Discount PLP recheck: روی `sort=price_asc` برای tour `ec171184-1877-4501-9a92-857f712838e2` کارت PLP قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و `50٪ تخفیف عضویت` را نشان داد؛ `BUG-STG-081` فعلاً PASS است. همان card هیچ متن حمل/خودرو/دُنگ یا `۳۰۰٬۰۰۰` ندارد، درحالی‌که PDP مبلغ دُنگ را نشان می‌دهد؛ `BUG-STG-082` همچنان FAIL است.
- Telegram label UI recheck: در Exposure Admin، labelهای event به فارسی render شدند: `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ایجاد ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار`. `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` در سطح UI PASS فعلی است؛ ارسال واقعی Telegram خارج از scope این sweep است.
- Payment redaction recheck: سطح سفارشی «فهرست کاتالوگ عمومی» موقتاً ذخیره شد با checkbox `تور پولی` خاموش. Public PDP همان لحظه هنوز «روش پرداخت: رسید / پرداخت آفلاین»، قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، تخفیف ۵۰٪ و قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` را render کرد؛ `BUG-STG-019` قطعی و FAIL است. checkbox دوباره روشن و سطح با موفقیت ذخیره شد؛ تنظیم نهایی به حالت قبل برگشت.
- Exposure restore verification: پس از روشن‌کردن دوباره `تور پولی` و خاموش‌کردن حالت custom سطح فهرست، ذخیره با پیام «نمایش سطح ذخیره شد» انجام شد؛ PDP بعدی دوباره روش پرداخت و قیمت‌های عضو را نشان داد. هیچ تنظیم موقت تستی باقی نماند.
- Transport redaction recheck: با خاموش‌کردن `نحوه حمل‌ونقل` در سطح فهرست، PLP و PDP هر دو mode حمل، هزینه و دُنگ را حذف کردند؛ `BUG-STG-006` PASS است. برای restore، سطح جزئیات عمومی با هر ۱۲ فیلد از جمله حمل صریحاً ذخیره شد و PDP دوباره `خودروهای مشترک` و `۳۰۰٬۰۰۰ تومان` را نشان داد. تغییر موقت باقی نماند.
- Deploy fingerprint recheck: آخرین `Deploy staging (dev)` همچنان run `36308810354` با SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a` و conclusion `success` است؛ `phase-6-gate` همین SHA نیز success است. بنابراین evidence این sweep روی همان artifact معتبر باقی می‌ماند.
- Waitlist CTA/copy recheck: Public PDP North Ridge با `۰ جای خالی` هیچ label یا CTA «لیست انتظار» نشان نداد؛ direct Portal guest form نیز فقط «ثبت درخواست» و قیمت عمومی داشت و هیچ توضیحی دربارهٔ ورود به صف نداشت. `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` روی SHA فعلی دوباره FAIL شدند.
- Promotion group-size search: در Admin فهرست همهٔ bookingها (۹۶ نتیجه، صفحهٔ اول ۵۰ ردیف) هیچ متن یا ردیف `۲ نفر`، `۳ نفر` یا `۴ نفر` پیدا نشد؛ fixture `QA WAITLIST GROUP 20260927` فقط ردیف‌های `۱ نفر` و همگی لغوشده دارد. بنابراین `BUG-STG-063` هنوز **UNVERIFIED** است؛ سناریوی گروه بزرگ‌تر از ظرفیت آزاد بدون ساخت fixture یا approve/release قابل اثبات نیست و عمداً side effect ایجاد نشد.
- Current artifact recheck: health عمومی staging در ۲۰۲۶-۰۹-۲۷ ساعت ۱۲:۱۴ با HTTP 200 و `x-cache: BYPASS` پاسخ داد؛ آخرین deploy همچنان run `36308810354` روی SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a` است.
- Member PLP recheck: در session عضو، `/tours?sort=price_asc` برای تور `ec171184-1877-4501-9a92-857f712838e2` هم `۱٬۰۰۰٬۰۰۰ تومان` و هم `50٪ تخفیف عضویت` را در AX نشان داد؛ `BUG-STG-081` در این اجرای فعلی PASS است. کارت PLP هنوز هیچ `۳۰۰٬۰۰۰`/نوع حملی در AX نداشت، درحالی‌که PDP دارد؛ `BUG-STG-082` همچنان FAIL است.
- Exposure labels recheck: صفحهٔ فارسی Admin در همان artifact labelهای `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ایجاد ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار` را فارسی render کرد؛ `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` در سطح UI PASS است. delivery واقعی Telegram طبق scope اجرا نشد.
- Waitlist Admin/Portal cross-check: Admin با فیلتر North Ridge مقدار KPI `۷`، heading `صف — صفحه 1 از 1 (۷ کل)` و list `۷ از ۷` دارد؛ هر هفت ردیف `ظرفیت: ۱۲/۱۲` و label `در لیست انتظار` دارند. Portal list برای سه fixture اول waitlist همان state `لیست انتظار` و زمان `۳ مهر ۱۴۰۵، ۱۱:۳۰` را نشان می‌دهد. این read-only cross-check `BUG-STG-037` را روی fixture فعلی internally consistent و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` را PASS نگه می‌دارد، اما انتقال واقعی پس از آزادشدن ظرفیت هنوز mutation نشده است.
- Waitlist operational copy: اولین ردیف Admin action را به‌صورت «تأیید ... — برای تأیید دوباره کلیک کنید» نشان می‌دهد، درحالی‌که badge ردیف همچنان «در لیست انتظار» و ظرفیت `۱۲/۱۲` است؛ هیچ تأیید یا کلیکی انجام نشد. بنابراین `BUG-STG-064 / 065` برای انتقال واقعی همچنان UNVERIFIED است.
- Finance read-only recheck: تب «پرداخت‌ها» برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` مبلغ `۸۴۴٬۴۴۴ تومان` و label «ثبت‌شده (این پرداخت)» را نشان داد، اما لینک refund همان payment دارای `currency=IRR` است. برای همین registration لینک booking Admin و receipt هم‌زمان وجود دارد؛ این evidence، `BUG-STG-024` و ناسازگاری projectionهای `PAID-LIST`/`ADMIN-BOOKING` را باز نگه می‌دارد. هیچ refund یا mutation انجام نشد.
- Public waitlist recheck: PDP North Ridge در session فعلی `۰ جای خالی`، `روش پرداخت: رسید / پرداخت آفلاین` و لینک `مشاهده ثبت‌نام من` دارد، اما هیچ متن «لیست انتظار» یا CTA «ثبت درخواست لیست انتظار» ندارد. چون session قبلاً ثبت‌نام دارد، guest submit انجام نشد؛ failure copy/CTA پابرجاست.
- Exposure direct AX recheck: در سطح «جزئیات کاتالوگ عمومی» با تنظیمات ذخیره‌شده و بدون mutation، checkbox «نقطه شروع» با description خام `Start, summit, camp and end location zones.` دیده شد؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` قطعی است. سطح در پایان بدون تغییر باقی ماند.
- `BUG-STG-036` mutation proof: checkbox «مقصد» در سطح جزئیات عمومی موقتاً خاموش و ذخیره شد؛ PDP همان لحظه به‌جای حذف کامل مقصد، مقدار خام `mountain_multi` را render کرد. checkbox دوباره روشن و ذخیره شد و PDP بعد از restore مقدار فارسی `توچال` را نشان داد. تغییر موقت باقی نماند.
- `BUG-STG-022` form follow-up: در فرم تور تخفیف‌دار، عضو قبلی و مهمان `QA Guest Pricing` جدا نمایش داده شدند؛ مبلغ مهمان `۲٬۰۰۰٬۰۰۰ تومان` و بدون انتقال تخفیف عضو بود. دو حالت ماشین شخصی در فرم قابل انتخاب بود، اما در این preview هیچ مبلغ جداگانهٔ دُنگ/حمل کنار مهمان render نشد؛ submit انجام نشد. بنابراین pricing participant PASS است ولی transport/dong چندنفره هنوز closure ندارد.
- `BUG-STG-080` three-surface recheck: Portal list برای `4190860a-9948-4c62-b29b-85d3e494e765` متن «برای نهایی‌شدن، پرداخت لازم است» دارد؛ Portal detail همان ID صریحاً «ثبت‌نام: تأیید شده / رسید: لازم نیست / نیازی به پرداخت نیست» نشان می‌دهد؛ Admin fixtureهای free عموماً «بدون نیاز به پرداخت» دارند، اما همین projection قبلاً «پرداخت‌نشده (رزرو)» ثبت شده بود. ناسازگاری list/detail/Admin قطعی و باز است.
- Paid projection three-surface recheck: Portal list برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` «برای نهایی‌شدن، پرداخت باید تکمیل شود» دارد؛ detail هم‌زمان `رسید: تأیید شده`، «پرداخت تأیید شد» و متن اشتباه «رسید پرداخت را ارسال کنید» را render می‌کند؛ Admin همان ردیف را `پرداخت جزئی (رزرو)` با deadline نشان می‌دهد. `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` همچنان FAIL قطعی‌اند.
- Receipt queue read-only recheck: Finance با فیلتر registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` پیام «فیشی در انتظار بررسی نیست» دارد؛ بنابراین در این دور fixture قابل مشاهده برای `BUG-STG-040` یا upload/approve پیدا نشد و هیچ action مالی انجام نشد.
- `BUG-STG-035` fresh timezone proof: Public PDP structured data همچنان `startDate=2026-09-25T08:00:00.000Z` دارد؛ Admin Workspace برای همان tour صریحاً «حرکت: ۳ مهر ۱۴۰۵ · ۱۱:۳۰» را render می‌کند، درحالی‌که Public PDP UI در recheck قبلی «۳ مهر ۱۴۰۵، ۱۰:۰۰» بود. mismatch timezone/representation قطعی و باز است.
- Receipt status read-only recheck: Portal detail برای `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` به‌درستی دو status جدا دارد (`ثبت‌نام: تأیید شده` و `رسید: تأیید شده`)، اما متن stale «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید» را هم‌زمان نشان می‌دهد؛ پیام موفقیت «رسید شما تأیید شد» نیز حاضر است. این evidence `BUG-STG-039/072` و status-copy inconsistency را تأیید می‌کند؛ هیچ resubmit/approve انجام نشد.
- Waitlist workspace copy recheck: Admin Workspace tab «لیست انتظار» صریحاً «صف ظرفیت — تأیید پس از آزاد شدن جا»، «مهمانانی که ظرفیت پر است — با تأیید به ثبت‌نام تأییدشده منتقل می‌شوند» و ظرفیت `۱۲/۱۲ نفر — ظرفیت تور پر است` را نشان داد؛ actionهای «تأیید بدون نیاز به پرداخت» و «تأیید و منتظر پرداخت» نیز از هم جدا هستند. Copyهای `BUG-STG-064 / 065` در read-only PASS هستند؛ انتقال واقعی با approve/release همچنان اجرا نشده است.
- Operational list recheck: Workspace summary برای North Ridge مقدار `منتظر پرداخت ۸`، `لیست انتظار ۷` و `لیست عملیاتی ۱۲` دارد؛ جدول عملیاتی نیز `حمل سازمان‌یافته: ۱۲` و ۱۲ ردیف را نشان داد. در این fixture شمارنده‌ها و جدول internally consistent هستند؛ اختلاف fixture قدیمی ۳ در برابر ۱۲ دوباره بازتولید نشد، پس `BUG-STG-037` فقط روی fixture فعلی PASS مشروط دارد.
- PDP base recheck: North Ridge در Public PDP روش پرداخت «رسید / پرداخت آفلاین»، تأیید «دستی» و ساعت «۳ مهر ۱۴۰۵، ۱۰:۰۰» را نشان داد؛ ظرفیت/حمل طبق قرارداد فعلی این fixture جداگانه ارزیابی نشد. این مشاهده، بخش read-only `BUG-STG-008 / 013` را PASS نگه می‌دارد و اختلاف ساعت را فقط در `BUG-STG-035` ثبت می‌کند.
- `BUG-STG-082` fresh PLP/PDP proof: PLP کارت تور `ec171184-1877-4501-9a92-857f712838e2` در session عضو قیمت پایه `۲٬۰۰۰٬۰۰۰` و قیمت عضو `۱٬۰۰۰٬۰۰۰` را دارد، اما در AX کارت هیچ نوع حمل یا مبلغ `۳۰۰٬۰۰۰` ندارد. PDP همان تور `خودروهای مشترک`، هزینه حمل `۳۰۰٬۰۰۰ تومان` و هزینه دونگی `۳۰۰٬۰۰۰ تومان` را render می‌کند؛ failure قطعی پابرجاست.
- Free filter/sort UI recheck: مسیر `/tours?minPrice=0&sort=price_asc` در UI فیلتر `فیلتر قیمت`، sort «قیمت (کم به زیاد)»، تعداد `۱۶ مورد` و fixture `QA-STG-20260924-FREE-MANUAL` با label «رایگان / بدون نیاز به پرداخت» را نشان داد. مسیر `sort=price_desc` نیز با sort نزولی، `۱۶ مورد` و همان fixture/label را نشان داد؛ `BUG-STG-025` و `BUG-STG-026/027` PASS فعلی هستند.
- Excel artifact recheck: SHA256 فایل `/home/hamed/Downloads/denali-final-roster-20260927060500.xlsx` برابر `3c2a262f04c7495fa8a551f26d49bd35e52b35daad8c2d879ef320b3d0b690da` است. پنج شیت موجود است؛ خلاصه شامل `۱۰٬۰۰۰٬۰۰۰ تومان` کل/پرداخت‌شده، `۰ تومان` مانده نهایی‌شده و `۲٬۵۰۰٬۰۰۰ تومان` بدهی ناقص است. شیت «لیست نهایی» ستون نوع حمل‌ونقل و تاریخ نهایی‌شدن دارد و `IRR` خام ندارد؛ `BUG-STG-EXPORT-SUMMARY` و `BUG-STG-014/015/016` PASS باقی می‌مانند.
- `BUG-STG-021` runtime duplicate recheck: در تور `c2690b98-d8be-404c-b2e8-9c4d6f62fb03` با guest name `QA Duplicate Recheck` و موبایل duplicate شناخته‌شده `09179900002` submit واقعی انجام شد؛ فرم alert «مهمان 1: قبلاً برای این تور ثبت‌نام کرده‌اید.» داد، navigation/record جدید ایجاد نشد و Portal list همچنان همان رکورد موجود `c508f22e-77bc-4e8f-8ce0-2ceab3c67fd7` را نشان داد. `BUG-STG-021` runtime PASS قطعی است.
- `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` status reassessment: در recheck فعلی direct detail URL `256183c5-9b73-492c-b8ea-290394c0e58b` با HTTP/UI موفق باز شد و `ثبت‌نام: لیست انتظار / رسید: لازم نیست / ۱۱:۳۰` را نشان داد؛ Portal list همان لینک و همان state/time را نشان داد. 404 قبلی در این artifact دوباره بازتولید نشد؛ نتیجهٔ فعلی PASS مشروط است و سابقهٔ nondeterministic قبلی در گزارش باقی می‌ماند.
- Waitlist direct stability repeat: همان direct detail URL سه بار متوالی با queryهای مستقل باز شد و هر سه بار heading «درخواست شما در حال بررسی است»، state `لیست انتظار / رسید: لازم نیست` و زمان `۳ مهر ۱۴۰۵، ۱۱:۳۰` یکسان بود؛ 404/empty state رخ نداد. نتیجهٔ فعلی `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` به PASS runtime فعلی ارتقا یافت؛ فقط سابقهٔ مشاهدهٔ قدیمی در تاریخچه باقی است.
- Anonymous PDP evidence: پاسخ SSR عمومی North Ridge در rail فقط `۰ جای خالی` و قیمت را render می‌کند؛ در همان بخش CTA یا متن «لیست انتظار»/«ثبت درخواست لیست انتظار» وجود ندارد. این boundary مستقل از session، failure `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` را تأیید می‌کند.
- Final Exposure restore audit: سطح جزئیات عمومی پس از همهٔ تست‌ها با `مقصد`، `نحوه حمل‌ونقل` و `تور پولی` همگی `[checked]` و دکمهٔ ذخیره `[disabled]` (بدون تغییر pending) دیده شد. بنابراین mutationهای موقت `BUG-STG-019`, `BUG-STG-006` و `BUG-STG-036` restore شده‌اند؛ تنها متن locale خام به‌عنوان failure موجود باقی است.

## Current one-by-one closure matrix — ۲۰۲۶-۰۹-۲۷

### PASS روی artifact فعلی

- `BUG-STG-008 / 013`: PDP روش پرداخت، نوع تأیید ثبت‌نام و زمان شروع را render می‌کند؛ زمان شروع با قرارداد فعلی همان fixture بررسی شد.
- `BUG-STG-021`: duplicate مهمان در fixture معتبر با پیام داخل فرم متوقف شد و رکورد دوم ساخته نشد.
- `BUG-STG-025`, `BUG-STG-026 / 027`: label رایگان، فیلتر صفر و sort صعودی/نزولی در PLP درست است.
- `BUG-STG-006`: نمایش حمل پس از restore وابسته به Exposure است و حمل/دُنگ در PDP برمی‌گردد.
- `BUG-STG-081`: در session عضو، PLP قیمت `۱٬۰۰۰٬۰۰۰ تومان` و `50٪ تخفیف عضویت` را نشان می‌دهد.
- `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`: ردیف waitlist label مستقل «در لیست انتظار» دارد.
- `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC`: سه بار direct detail با query مستقل state/heading/time یکسان داشت؛ 404/empty state در recheck فعلی بازتولید نشد.
- `BUG-STG-037`: شمارندهٔ Waitlist و لیست عملیاتی در fixture فعلی با جدول همخوان است؛ PASS مشروط به همین fixture.
- `BUG-STG-EXPORT-SUMMARY`, `BUG-STG-014 / 015 / 016`: Excel واقعی واحد تومان، نوع حمل، تاریخ نهایی‌شدن و جمع بدهی تفکیک‌شده دارد.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: labelهای UI فارسی‌اند؛ delivery واقعی در scope نیست.
- `BUG-STG-RECEIPT-STATUS-LABEL-MIXED`: در fixtureهای بررسی‌شده label receipt و registration جدا render می‌شوند؛ projectionهای بعد از approve هنوز stale هستند و در بخش FAIL ثبت شده‌اند.
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS`: resubmit متنی heading ردشده را اصلاح کرد و status receipt جدا ماند؛ resubmit واقعی با فایل باینری در scope اجرا نشد.

### FAIL قطعی روی artifact فعلی

- `BUG-STG-082`: مبلغ دُنگ/نوع حمل در کارت PLP دیده نمی‌شود، درحالی‌که PDP آن را دارد.
- `BUG-STG-080`: free registration در Portal list و Admin projection هنوز payment-required/unpaid دیده می‌شود، با وجود detail `waived` و «نیازی به پرداخت نیست».
- `BUG-STG-019`: با مخفی‌کردن موقت payment در Exposure، اطلاعات payment و قیمت عضو در PDP باقی ماند؛ تنظیم در پایان restore شد.
- `BUG-STG-035`: structured data/Admin ساعت `۱۱:۳۰` و Public PDP ساعت `۱۰:۰۰` دارد.
- `BUG-STG-039 / 072`: detail پرداخت‌شده هنوز متن ارسال رسید و deadline دارد.
- `BUG-STG-039 / 072` recheck: Portal detail برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هم‌زمان `ثبت‌نام: تأیید شده`، `رسید: تأیید شده` و `پرداخت تأیید شد` دارد، اما متن stale `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` را هم نشان می‌دهد؛ Portal list `پرداخت باید تکمیل شود` و Admin `تأییدشده / پرداخت جزئی (رزرو)` با deadline نشان می‌دهد.
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`: Portal list بعد از approved receipt stale است.
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: Admin نیز همان booking را partial/unpaid نشان می‌دهد.
- `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY`: PDP و فرم مهمان ظرفیت‌پر copy/CTA صریح waitlist ندارند.
- `BUG-STG-022`: قیمت مهمان‌ها مستقل است، اما پس از انتخاب transport شخصی و dong برای دو participant، مبلغ حمل/دُنگ در summary اضافه نمی‌شود؛ failure runtime جدید.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: description خام انگلیسی `Start, summit, camp and end location zones.` باقی است.
- `BUG-STG-036`: redaction Exposure برای بعضی فیلدها slug خام نشان می‌دهد.
- `NEW-STG-WAITLIST-ACTION-REASON-LOCALE`: در جزئیات ردیف Waitlist دلیل ظرفیت با کلید خام `bookings.actionReason.capacityFull` نمایش داده می‌شود.

### OPEN / CONTRACT CHECK

- `BUG-STG-024`: UI فعلی مبالغ را تومان نمایش می‌دهد، اما لینک refund مشاهده‌شده `currency=IRR` دارد؛ بدون تعیین قرارداد canonical برای refund، closure end-to-end صادر نمی‌شود.

- Recheck مستقیم Finance برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: کل/پرداخت‌شده `۸۴۴٬۴۴۴ تومان` و مانده `۰ تومان` render شد، اما لینک `درخواست بازپرداخت` به‌صورت صریح `amountMinor=844444&currency=IRR` دارد. این evidence، `BUG-STG-024` را روی artifact فعلی `OPEN / CONTRACT CHECK` نگه می‌دارد.

- همان registration در Finance → `رسیدها` صف بررسی فیش را خالی (`۰ مورد`) نشان داد، درحالی‌که Portal detail برای همان ID `رسید: تأیید شده` دارد. این با نبودن pending receipt سازگار است و projection statusهای Portal/Admin را جدا از receipt queue نگه می‌دارد؛ هیچ receipt mutation انجام نشد.

### 2026-09-27 — current artifact checkpoint

- Deploy staging run `36308810354` و Phase 6 gate run `36312627474` هر دو `success` هستند و هر دو روی SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a` قرار دارند.
- `https://denali.shenski.com/health` در ساعت `۱۲:۳۸:۵۶` با HTTP `200` و body `{"ok":true}` پاسخ داد؛ `git diff --check` گزارش نیز پاس است.

### 2026-09-27 — checkpoint: شمارنده‌های Waitlist و لیست عملیاتی

- Admin Waitlist برای `North Ridge Trek`: فیلتر `در لیست انتظار` مقدار `۷`، heading `صف — صفحه 1 از 1 (۷ کل)` و list `۷ از ۷`؛ هر ردیف label `در لیست انتظار` دارد.
- Admin Workspace همان تور: `حرکت: ۳ مهر ۱۴۰۵ · ۱۱:۳۰`، ظرفیت `۱۲/۱۲ نفر`؛ خلاصهٔ عملیات `منتظر پرداخت ۸`، `لیست انتظار ۷` و `نهایی‌شده برای حضور ۴`؛ tab لیست عملیاتی `۱۲` و جدول `۱۲` ردیف دارد.
- نتیجهٔ فعلی `BUG-STG-037`: اختلاف شمارنده/فیلتر در fixture فعلی بازتولید نشد؛ `PASS مشروط به همین fixture`، closure تاریخی اختلاف fixture قبلی همچنان جداگانه نگه داشته شد.

### 2026-09-27 — checkpoint: Finance داخل Workspace

- Workspace → `پیگیری مالی`: متن summary برابر `۱۴ مهمان در انتظار پرداخت · ۳۵٬۰۰۰٬۰۰۰ تومان مانده` است.
- با بازکردن `خلاصه پرداخت‌های تور`: `مبلغ کل ۳۵٬۰۰۰٬۰۰۰ تومان · وصول‌شده ۰ تومان · باقی‌مانده ۳۵٬۰۰۰٬۰۰۰ تومان`؛ این محاسبه با ۱۴ × ۲٬۵۰۰٬۰۰۰ تومان سازگار است.
- اختلاف با summary لیست عملیاتی (`منتظر پرداخت ۸`) مشاهده شد؛ چون دو view دامنهٔ متفاوت دارند (مالیِ کل مهمان‌های دارای مانده در برابر فهرست عملیاتیِ افراد تأییدشده)، فعلاً `OBSERVATION / CONTRACT CHECK` است و باگ قطعی اعلام نشد.

### 2026-09-27 — recheck: چندنفره، قیمت و حمل در فرم مهمان

- صفحه: `https://portal.denali.shenski.com/catalog/b595933d-cf84-4d60-9f5d-f1072aa947cc/register`
- اقدام read-only: افزودن `مهمان 1` با دکمهٔ `افزودن همراه`؛ submit انجام نشد.
- مشاهدهٔ runtime: فرم برای مهمان `قیمت هر نفر: ۱۱٬۰۰۰٬۰۰۰ تومان` و `خودرو: ۱٬۰۰۰٬۰۰۰ تومان` نشان داد و متن `پرداخت هر نفر جداگانه انجام می‌شود` حاضر بود.
- مشاهدهٔ runtime: مبلغ دُنگ جداگانه در این سناریو نمایش داده نشد.
- نتیجهٔ `BUG-STG-022`: تفکیک مبلغ نفر/حمل در UI حاضر است، اما محاسبه/نمایش دُنگ چندنفره با این fixture closure کامل ندارد؛ `PARTIAL / CONTRACT CHECK REQUIRED`.

- Recheck تکمیلی `BUG-STG-022`: بدون submit، دو همراه در فرم اضافه شدند. برای هر دو `قیمت هر نفر: ۱۱٬۰۰۰٬۰۰۰ تومان` و `خودرو: ۱٬۰۰۰٬۰۰۰ تومان` render شد؛ مبلغ دُنگ جداگانه برای هیچ‌کدام نمایش داده نشد. قیمت‌ها بین همراهان یکسان ماند و تخفیف عضو به آن‌ها منتقل نشد.

### 2026-09-27 — checkpoint: مرکز مالی مستقل

- Finance → خلاصه برای `North Ridge Trek`: `پرداخت‌های دستی در انتظار ۳`، `رسیدهای در انتظار بررسی ۰` و `پرداخت‌های انجام‌شده ۳۰`.
- سطح نمایش مبالغ در UI تومان است؛ نمونه‌های نیازمند اقدام نیز `۲٬۵۰۰٬۰۰۰ تومان` و `۱۱٬۰۰۰٬۰۰۰ تومان` render شدند.
- نتیجهٔ `BUG-STG-024`: سطح UI فعلی PASS است؛ به‌دلیل مشاهدهٔ قبلی `currency=IRR` در لینک‌های refund، قرارداد API/لینک هنوز برای closure کامل باید اصلاح یا صریحاً تأیید شود.
- نتیجهٔ `BUG-STG-040`: در این لحظه صف receipt pending خالی است؛ متن فایل receipt واقعی در این checkpoint قابل تست نبود و مورد `UNVERIFIED` باقی ماند.

### 2026-09-27 — recheck: free registration در Portal list/detail

- Detail: `https://portal.denali.shenski.com/me/registrations/4190860a-9948-4c62-b29b-85d3e494e765` صریحاً `ثبت‌نام: تأیید شده`، `رسید: لازم نیست` و `نیازی به پرداخت نیست` نشان داد.
- همان registration در Portal list متن `برای نهایی‌شدن، پرداخت لازم است` نشان داد.
- نتیجهٔ `BUG-STG-080`: projection list هنوز stale/contradictory است؛ `FAIL قطعی` روی SHA فعلی باقی می‌ماند.

- Cross-check دوم: free guest registration `c26e18b7-bf20-4fce-a186-b874b0af9872` در detail و list هر دو `ثبت‌نام نهایی شده؛ پرداخت لازم نیست` / `رسید: لازم نیست` دارند. بنابراین `BUG-STG-080` برای همهٔ free رکوردها عمومی نیست، اما رکورد `4190860a-9948-4c62-b29b-85d3e494e765` projection stale دارد و باگ intermittent/account-specific باقی است.

### 2026-09-27 — recheck: fixture promotion گروهی

- Admin bookings برای `North Ridge Trek` با فیلتر `همه`: `۲۰ نتیجه` در `۱` صفحه؛ هر ۲۰ ردیف مقدار `۱ نفر` داشتند.
- هیچ ردیف `۲ نفر`، `۳ نفر` یا `۴ نفر` و هیچ fixture گروهی قابل promotion پیدا نشد؛ چند ردیف waitlist موجود نیز همگی یک‌نفره‌اند.
- نتیجهٔ `BUG-STG-063`: همچنان `UNVERIFIED`؛ بدون fixture واقعی گروه بزرگ‌تر از ظرفیت آزاد، approve/release اجرا نشد تا دادهٔ staging و ارسال‌های جانبی تغییر نکند.

- Admin guest-registration form برای North Ridge فیلد `تعداد نفرات` با مقدار پیش‌فرض `۱` و دکمهٔ `ایجاد ثبت‌نام در انتظار` دارد؛ این مسیر فقط تا مرحلهٔ preview خوانده شد و submit نشد. بنابراین وجود input به‌تنهایی fixture گروهی یا proof promotion محسوب نمی‌شود.

### 2026-09-27 — recheck: Excel export artifact

- فایل واقعی `/home/hamed/Downloads/denali-final-roster-20260927060500.xlsx` همچنان موجود است و SHA256 آن `3c2a262f04c7495fa8a551f26d49bd35e52b35daad8c2d879ef320b3d0b690da` باقی مانده.
- ساختار XLSX سالم است و workbook شامل شیت‌های متعدد و worksheetهای قابل‌خواندن است؛ نتیجهٔ قبلی `BUG-STG-EXPORT-SUMMARY` و `BUG-STG-014 / 015 / 016` بدون تغییر PASS می‌ماند.

### 2026-09-27 — recheck: PDP ظرفیت‌پر

- Public PDP `00000000-0000-4000-8000-000000000220` روی artifact فعلی `۰ جای خالی` و قیمت `۲٬۵۰۰٬۰۰۰ تومان` نشان داد.
- در AX صفحه هیچ متن یا CTA صریح `لیست انتظار` / `ظرفیت پر` دیده نشد؛ فقط برای session عضو لینک `مشاهده ثبت‌نام من` حاضر بود.
- نتیجهٔ `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY`: FAIL فعلی پابرجاست؛ evidence مستقل قبلی فرم مهمان نیز همین نبودن copy/CTA را تأیید می‌کند.

- Cross-check Admin Workspace: panel درخواست‌ها متن `ظرفیت پر است — ثبت‌نام جدید فرم عمومی در لیست انتظار ثبت می‌شود` و لینک `رفتن به لیست انتظار` را نشان می‌دهد. بنابراین copy داخلی Admin برای ظرفیت‌پر حاضر است؛ failure فعلی محدود به Public PDP و guest form است.

### 2026-09-27 — recheck: Exposure locale و event labels

- `https://admin.denali.shenski.com/settings/exposure` با سطح `جزئیات کاتالوگ عمومی` باز شد؛ هر ۱۲ فیلد انتخاب‌شده و دکمهٔ ذخیره disabled بود، بنابراین mutation انجام نشد.
- event labelهای قابل مشاهده فارسی بودند: `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ارسال رسید پرداخت`، `تأیید ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار`.
- بااین‌حال checkbox `نقطه شروع` همچنان description خام `Start, summit, camp and end location zones.` دارد؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` دوباره `FAIL runtime` شد.

### 2026-09-27 — recheck: PLP/PDP member pricing و transport

- PLP `/tours?sort=price_asc`: تور `ec171184-1877-4501-9a92-857f712838e2` قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و `50٪ تخفیف عضویت` را نشان داد؛ نوع حمل/دُنگ در کارت PLP نبود.
- PDP همان تور: `خودروهای مشترک`، هزینه حمل `۳۰۰٬۰۰۰ تومان` و هزینه دونگی `۳۰۰٬۰۰۰ تومان` را نشان داد؛ قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و تخفیف ۵۰٪ نیز حاضر بود.
- نتیجهٔ فعلی: `BUG-STG-081` PASS و `BUG-STG-082` FAIL قطعی.

### 2026-09-27 — recheck: free-pending payment path

- Free detail `4190860a-9948-4c62-b29b-85d3e494e765` در Portal صریحاً `ثبت‌نام: تأیید شده`، `رسید: لازم نیست` و `نیازی به پرداخت نیست` نشان داد.
- در AX این detail هیچ CTA پرداخت، فرم upload یا input فیش ندارد؛ بنابراین مسیر `free-pending` با fixture فعلی قابل بازتولید نیست و upload عمداً انجام نشد.
- نتیجهٔ `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`: `UNVERIFIED / NO FIXTURE`; ناسازگاری list آن رکورد همچنان در `BUG-STG-080` ثبت شده است.

### 2026-09-27 — recheck: Free PLP filter/sort/label

- PLP با `sort=price_asc` مقدار `۱۶ برنامه` و sort فعال `قیمت (کم به زیاد)` را نشان داد.
- دو fixture رایگان (`QA-STG-20260924-FREE-MANUAL` و `QA WAITLIST GROUP 20260927`) label `رایگان / بدون نیاز به پرداخت` داشتند.
- نتیجهٔ فعلی `BUG-STG-025` و `BUG-STG-026 / 027`: PASS runtime؛ مسیر desc قبلاً نیز با همان تعداد و label بررسی شده است.

### 2026-09-27 — recheck: PDP registration policy

- PDP تور `ec171184-1877-4501-9a92-857f712838e2` روش پرداخت `رسید / پرداخت آفلاین` و تأیید ثبت‌نام `دستی` را در بخش «پیش از ثبت‌نام» نشان داد.
- زمان شروع همین fixture `۲۰ مهر ۱۴۰۵، ۰:۳۰` و قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` با label تخفیف ۵۰٪ render شد.
- نتیجهٔ read-only `BUG-STG-008 / 013`: PASS فعلی؛ اختلاف timezone مربوط به North Ridge در `BUG-STG-035` جداست.

### 2026-09-27 — recheck: جزئیات ردیف Waitlist و action copy

- بازکردن read-only ردیف `QA Waitlist Fresh 20260925` نشان داد: وضعیت `در لیست انتظار`، ظرفیت `۱۲/۱۲` و تعداد نفرات `۱`.
- actionهای انتقال به‌صورت جدا و قابل تشخیص render شدند: `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت`؛ هیچ‌کدام اجرا نشد.
- دلیل ظرفیت به‌جای متن فارسی با کلید خام `bookings.actionReason.capacityFull` render شد؛ این یک localization failure مستقل در مسیر Waitlist است و باید کنار `BUG-STG-064 / 065` و copyهای Waitlist اصلاح شود.

### 2026-09-27 — recheck: جزئیات رزرو Waitlist در Admin

- booking `256183c5-9b73-492c-b8ea-290394c0e58b`: status `در لیست انتظار`، receipt/پرداخت `۰ تومان`، مانده `۰ تومان` و `مبلغ قابل پرداخت اکنون ۰ تومان`؛ خود صفحه توضیح می‌دهد رزرو هنوز تسویه نشده است.
- اطلاعات ثبت‌نام جداگانه `ثبت‌نام برای: دیگری` و `حمل‌ونقل: حمل سازمان‌یافته` را نشان داد؛ قاطی‌شدن registration/receipt یا label «تأییدشده» در این ردیف مشاهده نشد.
- هیچ action تأیید، رد یا لغو اجرا نشد.

### 2026-09-27 — recheck: timezone بین Public و Admin

- Public PDP North Ridge: `ساعت شروع: ۳ مهر ۱۴۰۵، ۱۰:۰۰`.
- Admin Workspace همان تور: `حرکت: ۳ مهر ۱۴۰۵ · ۱۱:۳۰` و ظرفیت `۱۲/۱۲`.
- اختلاف یک‌ونیم‌ساعته در همان deploy دوباره بازتولید شد؛ `BUG-STG-035` همچنان `FAIL قطعی` است.

### 2026-09-27 — recheck: Refund UI

- Finance → `بازپرداخت‌ها` روی staging فعلی عنوان `تنظیم مبلغ (واحد نمایش)` و تمام وضعیت‌های refund را فارسی نشان می‌دهد؛ در UI جاری مقدار خام `IRR` render نشد.
- این فقط PASS سطح UI است؛ چون refund fixture قابل‌تکمیل در صف نبود و مشاهدهٔ قبلی `currency=IRR` در لینک‌های refund از بین نرفته، `BUG-STG-024` برای قرارداد end-to-end همچنان `OPEN / CONTRACT CHECK` است.

### 2026-09-27 — supplemental observation: consistency در ویرایش تور و PDP تخفیف‌دار

- PDP عمومی تور `ec171184-1877-4501-9a92-857f712838e2` در session عضو: قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، label `تخفیف عضویت 50٪`، قیمت برای شما `۱٬۰۰۰٬۰۰۰ تومان`، حمل `خودروهای مشترک` و حمل/دُنگ هرکدام `۳۰۰٬۰۰۰ تومان`. این recheck، رفتار عضو برای `BUG-STG-081` را تأیید می‌کند؛ `BUG-STG-082` همچنان به‌دلیل نبود همین transport/dong در کارت PLP باز است.
- صفحهٔ Admin edit برای tour UUID `00000000-0000-4000-8000-000000000220` بدون save یا mutation باز شد. header مقدار `North Ridge Trek · ۳ مهر ۱۴۰۵ · ۱۱:۳۰ · ۲٬۵۰۰٬۰۰۰ تومان · ۱۲/۱۲` داشت، اما form مقدار نام `توچال یک روزه`، مقصد `توچال (تهران)`، ظرفیت `۲۴` و حمل `بدون حمل‌ونقل سازمان‌یافته` را نشان داد.
- این اختلاف بین header و مقادیر فرم در scope شناسه‌های اعلام‌شده نگاشت قطعی ندارد؛ فعلاً `OBSERVATION / DATA-CONSISTENCY CHECK` است و به‌عنوان باگ قطعی جدید اعلام نمی‌شود. ذخیرهٔ تغییرات عمداً انجام نشد.
- همان fixture در guest form، با وجود session عضو، برای مهمان `قیمت هر نفر: ۲٬۰۰۰٬۰۰۰ تومان` نشان داد و تخفیف عضو را به guest منتقل نکرد؛ بنابراین سناریوی «عضو تخفیف‌دار / مهمان بدون تخفیف» فعلاً درست است. submit انجام نشد.
- Cross-check fixture بدون تخفیف `b595933d-cf84-4d60-9f5d-f1072aa947cc`: PDP برای عضو `۱۰٬۰۰۰٬۰۰۰ تومان` و هیچ label تخفیفی نشان نداد؛ guest form نیز قیمت پایه را بدون تخفیف محاسبه کرد و با حمل اتوبوس `۱٬۰۰۰٬۰۰۰ تومان`، `قیمت هر نفر: ۱۱٬۰۰۰٬۰۰۰ تومان` نمایش داد. نتیجهٔ «تور بدون تخفیف برای هر دو نفر» PASS است؛ محاسبهٔ چندنفره هنوز به‌دلیل نبود submit/fixture گروهی در `BUG-STG-022` باز است.

### UNVERIFIED یا خارج از scope

- `BUG-STG-063`: fixture گروه چندنفرهٔ قابل promotion وجود ندارد؛ ساخت/approve/release به‌دلیل side effect انجام نشد.
- `BUG-STG-022`: تفکیک قیمت عضو/مهمان پاس است، اما محاسبهٔ transport/dong برای ثبت نهایی چندنفره کامل runtime نشده.
- `BUG-STG-064 / 065`: copy و status read-only بررسی شد؛ انتقال واقعی به waitlist با mutation اجرا نشد.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`: free-pending fixture پیدا نشد؛ upload/payment mutation انجام نشد.
- `BUG-STG-040`, upload واقعی PNG/PDF، approve/reject receipt، Telegram sendPhoto/sendDocument، thread، General و retry: طبق درخواست کاربر اجرا نشدند.
- `BUG-STG-044`: ظرفیت عمداً از قرارداد نمایش حذف شده و باگ محسوب نمی‌شود.
- `BUG-STG-001`, `BUG-STG-067` و `OBS-STG-FINANCE-BUSINESS-MEANING-ROLLOUT`: طبق قرارداد کاربر فعلاً باگ قطعی نیستند و retest فقط با تغییر قرارداد/تنظیمات لازم است.

## Coverage audit — همهٔ شناسه‌های فهرست اولیه

این فهرست برای جلوگیری از جاافتادن شناسه‌هاست؛ وضعیت آن باید با ماتریس بالاتر خوانده شود و تاریخچهٔ source-only به‌تنهایی closure محسوب نمی‌شود.

- PDP/PLP/Exposure: `008/013 PASS`، `081 PASS`، `082 FAIL`، `025 PASS`، `026/027 PASS`، `036 FAIL`، `019 FAIL`، `006 PASS`، `035 FAIL`، `ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE FAIL`، `ADMIN-TELEGRAM-EVENT-LABELS PASS در UI.
- Registration/Waitlist: `062/047 FAIL`، `WAITLIST-GUEST-FORM-COPY FAIL`، `021 PASS`، `022 PARTIAL/UNVERIFIED برای ثبت چندنفره`، `063 UNVERIFIED`، `064/065 UNVERIFIED برای transition واقعی`، `WAITLIST-TRANSPORT-STATUS-LABEL PASS`، `WAITLIST-PDP-STATE-NONDETERMINISTIC PASS مشروط به fixture فعلی`، `037 PASS مشروط به fixture فعلی`.
- Finance/receipt: `080 FAIL`، `FREE-MANUAL-PENDING-PAYMENT-PATH UNVERIFIED/NO FIXTURE`، `024 OPEN/CONTRACT CHECK`، `039/072 FAIL`، `040 UNVERIFIED و upload واقعی خارج از scope`، `RECEIPT-RESUBMIT-STALE-STATUS PASS read-only و resubmit باینری خارج از scope`، `RECEIPT-STATUS-LABEL-MIXED PASS در labelهای مستقل`، `PAID-LIST-PROJECTION-AFTER-APPROVE FAIL`، `ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE FAIL`، `EXPORT-SUMMARY PASS`، `014/015/016 PASS`.
- Telegram/file: labelهای Admin `PASS`؛ ارسال واقعی receipt تصویری/PDF، `message_thread_id`، عدم ارسال به General، retry و تطبیق `fileKey` با `sendPhoto`/`sendDocument` عمداً اجرا نشده و closure runtime ندارند.
- استثناهای قراردادی: `044` طبق تصمیم کاربر باگ نیست؛ `001`، `067` و `OBS-STG-FINANCE-BUSINESS-MEANING-ROLLOUT` فقط در صورت تغییر قرارداد/تنظیمات باید بازبینی شوند.

### 2026-09-27 — recheck: Exposure locale بدون mutation

- `https://admin.denali.shenski.com/settings/exposure` روی همان artifact باز شد. event labelهای قابل مشاهده همچنان فارسی‌اند: `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ارسال رسید پرداخت`، `تأیید ثبت‌نام`، `ایجاد ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار`.
- سطح «فهرست کاتالوگ عمومی» در حالت «نمایش پیش‌فرض» و با `۱۲ فیلد نمایش داده می‌شود` است؛ هیچ checkbox یا دکمه‌ای تغییر داده/ذخیره نشد.
- نتیجهٔ فعلی `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS = PASS در UI` و `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE = FAIL قبلی پابرجا` است؛ پنل جزئیات عمومی برای این recheck تغییر داده نشد.

### 2026-09-27 — recheck: Public PDP ظرفیت‌پر با query مستقل

- URL مستقیم `https://denali.shenski.com/tours/00000000-0000-4000-8000-000000000220?qa_recheck=20260927b` با refresh مستقل باز شد؛ AX مقدار `۰ جای خالی`، قیمت `۲٬۵۰۰٬۰۰۰ تومان` و حمل `بدون حمل‌ونقل` را نشان داد.
- در همان render هیچ متن یا CTA `لیست انتظار`، `ظرفیت پر` یا `ثبت درخواست لیست انتظار` وجود نداشت؛ فقط لینک `مشاهده ثبت‌نام من` برای session فعلی حاضر بود.
- نتیجهٔ `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY`: failure عمومی پابرجاست. چون session فعلی قبلاً registration دارد، transition یا submit مهمان عمداً انجام نشد.

### 2026-09-27 — recheck: free projection با query مستقل

- Detail مستقیم registration `4190860a-9948-4c62-b29b-85d3e494e765?qa_recheck=20260927c` صریحاً `ثبت‌نام شما نهایی شده است`، `برای این ثبت‌نام نیازی به پرداخت ندارید`، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` را render کرد.
- Portal list با همان query برای همان ID همچنان `تأیید شده ... برای نهایی‌شدن، پرداخت لازم است` نشان داد.
- نتیجهٔ `BUG-STG-080`: stale projection در list روی artifact فعلی دوباره بازتولید شد؛ `FAIL قطعی` پابرجاست. هیچ action مالی یا mutation انجام نشد.

### 2026-09-27 — recheck: approved receipt projection با query مستقل

- Detail registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a?qa_recheck=20260927d` هم‌زمان `ثبت‌نام: تأیید شده`، `رسید: تأیید شده` و `پرداخت تأیید شد` را نشان داد، اما متن stale `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` همچنان حاضر بود.
- همان detail deadline پرداخت `۱۴۰۵/۷/۳، ۲۲:۲۱:۱۶` و دکمهٔ `درخواست لغو` را نیز نشان داد؛ Portal list همان ID را `برای نهایی‌شدن، پرداخت باید تکمیل شود` render کرد.
- نتیجهٔ `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: failure projection/copy روی artifact فعلی پابرجاست. هیچ approve، resubmit یا cancel انجام نشد.

### 2026-09-27 — recheck: Admin projection همان booking

- Admin direct URL برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a?qa_recheck=20260927e` booking `QA Guest Discount 20260925` را با label `تأییدشده` اما `پرداخت جزئی (رزرو)` نشان داد.
- همان panel `مهلت پرداخت: ۴ مهر ۱۴۰۵`، ظرفیت `۸/۳۳`، متن `ثبت‌نام تأیید شده — پیگیری پرداخت در تب «پیگیری پرداخت»` و action `لغو رزرو` داشت؛ با Portal detail که `رسید: تأیید شده` و `پرداخت تأیید شد` دارد ناسازگار است.
- نتیجهٔ `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` با مدرک Admin تازه تأیید شد؛ هیچ action روی دکمهٔ لغو یا پرداخت اجرا نشد.

### 2026-09-27 — recheck: Finance payment/refund contract

- Finance → پرداخت‌ها با فیلتر registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` مقدار `کل ۸۴۴٬۴۴۴ تومان`، `پرداخت‌شده ۸۴۴٬۴۴۴ تومان` و `مانده ۰ تومان` را نشان داد.
- ردیف پرداخت `ثبت‌شده (این پرداخت)` است و صف «ثبت پرداخت دستی در انتظار» جدا نگه داشته شده؛ این تفکیک با receipt approved سازگار است.
- لینک `درخواست بازپرداخت` همچنان `amountMinor=844444&currency=IRR` دارد، درحالی‌که UI تومان render می‌کند؛ `BUG-STG-024 = OPEN / CONTRACT CHECK` پابرجاست.

### 2026-09-27 — recheck: PLP/PDP transport با query مستقل

- PLP `https://denali.shenski.com/tours?sort=price_asc&qa_recheck=20260927g` برای fixture `ec171184-1877-4501-9a92-857f712838e2` قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان` و قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` را نشان داد، اما کارت هیچ نوع حمل یا مبلغ دُنگی نداشت.
- PDP همان fixture در همان recheck، `خودروهای مشترک`، هزینه حمل `۳۰۰٬۰۰۰ تومان` و هزینه دُنگ `۳۰۰٬۰۰۰ تومان` را نشان داد.
- نتیجهٔ `BUG-STG-082`: اختلاف PLP/PDP دوباره با query مستقل بازتولید شد؛ `FAIL قطعی` پابرجاست.

### 2026-09-27 — recheck: timezone Public/Admin با query مستقل

- Public PDP North Ridge در `qa_recheck=20260927h`: `ساعت شروع: ۳ مهر ۱۴۰۵، ۱۰:۰۰`.
- Admin Workspace همان tour در همان recheck: `حرکت: ۳ مهر ۱۴۰۵ · ۱۱:۳۰` و ظرفیت `۱۲/۱۲`; همچنین copy داخلی «ظرفیت پر است — ثبت‌نام جدید فرم عمومی در لیست انتظار ثبت می‌شود» حاضر است.
- اختلاف `۱ ساعت و ۳۰ دقیقه` دوباره بازتولید شد؛ `BUG-STG-035 = FAIL قطعی`.

### 2026-09-27 — recheck: Admin Waitlist copy با query مستقل

- Workspace North Ridge با `tab=waitlist&qa_recheck=20260927i` مقدار ظرفیت `۱۲/۱۲ نفر` را نشان داد و tab `لیست انتظار` با badge `۷` فعال بود.
- copyهای فعلی: `صف ظرفیت — تأیید پس از آزاد شدن جا`، `مهمانانی که ظرفیت پر است — با تأیید به ثبت‌نام تأییدشده منتقل می‌شوند` و `ظرفیت تور پر است`.
- نتیجهٔ read-only برای copyهای `BUG-STG-064 / 065` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` مثبت است؛ transition واقعی/approve/release عمداً اجرا نشد و closure mutation محسوب نمی‌شود.

### 2026-09-27 — recheck: شمارندهٔ Waitlist و نمای عملیاتی با query مستقل

- فیلتر مستقیم Admin با `status=waitlisted` و `tourId=00000000-0000-4000-8000-000000000220&qa_recheck=20260927k`، وضعیت صف `در لیست انتظار`، heading `صف — صفحه 1 از 1 (۷ کل)` و list `۷ از ۷` را نشان داد؛ هر ۷ ردیف label `در لیست انتظار` داشتند.
- نمای `status=all&view=ops&qa_recheck=20260927j` برای همان تور `صف — صفحه 1 از 1 (۲۰ کل)` و `۲۰ نتیجه` نشان داد؛ بنابراین ۷ مورد Waitlist با ۲۰ نتیجهٔ کل اشتباه نشده و شمارنده/فیلتر داخلی سازگار است.
- نتیجهٔ `BUG-STG-037 = PASS مشروط به fixture فعلی`؛ اختلاف قبلی ۳ در برابر ۱۲ در این recheck بازتولید نشد. هیچ mutation یا action روی booking اجرا نشد.

### 2026-09-27 — recheck: فرم رزرو دستی برای fixture چندنفره

- Admin مسیر `bookings/new?tourId=00000000-0000-4000-8000-000000000220&qa_recheck=20260927m` باز شد؛ فرم صریحاً `ایجاد دستی رزرو در انتظار برای تور مدیریت‌شده`، فیلد `تعداد نفرات` با مقدار پیش‌فرض `۱` و دکمهٔ `ایجاد رزرو در انتظار` دارد.
- با وجود `tourId` در query، combo تور در این render هنوز `انتخاب تور` بود و تاریخ حرکت نیز انتخاب نشده بود؛ بنابراین این فرم در وضعیت فعلی fixture آمادهٔ submit معتبر برای گروه چندنفره نیست. نام/تعداد/تور/تاریخ تکمیل و submit عمداً انجام نشد.
- نتیجه: `BUG-STG-022` برای قیمت‌های participant read-only بررسی شده اما transport/dong در ثبت نهایی چندنفره هنوز closure ندارد؛ `BUG-STG-063` همچنان `UNVERIFIED` است و به fixture واقعی گروه بزرگ‌تر از ظرفیت آزاد + transition نیاز دارد.

### 2026-09-27 — recheck: cache/health گیت اجباری

- header صفحهٔ عمومی PDP با query مستقل `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` و `x-cache: BYPASS` بود؛ stale CDN cache به‌عنوان علت این نتایج ثبت نشد.
- artifact ثابت این sweep همان SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a` است؛ health معتبر ثبت‌شده برای همین artifact `https://denali.shenski.com/health` با HTTP `200` و body `{"ok":true}` است.
- تلاش جداگانه برای `api.denali.shenski.com/health` به DNS resolution نرسید؛ این hostname در شواهد staging معتبر محسوب نشد و جایگزین health موفق عمومی نشد.

### 2026-09-27 — contract check: `BUG-STG-024` با منبع کد

- در source، tenant Denali مقدار canonical commerce currency را `IRR` نگه می‌دارد؛ Finance UI در `formatMinorAmount` برای locale فارسی `IRR` را به «تومان» تبدیل می‌کند.
- لینک refund در `PaymentRow` عمداً `amountMinor` و `row.currency` را به‌صورت داخلی به URL می‌برد؛ بنابراین مشاهدهٔ `currency=IRR` به‌تنهایی خلاف قرارداد نیست و با UI تومان قابل‌تفسیر است.
- نتیجهٔ دقیق‌تر: `BUG-STG-024` با evidence فعلی باگ قطعی نیست؛ برای closure فقط باید قرارداد API/UI صریحاً مشخص کند که currency در deep-link داخلی باید ISO (`IRR`) بماند یا واحد نمایشی (`تومان`) شود. تا آن تصمیم، وضعیت `OPEN / CONTRACT CHECK` حفظ می‌شود.

### 2026-09-27 — recheck: `BUG-STG-022` با دو مهمان و transport/dong

- فرم مهمان fixture تخفیف‌دار `ec171184-1877-4501-9a92-857f712838e2?qa_recheck=20260927n` بدون submit باز شد؛ دو همراه اضافه شدند و برای هر دو `قیمت هر نفر: ۲٬۰۰۰٬۰۰۰ تومان` نمایش داده شد، یعنی تخفیف عضو به مهمان منتقل نشد.
- برای مهمان ۱ و مهمان ۲، `ماشین شخصی خودم` و سپس `۱ نفر` در بخش `تعداد افرادی که سوار می‌کنی (با هزینه دونگ)` انتخاب شد. هر دو کنترل انتخاب‌شده در AX با value `1` دیده شدند، اما خلاصه همچنان فقط قیمت پایه را نشان داد و هیچ مبلغ/ردیف transport یا dong اضافه نکرد.
- نتیجهٔ فعلی: `BUG-STG-022 = FAIL/PARTIAL runtime` برای محاسبهٔ قابل مشاهدهٔ حمل/دُنگ چندنفره؛ قیمت participantها مستقل است، اما هزینهٔ transport/dong در summary منعکس نمی‌شود. فرم تغییر داده شد ولی `ثبت درخواست` کلیک نشد و هیچ booking ساخته نشد.

### 2026-09-27 — recheck: free approved/detail و فرم مهمان

- PLP fixture `QA-STG-20260924-FREE-MANUAL` با شناسهٔ تور `c3a3c778-99ab-4750-8dc6-3172fa5ce034` با label `رایگان / بدون نیاز به پرداخت` پیدا شد.
- PDP همان fixture label `رایگان / بدون نیاز به پرداخت` و روش تأیید دستی را نشان داد؛ هیچ قیمت پرداختی در detail وجود نداشت.
- فرم مهمان همان تور، پس از افزودن یک مهمان بدون submit، `قیمت هر نفر: ۰ تومان` و `مبلغ هر ثبت‌نام: ۰ تومان` نشان داد؛ هیچ upload فیش، مقصد پرداخت، دکمهٔ ارسال رسید یا کنترل پرداختی در AX وجود نداشت. دکمهٔ `ثبت درخواست` دیده شد اما کلیک نشد.
- نتیجه: مسیر free approved/read-only برای `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` و بخش UI مربوط به `BUG-STG-080` PASS است؛ free-pending واقعی هنوز fixture ندارد و transition آن `UNVERIFIED` باقی می‌ماند.

### 2026-09-27 — recheck: Portal registration inventory برای free-pending

- Portal list با query مستقل `qa_recheck=20260927q` تعداد `۲۳` ثبت‌نام را نشان داد؛ freeهای قابل مشاهده (`QA Matrix Guest Free 20260925` و `QA Matrix Free Guest Fresh 20260925`) هر دو `تأیید شده` و `ثبت‌نام نهایی شده؛ پرداخت لازم نیست` هستند.
- سه ردیف `لیست انتظار` موجود همگی برای North Ridge هستند و هیچ free-pending در inventory فعلی وجود ندارد؛ بنابراین مسیر pending رایگان با fixture موجود قابل runtime closure نیست.
- همان فهرست برای free registration خودمان `4190860a-9948-4c62-b29b-85d3e494e765` هنوز `برای نهایی‌شدن، پرداخت لازم است` render می‌کند؛ `BUG-STG-080` stale projection دوباره تأیید شد. هیچ detail action یا mutation انجام نشد.

### 2026-09-27 — recheck: Waitlist CTA و guest-form copy با query مستقل

- PDP مستقیم North Ridge با `qa_recheck=20260927r` مقدار `۰ جای خالی` داشت، اما در AX هیچ `لیست انتظار`، `ظرفیت پر` یا `ثبت درخواست لیست انتظار` دیده نشد؛ فقط `مشاهده ثبت‌نام من` برای session فعلی حاضر بود.
- فرم مهمان همان تور با query مستقل نیز فقط خلاصهٔ `قیمت هر نفر: ۲٬۵۰۰٬۰۰۰ تومان` و دکمهٔ عادی `ثبت درخواست` (در وضعیت فعلی disabled) را نشان داد؛ هیچ copy ظرفیت‌پر یا انتقال به Waitlist وجود نداشت.
- نتیجهٔ `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY = FAIL قطعی`؛ submit یا mutation انجام نشد.

### 2026-09-27 — recheck: candidate inventory برای promotion گروهی

- Admin `status=all&tourId=00000000-0000-4000-8000-000000000220&view=ops&qa_recheck=20260927s`، `صف — صفحه 1 از 1 (۲۰ کل)` و `۲۰ نتیجه` را نشان داد.
- هر ۲۰ ردیف قابل مشاهده در AX مقدار `۱ نفر` داشتند؛ هیچ party size دو، سه یا چهار نفره‌ای برای promotion پیدا نشد. ردیف‌های Waitlist نیز همگی یک‌نفره‌اند.
- نتیجهٔ `BUG-STG-063`: منطق source/API قبلاً تست شده، اما staging runtime scenario «گروه بزرگ‌تر از ظرفیت آزاد» fixture ندارد؛ ساخت/approve/release انجام نشد چون mutation و side effect مجاز نیست.

### 2026-09-27 — recheck: Waitlist action guard بدون transition

- detail ردیف `256183c5-9b73-492c-b8ea-290394c0e58b` در ظرفیت `۱۲/۱۲`، actionهای `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` را نشان داد؛ status قبل از action `در لیست انتظار` بود.
- action برای مشاهدهٔ guard فراخوانی شد اما confirmation dialog/موفقیت نمایش داده نشد؛ پس از یک ثانیه و re-read، status همچنان `در لیست انتظار`، payment `پرداخت‌نشده (رزرو)` و ظرفیت `۱۲/۱۲` بود. دکمهٔ تأیید نهایی کلیک نشد و هیچ transition/mutation مشاهده نشد.
- نتیجهٔ `BUG-STG-064 / 065`: copy و guard read-only تأیید شد؛ transition واقعی عمداً بسته نشد چون side effect و ارسال جانبی خارج از scope است.

### 2026-09-27 — recheck: Waitlist history read-only

- در detail همان registration (`256183c5-9b73-492c-b8ea-290394c0e58b`) بخش `سابقه تغییرات` باز شد؛ UI صریحاً می‌گوید `نمای وضعیت فعلی — نه تاریخچهٔ کامل ممیزی`.
- شواهد قابل مشاهده: `ثبت درخواست ۳ مهر ۱۴۰۵، ۰۹:۴۲`، `وضعیت فعلی در لیست انتظار`، `تسویه رزرو پرداخت‌نشده (رزرو)` و `تاریخ حرکت ۳ مهر ۱۴۰۵`.
- نتیجه: برای `BUG-STG-064/065` و وضعیت Waitlist، snapshot فعلی و copy تأیید شد؛ audit trail کامل یا transition واقعی با این fixture قابل اثبات نیست و عمداً هیچ action نهایی اجرا نشد.

### 2026-09-27 — recheck: Finance outstanding read-only

- صفحهٔ `admin.denali.shenski.com/finance?tab=outstanding&qa_recheck=20260927u` با عنوان `مرکز مالی` و تب فعال `مانده بدهی` باز شد.
- قرارداد متنی صفحه روشن است: `مانده بدهی = پول هنوز بدهکار` و مبلغ فاکتور از سرور می‌آید؛ در همین snapshot دادهٔ ردیف/تغییر مالی جدیدی برای ثبت closure مشاهده نشد.
- نتیجه: این مرحله فقط projection/label read-only را تأیید کرد؛ approve receipt، refund، upload و هر mutation مالی اجرا نشد. FAILهای قبلی `080`، `039/072` و projectionهای Portal/Admin همچنان پابرجا هستند.

### 2026-09-27 — recheck: Portal registrations list read-only

- Portal list با query مستقل `https://portal.denali.shenski.com/me/registrations?qa_recheck=20260927v` تعداد `۲۳` ثبت‌نام را نشان داد؛ labelهای Waitlist برای سه رکورد `لیست انتظار` و ثبت‌نام‌های free سالم `ثبت‌نام نهایی شده؛ پرداخت لازم نیست` بودند.
- ناسازگاری‌ها دوباره قابل مشاهده بودند: free registration `4190860a-9948-4c62-b29b-85d3e494e765` هنوز `برای نهایی‌شدن، پرداخت لازم است` دارد؛ paid registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هنوز `برای نهایی‌شدن، پرداخت باید تکمیل شود` دارد؛ درحالی‌که detail/Finance برای آن paid/receipt approved و مانده صفر ثبت شده است.
- نتیجه: `BUG-STG-080` و `BUG-STG-039/072` و دو projection bug مربوط به Portal/Admin، روی artifact فعلی همچنان FAIL قطعی‌اند؛ هیچ action یا mutation اجرا نشد.

### 2026-09-27 — recheck: Exposure event labels و locale فیلدها

- صفحهٔ فارسی Exposure با query مستقل باز شد؛ labelهای event قابل مشاهده فارسی هستند: `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ارسال رسید پرداخت`، `تأیید ثبت‌نام`، `ایجاد ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار`.
- سطح `جزئیات کاتالوگ عمومی` بدون ذخیره باز شد و ۱۲/۱۲ فیلد انتخاب‌شده را نشان داد؛ checkbox `نقطه شروع` هنوز description خام `Start, summit, camp and end location zones.` دارد.
- نتیجه: `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` در سطح UI PASS است؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان FAIL قطعی است. هیچ checkbox یا تنظیمی تغییر داده نشد.

### 2026-09-27 — recheck: Receipt queue read-only

- Finance با تب `receipts` و query مستقل باز شد؛ heading `صف بررسی فیش` و پیام دقیق `فیشی در انتظار بررسی نیست` نمایش داده شد.
- در نتیجه fixture pending/rejected قابل بررسی برای approve/reject/resubmit در صف فعلی وجود نداشت؛ upload یا approve/reject عمداً اجرا نشد.
- نتیجه: `BUG-STG-040` و مسیر `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` برای binary/transition واقعی در این دور closure runtime ندارند؛ labelهای مستقل receipt/registration و stale projectionهای ثبت‌شدهٔ قبلی همچنان مبنای گزارش هستند.

### 2026-09-27 — mandatory deploy/cache gate recheck

- هر سه سطح staging با health معتبر پاسخ دادند: `denali.shenski.com/health`، `portal.denali.shenski.com/health` و `admin.denali.shenski.com/health` هر سه `HTTP 200` و body `{"ok":true}` داشتند؛ هر سه `x-cache: BYPASS` بودند.
- PDP عمومی همان tour نیز `HTTP 200` و `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` با `x-cache: BYPASS` داشت؛ بنابراین cache key/revalidation از header عمومی به‌عنوان cache hit قابل اثبات نیست و زمان revalidation در response ارائه نشده است.
- وضعیت evidence file: فقط `docs/qa/staging-manual-checklist-temp.md` modified است و `git diff --check` پاس شد.

### 2026-09-27 — mandatory QA gate ledger (explicit)

- artifact/deploy: run `36308810354`، gate run `36312627474`، SHA گزارش‌شدهٔ artifact `1b1a603a50ead104cb1b30b36f6324f6acac089a`؛ health هر سه host `200 {"ok":true}`.
- registration IDs مورد استفاده: free `4190860a-9948-4c62-b29b-85d3e494e765`، paid `f2144510-bc47-4d1f-b6ad-42002a6ac51a`، waitlist `256183c5-9b73-492c-b8ea-290394c0e58b`، duplicate existing `c508f22e-77bc-4e8f-8ce0-2ceab3c67fd7`.
- receipt/payment ID قابل مشاهده در Finance برای paid fixture: payment `4b7aa7ad-a7cd-4f40-bd55-2d5389ff64cb`؛ receipt ID مستقل در صف pending موجود نبود.
- API قبل/بعد approve یا resubmit: `SKIPPED / OUT OF SCOPE`؛ هیچ approve، reject، resubmit، upload یا mutation اجرا نشد، بنابراین response pair قبل/بعد برای این دور ادعا نمی‌شود.
- Portal detail/list، Admin و Finance: برای free و paid با URL/AX و وضعیت‌های جداگانه ثبت شده‌اند؛ mismatchهای فعلی در checkpointهای projection ثبت شده‌اند.
- capacity/Waitlist: fixture `North Ridge Trek` با ۷ ردیف Waitlist و ظرفیت `۱۲/۱۲` بررسی شد؛ هیچ گروه چندنفره برای promotion موجود نبود.
- screenshot/AX: AX snapshot برای صفحات کلیدی ثبت شد؛ screenshot باینری مستقل در این دور تولید نشد.
- cache/revalidation: health/PDP headerها `x-cache: BYPASS` و PDP `no-cache/no-store` بودند؛ cache key و زمان revalidation از response قابل استخراج نیست و `UNKNOWN` است.
- status تفکیک‌شده: free detail `registration=approved, receipt=not required`؛ paid detail `registration=approved, receipt=approved`؛ Admin/Portal list برای paid هنوز projection stale دارند.

### 2026-09-27 — recheck: promotion group-size fixture

- Admin Waitlist با فیلتر مستقیم `North Ridge Trek`، `۷` نتیجه نشان داد؛ هر ۷ ردیف `۱ نفر` و ظرفیت `۱۲/۱۲` بودند.
- هیچ ردیف `۲ نفر`، `۳ نفر` یا `۴ نفر` در صف فعلی وجود ندارد؛ بنابراین سناریوی `BUG-STG-063` (تأیید گروه بزرگ‌تر از ظرفیت آزاد هنگام promotion) با دادهٔ runtime موجود قابل بازتولید نیست.
- نتیجه: `BUG-STG-063` همچنان `UNVERIFIED / NO FIXTURE` است؛ ایجاد booking یا approve/release برای ساخت fixture عمداً انجام نشد.

### 2026-09-27 — coverage audit recheck

- شناسه‌های فهرست اولیه در ماتریس coverage به‌صورت گروهی پوشش داده شده‌اند: `008/013`، `062/047`، `064/065` و `039/072` نیز جداگانه در متن و evidenceهای runtime آمده‌اند؛ بنابراین نبودن بعضی suffixها در خروجی سادهٔ `rg -o` به‌معنای جاافتادن تست نیست.
- شناسه‌های قراردادی/استثنا (`044`، `001`، `067` و observation مالی) نیز صریحاً از باگ قطعی تفکیک شده‌اند. مورد جدیدی در audit شناسه‌ها پیدا نشد.

### 2026-09-27 — coverage audit: explicit ID aliases

- برای جلوگیری از حذف‌شدن شناسه‌ها در جست‌وجو یا انتقال گزارش، aliasهای مستقل زیر نیز صریحاً ثبت شدند: `BUG-STG-013` همراه `BUG-STG-008`، `BUG-STG-047` همراه `BUG-STG-062`، `BUG-STG-065` همراه `BUG-STG-064` و `BUG-STG-072` همراه `BUG-STG-039`.
- این تغییر فقط مستندسازی coverage است و نتیجهٔ تست یا وضعیت runtime را تغییر نمی‌دهد.

## آخرین ماتریس authoritative — ۲۰۲۶-۰۹-۲۷

این بخش آخرین evidence runtime همین deploy را خلاصه می‌کند؛ checkpointهای قدیمی‌تر برای تاریخچه نگه داشته شده‌اند و نباید بر این ماتریس غلبه کنند.

- **PASS runtime فعلی:** `BUG-STG-008/013` (payment/approval در PDP)، `BUG-STG-021`، `BUG-STG-025`، `BUG-STG-026/027`، `BUG-STG-006` در حالت visible، `BUG-STG-081`، `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`، `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` در recheck فعلی، `BUG-STG-037` با fixture فعلی، `BUG-STG-EXPORT-SUMMARY`، `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` در UI، `BUG-STG-RECEIPT-STATUS-LABEL-MIXED` در labelهای مستقل.
- **PASS runtime فعلی:** `BUG-STG-014/015/016`؛ آخرین XLSX واقعی واحد `تومان`، نوع حمل و timestamp نهایی‌شدن را دارد. هر snapshot قدیمی‌تر که `ریال` نشان می‌داد دیگر authoritative نیست.
- **FAIL قطعی runtime فعلی:** `BUG-STG-082`، `BUG-STG-080`، `BUG-STG-019`، `BUG-STG-035`، `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`، `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`، `BUG-STG-062/047`، `BUG-STG-WAITLIST-GUEST-FORM-COPY`، `BUG-STG-022`، `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`، `BUG-STG-036`.
- **PASS runtime فعلی:** `NEW-STG-WAITLIST-ACTION-REASON-LOCALE`؛ recheck جدید هر ۷ ردیف reason فارسی (`دیگری`/`خودم`) و action label فارسی نشان داد.
- **OPEN / CONTRACT:** `BUG-STG-024` به‌دلیل `currency=IRR` در refund deep-link؛ `BUG-STG-044` طبق تصمیم کاربر باگ نیست.
- **UNVERIFIED / fixture یا mutation لازم:** `BUG-STG-063`، transition واقعی `BUG-STG-064/065`، `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`، `BUG-STG-040` برای فایل واقعی، `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` برای resubmit باینری rejected receipt، ارسال واقعی Telegram و file delivery (`sendPhoto`/`sendDocument`/thread/General/retry).
- **خارج از retest فعلی مگر قرارداد عوض شود:** `BUG-STG-001`، `BUG-STG-067` و `OBS-STG-FINANCE-BUSINESS-MEANING-ROLLOUT`.

### 2026-09-27 — independent pricing triad recheck

- تور تخفیف‌دار `ec171184-1877-4501-9a92-857f712838e2` در session عضو: قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، تخفیف عضویت `۵۰٪`، قیمت برای عضو `۱٬۰۰۰٬۰۰۰ تومان`؛ PDP حمل مشترک و دُنگ `۳۰۰٬۰۰۰ تومان` را نیز نشان داد.
- تور رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034`: label `رایگان / بدون نیاز به پرداخت`، تأیید دستی و بدون مبلغ پرداخت.
- تور بدون تخفیف `b595933d-cf84-4d60-9f5d-f1072aa947cc`: قیمت `۱۰٬۰۰۰٬۰۰۰ تومان` بدون label تخفیف، حمل اتوبوس `۱٬۰۰۰٬۰۰۰ تومان` و تأیید خودکار.
- نتیجه: رفتار سه حالت قیمت پایه/عضو/رایگان در PDP سازگار است؛ کمبود transport/dong در PLP (`BUG-STG-082`) و projectionهای registration همچنان جداگانه باز هستند.

### 2026-09-27 — free guest form read-only recheck

- فرم مهمان رایگان با query مستقل باز شد؛ برای `مهمان ۱` قیمت هر نفر `۰ تومان` و مبلغ هر ثبت‌نام `۰ تومان` نمایش داده شد.
- در فرم هیچ upload فیش، مقصد پرداخت یا کنترل پرداخت دیده نشد؛ متن فرم صریحاً می‌گوید `پرداخت هر نفر جداگانه انجام می‌شود` اما مبلغ صفر است.
- نتیجه: مسیر free approved/read-only از نظر UI درست است؛ چون رکورد free-pending در staging موجود نیست و submit/upload اجرا نشد، `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` همچنان `UNVERIFIED / NO FIXTURE` باقی می‌ماند.

### 2026-09-27 — Portal detail projection recheck

- free detail `4190860a-9948-4c62-b29b-85d3e494e765`: `ثبت‌نام شما نهایی شده است`، `برای این ثبت‌نام نیازی به پرداخت ندارید`، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست`.
- paid detail `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: هم‌زمان `ثبت‌نام: تأیید شده`، `رسید: تأیید شده` و `پرداخت تأیید شد` را نشان داد، اما هنوز متن `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` و مهلت پرداخت دارد.
- نتیجه: اختلاف projection در detail نیز مستقل از list دوباره بازتولید شد؛ `BUG-STG-080` برای free رکورد account-specific و `BUG-STG-039/072` برای paid رکورد همچنان FAIL قطعی‌اند.

### 2026-09-27 — Admin + Finance paid projection recheck

- Admin detail برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` دوباره `تأییدشده` اما `پرداخت جزئی (رزرو)`، `مهلت پرداخت: ۴ مهر ۱۴۰۵` و متن `پیگیری پرداخت` را نشان داد.
- Finance → پرداخت‌ها برای همان registration: کل `۸۴۴٬۴۴۴ تومان`، پرداخت‌شده `۸۴۴٬۴۴۴ تومان`، مانده `۰ تومان` و ردیف `ثبت‌شده (این پرداخت)`.
- لینک refund همچنان `amountMinor=844444&currency=IRR` دارد.
- نتیجه: اختلاف چهار projection (Portal detail/list، Admin و Finance) دوباره ثبت شد؛ `BUG-STG-024` هنوز OPEN/CONTRACT CHECK و projection bugs هنوز FAIL هستند. هیچ refund یا mutation انجام نشد.

### 2026-09-27 — PLP free filter/sort independent recheck

- `/tours?minPrice=0&sort=price_asc` با `حداقل قیمت = ۰` و sort `قیمت (کم به زیاد)`، `۱۶ مورد` را نشان داد؛ fixture `QA-STG-20260924-FREE-MANUAL` با label `رایگان / بدون نیاز به پرداخت` در نتایج بود.
- `/tours?minPrice=0&sort=price_desc` نیز `۱۶ مورد` را نشان داد؛ همان fixture رایگان در نتایج بود و sort فعال `قیمت (زیاد به کم)` بود.
- نتیجه: `BUG-STG-025` و `BUG-STG-026/027` در این recheck runtime PASS هستند؛ `BUG-STG-044` همچنان طبق تصمیم کاربر از باگ‌ها خارج است.

### 2026-09-27 — full-capacity PDP/guest-form recheck

- Public PDP `North Ridge Trek` با query مستقل `qa_recheck=20260927ak` مقدار `۰ جای خالی` و هیچ CTA یا copy مربوط به `لیست انتظار` نشان نداد؛ فقط لینک `مشاهده ثبت‌نام من` حاضر بود.
- فرم Portal همان تور با `qa_recheck=20260927al` فقط `قیمت هر نفر: ۲٬۵۰۰٬۰۰۰ تومان` و دکمهٔ عادیِ غیرفعال `ثبت درخواست` را نشان داد؛ هیچ `ظرفیت پر`، `ثبت درخواست لیست انتظار` یا توضیح انتقال به صف دیده نشد.
- نتیجه: `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` دوباره FAIL قطعی شدند؛ هیچ submit یا mutation انجام نشد.

### 2026-09-27 — timezone/Public/Admin Workspace recheck

- Public PDP همان North Ridge با `qa_recheck=20260927ak` ساعت شروع `۳ مهر ۱۴۰۵، ۱۰:۰۰` را نشان داد.
- Admin Workspace با `qa_recheck=20260927am` حرکت `۳ مهر ۱۴۰۵ · ۱۱:۳۰` و ظرفیت `۱۲/۱۲ نفر` را نشان داد؛ copy داخلی `ظرفیت پر است — ثبت‌نام جدید فرم عمومی در لیست انتظار ثبت می‌شود` و لینک `رفتن به لیست انتظار` حاضر بود.
- نتیجه: `BUG-STG-035` همچنان اختلاف یک‌ونیم‌ساعتهٔ Public/Admin دارد؛ copy داخلی Admin برای Waitlist حاضر است و failure `062/047` محدود به Public PDP و guest form باقی می‌ماند.

### 2026-09-27 — Waitlist direct-detail stability recheck

- detail مستقیم registration `256183c5-9b73-492c-b8ea-290394c0e58b` با سه query مستقل `an1/an2/an3` هر سه با موفقیت باز شد؛ هیچ 404 یا empty state دیده نشد.
- هر سه بار دقیقاً `درخواست شما در حال بررسی است`، `ثبت‌نام: لیست انتظار`، `رسید: لازم نیست` و زمان `۳ مهر ۱۴۰۵، ۱۱:۳۰` را نشان دادند.
- نتیجه: `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` در artifact فعلی PASS runtime است؛ سابقهٔ 404 قدیمی در تاریخچه باقی می‌ماند و transition واقعی هنوز mutation نشده است.

### 2026-09-27 — operational transport view recheck

- Admin Workspace تب `لیست عملیاتی` با query مستقل باز شد؛ خود صفحه scope را `افراد تأییدشدهٔ تور` اعلام می‌کند و تب `لیست انتظار` جداگانه است.
- در این نمای عملیاتی هیچ ردیف Waitlist برای labelگذاری به‌عنوان تأییدشده وجود نداشت؛ Waitlist از مسیر جداگانهٔ صف نمایش داده می‌شود. خروجی Excel نیز صریحاً برای افراد نهایی‌شده تعریف شده است.
- نتیجه: `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در این fixture و scope فعلی PASS read-only است؛ transition یا promotion واقعی اجرا نشد.

### 2026-09-27 — latest XLSX artifact recheck

- آخرین فایل واقعی `/home/hamed/Downloads/denali-final-roster-20260927060500.xlsx` با SHA256 `3c2a262f04c7495fa8a551f26d49bd35e52b35daad8c2d879ef320b3d0b690da` خوانده شد؛ workbook پنج sheet دارد.
- `sharedStrings.xml` در summary و ردیف‌ها labelهای `مبلغ کل نهایی‌شده`، `مبلغ پرداخت‌شده نهایی‌شده`، `مبلغ مانده نهایی‌شده`، `تومان`، `نوع حمل‌ونقل` و `تاریخ نهایی‌شدن` را دارد و هیچ `ریال` خامی پیدا نشد.
- summary فایل: مبلغ کل نهایی‌شده `۱۰٬۰۰۰٬۰۰۰ تومان`، مبلغ مانده نهایی‌شده `۰ تومان` و مبلغ مانده بدهکار/پرداخت ناقص `۲٬۵۰۰٬۰۰۰ تومان`؛ بدهکارها جداگانه در شیت مربوط آمده‌اند.
- نتیجه: `BUG-STG-EXPORT-SUMMARY` و `BUG-STG-014/015/016` با آخرین فایل موجود PASS runtime هستند؛ snapshotهای قدیمی‌تر در تاریخچه باقی می‌مانند اما بر این evidence جدید غلبه ندارند.

### 2026-09-27 — GitHub Actions deploy SHA cross-check

- GitHub Actions API برای deploy run `36308810354` مقدار `head_sha=1b1a603a50ead104cb1b30b36f6324f6acac089a`، `status=completed` و `conclusion=success` را برگرداند.
- phase-6 gate run `36312627474` نیز دقیقاً همان `head_sha=1b1a603a50ead104cb1b30b36f6324f6acac089a`، `status=completed` و `conclusion=success` دارد.
- نتیجه: SHA artifact staging اکنون با منبع authoritative GitHub Actions تأیید شد؛ health و runtime evidence این sweep به همین SHA نسبت داده می‌شوند.

### 2026-09-27 — Refund UI/contract recheck

- Finance → `بازپرداخت‌ها` برای registration paid با query مستقل باز شد؛ UI label `تنظیم مبلغ (واحد نمایش)` و وضعیت‌های فارسی را نشان داد و هیچ `IRR`/`ریال` خامی در خود فرم دیده نشد.
- UI صریحاً می‌گوید فقط پرداخت دستی ثبت‌شده قابل refund است و هنوز `بازپرداختی نیست`؛ هیچ درخواست refund ثبت نشد.
- payment row مربوط به همین registration همچنان deep-link فنی `amountMinor=844444&currency=IRR` دارد؛ بنابراین `BUG-STG-024` در سطح UI PASS اما برای قرارداد end-to-end `OPEN / CONTRACT CHECK` باقی می‌ماند.

### 2026-09-27 — Admin guest-registration group fixture recheck

- فرم `ثبت‌نام مهمان` برای North Ridge با query مستقل باز شد؛ کنترل `تعداد نفرات` مقدار پیش‌فرض `۱` دارد و دکمه `ایجاد ثبت‌نام در انتظار` حاضر است.
- `تاریخ حرکت` هنوز انتخاب نشده و هیچ نام/تعداد/تاریخ یا submit انجام نشد؛ بنابراین فرم صرفاً امکان ساخت fixture را نشان می‌دهد و booking چندنفرهٔ واقعی ایجاد نشده است.
- نتیجه: `BUG-STG-063` همچنان `UNVERIFIED / NO FIXTURE` است؛ برای closure به fixture واقعی گروه بزرگ‌تر از ظرفیت آزاد و transition promotion نیاز دارد.

### 2026-09-27 — screenshot/AX gate for guest-registration form

- screenshot واقعی از `admin.denali.shenski.com/tours/00000000-0000-4000-8000-000000000220/register?qa_recheck=20260927aq` ثبت شد و فرم بصری `North Ridge Trek` را با تاریخ حرکت `۳ مهر ۱۴۰۵` نشان داد.
- AX همان صفحه کنترل `تعداد نفرات=۱`، نام مهمان خالی و button انتخاب تاریخ را گزارش کرد؛ بنابراین یک اختلاف representation بین screenshot و AX برای مقدار تاریخ وجود دارد و باید در QA/implementation جداگانه پیگیری شود.
- دکمه `ایجاد ثبت‌نام در انتظار` دیده شد اما کلیک نشد؛ هیچ booking یا side effectی ایجاد نشده است. `BUG-STG-063` همچنان برای گروه چندنفره unverified است.

### 2026-09-27 — final Exposure restore check

- Exposure با query مستقل باز شد؛ سطح `جزئیات کاتالوگ عمومی` مقدار `۱۲ از ۱۲ فیلد انتخاب شده` دارد و `ذخیره سطح` disabled است، یعنی تغییر pending وجود ندارد.
- checkboxهای `نحوه حمل‌ونقل`، `تور پولی` و `نقطه شروع` همگی checked و تنظیمات موقت قبلی restore شده‌اند؛ description خام `Start, summit, camp and end location zones.` همچنان به‌عنوان locale failure دیده می‌شود.
- نتیجه: هیچ mutation جدیدی انجام نشد؛ `BUG-STG-006/019/036` از نظر restore state پاک هستند، اما `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان FAIL است.

### 2026-09-27 — Exposure screenshot/AX final gate

- screenshot واقعی از صفحه Exposure با URL `https://admin.denali.shenski.com/settings/exposure?qa_recheck=20260927ar` ثبت شد؛ صفحهٔ فارسی و بخش‌های Exposure در تصویر قابل مشاهده بود.
- AX همان صفحه labelهای فارسی رویدادهای Telegram را نشان داد: `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت`، `ارسال رسید پرداخت`، `تأیید ثبت‌نام`، `ایجاد ثبت‌نام` و `قرارگرفتن ثبت‌نام در لیست انتظار`.
- سطح `جزئیات کاتالوگ عمومی` همچنان `۱۲ از ۱۲` فیلد انتخاب‌شده و دکمهٔ ذخیرهٔ disabled دارد؛ هیچ تغییر جدیدی ارسال نشد.
- نتیجه: `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` در UI فعلی PASS است؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` به‌علت description خام انگلیسی همچنان FAIL قطعی است.

### 2026-09-27 — requested-scope one-by-one coverage audit

تمام شناسه‌ها و معیارهای مستقل درخواست‌شده در این فایل حداقل یک checkpoint مستقل دارند. مواردی که هنوز closure ندارند:

- `BUG-STG-082`: FAIL؛ نوع حمل و دُنگ در کارت PLP با PDP منطبق نیست.
- `BUG-STG-080`: FAIL؛ projection ثبت‌نام رایگان برای یک رکورد در Portal list stale/متناقض است.
- `BUG-STG-019`: FAIL؛ مخفی‌سازی payment در Exposure اطلاعات مالی را در PDP حذف نکرد.
- `BUG-STG-035`: FAIL؛ ساعت Public و Admin برای همان تور ۹۰ دقیقه اختلاف دارد.
- `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: FAIL؛ وضعیت receipt/payment در projectionهای Portal و Admin stale است.
- `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY`: FAIL؛ PDP و فرم مهمانِ ظرفیت‌پر CTA/copy واقعی Waitlist ندارند.
- `BUG-STG-022`: FAIL/PARTIAL؛ participant price قابل مشاهده است اما transport/dong در ثبت چندنفرهٔ واقعی closure ندارد.
- `BUG-STG-036`: FAIL؛ redaction مقصد مقدار خام `mountain_multi` را نشان داد.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: FAIL؛ description انگلیسی خام باقی است.
- `NEW-STG-WAITLIST-ACTION-REASON-LOCALE`: PASS در recheck فعلی؛ reasonهای نمایش‌داده‌شده فارسی بودند (`دیگری`/`خودم`).
- `BUG-STG-024`: OPEN/CONTRACT؛ UI تومان است اما refund deep-link مقدار فنی `currency=IRR` دارد.

مواردی که برای تست نهایی نیازمند state یا fixture جدید هستند و عمداً side effect ایجاد نشد:

- `BUG-STG-063`: گروه بزرگ‌تر از ظرفیت آزاد و promotion واقعی؛ fixture موجود ندارد.
- `BUG-STG-064/065`: transition واقعی Waitlist به تأیید؛ نیازمند approve/release است.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`: free-pending واقعی؛ fixture موجود ندارد.
- `BUG-STG-040`: متن receipt فایل‌دار؛ صف receipt واقعی خالی بود.
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS`: resubmit باینری rejected receipt؛ خارج از scope این دور.
- Telegram delivery: ارسال واقعی receipt تصویری/PDF، حفظ `message_thread_id`، عدم ارسال به General، عدم تکرار retry و تطبیق `fileKey` با `sendPhoto`/`sendDocument`؛ همگی نیازمند ارسال واقعی و خارج از scope تأییدشده هستند.

موارد PASS یا مستثنا نیز در ماتریس authoritative بالا ثبت شده‌اند؛ هیچ موردی عمداً بدون وضعیت رها نشده است.

### 2026-09-27 — Waitlist action-reason locale recheck

- صف Waitlist برای North Ridge با query مستقل باز شد و `۷` ردیف داشت؛ هر ردیف state `در لیست انتظار` و ظرفیت `۱۲/۱۲` را نشان داد.
- reasonهای قابل مشاهده برای ردیف‌ها فارسی بودند (`دیگری` و `خودم`) و action labelها نیز فارسی بودند (`تأیید ... — برای تأیید دوباره کلیک کنید`، `رد ثبت‌نام`، `تأیید بدون نیاز به پرداخت` و غیره).
- هیچ دکمهٔ تأیید، رد، لغو یا انتقال کلیک نشد؛ نتیجهٔ `NEW-STG-WAITLIST-ACTION-REASON-LOCALE` در runtime فعلی `PASS` است.

### 2026-09-27 — receipt queue final read-only recheck

- Finance → `رسیدها` با query مستقل باز شد؛ پس از تکمیل load پیام دقیق `فیشی در انتظار بررسی نیست.` نمایش داده شد.
- بنابراین در artifact فعلی هیچ receipt واقعیِ pending برای بررسی متن فایل‌دار (`BUG-STG-040`) یا resubmit rejected receipt وجود ندارد؛ upload، approve، reject و resubmit انجام نشد.
- نتیجه: `BUG-STG-040` و مسیر resubmit باینری همچنان `UNVERIFIED / NO FIXTURE` هستند، نه PASS و نه FAIL جدید.

### 2026-09-27 — rejected-booking fixture search

- Admin bookings با فیلتر `status=rejected` و query مستقل باز شد؛ پیام `چیزی با این فیلترها پیدا نشد` نمایش داده شد.
- در نتیجه rejected registration/receipt قابل بازکردن برای بررسی resubmit stale در artifact فعلی وجود ندارد؛ هیچ فیلتر دیگری تغییر داده نشد و هیچ mutation انجام نشد.
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` همچنان `UNVERIFIED / NO FIXTURE` باقی می‌ماند.

### 2026-09-27 — staging artifact freshness recheck

- GitHub Actions API دوباره نشان داد آخرین `Deploy staging (dev)` با run `36308810354` روی SHA `1b1a603a50ead104cb1b30b36f6324f6acac089a` و conclusion `success` است؛ `phase-6-gate` run `36312627474` نیز دقیقاً همین SHA و `success` را دارد.
- `https://denali.shenski.com/health` در recheck جدید HTTP 200 و `{"ok":true}` داد؛ PDP همان تور نیز HTTP 200، `x-cache: BYPASS` و `no-cache/no-store` داشت.
- نتیجه: evidence runtime این sweep همچنان به همان artifact نسبت داده می‌شود و deployment drift مشاهده نشد.

### 2026-09-27 — public PDP/PLP runtime refresh

- Public PDP North Ridge با query `qa_recheck=20260927bg` دوباره `ساعت شروع: ۳ مهر ۱۴۰۵، ۱۰:۰۰`، `حمل‌ونقل: بدون حمل‌ونقل`، `روش پرداخت: رسید / پرداخت آفلاین`، `تأیید ثبت‌نام: دستی` و `۰ جای خالی` را نشان داد.
- Public PLP با query `sort=price_asc&qa_recheck=20260927bh`، sort فعال `قیمت (کم به زیاد)` و `۱۶ برنامه` را نشان داد؛ کارت North Ridge فقط قیمت/تاریخ/سختی/توان/ظرفیت را داشت و هیچ هزینه یا نوع transport نداشت.
- نتیجه: `BUG-STG-035` با evidence Public قبلیِ Admin همچنان FAIL است و `BUG-STG-082` به‌دلیل نبود transport/dong در card در برابر PDP همچنان FAIL runtime است.

### 2026-09-27 — Admin Workspace timezone/capacity runtime refresh

- Admin Workspace North Ridge با query `qa_recheck=20260927bi` دوباره `حرکت: ۳ مهر ۱۴۰۵ · ۱۱:۳۰` و ظرفیت `۱۲/۱۲ نفر` را نشان داد.
- همان صفحه copy داخلی `ظرفیت پر است — ثبت‌نام جدید فرم عمومی در لیست انتظار ثبت می‌شود` و لینک `رفتن به لیست انتظار` را نشان داد.
- نتیجه: اختلاف `۱۰:۰۰` در Public در برابر `۱۱:۳۰` در Admin در همان artifact همچنان `BUG-STG-035 = FAIL` است؛ copy داخلی Admin برای Waitlist حاضر است و failure `062/047` فقط در Public PDP/guest form باقی می‌ماند.

### 2026-09-27 — mandatory health/cache gate final refresh

- `denali.shenski.com/health`: HTTP 200، `x-cache: BYPASS`.
- `portal.denali.shenski.com/health`: HTTP 200، `x-cache: BYPASS`.
- `admin.denali.shenski.com/health`: HTTP 200، `x-cache: BYPASS`.
- Public PDP: HTTP 200، `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` و `x-cache: BYPASS`.
- cache key و زمان revalidation در responseها expose نشده‌اند؛ وضعیت آن‌ها همچنان `UNKNOWN` است.

### 2026-09-27 — free-tour booking inventory recheck

- Admin bookings برای fixture رایگان `QA-STG-20260924-FREE-MANUAL` با فیلتر مستقل باز شد؛ `۸` booking در یک صفحه وجود داشت.
- هفت ردیف `تأییدشده / بدون نیاز به پرداخت` بودند؛ یک ردیف شامل registration `4190860a-9948-4c62-b29b-85d3e494e765` با label متناقض `تأییدشده / پرداخت‌نشده (رزرو)` بود.
- هیچ ردیف free-pending واقعی با مسیر upload receipt پیدا نشد؛ بنابراین `BUG-STG-080` دوباره runtime FAIL و `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` همچنان `UNVERIFIED / NO FIXTURE` است.

### 2026-09-27 — discounted-tour booking inventory recheck

- Admin bookings برای تور تخفیف‌دار `ec171184-1877-4501-9a92-857f712838e2` با فیلتر مستقل فقط `۱` booking نشان داد؛ تعداد نفرات `۱`، وضعیت `تأییدشده` و label مالی `پرداخت‌نشده (رزرو)` بود.
- هیچ receipt rejected، booking چندنفره یا fixture promotion در این تور موجود نبود؛ بنابراین این inventory، closure جدیدی برای `BUG-STG-022` یا `BUG-STG-063` ایجاد نمی‌کند.
- هیچ booking یا وضعیت مالی تغییر داده نشد.

### 2026-09-27 — Telegram integration read-only recheck

- صفحهٔ اتصال‌های Admin با query مستقل باز شد؛ برای workspace یک اتصال جدید Telegram فعال و `۰` اتصال قدیمی گزارش شد.
- اتصال فعال به گروه مقصد `-1004292581496` اشاره دارد؛ وضعیت `تلگرام فعال است` و `توکن ربات ذخیره شده: بله` نمایش داده شد. توکن مقداردهی یا نمایش داده نشد.
- تنظیمات پیام به صفحهٔ Exposure ارجاع می‌دهد و labelهای رویداد در آن صفحه فارسی هستند؛ هیچ save، health-test یا ارسال پیام اجرا نشد.
- این evidence فقط وجود اتصال و مقصد غیر-General را تأیید می‌کند؛ حفظ `message_thread_id`، عدم تکرار retry و تطبیق `fileKey` با `sendPhoto`/`sendDocument` همچنان نیازمند ارسال واقعی و `UNVERIFIED / OUT OF SCOPE` است.

### 2026-09-27 — Telegram focused source-test rerun

- روی checkout فعلی با HEAD `f7fb81f4cb5627236bac897e90fabd8af02f9940`، تست‌های `telegram-provider.adapter.spec.ts` و `process-integration-delivery-once.spec.ts` اجرا شدند: `۲۴/۲۴ pass`، `۰ fail`.
- همین‌طور `telegram-api.client.spec.ts`، `telegram-webhook.update.spec.ts` و `telegram-forum.onboarding.spec.ts` اجرا شدند: `۱۹/۱۹ pass`، `۰ fail`.
- این suiteها به‌ترتیب mapping receipt bytes به media، انتخاب sendPhoto/sendDocument، `message_thread_id`، fail-closed برای General، topic recreation، retry بدون send دوم، parsing callback و provisioning topic را پوشش می‌دهند.
- این نتیجه source/integration است و چون checkout با artifact staging متفاوت است و ارسال واقعی به Telegram انجام نشده، جایگزین runtime proof staging نیست؛ gapهای delivery واقعی همچنان باز هستند.

### 2026-09-27 — Finance/receipt focused source-test rerun

- تست‌های focused وب برای finance payments، receipt logic، vocabulary/status separation، queue clarity/reliability و payment follow-up اجرا شدند: `۵۴/۵۴ pass`، `۰ fail`.
- پوشش شامل جدابودن وضعیت receipt از registration/payment، تشخیص image/PDF و basename از `fileKey`، empty-queue copy، FIFO/pagination، عدم invent کردن currency/total، و نمایش follow-up فقط برای approved unpaid/partial است.
- این نتیجه source/unit است و تناقض‌های runtime projection ثبت‌نام‌های staging (`BUG-STG-080`، `BUG-STG-039/072` و دو projection bug) را override نمی‌کند؛ آن‌ها همچنان با evidence runtime باز هستند.

### 2026-09-27 — API finance/receipt/projection focused rerun

- پنج spec API اجرا شد: `۱۲ pass`، `۰ fail`؛ `canonical projection sync` integration به‌علت نیاز محیط integration با `SKIP` گزارش شد و PASS اعلام نشد.
- coverage شامل upload route contract، offline receipt chain، payment status transitions، free approved collection sync و deriveTourProjections بود.
- این نتیجه source/contract است؛ `BUG-STG-040` و resubmit واقعی را نمی‌بندد و برای projectionهای stale همچنان runtime evidence staging authoritative است.

### 2026-09-27 — Portal receipt/payment focused source-test rerun

- تست‌های Portal برای receipt BFF، payment deadline و `BUG-STG-RECEIPT-STATUS-LABEL-MIXED` اجرا شدند: `۱۲/۱۲ pass`، `۰ fail`.
- پوشش شامل auth و body validation برای upload، proxy وضعیت receipt، forwarding workspace header، remaining/waived mapping، paymentDueAt و جدابودن label ثبت‌نام از receipt است.
- این نتیجه source/contract است؛ runtime stale projectionهای Portal روی staging همچنان طبق evidence قبلی باز باقی می‌مانند.

### 2026-09-27 — Exposure/Waitlist/Roster focused source-test rerun

- اجرای اولیهٔ batch با `۳۳ pass / ۵ fail` متوقف شد؛ هر ۵ failure از `operational-roster-api-contract` و `401` ناشی از نبودن `NODE_ENV=test` در command بود، نه شکست قرارداد.
- پس از rerun با profile رسمی `NODE_ENV=test STORAGE_DRIVER=memory ...` همان spec با `۶/۶ pass` و `۰ fail` اجرا شد.
- در همان batch، exposure redaction/multi-surface/fail-closed، booking pagination، waitlist promotion، operational roster projection و enrichment نیز pass شدند؛ فقط تست Postgres pagination به‌علت نبود `DATABASE_URL` به‌درستی `SKIP` شد.
- نتیجهٔ معتبر این checkpoint: failure اولیه false negative محیط اجرا بود؛ هیچ باگ جدیدی از این batch نتیجه‌گیری نمی‌شود.

### 2026-09-27 — Exposure/Waitlist/Roster corrected full rerun

- همان batch کامل با profile رسمی `NODE_ENV=test STORAGE_DRIVER=memory` دوباره اجرا شد: `۳۸ pass`، `۰ fail`.
- یک تست Postgres-specific pagination به‌علت نبود `DATABASE_URL` `SKIP` ماند؛ این skip جدا از ۳۸ تست pass است.
- پوشش معتبر این اجرا شامل exposure redaction/multi-surface/fail-closed، waitlist promotion و party-size guard مربوط به `BUG-STG-063`، booking pagination، roster API/XLSX contract، roster projection و enrichment است.

### 2026-09-27 — Web Exposure/PLP focused source-test rerun

- تست‌های Web مربوط به Exposure selection/catalog/simulation، Denali surfaces UI، Telegram event list، localize exposure fields و tour-list category اجرا شدند: `۴۳/۴۳ pass`، `۰ fail`.
- تست source صراحتاً localization فارسی `location-zones` را pass می‌کند، اما runtime staging در Admin هنوز description خام `Start, summit, camp and end location zones.` را نشان می‌دهد؛ بنابراین `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان runtime FAIL است و source pass آن را override نمی‌کند.
- قراردادهای PLP category/filter و Exposure UI در source سبز هستند؛ `BUG-STG-082` همچنان به اختلاف runtime PLP/PDP transport/dong وابسته است.

### 2026-09-27 — Admin roster/export UI focused source-test rerun

- تست‌های Web برای operational roster، export، bookings prefetch، Admin payment card و finance receipt panel اجرا شدند: `۳۱/۳۱ pass`، `۰ fail`.
- پوشش شامل scope تب حمل‌ونقل، خارج‌بودن Waitlist از final/approved، فیلترهای roster، timestamp filename، Excel export، payment follow-up و جدابودن registration approval از payment action است.
- این source/UI نتیجهٔ `BUG-STG-037` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` را در قرارداد فعلی تأیید می‌کند؛ runtime fixture فعلی نیز همان موارد را PASS مشروط نشان داده است.

### 2026-09-27 — Portal registration/Waitlist focused source-test rerun

- تست‌های Portal برای catalog registration، guest intake، registration resume، member registrations، Waitlist CTA contract، payment/receipt lifecycle و registration BFF اجرا شدند: `۴۷/۴۷ pass`، `۰ fail`.
- source contract برای `BUG-STG-062/047` اکنون CTA صریح Waitlist را تضمین می‌کند، و برای `BUG-STG-080` approved free registration نباید payment status نشان دهد؛ بااین‌حال runtime staging برای همان registration هنوز projection stale دارد و FAIL runtime پابرجاست.
- source contract برای `BUG-STG-035` timezone business و `BUG-STG-039/072` payment projection سبز است، ولی mismatchهای مشاهده‌شده در staging همچنان evidence قوی‌تر و authoritative هستند.

### 2026-09-27 — Web booking operations focused source-test rerun

- تست‌های Web برای guest/admin registration، action availability، approve/create، transport logic، booking matrix و localized queue statuses اجرا شدند: `۳۳/۳۳ pass`، `۰ fail`.
- پوشش شامل capacity hint، waitlist/cancel permutations، payment label separation، transport cost/dong، validation و payload ساخت booking، و حذف actionهای operator برای non-admin است.
- این source/UI نتیجهٔ contract را تأیید می‌کند، اما approve واقعی، promotion واقعی و ثبت چندنفرهٔ staging همچنان عمداً اجرا نشده‌اند.

### 2026-09-27 — API guest/capacity/duplicate focused source-test rerun

- تست‌های API برای capacity، guest registration، duplicate uniqueness، transport intake، approve-capacity و guest slice اجرا شدند: `۴۷/۴۷ pass`، `۰ fail`.
- پوشش شامل `BUG-STG-021` (duplicate member/guest و HTTP 409)، free/paid و manual/auto outcomes، member discount freeze، waitlist when full، party-size capacity guard و transport intake است.
- این source/API نتیجهٔ قرارداد را تأیید می‌کند، اما `BUG-STG-022` در runtime چندنفره و promotion واقعی `BUG-STG-063` همچنان نیازمند fixture/اجرای واقعی باقی می‌مانند.

### 2026-09-27 — Finance export/refund/currency focused source-test rerun

- تست‌های Web مربوط به refund/invoice: `۱۷/۱۷ pass`، `۰ fail`.
- تست‌های API مربوط به final roster export، invoice balance، refund orchestration، invoice facts و currency boundary: `۲۳/۲۳ pass`، `۰ fail`؛ یک integration invoice spec به‌دلیل نیاز DB `SKIP` بود.
- `EXPORT-SUMMARY` و `BUG-STG-014/015/016` در source/export contract سبز هستند؛ refund orchestration نیز idempotent است.
- source عمداً currency پیش‌فرض `IRR/USD` جعل نمی‌کند، اما deep-link runtime فعلی `currency=IRR` را نشان می‌دهد؛ بنابراین `BUG-STG-024` همچنان `OPEN / CONTRACT CHECK` است.

### 2026-09-27 — receipt/Telegram chain focused source-test rerun

- تست‌های API برای Telegram registration/receipt chain، member receipt flow، duplicate finance identity و finance exit اجرا شدند: `۱۶/۱۶ pass`، `۰ fail`.
- پوشش شامل receipt قبل/بعد upload، مالکیت member، جلوگیری از foreign access، pending receipt، جلوگیری از upload در approve-then-pay، projection update contract و routing رویدادهای receipt به topic است.
- این source/integration proof است؛ ارسال واقعی Telegram، receipt binary واقعی و مشاهدهٔ message/thread در staging هنوز عمداً انجام نشده‌اند.

### 2026-09-27 — source remediation checkpoint before final staging sweep

- `BUG-STG-036` اصلاح شد: redaction مقصد علاوه بر `category` و `destinationLabel`، `listSubtitle` را نیز پاک می‌کند تا slug داخلی از هیچ سطح کارت عمومی یا JSON-LD بازنشر نشود. regression با `mountain_multi` سبز است؛ Exposure/card/localization suite این checkpoint `۱۷/۱۷ pass` شد.
- `BUG-STG-022` با source contractهای participant pricing، API route، Denali obligation و Finance quote تأیید شد: تخفیف فقط برای `self`، مهمان بدون تخفیف، و lineهای `transport`/`dong` جداگانه است؛ این checkpoint `۸ + ۹ + ۱۱ + ۴` تست مرتبط را پاس کرد.
- projection/status/waitlist source suites نیز سبز شدند: Portal `۴/۴`، API Finance `۱۵/۱۵`، Web Admin `۱۱/۱۱`، Marketing `۱۶/۱۶`، Portal Waitlist `۷/۷` و Denali Waitlist/locale `۱۳/۱۳`.
- این checkpoint staging را نمی‌بندد؛ `BUG-STG-080/082/019/035/039/072`، دو projection، Waitlist runtime و locale runtime فقط پس از deploy نهایی با SHA واقعی قابل closure هستند.

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
- input واقعی Portal نوع‌های image و PDF را با accept image/\*,.pdf اعلام می‌کند، اما در این اجرای browser file chooser قابل set شدن نبود؛ بنابراین upload باینری PNG/PDF به‌عنوان PASS ثبت نشد.
- fixture در پایان در وضعیت pending باقی ماند و approve انجام نشد.

## Remaining API contract verification — ۲۰۲۶-۰۹-۲۷

- Operational roster/export API، registration capacity و booking-management matrix: ۱۷/۱۷ pass؛ waitlist when full، rejection when full، filterهای roster، XLSX contract و dispatcher action/status پوشش داده شدند.
- این تست‌ها failure source جدیدی نشان ندادند. upload باینری، approve مالی و Telegram delivery همچنان فقط با runtime mutation واقعی قابل closure هستند.

## Receipt binary/Telegram source gate — ۲۰۲۶-۰۹-۲۷

- API receipt upload، ownership/authz، BFF binary proxy و P6 offline receipt flow: ۴۳/۴۳ pass.
- پوشش شامل putProof بعد از authorization، cleanup در خطای submit، GET pending بعد از upload، جلوگیری از upload برای مالک دیگر و approval projection است.
- Telegram adapter/worker نیز در همین اجرا sendPhoto/sendDocument multipart، fileKey، topic/thread، stale-thread recovery، General fail-closed و retry بدون send دوم را pass کرد.
- بنابراین source contract برای upload و Telegram استاندارد و سبز است؛ تنها تأیید باقی‌مانده، اجرای واقعی PNG/PDF و delivery روی staging با artifact جدید است.
