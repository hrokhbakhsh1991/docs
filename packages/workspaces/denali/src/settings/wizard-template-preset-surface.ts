import { buildDenaliFullWizardTemplatePayload } from "./denaliFullWizardTemplate";

export type DenaliWizardTemplatePresetSurface = {
  readonly buildFullTemplatePreset: typeof buildDenaliFullWizardTemplatePayload;
};

export const denaliWizardTemplatePresetSurface: DenaliWizardTemplatePresetSurface = Object.freeze({
  buildFullTemplatePreset: buildDenaliFullWizardTemplatePayload,
});
