# هم‌ترازی مدل دامنهٔ فرانت با API

بخش‌هایی از اپ وب (از جمله **workspace لیدر**، **صف بررسی لیدر**، و **مسیر بوکینگ مشارکت‌کننده** (`/bookings`) با `NEXT_PUBLIC_API_URL`) اکنون با **HTTP زنده** (`apiClient` + React Query) به API متصل‌اند؛ بخش‌های دیگر ممکن است هنوز mock یا legacy داشته باشند. این سند همچنان مرجع **نگاشت تایپ‌ها و نام فیلدها** به قرارداد API است.

**گزارش هم‌ترازی انتقال‌ها (تور):** [`workspace-transition-alignment-report.md`](./workspace-transition-alignment-report.md)  
**گزارش هم‌ترازی بوکینگ / ثبت‌نام:** [`bookings-transition-alignment-report.md`](./bookings-transition-alignment-report.md)  
**قوانین workflow فرانت:** [`front_end_workflow_rules.md`](./front_end_workflow_rules.md)

## منبع حقیقت

- **`apps/api/openapi.json`** — به‌ویژه `TourResponseDto`, `RegistrationResponseDto`, `UpdateTourDto.lifecycle_status`, و DTOهای session وب (`WebSessionResponseDto` و … در `packages/types/src/auth.ts`).

## بستهٔ اشتراکی

**مسیر:** `packages/types` (`@repo/types`)

| فایل | معادل OpenAPI / backend |
|------|-------------------------|
| `tour.ts` | `TourResponseDto`, مقادیر enum چرخهٔ عمر تور (`DRAFT`, `OPEN`, …) |
| `registration.ts` | `RegistrationResponseDto`, `RegistrationStatus`, `RegistrationPaymentStatus`, … |
| `auth.ts` | مدل‌های credential/session وب مطابق schema |

اپ **`apps/web`** با `"@repo/types": "workspace:*"` این تایپ‌ها را import می‌کند.

## Bookings vs Registrations domain mapping

دامنهٔ قرارداد API برای «بوکینگ» در محصول، همان **registration** است؛ مسیرهای REST با نام booking روی ماژول ثبت‌نام پیاده شده‌اند.

## Route ownership and roles

- **`/bookings`**: فقط برای نقش مشارکت‌کننده (`member`)؛ برای مدیریت رزروهای شخصی شرکت‌کننده و جزئیات ثبت‌نام.
- **`/leader/review`**: فقط برای نقش لیدر (`owner` / `admin`)؛ داشبورد اصلی بازبینی و گزارش‌گیری لیدر روی ثبت‌نام‌های همهٔ تورهای tenant.
- **گارد نقش** در فرانت هم در middleware و هم در layout مسیرهای حساس اعمال می‌شود تا هم امنیت سمت‌سرور برقرار باشد و هم UX هم‌راستا بماند.

- **`GET /api/v2/bookings`** و **`POST /api/v2/bookings`** در بک‌اند به **`RegistrationsController`** نگاشت می‌شوند و بدنه/آرایهٔ پاسخ از نوع **`RegistrationResponseDto`** است (در `@repo/types` به‌صورت **`BookingDto`** / **`Booking`** نام‌گذاری شده تا زبان محصول با دامنهٔ HTTP یکی باشد).
- **`GET /api/v2/registrations/{registrationId}`** همان سندی است که UI جزئیات بوکینگ (`/bookings/[id]`) برای وضعیت، پرداخت و شرکت‌کننده می‌خواند.
- **وضعیت بوکینگ در UI** (`BookingStatusBadge`، جداول لیست) همان فیلد **`status`** با نوع **`RegistrationStatus`** است؛ برچسب‌های محصولی مثل «Confirmed» فقط لایهٔ نمایش‌اند، نه enum جدا (`booking-badges.tsx`).
- **`paymentStatus`** روی همان DTO است (**`RegistrationPaymentStatus`**؛ شامل مقادیر persist شده مانند **`Failed`** و **`Refunded`** وقتی بک‌اند برمی‌گرداند).

برای قواعد **مجاز بودن انتقال وضعیت ثبت‌نام و پرداخت aggregate** در UI، به **`apps/web/lib/booking-transition-policy.ts`** و گزارش [**bookings-transition-alignment-report.md**](./bookings-transition-alignment-report.md) مراجعه کنید.

## انحرافهای آگاهانه (mock / UI)

### تور (دامنهٔ نمایشی، هم‌تراز با `TourDto` + چرخهٔ عمر)

- **`lifecycleStatus`** بخشی از **قرارداد API** است: در **`TourResponseDto`** داخل **`apps/api/openapi.json`** تعریف شده و بک‌اند آن را در پاسخ **`GET /api/v2/tours`** و **`GET /api/v2/tours/{tourId}`** (و پاسخ‌های ایجاد/به‌روزرسانی تور) برمی‌گرداند. در فرانت، مقدار خام JSON در **`mapTourResponseToDto`** (`apps/web/lib/mappers/tour.mapper.ts`) نرمال می‌شود و روی مدل سرویس به‌شکل **`TourDetailDto`** / تایپ‌های **`@repo/types`** در دسترس UI قرار می‌گیرد.

