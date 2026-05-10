# PROMPT 1 — تحلیل پیاده‌سازی فعلی `/tours/new` و فرم‌های مرتبط

این سند خروجی **SECTION 1** از `prompt.md` است؛ فقط تحلیل است، بدون تغییر کد.

---

## FormStructure

- **Route:** `apps/web/app/(app)/tours/new/page.tsx` → کامپوننت **`TourCreateClient`** (`apps/web/src/features/tours/components/tour-create-client.tsx`).
- **الگو:** فرم **تک‌صفحه‌ای** (یک `<form>`)، بدون stepper/wizard. چیدمان عمودی با فاصلهٔ ثابت.
- **React Hook Form:** یک بار **`useForm<TourCreateFormInput, unknown, TourCreateModel>`** با **`FormProvider`** برای کل درخت.
- **زیرکامپوننت‌های اصلی:**
  - **`TourDestinationSelectField`** — انتخاب `destinationId` (گروه‌بندی با region از settings).
  - **`TourLocationSection`** — با `hideRegionDestinationPickers`؛ خودش از **`useFormContext`** استفاده می‌کند؛ فیلدهای نمایشی مکان/ملاقات/بازگشت و `locationSection.*`.
  - **`TourCreateTripDetailsFields`** — تقریباً تمام زیرشاخهٔ **`tripDetails`**؛ داخل خودش چند **`CollapsibleSection`** (`<details>`) برای overview / itinerary / participation / logistics / policies.
- **تکرارپذیرها:** **`useFieldArray`** برای `socialLinks` در `TourCreateClient`؛ **`useFieldArray`** برای `tripDetails.itinerary.dayPlans` داخل `TourCreateTripDetailsFields`.
- **گیت‌های قبل از فرم:** در `TourCreateClient` اگر session/API/نقش leader نباشد، به‌جای فرم **`EmptyState`** / **`LoadingState`** نشان داده می‌شود.
- **هم‌خوانی با ویرایش تور:** همان بلوک trip details در **`TourForm`** (`apps/web/src/components/tours/TourForm.tsx`) با props متفاوت (مثلاً `suppressLogisticsMeetingAndReturn`) دوباره استفاده می‌شود.

---

## Validation

- **کتابخانه:** **Zod** + **`@hookform/resolvers/zod`**.
- **Resolver پویا:** در `TourCreateClient` به‌جای یک schema ثابت، تابع **`resolver`** با **`useCallback`** روی هر validate، ابتدا **`eventKind`** را از **`resolveEventKindFromTourContext({ tourType, tripStyles از values })`** می‌گیرد و سپس **`zodResolver(createTourCreateSchemaForEventKind(eventKind, validationMessages))`** را صدا می‌زند.
- **پیام‌ها:** **`buildToursNewValidationMessages(t)`** (next-intl) → **`ToursNewValidationMessages`**؛ طول عنوان و پیام‌های trip details از `tours-new-validation-messages.ts`.
- **لایهٔ trip details در Zod:**
  - **`TourTripDetailsRootSchema`** + **`applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForKind(eventKind), messages)`** در `tourCreateModel.ts` — یعنی **الزامی/اختیاری** زیرفیلدهای trip details به **نوع رویداد** (`generic`/`mountain`/…) و **`tripDetailsFieldConfig.ts`** گره خورده است.
  - در `tourTripDetails.schema.ts`: قوانین جزئی، **superRefine** برای تاریخ‌ها (نبودن در گذشته، return ≥ departure)، تداخل audience، و غیره.
