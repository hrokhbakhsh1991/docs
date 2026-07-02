import type { WizardTemplateStepRef } from "../adapters/catalog-types";

export function resolveDenaliFlatEditSectionLabel(
  stepId: string,
  templateSteps: readonly WizardTemplateStepRef[],
  resolveDefaultLabel: (stepId: string) => string
): string {
  const localized = resolveDefaultLabel(stepId).trim();
  if (localized.length > 0) {
    return localized;
  }
  const fromTemplate = templateSteps.find((step) => step.stepId === stepId)?.label?.trim();
  if (fromTemplate !== undefined && fromTemplate.length > 0) {
    return fromTemplate;
  }
  return stepId;
}
