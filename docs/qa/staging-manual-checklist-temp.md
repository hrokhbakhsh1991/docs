# چک‌لیست موقت QA Staging — تفکیک وضعیت

تاریخ: ۲۰۲۶-۰۹-۲۶

این فایل سه وضعیت کاملاً جدا دارد:

- بخش A: باگ قطعی و هنوز اصلاح‌نشده در source.
- بخش B: هنوز قطعی نشده؛ فقط باید توسط QA بررسی و نتیجه‌گذاری شود.
- بخش C: source اصلاح شده، اما بسته‌شدن staging هنوز نیازمند deploy و ریتست است.

هیچ موردی نباید هم‌زمان در دو بخش قرار بگیرد.

## Current runtime snapshot — ۲۰۲۶-۰۹-۲۸

این بخش آخرین وضعیت مستقیم staging را خلاصه می‌کند؛ بخش‌های پایین‌تر ledger تاریخی هستند.

### Current authoritative classification — ۲۰۲۶-۰۹-۲۸

**FAIL قطعی فعلی:**

- `BUG-STG-080`
- `BUG-STG-039 / 072`
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`
- `BUG-STG-019 / 036`
- `BUG-STG-082`
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`
- `BUG-STG-021` (submit واقعی پیام duplicate/partial-success متناقض با دو رکورد ساخته‌شده)
- `BUG-STG-037` (badge فیلتر ۸، اما heading و جدول همان تور ۱ رکورد)
- `BUG-STG-022` (مبلغ نهایی guestها با preview قرارداد همخوان نیست و guest با قیمت عضو ثبت شده)
- `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` (receipt approved است اما heading هنوز ارسال receipt را می‌خواهد)

**PASS در staging یا read-only معتبر:**

- `BUG-STG-008 / 013 / 035`
- `BUG-STG-025`
- `BUG-STG-026 / 027`
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`
- `BUG-STG-062 / 047`
- `BUG-STG-WAITLIST-GUEST-FORM-COPY`
- `BUG-STG-064 / 065`
- `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`
- `BUG-STG-081`

**PASS محدود / نیازمند closure تکمیلی:**

- `BUG-STG-063`: جلوگیری از promotion گروه بزرگ‌تر از ظرفیت و promotion موفق بعد از آزادشدن ظرفیت PASS؛ feedback قابل مشاهده و idempotent retry هنوز جداگانه بسته نشده است.

**UNVERIFIED / fixture یا سرویس لازم:**

- approve نهایی receipt روی همان fixture پس از resubmit (برای projection مالی بعد از approve؛ pending fixture فعلی وجود ندارد)
- Telegram و ارسال فایل واقعی (خارج از scope این batch)

### Finance receipt/outstanding recheck — ۲۰۲۶-۰۹-۲۸

- Finance در `tab=outstanding` همچنان برای fixtureهای `QA Pricing Guest One 20260928` و `QA Pricing Guest Two 20260928` ماندهٔ بدهی نشان می‌دهد؛ به‌ترتیب `۸۴۴٬۴۴۴` و `۵۰۰٬۰۰۰` تومان، با وصول‌شدهٔ صفر. این با preview قبلی guestها (`۱٬۳۴۴٬۴۴۴` و `۱٬۰۰۰٬۰۰۰`) سازگار نیست و evidence جاری `BUG-STG-022` باقی می‌ماند.
- Finance در `tab=receipts` پیام `فیشی در انتظار بررسی نیست` را نشان داد؛ بنابراین approve واقعی receipt پس از resubmit در این sweep قابل اجرا نبود و `approve-after-resubmit` همچنان `UNVERIFIED` است.
- این بررسی read-only بود و هیچ mutation مالی انجام نشد.

### Finance payments projection recheck — ۲۰۲۶-۰۹-۲۸

- در `tab=payments` پرداخت مربوط به registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` با مبلغ `۸۴۴٬۴۴۴` تومان و وضعیت `ثبت‌شده (این پرداخت)` دیده شد، در حالی که Portal همان registration را receipt-approved/payment-approved نشان می‌دهد و heading آن هنوز ارسال receipt را می‌خواهد.
- Finance هم‌زمان چند payment با وضعیت `در انتظار (این پرداخت)` دارد، اما تب `receipts` صف pending را خالی اعلام می‌کند؛ این دو وضعیت مستقل‌اند و نشان می‌دهند برای approve-after-resubmit باید fixture receipt pending واقعی ساخته یا پیدا شود، نه اینکه payment pending به‌جای آن استفاده شود.
- نتیجه: جداسازی payment/receipt برای closure نهایی هنوز کافی نیست؛ `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` و projectionهای approve همچنان باز هستند.

### Portal final state recheck — ۲۰۲۶-۰۹-۲۸

- Portal برای registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` هم‌زمان `ثبت‌نام شما تأیید شده است`، `رسید: تأیید شده` و `پرداخت تأیید شد` را نشان می‌دهد، اما در همان heading/body عبارت `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` باقی است.
- این recheck مستقل از Finance همان ناسازگاری را تأیید کرد؛ `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` همچنان FAIL قطعی است.

### Portal List projection recheck — ۲۰۲۶-۰۹-۲۸

- Portal List برای registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` متن `برای نهایی‌شدن، پرداخت باید تکمیل شود` نشان می‌دهد، در حالی‌که Detail همان رکورد `رسید: تأیید شده` و `پرداخت تأیید شد` دارد؛ این evidence اضافی برای `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-039 / 072` است.
- Portal List برای free registration `4190860a-9948-4c62-b29b-85d3e494e765` متن `برای نهایی‌شدن، پرداخت لازم است` نشان می‌دهد، در حالی‌که Detail آن `نیازی به پرداخت ندارید` و `رسید: لازم نیست` دارد؛ `BUG-STG-080` همچنان باز است.
- registration پروموت‌شدهٔ Waitlist `9b676ad8-08f3-48a0-bf47-1494b42bd9af` نیز در List `برای نهایی‌شدن، پرداخت لازم است` دارد، در حالی‌که Detail آن ثبت‌نام رایگان و بدون رسید را نشان می‌دهد؛ این mismatch مرتبط با projection بعد از promotion است.

### Admin booking detail projection recheck — ۲۰۲۶-۰۹-۲۸

- Admin Detail برای registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` هم‌زمان `تأییدشده` و `پرداخت جزئی (رزرو)` نشان می‌دهد.
- جزئیات پرداخت همان صفحه مقدار فاکتور `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴`، مانده بدهی `۰` و مبلغ قابل پرداخت اکنون `۰` را نشان می‌دهد، اما متن `رزرو پرداخت جزئی است ... هنوز مانده دارد` باقی است.
- نتیجه: state عددی paid/zero و label/body عملیاتی یکسان نیستند؛ `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` و `BUG-STG-039 / 072` همچنان FAIL هستند.

### Admin free registration recheck — ۲۰۲۶-۰۹-۲۸

- Admin Detail برای free registration `4190860a-9948-4c62-b29b-85d3e494e765` آن را `تأییدشده` اما `پرداخت‌نشده (رزرو)` نمایش می‌دهد و متن `ثبت‌نام تأیید شده — پیگیری پرداخت` دارد.
- این با Portal Detail همان fixture (`رایگان / بدون نیاز به پرداخت`) و Portal List (`برای نهایی‌شدن، پرداخت لازم است`) ناسازگار است؛ `BUG-STG-080` در Admin نیز بازتولید شد.

### Receipt-rejected fixture recheck — ۲۰۲۶-۰۹-۲۸

- رکوردی که با عنوان `QA Matrix Receipt Reject` و registration `b254c01f-e5ce-4a27-b7d4-202b9a4fd432` در Portal باز شد، در runtime فعلی `ثبت‌نام: تأیید شده` و `رسید: تأیید شده`، heading `سفر شما نهایی شده است` و body `پرداخت تأیید شد` دارد.
- بنابراین این fixture در حال حاضر rejected نیست و برای سناریوی `receipt rejected` معتبر نیست؛ تست rejected برای `BUG-STG-039 / 072` همچنان نیازمند fixture rejected واقعی است.
- این مورد به‌عنوان `fixture mismatch / UNVERIFIED` ثبت شد و باگ جدیدی از آن نتیجه‌گیری نشد.

### P2 transport PLP/PDP recheck — ۲۰۲۶-۰۹-۲۸

- PLP برای تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` فقط قیمت‌های `۱٬۰۰۰٬۰۰۰` و `۵۰۰٬۰۰۰` و تخفیف عضویت را نشان می‌دهد؛ در AX کارت هیچ label یا مبلغی برای `خودروهای مشترک`/دونگ وجود ندارد.
- PDP همان تور حمل `خودروهای مشترک` و مبلغ `۳۴۴٬۴۴۴ تومان` را در بخش summary و logistics نشان می‌دهد و قیمت عضو `۵۰۰٬۰۰۰` را نیز نمایش می‌دهد.
- نتیجه: اختلاف سطح PLP/PDP برای نوع حمل و مبلغ دُنگ در artifact فعلی دوباره تأیید شد؛ `BUG-STG-082` همچنان FAIL قطعی است.

### Duplicate registrations Portal recheck — ۲۰۲۶-۰۹-۲۸

- هر دو registration `27146c0c-dba3-4b0f-b1cb-e1c6e3efa00d` (مسافر `QA Duplicate Guest 20260927`) و `429c332b-cf58-4443-8485-b7fe85dfd822` (مسافر `QA Duplicate Exact 20260927`) در Portal قابل باز شدن هستند.
- هر دو رکورد برای یک سناریوی duplicate موجودند و هر دو در runtime فعلی `ثبت‌نام شما بسته شده است` / `ثبت‌نام: لغو شده` هستند؛ وجود دو رکورد پس از submit duplicate همچنان evidence runtime برای `BUG-STG-021` است، حتی اگر رکوردها بعداً لغو شده باشند.

### Operational waitlist counter recheck — ۲۰۲۶-۰۹-۲۸

- Global Admin Bookings با فیلتر `status=waitlisted` و tour `e8c21d68-b161-4085-9dd3-b03b59540d39` badge `در لیست انتظار: ۷` را نشان می‌دهد.
- همان صفحه با همین فیلتر و tour پیام `چیزی با این فیلترها پیدا نشد` دارد و هیچ row قابل مشاهده‌ای ارائه نمی‌کند.
- نتیجه: اختلاف badge و نتیجهٔ query دوباره بازتولید شد؛ `BUG-STG-037` همچنان FAIL قطعی است و بعد از promotion نیز state فیلتر/شمارنده همگام نیست.

### Workspace waitlist tab recheck — ۲۰۲۶-۰۹-۲۸

- Workspace همان تور `e8c21d68-b161-4085-9dd3-b03b59540d39` را با ظرفیت `۱/۱` نشان می‌دهد.
- خلاصهٔ Workspace: `نیازمند بررسی ۱`، `منتظر پرداخت ۰` و `نهایی‌شده برای حضور ۱`.
- تب `درخواست‌های ثبت‌نام` یک ردیف waitlist (`71c1…260e`) با ظرفیت `۱/۱` و state `در انتظار` دارد، اما تب مستقل `لیست انتظار` هم‌زمان پیام `چیزی با این فیلترها پیدا نشد` و نتیجهٔ صفر نشان می‌دهد.
- نتیجه: علاوه بر global Bookings، بین تب‌های خود Workspace نیز projection صف یکسان نیست؛ این evidence `BUG-STG-037` و ناهماهنگی waitlist state را تقویت می‌کند.

### Workspace operational tab recheck — ۲۰۲۶-۰۹-۲۸

- تب «لیست عملیاتی» همان Workspace شمارندهٔ `۱` و یک ردیف `QA Waitlist Guest 20260928` دارد.
- ردیف state `نهایی`، حمل `حمل سازمان‌یافته` و پرداخت `بدون نیاز به پرداخت / بدون مانده قابل پیگیری` را نشان می‌دهد.
- نتیجه: Workspace operational tab برای این fixture internally consistent است؛ این PASS محدود، اختلاف global Bookings و تب مستقل Waitlist را رفع نمی‌کند و `BUG-STG-037` همچنان باز است.

### Workspace finance tab recheck — ۲۰۲۶-۰۹-۲۸

- تب «پیگیری مالی» همان تور پس از بارگذاری پیام `همه‌چیز برای این تور تسویه است — پیگیری پرداختی نیست` را نشان داد.
- این با تب عملیاتی که همان ردیف را `بدون نیاز به پرداخت / بدون مانده قابل پیگیری` نمایش می‌دهد سازگار است؛ اما با Portal List و Admin global که همان registration را پرداخت‌لازم/پرداخت‌نشده می‌نمایانند ناسازگار است.
- نتیجه: Workspace مالی برای fixture promoted/free یک PASS محدود دارد، ولی projection مشترک بین surfaceها هنوز بسته نشده است.

### Free PDP/form recheck — ۲۰۲۶-۰۹-۲۸

- PDP تور `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در AX متن `رایگان / بدون نیاز به پرداخت` و در preview ثبت‌نام نیز همین label را نشان داد؛ مبلغ، روش پرداخت و CTA پرداخت وجود نداشت.
- فرم ثبت‌نام همان تور فقط مرحلهٔ ثبت‌نام و ثبت درخواست را نشان داد؛ کنترل upload receipt، فیش یا پرداخت در مسیر free دیده نشد. به‌دلیل ثبت قبلی کاربر، submit مجدد انجام نشد.
- نتیجه: مسیر UI free در PDP/form برای این fixture PASS محدود است؛ projection List/Detail/Admin مربوط به `BUG-STG-080` همچنان FAIL باقی می‌ماند.

### No-discount PDP recheck — ۲۰۲۶-۰۹-۲۸

- PDP تور بدون تخفیف `b595933d-cf84-4d60-9f5d-f1072aa947cc` برای session فعلی مبلغ پایهٔ `۱۰٬۰۰۰٬۰۰۰ تومان` را در summary و preview ثبت‌نام نشان داد.
- هیچ label یا درصد تخفیف عضویت در این PDP وجود نداشت؛ حمل اتوبوس و هزینهٔ حمل `۱٬۰۰۰٬۰۰۰ تومان` مستقل و visible بود.
- نتیجه: سناریوی تور بدون تخفیف در PDP PASS است و برای `BUG-STG-081` evidence مثبت تکمیلی محسوب می‌شود.

### Free Admin financial detail recheck — ۲۰۲۶-۰۹-۲۸

- Admin Detail برای free registration `4190860a-9948-4c62-b29b-85d3e494e765` label `پرداخت‌نشده (رزرو)` و متن `ثبت‌نام تأیید شده — پیگیری پرداخت` دارد.
- جزئیات عددی همان صفحه فاکتور `۰`، پرداخت‌شده `۰`، مانده `۰` و مبلغ قابل پرداخت اکنون `۰` را نشان می‌دهد، اما body هنوز `رزرو پرداخت‌نشده است — هنوز تسویه نشده است` است.
- نتیجه: mismatch فقط copy نیست؛ label و body unpaid با projection عددی zero/free ناسازگارند و `BUG-STG-080` قطعی‌تر تأیید شد.

### Anonymous SSR Waitlist recheck — ۲۰۲۶-۰۹-۲۸

- پاسخ SSR بدون cookie برای PDP fixture `e8c21d68-b161-4085-9dd3-b03b59540d39` با `curl` مستقیم بررسی شد.
- HTML بدون session شامل `data-marketing-cta-action="waitlist"`، متن `عضویت در لیست انتظار`، `۰ جای خالی` و label `رایگان / بدون نیاز به پرداخت` بود.
- نتیجه: CTA عمومی Waitlist در anonymous SSR واقعاً وجود دارد؛ ابهام قبلی ناشی از session عضو/registration در browser بود. `BUG-STG-062 / 047` برای PDP عمومی PASS شد؛ فرم مهمان نیز قبلاً با submit واقعی PASS شده بود.

### P2 transport SSR proof — ۲۰۲۶-۰۹-۲۸

- SSR بدون cookie برای PLP target `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` کارت را با `data-marketing-catalog-card-price` و قیمت `۱٬۰۰۰٬۰۰۰ تومان` render کرد؛ همان card هیچ transport/dong field یا labelی نداشت.
- SSR بدون cookie برای PDP همان target، هم `خودروهای مشترک` و `۳۴۴٬۴۴۴ تومان` در facts و هم `خودروهای مشترک` و `۳۴۴٬۴۴۴ تومان` در logistics را render کرد.
- نتیجه: `BUG-STG-082` در SSR/HTML نیز قطعی است و مشکل فقط AX یا لایهٔ نمایش تعاملی نیست.

### Public PLP/PDP cache-header recheck — ۲۰۲۶-۰۹-۲۸

- PLP و PDP عمومی هر دو با `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` و `x-cache: BYPASS` پاسخ دادند؛ هر دو header زمان پاسخ مستقل داشتند.
- نتیجه: برای این دو صفحه stale بودن browser/CDN public cache علت مستقیم اختلاف transport نیست؛ mismatch `BUG-STG-082` در artifact/contract خروجی باقی است. این header evidence به‌تنهایی cacheهای داخلی BFF یا Portal/Admin را رد نمی‌کند.

### Pricing preview guest recheck — ۲۰۲۶-۰۹-۲۸

- فرم ثبت‌نام تور تخفیف‌دار `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` در session عضو با افزودن همراه (بدون submit) قیمت مهمان را `۱٬۰۰۰٬۰۰۰ تومان` نشان داد؛ فرم برای این participant متن `پرداخت هر نفر جداگانه انجام می‌شود` را نیز نمایش داد.
- این preview مهمان قیمت پایه را نشان می‌دهد و تخفیف عضو را به مهمان منتقل نمی‌کند؛ بنابراین این بخش از `BUG-STG-022` در preview **PASS محدود** است.
- submit چندنفره و تطبیق amount نهایی API/Admin همچنان انجام نشده و evidence قبلی mismatch نهایی `BUG-STG-022` پابرجاست.

### Pricing focused source recheck — ۲۰۲۶-۰۹-۲۸

- Portal pricing preview و registration-flow contract: `11/11 PASS`؛ شامل forward کردن header عضو، استفاده از server preview، read-only بودن preview و انتقال waitlist state به CTA مهمان.
- API commercial-pricing workspace binding: `8/8 PASS`؛ شامل اعمال discount فقط روی participant خودِ عضو در `BUG-STG-022` و جلوگیری از order-dependent preview loss در `BUG-STG-081`.
- نتیجه: قرارداد source سبز است، اما runtime amount نهایی guestها قبلاً mismatch داشته؛ بنابراین `BUG-STG-022` با source test بسته نمی‌شود و retest نهایی API/Admin هنوز لازم است.

### Free PLP/PDP SSR proof — ۲۰۲۶-۰۹-۲۸

- PLP با `minPrice=0&maxPrice=0&sort=price_asc` برای free fixture `c3a3c778-99ab-4750-8dc6-3172fa5ce034` کارت SSR با `data-marketing-catalog-card-free` و متن `رایگان / بدون نیاز به پرداخت` render کرد؛ در همان card `data-marketing-catalog-card-price` وجود نداشت.
- PDP همان free fixture نیز label `رایگان / بدون نیاز به پرداخت` را render کرد و marker قیمت/مبلغ قابل پرداخت در facts آن وجود نداشت.
- نتیجه: `BUG-STG-025` و مسیر free SSR در PLP/PDP PASS هستند؛ mismatchهای registration projection در `BUG-STG-080` جداگانه باقی می‌مانند.

### Runtime health recheck — ۲۰۲۶-۰۹-۲۸

- `https://denali.shenski.com/health`: HTTP `200`, `{"ok":true}`
- `https://portal.denali.shenski.com/health`: HTTP `200`, `{"ok":true}`
- `https://admin.denali.shenski.com/health`: HTTP `200`, `{"ok":true}`
- نتیجه: هر سه surface در زمان ادامهٔ تست سالم بودند؛ شواهد قبلی این sweep همچنان به release SHA `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` نسبت داده می‌شود.

### Mutation gate — نیازمند تأیید صریح

- (انجام شد) برای تست promotion موفق، رزرو QA `bea6e552-0922-48a1-b207-c16b912c6c4a` لغو و candidate `9b676ad8-08f3-48a0-bf47-1494b42bd9af` promote شد؛ لغو side effect staging و غیرقابل‌بازگشت بود.
- برای بستن projection بعد از resubmit، باید receipt جدید `4ffb2534-70cd-4be0-b244-09e991a598ae` approve شود و اثر مالی آن در Portal/Admin/Finance بررسی شود. این کار side effect مالی/notification دارد.
- تأیید صریح دریافت شد؛ promotion اجرا و ثبت شد. approve receipt اجرا نشد چون قبل از action، صف Finance خالی بود و pending fixture وجود نداشت.

### Mutation execution — promotion بعد از آزادشدن ظرفیت — ۲۰۲۶-۰۹-۲۸

- با تأیید کاربر، رزرو QA `bea6e552-0922-48a1-b207-c16b912c6c4a` لغو شد؛ Admin آن را «لغوشده» و ظرفیت فیکسچر را همچنان `۱/۱` نشان داد.
- پس از refresh/query مجدد، candidate `9b676ad8-08f3-48a0-bf47-1494b42bd9af` دیگر در Waitlist نبود و در فهرست همهٔ وضعیت‌ها به‌صورت «تأییدشده / پرداخت‌نشده (رزرو)» ظاهر شد.
- Portal همان registration را «ثبت‌نام شما نهایی شده است»، `ثبت‌نام: تأیید شده`، `رسید: لازم نیست` و «نیازی به پرداخت نیست» نشان داد.
- Admin جزئیات مالی را `جمع فاکتور ۰`، `پرداخت‌شده ۰`، `مانده بدهی ۰` نشان داد، اما متن generic «رزرو پرداخت‌نشده است — هنوز تسویه نشده است» باقی بود.
- نتیجه: promotion موفق و بدون ساخت hold/quote مالی مشاهده شد؛ اما mismatch label مالی Admin در همین مسیر **FAIL جدید/مرتبط با projection** است. idempotent retry جداگانه هنوز اجرا نشده است.

### Receipt fixture state after mutation gate — ۲۰۲۶-۰۹-۲۸

- Finance در `tab=receipts` صف را خالی (`فیشی در انتظار بررسی نیست`) نشان داد؛ بنابراین receipt `4ffb2534-70cd-4be0-b244-09e991a598ae` در وضعیت pending قابل approve نبود و approve دوباره انجام نشد.
- Portal registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` هم‌زمان `رسید: تأیید شده` و body `پرداخت تأیید شد` را نشان داد، اما heading هنوز «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید» است.
- نتیجه: `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` از PASS قبلی به **FAIL جاری/بازگشته** تغییر می‌کند؛ receipt state و heading هم‌خوان نیستند. approve-after-resubmit به‌دلیل نبود pending fixture **UNVERIFIED** باقی می‌ماند.

### Deploy gate و restore نهایی — ۲۰۲۶-۰۹-۲۸

- runtime release روی هر سه host با health `200` پاسخ داد: `denali.shenski.com`، `portal.denali.shenski.com` و `admin.denali.shenski.com`.

### deploy gate recheck — ۲۰۲۶-۰۹-۲۸، ۱۷:۳۵ UTC

- هر سه endpoint `/health` با HTTP `200` و body `{"ok":true}` پاسخ دادند.
- روی VPS، `current` به `/opt/app-tour-staging/releases/222ab05585d9adfe51aa02be06bb8c71b20f4b7e` اشاره می‌کند؛ `release-manifest.json` نیز همین `releaseSha`، build timestamp `2026-09-28T14:28:06Z` و Node `v24.21.0` را ثبت کرده است.
- نتیجه: evidenceهای runtime این sweep به artifact `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` نسبت داده شدند؛ artifact drift در این recheck دیده نشد.

### cross-check زمان و ظرفیت در Admin Workspace — ۲۰۲۶-۰۹-۲۸

- Admin Workspace برای `e8c21d68-b161-4085-9dd3-b03b59540d39` مقدار `حرکت: ۲۸ مهر ۱۴۰۵ · ۱۰:۰۰` و `ظرفیت: ۱/۱ نفر` را نشان داد.
- Portal Detail و PDP همان fixture نیز `۲۸ مهر ۱۴۰۵، ۱۰:۰۰` و ظرفیت صفر/پر را نشان می‌دهند؛ اختلاف timezone یا ساعت شروع در این fixture دیده نشد.
- Admin Workspace همچنین copy «ظرفیت پر است — ثبت‌نام جدید فرم عمومی در لیست انتظار ثبت می‌شود» را نمایش داد؛ این read-only evidence برای `BUG-STG-035` **PASS** و برای copy عملیاتی Waitlist **PASS** است، اما transition promotion هنوز تست نشده است.

### تطبیق operational list در Workspace — ۲۰۲۶-۰۹-۲۸

- تب «لیست عملیاتی» همان Workspace پس از بارگذاری summaryهای `نیازمند بررسی ۱`، `منتظر پرداخت ۰` و `نهایی‌شده برای حضور ۱` را نشان داد.
- جدول عملیاتی نیز یک ردیف `QA Capacity Promotion Group 20260928` با «نهایی»، حمل سازمان‌یافته و «بدون نیاز به پرداخت / بدون مانده قابل پیگیری» داشت؛ summary و جدول در این Workspace با هم برابر بودند.
- نتیجه: این fixture برای خود Workspace internally consistent است؛ اختلاف ثبت‌شدهٔ `BUG-STG-037` در صفحهٔ global Bookings filter (badge `۸` در برابر جدول `۱`) باقی می‌ماند و با این Workspace پوشانده نمی‌شود.

### ریتست مستقیم redaction در HTML/JSON-LD — ۲۰۲۶-۰۹-۲۸

- در Admin، سطح «جزئیات کاتالوگ عمومی» برای فیلد `تور پولی (ثبت‌نام با پرداخت)` از `Value: 1` به `Value: 0` تغییر داده و ذخیره شد.
- با Exposure مالی خاموش، پاسخ SSR همان PDP شامل `خودروهای مشترک` (۵ occurrence)، `۳۰۰٬۰۰۰ تومان` (۴ occurrence)، `تخفیف` (۳۵ occurrence)، `پرداخت` (۵ occurrence) و چهار `application/ld+json` بود؛ بنابراین redaction در HTML/structured data کامل نیست و `BUG-STG-019 / 036` همچنان **FAIL** است.
- سپس همان checkbox به `Value: 1` برگردانده و ذخیره شد؛ AX نهایی مقدار `Value: 1` را نشان داد. محیط staging به وضعیت قبلی بازگردانده شد.

### ریتست PDP ظرفیت‌پر و Waitlist — ۲۰۲۶-۰۹-۲۸

- فیکسچر `00000000-0000-4000-8000-000000000220` در PDP عمومی ظرفیت `۰ جای خالی` را نشان داد.
- AX صفحه در session فعلی فقط ثبت‌نام عادی/لینک ثبت‌نام موجود را نشان داد و `عضویت در لیست انتظار` یا CTA مستقل Waitlist نداشت.
- SSR HTML نیز `data-marketing-cta-action="waitlist"` نداشت؛ عبارت `joinWaitlist` فقط در ترجمه‌های bundle دیده شد و CTA قابل‌اجرا تولید نشده بود.
- نتیجه: `BUG-STG-062 / 047` فعلاً **FAIL/نیازمند ریتست با anonymous session مستقل**؛ در session دارای registration، عدم نمایش Waitlist می‌تواند به state کاربر وابسته باشد، اما closure عمومی هنوز اثبات نشده است.
- تلاش برای بازکردن tab مستقل در in-app browser همان session ورود را به ارث برد؛ بنابراین این tab به‌تنهایی anonymous proof محسوب نمی‌شود. نبود CTA در SSR بدون cookie همچنان evidence runtime است، ولی mutation فرم مهمان هنوز اجرا نشده است.

### ریتست فرم Waitlist با fixture فعلی — ۲۰۲۶-۰۹-۲۸

- مسیر `https://portal.denali.shenski.com/catalog/00000000-0000-4000-8000-000000000220/register` باز شد.
- پاسخ UI فقط «ثبت‌نام در دسترس نیست» و «زمان شروع این تور گذشته است و ثبت‌نام جدید پذیرفته نمی‌شود.» بود؛ Waitlist/guest/payment/upload قابل بررسی نبود.
- چون زمان شروع fixture گذشته است، این fixture برای closure `BUG-STG-062 / 047` معتبر نیست و نتیجه **UNVERIFIED / fixture نامعتبر** ثبت شد.

### ریتست فرم Waitlist با fixture آینده و ظرفیت صفر — ۲۰۲۶-۰۹-۲۸

- fixture معتبر `QA WAITLIST GROUP 20260927` با tour ID `e8c21d68-b161-4085-9dd3-b03b59540d39` در تاریخ `۲۸ مهر ۱۴۰۵، ۱۰:۰۰` باز شد؛ PDP مقدار `۰ جای خالی` و Portal Detail وضعیت `در انتظار بررسی` را نشان داد.
- فرم Portal برای همین تور متن صریح «ظرفیت تور تکمیل است؛ این فرم درخواست شما را در لیست انتظار ثبت می‌کند» را نشان داد و برای مهمان نیز توضیح داد که می‌توان مهمان ثبت کرد.
- پس از افزودن همراه، فرم عنوان «مهمان ۱»، فیلدهای نام/شماره و CTA «ثبت درخواست لیست انتظار» را نشان داد؛ copy ثبت‌نام عادی، CTA پرداخت و upload رسید در این مسیر دیده نشد.
- نتیجه: `BUG-STG-WAITLIST-GUEST-FORM-COPY` برای fixture آینده **PASS**؛ وجود copy/CTA درست در فرم مهمان تأیید شد. closure عمومی `BUG-STG-062 / 047` همچنان به anonymous مستقل برای PDP نیاز دارد، چون PDP با session کاربرِ از قبل ثبت‌نام‌شده CTA مهمان/مشاهده ثبت‌نام نشان می‌دهد.

### تطبیق PLP/PDP برای fixture آینده Waitlist — ۲۰۲۶-۰۹-۲۸

- PLP برای `QA WAITLIST GROUP 20260927` همان tour ID `e8c21d68-b161-4085-9dd3-b03b59540d39` را نشان داد، با label «رایگان / بدون نیاز به پرداخت» و تاریخ `۲۸ مهر ۱۴۰۵`.
- PDP همان fixture ظرفیت `۰ جای خالی` و label رایگان/بدون پرداخت را نشان داد؛ بنابراین state ظرفیت PLP/PDP برای این fixture همسان است.
- این تطبیق، `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` را برای fixture فعلی **PASS مشروط** می‌کند؛ anonymous مستقل و mutation آزادشدن ظرفیت هنوز closure کامل نیست.

### submit واقعی مهمان در Waitlist با fixture آینده — ۲۰۲۶-۰۹-۲۸

- روی همان fixture ظرفیت صفر، مهمان مصنوعی `QA Waitlist Guest 20260928` با شماره QA ثبت شد و دکمه «ثبت درخواست لیست انتظار» submit شد.
- نتیجهٔ UI صریح بود: «درخواست در لیست انتظار ثبت شد» و توضیح داد که پس از آزادشدن ظرفیت، ادمین آن را بررسی می‌کند.
- در Portal List رکورد با شناسه `9b676ad8-08f3-48a0-bf47-1494b42bd9af` ظاهر شد و label آن «لیست انتظار برای دیگری» بود؛ receipt/payment در نتیجهٔ ثبت نمایش داده نشد.
- نتیجه: mutation واقعی مسیر مهمان `waitlisted` و copy انتقال به صف را تأیید کرد؛ `BUG-STG-WAITLIST-GUEST-FORM-COPY` **PASS قطعی برای این fixture** است. تست anonymous مستقل PDP و promotion بعد از آزادشدن ظرفیت همچنان باز است.

### تطبیق Admin برای رکورد Waitlist ساخته‌شده — ۲۰۲۶-۰۹-۲۸

- Admin با فیلتر `status=waitlisted` و `tourId=e8c21d68-b161-4085-9dd3-b03b59540d39` باز شد.
- ردیف `QA Waitlist Guest 20260928` با شناسهٔ کوتاه `9b67…d9af` و label مستقل «در لیست انتظار» دیده شد؛ وضعیت حمل/رزرو آن `پرداخت‌نشده (رزرو)` بود و action «تأیید» داشت، نه نهایی‌سازی پرداخت.
- هم‌زمان badge فیلتر «در لیست انتظار» مقدار `۸` داشت، اما heading صف `۱ کل` و list `۱ از ۱` بود. این اختلاف در همان query/tour fixture، `BUG-STG-037` را **FAIL قطعی فعلی** می‌کند.

### Detail رکورد Waitlist ساخته‌شده — ۲۰۲۶-۰۹-۲۸

- Detail برای `registrationId=9b676ad8-08f3-48a0-bf47-1494b42bd9af` وضعیت «درخواست شما در حال بررسی است» و متن «درخواست شما در انتظار تأیید باشگاه است» را نشان داد.
- در همان پاسخ UI، وضعیت‌ها جدا بودند: `ثبت‌نام: لیست انتظار` و `رسید: لازم نیست`؛ هیچ deadline، CTA پرداخت یا upload رسید وجود نداشت.
- این evidence، جدایی registration state و receipt state را برای mutation واقعی Waitlist تأیید می‌کند؛ promotion واقعی هنوز انجام نشده است.

### ریتست runtime P2 برای filter/sort رایگان — ۲۰۲۶-۰۹-۲۸

- در PLP، sort `قیمت (کم به زیاد)` با URL `https://denali.shenski.com/tours?sort=price_asc` اعمال شد؛ تور رایگان در ابتدای فهرست قرار گرفت و بعد از آن قیمت‌های `۳۵۰`، `۵۰٬۰۰۰`، `۱۲۵٬۰۰۰` و بالاتر دیده شد.
- sort `قیمت (زیاد به کم)` با URL `https://denali.shenski.com/tours?sort=price_desc` اعمال شد؛ تورهای پولی از `۱۰٬۰۰۰٬۰۰۰` به پایین مرتب شدند و تورهای رایگان در انتهای فهرست قرار گرفتند.
- فیلتر `minPrice=0&maxPrice=0` با URL `https://denali.shenski.com/tours?minPrice=0&maxPrice=0&sort=price_desc` اعمال شد؛ نتیجه `۳ مورد` بود و هر سه کارت label «رایگان / بدون نیاز به پرداخت» داشتند؛ هیچ قیمت عددی نمایش داده نشد.
- نتیجهٔ runtime: `BUG-STG-025` و `BUG-STG-026 / 027` **PASS**؛ رفتار artifact با قرارداد free=0 و sort/filter سازگار است.

### تطبیق مبلغ نهایی دو guest با Admin — ۲۰۲۶-۰۹-۲۸

- برای tour `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9`، رکورد `f20dbbdb-280c-44fe-ac6c-787adf2397bf` (guest اول، بدون خودرو + دُنگ) در Admin جمع فاکتور `۸۴۴٬۴۴۴ تومان` نشان داد؛ رکورد `76cada3f-b10b-4b5f-9d08-bba158107996` (guest دوم، بدون تخفیف/حمل متفاوت) جمع فاکتور `۵۰۰٬۰۰۰ تومان` داشت.
- در preview فرم قبل از submit، guest اول `۱٬۳۴۴٬۴۴۴ تومان` و guest دوم `۱٬۰۰۰٬۰۰۰ تومان` نشان داده شده بود؛ بنابراین هر دو مقدار نهایی کمتر از preview هستند و guest دوم عملاً مبلغ member `۵۰۰٬۰۰۰` گرفته است.
- هر دو Admin detail هم‌زمان state `در انتظار` و `پرداخت‌نشده (رزرو)` داشتند؛ این اختلاف فقط label نیست و در amount نهایی ذخیره‌شده دیده می‌شود.
- نتیجه: `BUG-STG-022` **FAIL قطعی فعلی**؛ pricing مستقل participant و انتقال‌نیافتن تخفیف عضو به guest بسته نشده است. این evidence برای `BUG-STG-081` نیز هشدار regression است، اما closure آن هنوز به دو حساب مستقل نیاز دارد.

### تطبیق مستقیم PDP عضو با مبلغ guest در Admin — ۲۰۲۶-۰۹-۲۸

- PDP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` در session عضو قیمت پایه `۱٬۰۰۰٬۰۰۰`، تخفیف عضویت `۵۰٪` و «قیمت برای شما» `۵۰۰٬۰۰۰ تومان` را نشان داد؛ حمل shared cars و هزینهٔ دونگی `۳۴۴٬۴۴۴ تومان` نیز هم‌زمان visible بود.
- این مقدار با رکورد Admin guest اول (`۸۴۴٬۴۴۴ = ۵۰۰٬۰۰۰ + ۳۴۴٬۴۴۴`) نشان می‌دهد discount عضو به guest نشت کرده؛ مبلغ قراردادی guest باید از قیمت پایه شروع شود.
- نتیجهٔ فعلی: `BUG-STG-081` در سطح نمایش PDP **read-only PASS** است، اما pricing نهایی participant در `BUG-STG-022` همچنان **FAIL** می‌ماند و closure قیمت عضو/مهمان بدون حساب مستقل دوم کامل نیست.

### مقایسهٔ HTML عمومی و PDP session عضو برای قیمت — ۲۰۲۶-۰۹-۲۸

- درخواست بدون cookie به PDP عمومی همان tour با SHA فعلی، `۱٬۰۰۰٬۰۰۰` را ۶ بار و `تخفیف عضویت` را ۲ بار داشت، اما `۵۰۰٬۰۰۰` در HTML عمومی وجود نداشت.
- AX همان PDP در session عضو `قیمت برای شما: ۵۰۰٬۰۰۰ تومان` و قیمت پایه `۱٬۰۰۰٬۰۰۰ تومان` را نشان داد.
- نتیجه: مرز نمایش public/member در artifact فعلی قابل مشاهده است؛ این evidence به‌تنهایی discrepancy را ثابت نمی‌کند، اما نشان می‌دهد مقایسه باید با دو session مستقل انجام شود. `BUG-STG-081` همچنان **PASS read-only / نیازمند closure دوحسابی** است.

### اجرای مجدد focused source tests — ۲۰۲۶-۰۹-۲۸

- Marketing focused specs: `۳۸/۳۸ PASS`؛ شامل free label، free filter/sort، transport/dong و member pricing preview.
- Workspace Denali focused specs: `۸/۸ PASS`؛ شامل catalog card، spots enrichment و shared-car dong.
- این green source tests با runtime FAILهای `BUG-STG-019/036`، `BUG-STG-022` و `BUG-STG-082` تناقض ندارند؛ source contract سبز است اما artifact/runtime closure آن موارد را تأیید نمی‌کند.

### بررسی قرارداد Exposure حمل در Admin — ۲۰۲۶-۰۹-۲۸

- سطح «فهرست کاتالوگ عمومی» روی حالت پیش‌فرض با `۱۲ فیلد نمایش داده می‌شود` است و custom fieldهای آن expand نشده‌اند؛ در این سطح checkbox مستقلی برای «نحوه حمل‌ونقل» در AX دیده نشد.
- سطح «جزئیات کاتالوگ عمومی» روی حالت سفارشی `۱۲ از ۱۲` است و checkbox «نحوه حمل‌ونقل» فعال است؛ بنابراین transport در PDP exposure شده، اما در PLP field registry فعلی به‌صورت مستقل exposed نیست.
- description فیلد location zones همچنان `نقطه شروع Start, summit, camp and end location zones.` است؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان FAIL است.

- این snapshot علت قراردادی محتملِ `BUG-STG-082` را روشن می‌کند، اما بدون تغییر تنظیمات/patch، نتیجهٔ runtime قبلی (`PLP فاقد transport/dong`) همچنان **FAIL** باقی می‌ماند.

### anonymous SSR برای CTA عمومی Waitlist — ۲۰۲۶-۰۹-۲۸

- درخواست بدون cookie به `https://denali.shenski.com/tours/e8c21d68-b161-4085-9dd3-b03b59540d39` انجام شد.
- HTML عمومی شامل دو marker `data-marketing-cta-action="waitlist"`، پنج occurrence متن «عضویت در لیست انتظار»، متن «رایگان / بدون نیاز به پرداخت» و چهار occurrence «۰ جای خالی» بود؛ `ثبت‌نام مهمان دیگر` نیز در shell دیده شد.
- این evidence مستقل از session عضو، CTA عمومی Waitlist را در PDP ثابت می‌کند. همراه با submit واقعی مهمان و Detail `registrationState=waitlisted`، `BUG-STG-062 / 047` در artifact فعلی **PASS runtime** شد؛ AX session‌دار قبلی فقط state کاربر از قبل ثبت‌نام‌شده را نشان می‌داد.

