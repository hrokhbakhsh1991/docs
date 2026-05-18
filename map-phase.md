# Denali Finance Pilot — اجرای فازبه‌فاز (عملیاتی)

**نسخه:** 5.0 (Pilot + Remediation + Verification)  
**آخرین به‌روزرسانی:** 2026-05-18  
**لاگ پیشرفت:** [`map.log`](./map.log)  
**فهرست کوتاه:** [`map.md`](./map.md)  
**بک‌لاگ تحلیل مسائل (متن اولیه):** همان محتوای تحلیلی در [`map.md`](./map.md) — هر فاز رفع زیر با شماره مسئلهٔ متناظر است.

---

## نحوه استفاده

| فایل | نقش |
|------|-----|
| `map.md` | فهرست + بک‌لاگ تحلیل مسائل (چرا / ریسک / پیشنهاد اولیه) |
| `map-phase.md` | **این سند** — قدم‌های اجرایی، مسیر فایل، تست، معیار پذیرش |
| `map.log` | `YYYY-MM-DD \| ID \| ✅/❌ \| یادداشت \| دستور تست` |
| `check.md` | چک‌لیست بازبینی (منبع خام) → **بخش C، فاز ۱۳–۲۰** |

**ترتیب پیشنهادی رفع:** `۷ → ۸ → ۹ → ۱۰ → ۱۱` (موازی جزئی با ۹)، سپس `۱۲` (محصول + مهندسی).  
**ترتیب پیشنهادی تأیید (بعد از commit pilot):** `۱۳ → ۱۴ → ۱۵ → ۱۶` (موازی جزئی)، سپس `۱۷ → ۱۸ → ۱۹ → ۲۰`.  
**کد:** فاز ۸ منطقاً بعد از ۷ واضح‌تر است؛ **e2e:** suiteهای `۷.۴` و `۸.۳` را **فایل‌های جدا** نگه دارید تا fail یکی، merge دیگری را block نکند (جزئیات در `map.log`).  
**مرجع تحلیل:** `test-report.md` (خروجی `scripts/run-test-md.js` از `TEST.MD`) — خطوط cited در `check.md`.

**وضعیت نماد:** `⬜` باز · `🔍` در حال اجرا · `✅` تأیید شده · `⏸` معلق (تصمیم محصول)

---

# بخش A — Pilot اصلی (فاز ۰–۶)

> فازهای ۱–۶ در `map.log` عمدتاً ✅ ثبت شده‌اند؛ این بخش مرجع است. **تیک نهایی فقط بعد از اجرای فازهای ۷–۱۲ برای مسائل امنیت/مالی.**

---

## G0 — پیش‌نیاز

| ID | کار | تأیید |
|----|-----|--------|
| G0.1 | `pnpm install` | ⬜ |
| G0.2 | Postgres + Redis + MinIO (`infra/docker-compose.yml`) | ⬜ |
| G0.3 | `apps/api/.env` + `pnpm --filter @apps/api run build` | ⬜ |
| G0.4 | Migrations شامل `payments`, `payment_receipts` | ⬜ |
| G0.5 | `provision-denali-tenant.ts` — `enabled_modules`: `finance`, `form_builder` | ⬜ |
| G0.6 | مطالعه [`denali-finance-runbook.md`](./docs/60-operations/denali-finance-runbook.md) | ⬜ |

---

## فاز ۱ — Infra (Redis + MinIO)

مرجع: MinIO `9002`, `FileStoragePort`, `RedisInfraModule`, `GET /health` → `dependencies.storage`.

**معیار پذیرش:** receipt upload در e2e با storage سالم؛ health storage در non-test.

---

## فاز ۲ — Manual receipt

| مسیر API | نقش |
|----------|-----|
| `POST /api/v2/finance/payments/manual` | بدهی manual |
| `POST /api/v2/finance/payments/:id/receipt` | آپلود |
| `POST /api/v2/admin/finance/receipts/:id/approve` | تأیید |

**تست مرجع:** `apps/api/test/e2e/manual-receipt-flow.e2e-spec.ts`

**وابستگی رفع:** فاز **۷، ۸، ۱۰** قبل از production Denali.

---

## فاز ۳ — Registrations ↔ Payments

| فایل | هدف |
|------|-----|
| `registration-payment.port.ts` | قرارداد transition |
| `registration-placement.orchestrator.ts` | register + intent یک tx |

**تست:** `registration-placement.orchestrator.unit-spec.ts`, `registrations.e2e-spec.ts`

---

## فاز ۴ — Ledger + Reports

| Endpoint | منبع داده |
|----------|-----------|
| `GET /finance/reports/summary` | `payments` + `payment_receipts` (Redis 30s) |
| `GET /finance/reports/ledger-events` | outbox `finance.ledger.%` |
| `GET /finance/reports/open-payments` | `payments` Pending |

**شکاف شناخته‌شده:** manual approve / online Paid → ledger ناقص — **فاز ۱۱**.

---

## فاز ۵ — Online payments

