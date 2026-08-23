export type TourPublishTransition = "published" | "unpublished";

/**
 * Shared publish/unpublish transition detector (DG-1.4).
 * Workspaces compute before/after "is published" with their own status vocabulary.
 */
export function detectTourPublishTransition(
  wasPublished: boolean,
  isPublished: boolean,
): TourPublishTransition | null {
  if (!wasPublished && isPublished) {
    return "published";
  }
  if (wasPublished && !isPublished) {
    return "unpublished";
  }
  return null;
}
