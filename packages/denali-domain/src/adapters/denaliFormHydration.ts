import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { prepareDenaliWizardFormForSubmit } from "../normalize/invariantState";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";

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
