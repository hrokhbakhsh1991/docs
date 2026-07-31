export type WorkspaceTourPublishTransition = "published" | "unpublished";

/**
 * Shared publish/unpublish transition detector (DG-1.4).
 * Workspaces compute before/after "is published" with their own status vocabulary.
 */
export function detectWorkspaceTourPublishTransition(
  wasPublished: boolean,
  isPublished: boolean,
): WorkspaceTourPublishTransition | null {
  if (!wasPublished && isPublished) {
    return "published";
  }
  if (wasPublished && !isPublished) {
    return "unpublished";
  }
  return null;
}
