# Capacity Guard & Waitlist Promotion Design

**Status:** Draft (to be stabilized before coding)  
**Scope:** Tour registrations, capacity enforcement, waitlist promotion, audit/outbox.

---

## 1. اهداف طراحی (Design Goals)

1. جلوگیری از **overbooking** و **double promotion** تحت concurrency بالا.
2. تعریف یک **مدل ظرفیت canonical** که همه‌ی سرویس‌ها از آن تبعیت کنند.
3. اجرای تمام عملیات capacity + status + waitlist promotion به صورت **اتمیک** در تراکنش‌های واضح.
4. هم‌سرنوشت کردن **Domain تغییرات** و **Audit/Events** (مطابق AUDIT-RULE-004).
5. افزایش **observability** زنجیره‌ی promotion (چه کسی، چرا و کی promoted شد).

---

## 2. مدل ظرفیت Canonical

### 2.1. تعریف

برای هر `Tour`:

- `tour.totalCapacity`  
  حداکثر تعداد ثبت‌نام قابل قبول.

- `tour.acceptedCount`  
  شمارنده‌ی canonical برای تعداد ثبت‌نام‌هایی که در وضعیت `Accepted` هستند.

- تعریف ظرفیت آزاد:
```text
  availableCapacity = totalCapacity - acceptedCount
  