### revalidation مجدد global Waitlist count — ۲۰۲۶-۰۹-۲۸

- صفحهٔ Admin Bookings با query `status=waitlisted&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39` بازخوانی و یک بار reload شد.
- قبل و بعد از reload، badge «در لیست انتظار» `۸` باقی ماند، اما heading صف `۱ کل` و list `۱ از ۱` بود؛ همان ردیف `9b67…d9af` و label «در لیست انتظار» را داشت.
- نتیجه: اختلاف `BUG-STG-037` بعد از revalidation هم بازتولید شد و به یک snapshot اولیه محدود نیست؛ **FAIL قطعی فعلی** باقی ماند.

### آماده‌سازی promotion موفق پس از آزادشدن ظرفیت — ۲۰۲۶-۰۹-۲۸

- fixture رزرو QA برای آزادکردن یک صندلی read-only تأیید شد: `registrationId=bea6e552-0922-48a1-b207-c16b912c6c4a`، نام `QA Capacity Promotion Group 20260928`، وضعیت `تأییدشده`، `بدون نیاز به پرداخت`، `partySize=۱` و ظرفیت `۱/۱`.
- candidate Waitlist قابل‌ردیابی همان تور: `9b676ad8-08f3-48a0-bf47-1494b42bd9af`، partySize یک نفر، وضعیت `در لیست انتظار`.
- برای تست موفق promotion باید رزرو QA اول لغو شود؛ این action side effect مخرب و غیرقابل‌بازگشت روی staging دارد، بنابراین در این checkpoint اجرا نشد و `BUG-STG-063` همچنان برای مسیر promotion موفق **UNVERIFIED** است.

### guard promotion روی ظرفیت پر — ۲۰۲۶-۰۹-۲۸

- روی همان candidate `9b676ad8-08f3-48a0-bf47-1494b42bd9af` در Admin action تأیید اجرا شد؛ کنترل دوم «تأیید نهایی» ظاهر شد، اما پس از تأیید نهایی row بدون تغییر در وضعیت `در لیست انتظار`، ظرفیت `۱/۱` و همان action برگشت.
- هیچ booking approved جدید، hold، quote یا payment side effect در نتیجه دیده نشد؛ این guard برای جلوگیری از promotion در ظرفیت پر **PASS** است و با over-capacity evidence قبلی هم‌خوانی دارد.
- promotion موفق پس از آزادشدن صندلی همچنان به لغو رزرو QA نیاز دارد و تا آن زمان `BUG-STG-063` برای مسیر موفق **UNVERIFIED** می‌ماند.

### جست‌وجوی همهٔ Waitlistها برای fixture جایگزین — ۲۰۲۶-۰۹-۲۸

- Admin بدون فیلتر تور، `۸` نتیجهٔ Waitlist نشان داد.
- هر هشت ردیف ظرفیت پر داشتند: fixture آینده `۱/۱` و هفت ردیف North Ridge `۱۲/۱۲`; هیچ candidate با ظرفیت آزاد پیدا نشد.
- نتیجه: fixture جایگزین بدون side effect وجود ندارد؛ promotion موفق فقط با آزادکردن صندلی رزرو QA قابل تست است و `BUG-STG-063` برای این مسیر همچنان **UNVERIFIED** می‌ماند.

### ریتست مستقیم receipt reject → resubmit — ۲۰۲۶-۰۹-۲۸

- Detail برای registration `85095eb1-2955-4071-828a-7e19ddbed456` در Portal وضعیت `ثبت‌نام: تأیید شده` و `رسید: تأیید شده`، heading «سفر شما نهایی شده است» و متن «پرداخت شما تأیید شده» نشان داد.
- با وجود اینکه این شناسه در fixture قبلی به‌عنوان receipt ردشده ثبت شده بود، UI فعلی هیچ heading رد، علت رد یا کنترل resubmit ندارد؛ فقط action لغو رزرو دیده شد.
- نتیجه برای closure کد: **UNVERIFIED / fixture ownership-sync mismatch**؛ چون state ذخیره‌شدهٔ fixture با projection فعلی همخوان نیست، تست rejected→resubmit هنوز قابل انتساب قطعی به رفتار UI نیست و نباید PASS بسته شود.

### snapshot مجدد free در Portal List و Detail — ۲۰۲۶-۰۹-۲۸

- Portal List برای `registrationId=4190860a-9948-4c62-b29b-85d3e494e765` همچنان متن «برای نهایی‌شدن، پرداخت لازم است» را نشان داد.
- همان registration در Detail هم‌زمان heading «ثبت‌نام شما نهایی شده است»، متن «نیازی به پرداخت ندارید»، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` داشت.
- این دو response در یک session و برای یک شناسهٔ واحد متناقض‌اند؛ `BUG-STG-080` با snapshot جدید **FAIL قطعی** باقی ماند.

### ریتست free-pending در Portal و Admin — ۲۰۲۶-۰۹-۲۸

- برای `registrationId=c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8`، Portal Detail وضعیت `در انتظار بررسی`، `رسید: لازم نیست` و فقط پیام انتظار تأیید را نشان داد؛ deadline، CTA پرداخت و upload فیش وجود نداشت.
- Admin برای همان رکورد جمع فاکتور، پرداخت‌شده، مانده بدهی و مبلغ قابل پرداخت را همگی `۰ تومان` نشان داد؛ actionهای تأیید مسیر ثبت‌نام وجود داشت اما مسیر upload/دریافت فیش برای free pending ارائه نشد.
- نتیجه: `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` در این fixture **PASS read-only** است؛ این نتیجه با `BUG-STG-080` تناقض ندارد، چون آن باگ دربارهٔ ناسازگاری List/Detail در free approved است.

### snapshot مجدد paid/receipt-approved در Portal و Admin — ۲۰۲۶-۰۹-۲۸

- Portal برای `registrationId=f2144510-bc47-4d1f-b6ad-42002a6ac51a` هم‌زمان «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید»، `ثبت‌نام: تأیید شده`، `رسید: تأیید شده`، «پرداخت تأیید شد» و deadline پرداخت را نشان داد.
- Admin برای همان شناسه status «تأییدشده»، label «پرداخت جزئی (رزرو)»، deadline «مهلت پرداخت: ۴ مهر ۱۴۰۵» و متن «ثبت‌نام تأیید شده — پیگیری پرداخت» داشت.
- جزئیات Admin نیز جمع فاکتور `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴`، مانده بدهی `۰` و در عین حال متن «رزرو پرداخت جزئی است — هنوز مانده دارد» را نشان داد.
- نتیجه: `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` با snapshot تازه **FAIL قطعی** باقی ماندند؛ receipt approved و payment/finalization در سطوح مختلف canonical نیستند.

### تطبیق Finance برای paid fixture — ۲۰۲۶-۰۹-۲۸

- Finance Payments با فیلتر همان registration مقدار کل `۸۴۴٬۴۴۴ تومان`، پرداخت‌شده `۸۴۴٬۴۴۴ تومان` و مانده `۰ تومان` نشان داد؛ یک پرداخت دستی با وضعیت «ثبت‌شده (این پرداخت)» وجود داشت.
- Finance Receipts برای همان registration گفت «فیشی در انتظار بررسی نیست».
- بنابراین Finance از نظر وصول/مانده با Portal پیام «پرداخت تأیید شد» هم‌جهت است، اما Admin همان رکورد را «پرداخت جزئی (رزرو)» و دارای تعهد باقی‌مانده نمایش می‌دهد؛ این evidence اختلاف projection بین Finance و Admin را قطعی‌تر می‌کند و FAILهای projection همچنان باز هستند.

### جست‌وجوی fixture معتبر receipt pending/rejected — ۲۰۲۶-۰۹-۲۸

- Finance Receipts بدون فیلتر registration بازبینی شد؛ صف بررسی فیش پیام «فیشی در انتظار بررسی نیست» را نشان داد.
- بنابراین در وضعیت فعلی Staging fixture معتبر pending/rejected برای اجرای زنجیرهٔ reject → resubmit در UI موجود نیست؛ مورد همچنان **UNVERIFIED / fixture missing** است و از fixtureی که Portal آن را approved نشان می‌دهد نتیجه‌گیری قطعی نمی‌شود.

### focused source tests پس از deploy — ۲۰۲۶-۰۹-۲۸

- Marketing focused specs: **۳۸/۳۸ PASS**؛ شامل free label، free filter/sort، member pricing و transport/dong قرارداد source.
- Denali workspace focused specs: **۸/۸ PASS**؛ شامل catalog card، spots enrichment و shared-car dong egress.
- این نتایج فقط source contract را ثابت می‌کنند و با runtime FAIL فعلی `BUG-STG-019 / 036` و `BUG-STG-082` تناقض ندارند؛ closure staging همچنان به رفتار artifact/runtime وابسته است.

### ریتست locale Exposure در Admin — ۲۰۲۶-۰۹-۲۸

- صفحه فارسی Admin با عنوان فارسی باز شد و جزئیات «کاتالوگ عمومی» expand شد.
- AX برای فیلد location zones مقدار `Description: نقطه شروع Start, summit, camp and end location zones.` را نشان داد؛ در نتیجه متن انگلیسی داخل label/description و AX باقی است.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان **FAIL قطعی** است.

### ریتست Admin Waitlist operational list — ۲۰۲۶-۰۹-۲۸

- فیلتر `در لیست انتظار` فعال بود و badge آن `۸`، heading جدول `۸ کل` و list `۸ از ۸` را نشان داد؛ شمارنده و ردیف‌های جدول برابر هستند → `BUG-STG-037` در این fixture **PASS**.
- هر ۸ ردیف label مستقل `در لیست انتظار` داشتند و label `تأییدشده` فقط در گزینه‌های منوی فیلتر دیده شد؛ ردیف‌ها `پرداخت‌نشده (رزرو)` بودند و action نهایی‌سازی نداشتند → `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` **PASS**.

### ریتست مجدد free registration در Portal — ۲۰۲۶-۰۹-۲۸

- Detail برای `4190860a-9948-4c62-b29b-85d3e494e765` درست بود: «نیازی به پرداخت ندارید»، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست`.
- همان registration در Portal List با متن «برای نهایی‌شدن، پرداخت لازم است» نمایش داده شد.
- نتیجه‌ی runtime: `BUG-STG-080` همچنان **FAIL قطعی**؛ Detail و List projection یکسان نیستند.

### ریتست مجدد paid/receipt-approved در Portal Detail — ۲۰۲۶-۰۹-۲۸

- برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a`، Detail هم‌زمان این stateهای متناقض را نشان داد: ثبت‌نام تأیید شده، `رسید: تأیید شده`، «پرداخت تأیید شد»، اما متن «رسید پرداخت را ارسال کنید» و `مهلت پرداخت` نیز باقی است.
- نتیجه: `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` همچنان **FAIL قطعی** هستند.

### ریتست Admin/Finance برای همان paid fixture — ۲۰۲۶-۰۹-۲۸

- Admin booking detail برای همان `f2144510-bc47-4d1f-b6ad-42002a6ac51a` وضعیت `تأییدشده`، `پرداخت جزئی (رزرو)` و `مهلت پرداخت: ۴ مهر ۱۴۰۵` را نشان داد؛ یعنی Admin هنوز paid/finalized projection را دریافت نکرده است.
- Finance در تب «مانده بدهی» با پیام «مانده بدهی از فاکتور ثبت‌نام روی سرور می‌آید» باز شد اما row این fixture را نمایش نداد؛ این سطح برای همین fixture **قابل closure نیست** و evidence کامل ندارد.

### ریتست مستقیم Finance payments/receipts — ۲۰۲۶-۰۹-۲۸

- Finance → «پرداخت‌ها» همان `f2144510-bc47-4d1f-b6ad-42002a6ac51a` را نمایش داد: `۸۴۴٬۴۴۴ تومان` و `ثبت‌شده (این پرداخت)`.
- Finance → «رسیدها» هم‌زمان پیام «فیشی در انتظار بررسی نیست» نشان داد؛ پس payment record ثبت‌شده است، اما receipt queue برای آن fixture وجود ندارد.
- این اختلاف با Portal Detail و Admin deadline نشان می‌دهد projectionهای Portal/Admin/Finance هنوز یک state واحد ندارند؛ باگ‌های projection بسته نمی‌شوند.

### ریتست fixture receipt reject → resubmit — ۲۰۲۶-۰۹-۲۸

- registration `b254c01f-e5ce-4a27-b7d4-202b9a4fd432` در Portal فعلاً «سفر شما نهایی شده است»، `ثبت‌نام: تأیید شده`، `رسید: تأیید شده` و «پرداخت تأیید شد» دارد.
- در این fixture هیچ label رد رسید و هیچ CTA `ارسال مجدد` وجود ندارد؛ بنابراین fixture ردشده/قابل resubmit نیست و mutation انجام نشد.
- `receipt rejected → resubmit` همچنان **UNVERIFIED / fixture نامعتبر** باقی است.

### ریتست pricing چندنفره در فرم واقعی — ۲۰۲۶-۰۹-۲۸

- روی تور تخفیف‌دار `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9`، PDP عضو قیمت پایه `۱٬۰۰۰٬۰۰۰` و قیمت عضو `۵۰۰٬۰۰۰` را نشان داد و لینک مهمان مستقل داشت.
- در فرم مهمان، مهمان ۱ بدون تخفیف عضو با قیمت `۱٬۰۰۰٬۰۰۰` شروع شد؛ بعد از انتخاب ماشین شخصی دیگری و «بله، دونگ می‌دهم»، مبلغ او `۱٬۳۴۴٬۴۴۴` و دُنگ `۳۴۴٬۴۴۴` شد.
- با افزودن مهمان ۲، مهمان ۱ همان مبلغ دُنگ‌دار را حفظ کرد و مهمان ۲ مستقل با `۱٬۰۰۰٬۰۰۰` نمایش داده شد؛ تخفیف عضو به مهمان و مبلغ guest دیگر نشت نکرد.
- این بخش از `BUG-STG-022` **PASS در preview UI** است؛ submit نهایی/API amount هنوز اجرا نشده و closure کامل نیست.

### submit واقعی pricing دو مهمان — ۲۰۲۶-۰۹-۲۸

- با fixture QA، فرم دو مهمان submit شد. Portal پیام `۱ از ۲ ثبت‌نام موفق بود` و برای مهمان اول پیام «قبلاً برای این تور ثبت‌نام کرده‌اید» نشان داد.
- بلافاصله Portal List از `۲۶` به `۲۸` ثبت‌نام رسید و هر دو مهمان قابل ردیابی بودند:
  - مهمان ۱: `f20dbbdb-280c-44fe-ac6c-787adf2397bf`
  - مهمان ۲: `76cada3f-b10b-4b5f-9d08-bba158107996`
- هر دو Detail در وضعیت `در انتظار بررسی` هستند؛ مهمان ۱ حمل `ماشین ندارم — پرداخت دونگ` و مهمان ۲ `ماشین شخصی می‌آورم · فقط راننده` دارد.
- نتیجه: submit واقعی نشان‌دهنده‌ی تناقض partial-success/duplicate است؛ `BUG-STG-021` و `BUG-STG-022` برای closure کامل هنوز **PASS قطعی نیستند**. amount نهایی API و پاسخ خام mutation هنوز استخراج نشده است.

### ریتست promotion پس از آزادکردن ظرفیت QA — ۲۰۲۶-۰۹-۲۸

- فقط fixture کنترل‌شده‌ی `QA North Ridge Full 3 20260924` با registration ID `3c8c404a-1678-4fe3-bdec-9e6d1377dfcc` لغو شد؛ Admin بعد از mutation آن را `لغوشده` و «پایان یافته — تأیید یا رد ممکن نیست» نشان داد.
- قبل از لغو: Waitlist برابر `۸` و `تأییدشده امروز` برابر `۰` بود؛ بعد از لغو: Waitlist برابر `۷` و `تأییدشده امروز` برابر `۱` شد.
- هیچ promotion خودکاری رخ نداد و ردیف‌های Waitlist هنوز ظرفیت `۱۲/۱۲` نشان می‌دهند؛ promotion موفق یک‌نفره و idempotent retry هنوز اجرا/تأیید نشده است.
- این mutation staging برگشت‌پذیر نیست؛ چون فقط fixture QA بود ثبت شد. `BUG-STG-063` همچنان **PASS محدود / closure ناقص** است.

### تلاش promotion یک‌نفره پس از آزادشدن ظرفیت — ۲۰۲۶-۰۹-۲۸

- fixture `QA Waitlist Fresh 20260925` با registration ID `256183c5-9b73-492c-b8ea-290394c0e58b` باز شد و action `تأیید و منتظر پرداخت` فعال بود.
- پس از اجرای action، Detail/List هیچ تغییر قابل مشاهده‌ای نداشت: registration همچنان `در لیست انتظار`، ظرفیت همچنان `۱۲/۱۲` و Waitlist همچنان `۷` باقی ماند؛ پیام خطای قابل مشاهده یا promotion موفق هم ثبت نشد.
- نتیجه: promotion یک‌نفره در staging **FAIL/بدون feedback قابل اتکا**؛ `BUG-STG-063` بسته نمی‌شود.
- release proof: SHA `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`، artifact digest `ce8aba3f0dda40027722a077513678702b166e64ac56bfad95fa6f0c26b0416c`.
- Exposure مالی بعد از تست redaction دوباره فعال و در Admin با AX مقدار checkbox «تور پولی (ثبت‌نام با پرداخت) = 1» تأیید شد.
- PDP تور `ec171184-1877-4501-9a92-857f712838e2` بعد از restore در HTML/JSON-LD دوباره markerهای `price`، قیمت پایه/عضو، `خودروهای مشترک`، `۳۰۰٬۰۰۰` و `روش پرداخت` را دارد؛ وضعیت محیط به حالت قبل از mutation برگشت.
- source gate پس از این ریتست: `pnpm run test:changed` با `base=origin/main mode=ci` و نتیجهٔ `PASS`.
- رندر SSR عمومی PDP تور North Ridge با `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` بررسی شد؛ HTML هم marker `data-marketing-cta-action="waitlist"`/متن «عضویت در لیست انتظار» و هم متن session-specific «ثبت‌نام مهمان دیگر» را دارد. بنابراین CTA عمومی Waitlist وجود دارد؛ برای closure مستقل `BUG-STG-062 / 047` هنوز AX با session anonymous لازم است و این ریتست را PASS قطعی اعلام نمی‌کند.
- verification gate: `pnpm run pre-commit:fast` و `pnpm run guard:import-boundary` هر دو **PASS**؛ pre-commit به‌دلیل نبود staged file، lint-staged و test-changed را skip کرد و این skip به‌عنوان تست source جدید محسوب نمی‌شود.
- ریتست صف promotion: Admin در فیلتر Waitlist فقط ۸ candidate نشان داد؛ همهٔ candidateهای قابل‌مشاهده برای North Ridge با ظرفیت `۱۲/۱۲` بودند، ازجمله fixture سه‌نفرهٔ `00000000-0000-0000-0000-000000000312`. هیچ candidate یک‌نفره با صندلی آزاد و fixture مستقل قابل‌اعتماد پیدا نشد؛ بنابراین promotion موفق، retry idempotent و سناریوی آزادشدن ظرفیت هنوز **UNVERIFIED** است و برای ساختن صندلی آزاد به mutation دادهٔ موجود نیاز دارد.

### Retest read-only — فرم Waitlist — ۲۰۲۶-۰۹-۲۸

- URL: `https://portal.denali.shenski.com/catalog/e8c21d68-b161-4085-9dd3-b03b59540d39/register`
- نتیجه: **PASS برای فرم**؛ متن «ظرفیت تور تکمیل است؛ این فرم درخواست شما را در لیست انتظار ثبت می‌کند» و CTA «ثبت درخواست لیست انتظار» قابل‌مشاهده بود.
- در کنترل‌های قابل‌مشاهدهٔ فرم، upload فیش، CTA پرداخت یا CTA ثبت‌نام عادی وجود نداشت.
- این session قبلاً برای self ثبت‌نام داشت؛ بنابراین نتیجهٔ این retest برای guest/همراه و copy فرم معتبر است، اما mutation نهایی و پاسخ API جدید عمداً اجرا نشد.
- PDP همان fixture در session لاگین‌شده CTA «ثبت‌نام مهمان دیگر» دارد؛ به‌دلیل وجود registration قبلی، این مشاهده به‌تنهایی failure نیست. برای closure مستقل anonymous باید AX و marker عمومی با session بدون registration ثبت شود.

### FAIL جاری

### Retest مالی Portal — ۲۰۲۶-۰۹-۲۸

- `4190860a-9948-4c62-b29b-85d3e494e765`: در List هم‌زمان متن پرداخت لازم است و متن پرداخت لازم نیست دیده شد؛ Detail نیز هم‌زمان پیام بدون پرداخت و پیام ارسال receipt داشت. نتیجه: `BUG-STG-080` همچنان **FAIL** و projection بین List/Detail ناسازگار است.
- `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: Detail هم‌زمان receipt تأییدشده، CTA ارسال receipt و deadline پرداخت دارد. نتیجه: `BUG-STG-039 / 072` و projection پرداخت هنوز **FAIL** هستند.
- این retest read-only بود؛ هیچ approve/resubmit یا mutation جدیدی انجام نشد.

### ریتست مستقیم List/Detail پس از deploy — ۲۰۲۶-۰۹-۲۸

- registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: در Detail heading «ثبت‌نام شما تأیید شده است» و متن «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید» هم‌زمان با «رسید: تأیید شده» و «پرداخت تأیید شد» دیده شد؛ `paymentDueAt` نیز باقی است. **FAIL برای BUG-STG-039 / 072 و projection پرداخت.**
- همان registration در Portal List با copy «برای نهایی‌شدن، پرداخت باید تکمیل شود» نمایش داده شد؛ بنابراین List/Detail هنوز state واحد ندارند.
- registration رایگان `4190860a-9948-4c62-b29b-85d3e494e765`: Detail درست و بدون payment CTA/deadline است و AX صریحاً «برای این ثبت‌نام نیازی به پرداخت ندارید»، `registration: تأیید شده` و `receipt: لازم نیست` را نشان داد.
- با این حال همان registration در Portal List همچنان «برای نهایی‌شدن، پرداخت لازم است» نشان داده می‌شود؛ **BUG-STG-080 در List projection همچنان FAIL** است، درحالی‌که Detail projection PASS است.
- receipt fixture `13c54a7f-fa45-44d7-bf7b-c144b9254cd2` برای registration `85095eb1-2955-4071-828a-7e19ddbed456` در DB با وضعیت rejected فهرست شده بود، اما Portal Detail همان registration را `رسید: تأیید شده` و نهایی‌شده نشان داد؛ مالکیت/همگامی fixture برای اجرای reject→resubmit معتبر نیست و هیچ mutation جدیدی انجام نشد. `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` همچنان **UNVERIFIED** است.
- Admin برای همان registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` در query مستقیم، هم‌زمان `تأییدشده`، `پرداخت جزئی (رزرو)`، «مهلت پرداخت: ۴ مهر ۱۴۰۵» و «پیگیری پرداخت» را نشان داد؛ این مدرک runtime، `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` و بخش projection پرداخت `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` را **FAIL** نگه می‌دارد.
- برای fixture `e8e11109-dc76-4e31-b2a4-c5d75a570380`، Admin Booking در جزئیات پرداخت `پرداخت‌شده: ۰ تومان`، `مانده بدهی: ۲٬۵۰۰٬۰۰۰ تومان` و «رزرو پرداخت‌نشده» نشان داد؛ Finance Payments همان fixture را `در انتظار (این پرداخت)` نشان می‌دهد، اما Finance Receipts با فیلتر همان registration «فیشی در انتظار بررسی نیست» دارد. این ناسازگاری پرداخت/رسید، fixture معتبر برای reject→resubmit نیست و به‌عنوان evidence جدید `UNVERIFIED` ثبت شد؛ هیچ لغو پرداخت یا mutation انجام نشد.

### Retest Exposure AX — ۲۰۲۶-۰۹-۲۸

- در Admin، بعد از بازکردن «جزئیات کاتالوگ عمومی»، checkbox فیلد «نقطه شروع» در AX هنوز این description را داشت: `نقطه شروع Start, summit, camp and end location zones.`
- نتیجهٔ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: **FAIL**؛ صفحه فارسی است اما description انگلیسی در AX نشت می‌کند.

### Retest merchandising — ۲۰۲۶-۰۹-۲۸

- `BUG-STG-081`: روی تور `ec171184-1877-4501-9a92-857f712838e2` کارت PLP قیمت پایه `۲٬۰۰۰٬۰۰۰` و قیمت عضو `۱٬۰۰۰٬۰۰۰` را نشان داد و PDP نیز قیمت عضو/تخفیف را نشان داد؛ این retest فعلی **PASS** است، اما برای closure نهایی باید با دو حساب مستقل عضو و مهمان تکرار شود.
- `BUG-STG-082`: PDP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` shared cars و دُنگ `۳۰۰٬۰۰۰` را نشان داد، ولی کارت PLP فقط قیمت و تخفیف را داشت و نوع حمل/دُنگ نداشت؛ **FAIL**.
- `BUG-STG-025`: متن قابل‌مشاهدهٔ PDP تور رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` شامل «رایگان / بدون نیاز به پرداخت» بود و روش/CTA پرداخت در متن قابل‌مشاهده نبود؛ **PASS در این retest**.
- `BUG-STG-026 / 027`: فیلتر `minPrice=0&maxPrice=0` تور رایگان را با label رایگان برگرداند؛ **PASS در این retest**. sort صعودی/نزولی هنوز باید در همین artifact با ثبت ترتیب کامل کارت‌ها تکرار شود.

### Retest کامل ترتیب PLP — ۲۰۲۶-۰۹-۲۸

- `sort=price_asc`: ۱۵ کارت یکتا استخراج شد؛ سه تور رایگان در جایگاه‌های `۰، ۱، ۲` قرار گرفتند.
- `sort=price_desc`: ۱۶ کارت یکتا استخراج شد؛ سه تور رایگان در جایگاه‌های `۱۳، ۱۴، ۱۵` قرار گرفتند.
- fixtureهای رایگان با label «رایگان / بدون نیاز به پرداخت» در هر دو ترتیب حاضر بودند.
- نتیجهٔ فعلی `BUG-STG-026 / 027`: **PASS read-only** برای فیلتر/ترتیب؛ URL، ترتیب کامل کارت‌ها و IDها در این sweep ثبت شد.

### ریتست مستقیم HTML PLP/PDP برای حمل و دُنگ — ۲۰۲۶-۰۹-۲۸

- fixture تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` در HTML کارت PLP قیمت `۱٬۰۰۰٬۰۰۰ تومان` و transport/dong ندارد؛ همان fixture در PDP `خودروهای مشترک`، هزینه حمل `۳۴۴٬۴۴۴ تومان` و هزینه دونگی `۳۴۴٬۴۴۴ تومان` دارد.
- هر دو response با `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` برگشتند؛ بنابراین این اختلاف به cache عمومی نسبت داده نمی‌شود.
- نتیجهٔ `BUG-STG-082`: **FAIL قطعی runtime**؛ PLP و PDP از نظر transport/dong parity ندارند.

### ریتست مقایسه‌ای قیمت عضو/مهمان — ۲۰۲۶-۰۹-۲۸

- در UI session فعلی که با حساب عضو باز است، کارت PLP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` قیمت پایه `۱٬۰۰۰٬۰۰۰` و قیمت عضو `۵۰۰٬۰۰۰ تومان` با تخفیف ۵۰٪ نشان داد.
- در HTML عمومی همان PLP بدون session، همان کارت فقط قیمت پایه `۱٬۰۰۰٬۰۰۰ تومان` را دارد و قیمت عضو/discount در کارت عمومی نیست.
- این fixture در این مقایسه parity عضو/مهمان را نشان می‌دهد؛ اما برای closure نهایی `BUG-STG-081` باید همین مقایسه با دو حساب مستقل مرورگر و PDP/API همان دو حساب تکرار شود.

### ریتست مستقیم free/filter/sort — ۲۰۲۶-۰۹-۲۸

- PDP رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` در HTML visible label «رایگان / بدون نیاز به پرداخت» دارد؛ در `data-marketing-catalog-detail-fact` قیمت یا payment CTA وجود ندارد. occurrenceهای «روش پرداخت» فقط در payload/translationهای SSR هستند و به‌عنوان UI visible شمارش نشدند.
- PLP با `minPrice=0&maxPrice=0` همان fixture رایگان را با label رایگان برگرداند.
- PLPهای `sort=price_asc` و `sort=price_desc` نیز ID همان fixture و label رایگان را برگرداندند؛ `۰ تومان` در SSR sort payload دیده شد.
- هر دو مسیر PDP و filter با `cache-control: private, no-cache, no-store` و `x-cache: BYPASS` پاسخ دادند.
- نتیجهٔ فعلی `BUG-STG-025` و `BUG-STG-026 / 027`: **PASS read-only در این artifact**؛ payment method/CTA visible برای free دیده نشد.

### Retest pricing فرم — ۲۰۲۶-۰۹-۲۸

- URL: `https://portal.denali.shenski.com/catalog/ec171184-1877-4501-9a92-857f712838e2/register`
- حساب فعلی عضو قبلاً برای self ثبت‌نام داشت؛ با افزودن `مهمان ۱`، فرم مبلغ مهمان را `۲٬۰۰۰٬۰۰۰ تومان` نشان داد، درحالی‌که PDP همین تور برای عضو قیمت نهایی `۱٬۰۰۰٬۰۰۰ تومان` و تخفیف ۵۰٪ نشان می‌دهد.
- نتیجهٔ read-only: تخفیف عضو در preview مهمان نشت نکرد؛ **PASS محدود برای عدم نشت تخفیف**.
- submit نهایی و محاسبهٔ transport/dong چندنفره عمداً اجرا نشد؛ `BUG-STG-022` برای closure کامل هنوز **UNVERIFIED** است.

### Retest pricing دو همراه — ۲۰۲۶-۰۹-۲۸

- در فرم واقعی تور تخفیف‌دار `ec171184-1877-4501-9a92-857f712838e2` دو همراه اضافه شد؛ هر دو در ابتدا قیمت پایهٔ `۲٬۰۰۰٬۰۰۰ تومان` داشتند و تخفیف عضو به آن‌ها نشت نکرد.
- برای همراه اول `ماشین شخصی دیگری + بله، دونگ می‌دهم` انتخاب شد: قیمت همان همراه `۲٬۳۰۰٬۰۰۰` و دُنگ `۳۰۰٬۰۰۰` شد، درحالی‌که همراه دوم همچنان `۲٬۰۰۰٬۰۰۰` ماند.
- سپس حمل همراه اول به `ماشین شخصی خودم` برگشت: قیمت همراه اول به `۲٬۰۰۰٬۰۰۰` برگشت، درحالی‌که همراه دوم همچنان `۲٬۳۰۰٬۰۰۰` و دُنگ `۳۰۰٬۰۰۰` باقی ماند.
- نتیجه: استقلال preview قیمت و transport/dong بین دو همراه **PASS read-only**؛ submit نهایی و amount نهایی API هنوز برای closure `BUG-STG-022` اجرا نشده است. هیچ رکورد جدیدی ساخته نشد.

### Retest promotion runner — ۲۰۲۶-۰۹-۲۸

- runner رسمی `pnpm p7:staging-waitlist-promote-probe` اجرا شد.
- نتیجه: **UNVERIFIED / runner stale**؛ اسکریپت به `root@89.42.210.252` وصل شد اما قبل از seed با خطای `cd: /opt/app-tour-staging/apps/api: No such file or directory` متوقف شد.
- این خطا failure محصول یا staging current نیست؛ مسیر/fixture اسکریپت با topology فعلی منطبق نیست. `BUG-STG-063` و promotion واقعی هنوز بسته نشده‌اند.

- با root واقعی release `VPS_DEPLOY_PATH=/opt/app-tour-staging/releases/222ab05585d9adfe51aa02be06bb8c71b20f4b7e` نیز probe قابل اجرا نشد: release مسیر `api/` دارد، اما `api/node_modules/.bin/tsx` در artifact وجود ندارد و `pnpm exec tsx` با `Command "tsx" not found` متوقف شد. بنابراین seed fixture واقعی از داخل release ممکن نیست؛ این **tooling/deploy mismatch** است، نه failure رفتار promotion.

### Runtime release-integrity — ۲۰۲۶-۰۹-۲۸

- از خود VPS، `/opt/app-tour-staging/current` به release `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` اشاره می‌کند.
- `release-integrity.json` مقدار `releaseSha=222ab05585d9adfe51aa02be06bb8c71b20f4b7e` و digest artifact `ce8aba3f0dda40027722a077513678702b166e64ac56bfad95fa6f0c26b0416c` را نشان می‌دهد.
- `release-manifest.json` نیز همین SHA، timestamp `2026-09-28T14:28:06Z` و layout واقعی `api/dist/main.js` و runtimeهای Portal/Marketing/Web را تأیید می‌کند.
- بنابراین گیت «runtime SHA ناشناخته» برای این deploy **حل شد**؛ health عمومی به‌تنهایی SHA نمی‌داد، اما release-integrity روی خود staging proof مستقیم است.

### Source race verification — ۲۰۲۶-۰۹-۲۸

### Retest Admin Waitlist actions — ۲۰۲۶-۰۹-۲۸

- URL: `https://admin.denali.shenski.com/bookings?status=waitlisted&tourId=00000000-0000-4000-8000-000000000220&view=ops`
- ظرفیت نمایش‌داده‌شده `۱۲/۱۲` و ۷ ردیف با label «در لیست انتظار» بود.
- برای ردیف انتخاب‌شده action «تأیید ... برای تأیید دوباره کلیک کنید» وجود داشت که با promotion مجاز است؛ action «نهایی‌سازی» در AX وجود نداشت.
- نتیجهٔ read-only: label و تفکیک action **PASS**؛ promotion واقعی به‌دلیل نبود fixture گروهی/صندلی آزاد اجرا نشد و `BUG-STG-063` همچنان UNVERIFIED باقی است.

### Mutation واقعی promotion — ۲۰۲۶-۰۹-۲۸

- fixture اختصاصی در staging با `registrationId=00000000-0000-0000-0000-000000000312`، `tourId=00000000-0000-4000-8000-000000000220` و `partySize=3` ساخته شد؛ قبل از approve: `status=waitlisted`, `paymentStatus=unpaid`, ظرفیت `۱۲/۱۲`.
- از Admin action تأیید برای همین گروه اجرا شد.
- بعد از approve: رکورد همچنان `status=waitlisted`، `partySize=3`، `paymentStatus=unpaid`، `approvedAt=NULL` و `finalizationStatus=not_final` باقی ماند.
- side effect بررسی‌شده: `finance_payment_holds=0`، `finance_commercial_quotes=0` و `payments=0`.
- نتیجهٔ `BUG-STG-063` برای سناریوی گروه بزرگ‌تر از ظرفیت: **PASS**؛ booking approved ساخته نشد و hold/quote/payment ایجاد نشد.
- سناریوی promotion موفق بعد از آزادشدن صندلی و idempotent retry هنوز اجرا نشده و closure کامل این bug باقی است.

### Mutation واقعی duplicate guest — ۲۰۲۶-۰۹-۲۸

- URL: `https://portal.denali.shenski.com/catalog/c3a3c778-99ab-4750-8dc6-3172fa5ce034/register`
- fixture موجود: `registrationId=c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8`، guest phone=`09170000928`.
- همان نام و شماره در فرم مهمان وارد و submit شد؛ UI پیام «مهمان ۱: قبلاً برای این تور ثبت‌نام کرده‌اید» داد و ثبت جدید انجام نشد.
- count رکوردهای فعال با همان tenant/tour/phone قبل و بعد: `۱ → ۱`.
- نتیجهٔ `BUG-STG-021`: **PASS در staging برای duplicate guest**؛ race source نیز قبلاً یک `201` و یک `409` پاس کرده بود.

### Retest transport pricing فرم — ۲۰۲۶-۰۹-۲۸