| موضوع | فایل |
|--------|------|
| Webhook HMAC | `payments-webhook-signature.guard.ts` |
| Idempotency | `processWebhook` + `payment_gateway_idempotency` |
| E1–E3 e2e | `registrations.e2e-spec.ts` |
| E4 هم‌زیستی manual+online | **تصمیم → فاز ۷** |

---

## فاز ۶ — Pricing spec (بدون کد محاسبه دنگ)

| فایل | وضعیت |
|------|--------|
| `docs/30-domain/denali_pricing_rules.md` | §2–§4 TBD — **فاز ۱۲** |

---

# بخش B — رفع مسائل (فاز ۷–۱۲)

> هر فاز به **مسئلهٔ شماره‌دار در `map.md`** map می‌شود.

---

# فاز ۷ — یکپارچگی تسویه: ممنوعیت بدهی manual بعد از Paid آنلاین

**map.md مسئله:** ۱  
**اولویت:** P0 (مالی)  
**وابستگی:** هیچ (می‌توان بلافاصله شروع کرد)  
**وضعیت:** `⬜`

## ۷.۰ — تصمیم محصول (قبل از کد)

| # | سؤال | گزینه پیشنهادی pilot | تصمیم تیم |
|---|------|------------------------|-----------|
| D7.1 | بعد از **یک Paid** موفق، manual جدید مجاز است؟ | **خیر** (پیش‌فرض) | ⬜ |
| D7.2 | recovery manual بعد از آنلاین **Failed**؟ | **بله** — فقط وقتی هیچ Paid نباشد | ⬜ |
| D7.3 | آیا «بدهی اضافه» آینده (`allowAdditionalDebt`) لازم است؟ | خارج از pilot — مستند شود | ⬜ |

ثبت تصمیم در `map.log`: `D7.1 | ...`

## ۷.۱ — Guard سرویس

| گام | فایل | کار دقیق |
|-----|------|----------|
| 7.1.1 | `apps/api/src/modules/payments/manual-payment.service.ts` | قبل از `save`: بارگذاری payments همان `registrationId` در tenant |
| 7.1.2 | همان | اگر هر `status === Paid` → `ConflictException` با `PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN` |
| 7.1.3 | همان | اگر `Pending` دیگر وجود دارد → `PAYMENT_PENDING_EXISTS` (هم‌تراز intent آنلاین) |
| 7.1.4 | همان | recovery: اجازه فقط اگر **هیچ Paid** و حداکثر یک Pending manual/online مطابق D7.2 |

**مرجع الگو:** `payments.service.ts` → `createPaymentIntentWithManager` (خطوط ~211–240).

## ۷.۲ — هم‌ترازی آنلاین (اختیاری ولی توصیه‌شده)

| گام | فایل | کار |
|-----|------|-----|
| 7.2.1 | `payments.service.ts` | در `createPaymentIntentWithManager` اگر registration قبلاً `AcceptedPaid` و payment Paid دارد → reject |
| 7.2.2 | `registration-placement.orchestrator.ts` | مستندسازی: register با `requiresPayment` فقط وقتی هنوز settled نیست |

## ۷.۳ — DB (فقط بعد از D7.1 تأیید)

| گام | کار | معیار |
|-----|-----|--------|
| 7.3.1 | Migration اختیاری: `UNIQUE (registration_id) WHERE status = 'Paid'` **یا** partial index یک Paid per registration | فقط اگر محصول multi-Paid را رد کرد |
| 7.3.2 | اسکریپت یک‌باره: شناسایی ردیف‌های `Paid + Pending` موجود در prod/staging | گزارش قبل از deploy |

## ۷.۴ — تست

| نوع | فایل | سناریو |
|-----|------|---------|
| Unit | `apps/api/test/payments/manual-payment.service.unit-spec.ts` | Paid موجود → 409 + code |
| Unit | همان | فقط Failed → manual مجاز (اگر D7.2 بله) |
| **E2E suite (مستقل)** | `apps/api/test/e2e/payments-coexistence.e2e-spec.ts` (**جدید**) | register → webhook Paid → `POST .../manual` → **4xx** |
| همان suite | همان فایل | pending online → webhook Failed → manual → **201** |
| Regression | `registrations.e2e-spec.ts` | E1–E3 همچنان سبز |

> **اجرای مستقل:** این فایل e2e فقط settlement/coexistence را پوشش می‌دهد — **وابسته به فاز ۸ نیست**. در CI می‌توان جدا از `receipt-upload-ownership.e2e-spec.ts` (۸.۳) اجرا کرد. ثبت در `map.log` به‌صورت `7.4.e2e`.

```bash
cd apps/api && node --import tsx --test test/payments/manual-payment.service.unit-spec.ts
cd apps/api && node --import tsx --test test/e2e/payments-coexistence.e2e-spec.ts
```

## ۷.۵ — مستندات

| فایل | به‌روزرسانی |
|------|-------------|
| `docs/60-operations/denali-finance-runbook.md` | بند «یک Paid = بسته شدن بدهی registration در pilot» |
| `docs/30-domain/denali_pricing_rules.md` §9 | اشاره به قانون تسویه (اختیاری) |

### ✅ معیار پذیرش فاز ۷

