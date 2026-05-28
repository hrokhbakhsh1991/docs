"use client";

import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical, useDenaliStepFieldRules } from "../application";

const STEP = "denali_program" as const;
const PATH_ELEVATION_GAIN = "tripDetails.metrics.elevationGain";

/**
 * Itinerary-step metrics (step 2 / `denali_program`): route elevation gain, distinct from peak height on basic info.
 */
export function DenaliItineraryStep({ form }: { form: DenaliCreateTourWizardForm }) {
  const t = useTranslations("tours.denali");
  const {
    control,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const { isVisible } = useDenaliStepFieldRules(STEP);

  const elevationGainField = useController({
    control,
    name: "tripDetails.metrics.elevationGain",
  });

  const showElevationGain = isVisible(PATH_ELEVATION_GAIN, form);
  if (!showElevationGain) {
    return null;
  }

  return (
    <FormField
      label={t("program.elevationGain")}
      description={t("program.elevationGainDescription")}
      error={errors.tripDetails?.metrics?.elevationGain?.message}
    >
      <PersianNumberInput
        numericMode="integer"
        formatThousands
        value={elevationGainField.field.value ?? ""}
        onChange={(v) => {
          const next = v === "" ? undefined : Number(v);
          elevationGainField.field.onChange(next);
          updateCanonical({
            metrics: {
              elevationGain: next,
            },
          });
        }}
        onBlur={elevationGainField.field.onBlur}
        data-testid="denali-itinerary-elevation-gain"
        data-field-path={PATH_ELEVATION_GAIN}
      />
    </FormField>
  );
}
