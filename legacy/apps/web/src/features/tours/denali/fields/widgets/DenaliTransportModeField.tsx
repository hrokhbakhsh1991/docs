"use client";

import { DENALI_TRANSPORT_MODE_VALUES, type DenaliTransportMode } from "@repo/types";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField, Select } from "@tour/ui";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliLogistics.schema";
import {
  useDenaliCanonical,
  useDenaliCanonicalValue,
} from "@/features/tours/wizard/denali/application";
import { patchDenaliTransportForMode } from "@/features/tours/wizard/denali/transport/patchDenaliTransportForMode";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliTransportModeField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const transport = useDenaliCanonicalValue<DenaliCanonicalTourModel["transport"]>("transport");

  return (
    <FormField label={t("transport.transportModeLabel")} error={errors.transport?.transportMode?.message}>
      <Select
        value={transport.mode ?? ""}
        onChange={(e) => {
          const mode = e.target.value as DenaliTransportMode;
          updateCanonical({
            transport: patchDenaliTransportForMode(transport, mode),
          });
        }}
        data-testid="denali-transport-mode"
        data-field-path="transport.transportMode"
        invalid={Boolean(errors.transport?.transportMode)}
      >
        {DENALI_TRANSPORT_MODE_VALUES.map((mode) => (
          <option key={mode} value={mode}>
            {t(`transport.transportMode.${mode}`)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
