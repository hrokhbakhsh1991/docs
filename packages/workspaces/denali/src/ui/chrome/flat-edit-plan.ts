import type { RenderStepPlan } from "@app-tour/platform-core";

import type { WizardTemplateStepRef } from "../adapters/catalog-types";

export function filterFlatEditRenderSteps(
  steps: readonly RenderStepPlan[],
  sectionIds: readonly string[]
): readonly RenderStepPlan[] {
  const allowed = new Set(sectionIds);
  return steps.filter((step) => allowed.has(step.stepId));
}

export function filterFlatEditTemplateSteps(
  templateSteps: readonly WizardTemplateStepRef[],
  sectionIds: readonly string[]
): readonly WizardTemplateStepRef[] {
  const allowed = new Set(sectionIds);
  return templateSteps.filter((step) => step.enabled && allowed.has(step.stepId));
}
