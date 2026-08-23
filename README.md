# app-tour

Enterprise tour-operations platform — **workspace plugins** on a generic core.

| Path | Purpose |
|------|---------|
| [`packages/workspace-sdk`](packages/workspace-sdk) | Plugin contract (no workspace-specific imports) |
| [`legacy/`](legacy/) | Previous monorepo (reference only) |
| [`docs/MIGRATION-MAP.md`](docs/MIGRATION-MAP.md) | نقشهٔ کل — ۷ فاز + frontend tokens |
| [`docs/phase-0-foundation.md`](docs/phase-0-foundation.md) | **فاز ۰** — SDK، legacy، guards (کامل) |
| [`docs/phase-1-platform-core.md`](docs/phase-1-platform-core.md) | **فاز ۱** — engine، tests، anti-patterns |
| [`docs/MIGRATION.md`](docs/MIGRATION.md) | فهرست کوتاه |

**North star:** Platform logic = generic · Workspace logic = injectable

## Enterprise Platform Contract

این پروژه باید به‌عنوان یک **Enterprise multi-tenant platform** توسعه داده شود؛ یعنی یک هسته‌ی مشترک بتواند چند Workspace مستقل را با دامنه، برند، قابلیت‌ها، داده، نقش‌ها و سطح سرویس متفاوت ارائه کند.

### What Enterprise Means Here

- **Workspace isolation:** هر درخواست باید از Host/Domain و Session معتبر به یک `tenantId` قطعی برسد. Tenant نباید از ورودی قابل جعل کاربر، fallback خاموش یا حدس کلاینت پذیرفته شود.
- **Data isolation:** تمام خواندن‌ها و نوشتن‌های Tenant در مسیر tenant-aware انجام شوند؛ PostgreSQL RLS، `tenant_id`، تراکنش tenant-bound و تست‌های cross-tenant باید جلوی مشاهده یا تغییر داده‌ی Workspace دیگر را بگیرند.
- **Surface isolation:** Admin، Marketing و Portal باید surface و session خودشان را داشته باشند و Workspace اشتباه، cookie اشتباه یا renderer اشتباه را قبول نکنند.
- **Plugin isolation:** منطق Workspace-specific فقط در package/plugin خودش باشد. Core و SDK نباید به Denali یا هر Workspace مشخصی import مستقیم داشته باشند.
- **Generated registration:** اضافه‌کردن Workspace جدید باید از Manifest، Registry و code generation عبور کند؛ نه از switchهای پراکنده و hard-code در چند اپلیکیشن.
- **Branding and design tokens:** Platform tokenها باید با semantic tokenها از brand tokenهای Workspace جدا باشند. هر Workspace بتواند theme، typography، spacing، color، dark mode و surface-specific skin داشته باشد بدون شکستن Workspaceهای دیگر.
- **Domain isolation:** هر Tenant باید subdomain یا custom domain قابل verify داشته باشد؛ دامنه باید به Tenant و surface درست bind شود و TLS، cache و cookie policy آن نیز tenant-aware باشد.
- **Authorization:** نقش، capability، module access، feature flag و plan باید در API enforce شوند؛ مخفی‌کردن گزینه در UI به‌تنهایی کنترل دسترسی نیست.
- **Auditability:** تغییرات مهم مثل login، نقش، تنظیمات برند، دامنه، پرداخت، انتشار محتوا و دسترسی‌ها باید audit trail قابل جست‌وجو داشته باشند.
- **Reliability:** timeout، retry، idempotency، outbox، rate limit، backup/restore و disaster recovery باید برای عملیات حساس تعریف و تست شوند.
- **Observability:** لاگ، metric، trace و alert باید حداقل با `tenantId`، Workspace، surface و correlation ID قابل تفکیک باشند؛ بدون افشای اطلاعات Tenant دیگر.
- **Portability:** هر Workspace باید بتواند داده، فایل، تنظیمات برند و configuration خودش را export کند و در صورت نیاز restore یا migrate شود.
- **Production certification:** هیچ Workspace جدیدی نباید صرفاً با ثبت Manifest وارد production شود؛ باید contract test، integration test، security test، smoke test و certification مستقل داشته باشد.

