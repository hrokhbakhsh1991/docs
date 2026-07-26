import {
  type DenaliTourWizardDraft,
  setCanonicalStringValue,
} from "./denali-tour-wizard-draft";

/** Canonical slug persisted on new/cleared Denali create wizard drafts. */
export const DENALI_DEFAULT_TOUR_KIND = "mountain_day" as const;

/** Seed real tour classification so matrix + tour-kind UI match draft from first render. */
export function applyDenaliDefaultTourKind(draft: DenaliTourWizardDraft): DenaliTourWizardDraft {
  return setCanonicalStringValue(draft, "category", DENALI_DEFAULT_TOUR_KIND);
}
