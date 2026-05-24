/**
 * Rule-engine data access (visibility / required / step sections / form normalize).
 */

import { DENALI_ROOTS } from "@repo/shared-contracts";
import type { DenaliTourKind } from "@repo/types";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { readDenaliCanonicalBasics } from "../denaliCanonicalBasicsControl";
import {
  DENALI_WIZARD_CANONICAL_FIELD_PATHS,
  mapDenaliCanonicalToFormPath,
} from "../rules/denaliRuleRequired";
import {
  getHiddenFieldPathsFromModel,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "../rules/denaliUIAdapter";
import type { DenaliRuleModel } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";

/** Resolve static rule model for the current form classification. */
export function resolveDenaliRuleModelFromForm(
  form: DenaliCreateTourWizardForm,
): DenaliRuleModel | null {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
  if (basics == null) return null;
  return denaliRuleSet[basics.category][basics.duration];
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
      logistics: { ...form.tripDetails?.logistics },
    },
  };
}

function setDenaliFormLeaf(
  form: DenaliCreateTourWizardForm,
  path: string,
  value: undefined,
): void {
  const formPath = mapDenaliCanonicalToFormPath(path);
  const [sectionKey, leaf] = formPath.split(".") as [keyof DenaliCreateTourWizardForm, string];
  const section = form[sectionKey];
  if (section != null && typeof section === "object") {
    (section as Record<string, unknown>)[leaf] = value;
  }
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
    setDenaliFormLeaf(next, path, undefined);
  }

  return next;
}

/** Merge `patch` onto `defaults`, then {@link clearDenaliNonVisibleFormValues}. */
export function normalizeDenaliWizardForm(
  input: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
): DenaliCreateTourWizardForm {
  const model = resolveDenaliRuleModelFromForm(input);
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
): Partial<DenaliCreateTourWizardForm> {
  const merged = mergeDenaliFormSections(defaults, patch);
  const normalized = normalizeDenaliWizardForm(merged);
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
