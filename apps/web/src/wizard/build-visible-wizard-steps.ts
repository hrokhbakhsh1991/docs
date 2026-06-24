import type { RenderStepPlan } from "@app-tour/platform-core";
import type { WorkspaceWizardHostHooks } from "@app-tour/workspace-sdk";

import {
  applyWizardTemplateToRenderPlan,
  appendWorkspaceReviewStepToRenderPlan,
  filterRenderPlanByCanonicalPaths,
} from "@/tours/wizard-template-gate-logic";
import type { WizardTemplateStepRef } from "@/features/settings/wizard-template-types";

export function buildVisibleWizardSteps(input: {
  readonly baseSteps: readonly RenderStepPlan[];
  readonly templateSteps?: readonly WizardTemplateStepRef[];
  readonly allowedCanonicalPaths?: readonly string[];
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly wizardHost?: WorkspaceWizardHostHooks;
  readonly wizardRuleEvalContext?: unknown;
}): readonly RenderStepPlan[] {
  const {
    baseSteps,
    templateSteps,
    allowedCanonicalPaths,
    draft,
    rulesModule,
    wizardHost,
    wizardRuleEvalContext,
  } = input;

  let steps: readonly RenderStepPlan[] =
    templateSteps !== undefined && templateSteps.length > 0
      ? applyWizardTemplateToRenderPlan(baseSteps, templateSteps)
      : allowedCanonicalPaths !== undefined && allowedCanonicalPaths.length > 0
        ? filterRenderPlanByCanonicalPaths(baseSteps, allowedCanonicalPaths)
        : baseSteps;

  if (wizardHost?.applyContextualFieldRules != null && rulesModule != null) {
    steps = wizardHost.applyContextualFieldRules({
      steps,
      draft,
      rulesModule,
      evalContext: wizardRuleEvalContext ?? null,
    }) as readonly RenderStepPlan[];
  }

  if (wizardHost?.usesReviewStep === true && wizardHost.reviewStepId != null) {
    steps = appendWorkspaceReviewStepToRenderPlan(
      steps,
      baseSteps,
      wizardHost.reviewStepId,
      wizardHost.reviewFieldCanonicalPath ?? "publishStatus"
    );
  }

  return steps;
}
