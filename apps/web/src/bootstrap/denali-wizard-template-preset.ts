import type { WizardTemplatePayload } from "@/features/settings/wizard-template-types";

let denaliWizardTemplatePresetPromise: Promise<
  (seedLabel?: string) => WizardTemplatePayload
> | null = null;

/**
 * Lazy Denali full wizard template — sole web entry for Settings "Load full template".
 */
export function loadDenaliFullWizardTemplatePreset(
  seedLabel?: string
): Promise<WizardTemplatePayload> {
  denaliWizardTemplatePresetPromise ??= import("@app-tour/workspace-denali/plugin").then(
    (mod) => mod.buildDenaliFullWizardTemplatePayload
  );
  return denaliWizardTemplatePresetPromise.then((build) => build(seedLabel));
}
