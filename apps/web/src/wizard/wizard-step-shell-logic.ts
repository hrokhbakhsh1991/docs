import type { RenderStepPlan } from "@app-tour/platform-core";

import type { WizardTemplateStepRef } from "@/features/settings/wizard-template-types";
import { formatWizardTemplateStepLabel } from "@/tours/wizard-template-catalog-logic";

export const WIZARD_STEP_SHELL_TEST_IDS = {
  nav: "workspace-wizard-step-nav",
  back: "workspace-wizard-step-back",
  next: "workspace-wizard-step-next",
  panel: "workspace-wizard-step-panel",
  progress: "workspace-wizard-step-progress",
  progressStep: (stepId: string) => `workspace-wizard-step-${stepId}`,
} as const;

/** Allow jumping back to completed steps or the current step (not forward). */
export function canNavigateToWizardStepIndex(targetIndex: number, activeIndex: number): boolean {
  return targetIndex >= 0 && targetIndex <= activeIndex;
}

export function resolveWizardStepLabel(
  stepId: string,
  templateSteps?: readonly WizardTemplateStepRef[],
  resolveDefaultLabel: (stepId: string) => string = formatWizardTemplateStepLabel
): string {
  const fromTemplate = templateSteps?.find((step) => step.stepId === stepId)?.label?.trim();
  if (fromTemplate !== undefined && fromTemplate.length > 0) {
    return fromTemplate;
  }
  return resolveDefaultLabel(stepId);
}

export function buildWizardStepDescriptors(
  visibleSteps: readonly RenderStepPlan[],
  templateSteps?: readonly WizardTemplateStepRef[],
  resolveDefaultLabel: (stepId: string) => string = formatWizardTemplateStepLabel
): readonly { stepId: string; label: string }[] {
  return visibleSteps.map((step) => ({
    stepId: step.stepId,
    label: resolveWizardStepLabel(step.stepId, templateSteps, resolveDefaultLabel),
  }));
}

/** Keep active index valid when conditional rules add/remove steps. */
export function clampWizardStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), stepCount - 1);
}

type WizardStepRef = {
  readonly stepId: string;
};

/**
 * When the visible step plan changes (matrix reload / contextual filter), prefer the same
 * {@link stepId} over keeping a numeric index that may now point at different content.
 */
export function resolveWizardStepIndexAfterPlanChange(
  activeStepIndex: number,
  anchoredStepId: string | null,
  steps: readonly WizardStepRef[]
): number {
  if (steps.length === 0) {
    return 0;
  }

  if (anchoredStepId != null) {
    const mapped = steps.findIndex((step) => step.stepId === anchoredStepId);
    if (mapped >= 0) {
      return mapped;
    }
  }

  return clampWizardStepIndex(activeStepIndex, steps.length);
}
