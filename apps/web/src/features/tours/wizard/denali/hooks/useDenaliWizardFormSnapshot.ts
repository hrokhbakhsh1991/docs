"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

/**
 * Live Denali wizard form values for UI that must re-render on any field change
 * (progress bar, review validation summary, etc.).
 *
 * Subscribes to each top-level RHF section instead of relying on a single root
 * `useWatch({ control })`, which can miss nested updates in some RHF versions.
 */
export function useDenaliWizardFormSnapshot(): DenaliCreateTourWizardForm {
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();

  const basicInfo = useWatch({ control, name: "basicInfo" });
  const programNature = useWatch({ control, name: "programNature" });
  const transport = useWatch({ control, name: "transport" });
  const pricingPayment = useWatch({ control, name: "pricingPayment" });
  const participantRequirements = useWatch({ control, name: "participantRequirements" });
  const policies = useWatch({ control, name: "policies" });
  const photosData = useWatch({ control, name: "photosData" });
  const tripDetails = useWatch({ control, name: "tripDetails" });

  return useMemo(() => {
    const base = getValues();
    return {
      ...base,
      basicInfo: basicInfo ?? base.basicInfo,
      programNature: programNature ?? base.programNature,
      transport: transport ?? base.transport,
      pricingPayment: pricingPayment ?? base.pricingPayment,
      participantRequirements: participantRequirements ?? base.participantRequirements,
      policies: policies ?? base.policies,
      photosData: photosData ?? base.photosData,
      tripDetails: tripDetails ?? base.tripDetails,
    };
  }, [
    basicInfo,
    programNature,
    transport,
    pricingPayment,
    participantRequirements,
    policies,
    photosData,
    tripDetails,
    getValues,
  ]);
}
