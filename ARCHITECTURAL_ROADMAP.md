Architectural Enterprise Roadmap: Contract-First & Registry-Driven
1. Vision
تبدیلِ پلتفرم به یک سیستمِ خود-محافظ (Self-Guarding). ما دیگر برایِ جلوگیری از باگ به «حافظه‌یِ برنامه‌نویس» تکیه نمی‌کنیم؛ ما به «قراردادهایِ ماشینی» تکیه می‌کنیم. این معماری بر پایه‌یِ سه اصلِ تغییرناپذیر بنا شده است:

Registry-First: هیچ داده‌ای (در تنظیمات، مالی، یا تور) وجود ندارد مگر اینکه در «رجیستری» تعریف شده باشد.

Schema Enforcement: اگر داده با قرارداد (Contract) همخوانی نداشته باشد، 0 خط کد اجرا نخواهد شد (Fail-Fast).

CI/CD Gates: بیلدِ سیستم (CI) به عنوانِ آخرین سنگرِ معماری، هرگونه انحراف (Drift) را در لحظه بلاک می‌کند.

2. Roadmap Phases
Phase 1: Financial Sovereignty (The Contract-First Finance)
هدف: حذفِ پراکندگیِ منطقِ مالی و جایگزینی با قراردادهایِ مشترک.

اقدام ۱: ایجادِ FinanceRegistry برایِ مدیریتِ تمامِ واحدها، حساب‌ها (GL Accounts) و انواعِ تراکنش.

اقدام ۲: جایگزینیِ class-validatorهایِ پراکنده در API با Zodِ مشترک در packages/shared-contracts/finance.

اقدام ۳: یکپارچه‌سازیِ PaymentStatus (حذفِ دوگانگیِ بینِ Enumهایِ TypeORM و منطقِ دامینِ مالی).

خروجی: مالیات، تخفیف‌ها و تراکنش‌ها دارایِ قراردادِ تست‌شده هستند.

Phase 2: Workspace Abstraction (The Strategy Pattern)
هدف: حذفِ تمامیِ if (workspace === 'x') و switch (profile) از کدهایِ اصلی.

اقدام ۱: پیاده‌سازیِ IWorkspaceStrategy به عنوانِ اینترفیسِ استاندارد.

اقدام ۲: جایگزینیِ شرط‌هایِ انشعابی (Branching) با تزریقِ استراتژی (Strategy Injection).

اقدام ۳: انتقالِ تمامیِ فیلدهایِ اختصاصیِ ورک‌اسپیس‌ها به Registry Deltaها (تفاوت‌هایِ ورک‌اسپیس از هسته در فایل‌هایِ جداگانه).

خروجی: اضافه کردنِ ورک‌اسپیسِ جدید = بدونِ تغییر در کدِ موجود.

Phase 3: Dynamic Content Engine (Registry-Driven Pages)
هدف: انتقالِ مدیریتِ محتوا از «هاردکد کردن» به «تعریفِ داده‌ای».

اقدام ۱: ایجادِ PageRegistry برایِ تعریفِ ساختارِ لندینگ‌ها و صفحاتِ About.

اقدام ۲: ساختِ ComponentFactory که به جایِ JSXِ استاتیک، یک آبجکتِ JSON را رندر می‌کند.

اقدام ۳: ایجادِ محیطی برایِ مدیریتِ این JSONها (CMS ساده برایِ هر ورک‌اسپیس).

خروجی: تغییرِ لندینگِ یک ورک‌اسپیس بدونِ نیاز به دیپلویِ مجددِ کلِ فرانت‌اند.

3. Operational Standards (The CI/CD Gate)
هر ماژولِ جدید باید از این "دیوارِ آتش" عبور کند:

Contract Test: هر فیچرِ جدید باید تستی داشته باشد که ساختارِ JSON (قراردادِ آن) را بررسی کند.

Registry Audit: دستورِ pnpm run verify:denali-architecture باید در package.json اصلیِ پروژه و در Pipelineِ CI فعال باشد.

Zero Hardcoding: استفاده از رشته‌هایِ استاتیک برایِ فیلدهایِ فرم یا وضعیت‌هایِ بیزینسی (Status) ممنوع است؛ همه باید در رجیستری تعریف شوند.

4. Immediate Action Plan (Sprint 1)
Refactor Finance DTOs: انتقالِ DTOهایِ پراکنده به packages/shared-contracts/finance.

Unify PaymentStatus: حذفِ مدلِ دوگانه وضعیت‌هایِ مالی.

Enable CI Gates: فعال‌سازیِ معماریِ تستِ خودکار برایِ کلِ مخزن.