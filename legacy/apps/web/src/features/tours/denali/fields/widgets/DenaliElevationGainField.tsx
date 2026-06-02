"use client";

import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { useDenaliCanonical } from "@/features/tours/wizard/denali/application";
import { buildDenaliCanonicalPartialFromPath } from "@/features/tours/wizard/denali/denaliCanonicalPathUtils";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliElevationGainField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    control,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const elevationGainField = useController({
    control,
    name: "tripDetails.metrics.elevationGain",
  });

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
          updateCanonical(
            buildDenaliCanonicalPartialFromPath("tripDetails.metrics.elevationGain", next),
          );
        }}
        onBlur={elevationGainField.field.onBlur}
        data-testid="denali-itinerary-elevation-gain"
        data-field-path="tripDetails.metrics.elevationGain"
      />
    </FormField>
  );
}
