import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";
import { TOUR_TYPES, type TourFormProfile } from "@repo/types";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Input, Select, Textarea } from "@tour/ui";

import { TourCreationPresetBanner } from "@/features/tours/wizard/TourCreationPresetBanner";
import { useNotifyWizardProfileDrivers } from "@/features/tours/wizard/TourWizardProfileDriversContext";
import { FieldGate, useIsFieldRequired } from "@/features/tours/wizard/profileRulesReact";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";

const TOUR_TYPE_OPTION_KEYS = {
  mountain: "tourTypeMountain",
  city: "tourTypeCity",
  desert: "tourTypeDesert",
  nature: "tourTypeNature",
  cultural: "tourTypeCultural",
} as const;

/** Paths edited on this step — must exist in `BASE_FIELD_RULES` (`profileRules/rules.ts`). */
const PATHS = {
  title: "overview.title" as WizardFieldPath,
  tourType: "overview.tourType" as WizardFieldPath,
  shortDescription: "overview.shortDescription" as WizardFieldPath,
  longDescription: "overview.longDescription" as WizardFieldPath,
  communicationLink: "overview.communicationLink" as WizardFieldPath,
} as const;

export type BasicInfoStepProps = {
  tourCreationPresets?: SettingsTourPresetDto[];
  resolvedFormProfile?: TourFormProfile;
};

/**
 * Basic info step: fields use `FieldGate` so visibility follows `ProfileRules` in
 * `profileRules/rules.ts` (paths here stay visible for every profile that reaches this step).
 * `aria-required` on the title input comes from `useIsFieldRequired` (`overview.title` is required
 * in the rules table). No inline `TourFormProfile` policy branches; the preset banner receives
 * `resolvedFormProfile` for display only.
 */
export function BasicInfoStep({ tourCreationPresets, resolvedFormProfile }: BasicInfoStepProps) {
  const t = useTranslations("tours.new");
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();

  const reqTitle = useIsFieldRequired(PATHS.title);
  const notifyProfileDriversChanged = useNotifyWizardProfileDrivers();

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <TourCreationPresetBanner presets={tourCreationPresets} resolvedFormProfile={resolvedFormProfile} />

      <FieldGate field={PATHS.title}>
        <FormField label="عنوان تور" error={errors.overview?.title?.message}>
          <Input
            type="text"
            placeholder="مثلاً صعود دماوند"
            aria-invalid={Boolean(errors.overview?.title)}
            aria-required={reqTitle || undefined}
            {...register("overview.title")}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.tourType}>
        <FormField
          label={t("fieldTourType")}
          description={t("fieldTourTypeDescription")}
          error={
            typeof errors.overview?.tourType?.message === "string" ? errors.overview.tourType.message : undefined
          }
        >
          <Controller
            control={control}
            name="overview.tourType"
            render={({ field }) => (
              <Select
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  field.onChange(v === "" ? undefined : v);
                  notifyProfileDriversChanged?.();
                }}
                invalid={Boolean(errors.overview?.tourType)}
                aria-invalid={Boolean(errors.overview?.tourType)}
              >
                <option value="">{t("selectPlaceholder")}</option>
                {TOUR_TYPES.map((tt) => (
                  <option key={tt} value={tt}>
                    {t(TOUR_TYPE_OPTION_KEYS[tt])}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.shortDescription}>
        <FormField
          label="توضیح کوتاه"
          description="این متن در کارت/لیست تور نمایش داده می‌شود. اگر خالی باشد، از ابتدای توضیح کامل (با محدودیت کاراکتر) استفاده می‌شود."
          error={errors.overview?.shortDescription?.message}
        >
          <Textarea rows={3} placeholder="خلاصه کوتاه تور..." {...register("overview.shortDescription")} />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.longDescription}>
        <FormField
          label="توضیح کامل"
          description="این متن برای جزئیات کامل تور استفاده می‌شود."
          error={errors.overview?.longDescription?.message}
        >
          <Textarea rows={5} placeholder="توضیحات کامل تور..." {...register("overview.longDescription")} />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.communicationLink}>
        <FormField
          label="لینک گروه هماهنگی (اختیاری)"
          description={
            <>
              برای هماهنگی بعد از قطعی شدن حضور؛ مثلاً تلگرام، واتساپ یا هر لینکی. این اپ جای کانال عمومی نیست و کنار همین محصول عمل می‌کند.
              با ثبت موفق، می‌توانی این آدرس را در اختیار شرکت‌کنندگان بگذاری یا از طرف سیستم ارسال کنید (طبق تنظیمات).
            </>
          }
          error={typeof errors.overview?.communicationLink?.message === "string" ? errors.overview.communicationLink.message : undefined}
        >
          <Input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="مثلاً https://t.me/+xxxxxxxx یا لینک دعوت دیگر..."
            {...register("overview.communicationLink")}
          />
        </FormField>
      </FieldGate>
    </div>
  );
}
