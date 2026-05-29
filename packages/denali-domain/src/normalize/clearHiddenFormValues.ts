/**
 * Overlay-aware form normalization (clear hidden / non-visible leaves).
 */

import { DENALI_ROOTS } from "@repo/shared-contracts";
import type { DenaliTourKind } from "@repo/types";

import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../adapters/denaliCanonicalBasicsControl";
import { setDenaliFormPathValue } from "../adapters/denaliFormPathUtils";
import { isDenaliAsyncAssetCanonicalPath } from "../registry/DenaliFieldRegistry";
import {
  DENALI_WIZARD_CANONICAL_FIELD_PATHS,
  mapDenaliCanonicalToFormPath,
} from "../rules/denaliRuleRequired";
import type { DenaliRuleModel, DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import {
  getHiddenFieldPathsFromModel,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "../rules/denaliUIAdapter";

import { resolveDenaliRuleModelFromForm } from "./resolveRuleModel";

function cloneDenaliFormSections(form: DenaliCreateTourWizardForm): DenaliCreateTourWizardForm {
  return {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
    transport: { ...form.transport },
    pricingPayment: { ...form.pricingPayment },
    participantRequirements: { ...form.participantRequirements },
    policies: { ...form.policies },
    photosData: {
      ...form.photosData,
      photos: form.photosData?.photos ? [...form.photosData.photos] : [],
    },
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
      (out as Record<string, unknown>)[key] = normalized[key];
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