- تور `ec171184-1877-4501-9a92-857f712838e2` در PDP shared cars و دُنگ `۳۰۰٬۰۰۰ تومان` دارد.
- در فرم مهمان همین تور، AX فقط بخش «انتخاب ماشین شخصی» با دو radio «ماشین شخصی خودم/ماشین شخصی دیگری» را نشان داد؛ گزینهٔ shared cars و مبلغ دُنگ در فرم وجود نداشت.
- preview مهمان `۲٬۰۰۰٬۰۰۰ تومان` بود و هیچ ancillary transport/dong نمایش داده نشد.
- نتیجهٔ runtime برای بخش transport/dong از `BUG-STG-022`: **FAIL جزئی**؛ pricing پایهٔ مهمان درست است، اما transport selection و دُنگ بین PDP و فرم parity ندارند.

#### Correction — state شرطی حمل/دُنگ

- نتیجهٔ بالا با فرم در state اولیه ثبت شده بود و ناقص بود. در retest تعاملی، انتخاب «ماشین شخصی دیگری» کنترل‌های شرطی «دونگ (سهم بنزین) می‌دهی؟» را باز کرد.
- با انتخاب «بله، دونگ می‌دهم»، فرم `دنگ خودرو ۳۰۰٬۰۰۰ تومان` و مبلغ مهمان `۲٬۳۰۰٬۰۰۰ تومان` را نشان داد؛ یعنی پایهٔ `۲٬۰۰۰٬۰۰۰` + دُنگ `۳۰۰٬۰۰۰`.
- نتیجهٔ اصلاح‌شده: `BUG-STG-022` برای preview یک مهمان و انتخاب transport/dong **PASS read-only** است؛ submit چندنفره و تطبیق amount نهایی API هنوز انجام نشده و closure کامل باقی است.

### Retest operational count — ۲۰۲۶-۰۹-۲۸

- Admin workspace تور `00000000-0000-4000-8000-000000000220` در تب Transport مقدار «لیست عملیاتی ۱۲» و جدول ۱۲ ردیف نشان داد.
- KPI «نهایی‌شده برای حضور» جداگانه `۵` بود و ردیف‌های approved/unpaid در operational list باقی مانده بودند.
- نتیجهٔ فعلی `BUG-STG-037`: **PASS read-only**؛ شمارنده و تعداد ردیف‌ها برابرند و finalized جدا محاسبه می‌شود.

### Receipt rejected fixture audit — ۲۰۲۶-۰۹-۲۸

- در admin DB چند receipt با `status=Rejected` پیدا شد؛ نمونه‌ها `13c54a7f-fa45-44d7-bf7b-c144b9254cd2` برای registration `85095eb1-2955-4071-828a-7e19ddbed456` و `4354b37f-f31e-4f05-8735-2a73e7265a91` برای `e8e11109-dc76-4e31-b2a4-c5d75a570380` هستند.
- `e8e11109...` در Portal برای session فعلی 404 است و `4ae40b3e...`/`98202973...` با آخرین receipt approved نمایش داده می‌شوند؛ بنابراین fixture rejected قابل‌دسترسی برای اجرای resubmit هنوز آماده نیست.
- هیچ receipt/payment دستی جدیدی برای دورزدن مالکیت fixture ساخته نشد. `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` همچنان **UNVERIFIED / fixture ownership mismatch** است.

### Final PDP smoke — ۲۰۲۶-۰۹-۲۸

- PDP تور `00000000-0000-4000-8000-000000000220` در متن قابل‌مشاهده روش پرداخت `رسید / پرداخت آفلاین`، تأیید ثبت‌نام `دستی` و ساعت شروع `۳ مهر ۱۴۰۵، ۱۱:۳۰` را نشان داد.
- ظرفیت عمداً ارزیابی نشد؛ طبق تصمیم محصول نمایش ظرفیت کل/خالی در این sweep معیار closure نیست.
- نتیجهٔ `BUG-STG-008 / 013 / 035`: **PASS smoke** برای payment method، approval و timezone/start time.

### Mutation reversible Exposure مالی — ۲۰۲۶-۰۹-۲۸

- وضعیت قبل: checkbox «تور پولی (ثبت‌نام با پرداخت)» در جزئیات کاتالوگ عمومی فعال بود.
- با خاموش‌کردن و ذخیرهٔ همین Exposure، PDP تور `ec171184-1877-4501-9a92-857f712838e2` هنوز در visible text و AX قیمت عضو/تخفیف، shared transport، هزینهٔ حمل `۳۰۰٬۰۰۰` و دُنگ را نشان داد؛ payment method در این fixture در PDP نبود، اما financial/transport fields حذف نشدند.
- نتیجهٔ قطعی: `BUG-STG-019 / 036` **FAIL runtime**؛ redaction در سطح API/HTML/AX کامل نیست.
- تنظیم بلافاصله restore شد و verify بعد از restore نشان داد price، shared transport، dong و payment method به حالت اولیه برگشته‌اند.

- `pnpm --filter @apps/api run test:booking-guest-duplicate-http-race`: **۱/۱ PASS**؛ دو POST هم‌زمان دقیقاً یک `201` و یک `409` دادند.
- `pnpm run test:booking-capacity-postgres`: **۶/۶ PASS**؛ lock، parallel approve، bulk approve، cancel هم‌زمان و multi-worker بدون overbook پاس شدند.
- این‌ها evidence سطح source/Postgres هستند و جایگزین mutation واقعی staging نمی‌شوند؛ `BUG-STG-021` و `BUG-STG-063` در runtime staging هنوز closure ندارند.

- `BUG-STG-080`: registration رایگان `4190860a-9948-4c62-b29b-85d3e494e765` در List پرداخت لازم دارد، اما Detail می‌گوید پرداخت و receipt لازم نیست.
- `BUG-STG-039 / 072`: registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هم‌زمان receipt تأییدشده و copy ارسال receipt/deadline دارد.
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`: همان registration در Portal List هنوز پرداخت‌نشده نمایش داده می‌شود.
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: همان registration در Admin «پرداخت جزئی»، deadline و پیگیری پرداخت دارد؛ Finance مانده را صفر نشان می‌دهد.
- `BUG-STG-082`: PDP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` حمل/دُنگ دارد، کارت PLP ندارد.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: AX description انگلیسی `Start, summit, camp and end location zones.` در صفحه فارسی باقی است.

### PASS جاری یا read-only

- `BUG-STG-025`, `BUG-STG-026 / 027`: label رایگان، فیلتر صفر و sort رایگان در PLP/PDP درست.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`: registration رایگان pending `c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` بدون payment CTA/deadline/upload.
- Waitlist form/detail copy و labelهای Portal/Admin در read-only درست.
- Export Excel و focused source tests سبز هستند.

### نیازمند تکرار یا fixture

- `BUG-STG-081`: در retest اخیر هر دو sort قیمت عضو را درست نشان دادند؛ به‌دلیل سابقه order-dependent هنوز closure قطعی ندارد.
- `BUG-STG-021`, `BUG-STG-022`, `BUG-STG-063`: mutation واقعی duplicate/pricing/promotion هنوز اجرا نشده.
- receipt approve/resubmit، upload واقعی و Telegram delivery: fixture pending مناسب یا health اتصال Telegram موجود نیست.

### Evidence مشترک

- آخرین deploy موفق: run `36434901424`، SHA `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`.
- tree `origin/dev` و HEAD محلی برابر `ce985a316940a6f53f36aac2582b03870d51c92e` است.
- فایل evidence تفصیلی و IDها در ادامه همین ledger ثبت شده‌اند.
- Admin Waitlist read-only: `https://admin.denali.shenski.com/bookings?status=waitlisted&tourId=00000000-0000-4000-8000-000000000220&view=ops` تعداد ۷ candidate نشان داد؛ همه یک‌نفره، label «در لیست انتظار» و ظرفیت `۱۲/۱۲` دارند. fixture آزاد برای promotion یا candidate گروهی بزرگ‌تر از ظرفیت در وضعیت فعلی وجود ندارد؛ `BUG-STG-063` و transition واقعی `BUG-STG-064/065` همچنان **UNVERIFIED / capacity fixture missing** هستند.
- Waitlist state cross-check: PDP `https://denali.shenski.com/tours/e8c21d68-b161-4085-9dd3-b03b59540d39` ظرفیت `۰ جای خالی` و free/manual preview را نشان داد، اما CTA قابل‌مشاهده فقط «ثبت‌نام مهمان دیگر» بود و عبارت صریح Waitlist در CTA PDP نبود؛ فرم مستقیم همان tour copy و CTA صریح Waitlist دارد. بنابراین `BUG-STG-062/047` در مرز PDP **FAIL/ناتمام** و در guest form **PASS copy** ثبت شد؛ `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` نیازمند تطبیق API/anonymous session باقی است.
- Correction after anonymous HTTP check: GET عمومی همان PDP بدون cookie در HTML marker `data-marketing-cta-action="waitlist"` و متن `عضویت در لیست انتظار` داشت؛ `۰ جای خالی` و free label نیز حاضر بود. پس `BUG-STG-062/047` برای public/anonymous PDP **PASS SSR evidence** است. مشاهدهٔ «ثبت‌نام مهمان دیگر» مربوط به session عضوی بود که قبلاً ثبت‌نام داشت و به‌تنهایی failure محصول نیست؛ anonymous browser session مستقل هنوز برای AX کامل باز نشده است.

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

## Denali catalog source retest after draft-engine build — ۲۰۲۶-۱۰-۰۳

- dependency قبلی `@app-tour/draft-engine` با `pnpm --filter @app-tour/draft-engine run build` ساخته شد؛ خطای missing `dist/index.js` دیگر بازتولید نشد.
- تست‌های focused Marketing برای PDP facts، transport/dong و waitlist با این دستور اجرا شدند:
  `pnpm --filter @apps/marketing exec node --import tsx --test test/resolve-marketing-tour-detail-cta.spec.ts test/build-catalog-tour-detail-facts.spec.ts`
- نتیجه: `۱۶/۱۶ PASS`؛ شامل `PR-D-FACTS-03` برای نمایش transport و cost و `MKT-PCMS-P3-06` برای waitlist.
- نتیجهٔ closure: `BUG-STG-081/082` در source و contract پوشش دارند، اما closure نهایی runtime هنوز به deploy همین commit و retest PLP/PDP با artifact SHA واقعی نیاز دارد.
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

## Staging runtime continuation — ۲۰۲۶-۰۹-۲۹

### P2 merchandising recheck

- `BUG-STG-081` — **PASS فعلی در PLP/PDP**. تور `ec171184-1877-4501-9a92-857f712838e2` در PLP با `sort=price_asc` و `sort=price_desc` قیمت پایه `۲٬۰۰۰٬۰۰۰ تومان`، قیمت عضو `۱٬۰۰۰٬۰۰۰ تومان` و تخفیف ۵۰٪ را نشان داد؛ PDP همان قیمت عضو را نشان داد.
- `BUG-STG-082` — **PASS فعلی در Marketing**. همان کارت PLP نوع حمل `خودروهای مشترک` و دُنگ `۳۰۰٬۰۰۰ تومان` را نشان داد؛ PDP نیز هر دو مقدار را نشان داد.
- `BUG-STG-025` — **PASS فعلی**. PDP رایگان `c3a3c778-99ab-4750-8dc6-3172fa5ce034` label «رایگان / بدون نیاز به پرداخت» داشت و روش پرداخت، مبلغ پرداخت و CTA پرداخت نداشت. PLP نیز همین label را داشت.
- `BUG-STG-026 / 027` — **PASS فعلی**. URL `https://denali.shenski.com/tours?minPrice=0&maxPrice=0&sort=price_asc` مقدارهای صفر را حفظ کرد و ۳ تور رایگان برگرداند؛ در `sort=price_asc` رایگان‌ها ابتدای فهرست و در `sort=price_desc` انتهای فهرست بودند.

### Excel/final participant roster recheck

- دکمهٔ خروجی Excel در Admin با موفقیت فایل ساخت و پیام «فایل Excel آماده و دانلود شد» نمایش داده شد.
- فایل: `/home/hamed/Downloads/denali-final-roster-20260929072317.xlsx`
- محتوای فایل: شیت «لیست نهایی» فقط ۵ ردیف و شیت «منتظر پرداخت» ۷ ردیف داشت؛ approvedهای پرداخت‌نشده هنوز از لیست نهایی حذف شده‌اند. بنابراین اصلاح نهایی participant roster در Admin هنوز روی staging نیست و **FAIL** باقی می‌ماند.
- همان Admin runtime در `North Ridge Trek` نیز «نهایی‌شده برای حضور ۵»، «منتظر پرداخت ۷» و متن «برای ورود به فهرست نهایی، پرداخت باقی‌مانده را پیگیری کنید» را نشان داد.

### Host/artifact divergence

- در همین زمان Marketing/PDP/PLP رفتار اصلاح‌شدهٔ P2 را نشان داد، اما Admin/Excel رفتار قدیمی payment-gated را نشان داد.
- headerهای عمومی SHA runtime ارائه نکردند؛ بنابراین artifact SHA دقیق Admin هنوز `UNVERIFIED` است. این مورد باید قبل از closure با fingerprint/SHA هر host تأیید شود.

### وضعیت این اجرای staging

- PASS: `BUG-STG-081`, `BUG-STG-082`, `BUG-STG-025`, `BUG-STG-026 / 027` در Marketing.
- FAIL: final participant roster/Excel در Admin؛ approved unpaid/partial هنوز در «لیست نهایی» نیستند.
- UNVERIFIED: یکسان‌بودن artifact SHA بین Marketing، Portal و Admin؛ P0/P1 mutationهای واقعی در این اجرای read-only انجام نشدند.

## Full local phase gate recheck — ۲۰۲۶-۰۹-۲۹

- `pnpm run phase-2:gate` روی HEAD کاری اجرا و کامل سبز شد: build همه packageها، API، Web/Admin، platform-core و guardهای Phase 2.
- API: `۳۱۵۹ pass`، `۰ fail`، `۷ skip`؛ skipها به سناریوهای وابسته به PostgreSQL/MinIO و سرویس خارجی مربوط‌اند و به‌عنوان closure staging ثبت نمی‌شوند.
- Web/Admin: `۲۰۵۵ pass`، `۰ fail`، `۰ skip`.
- Platform-core Phase 2: `۱۰/۱۰ pass`؛ `guard:architecture`، `guard:import-boundary`، design-token، artifact-surface و audit boundary همگی PASS.
- `git diff --check` PASS و فقط یک frontend لوکال روی پورت ۳۰۰۰ همراه API روی ۳۰۰۱ فعال است.
- این گیت source/local است و جایگزین deploy با artifact جدید، runtime SHA و mutation واقعی staging نمی‌شود. بنابراین مواردی که در سابقه با artifact قدیمی باز بوده‌اند، تا deploy و retest همان SHA هنوز `UNVERIFIED` باقی می‌مانند.

## Current bug ledger after local implementation — ۲۰۲۶-۰۹-۲۹

- Source/local اصلاح و تست‌شده: `BUG-STG-019`، `BUG-STG-036`، `BUG-STG-039/072`، `BUG-STG-080`، دو projection پرداخت، `BUG-STG-062/047`، `BUG-STG-WAITLIST-GUEST-FORM-COPY`، `BUG-STG-063`، `BUG-STG-064/065`، `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL`، `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC`، `BUG-STG-037`، `BUG-STG-021`، `BUG-STG-022`، locale Exposure، `BUG-STG-081`، `BUG-STG-082` و `BUG-STG-025/026/027`.
- Source/local و runtime read-only تأییدشده: `BUG-STG-006`، `BUG-STG-014/015/016`، `BUG-STG-EXPORT-SUMMARY`، و labelهای فارسی eventهای Admin؛ ارسال واقعی Telegram در این وضعیت اثبات نشده است.
- Source fix موجود ولی staging هنوز روی artifact قدیمی است: `BUG-STG-019`، `BUG-STG-036`، `BUG-STG-039/072`، `BUG-STG-080`، دو projection پرداخت، `BUG-STG-062/047`، `BUG-STG-WAITLIST-GUEST-FORM-COPY`، `BUG-STG-081`، `BUG-STG-082` و `BUG-STG-035`. این‌ها با runtime قدیمی بسته نمی‌شوند و بعد از deploy همین HEAD باید retest شوند.
- نیازمند fixture/mutation واقعی staging: promotion گروهی `BUG-STG-063`، انتقال واقعی Waitlist `BUG-STG-064/065`، submit واقعی duplicate `BUG-STG-021`، محاسبهٔ کامل transport/dong چندنفره در `BUG-STG-022`، و free-pending payment path.
- خارج از این sweep یا بدون fixture معتبر: binary receipt و `BUG-STG-040`، upload/resubmit باینری، Telegram delivery/thread/retry، و `BUG-STG-024` که قراردادش باگ محسوب نمی‌شود.
- `BUG-STG-044` طبق تصمیم محصول عمدی است: ظرفیت نمایشی پنهان می‌ماند و باگ محسوب نمی‌شود.

## Focused local regression after ledger — ۲۰۲۶-۰۹-۲۹

- Portal departure/payment/projection: `۲۱/۲۱ pass`؛ شامل `BUG-STG-035`، `BUG-STG-039/072`، `BUG-STG-080` و stale paid-list projection.
- Marketing pricing/transport/sort: `۲۴/۲۴ pass`؛ شامل `BUG-STG-019`، `BUG-STG-025`، `BUG-STG-027`، `BUG-STG-081` و `BUG-STG-082`.
- Web operational/finance: `۵۰/۵۰ pass`؛ شامل `BUG-STG-037`، Waitlist capacity guard، financial CTA/cache invalidation و timezone-independent operator labels.
- Local Admin smoke با `Host: admin.denali.localhost` پاسخ redirect احراز هویت معتبر (`307` به `/auth/login`) داد؛ بدون session، محتوای protected Exposure قابل ارزیابی نیست.

## Local runtime invariant — ۲۰۲۶-۰۹-۲۹

- API محلی روی `3001` و تنها frontend محلی روی `3000` فعال است؛ frontend دوم اجرا نشده است.
- `git diff --check` سبز است؛ تغییرات در working tree باقی مانده‌اند و commit، push یا PR ساخته نشده است.
- HEAD کاری: `1234f065a` روی branch `codex/staging-p0-p1-p2-final`؛ وضعیت source با working-tree تغییرکرده بررسی می‌شود، نه با ادعای deploy شدن.

## Additional local contract coverage — ۲۰۲۶-۰۹-۲۹

- Portal-host CTA resolution: `۱۰/۱۰ pass`؛ شامل `BUG-STG-FREE-CTA-PORTAL-HOST` روی staging apex واقعی.
- Receipt upload/offline gate: `۷/۷ pass`؛ route، BFF binary proxy و offline receipt chain source-level تأیید شدند. این نتیجه upload واقعی روی staging نیست.

## Timezone/redaction static audit — ۲۰۲۶-۰۹-۲۹

- تمام formatterهای تاریخ/زمان در `apps/marketing/src` inventory شدند؛ هر دو مسیر catalog از `CATALOG_DISPLAY_TIME_ZONE=Asia/Tehran` استفاده می‌کنند و formatter بدون timezone باقی نمانده است.
- Exposure negative tests صراحتاً قیمت، payment policy، transport، destination slug، ظرفیت مشتق و structured-data offers را بررسی می‌کنند؛ failure جدیدی پیدا نشد.

## Mixed Exposure regression fix — ۲۰۲۶-۰۹-۲۹

- failure لوکال پیدا شد: با روشن‌بودن Exposure نوع حمل و خاموش‌بودن Exposure مالی، `dongAmount`/`transportCostAmount` هنوز در snapshot عمومی باقی می‌ماند.
- اصلاح شد: mode حمل حفظ می‌شود، اما مبلغ‌های حمل و دُنگ در `clearPaymentPolicy` حذف می‌شوند؛ بنابراین قیمت از مسیر logistics نشت نمی‌کند.
- regression Denali/Marketing: `۳۳/۳۳ pass`؛ TypeScript lint/build package Denali و `git diff --check` بدون خطا.

## Post-fix changed-test gate — ۲۰۲۶-۰۹-۲۹

- `pnpm run test:changed`: PASS برای API، Web، Marketing، Portal، Denali و packageهای وابسته.
- `pnpm run guard:import-boundary`: PASS.
- `git diff --check`: PASS.

## Local regression recheck — ۲۰۲۶-۰۹-۲۹

- مسیرهای Public مربوط به `BUG-STG-035` دوباره از نظر formatter بررسی شدند؛ `formatCatalogDateRange` و `CatalogTourDetailLogistics` هر دو از `Asia/Tehran` استفاده می‌کنند و مسیر دیگری با `toLocaleString`/`Intl.DateTimeFormat` بدون timezone در محدودهٔ Marketing پیدا نشد.
- تست‌های focused زمان و قرارداد PDP/Portal: Marketing `۹/۹` و Portal `۴/۴` pass شدند؛ شامل `BUG-STG-008/013`، `BUG-STG-025`، `BUG-STG-024` در display policy و `BUG-STG-035`.
- `pnpm run test:changed`: PASS روی `origin/main`؛ `pnpm run pre-commit:fast`: PASS؛ `git diff --check`: PASS. هیچ commit، push یا PR انجام نشد.
- این evidence source/local است و deploy staging را تأیید نمی‌کند؛ runtime failureهای ثبت‌شده برای artifact قدیمی (`BUG-STG-081/082/080/019/039/072`، projectionهای Portal/Admin و locale runtime) تا deploy همین working tree و retest با SHA جدید باز می‌مانند.
- `CatalogCommercialPricingCompact` در همهٔ شاخه‌های preview، member discount، free و unavailable، ancillary حمل را حفظ می‌کند؛ `BUG-STG-082` در source regression پاس است و failure مشاهده‌شده به artifact قدیمی نسبت داده نمی‌شود مگر پس از deploy جدید.
- صفحهٔ Exposure روی Admin محلی با یک frontend فعال شد، اما پیام «اتصال فعالی وجود ندارد» مانع مشاهدهٔ field واقعی `location-zones` است؛ بنابراین locale runtime همچنان `UNVERIFIED` است و source pass جایگزین آن نمی‌شود.

## Local hardening — Waitlist action-reason localization — ۲۰۲۶-۰۹-۲۹

- مصرف hint ظرفیت‌پر در Admin به‌صورت fail-closed اصلاح شد؛ اگر namespace ترجمه در runtime حاضر نباشد، کلید خام `actionReason.capacityFull` دیگر به UI نشت نمی‌کند.
- ترجمهٔ فارسی و انگلیسی این کلید در message catalog موجود است؛ مسیر reasonهای پویا همچنان از `t.has(...)` استفاده می‌کند.
- تست‌های Web مرتبط: `25/25 pass` شامل capacity action availability، command center، KPI عملیاتی و matrix وضعیت booking.
- این اصلاح local/source است و تا deploy با SHA جدید روی staging، closure runtime برای locale قطعی محسوب نمی‌شود.

## Local package artifact refresh — Exposure locale — ۲۰۲۶-۰۹-۲۹

- ریشه‌یابی نشان داد Admin از `@app-tour/workspace-denali` و پیام‌های workspace در artifact `dist` مصرف می‌کند؛ وجود اصلاح در source به‌تنهایی runtime محلی را به‌روز نمی‌کند.
- `@app-tour/workspace-denali` با وابستگی‌های لازم rebuild شد و فرانت واحد Admin روی پورت ۳۰۰۰ با artifact محلی جدید restart شد؛ API همان پورت ۳۰۰۱ باقی ماند.
- `pnpm --filter @app-tour/workspace-denali run lint` بدون خطا پایان یافت.
- recheck بصری Exposure به‌دلیل timeout ابزار مرورگر قابل ثبت نبود؛ بنابراین `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` هنوز **UNVERIFIED runtime** است و PASS اعلام نمی‌شود.

## Local runtime/browser recheck after workspace rebuild — ۲۰۲۶-۰۹-۲۹

- فرانت محلی Admin پس از rebuild در صفحه Exposure load شد؛ اما به‌دلیل نبود اتصال فعال، candidate fieldهای واقعی در UI نمایش داده نشدند و description `location-zones` قابل مشاهده نبود.
- تست‌های package برای card، transport/dong، free label و localization: `12/12 pass`.
- نتیجه: source/package contract سبز است؛ runtime locale در نبود integration fixture همچنان **UNVERIFIED** باقی می‌ماند.

## Local P0 hardening — commercial preview redaction — ۲۰۲۶-۰۹-۲۹

- ریشهٔ `BUG-STG-019` در مسیر جداگانهٔ `pricingPreview` پیدا شد: حتی پس از redaction شدن `priceAmount`، preview عضو می‌توانست در PLP/PDP/Sticky/Rail render شود.
- هر سه سطح اکنون preview و status آن را با `shouldShowCatalogPrice` gate می‌کنند؛ در حالت redacted، preview و پیام unavailable هر دو حذف می‌شوند و transport مستقل همچنان طبق Exposure خودش رفتار می‌کند.
- تست Marketing مرتبط با Exposure، pricing و sort: `25/25 pass`.
- این اصلاح source/local است و نیازمند retest runtime با artifact جدید باقی می‌ماند.

## Local P1 hardening — Waitlist guest-form pricing copy — ۲۰۲۶-۰۹-۲۹

- در مسیر `registrationState=waitlist`، قیمت پایه، pricing preview عضو/مهمان، تخفیف، payable و loading آن دیگر render نمی‌شوند.
- خلاصهٔ فرم Waitlist فقط اطلاعات افراد و CTA «ثبت درخواست لیست انتظار» را نگه می‌دارد؛ مسیر عادی همچنان pricing و CTA معمول خود را حفظ می‌کند.
- تست قرارداد Portal/Denali: `8/8 pass`.
- این اصلاح source/local است؛ mutation واقعی guest staging برای closure نهایی انجام نشده است.

## Local P0 hardening — Portal paid-list projection — ۲۰۲۶-۰۹-۲۹

- ریشهٔ stale بودن Portal List مشخص شد: hydration فقط `paymentCollection` و `financialDisplayState` را از Detail می‌گرفت و `paymentStatus` و `paymentDueAt` قدیمی را نگه می‌داشت.
- hydration اکنون `paymentStatus`، `paymentCollection`، `financialDisplayState` و `paymentDueAt` را از Detail canonical جایگزین می‌کند و مقدارهای پاک‌شده را نیز صریحاً پاک می‌کند.
- تست Portal/finance مرتبط: `24/24 pass`؛ سناریوی approved unpaid → paid با حذف deadline اضافه شد.
- این اصلاح source/local است و retest runtime بعد از deploy اصلاحی همچنان لازم است.

## BUG-STG-081 local regression recheck — ۲۰۲۶-۰۹-۲۹

- مسیر قیمت‌گذاری PLP با preview عضو و وضعیت fetch ردیابی شد؛ در نبود preview احراز‌شده، resolver دیگر به قیمت پایه fallback نمی‌کند تا sort/filter با قیمت کارت اختلاف پیدا نکند.
- کارت و detail همچنان `payableMinor` را از preview معتبر مصرف می‌کنند و محاسبهٔ تخفیف در frontend انجام نمی‌شود؛ free collection در منطق filter/sort مقدار صفر دارد.
- تست focused شامل filter، sort، preview، display و transport: `۳۴/۳۴ pass`، `۰ fail`.
- این نتیجه source/local است؛ artifact قدیمی staging هنوز برای closure runtime معتبر نیست و deploy یا commit انجام نشده است.

## P0/P1 focused local source gate — ۲۰۲۶-۰۹-۲۹

- Portal registration/finance/waitlist/receipt contracts: `۲۸/۲۸ pass`.
- Web finance/operational list/capacity/projection contracts: `۲۸/۲۸ pass`.
- Denali catalog exposure/card/participant pricing/locale contracts: `۲۱/۲۱ pass`.
- این اجرا source/local است و جایگزین mutation واقعی staging برای promotion، approve receipt، upload باینری و Telegram delivery نمی‌شود.

## Waitlist/capacity local API gate — ۲۰۲۶-۰۹-۲۹

- ظرفیت approve/create و ownership قرارداد: `۱۳/۱۳ pass`.
- promotion بعد از آزادشدن صندلی و نگه‌داشتن گروه بزرگ‌تر از ظرفیت آزاد در Waitlist: `۲/۲ pass`.
- registration capacity و waitlist policy: `۱۰/۱۰ pass`.
- مجموع این اجرای API محلی: `۲۵/۲۵ pass`؛ هیچ mutation staging یا commit انجام نشد.

## Waitlist transition/local lifecycle gate — ۲۰۲۶-۰۹-۲۹

- Denali capacity/operator journey/intake done state/domain gate: `۲۷/۲۷ pass`؛ شامل waitlist → promote → cancel و copy موفقیت Waitlist.
- API cancellation/seat release/promotion و lifecycle transition matrix: `۱۴/۱۴ pass`.
- این evidence رفتار source/local را تأیید می‌کند؛ transition واقعی روی staging هنوز انجام نشده و برای آن artifact جدید لازم است.

## Exposure/Telegram label local source gate — ۲۰۲۶-۰۹-۲۹

- Exposure event list و UI control-plane contracts: `۱۵/۱۵ pass`.
- این نتیجه ترجمه و قرارداد source را تأیید می‌کند؛ labelهای انگلیسی مشاهده‌شده روی staging قدیمی تا زمان deploy artifact جدید runtime-open باقی می‌مانند.

## BUG-STG-080 atomic free projection hardening — ۲۰۲۶-۰۹-۲۹

- ریسک N+1/پنجرهٔ mixed state در مسیر free approval پیدا شد: `paymentStatus` و `freeCollectionApplied` قبلاً دو write جدا بودند.
- repository operation جدید `markFreeCollectionApplied` هر دو مقدار را همراه با finalization در یک transaction/operation ثبت می‌کند؛ مسیر approve دیگر دو write مستقل انجام نمی‌دهد.
- تست projection اتمیک، finance sync و list/detail contract: `۲۴/۲۴ pass`.
- API TypeScript check: PASS؛ این اصلاح local/source است و هنوز commit یا deploy نشده است.
- retry هم‌زمان همان operation نیز بررسی شد؛ هر دو نتیجه `paid/finalized/WAIVED` ماندند و downgrade رخ نداد.

## Local Admin browser smoke — ۲۰۲۶-۰۹-۲۹

- `admin.denali.localhost:3000/settings/exposure` با session توسعه باز شد و صفحهٔ فارسی، سطح کاتالوگ عمومی و وضعیت بدون pending change را نشان داد.
- UI محلی اعلام کرد اتصال integration فعالی وجود ندارد؛ بنابراین نمایش runtime فهرست رویدادهای Telegram و fixture واقعی Exposure در این محیط قابل مشاهده نیست و source contract جایگزین آن شد.
- تلاش برای navigation مستقیم به Waitlist در تب محلی timeout شد؛ هیچ mutation یا action اپراتوری انجام نشد.

## Phase 2 gate failure remediation — ۲۰۲۶-۰۹-۲۹

- اجرای `pnpm run phase-2:gate` تا بخش API دو failure معماری واقعی نشان داد:
  - `FIN-P1.9-01`
  - `FIN-P1.3-01`
- علت مشترک: تست جدید `registration-commercial-quote-freeze-context.adapter.spec.ts` داخل مسیر production به‌نام `apps/api/src/workspace-finance/infrastructure/` قرار گرفته بود؛ guard آن را به‌عنوان adapter production می‌شمرد و exact inventory را می‌شکست.
- کد production تغییر نکرد؛ تست به مسیر `apps/api/test/registration-commercial-quote-freeze-context.adapter.spec.ts` منتقل شد تا boundary تست/production حفظ شود.
- پس از اصلاح، تست‌های `finance-outbox-ownership.spec.ts`، `finance-ws2-engine.spec.ts` و تست جابه‌جاشده اجرا شدند: **۲۷/۲۷ PASS**.
- این failure یک regression source بود، نه failure runtime staging؛ هنوز closure staging با artifact SHA جدید انجام نشده است.
- بعد از جابه‌جایی، `pnpm run test:changed` با base=`origin/main` اجرا شد و **PASS** شد؛ `git diff --check` نیز سبز است.
- runtime محلی در پایان همچنان فقط یک frontend وب روی پورت ۳۰۰۰ و API روی پورت ۳۰۰۱ دارد؛ هیچ commit، push یا PR انجام نشده است.

## Local verification checkpoint — ۲۰۲۶-۰۹-۲۹

- فقط یک frontend لوکال فعال بود: Admin/Web روی `admin.denali.localhost:3000`؛ API روی `127.0.0.1:3001` فعال و `/health` برابر HTTP 200 بود. Marketing و Portal به‌صورت process جداگانه اجرا نشدند.
- smoke read-only واقعی Admin روی fixture تور `00000000-0000-4000-8000-000000000229` انجام شد: صف Waitlist یک نتیجه، ظرفیت `۱/۱`، badge «در لیست انتظار» و وضعیت مالی «پرداخت‌نشده (رزرو)» را نشان داد؛ هیچ approve، promotion یا mutation اجرا نشد.
- تست‌های focused این checkpoint: API `۲۲/۲۲`، Portal `۲۰/۲۰`، Web `۵۵/۵۵`، Denali `۱۴/۱۴` و Marketing `۴۵/۴۵` pass شدند.
- در Marketing، قراردادهای source برای قیمت عضو، free label/filter/sort و حمل/dong pass است؛ در Denali egress نیز shared-car `dongAmount` حفظ می‌شود. این نتایج source/local هستند و جایگزین runtime proof روی artifact جدید Staging نمی‌شوند.
- وضعیت باگ‌های runtime قدیمی تغییری اعلام نمی‌شود تا deploy با SHA جدید انجام شود؛ هیچ commit، push یا PR در این checkpoint انجام نشده است.

### Source fix — authenticated pricing preview fail-closed

- pipeline فیلتر و sort کاتالوگ اکنون همان قرارداد کارت قیمت را مصرف می‌کند: اگر session عضو باشد و preview برای یک تور موجود نباشد، قیمت پایه به‌صورت اشتباه وارد filter/sort نمی‌شود و نتیجه `null`/نامشخص می‌ماند.
- این اصلاح اختلاف order-dependent مربوط به `BUG-STG-081` را در حالت partial/unavailable preview پوشش می‌دهد؛ تست regression جدید به همراه suite قیمت `۳۱/۳۱` pass شد و Marketing lint/typecheck نیز سبز است.
- این اصلاح هنوز روی Staging deploy نشده است؛ closure runtime فقط بعد از deploy با SHA جدید معتبر است.

### Local Exposure UI smoke — ۲۰۲۶-۰۹-۲۹

- صفحهٔ `admin.denali.localhost:3000/settings/exposure` با همان frontend لوکال باز شد؛ عنوان، توضیحات سطح‌ها و state رابط فارسی بودند.
- محیط لوکال اتصال فعال Exposure/Telegram نداشت (`اتصال فعالی وجود ندارد`)، بنابراین toggle و ذخیرهٔ Exposure برای ساخت side effect جدید اجرا نشد.
- این مورد محدودیت fixture/config لوکال است، نه نتیجهٔ جدید برای باگ runtime؛ localization و redaction همچنان با source test پوشش داده شده‌اند و runtime Staging بعد از deploy SHA جدید باید تأیید شود.

### Additional local contract verification — ۲۰۲۶-۰۹-۲۹

- timezone و catalog display: `15/15 pass`؛ شامل `BUG-STG-035` با `Asia/Tehran` و قرارداد `BUG-STG-008/013`.
- Portal payment deadline: `5/5 pass`؛ Admin/operator payment deadline: `5/5 pass`.
- این نتایج source/local هستند؛ تناقض‌های مشاهده‌شده روی artifact قدیمی Staging با این تست‌ها به‌تنهایی بسته نمی‌شوند.

### API integration verification — ۲۰۲۶-۰۹-۲۹

- Denali catalog/Exposure integration: `15/15 pass`.
- Booking safety and waived projection: `12/12 pass`.
- Finance service and payment projection sync: `19/19 pass`.
- warning کنترل‌شدهٔ `BOOKINGS_DB_UNAVAILABLE` در سناریوی failure-injection تست بود و failure test محسوب نشد.

### Phase 1 full gate — ۲۰۲۶-۰۹-۲۹

- `pnpm run phase-1:gate`: **PASS**.
- Build کامل monorepo و build هر چهار سطح اصلی سبز شد؛ platform-core closure `79/79`، unit/internal `163/163` و phase contract `22/22` pass شدند.
- `guard:architecture`، `guard:import-boundary`، `guard:symlink`، adversarial specs و `phase-1:guard` همگی PASS شدند.
- دو warning build دربارهٔ duplicate keyهای قدیمی در root `package.json` و یک notice مربوط به ESLint Next.js ثبت شد؛ هیچ‌کدام failure نیستند و به تغییرات این دور مرتبط نیستند.

## Waived finance-surface hardening — ۲۰۲۶-۰۹-۲۹

- در بازبینی Admin یک نقص source در مسیر `BookingFinancialStrip` پیدا شد: `financialDisplayState=WAIVED` فقط settlement summary را تغییر می‌داد، اما می‌توانست invoice، payment و pending-receipt را fetch کند و payment-history/next-step را render کند.
- اصلاح شد: برای `WAIVED` هیچ finance fetch، invoice card، payment row، receipt/payment CTA یا next-step تولید نمی‌شود؛ فقط وضعیت مستقل «بدون نیاز به پرداخت» باقی می‌ماند. مسیر `paid` و وضعیت‌های unpaid/partial تغییر قراردادی نکردند.
- تست هدفمند Web: `23/23` pass؛ شامل تست منفی WAIVED برای next-step و بررسی عدم render/fetch سطح‌های مالی.
- Prettier: PASS؛ `test:changed`: PASS؛ `guard:import-boundary`: PASS؛ `git diff --check`: PASS.
- این اصلاح هنوز commit/deploy نشده است؛ closure staging نیازمند deploy همین working tree و بررسی runtime با fixture رایگان است.

## Local runtime recheck — ۲۰۲۶-۰۹-۲۹

- API process موجود بدون restart سالم بود: `GET http://127.0.0.1:3001/health` با HTTP `200`.
- تنها frontend مجاز Web/Admin روی پورت `3000` متوقف شده بود؛ همان process با `NEXT_FONT_OFFLINE=1` دوباره بالا آمد و `Ready` شد. Marketing و Portal اجرا نشدند.
- smoke host routing: درخواست `Host: admin.operator.localhost` به `/settings` با HTTP `307` به `/auth/login` برگشت؛ tenant route و auth boundary فعال است.

## Local catalog list/detail parity — ۲۰۲۶-۰۹-۲۹