- [ ] D7.1–D7.2 در `map.log` ثبت شده
- [ ] `createManualPayment` بعد از Paid آنلاین → 409 با code ثابت
- [ ] e2e coexistence سبز
- [ ] runbook به‌روز

---

# فاز ۸ — مالکیت آپلود رسید (authorization / privacy)

**map.md مسئله:** ۲  
**اولویت:** P0 (امنیت + حریم خصوصی)  
**وابستگی (کد):** ترجیحاً بعد از ۷ (guard تسویه). **e2e:** suite **۸.۳ مستقل** از ۷.۴ — می‌توان موازی develop/merge کرد.  
**وضعیت:** `⬜`

## ۸.۰ — تصمیم محصول

| # | سؤال | پیشنهاد pilot |
|---|------|----------------|
| D8.1 | چه کسی upload می‌کند؟ | participant همان registration **یا** Leader همان تور **یا** Admin/Owner |
| D8.2 | Member با finance ولی بدون ارتباط با registration؟ | **403** |
| D8.3 | Leader تور از کجا resolve شود؟ | `tour` / registration context — نه هر Leader workspace |

## ۸.۱ — مدل ownership

| گام | فایل | کار |
|-----|------|-----|
| 8.1.1 | `registration.entity.ts` / join | مشخص کردن فیلد مالک: `userId` ثبت‌نام‌کننده، `participantContactPhone`, یا JWT `userId` |
| 8.1.2 | `receipt.service.ts` → `submitReceipt` | پارامتر `actorUserId` از `RequestContextService` |
| 8.1.3 | همان | `findOne` payment + registration؛ `ForbiddenException` `NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT` |
| 8.1.4 | `finance-payments.controller.ts` | پاس دادن `getUserId()` به سرویس |

**الگوی مرجع:** `registrationWhereForActor` در `payment-intent-registration-resolver.application.service.ts`

## ۸.۲ — CASL (هم‌راستا با فاز ۹)

| گام | فایل | کار |
|-----|------|-----|
| 8.2.1 | `packages/shared/rbac/ability.factory.ts` | محدود کردن `create` روی `FinanceReceipt` (instance یا شرط registration) |
| 8.2.2 | `finance-payments.controller.ts` | `@CheckAbilities` روی `POST .../receipt` |

## ۸.۳ — تست

| نوع | فایل | سناریو |
|-----|------|---------|
| Unit | `apps/api/test/payments/receipt.service.unit-spec.ts` | owner → OK؛ عضو بی‌ربط → 403 |
| **E2E suite (مستقل)** | `apps/api/test/e2e/receipt-upload-ownership.e2e-spec.ts` (**جدید، ترجیحی**) | memberA / memberB cross-upload → **403** / owner → **201** |
| E2E regression | `manual-receipt-flow.e2e-spec.ts` | happy path قبلی سبز (بدون ادغام با suite بالا) |
| Security | `apps/api/test/security/ownership-access.unit-spec.ts` | سناریوی receipt اضافه شود |

> **اجرای مستقل:** سناریوی ownership را در **فایل جدا** از `payments-coexistence.e2e-spec.ts` نگه دارید (`map.log`: `8.3.e2e`). اگر موقتاً در `manual-receipt-flow` گسترش دادید، قبل از merge به فایل جدا split کنید.

```bash
cd apps/api && node --import tsx --test test/payments/receipt.service.unit-spec.ts
cd apps/api && node --import tsx --test test/e2e/receipt-upload-ownership.e2e-spec.ts
cd apps/api && node --import tsx --test test/e2e/manual-receipt-flow.e2e-spec.ts
```

### ✅ معیار پذیرش فاز ۸

- [ ] D8.1 در `map.log`
- [ ] upload cross-user در e2e → 403
- [ ] happy path قبلی سبز

---

# فاز ۹ — هم‌سوسازی Runbook، CASL و API

**map.md مسئله:** ۳  
**اولویت:** P1  
**وابستگی:** ۸ (CheckAbilities receipt)  
**وضعیت:** `⬜`

## ۹.۰ — انتخاب مسیر

| مسیر | توضیح | انتخاب |
|------|--------|--------|
| **A (پیشنهاد)** | API همان CASL/UI را enforce کند | ⬜ |
| B | فقط runbook را به «roles + capability» تنزل دهد | ⬜ |

## ۹.۱ — پیاده‌سازی مسیر A

| Route | Controller | `@CheckAbilities` پیشنهادی |
|-------|------------|---------------------------|
| `GET /finance/payments` | `finance-payments.controller.ts` | `read` `FinanceManualPayment` |
| `POST /finance/payments/manual` | همان | `create` `FinanceManualPayment` (Admin/Owner) |
| `POST /finance/payments/:id/receipt` | همان | `create` `FinanceReceipt` |
| `GET /admin/finance/receipts` | `FinanceAdminReceiptsController` | `update` `FinanceReceiptReview` |
| `POST .../approve` | همان | همان |
| `GET /finance/reports/*` | `finance-reports.controller.ts` | subject جدید یا `read` `Reconciliation` — با نقش‌های فعلی |

