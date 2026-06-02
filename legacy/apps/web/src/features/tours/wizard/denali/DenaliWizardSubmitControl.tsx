"use client";

import { useCallback } from "react";
import { useFormContext, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { logDenaliWizardDiagnosticReport } from "./denaliWizardDiagnostic";
import { useDenaliWizardNavigation } from "./DenaliWizardNavigationContext";
import {
  evaluateDenaliWizardSubmitGate,
  focusDenaliSubmitValidationError,
} from "./validation/denaliSubmitValidation";
import { usePublishButtonGuard } from "./hooks/usePublishButtonGuard";

type DenaliWizardSubmitControlProps = {
  navLocked: boolean;
  isPending: boolean;
  pendingLabel: string;
  submitLabel: string;
  ruleSet: DenaliRuleSet;
  onSubmit: (_values: DenaliCreateTourWizardForm) => void | Promise<void>;
};

export function DenaliWizardSubmitControl({
  navLocked,
  isPending,
  pendingLabel,
  submitLabel,
  ruleSet,
  onSubmit,
}: DenaliWizardSubmitControlProps) {
  const tDenali = useTranslations("tours.denali");
  const { handleSubmit, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const { navigateToField } = useDenaliWizardNavigation();
  const publishButtonGuard = usePublishButtonGuard({ navLocked, ruleSet });

  const onInvalid = useCallback(
    (_fieldErrors: FieldErrors<DenaliCreateTourWizardForm>) => {
      const values = getValues();
      logDenaliWizardDiagnosticReport({
        form: values,
        activeEquipment: undefined,
        source: "submit-invalid-rhf",
      });

      const gate = evaluateDenaliWizardSubmitGate(values, { ruleSet });
      focusDenaliSubmitValidationError({
        form: values,
        ruleSet,
        submitIssues: gate.submitIssues,
        publishIssues: gate.publishIssues,
        t: tDenali,
        onFocusField: navigateToField,
      });
    },
    [getValues, navigateToField, ruleSet, tDenali],
  );

  return (
    <Button
      type="button"
      variant="primary"
      onClick={() => void handleSubmit(onSubmit, onInvalid)()}
      disabled={publishButtonGuard.disabled}
      data-testid="workspace-wizard-final-submit"
    >
      {isPending ? pendingLabel : submitLabel}
    </Button>
  );
}
