import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

/** Clean wizard slate aligned to the current field registry (no template overlay). */
export function resetWizardToRegistryDefaults(): DenaliCreateTourWizardForm {
  return buildDenaliTourCreateDefaultValues();
}