| گام | فایل |
|-----|------|
| 9.1.1 | `packages/shared/rbac/ability.factory.ts` — قوانین finance |
| 9.1.2 | `packages/shared/rbac/ability.factory.spec.ts` |
| 9.1.3 | Controllers بالا — mirror `payments.controller.ts` |
| 9.1.4 | `apps/web/lib/finance/finance-module-access.ts` — بدون drift |

## ۹.۲ — Runbook

| گام | فایل | کار |
|-----|------|-----|
| 9.2.1 | `denali-finance-runbook.md` | جدول capability: ستون «API enforce» = CASL یا Role |
| 9.2.2 | همان | حذف ادعای نادرست «فقط CASL در UI» اگر مسیر A |

## ۹.۳ — تست

```bash
cd apps/api && node --import tsx --test test/guards/*.ts
cd apps/web && pnpm exec vitest run lib/finance/finance-module-access.spec.ts
```

| سناریو | انتظار |
|--------|--------|
| Member بدون ability → `POST manual` | 403 |
| Viewer + finance module → reports | 403 (اگر نقش Viewer استثناست) |

### ✅ معیار پذیرش فاز ۹

- [ ] Runbook و OpenAPI با رفتار API یکسان
- [ ] حداقل یک تست controller/guard per sensitive route

---

# فاز ۱۰ — اتمیک بودن storage رسید + یک Pending per payment

**map.md مسئله:** ۴  
**اولویت:** P1  
**وابستگی:** ۸ (قبل از تغییر flow upload)  
**وضعیت:** `⬜`

## ۱۰.۰ — تصمیم

| # | سؤال | پیشنهاد pilot |
|---|------|----------------|
| D10.1 | چند receipt Pending؟ | **حداکثر ۱** per payment |
| D10.2 | upload دوم | **409** `RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT` (نه supersede) |

## ۱۰.۱ — ترتیب عملیات + cleanup

| گام | فایل | کار |
|-----|------|-----|
| 10.1.1 | `file-storage.port.ts` | متد اختیاری `delete(key)` |
| 10.1.2 | `minio-storage.adapter.ts` | پیاده‌سازی `removeObject` |
| 10.1.3 | `receipt.service.ts` | **ابتدا** چک pending در DB (در tx)؛ سپس upload؛ یا upload بعد از lock |
| 10.1.4 | همان | در `catch` بعد از upload: `storage.delete(key)` best-effort + log |
| 10.1.5 | `in-memory-file-storage.adapter.ts` (test) | `delete` برای unit |

**الگوی ترجیحی:** transaction کوتاه با `SELECT ... FOR UPDATE` روی payment → چک pending receipt → upload → insert receipt.

## ۱۰.۲ — Migration

| گام | فایل | SQL |
|-----|------|-----|
| 10.2.1 | `apps/api/src/database/migrations/*-PaymentReceiptOnePending.ts` | `CREATE UNIQUE INDEX uq_payment_receipts_payment_pending ON payment_receipts (payment_id) WHERE status = 'Pending'` |

## ۱۰.۳ — تست

| نوع | سناریو |
|-----|---------|
| Unit | save شکست → `delete` فراخوانی شد |
| Unit | receipt Pending موجود → upload دوم → 409 |
| E2E | دو upload پشت‌سرهم — اول 201، دوم 409 |

### ✅ معیار پذیرش فاز ۱۰

- [ ] index migration اعمال شده
- [ ] unit + e2e سبز
- [ ] runbook: بند orphan MinIO + سیاست یک receipt

---

# فاز ۱۱ — گزارش‌ها: cache، ledger و صداقت عملیاتی

**map.md مسئله:** ۵  
**وابستگی:** ۷ (تسویه واضح)  
**وضعیت:** `⬜`

## دامنه فاز (expectation management)

| بخش | برای Pilot / GA اول Denali finance | زمان‌بندی |
|-----|-----------------------------------|-----------|
| **۱۱.۱ – ۱۱.۲** | **الزامی** — invalidate cache + runbook «Pilot limitations» | قبل از production pilot |
| **۱۱.۳** | **مرحله دوم (بعد از Pilot)** — Ledger parity کامل (manual approve + online Paid → `finance.ledger.*`) | post-pilot / phase-2؛ **blocker نیست** برای go-live اگر ۱۱.۱–۱۱.۲ بسته شده باشد |
| **۱۱.۴** | تست‌های ۱۱.۱–۱۱.۲ (نه الزام e2e برای ۱۱.۳) | با ۱۱.۱ |

> اگر به GA اول برسید و ledger کامل بعداً: فقط **۱۱.۱ + ۱۱.۲** را در پیوست C و `map.log` به‌عنوان gate production بشمارید.

## ۱۱.۱ — Cache invalidation (کد — سریع) · **Pilot required**

| گام | فایل | رویداد |
|-----|------|--------|
| 11.1.1 | `payments.service.ts` → `applyPaymentStatus` | پس از save موفق: `financeReportsService.invalidateSummaryCache(tenantId)` |
| 11.1.2 | `payments.service.ts` → `failTimedOutPendingPayments` | همان پس از هر failed |
| 11.1.3 | `receipt.service.ts` → `rejectReceipt` | invalidate (الان فقط approve دارد) |
| 11.1.4 | `finance-reports.service.ts` | تست: invalidate کلید `finance:reports:summary:{tenantId}` |

