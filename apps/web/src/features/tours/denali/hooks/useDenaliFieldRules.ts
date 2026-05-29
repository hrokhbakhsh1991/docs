"use client";

import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical } from "@/features/tours/wizard/denali/DenaliCanonicalContext";

/**
 * Domain-scoped field rules (active rule model, not a single wizard step).
 * Use in flat edit / {@link DenaliFieldRenderer}; steps may still use {@link useDenaliStepFieldRules}.
 */
export function useDenaliFieldRules() {
  const { ui } = useDenaliCanonical();
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  useWatch({ control, name: "basicInfo.tourType" });
  useWatch({ control, name: "basicInfo.requiresManualAdminApproval" });

  const getForm = useCallback(
    (form?: DenaliCreateTourWizardForm) => form ?? getValues(),
    [getValues],
  );

  const isVisible = useCallback(
    (path: string, form?: DenaliCreateTourWizardForm) => ui.isVisibleInModel(path, getForm(form)),
    [getForm, ui],
  );

  const isRequired = useCallback(
    (path: string, form?: DenaliCreateTourWizardForm) => ui.isRequiredInModel(path, getForm(form)),
    [getForm, ui],
  );

  return useMemo(
    () => ({
      ruleModel: ui.ruleModel,
      isVisible,
      isRequired,
      isDurationAllowed: ui.isDurationAllowed,
      arePathsVisible: (paths: readonly string[], form?: DenaliCreateTourWizardForm) =>
        paths.every((path) => isVisible(path, form)),
    }),
    [isRequired, isVisible, ui.isDurationAllowed, ui.ruleModel],
  );
}
