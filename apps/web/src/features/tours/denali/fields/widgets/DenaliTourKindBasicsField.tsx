"use client";

import {
  DENALI_EVENT_VARIANT_VALUES,
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
} from "@repo/types";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Select } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  useDenaliCanonical,
  useDenaliStepFieldRules,
} from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

const STEP = "denali_basic" as const;

/** Category, duration, and event variant — one composite for registry `tourType` rows. */
export function DenaliTourKindBasicsField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { basicsSelection, updateCanonicalBasics } = useDenaliCanonical();
  useWatch({ control, name: "basicInfo.tourType" });
  const { isVisible, isDurationAllowed } = useDenaliStepFieldRules(STEP);
  const formSnapshot = () => getValues();

  return (
    <>
      <FormField label={t("basic.categoryLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.category ?? ""}
          onChange={(e) => {
            updateCanonicalBasics({ category: e.target.value as DenaliTourCategory });
          }}
          data-testid="denali-basics-category"
          invalid={Boolean(errors.basicInfo?.tourType)}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {DENALI_TOUR_CATEGORY_VALUES.map((category) => (
            <option key={category} value={category}>
              {t(`basic.categories.${category}`)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t("basic.durationLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.duration ?? ""}
          onChange={(e) => {
            updateCanonicalBasics({ duration: e.target.value as DenaliTourDuration });
          }}
          data-testid="denali-basics-duration"
          invalid={Boolean(errors.basicInfo?.tourType)}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {DENALI_TOUR_DURATION_VALUES.map((duration) => {
            const category = basicsSelection?.category;
            const disabled = category != null && !isDurationAllowed(duration);
            return (
              <option key={duration} value={duration} disabled={disabled}>
                {t(`basic.durations.${duration}`)}
              </option>
            );
          })}
        </Select>
      </FormField>

      {isVisible("eventVariant", formSnapshot()) ? (
        <FormField label={t("basic.eventVariantLabel")} error={errors.basicInfo?.tourType?.message}>
          <Select
            value={basicsSelection?.eventVariant ?? ""}
            onChange={(e) => {
              updateCanonicalBasics({ eventVariant: e.target.value as DenaliEventVariant });
            }}
            data-testid="denali-basics-event-variant"
          >
            {DENALI_EVENT_VARIANT_VALUES.map((variant) => (
              <option key={variant} value={variant}>
                {t(`basic.eventVariants.${variant}`)}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  );
}