## ۱۱.۲ — Runbook (محدودیت‌های pilot) · **Pilot required**

| بند | متن پیشنهاد |
|-----|-------------|
| Summary | TTL 30s؛ پس از فاز ۱۱.۱ webhook هم bust می‌کند |
| Ledger | `ledger-events` ≠ همه settlementها؛ manual approve ممکن است journal نداشته باشد |
| Source of truth | reconciliation: `payments` + `registrations` + outbox `payment.*` |

فایل: `docs/60-operations/denali-finance-runbook.md` — بخش **«Pilot limitations»**

## ۱۱.۳ — Ledger parity · **✅ (2026-05-18)**

| زیرفاز | کار | فایل | تأیید |
|--------|-----|------|--------|
| 11.3a | receipt approve → capture journal | `payment-capture-ledger-authority.service.ts` + `receipt.service.ts` | ✅ |
| 11.3b | online Paid webhook → capture journal | `payments.service.ts` | ✅ |
| 11.3c | e2e ledger-events پس از approve | `manual-receipt-flow.e2e-spec.ts` | ✅ |

**وابستگی محصول:** تأیید حساب‌های بدهکار/بستانکار Denali. **Owner پیشنهادی:** Eng + Finance/Product.

## ۱۱.۴ — تست

| نوع | فایل | سناریو |
|-----|------|---------|
| Unit | `finance-reports.service.unit-spec.ts` | invalidate + getSummary بدون Redis |
| E2E | جدید یا گسترش `registrations.e2e-spec.ts` | webhook Paid → summary بلافاصله paid count ↑ |
| Integration | mock Redis — invalidate فراخوانی شده | |

### ✅ معیار پذیرش فاز ۱۱ — Pilot (۱۱.۱ + ۱۱.۲ + ۱۱.۴ مرتبط)

- [ ] invalidate روی Paid/Failed/timeout/reject
- [ ] runbook limitations منتشر شده
- [ ] e2e summary پس از webhook (بدون انتظار 30s)

### ✅ معیار پذیرش فاز ۱۱.۳

- [x] `PaymentCaptureLedgerAuthorityService` + shared `payment-amount-to-ledger-minor.ts`
- [x] manual approve در ledger-events
- [x] online Paid در ledger-events (webhook path)

---

# فاز ۱۲ — Pricing spec: هم‌خوانی محصول، API و tracker

**map.md مسئله:** ۶  
**اولویت:** P2 (قبل از پیاده‌سازی دنگ)  
**وابستگی:** هیچ برای مستند؛ کد engine بعد از D12  
**وضعیت:** `✅` (مستند + guard؛ §2–§4 عددی post-pilot)

## ۱۲.۰ — اصل

**هیچ کد `DenaliShareCostRule` merge نشود** تا D12.1–D12.3 بسته شوند.

## ۱۲.۱ — مستندات

| گام | فایل | کار |
|-----|------|-----|
| 12.1.1 | `denali_pricing_rules.md` | callout بالای سند: §2–§4 **NOT IMPLEMENTED** |
| 12.1.2 | همان | `fuelShareToman` → `tripDetails.logistics.fuelShareToman` (نه `cost_context`) |
| 12.1.3 | همان | جدول sign-off per-section یا «TBD owner + date» |
| 12.1.4 | `map.md` / `map.log` | Phase 6 = «doc pilot» نه «pricing live» |

## ۱۲.۲ — Guard انتشار تور

| گام | فایل | کار |
|-----|------|-----|
| 12.2.1 | `tourCreateSchema.ts` | `requiresPayment === true` ⇒ `basePrice > 0` (یا totalCost) |
| 12.2.2 | `tours.service.ts` | on publish/Open: reject `requiresPayment` بدون list/total |
| 12.2.3 | تست | wizard/API — تور paid بدون amount → 400 |

## ۱۲.۳ — تصمیمات عددی (محصول)

| بخش | خروجی مورد انتظار |
|-----|-------------------|
| §2 acquaintance/stranger | تعریف input + قیمت |
| §3 share-cost | `n_payers`, `paysShare` |
| §4 driver/passenger | fuel vs share |

ثبت در `map.log` + به‌روزرسانی §2–§4 (حذف TBD).

## ۱۲.۴ — پیاده‌سازی آینده (خارج pilot فعلی)

| گام | فایل |
|-----|------|
| 12.4.1 | `finance-pricing-rules.ts` — `DenaliShareCostRule` |
| 12.4.2 | bump `FINANCE_PRICING_RULES_ID` |
| 12.4.3 | e2e قیمت‌گذاری Denali |

### ✅ معیار پذیرش فاز ۱۲ (مستند + guard)

- [x] سند و API field names هم‌خوان
- [x] wizard/API guard `requiresPayment` بدون amount
- [x] sign-off محصول برای §2–§4 یا صریحاً «post-pilot»

---

# بخش C — بازبینی و تأیید (از `check.md`)

