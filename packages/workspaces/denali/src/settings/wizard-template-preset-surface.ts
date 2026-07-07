import { buildDenaliFullWizardTemplatePayload } from "../denali.plugin";

export type DenaliWizardTemplatePresetSurface = {
  readonly buildFullTemplatePreset: typeof buildDenaliFullWizardTemplatePayload;
};

export const denaliWizardTemplatePresetSurface: DenaliWizardTemplatePresetSurface = Object.freeze({
  buildFullTemplatePreset: buildDenaliFullWizardTemplatePayload,
});
