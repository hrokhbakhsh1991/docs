import { mergeWorkspaceCanonicalPatchData } from "@app-tour/workspace-sdk";

/**
 * Harbor canonical PATCH merge — deep-merge root objects (stub workspace).
 */
export function mergeHarborCanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined,
): T {
  return mergeWorkspaceCanonicalPatchData(existing, patch, "deep-root");
}

/** CASL surface id for owner-only harbor tour publish-field PATCH (stub). */
export const HARBOR_TOUR_PUBLISH_FIELDS_OWNER_SURFACE = "harbor.tour.publish_fields" as const;

export function harborTourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