> **هدف:** تأیید document-driven که پیاده‌سازی pilot با معماری، infra، tenant و گاردریل‌های test-report هم‌خوان است — **بدون feature جدید** مگر شکاف تأییدشده.  
> **منبع:** [`check.md`](./check.md) (۸ بخش) → فاز **۱۳–۲۰**.  
> **وضعیت اولیه:** بسیاری از موارد با pilot/remediation **احتمالاً ✅** هستند؛ هر ردیف باید با دستور تأیید زیر **ثبت در `map.log`** شود (`13.x` / `CK`).

---

# فاز ۱۳ — معماری کلی / مرزبندی ماژول‌ها

**check.md:** §1  
**اولویت:** P1 (بازبینی)  
**وابستگی:** پایان فازهای ۷–۱۲ (کد پایدار)  
**وضعیت:** `✅`

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 13.1.1 | ساختار monorepo `apps` + `packages` | `ls apps packages`; مقایسه با test-report §1 (L5–8) | ✅ |
| 13.1.2 | Nest = business logic، persistence، tenancy، payments | مرور `apps/api/src/modules/*`؛ test-report L21–32 | ✅ |
| 13.1.3 | Next = UI + BFF فقط | `grep -r "ForbiddenException\|PricingEngine" apps/web/lib apps/web/app/api` — نباید engine مالی در web باشد | ✅ |
| 13.1.4 | بدهی god service (PaymentsService / RegistrationsService) | `wc -l` — backlog: 837 / 1873 LOC در `map.log` V1 | ✅ |
| 13.1.5 | ترتیب فازها با `map.md` | [`map.md`](./map.md) L42 + بخش A این سند | ✅ |

### ✅ معیار پذیرش فاز ۱۳

- [x] مرز Nest/Web در مستندات و کد نقض نشده
- [x] یافته god-service (اگر هست) در `map.log` با owner backlog ثبت شده

---

# فاز ۱۴ — DI و coupling (Payments ↔ Registrations)

**check.md:** §2  
**اولویت:** P0 (boot / نگهداری)  
**وابستگی:** فاز ۱۳  
**وضعیت:** `✅`

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 14.1.1 | بدون `forwardRef` بین Payments و Registrations | `rg forwardRef apps/api/src/modules/payments apps/api/src/modules/registrations` → خالی | ✅ |
| 14.1.2 | Port مشترک payments ↔ registrations | `registration-payment.port.ts` + `REGISTRATION_PAYMENT_PORT` در `payments.module.ts` | ✅ |
| 14.1.3 | Boot `AppModule` بدون freeze ترتیب ماژول | `pnpm --filter @apps/api run build`; smoke `createE2EApp` در `test/e2e/bootstrap.ts` | ✅ |
| 14.1.4 | PaymentsService — اندازه و side-effect | مرور `applyPaymentStatus`، outbox، orchestrator؛ test-report L2233، L2264 | ✅ |

**تست مرجع:** `registration-placement.orchestrator.unit-spec.ts`, `payments.service.unit-spec.ts`

### ✅ معیار پذیرش فاز ۱۴

- [x] `forwardRef` = 0 در مسیر payments/registrations
- [x] Port documented در runbook یا `map.log`

---

# فاز ۱۵ — Redis / queue / cache

**check.md:** §3  
**map.md:** L129، L57، L202  
**وضعیت:** `✅`

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 15.1.1 | Redis متمرکز (نه پراکنده ad-hoc) | `rg REDIS_CLIENT apps/api/src` — مصرف‌کنندگان از `RedisInfraModule` | ✅ |
| 15.1.2 | `RedisInfraModule` وجود دارد | `apps/api/src/infra/redis/redis.module.ts` | ✅ |
| 15.1.3 | استفاده: idempotency، webhook replay، reports cache | `finance-reports.service.ts`, `redis-webhook-replay.cache.ts`, rate-limit docs | ✅ |
| 15.1.4 | Redis در `docker-compose` | `infra/docker-compose.yml` service `redis` | ✅ |
| 15.1.5 | تست/guardrail throttle | `docs/security/rate-limiting.md`; test-report L16، L1261–1263 | ✅ |

### ✅ معیار پذیرش فاز ۱۵

- [x] `docker compose ps` — redis healthy
- [x] حداقل یک unit/integration برای consumer مالی (reports یا replay)

---

# فاز ۱۶ — Storage / MinIO / upload

**check.md:** §4  
**map.md:** L35–36، L134، L155  
**وضعیت:** `✅`

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 16.1.1 | MinIO در compose + env | `infra/docker-compose.yml`; `apps/api/.env.example` `MINIO_*` | ✅ |
| 16.1.2 | `FileStoragePort` + `StorageModule` | `apps/api/src/infra/storage/` | ✅ |
| 16.1.3 | Flow آپلود receipt | `receipt.service.ts`; e2e `manual-receipt-flow.e2e-spec.ts` | ✅ |
| 16.1.4 | Tour wizard بدون multipart/S3 (جداسازی از finance) | test-report L833 — `rg presign\|multipart` در `apps/web/src/components/tours` محدود به finance BFF نباشد | ✅ |
| 16.1.5 | تست upload/receipt | `receipt.service.unit-spec.ts`, `storage-health.service.unit-spec.ts` | ✅ |

### ✅ معیار پذیرش فاز ۱۶

