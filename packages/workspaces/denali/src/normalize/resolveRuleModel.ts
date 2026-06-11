/**
 * Rule model resolution — matrix + optional settings template overlay (11.8-T6).
 */

import type { DenaliTourKind } from "../types/legacy/repo-types";

import { readDenaliCanonicalBasics } from "../adapters/denaliCanonicalBasicsControl";
import { denaliWizardSteps, type DenaliCreateWizardStepId } from "../layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import type { DenaliRuleModel, DenaliRuleSet } from "../rules/denaliRuleModel.types";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import { resolveDenaliRuleSetFromOverlay } from "../rules/templateOverlay";

export type { DenaliRuleSet };

export const DENALI_STRUCTURAL_RAIL_STEPS: readonly DenaliCreateWizardStepId[] = ["denali_photos"];

export function resolveDenaliRuleSetFromTemplate(
  template: { readonly fieldRulesOverlay?: Readonly<Record<string, unknown>> } | null | undefined
): DenaliRuleSet {
  return resolveDenaliRuleSetFromOverlay(template?.fieldRulesOverlay, denaliRuleSet);
}

export function resolveDenaliRuleModelFromForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet
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
  stepId: DenaliCreateWizardStepId
): boolean {
  if (stepId === "review") return false;
  if (model == null) return stepId === "denali_basic";
  return model.fields.some((field) => field.step === stepId && !field.hidden);
}

export function isDenaliStepVisible(
  ruleSet: DenaliRuleSet,
  stepId: DenaliCreateWizardStepId,
  form: DenaliCreateTourWizardForm
): boolean {
  if (stepId === "review") return false;
  return isDenaliStepVisibleInModel(resolveDenaliRuleModelFromForm(form, ruleSet), stepId);
}

export function getDenaliWizardVisibleSteps(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
  steps: readonly DenaliCreateWizardStepId[] = denaliWizardSteps
): DenaliCreateWizardStepId[] {
  const hasClassification = hasDenaliWizardClassification(form);
  return steps.filter((stepId) => {
    if (stepId === "review") return hasClassification;
    if (!hasClassification) return true;
    if (DENALI_STRUCTURAL_RAIL_STEPS.includes(stepId)) return true;
    return isDenaliStepVisible(ruleSet, stepId, form);
  });
}
