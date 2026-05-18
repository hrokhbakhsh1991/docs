# Denali Finance Pilot — اجرای فازبه‌فاز (عملیاتی)

**نسخه:** 4.0 (Pilot + Remediation)  
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

**ترتیب پیشنهادی رفع:** `۷ → ۸ → ۹ → ۱۰ → ۱۱` (موازی جزئی با ۹)، سپس `۱۲` (محصول + مهندسی).  
**کد:** فاز ۸ منطقاً بعد از ۷ واضح‌تر است؛ **e2e:** suiteهای `۷.۴` و `۸.۳` را **فایل‌های جدا** نگه دارید تا fail یکی، merge دیگری را block نکند (جزئیات در `map.log`).

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

## ۱۱.۳ — Ledger parity · **مرحله دوم / بعد از Pilot (phase-2)**

> **خارج از gate production پیوست C.** تا زمانی که این بخش بسته نشود، `ledger-events` و reconciliation ممکن است settlementهای manual/online را کامل نشان ندهند — در ۱۱.۲ runbook شفاف کنید.

| زیرفاز | کار | زمان |
|--------|-----|------|
| 11.3a | `receipt.service.ts` approve → `emitFinanceLedgerDoubleEntryApplied` (هم‌تراز leader PATCH) | post-pilot |
| 11.3b | online Paid webhook → ledger journal | post-pilot |
| 11.3c | e2e: بعد از approve، `GET ledger-events` حداقل یک ردیف | post-pilot |

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

### ✅ معیار پذیرش فاز ۱۱.۳ — phase-2 (بعد از Pilot؛ اختیاری برای GA اول)

- [ ] تصمیم محصول ثبت شده
- [ ] manual approve در ledger-events دیده می‌شود
- [ ] online Paid در ledger-events (در صورت 11.3b)

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
| C1 | **فاز ۷** — بدون بدهی manual پس از Paid (+ e2e `payments-coexistence`) | **Eng** | ⬜ |
| C2 | **فاز ۸** — upload محدود به مالک/leader/admin (+ e2e `receipt-upload-ownership`) | **Eng** | ⬜ |
| C3 | **فاز ۹** — runbook = API auth | **Eng** (+ Product review متن) | ⬜ |
| C4 | **فاز ۱۰** — یک receipt Pending + cleanup storage | **Eng** | ⬜ |
| C5 | **فاز ۱۱.۱–۱۱.۲** — cache + runbook limitations (نه ۱۱.۳) | **Eng** + **Ops** (runbook) | ⬜ |
| C6 | **فاز ۱۲.۱–۱۲.۲** — pricing spec صادق + guard تور | **Product** (+ Eng guard) | ⬜ |
| C7 | `map.log` به‌روز؛ e2e suites مستقل سبز؛ flakeهای شناخته‌شده در runbook | **Eng** | ⬜ |
| — | **فاز ۱۱.۳** ledger parity — **post-pilot / phase-2** | **Eng** + **Product** | ⏸ |

**Owner راهنما:** **Eng** = پیاده‌سازی + تست · **Product** = D7/D8/D12 و sign-off · **Ops** = runbook، deploy، monitoring

---

*پایان سند — با بستن هر زیرمرحله، `map.log` و در صورت نیاز [`map.md`](./map.md) را به‌روز کنید.*
