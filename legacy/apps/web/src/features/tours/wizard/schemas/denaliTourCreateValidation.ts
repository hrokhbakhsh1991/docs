import type { FieldPath, UseFormClearErrors, UseFormSetError } from "react-hook-form";

import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { type DenaliUIContextOptions } from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import { clearHiddenFieldErrors, type LayoutManifest } from "@/features/tours/wizard/shell/layout";
import {
  getDenaliStepPickShape,
  resolveDenaliRuleModelFromForm,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import {
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
  validateDenaliWizardForm,
} from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import type { DenaliCreateTourWizardForm } from "./denaliCore.schema";

export {
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
} from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";

/**
 * @deprecated Derived from rule model field steps — use {@link getDenaliStepPickShape} instead.
 */
export function getDenaliWizardStepSchemaRoot(
  form: DenaliCreateTourWizardForm,
): Partial<Record<DenaliCreateWizardStepId, keyof DenaliCreateTourWizardForm | null>> {
  const model = resolveDenaliRuleModelFromForm(form);
  if (model == null) {
    return {
      denali_basic: "basicInfo",
      denali_program: "programNature",
      denali_logistics: "transport",
      denali_pricing: "pricingPayment",
      denali_legal: "policies",
      review: null,
    };
  }

  const out: Partial<Record<DenaliCreateWizardStepId, keyof DenaliCreateTourWizardForm | null>> = {
    review: null,
  };

  for (const stepId of [
    "denali_basic",
    "denali_program",
    "denali_logistics",
    "denali_pricing",
    "denali_legal",
  ] as const) {
    const pick = getDenaliStepPickShape(model, stepId);
    const keys = Object.keys(pick) as (keyof DenaliCreateTourWizardForm)[];
    out[stepId] = keys.length === 1 ? keys[0]! : keys.length > 1 ? keys[0]! : null;
  }

  return out;
}

/**
 * Clears RHF errors for fields hidden by the rule model / contextual visibility (EC-ZOD-04).
 */
export function clearDenaliWizardErrorsForHiddenFields(
  form: DenaliCreateTourWizardForm,
  clearErrors: UseFormClearErrors<DenaliCreateTourWizardForm>,
  layout: Pick<LayoutManifest, "hiddenFieldEviction">,
  options?: {
    uiOptions?: DenaliUIContextOptions;
    ruleSet?: DenaliRuleSet;
  },
): void {
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  const uiOptions = options?.uiOptions;
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  if (model == null) {
    return;
  }

  clearHiddenFieldErrors({
    form,
    clearErrors: (path) => clearErrors(path as FieldPath<DenaliCreateTourWizardForm>),
    eviction: layout.hiddenFieldEviction,
    ruleContext: model,
    uiOptions,
  });
}

/**
 * Runs Zod step validation and applies errors to RHF.
 */
export function applyDenaliWizardStepValidation(
  form: DenaliCreateTourWizardForm,
  stepId: DenaliCreateWizardStepId,
  setError: UseFormSetError<DenaliCreateTourWizardForm>,
  clearErrors: UseFormClearErrors<DenaliCreateTourWizardForm>,
  layout: Pick<LayoutManifest, "hiddenFieldEviction">,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): boolean {
  clearDenaliWizardErrorsForHiddenFields(form, clearErrors, layout, {
    uiOptions,
    ruleSet,
  });

  if (stepId === "review") {
    clearErrors();
    const issues = getDenaliWizardSubmitIssues(form, uiOptions, ruleSet);
    for (const issue of issues) {
      const path = issue.path.join(".") as FieldPath<DenaliCreateTourWizardForm>;
      setError(path, { type: "custom", message: issue.message });
    }
    return issues.length === 0;
  }

  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  if (model != null) {
    const pickShape = getDenaliStepPickShape(model, stepId);
    for (const section of Object.keys(pickShape) as (keyof DenaliCreateTourWizardForm)[]) {
      clearErrors(section);
    }
  }

  const issues = getDenaliWizardStepIssues(form, stepId, uiOptions, ruleSet);
  for (const issue of issues) {
    const path = issue.path.join(".") as FieldPath<DenaliCreateTourWizardForm>;
    setError(path, { type: "custom", message: issue.message });
  }

  return issues.length === 0;
}

export { validateDenaliWizardForm };
