import {
  getDenaliFieldRegistryByStep,
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

/**
 * Canonical paths owned by flat-edit section bodies for a step (registry-driven).
 * Supplemental {@link DenaliFieldRenderer} rows are suppressed when listed here.
 */
export function getSuppressedCanonicalPathsForSection(
  sectionId: DenaliEditSectionId,
): ReadonlySet<string> {
  return new Set(
    getDenaliFieldRegistryByStep(sectionId)
      .filter((row) => row.inRuleModel !== false)
      .map((row) => row.canonicalPath),
  );
}

/** Union of all flat-edit suppressed canonical paths (for audits). */
export function listEditFlatSuppressedCanonicalPaths(): string[] {
  const paths = new Set<string>();
  for (const sectionId of DENALI_EDIT_SECTION_IDS) {
    for (const path of getSuppressedCanonicalPathsForSection(sectionId)) {
      paths.add(path);
    }
  }
  return [...paths].sort();
}
