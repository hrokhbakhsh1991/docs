import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import {
  validateDenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateValidationResult,
} from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import type { TourWizardPrefillMeta } from "./tourWizardPrefillMeta";

import {
  canonicalDurationToBasicsDuration,
  denaliCanonicalToForm,
  safeDenaliFormToCanonical,
  mergeDenaliCanonicalPartial,
  type DenaliCanonicalPartial,
} from "./denaliCanonicalFormAdapter";
import { readDenaliCanonicalBasics } from "./denaliCanonicalBasicsControl";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import { finalizeDenaliWizardHydration } from "./denaliFormHydration";

export type HydratedDenaliWizardForm = {
  formValues: DenaliCreateTourWizardForm;
  wizardMeta?: TourWizardPrefillMeta;
};

function hasCanonicalTemplateContent(
  patch: DenaliCanonicalPartial,
): boolean {
  return (Object.keys(patch) as (keyof DenaliCanonicalPartial)[]).some(
    (key) => patch[key] !== undefined,
  );
}

/** Both keys must be present on the patch before template hydrate may set tour classification. */
function patchDeclaresClassification(patch: DenaliCanonicalPartial): boolean {
  return patch.category !== undefined && patch.duration !== undefined;
}

/** Layer A boundary: stateless Zod validation for workspace template canonicalData. */
export function validateCanonicalTemplateData(
  value: unknown,
): DenaliCanonicalTemplateValidationResult {
  return validateDenaliCanonicalTemplateData(value);
}

/**
 * Hydrates workspace template / preset `canonicalData` into wizard RHF state using the
 * same rule-engine finalize path as draft hydration used to.
 */
export function tryHydrateCanonicalTemplate(
  canonicalPatch: DenaliCanonicalTemplateData | DenaliCanonicalPartial | null | undefined,
  defaultValues: DenaliCreateTourWizardForm,
  wizardMeta?: TourWizardPrefillMeta,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): HydratedDenaliWizardForm | null {
  if (canonicalPatch == null || typeof canonicalPatch !== "object") {
    return null;
  }

  const patch = canonicalPatch as DenaliCanonicalPartial;
  if (!hasCanonicalTemplateContent(patch)) {
    return null;
  }

  const classificationDeclared = patchDeclaresClassification(patch);
  const baseCanonical = safeDenaliFormToCanonical(defaultValues);
  const mergedCanonical = mergeDenaliCanonicalPartial(baseCanonical, patch);
  const priorBasics = readDenaliCanonicalBasics(defaultValues.basicInfo.tourType);
  const basics = classificationDeclared
    ? {
        category: mergedCanonical.category,
        duration: canonicalDurationToBasicsDuration(mergedCanonical.duration),
        eventVariant:
          mergedCanonical.category === "event" && priorBasics?.category === "event"
            ? priorBasics.eventVariant
            : undefined,
      }
    : priorBasics ?? undefined;

  let formFromCanonical = denaliCanonicalToForm(mergedCanonical, defaultValues, { basics });
  if (!classificationDeclared) {
    formFromCanonical = {
      ...formFromCanonical,
      basicInfo: {
        ...formFromCanonical.basicInfo,
        tourType: defaultValues.basicInfo.tourType,
      },
    };
  }
  const formValues = finalizeDenaliWizardHydration(formFromCanonical, ruleSet);

  return { formValues, wizardMeta };
}
