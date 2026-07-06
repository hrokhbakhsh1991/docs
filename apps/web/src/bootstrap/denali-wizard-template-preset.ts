import type { WizardTemplatePayload } from "@/features/settings/wizard-template-types";
import { loadFullWizardTemplatePreset } from "@/bootstrap/workspace-wizard-template-preset-bindings.generated";

/**
 * Lazy Denali full wizard template — sole web entry for Settings "Load full template".
 */
export function loadDenaliFullWizardTemplatePreset(
  seedLabel?: string
): Promise<WizardTemplatePayload> {
  return loadFullWizardTemplatePreset("denali", seedLabel);
}