- API local با tenant smoke `00000000-0000-4000-8000-000000000003` بررسی شد؛ list `/denali/catalog` و detail `/denali/catalog/:tourId` برای fixtureهای `220`، `228` و `229` مقدارهای یکسان `priceAmount`، `paymentCollection`، `spotsRemaining` و `registrationState` برگرداندند.
- fixture ظرفیت‌پر `229` در هر دو مسیر `spotsRemaining=0` و `registrationState=waitlist` دارد؛ برای این مسیر mismatch محلی وجود ندارد.
- endpoint `GET /catalog/pricing-previews` بدون هویت پاسخ `IDENTITY_REQUIRED` داد؛ بنابراین member-discount با session جعلی یا حدسی بررسی نشد و `BUG-STG-081` همچنان نیازمند fixture هویت‌دار/اجرای staging است.

## Local working-tree verification — ۲۰۲۶-۰۹-۲۹

- `pnpm run test:changed`: PASS؛ همهٔ packageهای تغییرکرده با cache معتبر بررسی شدند و اجرای نهایی `base=origin/main mode=ci` سبز بود.
- `pnpm run guard:import-boundary`: PASS.
- `pnpm run pre-commit:fast`: PASS؛ guard-docs و check-node-engine سبز هستند. چون فایل‌ها عمداً staged نشده‌اند، lint-staged و test-changed داخلی hook به‌درستی skip شدند؛ این مورد به‌عنوان جایگزین تست کامل staged ثبت نمی‌شود.
- `git diff --check`: PASS.
- نتیجه: source/local verification فعلی سبز است، اما failureهای runtime staging مثل `BUG-STG-019`، `BUG-STG-036`، `BUG-STG-039/072`، `BUG-STG-080`، دو projection پرداخت، `BUG-STG-082`، `BUG-STG-035`، CTA Waitlist و locale Exposure تا deploy همان تغییرات و retest با SHA runtime بسته نمی‌شوند.
- Focused local regression recheck همان روز: Portal `20/20`، Marketing `42/42`، Denali `14/14` و API finance/list/receipt `28/28` pass؛ warningهای `BOOKINGS_DB_UNAVAILABLE`/`MINIO_NOT_CONFIGURED` در تست‌های کنترل‌شدهٔ integration هستند و failure assertion نیستند.

## Local canonical financial projection guard — ۲۰۲۶-۰۹-۲۹

- علت source-level یک failure بالقوه پیدا شد: `BookingsService` مقدار persisted `financialDisplayState` را قبل از resolver canonical با `??` ترجیح می‌داد؛ یک `WAIVED` قدیمی می‌توانست روی ردیف approved/unpaid باقی بماند.
- اصلاح: List و Detail همیشه از resolver مشترک استفاده می‌کنند؛ resolver فقط بعد از تأیید `approved` و وضعیت پرداخت فعلی `paid` مقدار persisted `WAIVED` را می‌پذیرد و برای approved/unpaid مقدار stale را حذف می‌کند. free marker و zero-obligation همچنان از همان resolver عبور می‌کنند.
- regression جدید: `does not preserve a stale WAIVED projection for an unpaid approved row`.
- API booking-list/DI: `13/13 pass`؛ `test:changed`: PASS؛ import-boundary: PASS؛ Prettier و `git diff --check`: PASS.
- این اصلاح هنوز روی staging deploy نشده و runtime closure برای projectionهای staging همچنان نیازمند artifact جدید است.
- API package lint/typecheck و تمام prelint guards: PASS؛ فرانت Web/Admin همچنان تنها frontend فعال است و smoke محلی `admin.operator.localhost:3000/settings` با redirect احراز هویت HTTP 307 پاسخ داد.

## Local BUG-STG-080 complete-stale projection guard — ۲۰۲۶-۰۹-۲۹

- علت تکمیلی پیدا شد: List فقط projection ناقص را از Detail canonical دوباره می‌خواند؛ projection کامل اما stale (`offline`/`UNPAID`) بدون اصلاح باقی می‌ماند.
- اصلاح لوکال: تمام ردیف‌های `approved` از owned Detail دوباره hydrate می‌شوند؛ ردیف‌های pending/waitlisted read اضافه نمی‌گیرند.
- تست regression برای legacy، partial-stale و complete-stale اضافه و اجرا شد: `16/16 pass` در `apps/portal/test/portal-member-registrations.spec.ts`.
- این اصلاح هنوز commit، deploy یا روی Staging retest نشده است؛ closure runtime `BUG-STG-080` همچنان نیازمند artifact جدید است.

## Local BUG-STG-022 participant total guard — ۲۰۲۶-۰۹-۲۹

- علت تکمیلی پیدا شد: در فرم چندparticipant، summary rail فقط قیمت نفر اول/preview اول را نشان می‌داد و جمع canonical نداشت.
- اصلاح لوکال: جمع فقط از `payableMinor`های authoritative همهٔ participantها ساخته می‌شود؛ transport/dong هر participant داخل همان preview باقی می‌ماند و تخفیف در frontend محاسبه نمی‌شود.
- اگر حتی یک preview ناقص باشد، total نمایش داده نمی‌شود تا مبلغ ناقص یا حدسی به کاربر نشان داده نشود.
- تست‌های Denali transport/due/pricing: `13/13 pass`؛ build workspace-denali و Portal lint/typecheck نیز pass شدند.
- ثبت نهایی چندنفره روی Staging هنوز انجام نشده و closure runtime به artifact جدید و fixture واقعی نیاز دارد.

## Local BUG-STG-063 inline/bulk capacity guard — ۲۰۲۶-۰۹-۲۹

- بازتولید قبل از اصلاح: fixture محلی `North Ridge Trek` با ظرفیت `۱/۱` و registration انتظار `00000000-0000-4000-8000-000000000312` (مهمان `Jamal Hosseini`، party size برابر ۳) در Waitlist workspace کنترل inline تأیید و کنترل bulk «انتخاب همهٔ قابل‌تأیید» را نمایش می‌داد؛ guard پنل جزئیات وجود داشت اما row و bulk از آن استفاده نمی‌کردند.
- اصلاح: `apps/web/src/features/bookings/bookings-command-center-shell.tsx` اکنون ظرفیت را از guard سطح تور یا snapshot canonical همان row resolve می‌کند و برای inline approve، انتخاب row و محاسبهٔ bulk به‌صورت مشترک اعمال می‌کند. `shouldShowInlineApprove` نیز در `bookings-command-center-logic.ts` با `capacityFull` fail-closed شده است.
- Regression source: suite وب مرتبط `۷۲/۷۲` pass؛ `apps/web` lint/typecheck و import/UI boundary guardها PASS؛ `pnpm run test:changed` PASS؛ `git diff --check` PASS.
- Browser evidence بعد از اصلاح: Admin محلی با همان tour/registration و ظرفیت `۱/۱`، heading ظرفیت `۱/۱ نفر — ظرفیت تور پر است` را نشان داد؛ در AX row فقط وضعیت `در لیست انتظار` و اطلاعات مهمان را داشت و هیچ کنترل inline تأیید یا bulk select وجود نداشت.
- نتیجه: `BUG-STG-063` در local source/runtime fixture **PASS** شد. این نتیجه جایگزین staging artifact proof نیست و deploy/PR انجام نشده است.

## Local BUG-STG-082 organized-transport dong leak guard — ۲۰۲۶-۰۹-۲۹

- در audit کد PDP مشخص شد `dongAmount` بدون محدودشدن به mode نمایش داده می‌شد؛ اگر payload حمل سازمانی هم‌زمان dong داشته باشد، PDP می‌توانست مبلغ حمل و دُنگ را با هم نشان دهد.
- اصلاح در `apps/marketing/src/catalog/format-catalog-transport.ts`: `resolveCatalogDongAmount` فقط برای `shared_cars` مقدار می‌دهد. PDP logistics از همین helper استفاده می‌کند؛ مقدار `transportCostAmount` همچنان فقط برای حمل سازمانی مصرف می‌شود.
- Regression Marketing focused: `۱۸/۱۸` pass؛ شامل policy PDP، free label، member pricing، shared-car dong و تست منفی organized transport. Marketing lint/typecheck و import-boundary PASS.
- نتیجه: نشت دُنگ در payload حمل سازمانی در local source **PASS** شد؛ runtime staging جدید هنوز برای closure نهایی deploy نشده است.

## Local BUG-STG-037 closure follow-up — ۲۰۲۶-۰۹-۲۹

- علت ریشه‌ای شمارندهٔ operational پیدا شد: endpoint با `limit=1` همان صفحهٔ اول را برای `total` محاسبه می‌کرد؛ در نتیجه badge می‌توانست با تعداد واقعی ردیف‌های جدول اختلاف داشته باشد.
- اصلاح استاندارد با پارامتر صریح `countOnly=1` انجام شد؛ شمارنده تمام صفحات همان فیلتر canonical را می‌خواند و endpoint معمولی pagination و `items` را دست‌نخورده نگه می‌دارد.
- regression جدید API: `۹/۹` pass؛ شامل اثبات دو ردیف approved با `limit=1` و `countOnly=true` که `total=2` و `items=[]` برمی‌گرداند.
- regression Web مرتبط: `۴۷/۴۷` pass؛ helper شمارنده `countOnly=1` را تولید می‌کند.
- گیت‌ها: `pnpm run test:changed`، `pnpm run guard:import-boundary` و `git diff --check` همگی PASS.
- تأیید UI محلی با فقط یک frontend Web روی `admin.operator.localhost:3000`: شمارندهٔ لیست عملیاتی `۱` و ردیف `Ali Rezaei` با وضعیت `پرداخت‌نشده` هم‌زمان دیده شد؛ ردیف Waitlist `Jamal Hosseini` در operational list وارد نشد.
- این closure فقط source و local runtime است؛ staging با artifact جدید هنوز deploy نشده و closure نهایی staging محسوب نمی‌شود.

## Local P0-P2 focused regression — ۲۰۲۶-۰۹-۲۹

- API finance/receipt/list projection: `۲۸/۲۸` pass؛ شامل free=`WAIVED`، approve projection، receipt flow و payment sync.
- Web booking/action matrix: `۲۵/۲۵` pass؛ شامل full-capacity waitlist guard، labelهای مستقل payment/registration و `BUG-STG-037`.
- Portal registration/status: `۲۵/۲۵` pass؛ شامل free status، receipt resubmit، timezone و waitlist guest-flow contract.
- Marketing merchandising: `۴۴/۴۴` pass؛ شامل member/guest preview، free label، free filter/sort، transport/dong و PLP/PDP parity contract.
- Exposure و locale: `۱۸/۱۸` pass؛ شامل `BUG-STG-019`، `BUG-STG-036`، `BUG-STG-006` و `location-zones` فارسی.
- هیچ frontend اضافه‌ای برای این regressionها بالا نیامد؛ همان Web/Admin محلی تنها frontend فعال باقی ماند.
- `pnpm run pre-commit:fast` نیز PASS شد؛ چون worktree عمداً dirty و بدون stage نگه داشته شده، lint-staged و test-changed داخل hook طبق قرارداد `skip` شدند و گیت‌های مستقل بالا به‌صورت جداگانه اجرا و سبز شدند.
- typecheck ابتدا یک drift واقعی بین source و `@app-tour/workspace-denali/dist` پیدا کرد (`countOnly` در declaration قدیمی نبود). build رسمی workspace Denali اجرا شد و پس از آن `pnpm --filter @apps/api run lint` و `pnpm --filter @apps/web run lint` هر دو PASS شدند.
- duplicate guest race با `DATABASE_URL` و `DATABASE_URL_ADMIN` از `.env.local` و `STORAGE_DRIVER=prisma` اجرا شد: `۱/۱` pass؛ دو POST هم‌زمان دقیقاً یک `201` و یک `409` تولید کردند و رکورد دوم ساخته نشد.

## Local BUG-STG-080 partial-projection hardening — ۲۰۲۶-۰۹-۲۹

- edge case واقعی پیدا شد: ردیف approved با `paymentCollection=offline` اما بدون `financialDisplayState` از rehydrate جزئی عبور می‌کرد و می‌توانست پیام پرداخت stale را حفظ کند.
- hydration اکنون هر approved row با هر projection مالی ناقص را از Detail مالکانه دوباره می‌خواند و مقدار canonical را جایگزین می‌کند؛ ردیف‌های pending/waitlisted و projectionهای کامل همچنان بدون request اضافه می‌مانند.
- Portal focused regression: `۱۹/۱۹` pass؛ شامل سناریوی stale offline → `free/WAIVED`.
- Portal lint، typecheck و guardهای import/profile/architecture: PASS.

## Local capacity-guard follow-up — ۲۰۲۶-۰۹-۲۹

- در اجرای لوکال Web روی تور fixture `00000000-0000-4000-8000-000000000229` با ظرفیت `۱/۱`، Waitlist row با وجود ظرفیت پر هنوز action تأیید را render می‌کرد؛ متن UI نیز امکان تجاوز ظرفیت را القا می‌کرد. علت این بود که fallback ظرفیت فقط به resolver نمایش داده می‌شد و handlerهای approve فقط `tourCapacityGuard` اختصاصی را بررسی می‌کردند.
- اصلاح انجام شد: `effectiveCapacityGuard` اکنون منبع مشترک rendering و handlerهای approve/approve-without-payment است؛ API capacity guard همچنان مرجع نهایی باقی می‌ماند. این اصلاح فقط لوکال است و deploy نشده.
- تست‌های Web مربوط به availability، command center و management matrix: `۲۵/۲۵ pass`؛ تست‌های Denali transport/obligation و API finance obligation: `۲۰/۲۰ pass`.
- پس از patch، `pnpm run test:changed` و `pnpm run guard:import-boundary` نیز PASS شدند؛ این‌ها source evidence هستند و جای runtime/staging closure را نمی‌گیرند.
- پس از reload لوکال، fixture در حین fetch به حالت skeleton/`ظرفیت باز` رفت و row دوباره برای مشاهدهٔ نهایی بارگذاری نشد؛ بنابراین UI mutation/transition واقعی در این checkpoint بسته نشده و باید پس از پایدارشدن fetch همان fixture دوباره دیده شود.

## Local remediation checkpoint — ۲۰۲۶-۰۹-۲۹

- ریشهٔ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` در source پیدا و اصلاح شد: registry واقعی `id=denali.location-zones` را با `canonicalPath=startPoint` می‌فرستد؛ localization اکنون identity پایدار `id` را نیز بررسی می‌کند و description فارسی را اعمال می‌کند.
- regression package Denali برای localization: `4/4 pass`؛ regression Web برای booking action و localization: `9/9 pass`.
- برای `BUG-STG-063`، صفحهٔ global Admin اکنون در صورت نبودن guard سطح تور، از `capacitySnapshot` همان ردیف به‌عنوان fallback استفاده می‌کند؛ بنابراین ردیف Waitlist با ظرفیت `۱/۱` نباید صرفاً به‌دلیل entry point عمومی action تأیید بگیرد. تست‌های Web booking matrix/command center: `25/25 pass`.
- پیام فارسی/انگلیسی `actionReason.capacityFull` به‌عنوان alias قراردادی کنار `capacity_full` اضافه شد تا renderهای قدیمی یا مسیرهای متفاوت به کلید خام نرسند.
- runtime محلی Web با fixture تور `00000000-0000-4000-8000-000000000229` و booking `92506218-b12d-48f7-b9bb-a9a3932c9c78` ردیف `در لیست انتظار` و ظرفیت `۱/۱` را نشان داد. تلاش approve قبلی در global route با `POST /approve → 409` متوقف شد و رکورد approved ساخته نشد؛ مسیر Workspace guard به‌دلیل cold compile/route loading هنوز evidence کامل ندارد.
- این checkpoint source/local است؛ staging artifact جدید هنوز deploy نشده و closure runtime موارد قبلی (`080`، `081`، `082`، `019`، `035`، `039/072` و projectionها) همچنان نیازمند deploy و retest با SHA واقعی هستند.
- P0 finance state hardening: `paymentStatus=paid` اکنون در Detail resolver، receipt form و live status-card copy بر `receiptStatus` stale مقدم است؛ receipt badge همچنان مستقل render می‌شود و دیگر متن upload/deadline برای registration paid تولید نمی‌شود. Portal regression این checkpoint `22/22 pass` است.

## Local Marketing runtime recheck — ۲۰۲۶-۰۹-۲۹

- روی یک frontend محلی Marketing و fixture رایگان `00000000-0000-4000-8000-000000000225`، PLP ابتدا مبلغ عددی `۲٬۵۰۰٬۰۰۰ تومان` را هم‌زمان با label رایگان نشان داد؛ این بازتولید واقعی `BUG-STG-025` بود و نشان داد source contract قبلی به‌تنهایی کافی نیست.
- اصلاح انجام شد: مسیر free collection در card و pricing breakdown دیگر `canonicalPrice` را render نمی‌کند؛ detail facts نیز به‌جای مبلغ، label `رایگان / بدون نیاز به پرداخت` را نمایش می‌دهد.
- Regression Marketing pricing: `۹/۹` pass؛ مجموع focused Marketing P2: `۴۰/۴۰` pass؛ `git diff --check` pass.
- Recheck مرورگر محلی پس از reload: PLP برای fixtureهای رایگان فقط label رایگان و PDP در بخش «قیمت» فقط `رایگان / بدون نیاز به پرداخت` نشان می‌دهد؛ مبلغ عددی و کنترل پرداخت در این مسیر دیده نشد. paid card همچنان مبلغ عددی خود را نشان می‌دهد.
- این اصلاح فقط در working tree است؛ commit، push، PR و staging deploy انجام نشده‌اند. برای closure staging باید همین source با artifact جدید deploy و با SHA runtime دوباره بررسی شود.

## Local free egress hardening — ۲۰۲۶-۰۹-۲۹

- بررسی مستقیم API Local نشان داد free fixtureها علاوه بر UI، در egress نیز `priceAmount=2500000` و `structuredData.offers.price` داشتند؛ این بخش مستقل از renderer و یک نشت/قیمت ساختگی در API و JSON-LD بود.
- اصلاح backend در `toDenaliCatalogCard`: وقتی `paymentCollection=free` است، `priceAmount=null` و Offer مربوط به JSON-LD حذف می‌شود؛ منطق filter/sort همچنان از free به‌عنوان صفر استفاده می‌کند.
- بعد از restart API، هر چهار free fixture Local `priceAmount=null` و `offers=null` برمی‌گردانند؛ HTML PDP نیز `priceAmount:null` دارد و Offer عددی ندارد.
- تست Denali `9/9` و Marketing `40/40` pass شدند؛ health API `200` و `git diff --check` pass است. این تغییر هنوز deploy staging نشده است.
- PLP Local با `minPrice=0&sort=price_asc` پس از null شدن مبلغ backend، هر چهار free fixture را ابتدای فهرست و بدون مبلغ عددی نمایش داد؛ paid fixtureها بعد از آن با مبلغ عادی باقی ماندند. این recheck، `BUG-STG-026 / 027` را در runtime محلی بدون regression تأیید کرد.

## Local transport parity recheck — ۲۰۲۶-۰۹-۲۹

- با seed رسمی tenant `operator` و فقط همان frontend Marketing، fixture `00000000-0000-4000-8000-000000000214` بررسی شد.
- PLP: `خودروهای مشترک` و `دونگی: ۸۰٬۰۰۰ تومان` را نشان داد.
- PDP facts و بخش Logistics همان mode را نشان دادند؛ پیش از اصلاح fact بالایی label اشتباه `هزینه حمل‌ونقل` داشت و Logistics `هزینه دونگی` داشت.
- اصلاح انجام شد: برای `transport.mode=shared_cars` label fact نیز از `detail.logistics.dongAmount` استفاده می‌کند؛ organized transport همچنان `هزینه حمل‌ونقل` می‌ماند.
- پس از reload مرورگر، هر دو سطح PDP label `هزینه دونگی` و مبلغ `۸۰٬۰۰۰ تومان` را نشان دادند؛ Marketing focused suite `۴۲/۴۲` pass شد.
- نتیجه Local برای `BUG-STG-082`: mode و مبلغ در PLP/PDP همسان شد. Exposure خاموش و staging runtime هنوز باید جداگانه با artifact deployشده بررسی شود.

## Local free payment-policy egress recheck — ۲۰۲۶-۰۹-۲۹

- API Local برای free fixture ابتدا `paymentMode=offline_receipt` را در payload عمومی برمی‌گرداند؛ UI آن را پنهان می‌کرد، اما این با قرارداد free بدون روش پرداخت هم‌خوان نبود.
- اصلاح backend: برای `paymentCollection=free`، `paymentMode` و `paymentPlan` از public detail/list egress حذف می‌شوند؛ `registrationApproval` برای copy معتبر قبل از ثبت‌نام باقی می‌ماند.
- پس از rebuild رسمی `@app-tour/workspace-denali` و restart API، free fixture با `priceAmount=null`, `paymentMode=null`, `paymentPlan=null`, `offers=null` برگشت.
- این تفاوت مهم source/runtime با rebuild package بسته شد؛ تست‌های Denali `17/17` و Marketing `29/29` pass شدند. staging هنوز deploy نشده است.

### 2026-09-29 — local Portal free projection and fixture reconciliation

- fixtureهای booking matrix برای tenant محلی Denali با context صحیح `workspaceType=denali` دوباره seed/reconcile شدند؛ هر شش fixture با `publish_status=published` در DB محلی قابل مشاهده شدند. اجرای قبلی بدون workspace context آن‌ها را draft ذخیره کرده بود و 404 می‌داد؛ این مشکل از روش اجرای seed بود، نه از منطق public catalog.
- فقط یک frontend محلی (Portal روی `3003`) فعال بود؛ API روی `3001` و هیچ Web/Admin/Marketing دیگری اجرا نشد.
- روی fixture `00000000-0000-4000-8000-000000000225`، ثبت‌نام واقعی از UI انجام شد و نتیجه `registrationId=61cc4879-5088-460e-8fba-1fe756f4078a` ایجاد شد.
- Portal List همان registration را با `تأیید شده` و `ثبت‌نام نهایی شده؛ پرداخت لازم نیست` نشان داد.
- Portal Detail همان registration را با `ثبت‌نام شما نهایی شده است`، `نیازی به پرداخت نیست`، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` نشان داد؛ هیچ deadline، outstanding balance، upload receipt یا CTA پرداخت render نشد.
- نتیجهٔ محلی: `BUG-STG-080` در source فعلی و مسیر واقعی local Portal PASS است؛ closure staging همچنان به deploy همین HEAD و runtime SHA نیاز دارد.
- fixture رایگان manual `00000000-0000-4000-8000-000000000224` نیز در UI بدون مبلغ و بدون کنترل پرداخت دیده شد؛ fixture discount `00000000-0000-4000-8000-000000000226` برای حساب فعلیِ owner بدون membership discount نمایش داده شد و تست member-discount باید با identity fixture اختصاصی source/E2E ادامه یابد.
- تست‌های محلی تکمیلی روی همین HEAD: DP1 waitlist/payment-hold `2/2 pass`، شامل نگه‌داشتن گروه بزرگ‌تر از ظرفیت در Waitlist (`BUG-STG-063`)؛ Postgres duplicate race `1/1 pass`، دقیقاً یک `201` و یک `409` (`BUG-STG-021`).
- روی tenant محلی فعلی برای تور `00000000-0000-4000-8000-000000000220` هیچ registration موجودی نبود؛ بنابراین UI ظرفیت‌پر/Waitlist واقعی با mutation گروهی در این دور قابل بازسازی نشد و به‌عنوان fixture missing باقی ماند. تست source/API همچنان سبز است و submit گروهی عمداً بدون fixture معتبر تکرار نشد.

### 2026-09-29 — local real Waitlist UI fixture

- برای جلوگیری از تغییر fixtureهای قبلی، تور ایزولهٔ محلی `00000000-0000-4000-8000-000000000229` با ظرفیت `۱`، ثبت‌نام رایگان و approval خودکار با builder رسمی ساخته و با `workspaceType=denali` published شد.
- ثبت‌نام خودی `4efd9f3c-dd97-4e76-b5b3-21f8ddf34753` از Portal ثبت و تأیید شد؛ سپس مهمان `QA Waitlist Guest` با registration ID `92506218-b12d-48f7-b9bb-a9a3932c9c78` از همان UI ثبت شد.
- فرم ظرفیت‌پر متن «این فرم درخواست شما را در لیست انتظار ثبت می‌کند» و CTA دقیق `ثبت درخواست لیست انتظار` داشت؛ copy ثبت‌نام عادی و کنترل upload/payment در مسیر Waitlist دیده نشد.
- Success screen صریحاً «درخواست در لیست انتظار ثبت شد» و انتقال به صف را نشان داد.
- Portal List همان رکورد را `لیست انتظار برای دیگری` و Portal Detail آن را با `درخواست شما در حال بررسی است`، `ثبت‌نام: لیست انتظار` و `رسید: لازم نیست` نشان داد؛ هیچ label تأییدشده، deadline یا CTA پرداخت وجود نداشت.
- نتیجهٔ local UI: `BUG-STG-062 / 047`، `BUG-STG-WAITLIST-GUEST-FORM-COPY`، `BUG-STG-064 / 065` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در مسیر Portal/guest فرم PASS شدند. promotion واقعی Admin هنوز با runner source/API پوشش داده شده و UI mutation آن نیازمند اجرای Admin جداست.

## Local Admin smoke and fixture gate — ۲۰۲۶-۰۹-۲۹

- فقط API و یک frontend از نوع Web/Admin فعال نگه داشته شد؛ Portal و Marketing برای رعایت محدودیت منابع اجرا نشدند. API روی `127.0.0.1:3001/health` با HTTP `200` و `database.status=ok` پاسخ داد و Web/Admin روی `admin.denali.localhost:3000` آماده بود.
- fixture رسمی local با `pnpm run db:seed` ایجاد/تکمیل شد تا tenant و tour Denali قابل دسترس باشند. login از مسیر واقعی UI انجام شد؛ درخواست OTP، verify/login و ability-context همگی HTTP `200` بودند و Dashboard با AX به‌درستی render شد.
- مسیر Admin bookings برای تور `00000000-0000-4000-8000-000000000220` با فیلتر `status=waitlisted` به‌صورت read-only باز شد: heading «مرکز رزروها»، فیلتر «در لیست انتظار» و پیام بدون نتیجه دیده شد. چون fixture local booking/waitlist ندارد، این نتیجه فقط route/filter rendering را تأیید می‌کند و mutation واقعی Waitlist/promotion را PASS نمی‌کند؛ وضعیت آن بخش `UNVERIFIED / fixture missing` باقی است.
- نتیجهٔ این smoke، سلامت runtime لوکال و route Admin است؛ هیچ commit، push، PR یا deploy انجام نشد.

## Local source and verification gate — ۲۰۲۶-۰۹-۲۹

- focused Waitlist suites روی HEAD فعلی: Marketing `18/18`، Portal `22/22` و Denali `30/30` pass؛ شامل CTA Waitlist، guest-form state، done-step copy، ظرفیت‌پر و party-size capacity guard.
- repository gates: `pnpm run pre-commit:fast`، `pnpm run guard:import-boundary` و `pnpm run test:changed` همگی PASS شدند. `test:changed` با `base=origin/main` در mode=ci اجرا شد.
- Web/Admin لوکال با `NEXT_FONT_OFFLINE=1` روی `admin.denali.localhost:3000` تنها frontend فعال است و API روی `127.0.0.1:3001` سالم است؛ Portal و Marketing عمداً اجرا نشدند.
- این gate source و local runtime را تأیید می‌کند؛ failureهای artifact قدیمی staging و mutationهای staging (approve/promotion/upload واقعی/Telegram delivery) تا deploy همان HEAD و اجرای fixture مربوطه closure محسوب نمی‌شوند.

## Local focused P0/P1/P2 regression — ۲۰۲۶-۰۹-۲۹

- API Finance/Exposure/quote-freeze: `19/19` pass؛ شامل free projection، receipt approve projection و جلوگیری از انتقال تخفیف عضو به participant دیگر.
- Web/Admin: `26/26` pass؛ شامل actionهای ظرفیت‌پر، KPI فیلترشده، locale fail-closed Exposure و matrix وضعیت رزرو.
- Denali finance/catalog/read services: `19/19` pass؛ شامل due lineهای trip/dong/transport، اَعمال حمل و اَثر آن در public card.
- Portal finance/registration/pricing: `25/25` pass؛ شامل timezone، free status، receipt/registration state، deadline و preview قیمت/هزینه‌های جانبی.
- این نتایج failure source جدیدی نشان ندادند؛ هیچ mutation staging، commit، push یا PR انجام نشد.

## Local Portal browser participant check — ۲۰۲۶-۰۹-۲۹

- Web/Admin متوقف و فقط Portal روی `denali.portal.localhost:3003` اجرا شد تا محدودیت منابع رعایت شود.
- فرم واقعی تور `00000000-0000-4000-8000-000000000220` باز شد. با افزودن مهمان و تکمیل fixture محلی، دو participant مستقل در UI دیده شدند و هر دو ردیف قیمت جداگانهٔ `۲٬۵۰۰٬۰۰۰ تومان` داشتند؛ state عضو و مهمان در preview به هم نشت نکرد.
- همان fixture محلی transport follow-up نداشت؛ بنابراین transport/dong چندنفره در Browser محلی برای این tour قابل اثبات نبود و `BUG-STG-022` برای این بخش `fixture missing` باقی ماند. source/API قرارداد مربوطه `PASS` است.
- tour smoke حمل `...0214` در Portal local قابل resolve نبود و صفحهٔ 404 داد؛ هیچ mutation یا workaround انجام نشد.
- تلاش read-only برای free fixture `...0224` نیز در API/Portal local صفحهٔ 404 داد؛ بنابراین free-pending و مسیرهای ثبت‌نام رایگان در browser local fixture ندارند و از source/API test نتیجه‌گیری runtime نمی‌شود.

## Local continuation gate — ۲۰۲۶-۰۹-۲۹

- طبق محدودیت منابع، فقط Web/Admin روی پورت `3000` و API روی پورت `3001` فعال نگه داشته شدند؛ Portal و Marketing خاموش‌اند و پورت‌های `3002` و `3003` listener ندارند.
- `pnpm run test:changed`: PASS با base=`origin/main` و mode=`ci`.
- `git diff --check`: PASS.
- source فعلی همچنان بدون commit، push یا PR نگه داشته شد.
- آخرین بررسی source تأیید کرد که timezone نمایش اپراتور و Portal هر دو `Asia/Tehran` هستند و mapping فارسی رویدادهای Telegram در source حاضر است؛ این evidence جایگزین deploy/retest staging با SHA جدید نیست.
- Admin local route و labelهای Waitlist render شدند، اما login با identity مجاز توسعه روی مرحلهٔ ارسال OTP متوقف ماند و API widgetها `401` دادند؛ برای جلوگیری از bypass، Admin data-level smoke در این اجرا `UNVERIFIED` باقی ماند.
- focused local source gate: API `27/27`، Portal `22/22`، Web `26/26`، Marketing `8/8` و Denali `28/28` pass.
- `pnpm run pre-commit:fast`: PASS؛ `pnpm run guard:import-boundary`: PASS؛ هیچ فایل staged نشد و هیچ commit/push/PR ساخته نشد.

## Local continuation — BUG-STG-022 و BUG-STG-063 — ۲۰۲۶-۰۹-۲۹

- ریشهٔ `BUG-STG-022` در resolver تجاری quote پیدا شد: برای `registrantTarget=other`، شناسهٔ submitter عضو به‌اشتباه به‌عنوان `memberUserId` وارد quote می‌شد و تخفیف عضو را به مهمان منتقل می‌کرد.
- اصلاح local: فقط `registrantTarget=self` مجاز به دریافت `memberUserId` است؛ برای `other` مقدار canonical برابر `null` است. تست adapter جدید self/other و تست‌های quote/finance در مجموع `۲۳/۲۳` pass شدند.
- ریشهٔ `BUG-STG-063` در availability UI پیدا شد: وقتی ظرفیت کامل بود، hint نمایش داده می‌شد اما actionهای approve همچنان فعال می‌ماندند.
- اصلاح local: در ظرفیت کامل، approve و approve-without-payment مخفی و reject همچنان مجاز است؛ تست‌های availability، matrix و command center در مجموع `۲۵/۲۵` pass شدند.
- Web lint/typecheck و guardهای package: PASS؛ API lint/typecheck و guardهای package: PASS.
- این اصلاحات هنوز روی staging deploy نشده‌اند؛ بنابراین closure runtime برای `BUG-STG-022/063` بعد از deploy با SHA جدید لازم است.

## Local continuation — BUG-STG-037 — ۲۰۲۶-۰۹-۲۹

- ریشهٔ اختلاف شمارنده و جدول پیدا شد: `/bookings/summary` شمارندهٔ global می‌داد، اما جدول `/bookings` با فیلترهای `status/tourId/...` می‌آمد.
- اصلاح local: وقتی KPI فعال است، مقدار همان KPI از `listData.total` همان query فیلترشده خوانده می‌شود؛ در داشبورد بدون KPI فعال، summary global حفظ می‌شود.
- regression جدید `BUG-STG-037` اضافه شد: waitlist فیلترشده با total صفر دیگر badge global هفت را نشان نمی‌دهد؛ تست focused command center همراه با action matrix در مجموع `۲۵/۲۵` pass شد.
- این اصلاح نیز هنوز deploy نشده؛ staging closure نیازمند اجرای همان URL فیلترشده روی artifact جدید است.

## Local runtime/resource gate — ۲۰۲۶-۰۹-۲۹

- API روی `127.0.0.1:3001` با health `200` فعال است و فقط Portal روی `127.0.0.1:3003` اجرا شد؛ Marketing و Web برای حفظ منابع اجرا نشدند.
- Portal بدون session به `/login` redirect می‌کند؛ این محدودیت محیط local است و failure محصول محسوب نمی‌شود.
- `git diff --check`: PASS. هیچ commit، push، PR یا deploy انجام نشده است.

## Critical focused local verification — ۲۰۲۶-۰۹-۲۹

- Exposure profile/redaction contract: `۴/۴` pass؛ شامل merge امن seed قدیمی و عدم override پروفایل native.
- Quote freeze برای pricing چندنفره: `۲/۲` pass؛ `other` تخفیف submitter را نمی‌گیرد و `self` تخفیف عضو را حفظ می‌کند.
- Portal مالی/رسید: `۲۱/۲۱` pass؛ free، deadline، receipt/registration label و legacy approved list projection پوشش داده شد.
- Marketing merchandising: `۳۰/۳۰` pass؛ member price، guest/base fallback، free filter/sort و transport/dong پوشش داده شد.
- Web operational queue: `۲۵/۲۵` pass؛ capacity-full approval، Waitlist و شمارندهٔ فیلترشدهٔ `BUG-STG-037` پوشش داده شد.
- این شواهد source/local هستند؛ به‌دلیل عدم deploy، failureهای artifact staging هنوز closure محسوب نمی‌شوند.
- یک stale-state کوتاه در زمان تعویض فیلتر نیز بررسی و اصلاح شد: نوار KPI تا پایان fetch جدید render نمی‌شود؛ regression و Web lint/typecheck پس از این اصلاح دوباره سبز شدند.
- Local browser smoke روی `http://127.0.0.1:3003/me/registrations` با AX انجام شد؛ بدون session به `/login?portalReturn=%2Fme%2Fregistrations` رفت و صفحهٔ ورود، فیلد موبایل و CTA ارسال کد را render کرد. هیچ mutation اجرا نشد.
- برای پوشش Admin، Portal متوقف و فقط `@apps/web` روی پورت `3000` اجرا شد. Admin local با host `admin.denali.localhost` و صفحهٔ Login/داشبورد/فیلتر Waitlist render شد؛ درخواست‌های widgetهای API در این local session پاسخ `401` دادند، بنابراین دادهٔ واقعی صف و mutation بسته نشد. طبق راهنمای QA، به credential دیگری retry یا auth bypass نشد.
- تلاش کنترل‌شده برای login با identity مجاز local (`+15550001001` / OTP توسعه `1234`) در UI انجام شد؛ دکمه روی «در حال ارسال…» ماند و مرحلهٔ OTP/نشست API ایجاد نشد. به API shortcut یا bypass auth نرفتم؛ بنابراین Admin data-level smoke فعلاً `UNVERIFIED` است.

## Local continuation checkpoint — ۲۰۲۶-۰۹-۲۹

