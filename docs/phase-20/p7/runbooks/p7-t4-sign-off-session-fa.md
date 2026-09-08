# P7 — جلسه امضای T4 (۳۰ دقیقه)

> **هدف:** اپراتور مشتری VS-01 تا VS-08 را روی staging **بدون کمک توسعه‌دهنده** طی کند. معمار فقط شاهد است و استثناها را ثبت می‌کند.

راهنمای کامل انگلیسی: [p7-t4-sign-off-session.md](p7-t4-sign-off-session.md)

---

## آدرس‌ها (staging)

| سطح | URL |
| --- | --- |
| پنل ادمین | http://89.42.210.252:23000/auth/login |
| مارکتینگ | http://89.42.210.252:23002/tours |
| پورتال مهمان | http://89.42.210.252:23003 |

**ورود اپراتور (OTP staging):** `09174070937` / `1234`

**تور smoke:** North Ridge Trek

---

## سناریوی جلسه (مشتری-led)

| مرحله | VS | کار مشتری | موفق وقتی که |
| ----- | -- | --------- | ------------- |
| ۱ | VS-01 | ورود ادمین · باز کردن تور · تأیید **فعال/منتشر** | تور در کاتالوگ دیده شود |
| ۲ | VS-02 | باز کردن `/tours` در مارکتینگ | کارت North Ridge Trek |
| ۳ | VS-03 | Register از مارکتینگ · OTP در پورتال · تکمیل فرم | صفحه موفقیت |
| ۴ | VS-04 | پورتال `/me/registrations` | ردیف جدید برای تور |
| ۵ | VS-05 | جزئیات ثبت‌نام · آپلود تصویر رسید | آپلود موفق |
| ۶ | VS-06 | ادمین · bookings · **تأیید** مهمان pending | وضعیت approved |
| ۷ | VS-07 | ادمین · Finance → Receipts · تأیید رسید | رسید cleared |
| ۸ | VS-08 | (معمار) `p7:gate` روی SHA استقرار | PASS در manifest |

**نکته:** برای VS-03 تا VS-05 شماره مهمان پیشنهادی: `+15550002002` / `1234` (اگر Ali Rezaei مصرف شده).

---

## قبل از جلسه (توسعه‌دهنده — ۵ دقیقه)

```bash
pnpm run p7:t4-day
```

اختیاری — regression کامل مرورگر:

```bash
pnpm run p7:staging-e2e-probe
```

---

## بعد از PASS

```bash
export P7_T4_ARCHITECT="نام معمار"
export P7_T4_OPERATOR="نام اپراتور مشتری"
pnpm run p7:t4-closeout
```

سپس ورود به P8: [../../phase-21/AGENT-START.md](../../phase-21/AGENT-START.md)

---

## ثبت نتیجه

- [walkthrough-results.md](../evidence/2026-06-23-operator/walkthrough-results.md) — ستون Manual را تیک بزنید
- [manifest.yaml](../evidence/2026-06-23-operator/manifest.yaml) — نام معمار و اپراتور
