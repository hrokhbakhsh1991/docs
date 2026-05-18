# Denali Finance Pilot — فهرست و بک‌لاگ مسائل

**اجرای عملیاتی (فازبندی دقیق):** → [`map-phase.md`](./map-phase.md) — **فاز ۷ تا ۱۲** رفع مسائل زیر  
**لاگ پیشرفت:** [`map.log`](./map.log)  
**Runbook:** [`docs/60-operations/denali-finance-runbook.md`](./docs/60-operations/denali-finance-runbook.md)

| # | مسئله | فاز رفع | اولویت |
|---|--------|---------|--------|
| 1 | بدهی manual بعد از Paid آنلاین | [فاز ۷](./map-phase.md#فاز-۷--یکپارچگی-تسویه-ممنوعیت-بدهی-manual-بعد-از-paid-آنلاین) | P0 |
| 2 | آپلود رسید بدون مالکیت registration | [فاز ۸](./map-phase.md#فاز-۸--مالکیت-آپلود-رسید-authorization--privacy) | P0 |
| 3 | drift Runbook CASL ↔ API | [فاز ۹](./map-phase.md#فاز-۹--هم‌سوسازی-runbook-casl-و-api) | P1 |
| 4 | MinIO غیراتمیک + چند receipt Pending | [فاز ۱۰](./map-phase.md#فاز-۱۰--اتمیک-بودن-storage-رسید--یک-pending-per-payment) | P1 |
| 5 | cache گزارش + شکاف ledger | [فاز ۱۱](./map-phase.md#فاز-۱۱--گزارش‌ها-cache-ledger-و-صداقت-عملیاتی) | P1 |
| 6 | pricing spec TBD / field drift | [فاز ۱۲](./map-phase.md#فاز-۱۲--pricing-spec-هم‌خوانی-محصول-api-و-tracker) | P2 |

**Pilot اصلی (فاز ۰–۶):** [`map-phase.md` بخش A](./map-phase.md#بخش-a--pilot-اصلی-فاز-۰۶)

---

# بک‌لاگ تحلیل (متن اولیه)

> زیر این خط، تحلیل تفصیلی هر مسئله است. برای قدم‌های اجرایی، تست و معیار پذیرش به **فاز متناظر در `map-phase.md`** بروید.

---

## 1. Manual debt بعد از پرداخت آنلاین (double payment / double obligation)

### مسئله
بعد از این‌که یک ثبت‌نام با پرداخت آنلاین به وضعیت Paid رسیده (از طریق webhook)، هنوز هم می‌توان:

یک Manual Pending Payment جدید برای همان registration ایجاد کرد (از طریق ManualPaymentService.createManualPayment).
به‌دلیل این‌که constraint دیتابیس فقط روی Pending است، هیچ چیز مانع Paid + Pending یا حتی دو Paid روی یک registration نیست.
وضعیت فعلی:

DB constraint:
uq_payments_registration_pending روی registration_id WHERE status = 'Pending'
یعنی فقط دو تا Pending همزمان را می‌گیرد، اما:
Paid + Pending مجاز است.
Paid + Paid هم از نظر دیتابیس ممکن است.
App-level guards:
createPaymentIntentWithManager در مسیر آنلاین:
اگر pending موجود باشد → خطای PAYMENT_PENDING_EXISTS.
اما برای manual payment، چنین guard واضحی وجود ندارد.
ManualPaymentService.createManualPayment:
فقط بررسی می‌کند registration موجود باشد و tenant درست باشد؛
وضعیت‌های Paid یا وجود payment قبلی را بررسی نمی‌کند.
ریسک
Financial / operational:
برای یک ثبت‌نام، ممکن است:
یک بار از طریق PSP آنلاین پرداخت شود،
و دوباره با یک manual debt (و receipt)، پول دوباره گرفته شود.
اپراتورهای finance ممکن است متوجه نشوند که registration قبلاً settled شده.
Trust / UX:
کاربر یا لیدر می‌بیند ثبت‌نام AcceptedPaid است، در عین حال یک بدهی manual open دارد؛ گمراه‌کننده است.
Accounting:
ledger (که همین الان هم برای آنلاین Paid کامل نیست) ممکن است حتی بیشتر از واقعیت بدهی نشان بدهد.
محل کد (تقریبی)
ManualPaymentService (مثلاً: apps/api/src/finance/manual-payment.service.ts)
Payment entity و transitions (مثلاً: payments.service.ts / applyPaymentStatus)
DB migration مربوط به payments (مثلاً: 1777595600000-ManualPaymentsAndReceipts.ts)
پیشنهاد راه‌حل
1. سیاست / rule واضح تعریف شود (با Product)
گزینه‌ی ساده (پیشنهاد قوی برای pilot):
Rule: «اگر یک registration حداقل یک Paid payment موفق دارد، هیچ Payment جدیدی (manual یا online) برای آن نمی‌توان ساخت مگر این‌که explicitly در API با flag allowAdditionalDebt درخواست شود یا route مخصوص “add extra debt” داشته باشد.»
اگر recovery path لازم است (مثلاً online شکست خورده و بعداً manual ایجاد می‌شود):
Rule: فقط وقتی اجازه manual Pending داریم که:
یا هیچ Paid وجود نداشته باشد،
یا فقط Failed/Cancelled payments قبلی وجود داشته باشند.
2. Guard در سطح Service
در ManualPaymentService.createManualPayment:

قبل از insert، کوئری کن:

content_copy
ts

note_add
ویرایش با Canvas
  const existingPayments = await this.paymentsRepository.find({
    where: { registrationId },
  });
این قواعد را enforce کن:
اگر هر payment با status = Paid وجود دارد:
به طور پیش‌فرض reject کن، با error code مثل:
PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN
اگر product تصمیم بگیرد recovery manual بعد از failed آنلاین مجاز است:
فقط اجازه بده وقتی که همه payments در {Failed, Cancelled, Refunded} هستند.
3. شاید DB-level constraint (در آینده)
می‌توان یک partial index/constraint اضافه کرد:

مثلاً: «حداکثر ۱ Paid برای هر registration» یا:
CHECK منطقی که در migration بعدی اعمال شود.
اما چون محصول ممکن است سناریوی multi-part payment بخواهد، اول سیاست محصولی مهم است؛ DB فقط بعد از تصمیم محصول.
تست‌های پیشنهادی
Unit tests (manual-payment.service)
Case 1: registration با یک payment Paid
createManualPayment → باید ConflictException یا error code custom بدهد.
Case 2: فقط Failed payments وجود دارند
اگر rule recovery را مجاز می‌داند → باید manual Pending مجاز شود.
Case 3: Paid + Pending موجود (بالفعل بد)
اگر چنین وضعیتی در DB هست و دوباره createManualPayment صدا زده شود → fail واضح.
E2E (پرداخت آنلاین + manual)
در registrations.e2e-spec.ts یا یک فایل جدید (payments-coexistence.e2e-spec.ts):

ثبت‌نام با requiresPayment:
webhook → Paid
سپس call به POST /finance/payments/manual برای همان registration
انتظار: 4xx (مثلاً 409) با پیام روشن.
سناریوی recovery:
pending آنلاین → webhook Failed
سپس create manual Pending
باید موفق شود و registration path به سمت manual receipt برود.
## 2. Receipt upload not tied to registration owner (authorization / privacy risk)

### مسئله
مسیر:

POST /finance/payments/:id/receipt
الان فقط این‌ها را چک می‌کند:

Role: Member+ (یا Admin/Owner) بر اساس decoratorهای controller.
Capability: @RequireCapability("module.finance").
Tenant: از JWT → RLS روی payment_receipts / payments.
اما بررسی نمی‌کند که:

این payment مربوط به همان کاربر/ثبت‌نام است که درخواست را می‌فرستد؛
یا حتی کاربر عضو همان registration/booking است یا خیر.
یعنی هر user که finance access داشته باشد، می‌تواند برای هر paymentId در workspace این کارها را انجام دهد:

آپلود رسید بانکی (که ممکن است حاوی اطلاعات حساس باشد).
در نتیجه، می‌تواند receipt را روی بدهی متعلق به فرد دیگری attach کند.
ریسک
Privacy:
عکس/اسکرین‌شات تراکنش بانکی یک نفر توسط فرد دیگری آپلود و قابل رؤیت می‌شود.
Integrity:
رسید اشتباه روی بدهی اشتباه؛ بعداً در reconcile اشکال ایجاد می‌کند.
Abuse scenario:
یک finance-member بدخواه می‌تواند عمداً رسید نامعتبر روی پرداخت دیگران آپلود کند تا confusion ایجاد شود.
محل کد (تقریبی)
Controller:
finance-payments.controller.ts (route /finance/payments/:id/receipt)
Service:
receipt.service.ts → متد submitReceipt(paymentId, file, user) (اسم تقریبی)
Ability definitions:
ability.factory.ts (CASL abilities برای FinanceReceipt، اگر باشد یا قرار بوده باشد).
پیشنهاد راه‌حل
1. تعریف policy
Rule پیشنهادی:
فقط این افراد مجاز به upload receipt برای یک payment هستند:
مالک registration (مسافر اصلی / booking owner)
Leader تور مربوطه
Finance Admin/Owner که به صورت explicit اجازه ویرایش بدهی دارد
برای pilot می‌توان ساده‌تر کرد:
«Participant registration + Admin/Owner workspace»
2. Enforcement در service
در ReceiptService.submitReceipt:

یافتن payment + registration:

content_copy
ts

note_add
ویرایش با Canvas
   const payment = await this.paymentsRepository.findOne({
     where: { id: paymentId },
     relations: ['registration', 'registration.participants', 'registration.leader'],
   });
بررسی ownership:

content_copy
ts

note_add
ویرایش با Canvas
   const isRegistrationOwner = payment.registration.userId === currentUser.id;
   const isParticipant = payment.registration.participants.some(p => p.userId === currentUser.id);
   const isLeader = payment.registration.leaderId === currentUser.id;
   const isFinanceAdmin = hasRole(currentUser, ['Owner', 'Admin']); // بر اساس نقش‌ها

   if (!(isRegistrationOwner || isParticipant || isLeader || isFinanceAdmin)) {
     throw new ForbiddenException('NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT');
   }
سپس ادامه‌ی روند upload/storage/save.
3. (اختیاری) CASL abilities را sync کن با runbook
در ability.factory.ts برای subject PaymentReceipt یا Payment:
ruleی مثل:
can('create', 'PaymentReceipt', { registrationId: { in: user.registrationIds } })
سپس در controller:
روی route:
@CheckAbilities(new CreateReceiptAbility())
تست‌های پیشنهادی
Unit (receipt.service)
Case 1: user owner registration:
باید مجاز باشد.
Case 2: user participant فقط:
اگر policy آن را می‌پذیرد → مجاز.
Case 3: user با role Member + finance module، اما هیچ ارتباطی با registration ندارد:
باید 403 بگیرد.
E2E (manual-receipt-flow.e2e-spec.ts توسعه)
سناریویی اضافه کن:
memberA → owner ثبت‌نام
memberB → عضو workspace، ولی participant آن ثبت‌نام نیست
memberB تلاش می‌کند برای payment memberA receipt upload کند:
انتظار: 403 / 401.
memberA دوباره تلاش کند:
انتظار: 201 / 200 موفق.
## 3. Drift بین Runbook (CASL abilities) و API واقعی (roles+capability)

### مسئله
Runbook (denali-finance-runbook.md) ادعا می‌کند:
کنترل‌های CASL سطح FinanceManualPayment / FinanceReceipt اعمال می‌شود.
کد واقعی:
در finance-payments.controller.ts و مشابه:
روی routeها فقط:
@Roles(...)
@RequireCapability('module.finance')
بدون @CheckAbilities برای CASL بر اساس subjectهای تعریف شده.
یعنی:
UI ممکن است CASL abilities را برای نمایش/پنهان کردن دکمه‌ها استفاده کند؛
ولی API آن سطح از محدودیت را enforce نمی‌کند → اگر کسی مستقیم API را call کند، می‌تواند کارهایی بکند که UI به او نشان نداده.
ریسک
Security / Authorization drift:
مستندات/Runbook می‌گویند «فلان نقش اجازه فلان کار را ندارد»، ولی API این را enforce نمی‌کند.
Auditability:
در آینده، هنگام audit یا بازرسی، مستند و اجرا با هم نمی‌خوانند.
محل کد (تقریبی)
Controller:
finance-payments.controller.ts, finance-receipts.controller.ts (اگر جداست)
Abilities:
apps/api/src/auth/ability.factory.ts
Runbook:
docs/60-operations/denali-finance-runbook.md
پیشنهاد راه‌حل
گزینه A — API را با Runbook هم‌سو کن (پیشنهاد اصلی)
در ability.factory.ts:
برای Payment / PaymentReceipt دو subject تعریف کن:
مثلاً:

content_copy
ts

note_add
ویرایش با Canvas
       can('create', 'PaymentReceipt', { tenantId: user.tenantId });
       can('update', 'ManualPayment', { tenantId: user.tenantId, role: { in: ['Owner', 'Admin'] } });
(یا هر منطق دقیق‌تری که Runbook گفته.)
در Controller:

content_copy
ts

note_add
ویرایش با Canvas
   @Post(':id/receipt')
   @CheckAbilities(new CreatePaymentReceiptAbility())
   async uploadReceipt(...) { ... }
و برای manual payment:


content_copy
ts

note_add
ویرایش با Canvas
   @Post('/manual')
   @CheckAbilities(new CreateManualPaymentAbility())
مطمئن شو که UI و API هر دو از یک مدل authorization پیروی می‌کنند.
گزینه B — Runbook را down-grade کن (اگر نمی‌خواهید CASL روی API)
Runbook را به‌روزرسانی کن که:

به‌صورت صریح بگوید:
«در pilot، authorization روی finance routes مبتنی بر Role + module.finance capability است؛ CASL فقط در UI برای نمایش/پنهان کردن اکشن‌ها استفاده می‌شود.»

و explicit ذکر کند که در آینده ممکن است روی API هم enforcement اضافه شود.

تست‌های پیشنهادی
Unit / Integration
تست برای abilities:
AbilityFactory → آیا user با role Member می‌تواند create روی PaymentReceipt داشته باشد یا خیر؟
Controller-level:
درخواست با token نقش‌های مختلف → 403/200 درست است یا نه.
## 4. Non-atomic receipt storage (MinIO) + چندین receipt pending برای یک payment

### مسئله
مسیر upload receipt:

فایل به MinIO (یا adapter دیگری) آپلود می‌شود:
storage.upload(file) → URL / key برمی‌گردد.
سپس row در payment_receipts ذخیره می‌شود.
مشکلات:

عدم اتمیک بودن بین MinIO و DB:
اگر upload موفق شود ولی DB fail کند:
فایل در MinIO می‌ماند (orphan object)، اما هیچ reference در DB نیست.
اگر upload fail کند → DB record ساخته نمی‌شود (اینجا مشکل کوچک‌تر است).
Multiple pending receipts per payment:
در migration:
هیچ unique constraintی مثل:
uq_receipts_payment_pending ندارد.
یعنی:
کاربر/اپراتور می‌تواند چند receipt برای یک payment upload کند،
و سیستم باید somehow بداند کدام را باید approve/reject کند.
در e2e:
از InMemoryFileStorageAdapter استفاده شده؛
هیچ تستی وضعیت failure یا duplicate receipts را پوشش نمی‌دهد.
ریسک
Storage leak:
MinIO پر می‌شود از فایل‌هایی که دیگر reference ندارند؛ مدیریت‌ناپذیر.
Ops confusion:
چند رسیده pending روی یک payment → چه کسی تصمیم می‌گیرد کدام «واقعی» است؟
Edge-case bugs:
approve/reject شاید روی اولی عمل کند ولی دومی را رها کند.
محل کد (تقریبی)
receipt.service.ts:
متد submitReceipt, approveReceipt, rejectReceipt
minio-storage.adapter.ts
Migration:
1777595600000-ManualPaymentsAndReceipts.ts (ساخت جدول payment_receipts)
پیشنهاد راه‌حل
1. حداقل cleanup برای failure
در submitReceipt:

اگر بعد از storage.upload، paymentReceiptRepository.save شکست خورد:

content_copy
ts

note_add
ویرایش با Canvas
  try {
    const objectKey = await storage.upload(file);
    const receipt = this.paymentReceiptRepository.create({
      paymentId,
      objectKey,
      status: 'Pending',
      // ...
    });
    await this.paymentReceiptRepository.save(receipt);
  } catch (err) {
    // Best-effort cleanup
    if (objectKey) {
      await storage.delete(objectKey).catch(() => {/* log, but ignore */});
    }
    throw err;
  }
به این صورت حداقل تعداد orphan objects کم می‌شود.
2. سیاست برای multiple receipts
دو گزینه:

گزینه ساده (پیشنهاد):

Rule: «برای هر payment، در هر لحظه فقط یک receipt در وضعیت Pending مجاز است.»
اگر یک Pending وجود دارد و user دوباره upload کند:
یا:

قبلی را auto-cancel / Superseded کن و جدید را نگه دار؛

یا:

درخواست جدید را رد کن با پیام:

RECEIPT_ALREADY_PENDING_FOR_PAYMENT.

Option advanced:

اجازه چند receipt:
ولی UI/ops باید یک UX واضح برای انتخاب داشته باشد.

این برای pilot نیاز نیست و پیچیدگی اضافه می‌کند.

برای گزینه ساده:

DB constraint اضافه کن:

content_copy
sql

note_add
ویرایش با Canvas
  CREATE UNIQUE INDEX uq_payment_receipts_payment_pending
  ON payment_receipts(payment_id)
  WHERE status = 'Pending';
در service قبل از save چک کن:

content_copy
ts

note_add
ویرایش با Canvas
  const existingPending = await this.receiptRepo.findOne({
    where: { paymentId, status: 'Pending' },
  });

  if (existingPending) {
    throw new ConflictException('RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT');
  }
3. Logging برای orphan cleanup
در runbook:
یک بخش «MinIO orphans» اضافه کن:
مثلاً: job periodی که objectهایی را که در DB reference ندارند پاک کند (اگر نیاز شد).
تست‌های پیشنهادی
Unit (receipt.service)
Failure after upload:
mock storage.upload → success,
mock receiptRepo.save → throw,
انتظار: storage.delete یک‌بار فراخوانی شود.
Duplicate pending:
payment با یک receipt Pending،
submitReceipt دوم → باید 409 Conflict بدهد (بر اساس policy).
E2E
آپلود دو receipt برای یک payment:
اولی: 201
دومی: 409 (یا رفتار تعریف‌شده).
## 5. Reports summary cache vs real-time state + ledger gaps

### مسئله
Summary reports از Redis cache با TTL حدود ۳۰ ثانیه استفاده می‌کنند:
finance-reports.service.ts:
getSummary() → ابتدا از cache می‌خواند.
Cache invalidation:
فقط روی manual create + receipt approve انجام می‌شود.
Online payment webhook (Paid یا Failed) یا job timeout:
invalidateSummaryCache را صدا نمی‌زنند.
Ledger events:
ledger-events endpoint:
online Paid را کامل reflect نمی‌کند (Phase 4 هم اشاره کرده).
manual approve هم finance.ledger.* را emit نمی‌کند.
ریسک
Ops dashboard mismatch:
بعد از پرداخت آنلاین موفق، تا ۳۰ ثانیه، داشبورد می‌تواند هنوز «pending» را نشان دهد.
بعد از fail/reject هم همین.
Misleading finance view:
گزارش‌هایی که روی summary/ledger متکی‌اند، در لحظه‌ی تصمیم‌گیری دقیق نیستند.
محل کد (تقریبی)
finance-reports.service.ts
متدهای getSummary, invalidateSummaryCache
payments.service.ts
applyPaymentStatus, processWebhook یا مشابه
Outbox / ledger:
outboxService.addEvent(...) برای payment.succeeded / payment.failed
Double-entry ledger projector (Phase 4 اشاره کرده Online Paid هنوز ledger journals ندارد).
پیشنهاد راه‌حل
1. Cache invalidation را کامل کن
در payments.service.ts یا جایی که webhook status را نهایی می‌کند:

بعد از هر تغییر پرداخت که settlement را عوض می‌کند:

content_copy
ts

note_add
ویرایش با Canvas
  await this.financeReportsService.invalidateSummaryCache(tenantId);
مخصوصاً در مسیرهای:
Paid آنلاین (webhook success)
Failed / Timeout
Refund (admin API)
بهتر است این را در یک سطح central بگذاری (مثلاً در همان متدی که applyPaymentStatus صدا زده می‌شود).

2. Runbook: limitationها را شفاف بنویس
در denali-finance-runbook.md:

بخشی به نام «Pilot limitations – Reports & Ledger» اضافه کن:

summary cache ۳۰ ثانیه‌ای است.
ledger-events همه‌ی نوع settlement را پوشش نمی‌دهد (online vs manual).
برای reconciliation دقیق، از raw payments + registrations استفاده شود، نه فقط کارت summary.
3. Ledger parity (در مرحله‌ی بعد)
وقتی double-entry ledger برای manual approve آماده است، برای online Paid هم باید:
finance.ledger.double_entry_applied با همان semantics emit شود.
فعلاً حداقل:
همگن کردن این‌که چه نوع پرداختی وارد ledger می‌شود.
تست‌های پیشنهادی
Unit (finance-reports.service)
تست فعلی aggregation هست؛ اضافه کن:

invalidateSummaryCache کلید tenant مناسب را پاک می‌کند.
اگر Redis down است، fallback به DB درست کار می‌کند.
Integration / E2E
Webhook Paid:

قبل از webhook:
GET /finance/reports/summary → خواندن یک state مشخص.

بعد از webhook Paid:
بلافاصله دوباره GET /summary:

انتظار: state جدید (ثبت cache-bust موفق).

می‌توان با long TTL test را simulate کرد.
## 6. Denali Pricing Rules – مستند هست ولی هنوز product/implementation-ready نیست

> **وضعیت رفع (فاز ۱۲، 2026-05-18):** callout §2–§4 NOT IMPLEMENTED، هم‌خوانی `fuelShareToman` با wizard، guard `requiresPayment`+amount در wizard/API. **دنگ عددی §2–§4 post-pilot** — فاز ۶ = doc pilot، نه pricing live.

این مورد بیشتر product/architecture است، نه bug فوری، ولی برای کامل شدن فاز ۶ مهم است.

### مسئله
سند docs/30-domain/denali_pricing_rules.md در ۱۰ بخش نوشته شده:
acquaintance/stranger، share-cost (دنگ)، driver/passenger، rounding، requiresPayment، و …
اما:
بخش‌های ۲–۴ (acquaintance, share-cost, driver split) عمداً TBD هستند (numeric rules مشخص نیست).
برخی fieldها در سند با API واقعی نمی‌خواند:
مثال: cost_context.fuelShareToman در spec → در CostContextDto وجود ندارد، در wizard logistics ذخیره می‌شود.
Engine فعلی:
یک generic catalog pricing است، نه دنگ/driver-aware.
سند هم خودش می‌گوید:
Denali rules هنوز implement نشده، رفتار فعلی generic است.
ریسک
Expectation mismatch:
Stakeholderها ممکن است فکر کنند قواعد دنگ و driver در سیستم فعال است، درحالی‌که نیست.
Implementation drift اگر کسی شروع به کدنویسی کند بدون resolve کردن TBD.
محل‌ها
docs/30-domain/denali_pricing_rules.md
Pricing engine:
PricingEngineService و rule chain (fp-finance-0.1.0 or similar)
Wizard:
mapping basePrice → cost_context.totalCost vs registration quotes.
پیشنهاد راه‌حل (در چند گام)
Label روشن روی سند:
در ابتدای denali_pricing_rules.md، یک callout اضافه کن:
Status: Pilot spec – sections §2–§4 (acquaintance, share-cost, driver/passenger) are NOT implemented yet. Current production behavior is generic catalog pricing, as described in §6.

تطبیق field naming:
یا:
سند را اصلاح کن تا با API فعلی هم‌خوان باشد (مثلاً استفاده از fieldهایی که واقعاً در CostContextDto هستند).
یا:
تغییرات API را برنامه‌ریزی کن تا fieldهای سند را بیاوری.
Go-live guard برای requiresPayment بدون amount:
در creation/update tour:
اگر requiresPayment === true و totalCost/basePrice خالی یا 0 است → reject با پیام واضح.
Tracker alignment:
map-phase.md هنوز Phase 6 را با checkboxهای product sign-off باز نشان می‌دهد.
یا:
checkboxها را به «Pilot doc complete, rules TBD» تغییر بده.
یا:
صریحاً Phase 6 را «partial» علامت بزن تا کسی فرض نگیرد که pricing دنگ fully live است.