- روی branch `codex/staging-p0-p1-p2-final` با HEAD `1234f065a` هیچ commit، push یا PR جدیدی انجام نشد؛ تغییرات قبلی و فایل‌های unrelated حفظ شدند.
- فقط API روی پورت `3001` و Portal روی پورت `3003` فعال بودند؛ هیچ frontend دوم اجرا نشد. API health با `200` و Portal با `307` به login برای مسیر محافظت‌شده پاسخ دادند؛ `Cache-Control: no-store` در Portal دیده شد.
- focused source suites سبز شدند: Portal `21/21`، API `40/40`، Marketing `32/32`، Denali `19/19` و Web `16/16`.
- `pre-commit:fast`، `guard:import-boundary` و `git diff --check` سبز شدند. این gateها source/local هستند و artifact staging را تغییر نمی‌دهند.
- نتیجه closure: اصلاحات local برای projection مالی، receipt/registration state، exposure redaction/defaults و member pricing تست شدند؛ `BUG-STG-081`، `BUG-STG-082`، `BUG-STG-080` و Telegram label runtime فقط بعد از deploy همین HEAD قابل بستن هستند. Waitlist promotion واقعی، duplicate submit واقعی، upload باینری و Telegram delivery همچنان staging-only هستند.
- اصلاح جدید local برای `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: قبل از warm شدن host adapter، فیلدهای خام registry render نمی‌شوند؛ در خطای warm-up نیز UI fail-closed و بدون metadata انگلیسی باقی می‌ماند. Web focused `16/16` و lint/typecheck/guards سبز است.
- regression جدید `apps/web/test/exposure-policy-host-warmup.spec.ts` نیز `1/1` pass شد تا fallback قبلیِ render کردن `exposureCandidateFields` پیش از readiness برنگردد.
- `pnpm run test:changed` نیز با base `origin/main` و mode `ci` به‌صورت کامل `PASS` شد؛ هیچ تغییر source جدیدی از این verification باقی نماند.
- side-effect review تکمیل شد: readiness اکنون با `pluginId` جفت است و در تغییر workspace، adapter قبلی یک بار دیگر مصرف نمی‌شود؛ regression/Telegram focused `4/4` و Web lint/typecheck/guards سبز است.

## Post-merge runtime recheck — ۲۰۲۶-۰۹-۲۹ — SHA 21a0ade0b3fce292276d43c8d19e6277c02cd7b8

- Runtime health روی هر سه host (`denali`, `portal`, `admin`) سبز است؛ artifact digest برابر `50a10a1fa6936c20bbeabf551175cdc33643a5fa7d07df405ca6810dcf732f6e` و cache در درخواست‌های بررسی `BYPASS` بود.
- Portal List و Detail برای registration رایگان legacy `4190860a-9948-4c62-b29b-85d3e494e765` ناسازگارند: Detail «نیازی به پرداخت نیست» اما List «برای نهایی‌شدن، پرداخت لازم است». BUG-STG-080 همچنان FAIL است. اصلاح local برای rehydrate وجود دارد ولی در runtime این SHA deploy نشده.
- Free pending fixture `c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` در Detail بدون deadline، CTA پرداخت یا upload و با `رسید: لازم نیست` دیده شد؛ مسیر free manual pending PASS است.
- Waitlist guest form برای تور ظرفیت‌پر copy مستقل «ثبت درخواست لیست انتظار» و پیام «ثبت‌نام نهایی نیست» دارد و payment/upload copy ندارد؛ BUG-STG-062/047 و WAITLIST-GUEST-FORM-COPY در smoke خواندنی PASS هستند، اما mutation promotion/submit انجام نشده است.
- Paid receipt fixture `f2144510-bc47-4d1f-b6ad-42002a6ac51a` در Portal هم‌زمان «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید» و «پرداخت تأیید شد / رسید شما تأیید شد» نشان می‌دهد؛ BUG-STG-039/072 FAIL قطعی است.
- P2 free label، `minPrice=0&maxPrice=0`، sort صعودی و نزولی PASS شدند؛ free با label صحیح نمایش داده شد، در صعودی ابتدا و در نزولی انتهای فهرست قرار گرفت.
- P2 member price در PLP برای session عضو با preview تخفیف صحیح PASS شد؛ اما PLP API برای `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` فیلد `transport` ندارد در حالی‌که Detail همان تور `shared_cars` و `dongAmount=344444` دارد. BUG-STG-082 همچنان FAIL و منشأ آن projection list/detail است، نه CSS.
- Admin Exposure فعلاً event labelهای فارسی را نشان می‌دهد، اما کارت public-list روی «نمایش پیش‌فرض» است و فهرست فیلدهای location-zones برای اثبات redaction/description باز نشده؛ BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE و BUG-STG-036/019 به‌عنوان closure نهایی UNVERIFIED باقی می‌مانند.
- Admin bookings شمارنده‌های `در انتظار=۱۰`، `در لیست انتظار=۸` و ردیف‌های waitlist با label مستقل را نشان می‌دهد. approve واقعی روی registration جدید در این recheck اجرا نشد؛ Admin/Finance post-approve projection، race promotion/duplicate و hidden Exposure mutation هنوز UNVERIFIED هستند.

## Source recheck after runtime continuation — ۲۰۲۶-۰۹-۲۹

- Portal registration suite: `14/14` PASS؛ شامل hydrate legacy free projection و قرارداد receipt/registration.
- Marketing focused suites: `38/38` PASS؛ شامل free filter/sort، member pricing، transport formatter و PDP/PLP contracts.
- Denali focused suites: `8/8` PASS؛ شامل public card transport egress و spots enrichment.
- این source results با runtime API mismatch برای `BUG-STG-082` و runtime List/Detail mismatch برای `BUG-STG-080` تناقض ندارند؛ artifact staging هنوز patch local را ندارد و list/detail egress در runtime باید جداگانه اصلاح و deploy شود.

## Post-merge runtime recheck — ۲۰۲۶-۰۹-۲۹ — SHA `21a0ade0b3fce292276d43c8d19e6277c02cd7b8`

- Portal List با query مستقل `qa_recheck=20260929followup` دوباره بررسی شد: free approved registration `4190860a-9948-4c62-b29b-85d3e494e765` هنوز «برای نهایی‌شدن، پرداخت لازم است» دارد، درحالی‌که free fixtures `c26e18b7-bf20-4fce-a186-b874b0af9872` و `74fcff3c-d046-4835-a26d-596bd4a9dcb7` «پرداخت لازم نیست» دارند. `BUG-STG-080` همچنان FAIL و account/legacy-row specific است.
- همان free registration در Portal Detail «ثبت‌نام شما نهایی شده است»، «رسید: لازم نیست» و «نیازی به پرداخت نیست» دارد؛ اختلاف List/Detail با AX مستقل تأیید شد.
- free pending `c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` در Detail «در انتظار بررسی / رسید: لازم نیست» دارد و هیچ payment CTA، deadline یا upload receipt ندارد؛ `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` در این مرز PASS read-only است.
- Waitlist form برای `e8c21d68-b161-4085-9dd3-b03b59540d39` copy مستقل ظرفیت‌پر و CTA «ثبت درخواست لیست انتظار» دارد و payment/upload copy ندارد؛ `BUG-STG-062/047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` در این مرز PASS copy smoke هستند، نه promotion mutation.
- Paid receipt fixture `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هنوز هم‌زمان «رسید پرداخت را ارسال کنید»، `رسید: تأیید شده`، «پرداخت تأیید شد» و deadline دارد؛ `BUG-STG-039/072` و paid projection closure همچنان FAIL هستند.
- `/api/catalog` برای `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` فیلد `transport` ندارد، اما `/api/catalog/{tourId}` همان تور را با `mode=shared_cars` و `dongAmount=344444` برمی‌گرداند؛ `BUG-STG-082` در API list/detail و PLP/PDP parity همچنان FAIL است.
- focused source suites بعد از این recheck: Marketing `38/38`، Denali catalog `8/8`، Portal member registration `14/14` pass. این سبزی source، failureهای runtime فوق را نمی‌بندد.

## Post-merge staging recheck — ۲۰۲۶-۰۹-۲۹ — runtime `21a0ade0b3fce292276d43c8d19e6277c02cd7b8`

- Deploy workflow `36474448092` موفق شد؛ artifact digest با `50a10a1fa6936c20bbeabf551175cdc33643a5fa7d07df405ca6810dcf732f6e` ثبت شد و API، Web، Marketing و Portal همگی health/smoke سبز شدند.
- P2 free filter/sort: `minPrice=0&maxPrice=0&sort=price_asc` سه نتیجهٔ رایگان با label «رایگان / بدون نیاز به پرداخت» برگرداند؛ **PASS runtime** برای `BUG-STG-025/026/027`.
- P2 member pricing/PDP: تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` در PDP قیمت عضو `۵۰۰٬۰۰۰ تومان`، تخفیف ۵۰٪، shared cars و دُنگ `۳۴۴٬۴۴۴ تومان` را نشان داد؛ **PASS PDP** برای `BUG-STG-081/082`.
- همان سناریو در PLP برای کارت `ec171184-1877-4501-9a92-857f712838e2` قیمت عضو و پایه را نشان داد، اما نوع حمل و مبلغ دُنگ در کارت وجود نداشت؛ `BUG-STG-082` همچنان **FAIL runtime** و اختلاف PLP/PDP باقی است.
- Portal Detail برای free fixture `4190860a-9948-4c62-b29b-85d3e494e765` صحیح است: «نیازی به پرداخت نیست» و `رسید: لازم نیست`.
- Portal List همان fixture هنوز «برای نهایی‌شدن، پرداخت لازم است» نشان می‌دهد؛ `BUG-STG-080` بعد از deploy نیز **FAIL runtime** است. ریشهٔ فعلی: legacy approved row در list فاقد marker مالی است، در حالی‌که owned detail از policy فعلی tour مقدار `free` را resolve می‌کند.
- اصلاح source برای `BUG-STG-080` در follow-up اضافه شد: فقط approved rowهای فاقد projection مالی، detail مالکانه را برای rehydrate کردن `paymentCollection/financialDisplayState` می‌خوانند؛ pending/waitlisted و rowهای دارای projection بدون request اضافه باقی می‌مانند. تست focused Portal `14/14` و lint/guards سبز شدند؛ deploy این follow-up هنوز انجام نشده است.

## Exposure location-zones locale recheck — ۲۰۲۶-۰۹-۲۸

- Admin فارسی روی `https://admin.denali.shenski.com/settings/exposure?qa_recheck=20260928ax2` باز شد.
- کارت «جزئیات کاتالوگ عمومی» با انتخاب سفارشی فعال بود و field واقعی `نقطه شروع` نمایش داده شد.
- label فارسی است، اما description/AX description همان متن انگلیسی registry را نشان می‌دهد: `Start, summit, camp and end location zones.`
- نتیجه: `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان **FAIL قطعی** است؛ مشکل در fallback ترجمه/registry باقی مانده است.

## Portal free/list and mutation fixture recheck — ۲۰۲۶-۰۹-۲۸

- Portal List با session جاری و query `qa_recheck=20260928free2` باز شد.
- fixture رایگان `4190860a-9948-4c62-b29b-85d3e494e765` در List هنوز متن «برای نهایی‌شدن، پرداخت لازم است» دارد؛ در Detail همان fixture «نیازی به پرداخت ندارید» و `رسید: لازم نیست` نشان می‌دهد.
- همان List رکورد duplicate `bc596f02-acdc-4ef9-b837-dcc0949f2a59` را به‌عنوان ثبت‌نام تأییدشده نشان می‌دهد و هر دو رکورد چندنفره `0b6d0cb3...` و `0e9fd673...` را نمایش می‌دهد.
- نتیجه: `BUG-STG-080`، `BUG-STG-021` و `BUG-STG-022` با یک read-only recheck مستقل همچنان **FAIL قطعی** هستند.

## P2 price filter/sort and operational filter recheck — ۲۰۲۶-۰۹-۲۸

- Marketing URL `https://denali.shenski.com/tours?minPrice=0&maxPrice=0&sort=price_asc` سه تور رایگان برگرداند؛ مقدارهای ورودی هر دو `0`، تعداد نتیجه `۳` و label هر کارت «رایگان / بدون نیاز به پرداخت» بود. نتیجه فیلتر صفر: **PASS**.
- Marketing URL `https://denali.shenski.com/tours?sort=price_desc&qa_recheck=20260928p2desc2` در ۱۶ نتیجه، تورهای پولی را قبل از رایگان‌ها و سه تور رایگان را در انتهای فهرست نشان داد. نتیجه sort نزولی: **PASS**.
- Admin URL `https://admin.denali.shenski.com/bookings?status=waitlisted&tourId=00000000-0000-0000-0000-000000000312&qa_recheck=20260928ops2` با وجود شمارنده کلی `۷`، برای fixture ظرفیت‌پر پیام «چیزی با این فیلترها پیدا نشد» داد؛ PLP همان fixture را با label «لیست انتظار» نشان می‌دهد.
- نتیجه: `BUG-STG-026 / 027` در runtime فعلی **PASS**؛ `BUG-STG-037` همچنان **FAIL قطعی**.

## Waitlist promotion and global operational list recheck — ۲۰۲۶-۰۹-۲۸

- با حذف فیلتر تور و حفظ صف «در لیست انتظار»، Admin فهرست عمومی را با `۷ نتیجه` و ۷ ردیف نشان داد.
- ردیف `QA P1 group over-capacity 20260928` با registration کوتاه‌شده `0000…0312`، party size `۳ نفر` و ظرفیت `۱۲/۱۲` همچنان `در لیست انتظار` است، اما button فعال `تأیید ...` دارد.
- هیچ action تأیید، promotion یا mutation در این recheck انجام نشد.
- نتیجه: `BUG-STG-063` **FAIL قطعی**؛ `BUG-STG-037` نیز با اختلاف بین فیلتر مستقیمِ بدون نتیجه و فهرست عمومیِ ۷ ردیفی **FAIL قطعی** باقی ماند.

## Receipt contradiction and runtime health recheck — ۲۰۲۶-۰۹-۲۸

- Portal Detail fixture `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` با registration `تأیید شده` و receipt `تأیید شده` باز شد.
- همان صفحه هم‌زمان متن `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` و کارت `پرداخت تأیید شد` را نشان می‌دهد.
- نتیجه: `BUG-STG-039 / 072` و projection Detail بعد از approve همچنان **FAIL قطعی** هستند؛ fresh fixture قبلی PASS بود، اما fixture قدیمی/واقعی stale باقی مانده است.
- health سه host (`denali`, `portal`, `admin`) همگی HTTP 200 با `x-cache: BYPASS` بودند؛ این recheck روی runtime پاسخ‌گو انجام شد.

## Guest pricing preview recheck — ۲۰۲۶-۰۹-۲۸

- فرم مهمان تور تخفیف‌دار `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` بدون submit باز شد.
- با افزودن دو همراه، هر دو کارت مهمان قیمت مستقل و پایه `۱٬۰۰۰٬۰۰۰ تومان` نشان دادند؛ تخفیف عضو به مهمان منتقل نشد.
- خلاصه فرم «مبلغ هر ثبت‌نام» و «پرداخت هر نفر جداگانه انجام می‌شود» را نشان داد.
- نتیجه: preview قیمت مهمان در `BUG-STG-022` **PASS**؛ اما خطای submit چندنفره/اتمیک که قبلاً با دو registration واقعی ثبت شد، همچنان **FAIL** است.

## Guest transport/dong control recheck — ۲۰۲۶-۰۹-۲۸

- در همان فرم مهمان، «ماشین شخصی خودم» و گزینه «۱ نفر» انتخاب شد.
- کنترل «تعداد افرادی که سوار می‌کنی (با هزینه دونگ)» ظاهر شد؛ مبلغ دُنگ در خلاصه قبل از submit نمایش داده نشد.
- نتیجه: وجود کنترل حمل **PASS**؛ مبلغ نهایی دُنگ بدون submit قابل closure نیست و برای `BUG-STG-022` **UNVERIFIED** می‌ماند؛ submit چندنفره قبلی همچنان **FAIL** است.

## Free PDP independent recheck — ۲۰۲۶-۰۹-۲۸

- Public PDP fixture `c3a3c778-99ab-4750-8dc6-3172fa5ce034` با عنوان `QA-STG-20260924-FREE-MANUAL` باز شد.
- در بخش پیش‌نمایش ثبت‌نام، label `رایگان / بدون نیاز به پرداخت` حاضر بود؛ price، payment method، payment plan و CTA پرداخت در AX/صفحه وجود نداشتند.
- نتیجه: `BUG-STG-025` و بخش PDP از `BUG-STG-080` **PASS**؛ ناسازگاری `BUG-STG-080` در Portal List/Admin همان registration جداگانه و همچنان باز است.

## Waitlist guest-form copy recheck — ۲۰۲۶-۰۹-۲۸

- ظرفیت fixture `e8c21d68-b161-4085-9dd3-b03b59540d39` در PDP صفر و در فرم مهمان متن روشن «ظرفیت تور تکمیل است؛ این فرم درخواست شما را در لیست انتظار ثبت می‌کند» نمایش داده شد.
- CTA فرم `ثبت درخواست لیست انتظار` بود و upload/CTA پرداخت وجود نداشت.
- پس از افزودن مهمان، فرم همچنان copy عمومی `پرداخت هر نفر جداگانه انجام می‌شود` و مبلغ `۰ تومان` را نشان داد.
- نتیجه: state و CTA Waitlist **PASS**، اما `BUG-STG-WAITLIST-GUEST-FORM-COPY` به‌دلیل نشت copy پرداخت **FAIL قطعی** است.

## Real Waitlist guest submit and detail recheck — ۲۰۲۶-۰۹-۲۸

- با fixture مهمان یکتا `QA Waitlist Runtime 20260928C` و شماره `09170000928` submit واقعی انجام شد؛ هیچ approve/cancel/payment action انجام نشد.
- registration جدید: `fb630288-60e0-4ee9-96d2-ae86084fbcc2`.
- Portal List آن را `لیست انتظار` برای دیگری نشان داد.
- Portal Detail نشان داد: `درخواست شما در حال بررسی است`، `ثبت‌نام: لیست انتظار` و `رسید: لازم نیست`.
- CTA یا upload پرداخت در Detail وجود نداشت و پیام «درخواست شما در انتظار تأیید باشگاه است» نمایش داده شد.
- نتیجه: `BUG-STG-064 / 065` و state واقعی Waitlist **PASS**؛ failure copy پرداختِ فرم قبل از submit در `BUG-STG-WAITLIST-GUEST-FORM-COPY` مستقل و همچنان **FAIL** است.

## Admin real Waitlist row/detail recheck — ۲۰۲۶-۰۹-۲۸

- Admin برای registration `fb630288-60e0-4ee9-96d2-ae86084fbcc2` row واقعی با `در لیست انتظار`، party size `۱` و ظرفیت `۱/۱` نشان داد؛ label `تأییدشده` نمایش داده نشد.
- Detail همان row، actionهای `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` را فعال نشان داد؛ هیچ‌کدام کلیک نشدند.
- نتیجه: label/state حمل Waitlist **PASS**؛ فعال‌بودن action تأیید برای ظرفیت پر، `BUG-STG-063` را با fixture واقعی نیز **FAIL قطعی** می‌کند.

## Operational status/query split recheck — ۲۰۲۶-۰۹-۲۸

- Admin با فقط `tourId=e8c21d68-b161-4085-9dd3-b03b59540d39` و status پیش‌فرض `نیازمند اقدام`، `۲ نتیجه` نشان داد.
- همان tour با URL `status=all&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39`، `۷ نتیجه` و ردیف‌های approved/cancelled/waitlisted را نشان داد.
- نتیجه: شمارنده و operational query بر اساس ترکیب status/query یکسان نیستند؛ `BUG-STG-037` **FAIL قطعی** و علت آن به اختلاف projection/filter محدود شد.

## Waitlist PLP/PDP state consistency recheck — ۲۰۲۶-۰۹-۲۸

- PLP fixture `e8c21d68-b161-4085-9dd3-b03b59540d39` را با ظرفیت صفر و label `رایگان / بدون نیاز به پرداخت — لیست انتظار` نشان داد.
- PDP همان fixture نیز ظرفیت `۰ جای خالی` و همان مسیر Waitlist را نشان می‌دهد؛ اختلاف state بین PLP و PDP در این اجرای واقعی دیده نشد.
- نتیجه: `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` در این fixture **PASS**؛ اختلاف Admin operational مستقل باقی است.

## Transport PLP/PDP cross-check — ۲۰۲۶-۰۹-۲۸

- PDP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` در AX، mode `خودروهای مشترک` و مبلغ `۳۴۴٬۴۴۴ تومان` را نشان داد.
- کارت همان تور در PLP فقط قیمت پایه `۱٬۰۰۰٬۰۰۰ تومان`، قیمت عضو `۵۰۰٬۰۰۰ تومان` و تخفیف ۵۰٪ را نشان داد؛ mode/cost/dong در کارت PLP وجود نداشت.
- نتیجه: `BUG-STG-081` **PASS**؛ `BUG-STG-082` همچنان **FAIL قطعی**.

## Free projection List-vs-Detail isolation — ۲۰۲۶-۰۹-۲۸

- Detail fixtureهای رایگان `c26e18b7-bf20-4fce-a186-b874b0af9872` و `4190860a-9948-4c62-b29b-85d3e494e765` هر دو `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` نشان دادند.
- Portal List برای `c26e18b7...` متن صحیح «ثبت‌نام نهایی شده؛ پرداخت لازم نیست» دارد، اما برای `4190860a...` هنوز «برای نهایی‌شدن، پرداخت لازم است» دارد.
- نتیجه: `BUG-STG-080` به‌طور مشخص در List projection/cache باقی است؛ Detail resolver فعلی **PASS** است.

## Duplicate guest runtime mutation — ۲۰۲۶-۰۹-۲۸

- در تور `c2690b98-d8be-404c-b2e8-9c4d6f62fb03`، حساب واردشده با شمارهٔ `09174656598` قبلاً برای خودش ثبت‌نام داشت.
- از همان flow ثبت‌نام مهمان، مهمانی با نام `QA Duplicate Runtime 20260928` و همان شمارهٔ حساب ثبت و submit شد.
- UI نتیجهٔ موفق `درخواست ثبت شد` را نشان داد و رکورد جدید با شناسهٔ `bc596f02-acdc-4ef9-b837-dcc0949f2a59` در Portal List ایجاد شد.
- رکورد به‌صورت `برای دیگری` و `تأیید شده` نمایش داده شد؛ duplicate rejection برای self/other در runtime رخ نداد.
- نتیجه: `BUG-STG-021` در staging **FAIL قطعی** است؛ source race test سبز، اما مسیر واقعی UI هنوز اجازهٔ ایجاد رکورد تکراری می‌دهد.

## Multi-participant pricing/transport runtime mutation — ۲۰۲۶-۰۹-۲۸

- در تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` دو guest با نام‌های `QA Multi Guest One 20260928` و `QA Multi Guest Two 20260928` ثبت شدند.
- هر دو guest در فرم مبلغ `۱٬۰۰۰٬۰۰۰ تومان` گرفتند؛ تخفیف عضو به guest منتقل نشد.
- برای guest اول transport «ماشین شخصی» با ظرفیت `۱ نفر` و برای guest دوم «فقط خودم می‌آیم» ثبت شد.
- submit پاسخ ترکیبی داد: `1 از 2 ثبت‌نام موفق بود` و برای یکی پیام duplicate نمایش داده شد، اما هر دو registration در List ایجاد شدند:
  - `0b6d0cb3-e070-4b88-b2c4-46174a63c543` — `QA Multi Guest Two 20260928`
  - `0e9fd673-9ebc-4647-bdad-8b18d820eff3` — `QA Multi Guest One 20260928`
- Portal Detail هر دو را `در انتظار بررسی` نشان داد و transportهای انتخاب‌شده را حفظ کرد؛ Admin نیز هر دو را با `تعداد نفرات ۱` و ظرفیت `۸/۳۳` نشان داد.
- نتیجه: بخش preview و حفظ transport **PASS**؛ اما atomicity/نتیجهٔ submit چندنفره **FAIL** است، چون پاسخ «۱ از ۲ موفق» با ایجاد دو رکورد ناسازگار است. `BUG-STG-022` بسته نمی‌شود.

## Receipt post-approval recheck — ۲۰۲۶-۰۹-۲۸

- fixture `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` در Portal اکنون `ثبت‌نام: تأیید شده` و `رسید: تأیید شده` دارد و پیام `پرداخت تأیید شد` را نمایش می‌دهد.
- همان Detail هم‌زمان متن `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` را نمایش می‌دهد.
- Admin برای همان شناسه هنوز `تأییدشده پرداخت جزئی (رزرو)` و متن `پیگیری پرداخت` دارد؛ Finance قبلاً مبلغ پرداختی و بدهی صفر را ثبت کرده بود.
- صف رسیدها در Admin در لحظهٔ بررسی خالی بود؛ بنابراین approve دوباره اجرا نشد و mutation تکراری ایجاد نکردیم.
- نتیجه: post-approval projection همچنان **FAIL قطعی** است؛ `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` باز می‌مانند.

## Runtime/deploy gate — ۲۰۲۶-۰۹-۲۸

- HEAD source فعلی: `7eccfa6d27ee762f4c4f333541d7305ac3582252`؛ working tree فقط شامل ledger QA و فایل dirty قبلی است.
- artifact staging ثبت‌شده: release `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`، digest `ce8aba3f0dda40027722a077513678702b166e64ac56bfad95fa6f0c26b0416c`، deploy run `36434901424`.
- `/health` هر سه host با HTTP 200 پاسخ دادند و `x-cache: BYPASS` بود؛ بنابراین شواهد این دور از cache قدیمی CDN ناشی نیست.
- این گیت فقط provenance/runtime را تأیید می‌کند و failureهای projection، duplicate و submit چندنفرهٔ ثبت‌شده را نمی‌بندد.

## Fresh receipt approval cross-surface recheck — ۲۰۲۶-۰۹-۲۸

- برای registration `bc596f02-acdc-4ef9-b837-dcc0949f2a59` (QA Duplicate Runtime 20260928)، Portal یک receipt متنی با توضیح `QA text receipt approve 20260928` ساخت.
- Admin receipt queue آن را با وضعیت pending و مبلغ `۲٬۵۰۰٬۰۰۰ تومان` نشان داد؛ approve اجرا شد و پیام `تأیید شد — پرداخت‌شده. مانده ۰.` ثبت شد.
- بعد از approve:
  - Portal Detail: `سفر شما نهایی شده است`، `ثبت‌نام: تأیید شده`، `رسید: تأیید شده`.
  - Portal List: `پرداخت ثبت شد`.
  - Admin row: `وجه دریافت شد`، بدون deadline پرداخت.
  - Finance payments: `۲٬۵۰۰٬۰۰۰ تومان ثبت‌شده (این پرداخت)`.
- این fixture جدید cross-surface **PASS** است؛ اما fixture قدیمی `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` همچنان stale/contradictory است و بنابراین باگ‌های projection به‌صورت کلی بسته نمی‌شوند.

## Source gate after runtime continuation — ۲۰۲۶-۰۹-۲۸

- `pnpm run guard:import-boundary`: **PASS**.
- `pnpm run test:changed`: **PASS**؛ همهٔ workspace targetهای مرتبط cache-hit و سبز بودند.
- این source gate failureهای runtime ثبت‌شده برای duplicate، multi-submit، free projection و stale projection را override نمی‌کند.

## Free projection and Exposure-off runtime recheck — ۲۰۲۶-۰۹-۲۸

- Free fixture `4190860a-9948-4c62-b29b-85d3e494e765` در Portal Detail درست است: `ثبت‌نام شما نهایی شده است`، `نیازی به پرداخت ندارید` و `رسید: لازم نیست`.
- همان fixture در Portal List هنوز `برای نهایی‌شدن، پرداخت لازم است` نشان می‌دهد؛ Admin نیز آن را `تأییدشده پرداخت‌نشده (رزرو)` با متن پیگیری پرداخت نشان می‌دهد.
- نتیجهٔ `BUG-STG-080`: **FAIL قطعی و چندسطحی**.
- برای Exposure، فیلد `تور پولی (ثبت‌نام با پرداخت)` در سطح `جزئیات کاتالوگ عمومی` موقتاً خاموش و پس از تست restore شد.
- در PDP عمومی با Exposure خاموش، همچنان این موارد render شدند: `خودروهای مشترک`، `۳۴۴٬۴۴۴ تومان` هزینهٔ حمل/دُنگ، قیمت پایه `۱٬۰۰۰٬۰۰۰ تومان`، تخفیف `۵۰٪` و قیمت عضو `۵۰۰٬۰۰۰ تومان`.
- نتیجهٔ `BUG-STG-019 / 036`: **FAIL قطعی در API/HTML/AX boundary**؛ تنظیم Exposure بعد از تست به `۱۲ از ۱۲` و فیلد مالی روشن restore شد.

## Over-capacity Waitlist promotion recheck — ۲۰۲۶-۰۹-۲۸

- fixture `00000000-0000-0000-0000-000000000312` با نام `QA P1 group over-capacity 20260928` در صف Waitlist پیدا شد.
- Admin آن را با `تعداد نفرات ۳` و ظرفیت `۱۲/۱۲`، state `در لیست انتظار` نشان داد.
- با بازکردن detail، actionهای `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` هر دو همچنان قابل‌اجرا بودند؛ هیچ‌کدام کلیک نشد.
- نتیجه: `BUG-STG-063` **FAIL قطعی**؛ گروهی که در ظرفیت آزاد جا نمی‌شود نباید action promotion قابل‌اجرا داشته باشد.

## Operational Waitlist counter/filter recheck — ۲۰۲۶-۰۹-۲۸

- operational view بدون فیلتر `در لیست انتظار` را `۷ کل` نشان داد و هفت row واقعی render کرد.
- همان view با فیلتر تور `e8c21d68-b161-4085-9dd3-b03b59540d39` پیام `چیزی با این فیلترها پیدا نشد` داد، درحالی‌که همان tour fixture در سابقهٔ Waitlist وجود دارد.
- نتیجه: `BUG-STG-037` همچنان **FAIL**؛ count/filter و نتیجهٔ جدول از یک query/state واحد نمی‌آیند.

## P2 transport/price recheck — ۲۰۲۶-۰۹-۲۸

- PLP با `sort=price_asc` برای تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` قیمت پایه `۱٬۰۰۰٬۰۰۰` و قیمت عضو `۵۰۰٬۰۰۰` را نشان داد.
- PDP همان تور قیمت پایه/عضو را درست نشان داد و `BUG-STG-081` همچنان **PASS** است.
- PDP نوع حمل `خودروهای مشترک` و مبلغ `۳۴۴٬۴۴۴ تومان` را نشان داد؛ کارت PLP همان تور هیچ نوع حمل یا مبلغ دُنگی ندارد.
- نتیجه: `BUG-STG-082` همچنان **FAIL قطعی** است.

## Exposure-off runtime recheck — ۲۰۲۶-۰۹-۲۸

- در Admin، فیلد `تور پولی (ثبت‌نام با پرداخت)` برای سطح `جزئیات کاتالوگ عمومی` به‌صورت کنترل‌شده از ۱ به ۰ تغییر کرد و ذخیره شد؛ پس از تست به ۱ برگردانده شد و AX مقدار ۱ و پیام `نمایش سطح ذخیره شد` را نشان داد.
- در زمان خاموش‌بودن فیلد، درخواست anonymous به PDP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` همچنان در SSR شامل `dongAmount`، `خودروهای مشترک`، `۳۴۴٬۴۴۴ تومان`، markerهای پرداخت و `member` بود.
- نتیجه قطعی: `BUG-STG-019 / 036` در مرز خروجی anonymous HTML/SSR همچنان **FAIL** است؛ redaction در API/خروجی عمومی enforce نشده و صرفاً سبز بودن source test closure محسوب نمی‌شود.

## Runtime continuation — ۲۰۲۶-۰۹-۲۸

- `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` در Portal Detail با `ثبت‌نام: تأیید شده` و `رسید: تأیید شده` نمایش داده شد، اما همان صفحه هنوز متن `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` را دارد؛ `BUG-STG-039 / 072` و projection بعد از approve همچنان **FAIL** هستند.
- `4190860a-9948-4c62-b29b-85d3e494e765` در Portal Detail به‌درستی `ثبت‌نام شما نهایی شده است`، `رسید: لازم نیست` و `نیازی به پرداخت نیست` نشان می‌دهد؛ این فقط Detail است و تناقض قبلی Portal List برای `BUG-STG-080` را نمی‌بندد.
- در Admin با fixture `00000000-0000-0000-0000-000000000312`، گروه ۳نفره با ظرفیت `۱۲/۱۲` و state `در لیست انتظار` انتخاب شد. پنل بررسی هم‌زمان دکمه‌های `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` را نشان داد؛ بنابراین `BUG-STG-063` در runtime/UI **FAIL** است. هیچ actionی کلیک نشد تا fixture ناخواسته mutate نشود.

## P2 merchandising runtime recheck — ۲۰۲۶-۰۹-۲۸

- در Portal session، PLP تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` قیمت پایه `۱٬۰۰۰٬۰۰۰` و قیمت عضو `۵۰۰٬۰۰۰` را نشان داد؛ PDP همان تور نیز قیمت پایه `۱٬۰۰۰٬۰۰۰`، تخفیف ۵۰٪ و `قیمت برای شما ۵۰۰٬۰۰۰ تومان` را نشان داد. `BUG-STG-081` در این اجرای authenticated **PASS** است.
- همان PLP card در AX هیچ نوع حمل یا مبلغ دُنگی نداشت، درحالی‌که PDP `خودروهای مشترک` و `۳۴۴٬۴۴۴ تومان` را نشان داد؛ `BUG-STG-082` همچنان **FAIL** است.
- فیلتر `minPrice=0&maxPrice=0&sort=price_asc` مقدارهای query را حفظ کرد و ۳ نتیجهٔ رایگان با label `رایگان / بدون نیاز به پرداخت` برگرداند؛ price marker یا CTA پرداخت دیده نشد. `BUG-STG-025 / 026 / 027` در این مسیر **PASS** هستند.
- مرتب‌سازی کامل `sort=price_desc`، تورهای پولی را قبل از سه تور رایگان قرار داد و تورهای رایگان در انتهای فهرست با همان label دیده شدند؛ `BUG-STG-026 / 027` در این اجرای runtime **PASS** ماندند.

## Operational waitlist filter recheck — ۲۰۲۶-۰۹-۲۸

- نمای کلی `https://admin.denali.shenski.com/bookings?status=waitlisted&view=ops` نشان داد badge `در لیست انتظار = ۷`، جدول `۷ از ۷` و ۷ ردیف واقعی؛ این بخش با هم سازگار است.
- همان fixture و همان state با فیلتر تور `e8c21d68-b161-4085-9dd3-b03b59540d39` در `https://admin.denali.shenski.com/bookings?status=waitlisted&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39&view=ops`، درحالی‌که badge کلی هنوز ۷ بود، پیام `چیزی با این فیلترها پیدا نشد` داد.
- نتیجه: `BUG-STG-037` همچنان **FAIL** است؛ فیلتر عملیاتی تور با شمارنده/دادهٔ صف از یک query یکسان تغذیه نمی‌شود.

## Guest pricing form recheck — ۲۰۲۶-۰۹-۲۸

- مسیر واقعی guest از PDP به `portal.denali.shenski.com/catalog/a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9/register` resolve شد و 404 نیست.
- در فرم همان تور تخفیف‌دار، دو همراه اضافه شد؛ هر دو ردیف `قیمت هر نفر = ۱٬۰۰۰٬۰۰۰ تومان` نشان دادند، درحالی‌که member در PDP/PLP قیمت `۵۰۰٬۰۰۰ تومان` دارد. این بخشِ preview عضو/مهمان **PASS** است و تخفیف عضو به preview مهمان منتقل نشد.
- برای مهمان اول transport `ماشین شخصی خودم` و `۱ نفر` انتخاب شد؛ state انتخابی در فرم ثبت شد، اما submit واقعی و مبلغ نهایی هر participant عمداً اجرا نشد. بنابراین `BUG-STG-022` در سطح final submit هنوز **UNVERIFIED/FAIL قبلی** باقی می‌ماند و با preview سبز بسته نمی‌شود.

## Free Admin projection recheck — ۲۰۲۶-۰۹-۲۸

- fixture `c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` با نام `QA Free Pending Guest 20260928` در Admin با state `در انتظار پرداخت‌نشده (رزرو)` نمایش داده شد.
- جزئیات مالی همان row: جمع فاکتور `۰ تومان`، پرداخت‌شده `۰ تومان`، بدهی `۰ تومان` و مبلغ قابل پرداخت اکنون `۰ تومان`؛ بااین‌حال متن `رزرو پرداخت‌نشده است — هنوز تسویه نشده است` و action `تأیید و منتظر پرداخت` همچنان حاضر است.
- نتیجه: `BUG-STG-080` در Admin نیز مستقل از Portal **FAIL** است؛ free باید بدون unpaid copy، deadline یا payment action نمایش داده شود.

## Paid projection cross-surface recheck — ۲۰۲۶-۰۹-۲۸

- برای registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147`، Admin state را `تأییدشده پرداخت جزئی (رزرو)` و متن را `ثبت‌نام تأیید شده — پیگیری پرداخت` نشان داد.
- جزئیات همان Admin row: فاکتور `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴`، مانده `۰`، قابل پرداخت اکنون `۰`؛ اما body همچنان می‌گوید `پرداخت جزئی است ... هنوز مانده دارد`.
- Finance برای همان registration به‌درستی کل `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴` و مانده `۰` را نشان داد و ردیف `ثبت‌شده (این پرداخت)` داشت.
- نتیجه: Finance projection درست است، اما Admin/Portal copy و state projection stale/متناقض هستند؛ `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` همچنان **FAIL** هستند.

## Duplicate guest runtime recheck — ۲۰۲۶-۰۹-۲۸

- دو registration مستقل در Portal برای همان QA duplicate probe قابل مشاهده بود:
  - `27146c0c-dba3-4b0f-b1cb-e1c6e3efa00d` — `QA Duplicate Guest 20260927`، لغوشده.
  - `429c332b-cf58-4443-8485-b7fe85dfd822` — `QA Duplicate Exact 20260927`، لغوشده.
- هر دو برای همان تور `c2690b98-d8be-404c-b2e8-9c4d6f62fb03` و هر دو با state مستقل Portal نمایش داده شدند؛ این شواهد نشان می‌دهد duplicate runtime قبلاً رکورد دوم ساخته است.
- نتیجه: `BUG-STG-021` در runtime هنوز **FAIL/UNVERIFIED** است، هرچند race test source سبز است.

## Waitlist state/label recheck — ۲۰۲۶-۰۹-۲۸

- Portal fixture `256183c5-9b73-492c-b8ea-290394c0e58b` صریحاً `ثبت‌نام: لیست انتظار`، `رسید: لازم نیست` و متن `پس از تأیید باشگاه، مرحلهٔ پرداخت فعال می‌شود` را نشان داد؛ `BUG-STG-064 / 065` در این fixture **PASS محدود** است.
- Admin همان row را با label مستقل `در لیست انتظار` و وضعیت حمل `پرداخت‌نشده (رزرو)` نشان داد؛ label `تأییدشده` برای row استفاده نشده است؛ `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در این fixture **PASS** است.
- بااین‌حال Admin برای همین ظرفیت `۱۲/۱۲` هنوز actionهای `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` دارد؛ این تناقض با ظرفیت کامل، ریسک promotion نادرست را حفظ می‌کند و closure `BUG-STG-063` را تغییر نمی‌دهد.

## Exposure locale recheck — ۲۰۲۶-۰۹-۲۸

- Admin Exposure، سطح `جزئیات کاتالوگ عمومی` را با ۱۲ فیلد انتخاب‌شده نشان داد.
- برای فیلد `location-zones`، label فارسی ناقص است: `نقطه شروع Start, summit, camp and end location zones. هزینه`؛ AX description نیز کامل انگلیسی است: `Start, summit, camp and end location zones.`
- نتیجه: `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان **FAIL** در متن، tooltip و AX است.

## PDP contract smoke — ۲۰۲۶-۰۹-۲۸

- Anonymous SSR برای تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` هر سه مقدار قراردادی را برگرداند: `روش پرداخت: رسید / پرداخت آفلاین`، `تأیید ثبت‌نام: دستی` و `ساعت شروع: ۲۷ مهر ۱۴۰۵، ۳:۰۰`.
- نتیجه: `BUG-STG-008 / 013 / 035` در artifact فعلی **PASS** هستند؛ این smoke هیچ‌یک از failureهای projection، Exposure یا transport را نادیده نمی‌گیرد.

