import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliUIContextOptions } from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { applyDenaliStructuralInvariants, getDenaliSafeFormState } from "./structuralInvariants";

export function applyDenaliInvariantState(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  return getDenaliSafeFormState(
    applyDenaliStructuralInvariants(form, uiOptions, ruleSet),
    uiOptions,
    ruleSet,
  );
}

/** Structural invariants + overlay-aware visibility cleanup (submit / hydrate authority). */
export function prepareDenaliWizardFormForSubmit(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  return applyDenaliInvariantState(form, undefined, ruleSet);
}
