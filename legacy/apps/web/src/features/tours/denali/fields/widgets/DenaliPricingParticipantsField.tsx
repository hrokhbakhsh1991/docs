"use client";

import { useFormContext } from "react-hook-form";

import { DenaliPricingParticipantSection } from "@/features/tours/denali/widgets/DenaliPricingParticipantSection";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliPricing.schema";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliPricingParticipantsField(_props: DenaliZodKindFieldProps) {
  const { getValues } = useFormContext<DenaliCreateTourWizardForm>();
  return <DenaliPricingParticipantSection form={getValues()} />;
}
