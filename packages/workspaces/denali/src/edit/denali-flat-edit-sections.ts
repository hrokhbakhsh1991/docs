import { denaliWizardSteps } from "../layout/stepIds";

/** Phase 12.4a incremental slice — superseded by FULL as default in 12.4b. */
export const DENALI_FLAT_EDIT_SECTIONS_12_4A = Object.freeze([
  "denali_basic",
  "denali_program",
] as const);

export type DenaliFlatEditSectionId12_4a = (typeof DENALI_FLAT_EDIT_SECTIONS_12_4A)[number];

export function isDenaliFlatEditSection12_4a(stepId: string): stepId is DenaliFlatEditSectionId12_4a {
  return (DENALI_FLAT_EDIT_SECTIONS_12_4A as readonly string[]).includes(stepId);
}

/** Wizard create rail minus review — single source of truth for flat edit cards. */
export const DENALI_FLAT_EDIT_SECTIONS_FULL = Object.freeze(
  denaliWizardSteps.filter((stepId) => stepId !== "review")
);

export type DenaliFlatEditSectionId = (typeof DENALI_FLAT_EDIT_SECTIONS_FULL)[number];

export function isDenaliFlatEditSection(stepId: string): stepId is DenaliFlatEditSectionId {
  return (DENALI_FLAT_EDIT_SECTIONS_FULL as readonly string[]).includes(stepId);
}
