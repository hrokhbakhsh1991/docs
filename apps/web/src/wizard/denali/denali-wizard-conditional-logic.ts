import type { RenderFieldPlan, RenderStepPlan } from "@app-tour/platform-core";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { tourWizardDraftToDenaliForm } from "./denali-draft-form-adapter";
import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";

export type DenaliWizardMatrixDimensions = {
  readonly category: string;
  readonly duration: string;
};

const DEFAULT_DENALI_DIMENSIONS: DenaliWizardMatrixDimensions = {
  category: "mountain",
  duration: "single_day",
};

/** Tour kind slug (`category` canonical path) → rule matrix cell. */
export function resolveDenaliDimensionsFromDraft(
  draft: TourWizardDraft,
  rules?: Pick<DenaliWizardRulesModule, "readCanonicalBasics">
): DenaliWizardMatrixDimensions {
  const tourKind = getCanonicalStringValue(draft, "category").trim();
  if (tourKind.length === 0 || rules == null) {
    return DEFAULT_DENALI_DIMENSIONS;
  }
  const basics = rules.readCanonicalBasics(tourKind);
  if (basics == null) {
    return DEFAULT_DENALI_DIMENSIONS;
  }
  return { category: basics.category, duration: basics.duration };
}

export function hasDenaliWizardClassification(
  draft: TourWizardDraft,
  rules: Pick<DenaliWizardRulesModule, "readCanonicalBasics">
): boolean {
  const tourKind = getCanonicalStringValue(draft, "category").trim();
  return tourKind.length > 0 && rules.readCanonicalBasics(tourKind) != null;
}

/**
 * Second-layer Denali rules (transport, payment, multi-day, etc.) on top of the static matrix plan.
 * Skipped until the operator picks a tour kind so the form stays usable on first paint.
 */
export function applyDenaliConditionalFieldRules(
  steps: readonly RenderStepPlan[],
  draft: TourWizardDraft,
  rules: DenaliWizardRulesModule,
  evalContext?: DenaliWizardRuleEvalContext
): readonly RenderStepPlan[] {
  if (!hasDenaliWizardClassification(draft, rules)) {
    return steps;
  }

  const form = tourWizardDraftToDenaliForm(draft, rules);

  return steps
    .map((step) => {
      const fields = step.fields
        .map((field): RenderFieldPlan | null => {
          const evaluated = rules.evaluateFormFieldRule(form, field.canonicalPath, step.stepId, {
            uiOptions: evalContext?.uiOptions,
            ruleSet: evalContext?.ruleSet,
          });
          if (!evaluated.visible) {
            return null;
          }
          return {
            ...field,
            required: evaluated.required || field.required,
          };
        })
        .filter((field): field is RenderFieldPlan => field != null);

      return { ...step, fields };
    })
    .filter((step) => step.fields.length > 0);
}
