/**
 * Denali wizard rail step identifiers (domain layout; UI titles live in apps/web).
 */
export const denaliWizardSteps = [
  "denali_basic",
  "denali_photos",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_legal",
  "review",
] as const;

export type DenaliCreateWizardStepId = (typeof denaliWizardSteps)[number];

export function getDenaliWizardSteps(): readonly DenaliCreateWizardStepId[] {
  return denaliWizardSteps;
}
