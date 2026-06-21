import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

/** Canonical slug persisted on new/cleared Denali create wizard drafts. */
export const DENALI_DEFAULT_TOUR_KIND = "mountain_day" as const;

/** Seed real tour classification so matrix + tour-kind UI match draft from first render. */
export function applyDenaliDefaultTourKind(draft: TourWizardDraft): TourWizardDraft {
  return setCanonicalStringValue(draft, "category", DENALI_DEFAULT_TOUR_KIND);
}