## Source regression gate — ۲۰۲۶-۰۹-۲۸

- `pnpm run test:changed` با base=`origin/main` اجرا شد؛ workspaceهای workspace-sdk، platform-core، API، Web، Marketing، Portal، finance، tenant-kernel، wallet، starter، theme-react و Denali همگی cache-hit شدند.
- نتیجه نهایی: `test-changed: PASS`.
- این نتیجه فقط source regression gate است و closure failureهای runtime زیر را تغییر نمی‌دهد: Exposure redaction/locale، free projection، paid projection، Waitlist operational filter/promotion، duplicate runtime، pricing final submit و PLP transport.

## Finance/receipt focused source recheck — ۲۰۲۶-۰۹-۲۸

- `finance.service.spec.ts` و `p6-member-receipt-flow.spec.ts`: مجموعاً `۲۰/۲۰` pass و `۰` failure.
- approve projection، reject، partial/full/overpay، sync failure، receipt ownership، pending flow و member list projection سبز هستند.
- warningهای `BOOKINGS_DB_UNAVAILABLE` و `MINIO_NOT_CONFIGURED` در سناریوهای عمدیِ خطا/محیط تست ثبت شدند و failure تست نیستند.
- این نتیجه source-level است و جایگزین closure runtime staging برای paid/free projection، approve واقعی و resubmit واقعی نمی‌شود.

## Waitlist/duplicate/roster/Exposure source recheck — ۲۰۲۶-۰۹-۲۸

- مجموعهٔ انتخابی API: `۲۴/۲۴` تست اجراشده pass، `۰` failure.
- duplicate uniqueness: `۵/۵` pass؛ mapping خطای duplicate به 409 و تفکیک `self/other` سبز است.
- Waitlist/promotion: `۲/۲` pass؛ promotion یک نفر و جلوگیری از promotion گروه بزرگ‌تر از ظرفیت آزاد سبز است.
- operational roster: `۱۶/۱۶` pass؛ filter، projection approved/partial/paid/waived/waitlist، export contract و budget سبز است.
- دو تست عمداً `SKIP` شدند چون `DATABASE_URL`/Postgres فراهم نبودند: race واقعی duplicate و catalog-redaction integration. این دو مورد closure source/integration محسوب نمی‌شوند.
- نتیجهٔ جدید failure source ندارد، اما duplicate race واقعی، redaction integration و موارد runtime FAIL قبلی همچنان باز هستند.

## Marketing P2 focused source recheck — ۲۰۲۶-۰۹-۲۸

- تست‌های Marketing قیمت/رایگان/حمل/فیلتر/sort: `۳۸/۳۸` pass و `۰` failure.
- پوشش شامل member payable preview، جداسازی قیمت guest، free label، free-as-zero در filter و sort، shared-car dong، حمل سازمانی و Exposure policy contract است.
- این passها با failure runtime `BUG-STG-081/082` تناقض ندارند؛ source قرارداد را پاس می‌کند، اما artifact staging فعلی هنوز اختلاف PLP/PDP و نبود transport در PLP را نشان داده است.

## Changed-test gate recheck — ۲۰۲۶-۰۹-۲۸

- `pnpm run test:changed`: PASS؛ همهٔ workspaceهای تغییرکرده cache hit معتبر داشتند و خروجی نهایی `test-changed: PASS (base=origin/main mode=ci)` بود.
- این gate نبودن failure source را تأیید می‌کند، اما جایگزین تست runtime staging و دو integration تست skipped با Postgres نیست.

## Exposure web/source recheck — ۲۰۲۶-۰۹-۲۸

- تست‌های Web Exposure و localization: `۲۰/۲۰` pass و `۰` failure.
- قرارداد localization صراحتاً `location-zones` را فارسی می‌کند؛ با این حال Admin staging هنوز در AX/label متن انگلیسی registry را نشان می‌دهد.
- نتیجه: source contract سبز، ولی `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` در runtime همچنان FAIL و نیازمند artifact/runtime اصلاحی است.

## Runtime health recheck — ۲۰۲۶-۰۹-۲۸

- `denali.shenski.com/health`: HTTP 200، `{"ok":true}`.
- `portal.denali.shenski.com/health`: HTTP 200، `{"ok":true}`.
- `admin.denali.shenski.com/health`: HTTP 200، `{"ok":true}`.
- هر سه host `x-cache: BYPASS` دارند؛ health سبز است، اما پاسخ health به‌تنهایی runtime commit SHA را افشا نمی‌کند و جایگزین fingerprint artifact نیست.

## Paid projection runtime recheck — ۲۰۲۶-۰۹-۲۸

- Fixture: registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147`، تور «تخفیف با تور».
- Portal Detail: `ثبت‌نام شما تأیید شده است` و `رسید: تأیید شده`، اما هم‌زمان متن `برای نهایی شدن سفر، رسید پرداخت را ارسال کنید` باقی است.
- Portal List همان registration را `برای نهایی‌شدن، پرداخت باید تکمیل شود` نشان می‌دهد.
- Admin Detail: `تأییدشده پرداخت جزئی (رزرو)`؛ جزئیات عددی جمع فاکتور `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴`، مانده `۰` و مبلغ قابل پرداخت `۰` است، ولی body می‌گوید «رزرو پرداخت جزئی است ... هنوز مانده دارد».
- نتیجهٔ runtime: `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` همچنان FAIL قطعی هستند؛ registration و receipt از نظر label جدا هستند، اما متن‌ها از projection نادرست تغذیه می‌شوند.

## Free projection runtime recheck — ۲۰۲۶-۰۹-۲۸

- Fixture: registration `4190860a-9948-4c62-b29b-85d3e494e765`، `QA-STG-20260924-FREE-MANUAL`.
- Portal List: `برای نهایی‌شدن، پرداخت لازم است`.
- Admin Detail: `تأییدشده پرداخت‌نشده (رزرو)`؛ جزئیات پرداخت invoice `۰`، paid `۰`، debt `۰` و payable now `۰` است، اما body می‌گوید `رزرو پرداخت‌نشده است — هنوز تسویه نشده است`.
- نتیجه: `BUG-STG-080` در runtime دوباره FAIL شد؛ مقدار صفر درست است اما state/copy همچنان unpaid است و با قرارداد `WAIVED/free` سازگار نیست.

## Waitlist operational filter runtime recheck — ۲۰۲۶-۰۹-۲۸

- URL: `/bookings?status=waitlisted&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39&view=ops`.
- AX شمارندهٔ سراسری `در لیست انتظار` را `۷` نشان می‌دهد.
- همان صفحه با فیلتر تور `QA WAITLIST GROUP 20260927` و وضعیت `در لیست انتظار` پیام `چیزی با این فیلترها پیدا نشد` می‌دهد.
- نتیجه: `BUG-STG-037` همچنان FAIL قطعی است؛ count و query جدول از منبع یکسان نمی‌آیند.

## Multi-guest pricing runtime recheck — ۲۰۲۶-۰۹-۲۸

- Fixture تور تخفیف‌دار «تخفیف با تور» با دو guest registration:
  - `76cada3f-b10b-4b5f-9d08-bba158107996`: Admin invoice `۵۰۰٬۰۰۰`، paid `۰`، debt `۵۰۰٬۰۰۰`.
  - `f20dbbdb-280c-44ec-ac6c-787adf2397bf`: Admin invoice `۸۴۴٬۴۴۴`، paid `۰`، debt `۸۴۴٬۴۴۴`.
- این مقادیر با fixture preview ثبت‌شده (`۱٬۰۰۰٬۰۰۰` و `۱٬۳۴۴٬۴۴۴`) و قرارداد guest/no-member discount تطبیق ندارد؛ یکی از guestها مبلغ تخفیف‌خوردهٔ `۵۰۰٬۰۰۰` گرفته است.
- نتیجه: `BUG-STG-022` همچنان FAIL runtime است؛ source preview سبز است اما final submit/Admin projection هنوز canonical pricing واحد را مصرف نمی‌کند.

## Waitlist group promotion runtime recheck — ۲۰۲۶-۰۹-۲۸

- Fixture: booking `00000000-0000-0000-0000-000000000312`، گروه `۳` نفره، ظرفیت `۱۲/۱۲`، state فعلی `در لیست انتظار`.
- Admin Detail با وجود ظرفیت ناکافی، هر دو action `تأیید بدون نیاز به پرداخت` و `تأیید و منتظر پرداخت` را نمایش می‌دهد.
- این با قرارداد promotion گروهی ناسازگار است؛ برای گروهی که جا نمی‌شود باید فقط نگه‌داشتن در Waitlist/رد یا پیام ظرفیت مجاز باشد و action approval مؤثر نباشد.
- نتیجه: `BUG-STG-063` در سطح UI/action همچنان FAIL است؛ تست source guard به‌تنهایی closure runtime نیست.

## Duplicate runtime recheck — ۲۰۲۶-۰۹-۲۸

- دو registration هم‌زمانِ fixture duplicate هر دو در Portal قابل بازشدن هستند:
  - `27146c0c-dba3-4b0f-b1cb-e1c6e3efa00d` — مسافر `QA Duplicate Guest 20260927`، لغوشده.
  - `429c332b-cf58-4443-8485-b7fe85dfd822` — مسافر `QA Duplicate Exact 20260927`، لغوشده.
- هر دو برای یک تور و یک owner/guest test family ساخته شده‌اند؛ لغو بعدی رکورد دوم را حذف نکرده است.
- نتیجه: `BUG-STG-021` همچنان runtime FAIL/UNVERIFIED است؛ source uniqueness pass است، اما submit واقعی staging قبلاً duplicate record ایجاد کرده و باید با fixture تازه و race واقعی اصلاح و دوباره تست شود.

## P2 PLP/PDP SSR recheck — ۲۰۲۶-۰۹-۲۸

- Fixture: tour `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9`.
- PLP SSR target card: قیمت `۱٬۰۰۰٬۰۰۰ تومان` دارد، اما برای همان card هیچ `transport`/`dong` marker یا متن حمل وجود ندارد.
- PDP SSR همان tour: `خودروهای مشترک` و `۳۴۴٬۴۴۴ تومان` را چند بار در facts/logistics render می‌کند.
- نتیجه: `BUG-STG-082` دوباره در HTML/SSR تأیید شد؛ مشکل فقط AX یا layout نیست و PLP/PDP از نظر transport projection همسان نیستند.

## Finance cross-surface runtime recheck — ۲۰۲۶-۰۹-۲۸

- همان registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` در Finance:
  - کل تعهد `۸۴۴٬۴۴۴ تومان`
  - پرداخت‌شده `۸۴۴٬۴۴۴ تومان`
  - مانده `۰ تومان`
  - payment row: `ثبت‌شده (این پرداخت)`.
- Finance عددی درست نشان می‌دهد، اما Admin Detail همان registration را «پرداخت جزئی» و «هنوز مانده دارد» می‌نمایاند و Portal List متن تکمیل پرداخت دارد.
- نتیجه: ناسازگاری از Admin/Portal projection یا copy resolver است، نه از مقدار ledger Finance؛ P0های paid projection همچنان باز هستند.

## Receipt/payment separation runtime recheck — ۲۰۲۶-۰۹-۲۸

- Finance Receipts برای registration `4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` می‌گوید: `فیشی در انتظار بررسی نیست`.
- Finance Payments همان registration یک پرداخت `ثبت‌شده (این پرداخت)` با مبلغ `۸۴۴٬۴۴۴` و مانده `۰` نشان می‌دهد.
- Portal Detail هم `رسید: تأیید شده` و `پرداخت تأیید شد` دارد، ولی List هنوز پرداخت را ناقص می‌داند.
- نتیجه: تفکیک receipt/payment در Finance درست است؛ stale state در Portal List و Admin booking projection باقی مانده و closure P0 هنوز انجام نشده است.

## Exposure locale AX recheck — ۲۰۲۶-۰۹-۲۸

- صفحهٔ فارسی Admin در `/settings/exposure` باز شد و سطح «جزئیات کاتالوگ عمومی» با ۱۲ فیلد انتخاب‌شده بررسی شد.
- فیلد `location-zones` همچنان با description انگلیسی `Start, summit, camp and end location zones.` و label ترکیبی `نقطه شروع Start, summit, camp and end location zones. هزینه` در AX نمایش داده شد.
- نتیجه: `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان FAIL قطعی است؛ label، description و AX فارسی نشده‌اند.

## Source gate continuation — ۲۰۲۶-۰۹-۲۸

- `pnpm run guard:import-boundary`: **PASS**.
- `pnpm run test:changed`: **PASS** (`base=origin/main`, همهٔ workspaceهای affected با cache معتبر).
- `pnpm run pre-commit:fast`: **PASS**؛ `guard-docs` و `check-node-engine` سبز بودند و به‌دلیل نبود staged source files، lint-staged/test-changed داخلی skip شدند.
- این گیت‌ها خطای جدید source نشان ندادند و جایگزین evidence runtime FAILهای ثبت‌شده نیستند.

## P0 focused source continuation — ۲۰۲۶-۰۹-۲۸

- Portal registration/display suites: **۱۱/۱۱ PASS**؛ شامل timezone، paid projection، free projection و Waitlist CTA contract.
- API Finance + receipt flow suites: **۲۰/۲۰ PASS**؛ شامل approve projection، reject/sync، receipt ownership و member list projection.
- Admin/Web payment deadline suite: **۵/۵ PASS**؛ شامل حذف `paymentDueAt` برای paid، BFF no-stale و operator list contract.
- warningهای `BOOKINGS_DB_UNAVAILABLE` و `MINIO_NOT_CONFIGURED` در مسیرهای کنترل‌شدهٔ تست source هستند و failure تست محسوب نشدند؛ این green source evidence، runtime FAILهای staging را override نمی‌کند.

## Capacity / Waitlist / Exposure source continuation — ۲۰۲۶-۰۹-۲۸

- Duplicate uniqueness + waitlist payment-hold suites: **۸/۸ PASS**؛ قرارداد duplicate mapping، expiry promotion و نگه‌داشتن گروه بزرگ‌تر از ظرفیت در Waitlist سبز است.
- Operational roster suites: **۱۶/۱۶ PASS**؛ API/export، enrichment و projection برای approved unpaid، partial، paid، waived و waitlisted سبز است.
- Denali exposure contract suites: **۱۲/۱۲ PASS**؛ redaction resolver، multi-surface wiring و defaults سبز است.
- این نتایج source را تأیید می‌کنند؛ runtime `BUG-STG-021`، `BUG-STG-019/036` و `BUG-STG-037` همچنان طبق evidence staging بسته نشده‌اند.

## Runtime operational workspace/export recheck — ۲۰۲۶-۰۹-۲۸

- Workspace fixture `e8c21d68-b161-4085-9dd3-b03b59540d39` در تب «لیست عملیاتی» summaryهای `نیازمند بررسی ۱`، `منتظر پرداخت ۰` و `نهایی‌شده برای حضور ۱` نشان داد.
- جدول یک ردیف `QA Waitlist Guest 20260928` با وضعیت حضور «نهایی»، حمل «حمل سازمان‌یافته» و پرداخت «بدون نیاز به پرداخت / بدون مانده قابل پیگیری» داشت؛ این Workspace برای fixture خودش internally consistent است.
- دکمه «خروجی Excel لیست نهایی» اجرا شد؛ پس از حالت «در حال ساخت فایل…»، پیام «فایل Excel آماده و دانلود شد» نمایش داده شد.
- نتیجه: runtime export/Workspace این fixture **PASS** است؛ این نتیجه اختلاف global count در صفحهٔ Bookings (`BUG-STG-037`) و projectionهای paid در سطح global را نمی‌بندد.

## Runtime participant pricing recheck — ۲۰۲۶-۰۹-۲۸

- guest registration `76cada3f-b10b-4b5f-9d08-bba158107996` (`QA Pricing Guest Two 20260928`) در Admin وضعیت `در انتظار` و `دیگری` دارد.
- جزئیات مالی همان رکورد: جمع فاکتور `۵۰۰٬۰۰۰ تومان`، پرداخت‌شده `۰`، مانده بدهی `۵۰۰٬۰۰۰` و مبلغ قابل پرداخت `۵۰۰٬۰۰۰`.
- preview ثبت‌شدهٔ همین سناریو برای guest دوم `۱٬۰۰۰٬۰۰۰ تومان` بود؛ مبلغ ذخیره‌شدهٔ نهایی `۵۰۰٬۰۰۰` است و با قیمت پایهٔ guest همخوان نیست، که نشان‌دهندهٔ نشت تخفیف عضو است.
- نتیجه: `BUG-STG-022` مجدداً **FAIL قطعی runtime** شد؛ `BUG-STG-081` نمایش PLP/PDP را می‌سنجد و با این failure محاسبهٔ نهایی participantها بسته نمی‌شود.

## Runtime no-discount member/guest recheck — ۲۰۲۶-۰۹-۲۸

- fixture: tour `b595933d-cf84-4d60-9f5d-f1072aa947cc`، «تور بدون تخفیف برای عضو».
- مهمان/بدون cookie در PDP: قیمت پایه `۱۰٬۰۰۰٬۰۰۰ تومان`.
- عضو احراز‌شده در PDP: قیمت `۱۰٬۰۰۰٬۰۰۰ تومان` و هیچ تخفیف عضوی نمایش داده نشد؛ حمل اتوبوس و هزینهٔ حمل `۱٬۰۰۰٬۰۰۰ تومان` مستقل از قیمت تور نمایش داده شد.
- نتیجه: سناریوی «تور بدون تخفیف، عضو و مهمان هر دو قیمت پایه» **PASS** است و failure `BUG-STG-022` به participant pricing در تور تخفیف‌دار محدود می‌ماند.

## Duplicate read-only follow-up — ۲۰۲۶-۰۹-۲۸

- Portal List با ۲۸ registration قابل مشاهده اسکن شد؛ ردیف جدیدی با label صریح duplicate پیدا نشد.
- این مشاهدهٔ read-only نه تأیید رفتار duplicate است و نه جایگزین submit هم‌زمان؛ بنابراین `BUG-STG-021` همچنان بر اساس reproduction قبلی **FAIL** باقی می‌ماند و برای closure به mutation واقعی دو submit نیاز دارد.

## PDP policy/time smoke recheck — ۲۰۲۶-۰۹-۲۸

- روی fixture `b595933d-cf84-4d60-9f5d-f1072aa947cc`، PDP زمان شروع `۲۲ مهر ۱۴۰۵، ۳:۰۰`، حمل اتوبوس، روش پرداخت «رسید / پرداخت آفلاین» و تأیید ثبت‌نام «خودکار» را در AX نشان داد.
- نتیجه: `BUG-STG-008 / 013 / 035` در این fixture **PASS runtime** باقی ماندند؛ این smoke با timezone کسب‌وکار سازگار بود.

## Exposure location-zones AX recheck — ۲۰۲۶-۰۹-۲۸

- کارت «جزئیات کاتالوگ عمومی» در Admin فارسی باز شد؛ فیلد «نقطه شروع» فعال است.
- AX description همان checkbox را به‌صورت `نقطه شروع Start, summit, camp and end location zones.` و label را `نقطه شروع Start, summit, camp and end location zones. هزینه` نشان داد.
- نتیجه: متن انگلیسی registry همچنان در صفحهٔ فارسی و AX نشت می‌کند؛ `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` **FAIL قطعی runtime** باقی ماند.

## Independent member/guest price parity recheck — ۲۰۲۶-۰۹-۲۸

- fixture: tour `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9`، artifact release `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`.
- مهمان/بدون cookie: PDP مقدار پایهٔ `۱٬۰۰۰٬۰۰۰ تومان` و حمل `خودروهای مشترک` با دُنگ `۳۴۴٬۴۴۴ تومان` را نشان داد؛ PLP همان tour در `sort=price_asc` کارت `۱٬۰۰۰٬۰۰۰ تومان` داشت.
- عضو/session احراز‌شده: PDP مقدار پایهٔ `۱٬۰۰۰٬۰۰۰`، تخفیف `۵۰٪` و «قیمت برای شما `۵۰۰٬۰۰۰ تومان`» را نشان داد؛ PLP همان tour نیز `۱٬۰۰۰٬۰۰۰ / ۵۰۰٬۰۰۰` و `۵۰٪ تخفیف عضویت` را نشان داد.
- هر دو session در PLP و PDP با قرارداد خودشان همسان بودند؛ بنابراین `BUG-STG-081` **PASS runtime** شد. این نتیجه به `BUG-STG-022` مربوط به محاسبهٔ نهایی participantها تعمیم داده نمی‌شود؛ آن مورد همچنان FAIL است.
- headerهای درخواست مهمان: `cache-control: private, no-cache, no-store` و `x-cache: BYPASS`؛ شناسهٔ درخواست `d09d84f8eab841d42563f2ef5329fa85`.

## Promotion retry read-only recheck — ۲۰۲۶-۰۹-۲۸

- candidate promoted: `9b676ad8-08f3-48a0-bf47-1494b42bd9af` on tour `e8c21d68-b161-4085-9dd3-b03b59540d39`.
- Admin detail now shows `تأییدشده` and only `لغو رزرو`; no second `تأیید`/promotion action is exposed, so the UI is idempotent at the action-surface level.
- The same detail still says `پرداخت‌نشده (رزرو)` and `ثبت‌نام تأیید شده — پیگیری پرداخت` even though this free registration has no payable amount; this remains the related Admin financial-label projection failure.
- No second approval mutation was sent because no retry control exists; therefore API-level concurrent/idempotent retry remains unverified and `BUG-STG-063` stays PASS محدود.

## Focused source recheck after runtime continuation — ۲۰۲۶-۰۹-۲۸

- Marketing focused suites: **۳۸/۳۸ PASS**؛ free label/filter/sort، member payable parity، transport/dong و PDP policy را پوشش می‌دهد.
- Denali workspace focused suites: **۸/۸ PASS**؛ catalog card، spots enrichment و shared-car dong را پوشش می‌دهد.
- این PASSها قرارداد source را تأیید می‌کنند، اما runtime failureهای `BUG-STG-019/036`، `BUG-STG-022` و `BUG-STG-082` را نمی‌بندند؛ آن‌ها همچنان نیازمند اصلاح/ریتست artifact staging هستند.

## Runtime transport parity recheck — ۲۰۲۶-۰۹-۲۸

- health هر سه host (`denali.shenski.com`، `portal.denali.shenski.com`، `admin.denali.shenski.com`) با HTTP `200` و `{"ok":true}` پاسخ داد.
- PDP عمومی tour `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` همچنان `خودروهای مشترک` و `هزینه دونگی ۳۴۴٬۴۴۴ تومان` را در SSR/HTML دارد.
- PLP عمومی همان tour در HTML کارت فقط قیمت را render می‌کند و field/label مستقلی برای transport یا dong ندارد؛ در نتیجه parity PLP/PDP هنوز برقرار نیست.
- نتیجه: `BUG-STG-082` **FAIL قطعی runtime** باقی ماند؛ source test سبز آن را override نمی‌کند.

## Runtime free List/Detail recheck — ۲۰۲۶-۰۹-۲۸

- registration `4190860a-9948-4c62-b29b-85d3e494e765` در Portal List با وضعیت «تأیید شده» و متن «برای نهایی‌شدن، پرداخت لازم است» نمایش داده شد.
- همان registration در Portal Detail هم‌زمان «ثبت‌نام شما نهایی شده است»، «نیازی به پرداخت ندارید»، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` دارد.
- نتیجه: `BUG-STG-080` بعد از revalidation مستقیم browser همچنان **FAIL قطعی** است؛ mismatch مستقل List/Detail در runtime فعلی بازتولید شد.

## Runtime paid projection recheck — ۲۰۲۶-۰۹-۲۸

- Portal Detail برای registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a` وضعیت `ثبت‌نام: تأیید شده` و `رسید: تأیید شده` را نشان داد، اما هم‌زمان heading «برای نهایی شدن سفر، رسید پرداخت را ارسال کنید» و deadline پرداخت داشت.
- همان Portal Detail متن «پرداخت تأیید شد» و مبلغ قابل‌استرداد `۸۴۴٬۴۴۴ تومان` را نیز نمایش داد.
- Admin Detail همان رکورد را `تأییدشده`، `پرداخت جزئی (رزرو)`، با deadline «مهلت پرداخت: ۴ مهر ۱۴۰۵» و متن «پیگیری پرداخت» نشان داد.
- نتیجه: `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` همچنان **FAIL قطعی runtime** هستند؛ state پرداخت تأییدشده در Portal و Admin canonical نیست.

## Runtime operational count recheck — ۲۰۲۶-۰۹-۲۸

- Admin با فیلتر `status=waitlisted&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39` بعد از promotion دوباره بازخوانی شد.
- badge سراسری «در لیست انتظار» مقدار `۷` دارد، اما همان query تور انتخاب‌شده هیچ ردیفی ندارد و پیام «چیزی با این فیلترها پیدا نشد» نمایش می‌دهد.
- نتیجه: اختلاف global badge با نتیجهٔ فیلترشده همچنان قابل مشاهده است؛ `BUG-STG-037` **FAIL runtime** باقی ماند. این snapshot نشان می‌دهد promotion رکورد را از صف این tour حذف کرده، اما count global را به query فیلترشده تبدیل نکرده است.

## Current source gate recheck — ۲۰۲۶-۰۹-۲۸

- `pnpm run pre-commit:fast`: **PASS**؛ `guard-docs`، `check-node-engine` و مسیر `test-changed` با موفقیت عبور کردند.
- `pnpm run guard:import-boundary`: **PASS** با exit code صفر.
- `git diff --check`: **PASS**؛ خطای whitespace در تغییرات فعلی دیده نشد.
- این gate فقط سلامت source و diff را ثابت می‌کند و جایگزین ریتست runtime روی artifact staging نیست.
- `pnpm run test:changed`: **PASS** (`base=origin/main mode=ci`؛ همه workspaceهای affected از cache معتبر عبور کردند).
- branch جاری: `codex/staging-p0-p1-p2-final`، HEAD: `7eccfa6d27ee762f4c4f333541d7305ac3582252`؛ working tree همچنان فقط شامل تغییرات موجود در ledger و `architecture-truth-drift-report.json` است و این بررسی commit یا push انجام نداد.

## Current runtime recheck — global Waitlist filter — ۲۰۲۶-۰۹-۲۸

- در `admin.denali.shenski.com/bookings?status=waitlisted&tourId=e8c21d68-b161-4085-9dd3-b03b59540d39`، badge سراسری «در لیست انتظار» مقدار `۸` دارد، اما heading همان query مقدار `۱ کل` و table مقدار `۱ از ۱` نشان می‌دهد.
- همان ردیف `9b676ad8-08f3-48a0-bf47-1494b42bd9af` با label «در لیست انتظار» و ظرفیت `۱/۱` نمایش داده شد؛ بنابراین label خود row درست است، اما total/badge با فیلتر تور هم‌خوان نیست.
- نتیجه: `BUG-STG-037` همچنان **FAIL جاری**؛ این ریتست بعد از navigation مستقیم انجام شد و صرفاً به state قبلی متکی نیست.

## Current runtime recheck — Exposure locale — ۲۰۲۶-۰۹-۲۸

- در Admin فارسی، سطح «جزئیات کاتالوگ عمومی» باز شد و فیلد `نقطه شروع` فعال بود.
- AX همان فیلد را با description انگلیسی `Start, summit, camp and end location zones.` نمایش داد.
- نتیجه: `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` همچنان **FAIL جاری**؛ label فارسی است اما description/AX به انگلیسی نشت می‌کند.

## Current runtime recheck — free List/Detail projection — ۲۰۲۶-۰۹-۲۸

- Portal List برای registration `4190860a-9948-4c62-b29b-85d3e494e765` عبارت `برای نهایی‌شدن، پرداخت لازم است` را نشان داد.
- Portal Detail همان registration هم‌زمان `ثبت‌نام شما نهایی شده است`، `نیازی به پرداخت ندارید`، `ثبت‌نام: تأیید شده` و `رسید: لازم نیست` را نشان داد.
- نتیجه: `BUG-STG-080` دوباره و مستقل بازتولید شد؛ List و Detail هنوز projection مالی یکسان ندارند و **FAIL جاری** است.

## Current runtime recheck — paid receipt projection — ۲۰۲۶-۰۹-۲۸

- Portal Detail برای registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a`، registration را «تأیید شده» و receipt را «تأیید شده» نشان داد و متن «پرداخت تأیید شد» را نمایش داد.
- همان صفحه هم‌زمان `مهلت پرداخت ۱۴۰۵/۷/۳، ۲۲:۲۱:۱۶` را نگه داشته است؛ بنابراین state paid با deadline پرداختی در یک projection مخلوط شده است.
- نتیجه: `BUG-STG-039 / 072` و `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` همچنان **FAIL جاری** هستند؛ approve receipt هنوز همهٔ فیلدهای unpaid را پاک نکرده است.

## Current runtime recheck — Admin paid projection — ۲۰۲۶-۰۹-۲۸

- Admin برای همان booking `f2144510-bc47-4d1f-b6ad-42002a6ac51a` وضعیت «تأییدشده» و «پرداخت جزئی (رزرو)» نشان داد و متن «مهلت پرداخت: ۴ مهر ۱۴۰۵» را نگه داشت.
- جزئیات پرداخت هم‌زمان `جمع فاکتور ۸۴۴٬۴۴۴`، `پرداخت‌شده ۸۴۴٬۴۴۴`، `مانده بدهی ۰` و `مبلغ قابل پرداخت اکنون ۰` را نشان داد، اما پیام «رزرو پرداخت جزئی است — هنوز مانده دارد» باقی است.
- نتیجه: Admin نیز با Portal در state واحد نیست؛ `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` **FAIL جاری** هستند.

### Finance cross-check

- Finance برای همان `registrationId` در تب پرداخت‌ها، توضیح قراردادی «ثبت‌شده (این پرداخت) به‌تنهایی رزرو را تسویه نمی‌کند» را نمایش می‌دهد و در این snapshot رکورد پرداخت دستی قابل مشاهده‌ای ندارد.
- بنابراین Finance به‌تنهایی proof مثبت برای paid/finalized ارائه نمی‌کند؛ closure همچنان به resolver مشترک و تطبیق هم‌زمان سه سطح نیاز دارد و وضعیت P0 **باز** می‌ماند.

## Current runtime recheck — P2 member price and transport — ۲۰۲۶-۰۹-۲۸

- PLP برای تور `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` قیمت پایه `۱٬۰۰۰٬۰۰۰`، قیمت عضو `۵۰۰٬۰۰۰` و برچسب تخفیف ۵۰٪ را نشان داد.
- PDP همان تور در session عضو نیز قیمت پایه `۱٬۰۰۰٬۰۰۰`، تخفیف ۵۰٪ و «قیمت برای شما ۵۰۰٬۰۰۰» را نشان داد؛ بنابراین `BUG-STG-081` در این session **PASS محدود** است و تطبیق مستقل guest هنوز لازم است.
- همان PLP card هیچ نوع حمل یا مبلغ دُنگی نشان نداد، درحالی‌که PDP `خودروهای مشترک` و `۳۴۴٬۴۴۴ تومان` را نشان داد.
- نتیجه: `BUG-STG-082` در artifact فعلی **FAIL جاری** است.

## Current runtime recheck — free filter/sort — ۲۰۲۶-۰۹-۲۸

- URL مستقیم `?minPrice=0&maxPrice=0&sort=price_desc` مقدارهای min/max را هر دو `۰` و sort را «قیمت (زیاد به کم)» نشان داد.
- نتیجهٔ PLP سه تور بود؛ هر سه label `رایگان / بدون نیاز به پرداخت` داشتند و هیچ مبلغ عددی نمایش داده نشد.
- ترتیب رایگان‌ها در این query برقرار بود و فیلتر در URL و کنترل‌های UI حفظ شد.
- نتیجه: `BUG-STG-025` و `BUG-STG-026 / 027` در این ریتست **PASS** باقی می‌مانند.

## Current runtime recheck — Waitlist PDP/form copy — ۲۰۲۶-۰۹-۲۸

- PDP فیکسچر `e8c21d68-b161-4085-9dd3-b03b59540d39` ظرفیت `۰ جای خالی` را نشان داد و مسیر guest form را ارائه کرد.
- فرم ظرفیت‌پر متن صریح «این فرم درخواست شما را در لیست انتظار ثبت می‌کند» و CTA `ثبت درخواست لیست انتظار` را داشت.
- در این session چون کاربر قبلاً برای خودش ثبت‌نام کرده بود، CTA disabled و فقط افزودن همراه مجاز بود؛ این محدودیت حساب کاربر است و با guest submit واقعی قبلی تعارض ندارد.
- نتیجه: `BUG-STG-WAITLIST-GUEST-FORM-COPY` **PASS**؛ closure عمومی CTA PDP همچنان به session مستقل anonymous/guest وابسته است، اما mutation guest قبلی موفق ثبت شده است.

## Current runtime recheck — guest pricing totals — ۲۰۲۶-۰۹-۲۸

- Admin booking `76cada3f-b10b-4b5f-9d08-bba158107996` (QA Pricing Guest Two، personal car) مبلغ کل `۵۰۰٬۰۰۰` و بدهی `۵۰۰٬۰۰۰` را نشان داد.
- Admin booking `f20dbbdb-280c-44ec-ac6c-787adf2397bf` (QA Pricing Guest One، no car/shared dong) مبلغ کل `۸۴۴٬۴۴۴` و بدهی `۸۴۴٬۴۴۴` را نشان داد.
- این دو guest روی یک تور تخفیف‌دار هستند؛ preview قبلی به‌ترتیب `۱٬۰۰۰٬۰۰۰` و `۱٬۳۴۴٬۴۴۴` بود. مبلغ نهایی هر دو همچنان با preview قراردادی و قیمت guest پایه همخوان نیست و تخفیف عضو به guest نشت کرده است.
- نتیجه: `BUG-STG-022` **FAIL جاری و مستقل بازتولید شد**.

## Current runtime recheck — Waitlist detail state — ۲۰۲۶-۰۹-۲۸

- Portal Detail برای registration `9b676ad8-08f3-48a0-bf47-1494b42bd9af` heading `درخواست شما در حال بررسی است` و body `در انتظار تأیید باشگاه` را نشان داد.
- badgeها جدا و سازگار بودند: `ثبت‌نام: لیست انتظار` و `رسید: لازم نیست`.
- هیچ deadline، CTA پرداخت، upload receipt یا label «تأیید شده» نمایش داده نشد.
- نتیجه: `BUG-STG-064 / 065` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` در این fixture **PASS** هستند.

## Current deploy health recheck — ۲۰۲۶-۰۹-۲۸، ۱۷:۵۶ UTC

- `https://denali.shenski.com/health`: HTTP `200`, body `{"ok":true}`, `x-cache: BYPASS`.
- `https://portal.denali.shenski.com/health`: HTTP `200`, body `{"ok":true}`, `x-cache: BYPASS`.
- `https://admin.denali.shenski.com/health`: HTTP `200`, body `{"ok":true}`, `x-cache: BYPASS`.
- نتیجه: هر سه host زنده‌اند و این بررسی نشانه‌ای از cache edge برای health نداد؛ release SHA همان manifest ثبت‌شدهٔ `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` باقی می‌ماند.

## Final continuation record — ۲۰۲۶-۰۹-۲۸

