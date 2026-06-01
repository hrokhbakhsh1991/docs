import type { TourFormProfile } from "@repo/types";
import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import { getDenaliWizardSteps, type DenaliCreateWizardStepId } from "./denaliStepConfig";
import {
  resolveTourWizardMode,
  type DenaliWizardContextInput,
  type TourWizardMode,
} from "./isDenaliWizardContext";
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

export function isTourFormProfileString(value: string): value is TourFormProfile {
  return (TOUR_FORM_PROFILE_VALUES as readonly string[]).includes(value);
}

export type WizardRailStepId = DenaliCreateWizardStepId;

/** Profile-bound multi-tab rail ids from workspace strategy (Denali-only). */
export function getWizardStepsForContext(
  _input: DenaliWizardContextInput,
): readonly WizardRailStepId[] {
  return getDenaliWizardSteps();
}

export { resolveTourWizardMode, type TourWizardMode };
