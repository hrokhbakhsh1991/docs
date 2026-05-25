import { useFieldArray, useFormContext, useWatch, Controller } from "react-hook-form";
import { Button, FormField, Input, JalaliTimePicker, Select, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { FieldGate } from "@/features/tours/wizard/profileRulesReact";

const SEGMENT_TYPES = ["summit", "trek", "hike", "transfer", "cultural", "social", "rest", "other"] as const;
type SegmentType = (typeof SEGMENT_TYPES)[number];
const SEGMENT_TYPE_OPTIONS: ReadonlyArray<{ value: SegmentType; label: string }> = [
  { value: "summit", label: "صعود" },
  { value: "trek", label: "ترکینگ" },
  { value: "hike", label: "پیاده‌روی" },
  { value: "transfer", label: "جابجایی" },
  { value: "cultural", label: "فرهنگی" },
  { value: "social", label: "اجتماعی" },
  { value: "rest", label: "استراحت" },
  { value: "other", label: "سایر" },
];

const ACTIVITY_TYPE_META: Record<
  SegmentType,
  {
    label: string;
    description: string;
    showDistance: boolean;
    showDuration: boolean;
    showElevation: boolean;
    showTime: boolean;
    showLocation: boolean;
  }
> = {
  summit: {
    label: "صعود",
    description: "بخش کوهستانی/صعودی. ثبت ارتفاع و زمان، کیفیت برنامه را بهتر می‌کند.",
    showDistance: true,
    showDuration: true,
    showElevation: true,
    showTime: true,
    showLocation: true,
  },
  trek: {
    label: "ترکینگ",
    description: "پیمایش طولانی مسیر. مسافت، مدت و موقعیت مهم‌تر هستند.",
    showDistance: true,
    showDuration: true,
    showElevation: true,
    showTime: true,
    showLocation: true,
  },
  hike: {
    label: "پیاده‌روی",
    description: "پیمایش سبک تا متوسط. ثبت مدت و مسافت پیشنهاد می‌شود.",
    showDistance: true,
    showDuration: true,
    showElevation: true,
    showTime: true,
    showLocation: true,
  },
  transfer: {
    label: "جابجایی/ترنسفر",
    description: "بخش جابجایی بین نقاط. زمان شروع/پایان و محل کافی است.",
    showDistance: true,
    showDuration: true,
    showElevation: false,
    showTime: true,
    showLocation: true,
  },
  cultural: {
    label: "فرهنگی",
    description: "بازدید/برنامه فرهنگی. ثبت نام موقعیت و مدت برنامه کافی است.",
    showDistance: false,
    showDuration: true,
    showElevation: false,
    showTime: true,
    showLocation: true,
  },
  social: {
    label: "اجتماعی",
    description: "برنامه گروهی/تعاملی. فیلدهای زمان و توضیح بیشترین کاربرد را دارند.",
    showDistance: false,
    showDuration: true,
    showElevation: false,
    showTime: true,
    showLocation: true,
  },
  rest: {
    label: "استراحت",
    description: "بخش استراحت. فقط زمان و توضیح در صورت نیاز کافی است.",
    showDistance: false,
    showDuration: true,
    showElevation: false,
    showTime: false,
    showLocation: true,
  },
  other: {
    label: "سایر",
    description: "اگر هیچ موردی دقیق نبود این گزینه را بزنید و در توضیح شفاف بنویسید.",
    showDistance: true,
    showDuration: true,
    showElevation: false,
    showTime: true,
    showLocation: true,
  },
};

const defaultSegmentForNewDay = {
  title: "",
  description: "",
  activityType: "other" as const,
  startTime: "",
  endTime: "",
  estimatedDurationHours: undefined,
  distanceKm: undefined,
  elevationGainMeters: undefined,
  maxAltitudeMeters: undefined,
  locationName: "",
};

const mutedHelp = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
} as const;

function computeDurationDaysFromYmd(start: string, end: string): number | undefined {
  const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymdRegex.test(start) || !ymdRegex.test(end)) return undefined;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return undefined;
  if (endDate < startDate) return undefined;
  return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

