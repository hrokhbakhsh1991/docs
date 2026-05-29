import type { TourFormProfile } from "@repo/types";

/** Minimal prefill metadata carried through template / preset hydration. */
export type TourWizardPrefillMeta = {
  sourceTourId?: string;
  sourcePresetId?: string;
  themeIds?: { main?: string; secondary?: string[] };
  resolvedFormProfile: TourFormProfile;
  formProfileVersion: number;
};
