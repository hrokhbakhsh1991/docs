/**
 * Rule-engine data access (visibility / required / step sections / form normalize).
 */

import { DENALI_ROOTS } from "@repo/shared-contracts";
import type { DenaliTourKind } from "@repo/types";

import {
  denaliWizardSteps,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../denaliCanonicalBasicsControl";
import { applyDenaliInvariantState } from "./denaliInvariantEngine";
import { setDenaliFormPathValue } from "../denaliFormPathUtils";
import {
  DENALI_WIZARD_CANONICAL_FIELD_PATHS,
  mapDenaliCanonicalToFormPath,
} from "../rules/denaliRuleRequired";
import {
  getHiddenFieldPathsFromModel,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "../rules/denaliUIAdapter";
import { isDenaliAsyncAssetCanonicalPath } from "../registry/DenaliFieldRegistry";
import type { DenaliRuleModel, DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import { mapTemplateToRuleModel } from "@/features/tours/wizard/domain/ruleModelConverter";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

export type { DenaliRuleSet };

/**
 * Content steps that remain on the create rail even when every rule-model field on that step
 * is overlay-hidden (e.g. `photos` with `visibility: hidden` still keeps the gallery step).
 */
export const DENALI_STRUCTURAL_RAIL_STEPS: readonly DenaliCreateWizardStepId[] = ["denali_photos"];

/** Dev / QA: re-insert these rail pills when dynamic visibility drops them. */
export const DENALI_RAIL_TEST_FORCE_STEP_IDS: readonly DenaliCreateWizardStepId[] = [
  "denali_logistics",
  "denali_photos",
];

/**
 * Testing override: keep canonical rail order while forcing logistics/photos pills back on.
 * No-op in production unless `enabled` is true.
 */
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


/** Merges workspace `fieldRulesOverlay` onto static {@link denaliRuleSet}. */
export function resolveDenaliRuleSetFromTemplate(
  template: TenantWizardTemplate | null | undefined,
): DenaliRuleSet {
  return mapTemplateToRuleModel(template ?? null).ruleSet;
}

/** Resolve rule model for the current form classification. */
export function resolveDenaliRuleModelFromForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliRuleModel | null {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
  if (basics == null) return null;
  return ruleSet[basics.category][basics.duration];
}

/** True when category × duration is selected (`basicInfo.tourType` resolves). */
export function hasDenaliWizardClassification(form: DenaliCreateTourWizardForm): boolean {
  return readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined) != null;
}

/**
 * Step is shown when at least one rule-model field on that step is not `hidden`.
 * `review` is never a form section — always false here.
 */
export function isDenaliStepVisibleInModel(
  model: DenaliRuleModel | null,
  stepId: DenaliCreateWizardStepId,
): boolean {
  if (stepId === "review") return false;
  if (model == null) return stepId === "denali_basic";
  return model.fields.some((field) => field.step === stepId && !field.hidden);
}

/**
 * Create / edit rail: resolves the active matrix from `form` + merged {@link DenaliRuleSet}.
 */
export function isDenaliStepVisible(
  ruleSet: DenaliRuleSet,
  stepId: DenaliCreateWizardStepId,
  form: DenaliCreateTourWizardForm,
): boolean {
  if (stepId === "review") return false;
  return isDenaliStepVisibleInModel(resolveDenaliRuleModelFromForm(form, ruleSet), stepId);
}

/**
 * Create wizard rail: content steps when {@link isDenaliStepVisible} (or structural whitelist);
 * `review` only after tour type is set. Before classification, all content steps except review.
 */
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

/** Top-level form sections owned by a wizard step (from rule model `field.step`). */
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

function cloneDenaliFormSections(form: DenaliCreateTourWizardForm): DenaliCreateTourWizardForm {
  return {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
    transport: { ...form.transport },
    pricingPayment: { ...form.pricingPayment },
    participantRequirements: { ...form.participantRequirements },
    policies: { ...form.policies },
    photosData: { ...form.photosData, photos: form.photosData?.photos ? [...form.photosData.photos] : [] },
    tripDetails: {
      ...form.tripDetails,
      logistics: {
        ...form.tripDetails?.logistics,
        gatheringPoints: form.tripDetails?.logistics?.gatheringPoints
          ? [...form.tripDetails.logistics.gatheringPoints]
          : form.tripDetails?.logistics?.gatheringPoints,
      },
    },
  };
}

function setDenaliFormLeaf(
  form: DenaliCreateTourWizardForm,
  canonicalPath: string,
  value: undefined,
): void {
  const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
  setDenaliFormPathValue(form, formPath, value);
}

/**
 * Clears legacy RHF leaves that are not visible for the current rule model + form state.
 * Single authority for hidden flags (`field.hidden`) and conditional visibility (dong, price, end).
 */
export function clearDenaliNonVisibleFormValues(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  uiOptions?: DenaliUIContextOptions,
): DenaliCreateTourWizardForm {
  const next = cloneDenaliFormSections(form);
  const pathsToClear = new Set<string>();

  for (const path of getHiddenFieldPathsFromModel(model)) {
    pathsToClear.add(path);
  }

  for (const path of DENALI_WIZARD_CANONICAL_FIELD_PATHS) {
    const inModel = model.fields.some((field) => field.path === path);
    if (!inModel) continue;
    if (!isDenaliFieldVisibleInModel(model, path, form, uiOptions)) {
      pathsToClear.add(path);
    }
  }

  for (const path of pathsToClear) {
    if (isDenaliAsyncAssetCanonicalPath(path)) {
      continue;
    }
    if (path === "eventVariant") {
      const basics = readDenaliCanonicalBasics(next.basicInfo.tourType as DenaliTourKind | undefined);
      if (basics?.category === "event") {
        next.basicInfo = {
          ...next.basicInfo,
          tourType: patchDenaliCanonicalBasics(next.basicInfo.tourType, {
            eventVariant: "reading",
          }),
        };
      }
      continue;
    }
    setDenaliFormLeaf(next, path, undefined);
  }

  return next;
}

/** Structural invariants + overlay-aware visibility cleanup (submit / hydrate authority). */
export function prepareDenaliWizardFormForSubmit(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  return applyDenaliInvariantState(form, undefined, ruleSet);
}

/** Merge `patch` onto `defaults`, then {@link clearDenaliNonVisibleFormValues}. */
export function normalizeDenaliWizardForm(
  input: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  const model = resolveDenaliRuleModelFromForm(input, ruleSet);
  if (model == null) return input;
  return clearDenaliNonVisibleFormValues(input, model, uiOptions);
}

function mergeDenaliFormSections(
  defaults: DenaliCreateTourWizardForm,
  patch: Partial<DenaliCreateTourWizardForm>,
): DenaliCreateTourWizardForm {
  return {
    ...defaults,
    ...patch,
    basicInfo: { ...defaults.basicInfo, ...patch.basicInfo },
    programNature: { ...defaults.programNature, ...patch.programNature },
    transport: { ...defaults.transport, ...patch.transport },
    pricingPayment: { ...defaults.pricingPayment, ...patch.pricingPayment },
    participantRequirements: {
      ...defaults.participantRequirements,
      ...patch.participantRequirements,
    },
    policies: { ...defaults.policies, ...patch.policies },
    photosData: { ...defaults.photosData, ...patch.photosData },
    tripDetails: {
      ...defaults.tripDetails,
      ...patch.tripDetails,
      logistics: {
        ...defaults.tripDetails?.logistics,
        ...patch.tripDetails?.logistics,
      },
    },
  };
}

/**
 * Normalizes a partial preset/draft patch using the same visibility rules as submit.
 * Returns only roots present on `patch` (after clearing non-visible leaves).
 */
export function normalizeDenaliFormPatch(
  patch: Partial<DenaliCreateTourWizardForm>,
  defaults: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): Partial<DenaliCreateTourWizardForm> {
  const merged = mergeDenaliFormSections(defaults, patch);
  const normalized = normalizeDenaliWizardForm(merged, undefined, ruleSet);
  const out: Partial<DenaliCreateTourWizardForm> = {};

  for (const key of DENALI_ROOTS) {
    if (patch[key] != null) {
      (out as any)[key] = normalized[key];
    }
  }

  return out;
}

/** @deprecated Use {@link clearDenaliNonVisibleFormValues} or {@link normalizeDenaliWizardForm}. */
export function stripRuleHiddenFieldValues(
  form: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  return normalizeDenaliWizardForm(form);
}

export {
  isDenaliFieldRequiredInModel,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleInModel,
  isDenaliFieldVisibleOnStep,
} from "../rules/denaliUIAdapter";
