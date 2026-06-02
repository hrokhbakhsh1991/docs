import type { DenaliFieldRegistryEntry, DenaliZodFieldKind } from "@repo/denali-domain";

/** zodKind → canonical anchor path; non-anchor rows are skipped (composite widget). */
export const DENALI_COMPOSITE_ANCHOR_BY_ZOD_KIND: Partial<Record<DenaliZodFieldKind, string>> = {
  tourType: "category",
  locationData: "startPoint",
  gearItems: "participants.gearItems",
  gatheringPoints: "gatheringPoints",
  itinerary: "program.itinerary",
};

/** Paths rendered by a composite widget anchored on another registry row. */
export const DENALI_COMPOSITE_DEPENDENT_PATHS = new Set<string>([
  "duration",
  "eventVariant",
  "program.shortDescription",
  "program.longDescription",
  "summitPoint",
  "campPoint",
  "endPoint",
  "participants.maximumAge",
  "participants.fitnessLevel",
  "participants.nationalIdRequired",
  "participants.sportsInsuranceRequired",
  "participants.fitnessPrerequisiteText",
  "participants.minRequiredPeaks",
]);

export function shouldRenderDenaliRegistryField(field: DenaliFieldRegistryEntry): boolean {
  if (DENALI_COMPOSITE_DEPENDENT_PATHS.has(field.canonicalPath)) {
    return false;
  }

  const anchor = field.zodKind ? DENALI_COMPOSITE_ANCHOR_BY_ZOD_KIND[field.zodKind] : undefined;
  if (anchor != null && field.canonicalPath !== anchor) {
    return false;
  }

  return true;
}