### Current Architecture Position

در وضعیت فعلی، پروژه بخش مهمی از این قرارداد را دارد: `workspace-sdk`، plugin registry، Manifestهای Workspace، generated bindings، Host/Domain tenant resolution، branding tenant-aware، design-token package و مسیر RLS در API.

این موارد هنوز نباید بدون مدرک runtime به‌عنوان «Enterprise کامل» اعلام شوند:

- اثبات end-to-end ایزولاسیون بین دو Tenant در production-like database؛
- اثبات custom domain و تطابق هم‌زمان domain، surface و session؛
- اثبات backup/restore و export مستقل هر Workspace؛
- اثبات observability، disaster recovery و SLO در بار واقعی؛
- امکان ویرایش کامل design tokenها توسط Tenant در runtime، نه فقط token sliceهای package-level؛
- certification مستقل برای هر Workspace جدید.

## Tenant Isolation Decision

### Logical Isolation

در ایزولاسیون منطقی، چند Workspace از یک application و معمولاً یک database cluster استفاده می‌کنند، اما هر رکورد با `tenant_id` جدا می‌شود و API/database با RLS، transaction context و authorization مانع عبور داده بین Tenantها می‌شود.

مزایا: هزینه و عملیات کمتر، deploy و migration یکپارچه، مناسب برای SaaS با تعداد زیاد Workspace، و سازگار با کاری که اکنون انجام داده‌ایم.

ریسک: یک bug در query، cache، authorization یا tenant resolution می‌تواند باعث نشت cross-tenant شود؛ بنابراین fail-closed، RLS و تست‌های adversarial ضروری هستند.

### Physical Isolation

در ایزولاسیون فیزیکی، Tenantهای حساس روی database، schema، storage، cluster یا حتی deployment جدا اجرا می‌شوند. این مدل جداسازی عملیاتی و blast radius کوچک‌تری دارد، اما هزینه، پیچیدگی DevOps، migration، monitoring و پشتیبانی آن بیشتر است.

فیزیکال همیشه بهتر نیست. برای محصولی که قرار است تعداد زیادی Workspace ارائه کند، پیشنهاد معماری این پروژه **مدل ترکیبی** است:

1. **Shared logical tenancy** برای Workspaceهای عادی و پرشمار؛ با RLS، authorization، cache key و تست‌های cross-tenant اجباری.
2. **Dedicated schema یا database** برای مشتریان حساس، پرترافیک یا دارای الزام قراردادی/قانونی.
3. **Dedicated deployment/cluster** برای مشتریان بسیار بزرگ، داده‌های حساس، نیازهای اختصاصی یا SLA ممتاز.

پس کاری که الان انجام داده‌ایم مسیر درستی برای هسته‌ی SaaS است و در آینده قابل ارتقا به ایزولاسیون فیزیکی است؛ به شرطی که تمام repositoryها، storage keyها، eventها، cacheها، jobها، domainها و APIها از ابتدا tenant-aware باقی بمانند.

### Enterprise Work Queue

- [ ] Cross-tenant read/write tests با دو Tenant واقعی و PostgreSQL RLS
- [ ] Fail-closed برای Host، JWT، cookie، forwarded headers و tenant fallback
- [ ] Tenant-aware cache، queue، event، object storage و search index
- [ ] Custom domain verification، TLS automation و domain-to-surface binding
- [ ] Tenant export/import، backup/restore و deletion policy
- [ ] SLO، alerting، tracing و داشبورد تفکیک‌شده بر اساس Tenant
- [ ] Runtime theme editor با schema validation، preview، versioning و rollback
- [ ] Capability/plan enforcement در API و نه فقط در UI
- [ ] Dedicated isolation tier برای Workspaceهای Enterprise
- [ ] Production certification checklist برای هر Workspace و هر release

## Prerequisites

- Node.js 24 (`nvm use`)
- pnpm 9.12 (`corepack enable`)

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm run guard:architecture
```