- `https://admin.denali.shenski.com/engagement` read-only بررسی شد؛ این صفحه فقط مشارکت/امتیاز و نشان‌ها را دارد و event labelهای Telegram در آن ارائه نمی‌شود، بنابراین از این URL به‌تنهایی closure `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS` ممکن نیست.
- Source gate on local HEAD `7eccfa6d27ee762f4c4f333541d7305ac3582252`: `pnpm run test:changed` **PASS** (`base=origin/main`, `mode=ci`, بدون failure). این نتیجه فقط source است.
- تکمیل source gate روی همان HEAD: `pnpm run pre-commit:fast` **PASS**؛ `guard-docs` و Node 24 pass شدند و به‌دلیل نبود staged path، lint-staged و test-changed داخلی skip شدند. `pnpm run guard:import-boundary` نیز **PASS**. این skipها failure نیستند، اما جایگزین اجرای staged diff نمی‌شوند.
- Excel artifact read-only: `/home/hamed/Downloads/denali-final-roster-20260927211403.xlsx`، SHA-256 `83b434219efa39af2f34ba9c1369ee590e0757f7d6b3bc332dbb374ea500ab89`. Sheetها: خلاصه گزارش، لیست نهایی، منتظر پرداخت، پرداخت‌شده، بدون دریافت وجه.
- `BUG-STG-EXPORT-SUMMARY`: **PASS برای این artifact**؛ خلاصه ۴ نهایی‌شده، ۳ پرداخت‌شده، ۱ بدون دریافت وجه، ۸ بدهکار/ناقص و مانده بدهکار `۲۰٬۰۰۰٬۰۰۰ تومان` دارد و با sheetهای detail (۴، ۳، ۱ و ۸ ردیف) و مانده‌های هر ۸ ردیف pending سازگار است.
- `BUG-STG-014 / 015 / 016`: **PASS read-only برای این artifact**؛ مبالغ با واحد نمایشی تومان و ارقام فارسی، نوع حمل در همه ردیف‌های نمونه، و `تاریخ نهایی‌شدن` برای ردیف‌های نهایی حاضر است. بررسی همین قرارداد روی export تازهٔ بعد از deploy نهایی هنوز باید تکرار شود.
- Excel integrity scan برای همان artifact: هر ۵ sheet visible، `formula_count=0` و `error_like_count=0`؛ جمع detailها با summary سازگار است: نهایی ۴ ردیف، پرداخت‌شده ۳ ردیف، بدون دریافت وجه ۱ ردیف، منتظر پرداخت ۸ ردیف و مانده pending برابر `۲۰٬۰۰۰٬۰۰۰ تومان`.
- Health/fingerprint read-only: `https://api.denali.shenski.com/health` با DNS resolve نشد؛ `/api/health` روی public و portal به‌ترتیب 404 و روی admin بدون session، 401 برگرداند. hostها `x-sid` و `x-request-id` دارند اما runtime SHA/build fingerprint ارائه نکردند؛ بنابراین fingerprint runtime همچنان **UNVERIFIED** است.
- Public HTML asset fingerprint read-only: `denali.shenski.com/tours` assetهای Next شامل `app/tours/page-0e8d71e20b51b326.js` و `app/layout-c1d1023c6f1f46a2.js` بود؛ این hashها به‌عنوان build fingerprint فنی ثبت شدند، اما mapping رسمی به Git SHA وجود ندارد.
- P2 direct retest روی artifact فعلی: کارت `ec171184-1877-4501-9a92-857f712838e2` در هر دو URL `https://denali.shenski.com/tours?sort=price_asc` و `?sort=price_desc` متن `۲٬۰۰۰٬۰۰۰ تومان / ۱٬۰۰۰٬۰۰۰ تومان / 50٪ تخفیف عضویت` داشت؛ order-dependent failure قبلی `BUG-STG-081` در این تکرار **بازنشد**، ولی به‌عنوان regression سابقه‌دار نیازمند recheck بعدی باقی می‌ماند. کارت `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9` فقط `۱٬۰۰۰٬۰۰۰ / ۵۰۰٬۰۰۰` را داشت و نوع حمل/دُنگ در متن کارت نبود؛ `BUG-STG-082` همچنان **FAIL** است.
- P2 focused source tests روی همان tree: Marketing `38/38 pass` و Denali catalog `8/8 pass`؛ شامل free label/filter/sort، member payable، transport/dong و PLP/PDP contract. این source PASS، runtime FAIL `BUG-STG-082` را override نمی‌کند؛ نشان می‌دهد failure باقی‌مانده در staging در لایهٔ runtime/public rendering است.
- P0/P1 focused source tests روی همان tree: API `28/28 pass` (finance service، booking list projection، P6 receipt flow) و Portal `11/11 pass` (free/payment status، timezone، waitlist CTA contract). warningهای کنترل‌شدهٔ `BOOKINGS_DB_UNAVAILABLE` و `MINIO_NOT_CONFIGURED` در fake/bootstrap تست ظاهر شدند و failure نبودند. این source PASS، runtime mismatchهای Portal/Admin را override نمی‌کند.
- Runtime confirmation after source gate: Portal List برای `4190860a-9948-4c62-b29b-85d3e494e765` همچنان `برای نهایی‌شدن، پرداخت لازم است` دارد؛ Portal Detail همان ID هم‌زمان `نیازی به پرداخت نیست` و `فیش لازم نیست` دارد. `BUG-STG-080` در artifact فعلی **FAIL جاری و تکرارشده** است.
- Runtime paid projection confirmation: Portal Detail برای `f2144510-bc47-4d1f-b6ad-42002a6ac51a` هم‌زمان `رسید: تأیید شده`، `رسید پرداخت را ارسال کنید` و `مهلت پرداخت` دارد؛ Admin booking همان ID نیز `پرداخت جزئی (رزرو)`، `مهلت پرداخت` و `پیگیری پرداخت` را نشان می‌دهد. `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` **FAIL جاری و تکرارشده** هستند.
- Text-receipt mutation readiness: Finance `https://admin.denali.shenski.com/finance?tab=receipts&registrationId=4ae40b3e-dcdf-4b6c-bc24-30f7706d4147` صف را «فیشی در انتظار بررسی نیست» نشان داد؛ fixture receipt متنی قبلی دیگر pending نیست. approve جدید انجام نشد و وضعیت این گیت **UNVERIFIED / fixture missing** ثبت شد.
- Portal registration scan برای ۲۶ registration: تنها مورد «در انتظار بررسی» قابل‌مشاهده `c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` مربوط به `QA-STG-20260924-FREE-MANUAL` است و payment/receipt لازم ندارد؛ هیچ paid registration با receipt pending مناسب approve متنی پیدا نشد. `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS` و approve post-receipt همچنان **UNVERIFIED / fixture missing** هستند.
- Free pending detail: `https://portal.denali.shenski.com/me/registrations/c537ac2e-8d2f-454a-bbf8-9cbba1adc7a8` برای `QA Free Pending Guest 20260928` وضعیت registration «در انتظار بررسی» و receipt «لازم نیست» نشان داد؛ payment CTA، deadline یا upload receipt در AX دیده نشد. `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` در این مرز **PASS read-only** است.
- Deployment recheck via GitHub Actions API در `2026-09-28T14:38:11Z`: آخرین run همچنان `36434901424` با SHA `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` و `success` است؛ run جدیدی برای HEAD محلی `7eccfa6d...` وجود ندارد. این blocker deployment در این لحظه تأیید شد.
- Runtime artifact under test: `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`; local HEAD با آن برابر نیست و runtime fingerprint مستقل هم موجود نیست.
- Latest read-only runtime evidence remains: `BUG-STG-080`، `BUG-STG-039/072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE`، `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`، `BUG-STG-082` و `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` **FAIL**؛ `BUG-STG-026/027`، free label و Waitlist copy/detail **PASS**؛ `BUG-STG-022` و promotion واقعی **UNVERIFIED**.
- Telegram staging delivery همچنان به‌دلیل health خطادار اتصال، بدون mutation و **UNVERIFIED** است. API before/after mutation، screenshot فایل‌محور و cache key/revalidation نیز هنوز ثبت نشده‌اند.
- `git diff --check`: **PASS**. تغییرات worktree فعلی: فایل QA و فایل معماری قبلی؛ فایل معماری در این sweep تغییر داده نشد.

## Current staging read-only continuation — ۲۰۲۶-۰۹-۲۸

- `https://denali.shenski.com/tours?sort=price_asc` — **PASS `BUG-STG-027`**: ترتیب با fixtureهای رایگان شروع شد؛ سه کارت رایگان در ابتدای فهرست قرار گرفتند و URL مقدار `sort=price_asc` داشت.
- `https://denali.shenski.com/tours?sort=price_desc` — **PASS `BUG-STG-027`**: ترتیب با تور `۱۰٬۰۰۰٬۰۰۰ تومان` شروع شد و fixtureهای رایگان (`QA WAITLIST GROUP 20260927`، `QA-STG-20260924-FREE-MANUAL` و `صعود یک‌روزه توچال با تأیید ادمین`) در انتهای فهرست قرار گرفتند.
- `https://denali.shenski.com/tours?minPrice=0&maxPrice=0` — **PASS `BUG-STG-026`**: ورودی‌های حداقل/حداکثر هر دو مقدار `0` را حفظ کردند و سه تور رایگان در نتایج برگشتند؛ label رایگان روی هر سه حاضر بود.
- در همین سه سناریو AX و URL فیلتر ثبت شد؛ response خام API، cache key و زمان revalidation در این مرحله از browser در دسترس نبود و برای گیت نهایی **UNVERIFIED** باقی است.

## Current staging operational/admin continuation — ۲۰۲۶-۰۹-۲۸

- `https://admin.denali.shenski.com/tours/a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9/workspace?tab=transport` — **PASS smoke برای `BUG-STG-037`** در fixture `a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9`: خلاصه Admin «نهایی‌شده برای حضور ۸»، tab «لیست عملیاتی ۸» و جدول دقیقاً ۸ ردیف نشان دادند. این فقط همان tour/fixture است و جایگزین تست فیلترهای مختلف نمی‌شود.
- همان صفحه operational برای هر ۸ ردیف وضعیت حمل و پرداخت مستقل نشان داد؛ «وجه دریافت شد / بدون مانده قابل پیگیری» و «بدون نیاز به پرداخت» از هم تفکیک شده بودند.
- `https://admin.denali.shenski.com/tours/a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9/workspace?tab=waitlist` — **PASS label smoke**: تب Waitlist با عنوان «صف ظرفیت — تأیید پس از آزاد شدن جا» و توضیح انتقال پس از آزادشدن ظرفیت نمایش داده شد؛ در این tour ردیف Waitlist موجود نبود، بنابراین promotion و label ردیف mutation-tested نیست.
- Header read-only هر سه host: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` و `x-cache: BYPASS` ثبت شد. `x-sid` برای public/portal برابر `2093` و برای admin برابر `2071` بود. هیچ runtime SHA یا HTML marker شامل SHA پیدا نشد؛ runtime SHA همچنان **UNVERIFIED** است.

## Current staging waitlist/pricing continuation — ۲۰۲۶-۰۹-۲۸

- `https://portal.denali.shenski.com/catalog/e8c21d68-b161-4085-9dd3-b03b59540d39/register` — **PASS copy smoke برای `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY`**: فرم ظرفیت‌پر صریحاً می‌گوید درخواست در Waitlist ثبت می‌شود و CTA «ثبت درخواست لیست انتظار» دارد؛ payment/upload copy دیده نشد.
- `https://portal.denali.shenski.com/me/registrations/71c11d10-3829-4887-94dd-f5f5b00a260e` — **PASS detail smoke برای Waitlist state**: heading «درخواست شما در حال بررسی است»، registration «در انتظار بررسی» و receipt «لازم نیست»؛ پیام approved نهایی یا CTA پرداخت وجود نداشت. این تست mutation/promotion نیست.
- `https://portal.denali.shenski.com/catalog/ec171184-1877-4501-9a92-857f712838e2/register` — preview عضوِ موجود و مهمان محلی خوانده شد؛ فرم برای مهمان قیمت `۲٬۰۰۰٬۰۰۰ تومان` نشان داد، اما ثبت نهایی انجام نشد. به‌دلیل نبود submit واقعی با fixture تازه، `BUG-STG-022` همچنان **UNVERIFIED** است و این مشاهده به‌تنهایی اثبات محاسبه نهایی حمل/دُنگ نیست.
- `https://admin.denali.shenski.com/settings/exposure` — **FAIL قطعی `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`**: صفحه و labelهای اصلی فارسی هستند، اما AX description فیلد `نقطه شروع` مقدار انگلیسی خام `Start, summit, camp and end location zones.` را نشان می‌دهد؛ همان فیلد در صفحه فارسی نشت کرده است.
- Worktree verification: HEAD محلی فعلی `7eccfa6d27ee762f4c4f333541d7305ac3582252` است؛ artifact تست‌شده `222ab05585d9adfe51aa02be06bb8c71b20f4b7e` است. چون این دو SHA یکسان نیستند، closure source-to-runtime برای این sweep **ثبت نشد**.
- Admin booking read-only corroboration: `https://admin.denali.shenski.com/bookings?status=all&bookingId=f2144510-bc47-4d1f-b6ad-42002a6ac51a` همان registration را «تأییدشده»، «پرداخت جزئی (رزرو)»، دارای deadline و «پیگیری پرداخت» نشان داد؛ بازکردن «سابقه تغییرات» نیز همین payment state فعلی را نمایش داد.
- Telegram integration read-only: `https://admin.denali.shenski.com/settings/integrations` صفحه فارسی است، اما اتصال Telegram وضعیت «خطا» و «هیچ منبع ارسال فعالی» دارد. بنابراین ارسال واقعی photo/PDF، حفظ thread، جلوگیری از General و retry در staging فعلی **UNVERIFIED / blocked by integration health** است؛ هیچ فعال‌سازی یا تغییری انجام نشد.
- Source verification on current local HEAD `7eccfa6d27ee762f4c4f333541d7305ac3582252`: `pnpm run test:changed` — **PASS** (`base=origin/main`, mode=ci؛ تمام packageهای بررسی‌شده cache hit و بدون failure). این نتیجه source-only است و artifact staging `222ab055...` را تأیید نمی‌کند.
- Deployment source-of-truth recheck: `origin/dev = 222ab05585d9adfe51aa02be06bb8c71b20f4b7e` و آخرین deploy موفق نیز همین SHA است؛ `HEAD = 7eccfa6d27ee762f4c4f333541d7305ac3582252` و از نظر tree با `origin/dev` برابر است. تفاوت commit identity به‌تنهایی blocker deploy نیست؛ runtime failures همچنان باید بسته شوند.
- **اصلاح نتیجهٔ deployment gate:** پس از `git fetch origin dev`، tree هر دو commit (`origin/dev=222ab055...` و `HEAD=7eccfa6d...`) برابر `ce985a316940a6f53f36aac2582b03870d51c92e` و `git diff origin/dev..HEAD` خالی بود. پس artifact staging از نظر محتوای source با HEAD برابر است؛ تفاوت SHA فقط تفاوت commit identity/history است. failureهای runtime ثبت‌شده روی artifact فعلی، معتبر و مربوط به همین tree هستند؛ deploy اضافی فقط برای برابرکردن SHA لازم نیست.
- توجه: مقدار `origin/dev` در خط قبل از `git ls-remote origin refs/heads/dev` است؛ tracking ref محلی هنوز قدیمی است و برای تصمیم deploy استفاده نشد.

## Current staging deploy retest — ۲۰۲۶-۰۹-۲۸ — artifact `222ab05585d9adfe51aa02be06bb8c71b20f4b7e`

- Deploy evidence: workflow `deploy-staging.yml`, run `36434901424`، وضعیت `success`؛ این artifact مربوط به HEAD جاری بعد از merge شدن PR #219 است. Runtime fingerprint endpoint مستقل هنوز ثبت نشده و باید در گیت نهایی اضافه شود.
- PDP پایه: `https://denali.shenski.com/tours/00000000-0000-4000-8000-000000000220` — **PASS smoke** برای `BUG-STG-008 / 013 / 035`: AX مقدار `روش پرداخت: رسید / پرداخت آفلاین`، `تأیید ثبت‌نام: دستی` و زمان `۳ مهر ۱۴۰۵، ۱۱:۳۰` را نشان داد. ظرفیت نمایشی عمداً در این sweep ارزیابی نشد.
- PLP: `https://denali.shenski.com/tours` — **PASS** برای label رایگان و labelهای Waitlist در کارت‌ها؛ کارت‌های تخفیف‌دار قیمت پایه/عضو را نشان می‌دهند. برای `BUG-STG-082` کارت `تخفیف با تور` در AX نوع حمل و مبلغ دُنگ را نشان نداد، در حالی که PDP همان تور هر دو را نشان داد؛ بنابراین **FAIL فعلی PLP/PDP transport projection**.
- PDP تخفیف‌دار: `https://denali.shenski.com/tours/ec171184-1877-4501-9a92-857f712838e2` — **PASS** برای `BUG-STG-081` در fixture عضو: قیمت پایه `۲٬۰۰۰٬۰۰۰`، تخفیف ۵۰٪ و قیمت نهایی عضو `۱٬۰۰۰٬۰۰۰ تومان`؛ همچنین `خودروهای مشترک` و `هزینه دونگی ۳۰۰٬۰۰۰ تومان` حاضر است. registration detail عضو: `dec57498-5d4e-441e-947d-309b66d28df7`.
- PDP رایگان: `https://denali.shenski.com/tours/c3a3c778-99ab-4750-8dc6-3172fa5ce034` — **PASS** برای `BUG-STG-025`: label `رایگان / بدون نیاز به پرداخت` حاضر است و payment method، مبلغ و CTA پرداخت در AX دیده نشد.
- Portal Detail رایگان: `https://portal.denali.shenski.com/me/registrations/4190860a-9948-4c62-b29b-85d3e494e765` — **PASS detail-side** برای free projection: «نیازی به پرداخت نیست»، «فیش لازم نیست»، registration تأیید شده و receipt لازم نیست.
- Portal List: `https://portal.denali.shenski.com/me/registrations` — **FAIL قطعی `BUG-STG-080`** برای همان registration `4190860a-9948-4c62-b29b-85d3e494e765`: List می‌گوید «برای نهایی‌شدن، پرداخت لازم است»، در حالی که Detail همان رکورد می‌گوید پرداخت لازم نیست. این mismatch روی artifact جدید بازتولید شد.
- Portal payment detail: `https://portal.denali.shenski.com/me/registrations/f2144510-bc47-4d1f-b6ad-42002a6ac51a` — **FAIL `BUG-STG-039 / 072` و projection پرداخت**: متن body هنوز «رسید پرداخت را ارسال کنید» و deadline را نشان می‌دهد، اما همان صفحه هم‌زمان `رسید: تأیید شده`، notice «پرداخت تأیید شد» و مبلغ قابل‌استرداد `۸۴۴٬۴۴۴ تومان` دارد. registration ID: `f2144510-bc47-4d1f-b6ad-42002a6ac51a`.
- Admin booking: `https://admin.denali.shenski.com/bookings?status=approved&tourId=a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9&bookingId=f2144510-bc47-4d1f-b6ad-42002a6ac51a` — **FAIL قطعی `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`**: ردیف همان registration را «تأییدشده»، «پرداخت جزئی (رزرو)» و دارای deadline نشان می‌دهد؛ با Portal/Finance یک state واحد ندارد.
- Finance payments: `https://admin.denali.shenski.com/finance?tab=payments&tourId=a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9&registrationId=f2144510-bc47-4d1f-b6ad-42002a6ac51a` — **PASS برای projection مالی همان fixture**: کل `۸۴۴٬۴۴۴`، پرداخت‌شده `۸۴۴٬۴۴۴` و مانده `۰ تومان` نمایش داده شد؛ این نتیجه تناقض Admin/Portal را تأیید می‌کند، نه closure کل P0.
- Finance receipts: `https://admin.denali.shenski.com/finance?tab=receipts&tourId=a4f227fb-bc72-40ed-bf23-2c1d6fb35fb9&registrationId=f2144510-bc47-4d1f-b6ad-42002a6ac51a` — صف رسید در انتظار خالی بود؛ receipt approve جدیدی در این sweep انجام نشد.
- Waitlist list labels: در Portal List رکوردهای `256183c5-9b73-492c-b8ea-290394c0e58b` و دو fixture دیگر با label «لیست انتظار» دیده شدند؛ **PASS فقط برای label/list-side**. promotion، race و submit واقعی در این sweep انجام نشد.
- API before/after mutation، cache key/`Cache-Control`/revalidation، screenshot و AX artifact فایل‌محور در این sweep هنوز ثبت نشده‌اند؛ بنابراین برای گیت نهایی **UNVERIFIED** هستند.
- هیچ mutation (approve/reject/resubmit/upload/promotion) در این retest انجام نشد.

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

## Staging runtime continuation — ۲۰۲۶-۰۹-۲۹ (remaining items, current artifact)

Scope note: `BUG-STG-ADMIN-EXPORT-SUMMARY` / final Excel roster is intentionally excluded from this remaining-check list because its fix is not deployed yet. It remains a separate deployment blocker.

### Current PASS evidence

- `BUG-STG-081` — PASS on current Marketing runtime. PLP `https://denali.shenski.com/tours?sort=price_asc` and PDP `https://denali.shenski.com/tours/ec171184-1877-4501-9a92-857f712838e2` both showed base `۲٬۰۰۰٬۰۰۰ تومان`, member `۱٬۰۰۰٬۰۰۰ تومان`, and 50% membership discount. The PLP and PDP values matched for the logged-in member fixture.
- `BUG-STG-082` — PASS on current Marketing runtime for the shared-car fixture `ec171184-1877-4501-9a92-857f712838e2`: PLP and PDP both showed `خودروهای مشترک` and `۳۰۰٬۰۰۰ تومان` dong. No duplicate transport amount was observed.
- `BUG-STG-025` — PASS on free PDP `https://denali.shenski.com/tours/c3a3c778-99ab-4750-8dc6-3172fa5ce034`: `رایگان / بدون نیاز به پرداخت` was visible and payment method/CTA/plan UI was absent.
- `BUG-STG-026 / 027` — PASS on current PLP: `minPrice=0&maxPrice=0` returned 3 free tours with free cards; `price_asc` placed free cards first and `price_desc` placed free cards last.
- `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` — PASS on Admin workspace `https://admin.denali.shenski.com/tours/00000000-0000-4000-8000-000000000220/workspace?tab=waitlist`: all 7 rows showed `در لیست انتظار`, not `تأییدشده`; selected row detail also showed `در لیست انتظار`.
- `BUG-STG-037` — PASS for the current read-only operational view: Admin summary showed `لیست عملیاتی ۱۲`, the table showed 12 rows, and the transport tab count matched the visible operational total. This is a count/filter smoke only; no mutation was performed.
- `BUG-STG-WAITLIST-GUEST-FORM-COPY` — PASS for current guest-form copy at `https://portal.denali.shenski.com/catalog/e8c21d68-b161-4085-9dd3-b03b59540d39/register`: the page stated `ظرفیت تور تکمیل است؛ این فرم درخواست شما را در لیست انتظار ثبت می‌کند` and the CTA label was `ثبت درخواست لیست انتظار`. No receipt upload or payment CTA was visible. The CTA was disabled because the logged-in user already had a registration; no submit mutation was executed.

### Current FAIL evidence

- `BUG-STG-062 / 047` — FAIL on current PDP `https://denali.shenski.com/tours/e8c21d68-b161-4085-9dd3-b03b59540d39`: the page showed `۰ جای خالی` and a generic `ثبت‌نام مهمان دیگر` link, but no explicit PDP CTA/copy `عضویت در لیست انتظار`. The guest form has the correct copy, so the remaining defect is specifically PDP exposure/CTA.
- `BUG-STG-080` — FAIL on current Portal runtime. Free registration `4190860a-9948-4c62-b29b-85d3e494e765` appeared in Portal List as `تأیید شده ... برای نهایی‌شدن، پرداخت لازم است`, while its detail page showed `ثبت‌نام شما نهایی شده است`, `نیازی به پرداخت ندارید`, and `رسید: لازم نیست`. List and Detail still disagree for the same free registration.
- `BUG-STG-039 / 072` — FAIL on current Portal detail `https://portal.denali.shenski.com/me/registrations/f2144510-bc47-4d1f-b6ad-42002a6ac51a`: it showed `رسید پرداخت تأیید شد` but also `برای نهایی شدن سفر، پرداخت را تکمیل کنید` and an active payment deadline. Receipt status and registration/payment projection remain mixed.
- `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` — FAIL on the same paid registration `f2144510-bc47-4d1f-b6ad-42002a6ac51a`: approved receipt did not produce a settled Portal projection; payment deadline/action remained visible.
- `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` — FAIL in current Admin workspace: operational rows still showed `تأییدشده`, `برای ورود به فهرست نهایی، پرداخت باقی‌مانده را پیگیری کنید`, and `پرداخت‌نشده` for approved registrations. This is the old payment-gated projection on Admin/Finance.

### Still unverified without a controlled mutation or missing fixture

- `BUG-STG-063` — UNVERIFIED in this read-only pass. A real promotion of a group larger than available capacity was not executed; no booking/hold side effect was created.
- `BUG-STG-064 / 065` — UNVERIFIED for the actual transition event. Current waitlist rows and guest-form copy are correct, but a real capacity release → promotion/rejection transition was not executed.
- `BUG-STG-021` — existing source/backend and prior staging duplicate evidence remain PASS, but no new concurrent submit was run in this read-only continuation.
- `BUG-STG-022` — existing source/preview evidence remains partial; final multi-person submit and independent transport/dong total were not re-executed in this continuation.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` — not re-run in the current browser pass because the real Exposure field route/fixture was not opened; status remains UNVERIFIED, not PASS.
- `BUG-STG-019` and `BUG-STG-036` — no new toggle/redaction mutation was executed; prior current-artifact evidence remains the authoritative FAIL/needs-fix record. Closure still requires API + HTML + AX + structured-data proof after the Exposure setting is changed.

### Runtime evidence metadata

- Current URLs inspected: Marketing PLP/PDP, Portal registration/detail, Admin tour workspace.
- Browser AX evidence was captured for each page above.
- Admin current counts: waitlist 7, operational 12, finalized-for-attendance 5.
- No registration, receipt, promotion, cancellation, approval, or upload mutation was performed in this continuation; therefore no new registration/receipt IDs or before/after mutation responses were generated.
- Runtime artifact SHA remains UNVERIFIED because the current hosts do not expose a usable build SHA/fingerprint in the inspected response headers.

### Correction from direct current-runtime Exposure recheck

- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE` — PASS on the current page `https://admin.denali.shenski.com/settings/exposure` after expanding `جزئیات کاتالوگ عمومی`. The field rendered as `نقطه شروع` and its AX description was Persian: `ناحیه‌های شروع، قله، اردوگاه و پایان مسیر.`; no raw English registry description was visible. The Telegram event labels on the same page were also Persian (`ثبت‌نام عضو`, `تأیید رسید پرداخت`, `رد رسید پرداخت`, `ارسال رسید پرداخت`, `قرارگرفتن ثبت‌نام در لیست انتظار`). This supersedes the older historical runtime failure for this check; no setting was changed and the save control remained disabled.

### Additional non-mutating P1 check

- `BUG-STG-022` — still UNVERIFIED for final multi-person pricing. The discount-tour guest form exposed `افزودن همراه`, guest name/phone fields, and independent personal-car controls; adding/removing the local guest draft did not submit anything. Because the guest identity was not entered or submitted, independent member-vs-guest payable totals and final transport/dong aggregation were not closed.

### PLP/PDP capacity-state continuation

- `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` — FAIL on the current pair for `e8c21d68-b161-4085-9dd3-b03b59540d39`: PLP showed the card labels `رایگان / بدون نیاز به پرداخت` and `لیست انتظار`, while PDP showed `۰ جای خالی` and only the generic `ثبت‌نام مهمان دیگر` link without an explicit Waitlist CTA. The capacity fact is consistent, but the user-facing registration state/CTA is not consistent between list and detail.

### Existing staging fixtures rechecked read-only

- `BUG-STG-021` — fixture `QA Duplicate Runtime 20260928` exists in Portal as registration `bc596f02-acdc-4ef9-b837-dcc0949f2a59`; the current list contains one visible record for that guest. This proves fixture availability, not the required concurrent `201/409` race, so the current continuation remains UNVERIFIED for a fresh browser mutation.
- `BUG-STG-022` — two current staging fixtures exist: `QA Multi Guest One 20260928` (`0e9fd673-9ebc-4647-bdad-8b18d820eff3`) and `QA Multi Guest Two 20260928` (`0b6d0cb3-e070-4b88-b2c4-46174a63c543`). Their detail pages are pending approval and expose transport controls, but no final participant payable totals; therefore the multi-person pricing/transport closure remains UNVERIFIED.
- `BUG-STG-063` — Admin read-only fixture `QA P1 group over-capacity 20260928` is present with party size 3 and remains in `لیست انتظار` while capacity is `۱۲/۱۲`. This confirms the pre-promotion guard state, but no promotion action was clicked; atomic promotion success/failure and hold creation remain UNVERIFIED.

### Portal Waitlist/final-state fixture comparison

- Waitlist fixture `fb630288-60e0-4ee9-96d2-ae86084fbcc2` (`QA Waitlist Runtime 20260928C`) showed heading `درخواست شما در حال بررسی است`, independent labels `ثبت‌نام: لیست انتظار` and `رسید: لازم نیست`, and no payment/upload action.
- Final fixture `9b676ad8-08f3-48a0-bf47-1494b42bd9af` (`QA Waitlist Guest 20260928`) showed `ثبت‌نام شما نهایی شده است`, `ثبت‌نام: تأیید شده`, `رسید: لازم نیست`, and no payment action.
- This confirms the two rendered states are separated for existing records, but does not prove the real capacity-release transition from the first fixture to the second; `BUG-STG-064 / 065` remains UNVERIFIED for transition closure.

### Second multi-person fixture recheck

- `BUG-STG-022` fixture `0e9fd673-9ebc-4647-bdad-8b18d820eff3` (`QA Multi Guest One 20260928`) showed `در انتظار بررسی`, transport `ماشین شخصی می‌آورم · 1 صندلی`, and an independent transport editor. No payable amount was exposed before approval, so the final member/guest discount and dong aggregation still cannot be certified from read-only UI.

## Local P0 financial projection checkpoint — 2026-09-29

- Implemented one shared Portal financial projection for List hydration and Detail rendering.
- The projection normalizes free/waived and paid states and clears stale `paymentDueAt`; receipt status remains independent.
- Source/runtime staging closure is not claimed here: staging deploy, runtime SHA, real registration IDs, screenshots/AX and cache evidence remain required after deploy.

## Image fixture/Object Storage recheck — ۲۰۲۶-۰۹-۲۹

این بخش فقط نتیجهٔ fixture تصویری QA را ثبت می‌کند؛ هیچ کد، commit یا PR در این مرحله تغییر نکرد.

### Fixture و storage

- چهار فایل PNG ارائه‌شدهٔ کاربر در Object Storage استیجینگ آپلود شد.
- ۱۱ تور QA به چهار `storageKey` واقعی متصل شدند؛ مجموعاً ۴۴ آبجکت تصویری.
- الگوی کلیدها:
  - `00000000-0000-4000-8000-000000000003/tours/<tourId>/photos/smk-photo-1`
  - `00000000-0000-4000-8000-000000000003/tours/<tourId>/photos/qa-photo-2`
  - `00000000-0000-4000-8000-000000000003/tours/<tourId>/photos/qa-photo-3`
  - `00000000-0000-4000-8000-000000000003/tours/<tourId>/photos/qa-photo-4`
- نمونهٔ Object Storage برای `de32096c-4b02-405f-9bc8-31e906e89838` با `mc stat` موجود بود؛ هر چهار آبجکت اندازهٔ حدود ۱٫۹ تا ۲٫۲ MiB و `Content-Type=image/png` داشتند.
- در `canonical_data.data.photos` هر ۱۱ تور، فیلد `storageKey` وجود داشت و URL خارجی قدیمی حذف شده بود.

### PDP browser evidence

- URL: `https://denali.shenski.com/tours/de32096c-4b02-405f-9bc8-31e906e89838`
- عنوان تور: `QA 2026 Free No Payment`
- چهار تصویر گالری با `complete=true` و `naturalWidth > 0` لود شدند.
- تصویر اصلی: `1672×941`؛ سه تصویر دیگر: `640×360`.
- `currentSrc` هر چهار تصویر از مسیر signed Object Storage از طریق image proxy استیجینگ بود.
- `externalUnsplash=0` و fallback محلی در تصاویر گالری مشاهده نشد.
- label رایگان همچنان `رایگان / بدون نیاز به پرداخت` بود؛ این بررسی تصویر، regression مالی جدیدی ایجاد نکرد.

### PLP browser evidence

- URL: `https://denali.shenski.com/tours`
- ۱۱ کارت QA در صفحه پیدا شدند.
- هر ۱۱ تصویر `complete=true` و `naturalWidth=451` داشتند.
- `broken=[]`، `externalUnsplash=0` و `fallback=0`.
- `storageBacked=11`؛ همهٔ تصاویر کارت‌ها از Object Storage خوانده شدند.

### نتیجهٔ closure این مورد

**PASS قطعی برای fixture تصویری:**

- `BUG-STG-IMAGE-STORAGE-FIXTURE` — آپلود، اتصال `storageKey` و نمایش واقعی تصویر در PLP/PDP.
- تصویر broken، fallback یا URL خارجی در PLP/PDP دیده نشد.

این نتیجه فقط صحت fixture و مسیر نمایش تصویر را می‌بندد و جایگزین تست سایر P0/P1/P2های مالی، Waitlist، Exposure یا pricing نیست.

## Current staging retest after deploy — ۲۰۲۶-۰۹-۲۹

این sweep روی staging فعلی انجام شد. نتیجهٔ این بخش جایگزین شواهد قبلی نیست؛ اگر fixture لازم در artifact فعلی وجود نداشته باشد، وضعیت `UNVERIFIED / fixture missing` ثبت شده است.

### PASS قطعی در artifact فعلی

- `BUG-STG-IMAGE-STORAGE-FIXTURE`: PDP تور `de32096c-4b02-405f-9bc8-31e906e89838` هر ۴ تصویر را با `complete=true` و `naturalWidth > 0` لود کرد؛ PLP نیز ۱۱ تصویر QA را لود کرد، `broken=0`، `fallback=0` و `Unsplash=0`.
- `BUG-STG-081`: تور `QA 2026 Member Discount` در PLP و PDP هر دو قیمت پایه `۲٬۵۰۰٬۰۰۰ تومان`، تخفیف `۵۰٪` و قیمت عضو `۱٬۲۵۰٬۰۰۰ تومان` نشان دادند.
- `BUG-STG-082`: تور `QA 2026 Shared Cars Dong` در PLP و PDP هر دو `خودروهای مشترک` و `دونگی: ۸۰٬۰۰۰ تومان` را نشان دادند؛ در PDP نیز همین مقدار در بخش logistics تکرار شد.
- `BUG-STG-025`: تور `QA 2026 Free No Payment` در PLP و PDP label `رایگان / بدون نیاز به پرداخت` داشت؛ روش پرداخت و payment plan در PDP نبود.
- `BUG-STG-026 / 027`: `minPrice=0&maxPrice=0` یک تور رایگان را برگرداند؛ در `price_asc` رایگان ابتدای فهرست و در `price_desc` انتهای فهرست بود.
- past-tour label: PLP برای `QA 2026 Past Expired` برچسب `پایان‌یافته` و PDP پیام `این تور به پایان رسیده است` نشان داد؛ ثبت‌نام جدید برای آن نمایش داده نشد.
- `BUG-STG-035`: Public PDP و Admin Workspace برای `North Ridge Trek` هر دو زمان شروع `۲۱ مهر ۱۴۰۵، ۱۱:۳۰` را نشان دادند؛ اختلاف timezone در این fixture دیده نشد.
- `BUG-STG-ADMIN-EXPOSURE-LOCATION-ZONES-LOCALE`: صفحهٔ Exposure فعلی labelها و descriptionهای فارسی را نشان داد؛ description انگلیسی خام در متن صفحه دیده نشد.
- `BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS`: رویدادهای صفحهٔ فارسی Admin مانند `ثبت‌نام عضو`، `تأیید رسید پرداخت`، `رد رسید پرداخت` و رویدادهای Ticket فارسی بودند؛ label انگلیسی در متن صفحه پیدا نشد.

### UNVERIFIED — fixture فعلی برای تست وجود نداشت

- `BUG-STG-080`: Portal List فعلی `هنوز ثبت‌نامی ندارید` نشان داد و detail شناسهٔ قبلی `4190860a-9948-4c62-b29b-85d3e494e765`، `صفحه یافت نشد` بود؛ free List/Detail/Admin/Finance قابل تطبیق نبود.
- `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE`: registration/receiptهای قبلی در Portal فعلی قابل بازشدن نبودند؛ approve/resubmit جدید اجرا نشد.
- `BUG-STG-062 / 047`، `BUG-STG-WAITLIST-GUEST-FORM-COPY` و `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC`: fixture ظرفیت‌پر فعلی پیدا نشد؛ `e8c21d68-b161-4085-9dd3-b03b59540d39` دیگر منتشر نیست و `North Ridge Trek` ظرفیت `۰/۱۲` دارد، نه ظرفیت‌پر.
- `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` و `BUG-STG-037`: Admin Waitlist برای fixture فعلی صفر ردیف نشان داد؛ بنابراین label ردیف‌ها و تطبیق شمارنده/جدول exercised نشد.
- `BUG-STG-021`: concurrent duplicate submit اجرا نشد؛ هیچ `201/409` جدیدی در این sweep تولید نشد.
- `BUG-STG-022`: submit واقعی چندنفره و جمع نهایی transport/dong اجرا نشد.
- `BUG-STG-063` و `BUG-STG-064 / 065`: promotion یا transition واقعی Waitlist اجرا نشد؛ side effect ایجاد نشد.
- `BUG-STG-019 / 036`: toggle Exposure و بررسی هم‌زمان API، HTML، AX و JSON-LD اجرا نشد؛ closure redaction تأیید نشد.
- `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH`، `BUG-STG-040` و `BUG-STG-RECEIPT-RESUBMIT-STALE-STATUS`: fixture pending/rejected receipt موجود نبود و upload/resubmit اجرا نشد.
- Telegram delivery واقعی و فایل تصویری/PDF خارج از این sweep اجرایی بود؛ source/UI label pass به‌تنهایی delivery را نمی‌بندد.

### جمع‌بندی این ریتست

- PASS قطعی جدید/تأییدشده: تصویر Object Storage، قیمت عضو، حمل و دُنگ PLP/PDP، label و filter/sort رایگان، past-tour label، timezone فعلی و locale Exposure/Telegram.
- موارد مالی، Waitlist، duplicate و promotion به‌دلیل نبود fixture قابل اجرا بسته نشدند؛ وضعیت آن‌ها `UNVERIFIED` است، نه PASS.
- هیچ mutation مالی، receipt، promotion، cancellation یا submit جدیدی در این sweep انجام نشد.

## Controlled staging mutation sweep — ۲۰۲۶-۰۹-۲۹

این بخش نتیجهٔ اجرای واقعی روی fixtureهای کم‌ظرفیت QA است. تمام mutationها با یک تب staging و با ثبت AX انجام شدند؛ هیچ دادهٔ واقعی کاربر هدف نبود.

### Fixtureهای اجراشده

- Waitlist: `QA 2026 Waitlist Capacity 1` — tour `0ae44e0f-7ce7-4bf3-aa18-662be4aa2af8`
- Free: `QA 2026 Free No Payment` — tour `de32096c-4b02-405f-9bc8-31e906e89838`
- Receipt: `QA 2026 Receipt States` — tour `f5f579c9-665e-4606-80db-161e8044d894`
- QA member/session: `نصر الله`، phone ending `6598`

### Waitlist ثبت‌نام و آزادسازی ظرفیت

- registration `87ba6c0a-d0f7-4c96-9090-3e9a09d6d5e5` از Portal ثبت شد.
- قبل از انتقال: Portal detail متن `درخواست شما در حال بررسی است` و Admin row با وضعیت `در انتظار` داشت.
- Admin action `انتقال به لیست انتظار` موفق بود و پیام `نصر الله به لیست انتظار منتقل شد.` نمایش داده شد.
- بعد از انتقال: Portal detail متن `در لیست انتظار قرار گرفتید`، `ثبت‌نام: لیست انتظار` و `رسید: لازم نیست` داشت؛ CTA پرداخت/آپلود وجود نداشت.
- Admin Waitlist ظرفیت `۱/۱`، row با label `در لیست انتظار` و پرداخت `پرداخت‌نشده (رزرو)` نشان داد.
- برای آزادکردن ظرفیت، رزرو QA نهایی‌شدهٔ `6163d13a-0703-499a-b1a3-b1a59da038f0` از Admin لغو شد؛ ظرفیت به `۰/۱` رسید.
- نتیجهٔ مهم: Waitlist موجود به‌جای promotion، به وضعیت `لغوشده` رفت و در فهرست `waitlisted` باقی نماند. بنابراین promotion واقعی اجرا نشد.

