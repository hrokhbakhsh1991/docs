"use client";

import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { logDenaliWizardDiagnosticReport } from "./denaliWizardDiagnostic";
import { flattenDenaliFormErrors } from "./flattenDenaliFormErrors";
import { useDenaliWizardNavigation } from "./DenaliWizardNavigationContext";
import { collectDenaliWizardSubmitIssuePresentation } from "./denaliWizardSubmitIssuePresentation";
import { debugSessionLog } from "@/lib/debug-session-log";

type DenaliWizardSubmitControlProps = {
  disabled: boolean;
  isPending: boolean;
  pendingLabel: string;
  submitLabel: string;
  ruleSet: DenaliRuleSet;
  visibleSteps: readonly DenaliCreateWizardStepId[];
  onSubmit: (values: DenaliCreateTourWizardForm) => void | Promise<void>;
};

export function DenaliWizardSubmitControl({
  disabled,
  isPending,
  pendingLabel,
  submitLabel,
  ruleSet,
  visibleSteps,
  onSubmit,
}: DenaliWizardSubmitControlProps) {
  const tDenali = useTranslations("tours.denali");
  const { handleSubmit, getValues, formState } = useFormContext<DenaliCreateTourWizardForm>();
  const { navigateToField } = useDenaliWizardNavigation();

  const onInvalid = useCallback(
    (fieldErrors: typeof formState.errors) => {
      const values = getValues();
      const flat = flattenDenaliFormErrors(fieldErrors);
      debugSessionLog(
        "DenaliWizardSubmitControl.tsx:onInvalid",
        "RHF submit blocked by client validation",
        {
          errorCount: flat.length,
          errorPaths: flat.slice(0, 10).map((e) => e.path),
          errorMessages: flat.slice(0, 5).map((e) => e.message),
          transportMode: values.transport?.transportMode,
        },
        "C",
      );
      logDenaliWizardDiagnosticReport({
        form: values,
        activeEquipment: undefined,
        source: "submit-invalid-rhf",
      });

      const { views } = collectDenaliWizardSubmitIssuePresentation({
        form: values,
        ruleSet,
        stepOrder: visibleSteps,
        t: tDenali,
      });

      const first = views[0];
      if (first != null) {
        navigateToField(first.stepId, first.formPath);
      }
    },
    [formState.errors, getValues, navigateToField, ruleSet, tDenali, visibleSteps],
  );

  return (
    <Button
      type="button"
      variant="primary"
      onClick={() => void handleSubmit(onSubmit, onInvalid)()}
      disabled={disabled}
      data-testid="denali-wizard-final-submit"
    >
      {isPending ? pendingLabel : submitLabel}
    </Button>
  );
}
