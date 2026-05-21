import {
  denaliTourKindToIsMultiDay,
  isDenaliEventTourKind,
  isDenaliOutdoorTourKind,
  type DenaliTourKind,
} from "@repo/types";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

/** Derived from `basicInfo.tourType` — not stored in RHF state. */
export function deriveDenaliIsMultiDay(tourType: DenaliTourKind | undefined): boolean {
  if (tourType == null) return false;
  return denaliTourKindToIsMultiDay(tourType);
}

/** Derived from `basicInfo.tourType` — not stored in RHF state. */
export function deriveDenaliDifficultyType(
  tourType: DenaliTourKind | undefined,
): "physical" | "none" | undefined {
  if (tourType == null) return undefined;
  return isDenaliEventTourKind(tourType) ? "none" : "physical";
}

export function deriveDenaliIsOutdoorTour(tourType: DenaliTourKind | undefined): boolean {
  if (tourType == null) return false;
  return isDenaliOutdoorTourKind(tourType);
}

export function deriveDenaliIsEventTour(tourType: DenaliTourKind | undefined): boolean {
  if (tourType == null) return false;
  return isDenaliEventTourKind(tourType);
}

/** Read-only view for UI / review — no `useEffect` required. */
export function selectDenaliWizardDerived(form: DenaliCreateTourWizardForm) {
  const tourType = form.basicInfo.tourType;
  return {
    tourType,
    isMultiDay: deriveDenaliIsMultiDay(tourType),
    difficultyType: deriveDenaliDifficultyType(tourType),
    isOutdoorTour: deriveDenaliIsOutdoorTour(tourType),
    isEventTour: deriveDenaliIsEventTour(tourType),
  };
}
