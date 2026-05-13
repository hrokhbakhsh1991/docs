import type { TourFormProfile } from "@repo/types";
import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

export { getVisibleWizardStepsForProfile } from "./fieldGroups";

export function isTourFormProfileString(value: string): value is TourFormProfile {
  return (TOUR_FORM_PROFILE_VALUES as readonly string[]).includes(value);
}
