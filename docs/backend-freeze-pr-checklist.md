# Backend Freeze Pre-Checklist

این چک‌لیست باید در هر PR مربوط به Freeze کامل بررسی و تیک شود.

## Dependency Injection و بارگذاری ماژول‌ها

- [ ] API controllerها بدون هیچ reference `undefined` لود می‌شوند.
- [ ] همه providerهای DI به‌درستی resolve می‌شوند (هیچ constructor injection برابر `undefined` نیست).
- [ ] `AuthModule` بدون strategy گمشده/خراب بالا می‌آید.
- [ ] Webhook module و مسیر `POST /internal/payments/webhook` بدون خطای DI لود می‌شوند.

## Registration Path و Tenant Context

- [ ] مسیر End-to-End `RegistrationsController` عملیاتی است.
- [ ] متد `createPublicRegistrationOrWaitlist` در runtime در دسترس است و با سرویس resolve می‌شود.
- [ ] Tenant context در مسیرهای registration/payment به‌درستی اعمال می‌شود.
- [ ] `RequestContextMiddleware` در تست‌ها فعال است و قبل از handler اجرا می‌شود.

## Payments, Validation و Contract

- [ ] Payment Intent flow بدون خطای runtime اجرا می‌شود.
- [ ] لایه Validation payloadهای نامعتبر را قبل از service رد می‌کند.
- [ ] DTOهای لازم کامل هستند و مورد گمشده وجود ندارد.
- [ ] Swagger دقیقاً با shape واقعی DTOهای runtime هم‌راستا است.

## وضعیت E2E و پایداری اجرا

- [ ] فاز build تست‌ها موفق است.
- [ ] فاز bootstrap اپلیکیشن در تست‌ها موفق است.
- [ ] منطق controller در تست‌ها مقادیر معتبر runtime برمی‌گرداند.
- [ ] در طول اجرای تست هیچ unhandled exception وجود ندارد.

## شرط نهایی Merge

- [ ] تمام `TODO(FREEZE-BLOCKER)`ها قبل از merge کامل resolve شده‌اند.
