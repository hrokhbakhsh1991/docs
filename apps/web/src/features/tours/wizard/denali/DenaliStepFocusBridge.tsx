"use client";

import { useEffect } from "react";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import { useDenaliWizardNavigationOptional } from "./DenaliWizardNavigationContext";

/** Consumes pending field focus after navigating to a wizard step. */
export function DenaliStepFocusBridge({ stepId }: { stepId: DenaliCreateWizardStepId }) {
  const navigation = useDenaliWizardNavigationOptional();

  useEffect(() => {
    navigation?.consumePendingFocus(stepId);
  }, [navigation, stepId]);

  return null;
}