- **لایهٔ نگاشت UI ↔ API (چرخهٔ عمر):** فرم‌ها و فیلترها از **مقادیر وضعیت UI** استفاده می‌کنند: **`draft`**, **`active`**, **`archived`** (`TourFormLifecycleStatus` در `apps/web/src/components/tours/tour-lifecycle.ts`، هم‌خوان با `TourSchema`). API از enum **`DRAFT`**, **`OPEN`**, **`CLOSED`**, **`CANCELLED`** (`TourLifecycleStatus`) استفاده می‌کند. تبدیل دوسویه با **`apiLifecycleToFormStatus`** (خواندن از API → UI) و **`formLifecycleToApi`** (ارسال فرم/`PATCH` → API) در همان فایل انجام می‌شود؛ ساخت بدنهٔ **`POST`/`PATCH`** تور از مسیر **`apps/web/app/(app)/tours/tour-ui-mappers.ts`** (`createTourDtoFromTourFormValues`, `updateTourDtoFromTourFormValues`) این enum را روی DTO سیم (مثلاً `lifecycle_status` در بدنهٔ درخواست طبق قرارداد) می‌نشاند. **برچسب‌های قابل‌مشاهده برای کاربر** (Draft / Active / Archived) با **`lifecycleDisplayLabel`** از همان ماژول گرفته می‌شوند و با مقادیر داخلی فرم (`draft` / `active` / `archived`) متفاوت‌اند.

  | وضعیت UI | خواندن از API (`lifecycleStatus`) | نوشتن به API (`PATCH` از فرم) |
  |-----------|-------------------------------------|-------------------------------|
  | `draft` | `DRAFT` (و پیش‌فرض برای مقدار ناشناخته) | `DRAFT` |
  | `active` | `OPEN` | `OPEN` |
  | `archived` | `CLOSED` یا `CANCELLED` | `CLOSED` |

- دادهٔ تور در UI از مسیر **React Query → لایهٔ سرویس** می‌آید؛ دیگر **`ToursMockProvider`** یا React Context برای تورها وجود ندارد.
- قیمت در API داخل **`costContext`** است؛ mock از شکل `{ currency: "USD", totalCost }` استفاده می‌کند (`formatters.ts`).

### رزرو / بوکینگ (محصول «Booking»)

- دامنهٔ API همان **`registration`** است؛ **`BookingDto`** در **`@repo/types`** یک **alias** برای **`RegistrationResponseDto`** است (بدون فیلدهای mock اضافه در قرارداد فعلی).
- لیست مشارکت‌کننده: **`apps/web/lib/services/bookings.service.ts`** → **`GET /api/v2/bookings`**؛ برای عنوان تور در صورت نیاز از **`GET /api/v2/tours`** کنار کش می‌شود (`BookingsListView`).
- جزئیات: **`booking-detail-client.tsx`** از **`GET /api/v2/registrations/{id}`** و تور استفاده می‌کند.
- گزارش‌گیری لیدر: **`leader-review-client.tsx`** با **`GET /api/v2/tours`** + **`GET /api/v2/tours/{id}/registrations`** نمای تجمیعی می‌سازد و با `PATCH` وضعیت/پرداخت را به‌روزرسانی می‌کند.
- نشان وضعیت برای **`Accepted`** و **`AcceptedPaid`** در UI متن **«Confirmed»** است؛ مقدار سیمی همان **`RegistrationStatus`** (`booking-badges.tsx`).
- برای پرداخت، **`NotPaid`** در برچسب **«Unpaid»** است؛ مقادیر **`Failed`** / **`Refunded`** هم پشتیبانی می‌شوند.

**سابق (دیگر در درخت فعلی `apps/web` استفاده نمی‌شود):** پل mock همگام‌سازی تور → بوکینگ با **`BookingsMockProvider`**، **`notifyBookingsOfTourUpdate`**، و فیلدهای **`tour*Mock`** روی ردیف‌های درون‌حافظه. جریان فعلی با **HTTP واقعی** و **invalidate/refetch** کلیدهای React Query جایگزین شده است؛ اگر در اسناد قدیمی به این نام‌ها برخورد کردید، آن‌ها را legacy بدانید.

---

## TODO / پیگیری

1. هر تغییر در enum **`TourLifecycleStatus`** یا شکل **`TourResponseDto`** در OpenAPI باید هم‌زمان در **`mapTourResponseToDto`**, **`@repo/types`**, و توابع **`tour-lifecycle.ts`** / **`tour-ui-mappers.ts`** بازتاب داده شود تا نگاشت UI (`draft` / `active` / `archived`) با قرارداد منحرف نشود.
2. اگر محصول به **ایمیل شرکت‌کننده** در لیست/جزئیات نیاز دارد، پس از اضافه شدن به **`RegistrationResponseDto`** در OpenAPI، فرانت و CSVهای خروجی را به‌روز کنید.
3. بازنگری دوره‌ای **`bookingStatusLabel`** / **`paymentStatusLabel`** برای هماهنگی با کپی محصول یا نمایش مستقیم enum API.