export function ItineraryStep() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "itinerary.days",
  });
  const daysWatch = useWatch({ control, name: "itinerary.days" });
  const startDate = useWatch({ control, name: "schedule.startDate" });
  const endDate = useWatch({ control, name: "schedule.endDate" });
  const maxDaysBySchedule = computeDurationDaysFromYmd((startDate ?? "").trim(), (endDate ?? "").trim());
  const canAddMoreDays = maxDaysBySchedule == null ? true : fields.length < maxDaysBySchedule;
  const hasScheduleDayLimitError = maxDaysBySchedule != null && fields.length > maxDaysBySchedule;

  const syncDaysToSchedule = () => {
    if (maxDaysBySchedule == null) return;
    if (fields.length <= maxDaysBySchedule) return;
    for (let i = fields.length - 1; i >= maxDaysBySchedule; i -= 1) {
      remove(i);
    }
  };

  return (
    <FieldGate field="itinerary.days">
      <div style={{ display: "grid", gap: "1rem" }}>
        <p style={{ ...mutedHelp, gridColumn: "1 / -1" }}>
          <strong style={{ fontWeight: 600, color: "var(--color-neutral-700, #404040)" }}>این گام چیست؟</strong>
          اینجا <strong>روزبه‌روز اجرای تور</strong> را می‌نویسید (جابجایی عمده در گام «لجستیک» و تاریخ در گام «مکان و زمان» است).
          هر «روز» با روز اول سفر تا آخر هم‌ردیف است؛ اگر تاریخ در گام قبل ناقص باشد محدودیت تعداد روز اینجا نمایش داده نمی‌شود.
          برای هر روز در این فرم فعلاً جزئیات <strong>یک بلوک برنامهٔ اصلی</strong> (بخش اول) پر می‌شود؛ اگر چند مقطع در یک روز دارید، آن‌ها را در «توضیح روز» یا «توضیح بخش» خلاصه کنید.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "grid", gap: "0.35rem", maxWidth: "min(100%, 42rem)" }}>
            <p style={{ ...mutedHelp, margin: 0 }}>
              حداقل یک روز الزامی است؛ برای هر روز حداقل یک بلوک «بخش اول» باید پر شود.
            </p>
            {maxDaysBySchedule != null ? (
              <p style={{ ...mutedHelp, margin: 0, color: "#334155" }}>
                بر اساس تاریخ شروع و پایان در گام «مکان و زمان»، حداکثر{" "}
                <strong>{maxDaysBySchedule.toLocaleString("fa-IR")}</strong> روز می‌توانید اینجا تعریف کنید.
              </p>
            ) : (
              <p style={{ ...mutedHelp, margin: 0 }}>
                اگر هنوز هر دو تاریخ جلالی را در گام قبل قطعی نکرده باشید، اینجا سقف خودکار نمایش داده نمی‌شود؛ بعد از تاریخ، دکمه «افزودن روز» به‌محض رسیدن به سقف غیرفعال می‌شود.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!canAddMoreDays}
            title={
              !canAddMoreDays && maxDaysBySchedule != null
                ? `به‌دلیل بازه تاریخ سفر امکان اضافه کردن روزهای بیشتر از ${maxDaysBySchedule.toLocaleString("fa-IR")} وجود ندارد.`
                : undefined
            }
            onClick={() =>
              append({
                dayNumber: fields.length + 1,
                title: `روز ${fields.length + 1}`,
                description: "",
                segments: [{ ...defaultSegmentForNewDay }],
              })
            }
          >
            افزودن روز
          </Button>
        </div>
        {errors.itinerary?.days?.message ? (
          <p role="alert" style={{ margin: 0, color: "var(--color-danger-700, #b91c1c)", fontSize: "0.85rem" }}>
            {String(errors.itinerary.days.message)}
          </p>
        ) : null}
        {hasScheduleDayLimitError ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#9f1239",
              borderRadius: 10,
              padding: "0.55rem 0.7rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.6rem",
              flexWrap: "wrap",
              fontSize: "0.85rem",
            }}
          >
            <span>تعداد روزهای ثبت‌شده از بازه تاریخ بیشتر است. برای ادامه، روزهای اضافه را حذف کنید.</span>
            <Button type="button" variant="ghost" onClick={syncDaysToSchedule}>
              همگام‌سازی خودکار روزها
            </Button>
          </div>
        ) : null}

        {fields.length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>هنوز روزی اضافه نشده است.</p> : null}

        {fields.map((day, dayIndex) => (
          <div
            key={day.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "0.9rem",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            {(() => {
              const rawType = daysWatch?.[dayIndex]?.segments?.[0]?.activityType;
              const segmentType: SegmentType = SEGMENT_TYPES.includes(rawType as SegmentType)
                ? (rawType as SegmentType)
                : "other";
              const meta = ACTIVITY_TYPE_META[segmentType];
              return (
                <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <strong>روز {dayIndex + 1}</strong>
              <Button type="button" variant="ghost" onClick={() => remove(dayIndex)} disabled={fields.length <= 1}>
                حذف روز
              </Button>
            </div>

            <FormField
              label="عنوان روز"
              description="یک خط عنوان برای کل آن روز (روز اول سفر تا آخر). با «عنوان بخش» فرق دارد اگر آن روز چند مقطع مهم دارد."
              error={errors.itinerary?.days?.[dayIndex]?.title?.message as string}
            >
              <Input type="text" placeholder="مثل: حرکت به مبدأ کوهستانی / شب مانی کمپ قبل از صعود" {...register(`itinerary.days.${dayIndex}.title`)} />
            </FormField>

            <FormField
              label="توضیح روز (اختیاری ولی پیشنهادی)"
              description="جمع‌بندی چندخطی کل روز؛ اگر الان فقط یک بخش دارید باز هم کمک می‌کند مسافر ذهنش قفل نشود."
            >
              <Textarea
                rows={2}
                placeholder={"مثل: صبح حرکت از تهران، بعد از ناهار رسیدن به روستای مبدأ، توزیع وسایل و استراحت قبل از بار کوله"}
                {...register(`itinerary.days.${dayIndex}.description`)}
              />
            </FormField>

            <FormField
              label="نوع فعالیت"
              description={`این فیلد با «تم تور» فرق دارد: تم برای کل تور است؛ نوع فعالیت برای همین بخش برنامه است. ${meta.description}`}
              error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.activityType?.message as string}
            >
              <Select {...register(`itinerary.days.${dayIndex}.segments.0.activityType`)}>
                {SEGMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label={`عنوان بخش اصلی («${meta.label}» برای روز ${dayIndex + 1})`}
              description={`نام همان قطعهٔ اجرایی که الان نوع آن «${meta.label}» است؛ اگر عنوان روز کلی بود، اینجا دقیق‌تر بنویسید.`}
              error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.title?.message as string}
            >
              <Input
                type="text"
                placeholder={
                  meta.showElevation
                    ? `مثل: پیاده‌روی تا کمپ قبل از بار / رسید به ارتفاع فلان متر`
                    : meta.showDistance
                      ? `مثل: ترنسفر بین دو شهر / پیاده‌روی در مسیر فلان`
                      : `مثل: وقت آزاد بازدید / استراحت در اقامتگاه`
                }
                {...register(`itinerary.days.${dayIndex}.segments.0.title`)}
              />
            </FormField>

            <FormField
              label={`توضیح بخش اصلی (${meta.label})`}
              description={`${meta.description} مسیر، زمان تجمع جزئی آن بخش، یا نکات ایمنی همان قطعه را بنویسید.`}
            >
              <Textarea
                rows={2}
                placeholder={
                  meta.showElevation
                    ? "مثل: از پارکینگ تا پناهگاه حدود چهار تا شش ساعت با بار روز؛ ریتم آرام؛ توقف کوتاه برای آب در نقطه فلان."
                    : meta.showDistance
                      ? "مثل: حرکت با وسیله نقلیه محلی تا پارکینگ؛ حدود فلان کیلومتر آسفالت؛ همراه داشتن پتو و آب کافی الزام است."
                      : "مثل: وقت آزاد برای عکاسی؛ ساعت برگشت به محل ملاقات فلان است."
                }
                {...register(`itinerary.days.${dayIndex}.segments.0.description`)}
              />
            </FormField>

            {meta.showLocation ? (
              <FormField
                label="نام موقعیت این بخش"
                description="محل دقیق همین بخش در همان روز (روستا، پناهگاه، نقطهٔ دیدنی)؛ با «نمایش مکان» کل تور یا نقطهٔ ملاقات در گام قبل فرق دارد."
              >
                <Input
                  type="text"
                  placeholder="مثلاً: پناهگاه شیرپلا / قله توچال / مجموعه باستانی فلان"
                  {...register(`itinerary.days.${dayIndex}.segments.0.locationName`)}
                />
              </FormField>
            ) : null}

            {meta.showDistance ? (
              <Controller
                name={`itinerary.days.${dayIndex}.segments.0.distanceKm`}
                control={control}
                render={({ field }) => (
                  <FormField
                    label="مسافت (کیلومتر)"
                    description="طول مسیر تقریبی همین بخش؛ اگر دقیق نیست، عدد حدودی یا خالی بگذارید."
                    error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.distanceKm?.message as string}
                  >
                    <PersianNumberInput
                      numericMode="decimal"
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="مثلاً ۸.۵"
                    />
                  </FormField>
                )}
              />
            ) : null}

            {meta.showElevation ? (
                <>
                  <Controller
                    name={`itinerary.days.${dayIndex}.segments.0.maxAltitudeMeters`}
                    control={control}
                    render={({ field }) => (
                      <FormField
                        label="بیشترین ارتفاع این بخش (متر از سطح دریا)"
                        description="برای صعود و ترکینگ مفید است؛ اگر روز چند قله دارد، مختص همین بخش بنویسید."
                        error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.maxAltitudeMeters?.message as string}
                      >
                        <PersianNumberInput
                          numericMode="integer"
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="مثلاً ۵۶۷۱"
                        />
                      </FormField>
                    )}
                  />

                  <Controller
                    name={`itinerary.days.${dayIndex}.segments.0.elevationGainMeters`}
                    control={control}
                    render={({ field }) => (
                      <FormField
                        label="مجموع صعود ارتفاع (متر)"
                        description="مجموع سربار روی همین بخش؛ اگر نمی‌دانید خالی بماند."
                        error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.elevationGainMeters?.message as string}
                      >
                        <PersianNumberInput
                          numericMode="integer"
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="مثلاً ۱۲۰۰"
                        />
                      </FormField>
                    )}
                  />
                </>
            ) : null}

            {meta.showDuration ? (
              <Controller
                name={`itinerary.days.${dayIndex}.segments.0.estimatedDurationHours`}
                control={control}
                render={({ field }) => (
                  <FormField
                    label="مدت تقریبی این بخش (ساعت)"
                    description="مدت اجرای همین بخش؛ می‌توانید اعشاری بنویسید (مثلاً ۱٫۵ برای یک ساعت و نیم)."
                    error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.estimatedDurationHours?.message as string}
                  >
                    <PersianNumberInput
                      numericMode="decimal"
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="مثلاً ۳ یا ۱.۵"
                    />
                  </FormField>
                )}
              />
            ) : null}

            {meta.showTime ? (
              <>
                <Controller
                  name={`itinerary.days.${dayIndex}.segments.0.startTime`}
                  control={control}
                  render={({ field }) => (
                    <FormField
                      label="زمان شروع (همین بخش)"
                      description="ساعت ۲۴ ساعته به‌صورت HH:mm؛ برای قوت برنامه روز است؛ اگر روز آزاد است خالی بماند."
                      error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.startTime?.message as string}
                    >
                      <JalaliTimePicker
                        ref={field.ref}
                        name={field.name}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormField>
                  )}
                />

                <Controller
                  name={`itinerary.days.${dayIndex}.segments.0.endTime`}
                  control={control}
                  render={({ field }) => (
                    <FormField
                      label="زمان پایان (همین بخش)"
                      description="باید بعد از زمان شروع باشد؛ با ساعت تجمع کلی تور در گام مکان اشتباه نشود (اینجا فقط برنامهٔ همین بخش است)."
                      error={errors.itinerary?.days?.[dayIndex]?.segments?.[0]?.endTime?.message as string}
                    >
                      <JalaliTimePicker
                        ref={field.ref}
                        name={field.name}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormField>
                  )}
                />
              </>
            ) : null}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </FieldGate>
  );
}
