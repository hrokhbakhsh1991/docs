import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { FormField, Input, JalaliDatePicker, JalaliTimePicker } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { FieldGate } from "@/features/tours/wizard/profileRulesReact";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

const PATHS = {
  startDate: "schedule.startDate" as WizardFieldPath,
  endDate: "schedule.endDate" as WizardFieldPath,
  mainDestinationId: "location.mainDestinationId" as WizardFieldPath,
  regionId: "location.regionId" as WizardFieldPath,
  secondaryDestinationIds: "location.secondaryDestinationIds" as WizardFieldPath,
  meetingPoint: "location.meetingPoint" as WizardFieldPath,
  returnPoint: "location.returnPoint" as WizardFieldPath,
  departureMeetingTime: "schedule.departureMeetingTime" as WizardFieldPath,
  returnMeetingTime: "schedule.returnMeetingTime" as WizardFieldPath,
  displayLocation: "location.displayLocation" as WizardFieldPath,
} as const;

/** Local-time Gregorian YMD (avoids timezone drift from `toISOString`). */
function toGregorianYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LocationDatesStep() {
  const {
    register,
    control,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();
  const t = useTranslations("tours.new");
  const destinationsQuery = useTourDestinations();

  const startDateWatch = useWatch({ control, name: "schedule.startDate" });

  const todayYmd = useMemo(() => toGregorianYmd(new Date()), []);
  const maxBookableYmd = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return toGregorianYmd(d);
  }, []);

  /** End date cannot be before start date (same rule as create-trip logistics). */
  const endMinYmd = useMemo(() => {
    const start = typeof startDateWatch === "string" ? startDateWatch.trim() : "";
    return start && start > todayYmd ? start : todayYmd;
  }, [startDateWatch, todayYmd]);

  const activeDestinations = useMemo(
    () =>
      destinationsQuery.groupedRegions.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          name: item.name,
          regionId: group.regionId,
          regionName: group.regionName,
        })),
      ),
    [destinationsQuery.groupedRegions],
  );
  const selectedMainDestinationId = useWatch({ control, name: "location.mainDestinationId" });
  const selectedRegionId = useWatch({ control, name: "location.regionId" });
  const selectedSecondaryDestinationIds = useWatch({ control, name: "location.secondaryDestinationIds" });
  const departureMeetingTimeWatch = useWatch({ control, name: "schedule.departureMeetingTime" });
  const returnMeetingTimeWatch = useWatch({ control, name: "schedule.returnMeetingTime" });
  const secondaryOptions = useMemo(() => activeDestinations, [activeDestinations]);
  const selectedMainDestination = useMemo(
    () => activeDestinations.find((d) => d.id === selectedMainDestinationId),
    [activeDestinations, selectedMainDestinationId],
  );
  const selectedRegionName = useMemo(() => {
    if (!selectedRegionId) return "";
    const group = destinationsQuery.groupedRegions.find((g) => g.regionId === selectedRegionId);
    return group?.regionName ?? "";
  }, [destinationsQuery.groupedRegions, selectedRegionId]);

  const timeOrderError = "ساعت بازگشت باید بعد از ساعت رفت باشد.";

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <FieldGate field={PATHS.startDate}>
        <Controller
          name="schedule.startDate"
          control={control}
          render={({ field }) => (
            <FormField label={t("trip_departureDateLabel")} error={errors.schedule?.startDate?.message}>
              <JalaliDatePicker
                ref={field.ref}
                name={field.name}
                value={typeof field.value === "string" ? field.value : ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.schedule?.startDate)}
                minDate={todayYmd}
                maxDate={maxBookableYmd}
                clearLabel={t("trip_jalaliClear")}
                openCalendarAriaLabel={t("trip_openCalendarAria")}
              />
            </FormField>
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.endDate}>
        <Controller
          name="schedule.endDate"
          control={control}
          render={({ field }) => (
            <FormField label={t("trip_returnDateLabel")} error={errors.schedule?.endDate?.message}>
              <JalaliDatePicker
                ref={field.ref}
                name={field.name}
                value={typeof field.value === "string" ? field.value : ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.schedule?.endDate)}
                minDate={endMinYmd}
                maxDate={maxBookableYmd}
                clearLabel={t("trip_jalaliClear")}
                openCalendarAriaLabel={t("trip_openCalendarAria")}
              />
            </FormField>
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.mainDestinationId}>
        <Controller
          name="location.mainDestinationId"
          control={control}
          render={({ field }) => (
            <DestinationCombobox
              label="مقصد اصلی (جستجو با منطقه/مقصد)"
              placeholder="مثلا: مازندران، دماوند، الموت"
              options={activeDestinations}
              value={field.value}
              excludeIds={selectedSecondaryDestinationIds ?? []}
              error={errors.location?.mainDestinationId?.message}
              onChange={(nextValue) => {
                const nextMainId = typeof nextValue === "string" ? nextValue : "";
                const chosen = activeDestinations.find((d) => d.id === nextMainId);
                field.onChange(nextMainId || undefined);
                setValue("location.regionId", chosen?.regionId ?? "", { shouldDirty: true, shouldValidate: true });
                if (nextMainId) {
                  const secondary = selectedSecondaryDestinationIds ?? [];
                  if (secondary.includes(nextMainId)) {
                    setValue(
                      "location.secondaryDestinationIds",
                      secondary.filter((id) => id !== nextMainId),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }
                }
              }}
            />
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.regionId}>
        <FormField label="منطقه انتخاب‌شده" error={errors.location?.regionId?.message}>
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#f8fafc",
              padding: "0.55rem 0.7rem",
              fontSize: "0.9rem",
              color: selectedRegionName ? "#0f172a" : "#64748b",
            }}
          >
            {selectedRegionName || "ابتدا مقصد اصلی را انتخاب کنید"}
          </div>
        </FormField>
      </FieldGate>

      {selectedMainDestination ? (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>
          مقصد اصلی انتخاب‌شده: {selectedMainDestination.regionName} / {selectedMainDestination.name}
        </p>
      ) : null}
      {destinationsQuery.isLoading ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-neutral-600, #525252)" }}>
          در حال بارگذاری مقصدها از تنظیمات…
        </p>
      ) : null}
      {destinationsQuery.error ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-danger-600, #b91c1c)" }} role="alert">
          بارگذاری مقصدها ناموفق بود.
        </p>
      ) : null}

      <FieldGate field={PATHS.secondaryDestinationIds}>
        <Controller
          control={control}
          name="location.secondaryDestinationIds"
          render={({ field }) => (
            <DestinationCombobox
              multiple
              label="مقصدهای ثانویه (چندانتخابی)"
              placeholder="در صورت چندمقصدی بودن تور، اینجا اضافه کنید"
              options={secondaryOptions}
              value={field.value ?? []}
              excludeIds={selectedMainDestinationId ? [selectedMainDestinationId] : []}
              error={errors.location?.secondaryDestinationIds?.message as string | undefined}
              onChange={(nextValue) => {
                const values = Array.isArray(nextValue) ? nextValue : [];
                field.onChange(values.filter((id) => id !== selectedMainDestinationId));
              }}
            />
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.meetingPoint}>
        <FormField
          label="نقطه ملاقات"
          description="محل فیزیکی دقیق حضور مسافر قبل از شروع برنامه (آدرس قابل پیدا کردن روی نقشه)."
          error={errors.location?.meetingPoint?.message}
        >
          <Input type="text" placeholder="مثلا: تهران، میدان ونک، روبه‌روی ترمینال" {...register("location.meetingPoint")} />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.returnPoint}>
        <FormField
          label="نقطه بازگشت"
          description="محلی که تور در پایان به آن برمی‌گردد؛ اگر همان نقطه ملاقات است همان را وارد کنید."
          error={errors.location?.returnPoint?.message}
        >
          <Input type="text" placeholder="مثلا: همان نقطه ملاقات / ترمینال جنوب" {...register("location.returnPoint")} />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.departureMeetingTime}>
        <Controller
          name="schedule.departureMeetingTime"
          control={control}
          render={({ field }) => (
            <FormField
              label="ساعت تجمع/حرکت"
              description="این فیلد «زمان» است، نه «مکان». مکان تجمع در فیلد «نقطه ملاقات» ثبت می‌شود."
              error={errors.schedule?.departureMeetingTime?.message}
            >
              <JalaliTimePicker
                ref={field.ref}
                name={field.name}
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(next) => {
                  field.onChange(next);
                  if ((returnMeetingTimeWatch ?? "").trim() && (returnMeetingTimeWatch ?? "") <= next) {
                    setValue("schedule.returnMeetingTime", "", { shouldDirty: true, shouldValidate: true });
                    setError("schedule.returnMeetingTime", { type: "validate", message: timeOrderError });
                  } else {
                    clearErrors("schedule.returnMeetingTime");
                  }
                }}
                onBlur={field.onBlur}
                invalid={Boolean(errors.schedule?.departureMeetingTime)}
                minuteStep={5}
                hourLabel={t("trip_timeHourLabel")}
                minuteLabel={t("trip_timeMinuteLabel")}
                confirmLabel={t("trip_timeConfirm")}
                cancelLabel={t("trip_timeCancel")}
                clearLabel={t("trip_timeClear")}
                openPickerAriaLabel={t("trip_timeOpenPickerAria")}
              />
            </FormField>
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.returnMeetingTime}>
        <Controller
          name="schedule.returnMeetingTime"
          control={control}
          render={({ field }) => (
            <FormField
              label="ساعت بازگشت"
              description="زمان تقریبی پایان برنامه/بازگشت. باید بعد از ساعت تجمع/حرکت باشد."
              error={errors.schedule?.returnMeetingTime?.message}
            >
              <JalaliTimePicker
                ref={field.ref}
                name={field.name}
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(next) => {
                  const departure = (departureMeetingTimeWatch ?? "").trim();
                  if (departure && next && next <= departure) {
                    setError("schedule.returnMeetingTime", { type: "validate", message: timeOrderError });
                    return;
                  }
                  clearErrors("schedule.returnMeetingTime");
                  field.onChange(next);
                }}
                onBlur={field.onBlur}
                invalid={Boolean(errors.schedule?.returnMeetingTime)}
                minuteStep={5}
                hourLabel={t("trip_timeHourLabel")}
                minuteLabel={t("trip_timeMinuteLabel")}
                confirmLabel={t("trip_timeConfirm")}
                cancelLabel={t("trip_timeCancel")}
                clearLabel={t("trip_timeClear")}
                openPickerAriaLabel={t("trip_timeOpenPickerAria")}
              />
            </FormField>
          )}
        />
      </FieldGate>

      <FieldGate field={PATHS.displayLocation}>
        <FormField
          label="نمایش مکان"
          description="متن نمایشی کوتاه برای کارت/لیست تور. برای نمایش کاربرپسند استفاده می‌شود، نه برای مسیریابی دقیق."
          error={errors.location?.displayLocation?.message}
        >
          <Input type="text" placeholder="مثلا: البرز مرکزی | دماوند و اطراف" {...register("location.displayLocation")} />
        </FormField>
      </FieldGate>
    </div>
  );
}
