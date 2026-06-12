import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { detectDenaliTourPublishTransition } from "@app-tour/workspace-denali/tours";
import { isUrbanTourPublished } from "@app-tour/workspace-urban/http";

export type TourPublishTransitionKind = "published" | "unpublished";

export function detectTourPublishTransition(
  workspaceType: string | undefined,
  before: CanonicalDocument,
  after: CanonicalDocument
): TourPublishTransitionKind | null {
  if (workspaceType === "denali") {
    const beforeData = before.data;
    const afterData = after.data;
    if (
      beforeData == null ||
      typeof beforeData !== "object" ||
      Array.isArray(beforeData) ||
      afterData == null ||
      typeof afterData !== "object" ||
      Array.isArray(afterData)
    ) {
      return null;
    }
    return detectDenaliTourPublishTransition(
      beforeData as Record<string, unknown>,
      afterData as Record<string, unknown>
    );
  }

  if (workspaceType === "urban") {
    const wasPublished = isUrbanTourPublished(before);
    const isPublished = isUrbanTourPublished(after);
    if (!wasPublished && isPublished) {
      return "published";
    }
    if (wasPublished && !isPublished) {
      return "unpublished";
    }
    return null;
  }

  return null;
}
