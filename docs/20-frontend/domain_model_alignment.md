# هم‌ترازی مدل دامنهٔ فرانت با API

فرانت‌اند وب همچنان **فقط با mock** کار می‌کند؛ این سند توضیمی است که تایپ‌ها و دادهٔ آزمایشی با چه قراردادهایی از backend هم‌خوان شده‌اند.

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

## انحرافهای آگاهانه (mock / UI)

### تور (دامنهٔ نمایشی، هم‌تراز با `TourDto` + چرخهٔ عمر)

- **`lifecycleStatus`** در لایهٔ سرویس (`lib/services/tours.service.ts` به‌شکل `TourDetailDto`) نگه‌داری می‌شود چون در پاسخ GET تور فعلی در OpenAPI فیلد چرخهٔ عمر در پاسخ لیست نشده؛ برای UX فرم/لیست به آن نیاز داریم.
- دادهٔ تور در UI از مسیر **React Query → لایهٔ سرویس** می‌آید؛ دیگر **`ToursMockProvider`** یا React Context برای تورها وجود ندارد.
- فرم همچنان برچسب‌های **Draft / Published / Archived** را نشان می‌دهد؛ در لایهٔ نگاشت UI به **`DRAFT` / `OPEN` / `CLOSED`** تبدیل می‌شود (`apps/web/app/(app)/tours/tour-ui-mappers.ts`).
- قیمت در API داخل **`costContext`** است؛ mock از شکل `{ currency: "USD", totalCost }` استفاده می‌کند (`formatters.ts`).

### رزرو / بوکینگ (`MockBooking`)

- دامنهٔ API **registration** است؛ `MockBooking` = **`RegistrationResponseDto`** به‌علاوه:
  - **`tourTitleMock`**, **`tourStartDateMock`**, **`tourPriceAmountMock`** — فقط برای لیست/جزئیات بدون fetch تور جدا.
  - **`participantEmailMock`** — در DTO ثبت‌نام در schema فعلی نیست؛ فقط mock.
- نشان وضعیت رزرو در UI برای **`Accepted`** و **`AcceptedPaid`** متن **«Confirmed»** نشان می‌دهد؛ مقدار ذخیره‌شده همان enum API است (`booking-badges.tsx`).
- برای پرداخت، **`NotPaid`** در برچسب به صورت **«Unpaid»** نمایش داده می‌شود.

## همگام‌سازی تور → بوکینگ (mock، دوران انتقالی)

وقتی تور از مسیر **React Query / mutation** در **`lib/services/tours.service.ts`** به‌روز می‌شود، **`notifyBookingsOfTourUpdate`** (`workspace-mock-sync-bridge.ts`) با **`tourToBookingDenormSnapshot`** (`tour-ui-mappers.ts`) فقط فیلدهای **`tour*Mock`** روی ردیف‌های mock بوکینگ را هماهنگ می‌کند؛ **`BookingsMockProvider`** همچنان subscriber این bridge است. این یک پل موقت است تا وقتی registration واقعی تور را embed کند یا cache invalidate شود.

---

## TODO هنگام اتصال HTTP واقعی

1. جایگزینی بدنهٔ متدهای `lib/services/*.service.ts` با فراخوانی **`apiClient`** از **`apps/web/lib/api-client.ts`** (`NEXT_PUBLIC_API_URL`) به‌جای state درون حافظه؛ کلیدهای React Query در **`apps/web/lib/query-keys.ts`** (`tourKeys`, `bookingKeys`, `userKeys`) آمادهٔ Invalidate مرکزی هستند.
2. حذف یا جایگزینی **`lifecycleStatus`** محلی اگر GET تور در API فیلد معادل برگرداند.
3. حذف **`tourTitleMock`** و مشابه‌ها وقتی لیست/جزئیات registration تور را embed می‌کند یا join سمت سرور دارد.
4. حذف **`participantEmailMock`** وقتی API ایمیل شرکت‌کننده را برمی‌گرداند (یا از منبع دیگری پر می‌شود).
5. بازنگری **`bookingStatusLabel`** / **`paymentStatusLabel`** تا یا با محصول یکسان شوند یا مستقیماً enum API نشان داده شود.
