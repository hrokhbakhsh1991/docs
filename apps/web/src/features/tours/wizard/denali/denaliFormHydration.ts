import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { applyDenaliInvariantState } from "./validation/denaliInvariantEngine";
import { normalizeDenaliWizardForm } from "./validation/denaliRuleAccess";

/**
 * Final normalization pass shared by draft hydration and canonical template hydration.
 * Applies invariant engine + Denali rule-engine visibility cleanup.
 */
export function finalizeDenaliWizardHydration(
  form: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  return normalizeDenaliWizardForm(applyDenaliInvariantState(form));
}
