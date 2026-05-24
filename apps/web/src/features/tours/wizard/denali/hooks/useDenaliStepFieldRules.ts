"use client";

import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import {
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
} from "../rules/denaliUIAdapter";

/**
 * Binds {@link isDenaliFieldVisibleOnStep} / {@link isDenaliFieldRequiredOnStep} to a wizard step
 * and the current rule model from {@link useDenaliCanonical}.
 */
export function useDenaliStepFieldRules(stepId: DenaliCreateWizardStepId) {
  const { ui } = useDenaliCanonical();
  const { getValues } = useFormContext<DenaliCreateTourWizardForm>();
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
