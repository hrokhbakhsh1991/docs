"use client";

import { useCallback } from "react";
import { useFormContext, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@tour/ui";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { logDenaliWizardDiagnosticReport } from "./denaliWizardDiagnostic";
import { flattenDenaliFormErrors } from "./flattenDenaliFormErrors";
import { useDenaliWizardNavigation } from "./DenaliWizardNavigationContext";
import {
  evaluateDenaliWizardSubmitGate,
  focusDenaliSubmitValidationError,
} from "./validation/denaliSubmitValidation";
import { debugSessionLog } from "@/lib/debug-session-log";
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
    (fieldErrors: FieldErrors<DenaliCreateTourWizardForm>) => {
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
      data-testid="denali-wizard-final-submit"
    >
      {isPending ? pendingLabel : submitLabel}
    </Button>
  );
}
