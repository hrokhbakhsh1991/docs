# Tour Create Wizard — Context & Constraints (Section 0)

این سند **زمینهٔ کامل** برای ریفکتور صفحهٔ **`/tours/new`** به یک **Wizard چندمرحله‌ای** است و باید در تمام مراحل بعدی (`prompt.md` SECTION 1+) به‌عنوان مرجع استفاده شود.

---

## 1. هدف محصول

- Wizard چندمرحله‌ای برای ساخت تور و پر کردن **`trip_details`** (JSONB روی `tour_details.trip_details` در بک‌اند).
- پشتیبانی از سناریوهای ترکیبی: چند فعالیت در یک روز، کوهنوردی + فرهنگی + اجتماعی، چندروزه، دورهمی‌های سبک، و غیره.
- **Stack:** Next.js (App Router در این monorepo)، React، TypeScript، **React Hook Form**، **Zod**، بک‌اند **NestJS** و REST.

---

## 2. مدل دامنه بک‌اند (واقعیت فعلی)

### 2.1 ذخیره‌سازی

| لایه | توضیح |
|------|--------|
| جدول | `tour_details` |
| ستون JSONB | `trip_details` → نوع TypeScript قراردادی: `TourTripDetails` در `apps/api/src/modules/tours/types/tour-trip-details.types.ts` |
| ستون‌های قدیمی جدا از JSONB | `destination_name`, `elevation_m`, `difficulty`, `duration_days`, `meeting_point`, `itinerary` (آرایهٔ JSON قدیمی) — ممکن است با JSONB همپوشانی معنایی داشته باشند |

### 2.2 بخش‌های `trip_details` (قرارداد فعلی API)

- **`schemaVersion`** (اختیاری)
- **`overview`** — مقصد متنی، منطقه، `tourThemeIds` / `tourThemeLabels`, `tripStyles`, `difficultyLevel` (۱–۱۰ با پلهٔ ۰.۵), ارتفاع‌ها، `shortIntro`, `bestFor` (legacy)
- **`itinerary`** — لیست‌های تگ‌مانند، `outline`, `programNotes`, **`dayPlans[]`** با `{ day, title?, description?, distanceKm?, elevationGainM? }`
- **`participation`** — سن، جنسیت، fitness/experience، gear UUIDها، audience matrix، و غیره
- **`logistics`** — تاریخ رفت/برگشت، نقطه ملاقات، اقامت، وعده غذایی، `guideLanguageIds`, و غیره
- **`policies`** — متن‌های سیاست

**Validation بک‌اند:** `ValidationPipe` با `whitelist` + `forbidNonWhitelisted` روی DTOهای تو در تو؛ فیلدهای ناشناس در بدنه رد می‌شوند.

**Gate نمونه:** فیلدهای فقط-کوهستان (مثل `maxAltitudeMeters` در overview) در سرور برای `tourType !== mountain` حذف می‌شوند (`applyTourTypeFieldGates`).

### 2.3 `eventKind`

- از **`tourType`** و (در سازگاری legacy) مقادیر قدیمی داخل **`tripStyles`** استنتاج می‌شود (`resolveEventKindFromTourContext` در `@repo/types`).
- فرانت فعلی همان منطق را برای Zod (الزام فیلدها per kind) در `tripDetailsFieldConfig` و `createTourCreateSchemaForEventKind` استفاده می‌کند.

---

## 3. مدل هدف Wizard (پیشنهادی — برای itinerary و overview غنی‌تر)

این بخش **هدف طراحی** است؛ هم‌ترازی کامل با DTO فعلی Nest نیاز به **لایهٔ نگاشت (mapper)** دارد، نه ارسال مستقیم بدون تطبیق.

### 3.1 Itinerary — سگمنت‌ها و روزها

```ts
type TourItinerarySegmentType =
  | "approach"
  | "summit"
  | "hike"
  | "trek"
  | "transfer"
  | "cultural"
  | "historical"
  | "social"
  | "rest"
  | "other";

type TourItinerarySegment = {
  id?: string;
  type: TourItinerarySegmentType;
  title: string;
  description?: string;
  location?: string;
  maxAltitudeMeters?: number;
  distanceKm?: number;
  estimatedDurationHours?: number;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
};

type TourItineraryDay = {
  dayIndex: number;
  title?: string;
  dateOffset?: number; // 0-based offset from start date
  description?: string;
  segments: TourItinerarySegment[];
};

type TourItinerary = {
  days: TourItineraryDay[];
};
```

**تفاوت با فرانت/بک فعلی:** امروز `itinerary.dayPlans` ساختار **تخت‌تر** دارد (بدون آرایهٔ `segments` per day). افزودن مدل روز + سگمنت نیاز به **نسخه‌گذاری schema** یا نگاشت دوطرفه به `dayPlans`/متن دارد تا سازگاری عقب‌رو حفظ شود.

### 3.2 Overview — ساختار ساده‌شدهٔ هدف (مفهومی)

```ts
type TourOverview = {
  title: string;
  slug?: string;
  mainTheme: "mountaineering" | "trekking" | "cultural" | "social" | "mixed";
  secondaryThemes?: string[];
  tourType?: string;
  tripStyles?: string[];
  shortDescription: string;
  longDescription?: string;
  highlights?: string[];
  locationSummary?: string;
  // سایر فیلدهای هم‌تراز با overview فعلی API پس از نگاشت
};
```