- **اعتبار نقش کاربر:** ظرفیت (`capacity`) با **`resolveFieldAccess(core.capacity, viewerRole)** ممکن است **مخفی** شود؛ validation schema همچنان capacity را الزام می‌کند unless جداگانه handle شود — الگوی فعلی فرم همچنان فیلد را برای leader نشان می‌دهد.
- **ارسال فرم:** `handleSubmit` با **`noValidate`** روی `<form>` (اعتبارسنجی سمت کلاینت با Zod).

---

## PayloadMapping

1. **خروجی RHF پس از validate:** نوع **`TourCreateModel`** (خروجی schema).
2. **پیش‌پردازش قبل از mutation:** **`enrichTourCreateFromDestinationSelection(values, allDestinations)`** در `tour-create-client.tsx` — اگر `destinationId` انتخاب شده باشد، **`locationSection.regionId`** و **`mainDestinationId`** را از رکورد destination پر می‌کند.
3. **Mutation:** **`useCreateTour`** (`apps/web/src/features/tours/hooks/useCreateTour.ts`):
   - `themeCatalog` از payload جدا می‌شود؛ بقیه به **`mapCreateTourDto(rest, { themeCatalog })`** می‌رود.
   - **`createTour(...)`** در `apps/web/lib/services/tours.service.ts`.
4. **نگاشت دامنه:** **`mapCreateTourDto`** (`apps/web/src/features/tours/domain/mapCreateTourDto.ts`):
   - **`injectLocationSectionIntoTripDetails`** — در صورت داشتن region + mainDestination در `locationSection`، کلیدهایی مثل **`settingsRegionId`**, **`settingsMainDestinationId`**, **`secondaryDestinationIdsRaw`** را داخل **`tripDetails.overview`** می‌نشاند (باید با DTO بک‌اند سازگار باشد؛ در API فعلی Nest فقط کلیدهای whitelisted در DTO قبول می‌شوند).
   - **`applyTourThemeOverviewEnrichment`** — **`tourThemeLabels`** را از catalog پر می‌کند.
   - **`compactTripDetailsForApi`** — حذف empty، normalize **`dayPlans`**, آرایه‌ها و رشته‌ها برای JSON امن.
   - **`derivedDurationDays`** از **`tripDetailsCompact.logistics.departureDate` / `returnDate`** اگر هر دو معتبر باشند.
   - **`communicationLink`** از اولین `socialLinks[].url` غیر خالی یا فیلد `communicationLink`.
5. **بدنهٔ HTTP:** **`toCreateTourApiBody`** در همان `tours.service.ts`:
   - فیلدهای سطح بالا برای Nest: **`total_capacity`**, **`lifecycle_status`**, **`chat_link`**, **`cost_context`** (شامل `currency`, `totalCost` از `price`, و اختیاری `location` از override), **`tourType`**, **`transportModes`**, **`durationDays`**, **`tripDetails`**, **`destinationId`**, **`autoAcceptRegistrations`**, **`description`**.
6. **مسیر شبکه:** **`POST`** به **`/api/v2/tours`** (ثابت `API.tours` در `apps/web/lib/api-client` با اصل مناسب بک‌اند؛ در مرورگر معمولاً از طریق proxy/URL پیکربندی‌شده).

---

## ItineraryHandling

- **مسیر داده در فرم:** **`tripDetails.itinerary`** — مطابق Zod در `tourTripDetails.schema.ts` و UI در `TourCreateTripDetailsFields`.
- **ساختار فعلی (frontend / JSON ارسالی):**
  - آرایه‌های تگ‌مانند: **`highlights`**, **`includedVisits`**, **`excludedVisits`**, **`optionalActivities`**, **`specialExperiences`** (رشته در هر آیتم).
  - متن: **`outline`**, **`programNotes`**.
  - **برنامهٔ روزبه‌روز:** **`dayPlans[]`** — هر آیتم با فیلدهای **`day`** (شماره روز، اجباری در schema per row), **`title?`**, **`description?`**, **`distanceKm?`**, **`elevationGainM?`**؛ از طریق **`PersianNumberInput`** / **`Input`** / **`Textarea`** و دکمه‌های add/remove.
- **پیش‌فرض RHF:** در `TourCreateClient`، **`tripDetails.itinerary.dayPlans: []`** و logistics اولیه با `meetingPoint`/`returnPoint` خالی.
- **تفاوت با مدل «روز + سگمنت» در README wizard:** فعلی **سگمنت تایپ‌شده** (cultural/summit/…) **ندارد**؛ فقط **یک ردیف per day** با فیلدهای عددی/متنی.
- **بک‌اند:** همان ساختار تحت **`TripDetailsItineraryDto`** / تایپ **`TripDetailsItinerary`** در Nest اعتبارسنجی می‌شود؛ ستون جداگانه **`tour_details.itinerary`** (legacy JSON array) با این JSONB **`trip_details.itinerary`** متفاوت است مگر نگاشت صریح.

---

## KeyFiles

| نقش | مسیر |
|-----|------|
| صفحه route | `apps/web/app/(app)/tours/new/page.tsx` |
| فرم ایجاد تور | `apps/web/src/features/tours/components/tour-create-client.tsx` |
| فیلدهای trip details (مشترک با edit) | `apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx` |
| انتخاب مقصد | `apps/web/src/features/tours/components/tour-destination-select-field.tsx` |
| بخش مکان (FormContext) | `apps/web/src/features/tours/components/tour-location-section.tsx` |
| مدل + schema ایجاد تور | `apps/web/src/features/tours/models/tourCreateModel.ts` |
| schema جزئیات سفر + compact | `apps/web/src/features/tours/models/tourTripDetails.schema.ts` |
| پیام‌های validation | `apps/web/src/features/tours/models/tours-new-validation-messages.ts` |
| i18n پیام‌ها | `apps/web/src/features/tours/i18n/build-tours-new-validation-messages.ts` |
| سیاست event kind / فیلدها | `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` |
| resolver نوع رویداد | `packages/types/src/tour-kind.ts` (و export در `apps/web/.../policies/tour-kind-policy.ts`) |
| نگاشت به DTO API | `apps/web/src/features/tours/domain/mapCreateTourDto.ts` |
| محاسبه duration | `apps/web/src/features/tours/domain/computeTourDurationDays.ts` |
| mutation | `apps/web/src/features/tours/hooks/useCreateTour.ts` |
| مقاصد (React Query) | `apps/web/src/hooks/use-tour-destinations.ts` |
| تم‌ها / تجهیزات / زبان راهنما | `apps/web/src/hooks/use-settings-tour-themes.ts`, `use-settings-equipment.ts`, `use-settings-guide-languages.ts` |
| کلاینت API تور | `apps/web/lib/services/tours.service.ts` |
| فرم ویرایش (مرجع) | `apps/web/src/components/tours/TourForm.tsx` |
| schema ویرایش (متفاوت از create در فیلدهای ریشه) | `apps/web/src/components/tours/tour-schema.ts` |

**تایپ‌های مرتبط:** `TourCreateFormInput`, `TourCreateModel`, `TourTripDetails`, `SocialLink`, `TourLocationSectionModel`, `CreateTourDto` (web type در `tours.service.ts`), `MapCreateTourDtoInput`.

---

*پایان خروجی PROMPT 1 — آماده برای SECTION 2 (Wizard shell).*
