import type { DenaliTourKind } from "../types/legacy/repo-types";

import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../adapters/denaliCanonicalBasicsControl";
import { setDenaliFormPathValue } from "../adapters/denaliFormPathUtils";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import { isDenaliAsyncAssetCanonicalPath } from "../field-registry/DenaliFieldRegistry";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { mapDenaliCanonicalToFormPath } from "../rules/denaliCanonicalPaths";
import type { DenaliRuleModel, DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import {
  getHiddenFieldPathsFromModel,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "../rules/denaliUIAdapter";

import { resolveDenaliRuleModelFromForm } from "./resolveRuleModel";

const DENALI_WIZARD_CANONICAL_FIELD_PATHS = DENALI_FIELD_DEFINITIONS.map(
  (def) => def.canonicalPath
);

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
      photos: Array.isArray(form.photosData?.photos) ? [...form.photosData.photos] : [],
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
  value: undefined
): void {
  const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
  setDenaliFormPathValue(form, formPath, value);
}

export function collectDenaliNonVisibleCanonicalPaths(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  uiOptions?: DenaliUIContextOptions
): readonly string[] {
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

  return [...pathsToClear];
}

export function clearDenaliNonVisibleFormValues(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  uiOptions?: DenaliUIContextOptions
): DenaliCreateTourWizardForm {
  const next = cloneDenaliFormSections(form);
  const pathsToClear = collectDenaliNonVisibleCanonicalPaths(form, model, uiOptions);

  for (const path of pathsToClear) {
    if (isDenaliAsyncAssetCanonicalPath(path)) {
      continue;
    }
    if (path === "program.itinerary") {
      const rows = next.programNature.itinerary;
      if (rows != null && rows.length > 0) {
        continue;
      }
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
  ruleSet: DenaliRuleSet = denaliRuleSet
): DenaliCreateTourWizardForm {
  const model = resolveDenaliRuleModelFromForm(input, ruleSet);
  if (model == null) return input;
  return clearDenaliNonVisibleFormValues(input, model, uiOptions);
}
