import type { DenaliCreateWizardStepId } from "../layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

import { resolveDenaliRuleModelFromForm } from "../normalize/resolveRuleModel";
import {
  findDenaliRuleField,
  mapDenaliCanonicalToFormPath,
  mapFormPathToCanonical,
  type DenaliRuleFieldStep,
} from "./core";
import {
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
} from "./denaliUIAdapter";

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
export function evaluateFormRules(
  form: DenaliCreateTourWizardForm,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId = "denali_logistics",
): EvaluatedFormFieldRule[] {
  const model = resolveDenaliRuleModelFromForm(form);
  if (model == null) {
    return [];
  }

  const scoped =
    step === "review"
      ? model.fields
      : model.fields.filter((field) => field.step === step);

  return scoped.map((field) => {
    const formPath = mapDenaliCanonicalToFormPath(field.path);
    return {
      canonicalPath: field.path,
      formPath,
      visible: isDenaliFieldVisibleOnStep(model, step, formPath, form),
      required: isDenaliFieldRequiredOnStep(model, step, formPath, form),
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
): EvaluateFormFieldRuleResult {
  const model = resolveDenaliRuleModelFromForm(form);
  const canonicalPath = mapFormPathToCanonical(path);
  const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
  const field = model == null ? undefined : findDenaliRuleField(model, canonicalPath);

  return {
    canonicalPath,
    formPath,
    visible: isDenaliFieldVisibleOnStep(model, step, formPath, form),
    required: isDenaliFieldRequiredOnStep(model, step, formPath, form),
    staticHidden: field?.hidden ?? true,
    staticRequired: field?.required ?? false,
  };
}
