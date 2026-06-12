import type { RenderFieldPlan, RenderStepPlan } from "@app-tour/platform-core";

import { getCanonicalStringFromDraft, type CanonicalWizardDraftEnvelope } from "./canonical-draft-access";
import type { EvaluateFormRulesOptions } from "../rules/evaluateFormRules";
import type { DenaliTourKind } from "../types/legacy/repo-types";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";

export type DenaliWizardRuleEvalInput = EvaluateFormRulesOptions;

export function resolveDenaliDimensionsFromDraft(
  draft: CanonicalWizardDraftEnvelope,
  rules?: Pick<DenaliWizardRulesModule, "readCanonicalBasics">
): { readonly category: string; readonly duration: string } {
  const tourKind = getCanonicalStringFromDraft(draft, "category").trim();
  if (tourKind.length === 0 || rules == null) {
    return { category: "mountain", duration: "single_day" };
  }
  const basics = rules.readCanonicalBasics(tourKind as DenaliTourKind | undefined);
  if (basics == null) {
    return { category: "mountain", duration: "single_day" };
  }
  return { category: basics.category, duration: basics.duration };
}

export function hasDenaliWizardClassification(
  draft: CanonicalWizardDraftEnvelope,
  rules: Pick<DenaliWizardRulesModule, "readCanonicalBasics">
): boolean {
  const tourKind = getCanonicalStringFromDraft(draft, "category").trim();
  return tourKind.length > 0 && rules.readCanonicalBasics(tourKind as DenaliTourKind | undefined) != null;
}

/**
 * Second-layer Denali rules (transport, payment, multi-day, etc.) on top of the static matrix plan.
 */
export function applyDenaliConditionalFieldRules(
  steps: readonly RenderStepPlan[],
  draft: CanonicalWizardDraftEnvelope,
  rules: DenaliWizardRulesModule,
  evalContext?: DenaliWizardRuleEvalInput
): readonly RenderStepPlan[] {
  if (!hasDenaliWizardClassification(draft, rules)) {
    return steps;
  }

  const form = tourWizardDraftToDenaliForm(draft, rules);

  return steps
    .map((step) => {
      const fields = step.fields
        .map((field): RenderFieldPlan | null => {
          const evaluated = rules.evaluateFormFieldRule(
            form,
            field.canonicalPath,
            step.stepId as Parameters<DenaliWizardRulesModule["evaluateFormFieldRule"]>[2],
            evalContext
          );
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
    .filter((step) => step.fields.length > 0 || step.stepId === "review");
}
