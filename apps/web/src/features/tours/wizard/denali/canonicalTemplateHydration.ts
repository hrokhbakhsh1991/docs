import type { DenaliCanonicalTemplateData } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import {
  canonicalDurationToBasicsDuration,
  denaliCanonicalToForm,
  denaliFormToCanonical,
  mergeDenaliCanonicalPartial,
  type DenaliCanonicalPartial,
} from "./denaliCanonicalFormAdapter";
import { readDenaliCanonicalBasics } from "./denaliCanonicalBasicsControl";
import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { finalizeDenaliWizardHydration } from "./denaliFormHydration";
import type { HydratedDenaliWizardDraft } from "./safeDraftHydration";

function hasCanonicalTemplateContent(
  patch: DenaliCanonicalPartial,
): boolean {
  return Object.keys(patch).some((key) => patch[key as keyof DenaliCanonicalPartial] !== undefined);
}

/**
 * Hydrates workspace template / preset `canonicalData` into wizard RHF state using the
 * same rule-engine finalize path as {@link tryHydrateDraft}.
 *
 * After `reset(formValues)`, bump {@link DenaliCanonicalProvider} `syncToken` so canonical
 * state re-derives from the hydrated form (same as loading a compatible draft).
 */
export function tryHydrateCanonicalTemplate(
  canonicalPatch: DenaliCanonicalTemplateData | DenaliCanonicalPartial | null | undefined,
  defaultValues: DenaliCreateTourWizardForm,
  wizardMeta?: TourWizardDraftMeta,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): HydratedDenaliWizardDraft | null {
  if (canonicalPatch == null || typeof canonicalPatch !== "object") {
    return null;
  }

  const patch = canonicalPatch as DenaliCanonicalPartial;
  if (!hasCanonicalTemplateContent(patch)) {
    return null;
  }

  const baseCanonical = denaliFormToCanonical(defaultValues);
  const mergedCanonical = mergeDenaliCanonicalPartial(baseCanonical, patch);
  const priorBasics = readDenaliCanonicalBasics(defaultValues.basicInfo.tourType);
  const basics = {
    category: mergedCanonical.category,
    duration: canonicalDurationToBasicsDuration(mergedCanonical.duration),
    eventVariant: priorBasics?.category === "event" ? priorBasics.eventVariant : undefined,
  };

  const formFromCanonical = denaliCanonicalToForm(mergedCanonical, defaultValues, { basics });
  const formValues = finalizeDenaliWizardHydration(formFromCanonical, ruleSet);

  return { formValues, wizardMeta };
}