**توجه:** فیلدهایی مثل `title` تور در مدل فعلی در **ریشهٔ تور** (`tours.title`) است نه داخل `trip_details.overview`. Wizard باید یا همان قرارداد را حفظ کند یا با بک‌اند برای انتقال فیلدها توافق شود.

---

## 4. جریان Wizard پیشنهادی (۸ مرحله — UX)

| مرحله | محتوا |
|-------|--------|
| 1 | Basic Info (overview مفهومی + نوع/استایل) |
| 2 | Capacity & Pricing |
| 3 | Location & Dates |
| 4 | Itinerary (چند روز، چند سگمنت) |
| 5 | Participation & Requirements |
| 6 | Services & Logistics |
| 7 | Policies & Safety |
| 8 | Review & Submit |

جزئیات UI قابل تنظیم است؛ ترتیب باید با **یک فرم RHF واحد** و **Zod** هم‌خوان باشد.

---

## 5. محدودیت‌های فنی (الزامات SECTION 0)

1. **سازگاری با API Nest فعلی** — تا زمان تغییر DTO، payload نهایی باید با `CreateTourDto` / `TourTripDetailsDto` سازگار بماند یا backend به‌صورت صریح گسترش یابد.
2. **React Hook Form + Zod** — ترجیح: **یک `useForm` مشترک** در ریشهٔ Wizard + `FormProvider` برای همهٔ گام‌ها.
3. **مرکزی بودن state فرم** — از چند فرم مستقل per-step بدون همگام‌سازی آگاهانه پرهیز شود مگر الگوی صریح «merge».
4. **پشتیبانی از موارد پیچیده:** دو قله در یک روز؛ ترکیب mountaineering + cultural + social؛ چندروزه.
5. **سازگاری عقب‌رو:** تورهای ذخیره‌شده با `dayPlans` قدیمی و کلیدهای legacy در JSONB باید قابل خواندن/ادغام بمانند (نگاشت و نسخه schema).

---

## 6. فایل‌های کلیدی فعلی (مرجع پیاده‌سازی)

| ناحیه | مسیر |
|--------|------|
| صفحه route | `apps/web/app/(app)/tours/new/page.tsx` |
| کامپوننت اصلی فرم | `apps/web/src/features/tours/components/tour-create-client.tsx` |
| فیلدهای trip details | `apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx` |
| اسکیمای Zod ایجاد تور | `apps/web/src/features/tours/models/tourCreateModel.ts`, `tourTripDetails.schema.ts` |
| نگاشت به API | `apps/web/src/features/tours/domain/mapCreateTourDto.ts`، `apps/web/lib/services/tours.service.ts` (`toCreateTourApiBody`) |
| سیاست فیلدها per kind | `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` |
| فرم ویرایش (اشتراک trip details UI) | `apps/web/src/components/tours/TourForm.tsx` |
| تایپ بک‌اند `trip_details` | `apps/api/src/modules/tours/types/tour-trip-details.types.ts` |
| DTO اعتبارسنجی | `apps/api/src/modules/tours/dto/trip-details.dto.ts` |

---

## 7. مرجع متنی اضافی

- **`prompt.md`** — پرامپت‌های مرحله‌به‌مرحله (SECTION 1+).
- **`tour-create-wizard.prompt.md`** — پیش‌نویس طولانی‌تر طراحی دامنه و UX (با فرمت ناهموار؛ این README جمع‌بندی مرجع است).
- **`ANALYSIS-tour-create-current.md`** — خروجی **PROMPT 1** (تحلیل پیاده‌سازی فعلی `/tours/new`: FormStructure, Validation, PayloadMapping, ItineraryHandling, KeyFiles).

---

## 8. تأیید SECTION 0 (آمادگی برای Step 1)

**درک ما از زمینه:**

- هدف تبدیل **`/tours/new`** از فرم تک‌صفحهٔ فعلی به **Wizard** است، بدون پرت کردن قرارداد بک‌اند مگر با برنامهٔ صریح.
- **`trip_details`** کانون انعطاف است؛ itinerary هدف (روز + سگمنت) **فراتر از** شکل فعلی `dayPlans` است و نیاز به **نگاشت/نسخه** دارد.
- **`eventKind`** برای الزامات validation و نمایش فیلدها حیاتی است و باید در Wizard با همان منطق فعلی (`tourType` / `tripStyles`) هم‌راستا بماند.
- فرانت فعلی از **یک RHF + resolver پویا (Zod per eventKind)** و **`TourCreateTripDetailsFields`** مشترک با ویرایش تور استفاده می‌کند.

**تمرکز Step 1 (تحلیل، بدون کدنویسی Wizard):**

- مرور دقیق `TourCreateClient`, `TourCreateTripDetailsFields`, اسکیماهای Zod، و `mapCreateTourDto`.
- جدول‌بندی: ساختار فرم، validation، نگاشت payload، و نحوهٔ مدیریت itinerary امروز.
- فهرست مسیر فایل‌ها و نام تایپ‌ها برای شروع ریفکتور امن.

---

*این سند با اجرای **PROMPT 0** از `prompt.md` (SECTION 0 — Context & Constraints) تولید/تثبیت شده است.*
