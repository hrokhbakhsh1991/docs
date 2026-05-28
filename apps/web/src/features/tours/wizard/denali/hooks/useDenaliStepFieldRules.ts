"use client";

import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import {
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
} from "../rules/denaliUIAdapter";

/** When the category guard is on, visibility rules wait until the user picks a category. */
export function resolveIsCategoryManuallySelected(
  guardEnabled: boolean,
  category: string | null | undefined,
): boolean {
  if (!guardEnabled) return true;
  return category != null && String(category).trim() !== "";
}

/**
 * Binds {@link isDenaliFieldVisibleOnStep} / {@link isDenaliFieldRequiredOnStep} to a wizard step
 * and the current rule model from {@link useDenaliCanonical}.
 */
export function useDenaliStepFieldRules(stepId: DenaliCreateWizardStepId) {
  const { ui } = useDenaliCanonical();
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  useWatch({ control, name: "basicInfo.tourType" });
  useWatch({ control, name: "basicInfo.requiresManualAdminApproval" });
  const ruleModel = ui.ruleModel;

  const getForm = useCallback(
    (form?: DenaliCreateTourWizardForm) => form ?? getValues(),
    [getValues],
  );

  const isVisible = useCallback(
    (path: string, form?: DenaliCreateTourWizardForm) =>
      isDenaliFieldVisibleOnStep(ruleModel, stepId, path, getForm(form)),
    [getForm, ruleModel, stepId],
  );

  const isRequired = useCallback(
    (path: string, form?: DenaliCreateTourWizardForm) =>
      isDenaliFieldRequiredOnStep(ruleModel, stepId, path, getForm(form)),
    [getForm, ruleModel, stepId],
  );

  return useMemo(
    () => ({
      stepId,
      ruleModel,
      isVisible,
      isRequired,
      isDurationAllowed: ui.isDurationAllowed,
      arePathsVisible: (paths: readonly string[], form?: DenaliCreateTourWizardForm) =>
        paths.every((path) => isVisible(path, form)),
    }),
    [isRequired, isVisible, ruleModel, stepId, ui.isDurationAllowed],
  );
}
