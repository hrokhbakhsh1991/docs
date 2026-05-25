import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "./validation/denaliRuleAccess";

/**
 * Final normalization pass shared by draft hydration and canonical template hydration.
 * Applies invariant engine + Denali rule-engine visibility cleanup.
 */
export function finalizeDenaliWizardHydration(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  return prepareDenaliWizardFormForSubmit(form, ruleSet);
}
