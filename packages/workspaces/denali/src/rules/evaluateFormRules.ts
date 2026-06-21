import type { DenaliCreateWizardStepId } from "../layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

import { resolveDenaliRuleModelFromForm } from "../normalize/resolveRuleModel";
import {
  findDenaliRuleField,
  mapDenaliCanonicalToFormPath,
  mapFormPathToCanonical,
  type DenaliRuleFieldStep,
  type DenaliRuleSet,
  type DenaliUIContextOptions,
} from "./core";
import { isDenaliFieldRequiredOnStep, isDenaliFieldVisibleOnStep } from "./denaliUIAdapter";

export type EvaluatedFormFieldRule = {
  /** Canonical path on the rule model (`transport.seatPreference`, …). */
  canonicalPath: string;
  /** React Hook Form dot path (`transport.seatPreference`, …). */
  formPath: string;
  visible: boolean;
  required: boolean;
  /** Static flags from {@link denaliRuleSet} before transport-mode conditionals. */
  staticHidden: boolean;
  staticRequired: boolean;
};

export type EvaluateFormFieldRuleResult = Pick<
  EvaluatedFormFieldRule,
  "visible" | "required" | "canonicalPath" | "formPath" | "staticHidden" | "staticRequired"
>;

/**
 * Evaluates visibility + required for every field on a wizard step using
 * {@link denaliRuleModel} + contextual transport/pricing rules.
 */
export type EvaluateFormRulesOptions = {
  readonly uiOptions?: DenaliUIContextOptions;
  readonly ruleSet?: DenaliRuleSet;
};

export function evaluateFormRules(
  form: DenaliCreateTourWizardForm,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId = "denali_logistics",
  options?: EvaluateFormRulesOptions
): EvaluatedFormFieldRule[] {
  const ruleSet = options?.ruleSet;
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  if (model == null) {
    return [];
  }

  const scoped =
    step === "review" ? model.fields : model.fields.filter((field) => field.step === step);

  return scoped.map((field) => {
    const formPath = mapDenaliCanonicalToFormPath(field.path);
    return {
      canonicalPath: field.path,
      formPath,
      // Use canonical path — `basicInfo.tourType` maps to multiple canonicals (category/duration/eventVariant).
      visible: isDenaliFieldVisibleOnStep(model, step, field.path, form, options?.uiOptions),
      required: isDenaliFieldRequiredOnStep(model, step, field.path, form, options?.uiOptions),
      staticHidden: field.hidden,
      staticRequired: field.required,
    };
  });
}

/** Single-field helper (form path or canonical path). */
export function evaluateFormFieldRule(
  form: DenaliCreateTourWizardForm,
  path: string,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId = "denali_logistics",
  options?: EvaluateFormRulesOptions
): EvaluateFormFieldRuleResult {
  const ruleSet = options?.ruleSet;
  const model = resolveDenaliRuleModelFromForm(form, ruleSet);
  const canonicalPath = mapFormPathToCanonical(path);
  const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
  const field = model == null ? undefined : findDenaliRuleField(model, canonicalPath);

  return {
    canonicalPath,
    formPath,
    visible: isDenaliFieldVisibleOnStep(model, step, canonicalPath, form, options?.uiOptions),
    required: isDenaliFieldRequiredOnStep(model, step, canonicalPath, form, options?.uiOptions),
    staticHidden: field?.hidden ?? true,
    staticRequired: field?.required ?? false,
  };
}
