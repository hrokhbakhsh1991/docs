import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import type { DenaliUIContextOptions } from "../rules/denaliUIAdapter";

import { applyDenaliStructuralInvariants, getDenaliSafeFormState } from "./structuralInvariants";

export function applyDenaliInvariantState(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet
): DenaliCreateTourWizardForm {
  return getDenaliSafeFormState(applyDenaliStructuralInvariants(form, uiOptions, ruleSet), uiOptions, ruleSet);
}

export function prepareDenaliWizardFormForSubmit(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet
): DenaliCreateTourWizardForm {
  return applyDenaliInvariantState(form, undefined, ruleSet);
}
