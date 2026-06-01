import {
  type DenaliCreateWizardStepId,
} from "@repo/denali-domain";

/** Flat-edit section ids (all wizard steps except review). */
export const DENALI_EDIT_SECTION_IDS = [
  "denali_basic",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_legal",
  "denali_photos",
] as const satisfies readonly DenaliCreateWizardStepId[];

export type DenaliEditSectionId = (typeof DENALI_EDIT_SECTION_IDS)[number];
