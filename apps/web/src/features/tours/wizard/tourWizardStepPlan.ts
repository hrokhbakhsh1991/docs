import type { TourFormProfile } from "@repo/types";
import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import {
  getCapabilitiesForProfile,
  normalizeTourFormProfileInput,
} from "@/lib/workspace/workspace-capabilities";

import { wizardSteps, type TourCreateWizardStepId } from "./stepConfig";
import { getDenaliWizardSteps, type DenaliCreateWizardStepId } from "./denaliStepConfig";
import {
  resolveTourWizardMode,
  type DenaliWizardContextInput,
  type TourWizardMode,
} from "./isDenaliWizardContext";

export { getVisibleWizardStepsForProfile } from "./fieldGroups";
export {
  denaliWizardSteps,
  denaliStepTitlesFa,
  getDenaliWizardSteps,
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "./denaliStepConfig";
export {
  applyDenaliWizardStepValidation,
  getDenaliWizardStepIssues,
  getDenaliWizardStepSchemaRoot,
} from "./schemas/denaliTourCreateValidation";
export { DENALI_STEP_TO_FIELD_GROUPS } from "./denaliWizardFieldGroups";

export function isTourFormProfileString(value: string): value is TourFormProfile {
  return (TOUR_FORM_PROFILE_VALUES as readonly string[]).includes(value);
}

export type WizardRailStepId = TourCreateWizardStepId | DenaliCreateWizardStepId;

/** Classic 9-step ids or Denali 6-tab ids based on tenant / profile context. */
export function getWizardStepsForContext(
  input: DenaliWizardContextInput,
): readonly WizardRailStepId[] {
  const { usesDenaliWizardShell } = getCapabilitiesForProfile(
    normalizeTourFormProfileInput(input.formProfile),
  );
  const useDenaliRail = input.wizardMode === "denali" || usesDenaliWizardShell;
  return useDenaliRail ? getDenaliWizardSteps() : wizardSteps;
}

export { resolveTourWizardMode, type TourWizardMode };
