/**
 * Denali rule-model resolution (classification, step visibility, rail helpers).
 */

import type { DenaliTourKind } from "@repo/types";

import { readDenaliCanonicalBasics } from "../adapters/denaliCanonicalBasicsControl";
import { denaliWizardSteps, type DenaliCreateWizardStepId } from "../layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { mapDenaliCanonicalToFormPath } from "../rules/denaliRuleRequired";
import type { DenaliRuleModel, DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import { resolveDenaliRuleSetFromOverlay } from "../rules/templateOverlay";

export type { DenaliRuleSet };

export const DENALI_STRUCTURAL_RAIL_STEPS: readonly DenaliCreateWizardStepId[] = ["denali_photos"];

export const DENALI_RAIL_TEST_FORCE_STEP_IDS: readonly DenaliCreateWizardStepId[] = [
  "denali_logistics",
  "denali_photos",
];

export function withDenaliWizardRailTestingOverrides(
  steps: DenaliCreateWizardStepId[],
  options?: { enabled?: boolean },
): DenaliCreateWizardStepId[] {
  const enabled = options?.enabled ?? process.env.NODE_ENV === "development";
  if (!enabled) return steps;
  const set = new Set(steps);
  let patched = false;
  for (const stepId of DENALI_RAIL_TEST_FORCE_STEP_IDS) {
    if (!set.has(stepId)) {
      set.add(stepId);
      patched = true;
    }
  }
  if (!patched) return steps;
  return denaliWizardSteps.filter((stepId) => set.has(stepId));
}

export function resolveDenaliRuleSetFromTemplate(
  template: { readonly fieldRulesOverlay?: Readonly<Record<string, unknown>> } | null | undefined,
): DenaliRuleSet {
  return resolveDenaliRuleSetFromOverlay(template?.fieldRulesOverlay);
}

export function resolveDenaliRuleModelFromForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliRuleModel | null {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
  if (basics == null) return null;
  return ruleSet[basics.category][basics.duration];
}

export function hasDenaliWizardClassification(form: DenaliCreateTourWizardForm): boolean {
  return readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined) != null;
}

export function isDenaliStepVisibleInModel(
  model: DenaliRuleModel | null,
  stepId: DenaliCreateWizardStepId,
): boolean {
  if (stepId === "review") return false;
  if (model == null) return stepId === "denali_basic";
  return model.fields.some((field) => field.step === stepId && !field.hidden);
}

export function isDenaliStepVisible(
  ruleSet: DenaliRuleSet,
  stepId: DenaliCreateWizardStepId,
  form: DenaliCreateTourWizardForm,
): boolean {
  if (stepId === "review") return false;
  return isDenaliStepVisibleInModel(resolveDenaliRuleModelFromForm(form, ruleSet), stepId);
}

export function getDenaliWizardVisibleSteps(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
  steps: readonly DenaliCreateWizardStepId[] = denaliWizardSteps,
): DenaliCreateWizardStepId[] {
  const hasClassification = hasDenaliWizardClassification(form);
  return steps.filter((stepId) => {
    if (stepId === "review") return hasClassification;
    if (!hasClassification) return true;
    if (DENALI_STRUCTURAL_RAIL_STEPS.includes(stepId)) return true;
    return isDenaliStepVisible(ruleSet, stepId, form);
  });
}

export function getDenaliStepPickShape(
  model: DenaliRuleModel,
  stepId: DenaliCreateWizardStepId,
): Partial<Record<keyof DenaliCreateTourWizardForm, true>> {
  const shape: Partial<Record<keyof DenaliCreateTourWizardForm, true>> = {};

  for (const field of model.fields) {
    if (field.hidden) continue;
    if (field.step !== stepId) continue;
    const formPath = mapDenaliCanonicalToFormPath(field.path);
    const section = formPath.split(".")[0] as keyof DenaliCreateTourWizardForm;
    shape[section] = true;
  }

  return shape;
}
