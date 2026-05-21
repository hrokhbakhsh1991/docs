# ماتریکس اعتبارسنجی و مدیریت خطا (Denali Validation Matrix)

این سند مرجع تمامی خطاهای احتمالی، قوانین اعتبارسنجی و رفتارهای رابط کاربری در ویزارد دنالی است.

---

## ۱. ماتریکس فیلدها و قوانین (Error Matrix)

| مسیر فیلد (Dot Path) | استپ مالک (Owner) | نوع اعتبارسنجی | کلید ترجمه (i18n Key) | شرط نمایش خطا |
|:---|:---|:---|:---|:---|
| `basicInfo.title` | `denali_basic` | Min 10, Max 120 | `basic.titleMinMaxError` | خروج از فیلد / دکمه بعدی |
| `basicInfo.tourType` | `denali_basic` | Required | `basic.tourTypeRequired` | دکمه بعدی |
| `basicInfo.startDateTime` | `denali_basic` | ISO Date | `basic.invalidStartDate` | تغییر مقدار / دکمه بعدی |
| `basicInfo.endDateTime` | `denali_basic` | Required (Multi) | `basic.endDateTimeRequired` | اگر `duration === 'multi'` |
| `basicInfo.capacityMax` | `denali_basic` | Int, Min 1 | `basic.capacityMaxError` | خروج از فیلد / دکمه بعدی |
| `programNature.shortDescription` | `denali_program` | Required, Max 250 | `program.shortDescError` | استپ برنامه / دکمه بعدی |
| `programNature.difficultyLevel` | `denali_program` | Required (Outdoor) | `program.difficultyRequired` | اگر `category !== 'event'` |
| `pricingPayment.basePricePerPerson` | `denali_pricing` | Required (Paid) | `pricing.basePriceRequired` | اگر `requiresPayment === true` |
| `transport.dongAmount` | `denali_transport` | Required (Shared) | `transport.dongRequired` | اگر `mode === 'shared_cars'` |
| `photosData.photos` | `denali_photos` | Max 10 items | `photos.maxCountError` | هنگام افزودن عکس یا Submit |
| `photosData.photos.*.size` | `denali_photos` | Max 5MB | `photos.maxSizeError` | هنگام انتخاب فایل |
| `photosData.photos.*.mimeType` | `denali_photos` | jpeg/png/webp | `photos.invalidMimeType` | هنگام انتخاب فایل |

---

## ۲. مستندسازی رفتار رابط کاربری (UI Behavior)

### ۲.۱ مدیریت دکمه‌های ناوبری
* **دکمه "بعدی" (Next):** تا زمانی که تمام فیلدهای "اجباری" در استپ جاری معتبر نباشند، دکمه بعدی عمل نکرده و خطاهای Inline نمایش داده می‌شوند.
* **دکمه "ثبت نهایی" (Submit):** در استپ Review، اگر وضعیت کلی فرم (`isValid`) برابر با false باشد، این دکمه غیرفعال (Disabled) می‌ماند.

### ۲.۲ نمایش خطاها
* **Inline Errors:** خطاهایی که مستقیماً زیر هر ورودی نمایش داده می‌شوند تا کاربر بلافاصله متوجه اشتباه شود.
* **Summary Error Panel:** در مرحله Review، یک باکس قرمز در بالای صفحه نمایش داده می‌شود که تمام خطاهای باقی‌مانده در تمام استپ‌ها را لیست می‌کند.

### ۲.۳ راهنماها (Hints & Tooltips)
* برای فیلدهای عددی و فایل، محدودیت‌ها (مثل "حداکثر ۱۰ عکس") به صورت متن راهنما (Hint) همیشه نمایش داده می‌شوند تا از بروز خطا پیشگیری شود.

---

## ۳. راهنمای پیاده‌سازی و نمونه کد (Code Samples)

### ۳.۱ افزودن فیلد جدید با Error Handling
هنگام افزودن فیلد جدید، حتماً از کامپوننت `FormField` استفاده کنید تا خطاها به صورت خودکار متصل شوند:

```tsx
<FormField 
  label={t("fieldName")} 
  error={errors.section?.field?.message} // اتصال مستقیم به RHF Errors
  hint={t("fieldHint")}
>
  <Input {...register("section.field")} />
</FormField>
```

### ۳.۲ اتصال خطای سرور به فرم (Server to RHF)
در صورت دریافت خطای ساختاریافته از API، از متد `setError` استفاده کنید:

```typescript
const handleServerErrors = (serverErrors: { field: string, message: string }[]) => {
  serverErrors.forEach(err => {
    setError(err.field as any, { type: "server", message: err.message });
  });
};
```

---

## ۴. چرخه حیات عکس‌ها (Photos Lifecycle)
* **Pending:** بلافاصله پس از انتخاب فایل، یک آبجکت موقت با وضعیت در حال آپلود ایجاد می‌شود.
* **Uploaded:** پس از دریافت پاسخ موفق از API، آدرس واقعی تصویر جایگزین شده و فیلد معتبر می‌گردد.
* **Cleanup:** در صورت فشردن دکمه حذف، هم فایل از Storage و هم آبجکت مربوطه از State فرم پاک می‌شوند تا داده "شبح" (Ghost) باقی نماند.

---

## ۵. وضعیت i18n
* تمامی پیام‌های خطا در فایل‌های `apps/web/messages/fa.json` و `en.json` تحت فضای نام `tours.denali` ثبت شده‌اند.