- [x] `GET /health` → `dependencies.storage` در non-test
- [x] e2e receipt با `InMemoryFileStorageAdapter` سبز

---

# فاز ۱۷ — Finance / payments / receipts (تأیید pilot)

**check.md:** §5  
**وضعیت:** `✅` (17.1.6 ⏸ post-pilot)

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 17.1.1 | `module.finance` روی همه مسیرهای finance | `rg module\.finance apps/api/src/modules/finance apps/api/src/modules/payments/finance-payments.controller.ts` | ✅ |
| 17.1.2 | Denali: `finance` + `form_builder` | `provision-denali-tenant.ts`; test-report L206 | ✅ |
| 17.1.3 | Roadmap manual receipt = کد | مقایسه بخش A فاز ۲ با `ManualPaymentsAndReceipts` migration | ✅ |
| 17.1.4 | Migration `payment_receipts` | `1777595600000-ManualPaymentsAndReceipts.ts` | ✅ |
| 17.1.5 | Flow approve/reject + UI | `receipt.service.ts`; `admin-receipt-review-panel.tsx`; BFF `app/api/admin/finance/` | ✅ |
| 17.1.6 | Ledger / reconciliation — وضعیت | test-report L1484؛ **۱۱.۳ post-pilot** — runbook «Pilot limitations» | ⏸ |
| 17.1.7 | Webhook HMAC + replay | `payments-webhook-signature.guard.unit-spec.ts`; `redis-webhook-replay.cache.ts` | ✅ |
| 17.1.8 | Decouple online vs manual | e2e `payments-coexistence.e2e-spec.ts` + `manual-receipt-flow.e2e-spec.ts` | ✅ |

### ✅ معیار پذیرش فاز ۱۷

- [x] همه ردیف‌های 17.1.1–17.1.8 در `map.log` ✅ یا ⏸ با دلیل
- [x] 17.1.6 صریحاً «ledger partial» ثبت شده (نه blocker GA اگر ۱۱.۲ بسته است)

---

# فاز ۱۸ — Tenant / آماده‌سازی Denali

**check.md:** §6  
**وضعیت:** `✅`

| ID | کار | دستور / فایل | تأیید |
|----|-----|--------------|--------|
| 18.1.1 | Provisioning Denali | `apps/api/src/scripts/provision-denali-tenant.ts` | ✅ |
| 18.1.2 | Capability merge پایدار | `tenant-bootstrap.service.ts`; test-report L1232، L1341–1342 | ✅ |
| 18.1.3 | RLS / tenant scope jobs + finance | `tenant-session-binding.service.spec.ts`; test-report L191، L1051 | ✅ |
| 18.1.4 | Finance فقط Denali (نه همه tenants) | `enabled_modules` + عدم فعال‌سازی global finance بدون flag | ✅ |

### ✅ معیار پذیرش فاز ۱۸

- [x] e2e finance با tenant seed اختصاصی سبز
- [x] tenant دیگر بدون `finance` → 403 روی finance routes

---

# فاز ۱۹ — هم‌خوانی اجرای roadmap (map-phase بخش A)

**check.md:** §7  
**وضعیت:** `✅`

| ID | کار | مرجع map-phase | تأیید |
|----|-----|----------------|--------|
| 19.1.1 | فاز ۱ Infra (Redis+MinIO) | بخش A — فاز ۱ | ✅ |
| 19.1.2 | فاز ۲ capability `module.finance` | بخش A — فاز ۲ / `ability.factory.ts` | ✅ |
| 19.1.3 | فاز ۲.۵ infra-only (بدون creep محصولی) | map.md L310 — migration receipt جدا از infra commit | ✅ |
| 19.1.4 | فاز ۳ manual receipt pilot | بخش A — فاز ۲ + e2e | ✅ |
| 19.1.5 | فاز ۴ online بعد از manual | بخش A — فاز ۵؛ `map.md` L42 | ✅ |
| 19.1.6 | فاز ۲.۵ بدون feature بیزنس قاطی | diff review infra vs `finance-payments.controller` | ✅ |

### ✅ معیار پذیرش فاز ۱۹

- [x] جدول 19.x در `map.log` با ✅/⏸
- [x] هر ⏸ به فاز remediation یا post-pilot map شده

---

# فاز ۲۰ — تست‌ها و گاردریل‌ها

**check.md:** §8  
**وضعیت:** `✅` (20.1.4 ⏸ ledger post-pilot)

| ID | کار | دستور | تأیید |
|----|-----|--------|--------|
| 20.1.1 | RLS / tenant isolation | test-report L16، L191 — e2e/security مربوط | ✅ |
| 20.1.2 | Tour RBAC parity | `packages/shared/rbac/ability.factory.spec.ts`; اسکریپت‌های test-report L16 | ✅ |
| 20.1.3 | Health / smoke infra | `storage-health.service.unit-spec.ts`; `GET /health` | ✅ |
| 20.1.4 | Ledger/finance guardrail tests | test-report L2071، L2213–2214 — **بخشی ⏸ تا ۱۱.۳** | ⏸ |
| 20.1.5 | Webhook signature tests | `payments-webhook-signature.guard.unit-spec.ts` | ✅ |
| 20.1.6 | Payment state machine / transitions | `payments.service.unit-spec.ts`; test-report L2233–2234 | ✅ |