**FAIL قطعی:** `BUG-STG-063` و transition بخشی از `BUG-STG-064 / 065` — با آزادشدن ظرفیت، candidate صف انتظار به‌صورت خودکار لغو شد؛ booking approved ساخته نشد و promotion قابل مشاهده نبود.

### ثبت‌نام رایگان

- registration `fe517455-25fb-43bc-9d42-4e73f3574d60` برای `QA 2026 Free No Payment` ثبت شد.
- Portal List: `تأیید شده` و `پرداخت لازم نیست`.
- Portal Detail: `ثبت‌نام شما نهایی شده است`، `رسید: لازم نیست`، `نیازی به پرداخت نیست` و مبلغ `۰ تومان`.
- کنترل UI: upload receipt، CTA پرداخت و deadline در Detail وجود نداشتند.

**PASS:** `BUG-STG-080` برای free List/Detail/Portal و نبود مسیر پرداخت در سناریوی واقعی.

### چرخهٔ کامل receipt متنی

- registration پرداختی `68930b23-ea43-4e2a-81f8-dd4c3402b127` برای `QA 2026 Receipt States` ثبت شد و از Admin با تأیید دو مرحله‌ای به `تأییدشده` رسید.
- Portal Detail قبل از receipt: `ثبت‌نام: تأیید شده`، `رسید: ارسال نشده` و بدهی `۲٬۵۰۰٬۰۰۰ تومان`.
- receipt اول به‌صورت متن `QA متن رسید اول - پرداخت آزمایشی ۱۴۰۵۰۷۰۸` ارسال شد؛ Portal بلافاصله `فیش شما در حال بررسی است` و `رسید: در انتظار بررسی` نشان داد.
- Admin Finance receipt را با روش `Manual` و متن همان receipt نشان داد؛ فایل لازم نبود.
- receipt اول رد شد؛ Portal پس از refresh heading `اصلاح فیش لازم است`، متن `رسید: رد شده؛ اصلاح لازم است` و کنترل resubmit را نشان داد.
- receipt دوم به‌صورت متن `QA متن رسید دوم - اصلاح شده ۱۴۰۵۰۷۰۸` ارسال شد و دوباره `رسید: در انتظار بررسی` شد.
- receipt دوم در Admin تأیید شد.
- Portal نهایی: `سفر شما نهایی شده است`، `ثبت‌نام: تأیید شده`، `رسید: تأیید شده` و `پرداخت تأیید شد`.
- Admin booking list: همان registration با `تأییدشده` و `وجه دریافت شد`.
- Admin Finance پس از reload: صف receipt خالی و ردیف بدهی/پیگیری حذف شد.
- UI فعلی شناسهٔ receipt را نمایش نداد؛ فقط registration ID و متن receipt در AX قابل ثبت بود. بنابراین receipt ID مستقل: `UNEXPOSED_BY_UI`.

**PASS:** `BUG-STG-039 / 072`، `BUG-STG-PAID-LIST-PROJECTION-AFTER-APPROVE` و `BUG-STG-ADMIN-BOOKING-PROJECTION-AFTER-RECEIPT-APPROVE` برای چرخهٔ متنی pending → rejected → resubmit → approved.

**PASS:** مسیر `BUG-STG-FREE-MANUAL-PENDING-PAYMENT-PATH` نقض نشد؛ free registration مسیر receipt را ارائه نکرد.

### گیت evidence

- registration IDs ثبت‌شده: `87ba6c0a-d0f7-4c96-9090-3e9a09d6d5e5`, `fe517455-25fb-43bc-9d42-4e73f3574d60`, `68930b23-ea43-4e2a-81f8-dd4c3402b127`.
- receipt ID مستقل: در UI/AX نمایش داده نشد؛ `UNEXPOSED_BY_UI`.
- API before/after خام، cache key و Cache-Control در این اجرای browser-only استخراج نشدند؛ این گیت‌ها `UNVERIFIED` باقی می‌مانند.
- screenshot فایل‌دار تولید نشد؛ AX tree قبل/بعد برای Portal، Admin و Finance ثبت شد.
- runtime artifact SHA در این mutation sweep دوباره از host خوانده نشد؛ `UNVERIFIED`.

### وضعیت پس از mutation sweep

- **PASS:** free واقعی، receipt متنی reject/resubmit/approve، projection نهایی Portal/Admin/Finance پس از reload.
- **FAIL:** promotion از Waitlist پس از آزادشدن ظرفیت؛ candidate به‌طور خودکار لغو شد.
- **UNVERIFIED:** receipt ID مستقل، API خام before/after، cache evidence، runtime SHA و raceهای هم‌زمان duplicate/promotion.

### Promotion retry با fixture ظرفیت آزاد

- fixture `QA 2026 Group Capacity 2` ابتدا با registration `0ebde30c-e467-4f2e-960c-a89d64f890e7`، party size `۲` و ظرفیت `۲/۲` پر شد؛ Admin approval دوکلیکی موفق بود.
- candidate واقعی Portal با registration `40a2d04c-6cf5-4ffc-a46b-f3db48aa7904` در ظرفیت پر ثبت شد؛ Portal CTA و copy صریح `ثبت درخواست لیست انتظار` و پیام `درخواست در لیست انتظار ثبت شد` نشان داد.
- ظرفیت fixture برای این تست به‌صورت کنترل‌شده به `۳` افزایش یافت؛ Admin صفحهٔ edit پیام `ذخیره ناموفق بود (خطای سرور)` نشان داد، اما runtime و دیتابیس مقدار `capacityMax=3` را نشان دادند. این رفتار مستقل، یک مورد نیازمند پیگیری برای save/error reporting است و نباید به‌عنوان save تمیز PASS شود.
- Admin Waitlist پس از آزادشدن ظرفیت، همان candidate را با ظرفیت `۲/۳` و action `تأیید` نشان داد.
- promotion با action تأیید اجرا شد؛ toast: `نصر الله تأیید شد. پرداخت هنوز تسویه نشده.` و Waitlist خالی شد.
- Admin بعد از promotion: ظرفیت `۳/۳`، operational list با ۲ نفر.
- Portal detail برای registration `40a2d04c-6cf5-4ffc-a46b-f3db48aa7904`: `ثبت‌نام شما نهایی شده است`، `ثبت‌نام: تأیید شده`، `رسید: لازم نیست`.
- دیتابیس runtime بعد از promotion: candidate `status=approved`, `payment_status=paid`, `finalization_status=finalized`؛ occupant قبلی `status=approved`, `payment_status=unpaid`, `finalization_status=not_final`.

**PASS قطعی:** `BUG-STG-063` برای promotion واقعیِ candidate وقتی ظرفیت آزاد است؛ `BUG-STG-062 / 047` و `BUG-STG-WAITLIST-GUEST-FORM-COPY` برای CTA/copy مسیر Portal Waitlist؛ و همگامی Waitlist → Portal Detail → Admin operational در این fixture.

**FAIL جداگانه باقی‌مانده:** مسیر آزادشدن ظرفیت با `لغو رزرو` در fixture قبلی، candidate Waitlist را خودکار `لغوشده` کرد؛ این با promotion کنترل‌شدهٔ بالا یکی نیست و برای `BUG-STG-064 / 065` به‌عنوان transition از cancel هنوز failure ثبت می‌شود.

**UNVERIFIED:** race هم‌زمان promotion/duplicate، API خام before/after، cache key/headers، runtime SHA و receipt ID مستقل.

### تکمیل شناسه‌های receipt از دیتابیس runtime

پس از پایان UI sweep، شناسه‌های مستقل receipt از جدول runtime با join به payment و همان `registrationId` تطبیق داده شدند:

- receipt اول: `369b9b3c-ddea-45e4-ab4c-0d701aca46d5` — `Rejected` — note: `QA متن رسید اول - پرداخت آزمایشی ۱۴۰۵۰۷۰۸`
- receipt دوم: `88ca1954-d8c4-4327-8586-3c6405bdd85a` — `Approved` — note: `QA متن رسید دوم - اصلاح شده ۱۴۰۵۰۷۰۸`
- هر دو به payment و registration `68930b23-ea43-4e2a-81f8-dd4c3402b127` متصل بودند؛ payment نهایی `Paid` است.

این بخش، شکاف `receipt ID مستقل` را می‌بندد؛ API خام before/after، cache evidence و runtime SHA همچنان جداگانه استخراج نشده‌اند.

### اجرای قطعی سناریوهای باقی‌مانده — 2026-09-29

#### لغو، آزادشدن ظرفیت و promotion

- fixture: `QA 2026 Group Capacity 2`, ظرفیت قبل از mutation `۳/۳`.
- booking لغوشده: `0ebde30c-e467-4f2e-960c-a89d64f890e7`، party size `۲`.
- candidate Waitlist: `QA Cancel Waitlist Candidate 20260929`، شناسهٔ نمایشی `d252…6606`.
- بعد از تأیید لغو در Admin و reload:
  - booking اصلی `لغوشده` شد؛
  - ظرفیت به `۲/۳` رسید؛
  - candidate از Waitlist به `تأییدشده` منتقل شد؛
  - شمارندهٔ Waitlist به `۰` رسید؛
  - candidate در لیست Admin با ظرفیت `۲/۳` باقی ماند.

**PASS قطعی:** `BUG-STG-064 / 065` در سناریوی لغو و آزادشدن ظرفیت، و promotion واقعی candidate. این نتیجه جایگزین failure قبلی همان مسیر در fixture قدیمی است؛ آن failure تاریخی باید برای ریشه‌یابی جداگانه باقی بماند، اما در fixture جدید قابل تکرار نشد.

#### قیمت چندنفرهٔ عضو/مهمان

- fixture: `31139b4a-f65b-4ef7-b727-42283294faa5`.
- عضو: base `۲٬۵۰۰٬۰۰۰`، تخفیف `۵۰٪`، payable `۱٬۲۵۰٬۰۰۰`.
- مهمان `QA Guest Pricing 20260929`: base/payable `۲٬۵۰۰٬۰۰۰`.
- مجموع قبل و بعد از submit: `۳٬۷۵۰٬۰۰۰`.
- Admin detail مهمان همان invoice `۲٬۵۰۰٬۰۰۰` و balance `۲٬۵۰۰٬۰۰۰` را نشان داد.

**PASS جزئی:** بخش مستقل‌بودن تخفیف عضو و مهمان در `BUG-STG-022`؛ حمل، dong و submit چند participant با transport متفاوت هنوز اجرا نشده است.

#### Exposure و redaction

- fixture: `c1491f02-6f80-4a6f-a4e8-f352a21fcc16`.
- سه exposure خاموش و سپس restore شدند: پرداخت، حمل‌ونقل و location-zones؛ UI بعد از restore به `۱۲/۱۲` برگشت.
- PDP در حالت خاموش: قیمت، payment، transport، dong و location-zones در متن DOM دیده نشدند.
- JSON-LD در همان حالت: `price`، `priceCurrency`، `dongAmount`، `transportCostAmount`، `paymentCollection` و `locationZones` دیده نشدند.
- PLP در همان اجرای toggle همچنان قیمت/حمل نشان داد؛ بنابراین redaction در همهٔ سطح‌ها یکسان اثبات نشد.

**PASS محدود / FAIL closure:** `BUG-STG-019 / 036` برای PDP و JSON-LD؛ closure کامل API، PLP و AX هنوز تأیید نشده و PLP فعلاً failure قابل پیگیری دارد.

#### Waitlist state و copy

- fixture ظرفیت‌پر `a60e26da-9007-4706-980d-808b65e5461f`.
- Portal فرم مهمان CTA `ثبت درخواست لیست انتظار`، متن انتقال به صف و نتیجهٔ موفق waitlisted را نشان داد.
- Admin row همان candidate را با label `در لیست انتظار` نشان داد.
- در session عضوِ دارای registration قبلی، PDP به‌جای CTA عمومی Waitlist، state شخصی `مشاهده ثبت‌نام من` داشت؛ مقایسهٔ PLP/PDP با session مستقل و بدون registration هنوز ثبت نشده است.

**PASS:** copy و label مسیر Waitlist (`BUG-STG-062 / 047`, `BUG-STG-WAITLIST-GUEST-FORM-COPY`).
**UNVERIFIED:** `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` برای session مستقل؛ با session فعلی state شخصی بود و closure عمومی ثابت نشد.

#### شمارندهٔ عملیاتی و ظرفیت

- Admin برای fixture گروهی badge `لیست عملیاتی ۲` و دقیقاً ۲ ردیف نشان داد؛ API `total` خام هم‌زمان استخراج نشد.
- تغییر ظرفیت از `۳` به `۴` در Admin toast `ذخیره ناموفق بود (خطای سرور)` داد و بعد از reload مقدار به `۳/۳` برگشت.

**PASS UI smoke / UNVERIFIED closure:** `BUG-STG-037` تا تطبیق API total با badge و rowها کامل نشده است.
**FAIL قطعی مستقل:** مسیر save ظرفیت و گزارش خطا/پایداری مقدار؛ نتیجهٔ UI و مقدار پایدار backend یکسان نیستند.

#### duplicate هم‌زمان

- تست‌های source duplicate و contract سبز شدند؛ تست HTTP race به‌دلیل نبود `DATABASE_URL` و `DATABASE_URL_ADMIN` اجرا نشد.
- submit هم‌زمان واقعی Browser با انتظار دقیق `۲۰۱/۴۰۹` اجرا نشد.

**UNVERIFIED:** `BUG-STG-021`؛ source pass به‌تنهایی closure نیست.

#### گیت‌های مشترک این sweep

- source tests: Portal `۱۴/۱۴`، workspace Denali `۲۲/۲۲`، API focused `۳۸/۳۸`؛ مجموع `۷۴` تست سبز.
- `TODO-007` race تست source به‌دلیل نبود database skip شد.
- پاسخ HTTP عمومی `denali.shenski.com/tours`: `200`، `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` و `x-cache: BYPASS`.
- runtime artifact SHA، API خام before/after، cache key/revalidation داخلی، screenshot فایل‌دار و AX کامل همهٔ سطح‌ها در این sweep استخراج نشدند؛ این موارد `UNVERIFIED` هستند.

### ادامهٔ browser sweep — Exposure سطح PLP و duplicate — 2026-09-29

#### Exposure واقعی روی PLP

- سطح `public_list` در Admin به‌صورت سفارشی ذخیره شد و سه فیلد `تور پولی`، `نحوه حمل‌ونقل` و `نقطه شروع ناحیه‌های شروع، قله، اردوگاه و پایان مسیر.` خاموش شدند.
- بعد از ذخیره، PLP برای fixture `c1491f02-6f80-4a6f-a4e8-f352a21fcc16` قیمت و حمل را نشان نداد؛ کارت فقط اطلاعات غیرمالی و ظرفیت مشتق را نشان داد.
- تنظیم `public_list` به حالت اولیهٔ `نمایش پیش‌فرض` برگشت و پیام `نمایش سطح ذخیره شد` ثبت شد.

**PASS browser:** `BUG-STG-019 / 036` برای PLP در صورت اعمال toggle درستِ `public_list`. مشاهدهٔ قبلی قیمت در PLP ناشی از خاموش‌کردن فقط `public_details` بود؛ سطح‌ها مستقل‌اند.

#### duplicate Browser

- تلاش مستقیم از فرم Portal برای submit دوم با همان مهمان به‌دلیل خالی‌ماندن مقدار input تلفن در automation به submit معتبر نرسید؛ پاسخ duplicate API ثبت نشد.
- تلاش برای دو POST هم‌زمان از evaluate صفحه به‌دلیل محدودیت realm ابزار (`fetch` در evaluate در دسترس نبود) اجرا نشد.

**UNVERIFIED:** `BUG-STG-021`؛ هنوز مدرک معتبر `۲۰۱/۴۰۹` از دو submit واقعی هم‌زمان نداریم.

#### transport/dong چندنفره

- فرم shared-cars برای سه مهمان باز شد و preview مستقل `۲٬۵۰۰٬۰۰۰` برای هر participant و جمع `۷٬۵۰۰٬۰۰۰` را نشان داد.
- submit نهایی به‌دلیل ناتوانی automation در نگه‌داشتن مقدار phone مهمان تکمیل نشد؛ transport/dong نهایی و response submit هنوز ثبت نشده است.

**UNVERIFIED:** بخش transport/dong در `BUG-STG-022`.

### browser sweep تکمیلی — duplicate، ظرفیت عملیاتی و transport/dong — 2026-09-29

#### duplicate مهمان در Browser

- fixture تور رایگان: `de32096c-4b02-405f-9bc8-31e906e89838`.
- مهمان اولِ موجود: `QA Duplicate Browser 20260929`، registration کوتاه‌شدهٔ `fc40…2824`.
- submit دوم با همان شمارهٔ `09125556666` و نام متفاوت انجام شد.
- Portal پیام `قبلاً برای این تور ثبت‌نام کرده‌اید` را نشان داد.
- Admin بعد از submit فقط `۲ کل` داشت: یک ردیف خودِ عضو و یک ردیف همان مهمان؛ رکورد دوم ساخته نشد.

**PASS browser:** duplicate guest در مسیر واقعی UI رد شد و duplicate record ساخته نشد. کد HTTP داخلی 409 از UI قابل مشاهده نیست، بنابراین assertion دقیق `201/409` همچنان source/API evidence است، نه browser-network evidence.

#### ذخیرهٔ ظرفیت و پایداری مقدار

- fixture: `a60e26da-9007-4706-980d-808b65e5461f`.
- مقدار ظرفیت در Admin از `۳` به `۵` تغییر داده شد.
- پس از reload، فیلد ظرفیت `۵` و header ظرفیت `۲/۵` را نشان داد.
- تست source policy نیز `capacity increase is allowed` را سبز کرد.

**PASS browser/source:** خطای قبلی save ظرفیت در اجرای تکراری قابل بازتولید نشد؛ نتیجهٔ پایدار UI و مقدار ذخیره‌شده همسان بود. failure تاریخی `۳→۴` به‌عنوان non-reproducible retained می‌ماند و بدون network payload/response علت قطعی برای آن ثبت نمی‌شود.

#### لیست عملیاتی و شمارنده

- همان fixture گروهی پس از promotion: badge `لیست عملیاتی ۲` و دقیقاً ۲ ردیف قابل مشاهده.
- هر دو ردیف با state `نهایی`، transport label و payment label مستقل نمایش داده شدند.
- header ظرفیت `۲/۵` و summaryهای `نیازمند بررسی ۰`، `منتظر پرداخت ۰` و `نهایی‌شده برای حضور ۲` با UI هم‌خوان بودند.

**PASS UI:** `BUG-STG-037` در سطح badge/visible rows/summary. API raw `total` هنوز از network ثبت نشده است؛ closure backend-total همچنان `UNVERIFIED` است.

#### submit واقعی چندنفره با shared cars و dong

- fixture: `99c917a2-769f-499d-a59f-5c9ae1874aeb`.
- سه participant با transport `بدون ماشین — دونگ` و گزینهٔ `بله، دونگ می‌دهم` ثبت شدند.
- preview قبل از submit: قیمت پایهٔ هر participant `۲٬۵۰۰٬۰۰۰` و جمع پس از dong `۷٬۷۴۰٬۰۰۰` تومان.
- submit Portal موفق شد و صفحهٔ `درخواست ثبت شد` نمایش داده شد.
- Admin سه registration مستقل را نشان داد؛ دو مهمان با target `دیگری`.
- Admin detail مهمان: حمل `بدون ماشین — دونگ`، جمع invoice `۲٬۵۸۰٬۰۰۰` تومان، بدهی `۲٬۵۸۰٬۰۰۰` تومان.

**PASS جزئی/واقعی:** `BUG-STG-022` برای submit چندنفره و dong amount. تفاوت preview سه‌نفره با invoice تک‌نفره به‌علت نمایش invoice مستقل برای هر registration است و با قرارداد پرداخت جداگانه سازگار است؛ transport سازمانی و دو transport متفاوت هنوز جداگانه اجرا نشده‌اند.

#### source gate تکمیلی

- workspace Denali focused: `27/27` سبز؛ شامل exposure، pricing و mutation policy.
- Portal focused: `24/24` سبز.
- API focused: `40/40` سبز.
- مجموع اجرای این نوبت: `91/91` سبز.

**باقی‌ماندهٔ مستنداتی، نه failure جدید:** runtime artifact SHA، raw API before/after و network-level cache key/revalidation هنوز قابل استخراج از staging نیست؛ این‌ها برای closure release gate باید جداگانه از deployment/runtime ثبت شوند.

#### بررسی مستقیم PDP ظرفیت‌پر

- fixture: `0ae44e0f-7ce7-4bf3-aa18-662be4aa2af8`.
- PDP در session فعلی مقدار `۰ جای خالی` و لینک صریح `عضویت در لیست انتظار` را نشان داد.
- همان صفحه روش پرداخت و CTA ثبت‌نام عادی را به‌عنوان action اصلی نشان نداد.

**PASS PDP:** `BUG-STG-062 / 047` و بخش PDP از `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC`. مقایسهٔ raw PLP response با raw PDP response و session کاملاً مستقل همچنان به network/auth evidence نیاز دارد.

### source و browser ادامهٔ sweep — operational roster و organized transport — 2026-09-29

- Web operational roster و command-center: `34/34` سبز.
- API operational roster contract/projection: `15/15` سبز؛ تست `countOnly` صراحتاً total فیلترشده را مستقل از page size تأیید کرد.
- fixture organized transport: `967f3bf6-2479-4dea-bd48-d5393442f301`.
- PDP نوع حمل را `اتوبوس · خودرو شخصی` و در بخش logistics مقدار `اتوبوس`/`خودرو شخصی: امکان‌پذیر` نشان داد.
- Preview ثبت‌نام مبلغ پایهٔ `۲٬۵۰۰٬۰۰۰` تومان را نشان داد؛ در fixture فعلی `transportCostAmount` قابل‌نمایش مقدار نداشت، بنابراین amount حمل سازمانی از این fixture قابل اثبات نیست.

**PASS source/UI:** `BUG-STG-037` در قرارداد و countOnly؛ نوع حمل سازمانی در PDP.
**UNVERIFIED:** مبلغ حمل سازمانی با fixture‌ای که مقدار `transportCostAmount` غیر-null داشته باشد؛ این کمبود fixture است، نه failure اثبات‌شدهٔ formatter.

### تصحیح browser organized transport بعد از ثبت مبلغ — 2026-09-29

- همان fixture `967f3bf6-2479-4dea-bd48-d5393442f301` در Admin با مقدار `transportCostAmount=120000` ذخیره شد؛ پس از reload مقدار `۱۲۰٬۰۰۰` در Admin باقی ماند.
- PDP پس از ذخیره و reload همچنان فقط `اتوبوس · خودرو شخصی` و logistics نوع `اتوبوس` را نشان داد و مقدار `۱۲۰٬۰۰۰` را نمایش نداد.
- source فعلی resolver مشترک `resolveCatalogTransportCostAmount` و render `detail.logistics.transportCost` را دارد و تست‌های transport/detail با نتیجهٔ `19/19` سبز شدند.

**FAIL staging behavior:** `BUG-STG-082` برای نمایش مبلغ حمل سازمانی در PDP هنوز در runtime مشاهده شد.
**SOURCE PASS / DEPLOYMENT UNVERIFIED:** این failure با source فعلی سازگار نیست؛ runtime artifact SHA از staging در دسترس نیست، بنابراین علت محتمل artifact قدیمی است اما بدون SHA قطعی اعلام نمی‌شود. closure فقط بعد از deploy همین HEAD و تکرار browser قابل قبول است.

### تأیید API BFF و regression source — 2026-09-29

- درخواست مستقیم `GET https://denali.shenski.com/api/catalog/967f3bf6-2479-4dea-bd48-d5393442f301` با `200` پاسخ داد.
- در response عمومی، `transport` فقط `{mode: "bus", allowPersonalCar: true}` بود و `transportCostAmount` وجود نداشت؛ بنابراین PDP نمی‌توانست مبلغ `۱۲۰٬۰۰۰` را نمایش دهد.
- regression جدید `BUG-STG-082` برای تبدیل canonical string `transport.transportCost="120000"` به `transportCostAmount=120000` اضافه شد و تست Denali card/exposure با `17/17` سبز شد.

**نتیجه:** source contract و egress mapper در HEAD درست و تست‌شده‌اند؛ failure فعلی در staging در سطح API response باقی است. تا deploy همین HEAD و مشاهدهٔ `transportCostAmount: 120000` در BFF، این مورد بسته نیست.

### تفکیک branch و runtime برای organized transport — 2026-09-29

- `origin/dev` روی `2eaf701eed9ddf29ca095cbe4ad88a9eca10a55e` است؛ branch کاری روی `11c7d6bc66a52a78b9c45ef04b874985ae9bf876` است.
- workflow استقرار staging فقط از `dev` deploy می‌کند؛ بنابراین تست staging فعلی نمی‌تواند صحت HEAD branch کاری را اثبات کند.
- source مربوط به reader، mapper و PDP در `origin/dev` نیز وجود دارد؛ پس صرفاً «کمبود فایل frontend» علت کافی نیست.
- local API روی HEAD بدون خطای build بالا آمد و focused source tests سبز ماندند، اما fixture organized transport در seed محلی وجود نداشت؛ browser local برای همان مقدار عددی قابل اجرا نبود.

**گیت باقی‌مانده:** merge/deploy به `dev`، ثبت runtime SHA، سپس تکرار `GET /api/catalog/<tourId>` و PDP. انتظار دقیق: `transport.transportCostAmount=120000` در BFF و نمایش `۱۲۰٬۰۰۰ تومان` در PDP.

### ریشه‌یابی قطعی organized transport — 2026-09-29

- با دسترسی read-only به PostgreSQL staging، ردیف fixture `967f3bf6-2479-4dea-bd48-d5393442f301` بررسی شد.
- canonical واقعی این ردیف مقدار را با کلید legacy `data.transport.transportCostAmount=150000` نگه داشته است؛ کلید فعلی wizard یعنی `data.transport.transportCost` در این ردیف وجود ندارد.
- reader عمومی فقط `transport.transportCost` را می‌خواند؛ بنابراین Admin مقدار را دارد اما BFF/PLP/PDP مبلغ را از دست می‌دهند.
- اصلاح محدود در `readDenaliCatalogTransportSnapshot` انجام شد: مسیر فعلی اولویت دارد و سپس برای داده‌های persisted قدیمی از `transport.transportCostAmount` fallback می‌گیرد.
- منطق ثبت‌نام ادمین نیز همین fallback را می‌خواند تا quote با catalog ناسازگار نشود.
- تست regression جدید برای دادهٔ legacy اضافه شد؛ Denali card/exposure: `18/18` سبز.

**نتیجهٔ فعلی:** علت کدی و داده‌ای قطعی شد و source fix آماده است؛ staging هنوز با artifact قبل از این patch سرو می‌شود، بنابراین browser closure و PASS نهایی بعد از deploy همین تغییر باقی است.

### Closure browser برای organized transport — 2026-09-29

- PR fix در `dev` merge شد و staging workflow `36599959571` با build و deploy سبز اجرا شد.
- runtime staging روی release SHA `313b1f3c9c48803b071887443f76b893bf2f8d8f` قرار گرفت؛ build timestamp: `2026-09-29T16:54:49Z`.
- BFF همان fixture پاسخ `200` داد و `transportCostAmount=150000` را برگرداند.
- PDP همان fixture در facts و logistics مقدار `۱۵۰٬۰۰۰ تومان` را نشان داد.
- PLP همان fixture نیز `خودرو: ۱۵۰٬۰۰۰ تومان` را نشان داد.
- shared-car fixture همچنان `دونگی: ۸۰٬۰۰۰ تومان` را در PLP/PDP نشان داد.

**PASS قطعی:** `BUG-STG-082` برای organized transport legacy data و shared-car dong در API، PLP و PDP.

### Retest واقعی Waitlist و promotion پس از آزادشدن ظرفیت — 2026-09-29

- fixture: `QA 2026 Waitlist Capacity 1` (`0ae44e0f-7ce7-4bf3-aa18-662be4aa2af8`).
- registration `646f8548-4120-4517-ac2f-cef9ad25c0a0` با Portal در ظرفیت پر ساخته شد و Portal List/Detail و Admin آن را `waitlisted` نشان دادند.
- occupant قبلی لغو شد؛ candidate بدون ازبین‌رفتن رکورد به `approved` منتقل شد و Portal Detail state، deadline و بدهی واقعی را نشان داد.
- دو مهمان دیگر به‌عنوان دو registration مستقل ساخته شدند: `7c518074-e340-4d1f-8fa8-fc73b751c106` و `1ae8f869-a670-4212-b800-19b36a6bf2c7`.
- با لغو occupant `646f8548-4120-4517-ac2f-cef9ad25c0a0`، فقط candidate اول (`7c518074-e340-4d1f-8fa8-fc73b751c106`) promotion شد و candidate دوم (`1ae8f869-a670-4212-b800-19b36a6bf2c7`) در Waitlist باقی ماند؛ ظرفیت بیش از حد مصرف نشد.
- Portal برای candidate promoted، `ثبت‌نام: تأیید شده`، `رسید: ارسال نشده` و CTA/مبلغ پرداخت را مستقل نشان داد؛ candidate باقی‌مانده همچنان `در لیست انتظار` است.

**PASS واقعی:** `BUG-STG-064 / 065` برای transition و feedback promotion یک‌نفره؛ `BUG-STG-WAITLIST-PDP-STATE-NONDETERMINISTIC` و `BUG-STG-WAITLIST-TRANSPORT-STATUS-LABEL` نیز در همین fixture هم‌state بودند.
**UNVERIFIED باقی‌مانده:** promotion یک رکورد با `partySize>1`؛ فرم Portal اینجا دو مهمان را به دو registration مستقل تبدیل کرد.

### بررسی سناریوی «تأیید، منتظر پرداخت، سپس نهایی‌سازی» — 2026-09-29

- fixture: `QA 2026 Waitlist Capacity 1` (`0ae44e0f-7ce7-4bf3-aa18-662be4aa2af8`).
- registration: `7c518074-e340-4d1f-8fa8-fc73b751c106`.
- Portal detail: `ثبت‌نام شما تأیید شده است`، `برای نهایی شدن سفر، پرداخت را تکمیل کنید`، `رسید: ارسال نشده`، deadline و مبلغ بدهی نمایش داده شد؛ upload receipt/text note در دسترس بود.
- Admin bookings: `تأییدشده` + `پرداخت‌نشده (رزرو)` + `پیگیری پرداخت` و deadline نمایش داده شد.
- Admin operational roster: ردیف `تأییدشده` و لینک `پیگیری پرداخت` داشت؛ دکمه `افزودن به فهرست نهایی` برای ردیف بدهکار نمایش داده نشد.
- source confirms the guard: `tour-workspace-transport-client.tsx` only renders finalization when `!paymentRequired`; otherwise only `followPayment` is rendered.

**PASS:** مسیر تأیید ادمین و پرداخت بعدی وجود دارد و از نظر Portal/Admin قابل فهم است.

**UX/product gap:** اگر منظور محصول این است که ادمین بتواند فردِ تأییدشده اما بدهکار را همین حالا وارد «لیست نهایی» کند و پرداخت را بعداً پیگیری کند، این قابلیت در UI وجود ندارد؛ وضعیت فعلی «تأییدشده» را از «نهایی برای حضور» جدا می‌کند و final roster را تا تسویه مسدود می‌کند. دکمه `تأیید بدون نیاز به پرداخت` نیز معادل این سناریو نیست؛ آن مسیر بدهی را صفر و پرداخت را waive می‌کند. تصمیم لازم: `نهایی برای حضور با بدهی باز` مجاز باشد یا همین قرارداد فعلی حفظ شود.

**تصحیح قرارداد موردنظر کاربر:** سناریوی مطلوب دو تأیید مستقل دارد: `تأیید اولیه → منتظر پرداخت → تأیید نهایی حضور`؛ در لحظهٔ تأیید نهایی، `paymentStatus=unpaid` باقی می‌ماند و بدهی همچنان قابل پیگیری است. این سناریو در قرارداد فعلی پیاده نشده است: API `finalizeBooking` صراحتاً فقط `paymentStatus=paid` را می‌پذیرد و برای unpaid خطای `BookingFinalizationRequiresSettlementError` می‌دهد؛ UI نیز دکمهٔ نهایی‌سازی را برای `paymentRequired` مخفی می‌کند.

### Gap و side-effect audit برای «تأیید نهایی با پرداخت باز» — 2026-09-29

**Gapهای قطعی source:**

- API و هر دو repository حافظه/Postgres نهایی‌سازی را به `paymentStatus=paid` قفل کرده‌اند.
- UI برای unpaid به‌جای finalization فقط `پیگیری پرداخت` را نشان می‌دهد.
- خطای API نیز قرارداد فعلی را «پرداخت یا waive قبل از لیست نهایی» اعلام می‌کند.
- Portal فقط payment/receipt را برای finality مصرف می‌کند و state جدید `finalized + unpaid` ندارد.

**Side effectهایی که قبل از پیاده‌سازی باید قرارداد داشته باشند:**

- ظرفیت و Waitlist: فرد نهایی‌شدهٔ بدهکار باید صندلی را نگه دارد و دوباره promote نشود.
- Portal و Admin: نهایی‌شدن حضور و وضعیت پرداخت باید دو label مستقل داشته باشند.
- Finance: بدهی، deadline، CTA پرداخت و receipt باید بعد از finalization باقی بمانند.
- Excel/final roster: فرد باید در لیست نهایی باشد و هم‌زمان در شیت بدهکاران بماند.
- پرداخت بعدی: تبدیل `finalized + unpaid → finalized + paid` باید finalization را حفظ کند و idempotent باشد.
- لغو: آزادسازی ظرفیت، refund (در صورت پرداخت جزئی/کامل) و promotion باید با finalization جدید سازگار شود.
- حمل و settlement: ورود به roster عملیاتی نباید قبل از پرداخت باعث تسویه راننده یا settlement اشتباه شود.
- permission/audit/notification/cache: اکشن جدید باید actor، زمان، event، invalidation و refresh همهٔ projectionها را ثبت کند.

**نتیجه:** این تغییر یک feature/state-contract جدید است؛ patch صرفاً روی دکمه یا شرط UI کافی نیست.

## 2026-10-03 — current deployment Excel artifact closure

- Deployment evidence: workflow run `37126024379`, release SHA `e42ece7072a7125eec178a98d8afb68ef2c70029`, `INSTALL_ARTIFACT_OK` recorded in the deploy log, and `STAGING_ARTIFACT_DIGEST=3fb8c5ba9de3f1c605d2d6b3eb27ff4489eca1196a74ceccdc3aa072e9c38006`; the `current` symlink points to the same release.
- Runtime: authenticated read-only export from `https://admin.denali.shenski.com/tours/31139b4a-f65b-4ef7-b727-42283294faa5/workspace?tab=transport`, tour `QA 2026 Member Discount` (`31139b4a-f65b-4ef7-b727-42283294faa5`).
- Downloaded artifact: `denali-final-roster-20261003193624.xlsx`, SHA-256 `4983E09FCFBD29A93353A8B2D1B6B65F7CF6C0ED6D0A78C97449399AE7B5C881`.
- Workbook read-only parse: five sheets were present — `خلاصه گزارش`, `لیست نهایی`, `منتظر پرداخت`, `پرداخت‌شده`, and `بدون دریافت وجه`; no browser console errors were observed.
- `BUG-STG-EXPORT-SUMMARY`: **PASS**. Summary reported `۳` finalized, `۳` paid, `۰` without payment, `۱` debtor/partial, finalized total `۷٬۵۰۰٬۰۰۰ تومان`, finalized paid `۷٬۵۰۰٬۰۰۰ تومان`, finalized remaining `۰ تومان`, and outstanding remaining `۱٬۲۵۰٬۰۰۰ تومان`.
- `BUG-STG-014`: **PASS**. Exported monetary values use `تومان`; no raw `ریال` value was present.
- `BUG-STG-015`: **PASS**. `نوع حمل‌ونقل` exists in the final and payment sheets and contains `حمل سازمان‌یافته`.
- `BUG-STG-016`: **PASS**. `تاریخ نهایی‌شدن` exists; finalized rows contain timestamps and the pending row contains `—`.
- Excel evidence gate for the current deployment: **PASS**. Together with the recorded deployment, cache/exposure/edge-stability and end-to-end payment/finalization passes, this removes the last stated gate; no claim is made for unrelated scenarios outside that stated scope.

## 2026-10-04 — staging deployment after dev merge

- Deployment workflow: `Deploy staging (dev)`, run `37183307399`, head/release SHA `3c09a4f734261f75960cfbf3ea5be0fb9e99c5f7`.
- Artifact verification: `INSTALL_ARTIFACT_OK sha=3c09a4f734261f75960cfbf3ea5be0fb9e99c5f7`.
- Artifact digest: `801ed4e80d5d456b1abd6175145bde841bdcc5f73728817d8002ad683c44d7aa`.
- Migration head: `20260923120000_payment_gated_finalization`.
- Deploy verification: transfer/install/migrate/seed, four-process health, RLS remote gate, and workspace staging adapter all **PASS**.
- Process smoke: API, Web, Marketing, and Portal each returned HTTP `200`; `SMOKE_FOUR_PROCESS_OK` and `P10_REMOTE_GATE_OK` were recorded.
- This deployment is the runtime baseline for the next PLP/PDP and Portal/Admin retests; runtime bug closure remains scoped to scenarios actually rechecked on this SHA.

## 2026-10-04 — runtime retest on `3c09a4f734261f75960cfbf3ea5be0fb9e99c5f7`

- Public Marketing URL: `https://denali.shenski.com/tours`.
- `BUG-STG-082` fixture: `QA 2026 Shared Cars Dong` (`99c917a2-769f-499d-a59f-5c9ae1874aeb`).
- PLP result: card displayed `دونگی: ۸۰٬۰۰۰ تومان` and `حمل‌ونقل: خودروهای مشترک`.
- PDP result: displayed `حمل‌ونقل: خودروهای مشترک`, but no dong label or monetary amount was rendered in the server-rendered page text.
- `BUG-STG-082`: **FAIL** on this deployed SHA; PLP/PDP transport ancillary parity is still broken. No closure or FINAL PASS is issued.
- Separate runtime observation: the HTTPS PLP requested signed MinIO images over HTTP and the browser blocked them as mixed content. This is recorded separately from the dong parity failure.
