فاز ۰: ایجاد حریم امن (Safety Net)
قبل از لمس هر کدی، باید مطمئن شویم چیزی را خراب نمی‌کنیم.

[ ] تست‌های رگرسیون (Regression Tests): تمام سناریوهای فعلیِ ویزاردِ تور را (همین الان که درست کار می‌کند) در apps/web/tests با Playwright بنویسید.

[ ] تست‌های واحد برای منطق موجود: کدهای فعلی DraftEngine را با Jest تست کنید. این تست‌ها «میثاق» شما هستند؛ نباید در پایانِ کار، رفتار خروجیِ ماژول درفت تغییر کرده باشد.
فاز ۱: تضمین یکپارچگی داده (Data Integrity & Safety)
هدف: پیاده‌سازی قفل‌گذاری و نسخه گذاری برای جلوگیری از Data Race.

تغییرات دیتابیس (Migration):

[ ] اضافه کردن ستون version (Integer, default: 1) به جدول draft_snapshots.

[ ] اضافه کردن ستون schema_version (Integer) برای مدیریت Schema Drift.

[ ] افزودن ایندکس ترکیبی (tenant_id, wizard_key, entity_id) برای کوئری‌های سریع.

منطق Optimistic Locking در DraftEngineService:

[ ] بازنویسی متد upsert در سرویس:

TypeScript


// شبه‌کد برای منطق به‌روزرسانی با قفل‌گذاری
const result = await this.repo.update({
  where: { id: draftId, version: currentVersion },
  data: { data: newData, version: currentVersion + 1 }
});
if (result.affected === 0) throw new DraftConflictException("نسخه درفت تغییر کرده است.");
پیاده‌سازی Schema Migration:

[ ] ساخت کلاس DraftMigrator که درفت‌های قدیمی را به ساختار جدید (طبق Zod Schema فعلی) تبدیل می‌کند. این برای جلوگیری از خطاهای کرش‌کننده در لود درفت‌های قدیمی حیاتی است.

فاز ۲: معماری و بهینه‌سازی (Architecture & Performance)
هدف: تفکیک منطق درفت از منطق بیزنس تور (Tours).

ساختار ماژولار (Shared Lib):

[ ] انتقال DraftEngineService و DraftSnapshot به packages/draft-engine (یک پکیج مستقل).

[ ] استفاده از الگوی Facade؛ سرویس‌های Tours یا Inventory نباید مستقیماً با دیتابیس درفت کار کنند، بلکه باید از این ماژول استفاده کنند.

استراتژی Hot vs Cold Storage:

[ ] پیاده‌سازی لایه Redis (Hot Storage) برای ذخیره لحظه‌ای (Debounced) تغییرات.

[ ] پیاده‌سازی Job برای Sync کردن Redis با Postgres (Cold Storage) پس از اتمام Session یا زمان‌بندی مشخص.

فاز ۳: ردیابی‌پذیری و Audit (Observability & Traceability)
هدف: اگر درفتی خراب شد، در ۳ ثانیه بفهمیم چرا.

اتصال به Request Context:

[ ] تزریق traceId (از request-trace.middleware.ts) به تمام رکوردهای draft_snapshot.

[ ] ثبت تمامی عملیات‌های upsert در AuditLogService با کاتگوری DRAFT_ENGINE_EVENT.

ایجاد Dashboard داخلی (Admin Panel):

[ ] ساخت یک صفحه در ui-playground که لیستی از درفت‌های "Conflict-ridden" (درفت‌هایی که مرتباً کانفلیکت می‌دهند) را به تفکیک tenant_id نشان دهد. این لیست طلایی برای عیب‌یابی شماست.

فاز ۴: تضمین کیفیت (Testing Strategy)
هدف: حذف احتمالات و اثبات پایداری.

تست‌های Race Condition (Jest - API Layer):

[ ] نوشتن تست واحدی که دو Promise همزمان را با ورژن یکسان برای update صدا می‌زند. تست باید ثابت کند که یکی موفق و دیگری حتماً DraftConflictException برمی‌گرداند.

تست‌های یکپارچگی (Integration):

[ ] تست مهاجرت داده‌های قدیمی: یک درفت با schema_version: 1 را لود کنید و مطمئن شوید سیستم آن را به current_schema_version تبدیل می‌کند.

تست‌های E2E (Playwright - Web Layer):

[ ] سناریوی "دو تب مرورگر": کاربری در دو تب درفت را باز می‌کند. در تب اول ذخیره می‌کند. در تب دوم سعی می‌کند ذخیره کند. سیستم باید کاربر را متوجه کند که داده‌اش قدیمی شده (به جای بازنویسی سایلنت).



فاز ۲: انتزاع و جداسازی (Abstraction)
تسک (Guard): ریفکتور گاردِ DraftEngine به DraftEngineGuard. این گارد باید فقط اینترفیس Draftable را چک کند.

تسک (Dependency Injection): حذف وابستگی مستقیم ماژول DraftEngine به TourModule. سرویس‌ها باید از طریق Providers به ماژول درفت متصل شوند.

فاز ۳: یکپارچگی عملیاتی (Observability)
تسک (Audit): تزریق AuditLogService به ماژول درفت. این ماژول باید بدون اطلاع از نوع ریسورس (Tour یا Inventory)، فقط لاگ‌های درفت را ثبت کند.

تسک (Tracing): اطمینان از اینکه trace_id در تمامی متدهای سرویس درفت جابه‌جا می‌شود.