```bash
# بسته تأیید پیشنهادی (فاز ۲۰)
pnpm --filter @apps/api run build
cd apps/api && node --import tsx --test \
  test/payments/payments.service.unit-spec.ts \
  test/guards/payments-webhook-signature.guard.unit-spec.ts \
  test/finance/finance-reports.service.unit-spec.ts
cd packages/shared && pnpm test
pnpm test:e2e:ci   # یا suiteهای پیوست B
```

### ✅ معیار پذیرش فاز ۲۰

- [x] دستورات بالا سبز در CI/local
- [ ] `test-report.md` regenerate و diff با یافته‌های `map.log` مرور شود (اختیاری)

---

# پیوست A — نگاشت مسئله map.md → فاز

| map.md # | عنوان | فاز | P |
|----------|--------|-----|---|
| 1 | manual بعد از Paid آنلاین | **۷** | P0 |
| 2 | receipt upload بدون ownership | **۸** | P0 |
| 3 | Runbook CASL vs API | **۹** | P1 |
| 4 | MinIO غیراتمیک + چند receipt | **۱۰** | P1 |
| 5 | reports cache + ledger gap | **۱۱** | P1 |
| 6 | pricing spec TBD | **۱۲** | P2 |

---

# پیوست A² — نگاشت `check.md` → فاز

| check.md § | عنوان | فاز | تعداد آیتم |
|------------|--------|-----|------------|
| 1 | معماری کلی | **۱۳** | 5 |
| 2 | DI و coupling | **۱۴** | 4 |
| 3 | Redis / cache | **۱۵** | 5 |
| 4 | Storage / MinIO | **۱۶** | 5 |
| 5 | Finance / receipts | **۱۷** | 8 |
| 6 | Tenant Denali | **۱۸** | 4 |
| 7 | Roadmap اجرا | **۱۹** | 6 |
| 8 | تست / گاردریل | **۲۰** | 6 |

**جمع:** 43 آیتم تأیید — پس از بستن ۷–۱۲ و قبل از GA/production sign-off نهایی.

---

# پیوست B — دستورات تست سریع (بعد از هر فاز)

```bash
pnpm --filter @apps/api run build

# واحد
cd apps/api && node --import tsx --test test/payments/manual-payment.service.unit-spec.ts
cd apps/api && node --import tsx --test test/payments/receipt.service.unit-spec.ts
cd apps/api && node --import tsx --test test/finance/finance-reports.service.unit-spec.ts

# e2e
pnpm test:e2e:ci
# یا:
cd apps/api && node --import tsx --test test/e2e/manual-receipt-flow.e2e-spec.ts
cd apps/api && node --import tsx --test test/e2e/registrations.e2e-spec.ts
cd apps/api && node --import tsx --test test/e2e/payments-coexistence.e2e-spec.ts       # 7.4 — suite مستقل
cd apps/api && node --import tsx --test test/e2e/receipt-upload-ownership.e2e-spec.ts  # 8.3 — suite مستقل
```

---

# پیوست C — چک‌لیست «آماده production Denali finance»

فقط وقتی ردیف‌های **Pilot required** ✅ شوند (۱۱.۳ عمداً خارج است — phase-2).

| # | Gate | Owner | تیک |
|---|------|-------|-----|
| C1 | **فاز ۷** — بدون بدهی manual پس از Paid (+ e2e `payments-coexistence`) | **Eng** | ✅ |
| C2 | **فاز ۸** — upload محدود به مالک/leader/admin (+ e2e `receipt-upload-ownership`) | **Eng** | ✅ |
| C3 | **فاز ۹** — runbook = API auth | **Eng** (+ Product review متن) | ✅ |
| C4 | **فاز ۱۰** — یک receipt Pending + cleanup storage | **Eng** | ✅ |
| C5 | **فاز ۱۱.۱–۱۱.۲** — cache + runbook limitations (نه ۱۱.۳) | **Eng** + **Ops** (runbook) | ✅ |
| C6 | **فاز ۱۲.۱–۱۲.۲** — pricing spec صادق + guard تور | **Product** (+ Eng guard) | ✅ |
| C7 | `map.log` به‌روز؛ e2e suites مستقل سبز؛ flakeهای شناخته‌شده در runbook | **Eng** | ✅ |
| C8 | **فاز ۱۳–۲۰** (بازبینی `check.md`) — 43/43 در `map.log` | **Eng** | ✅ |
| — | **فاز ۱۱.۳** ledger parity | **Eng** + **Product** | ✅ |

**Owner راهنما:** **Eng** = پیاده‌سازی + تست · **Product** = D7/D8/D12 و sign-off · **Ops** = runbook، deploy، monitoring

**ترتیب gate نهایی:** C1–C7 (پیاده‌سازی) → **C8** (تأیید document-driven از [`check.md`](./check.md)).

---

*پایان سند — با بستن هر زیرمرحله، `map.log` و در صورت نیاز [`map.md`](./map.md) را به‌روز کنید.*
