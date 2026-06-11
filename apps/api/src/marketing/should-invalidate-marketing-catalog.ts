import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

/**
 * True when a canonical write may change marketing catalog HTML (M11).
 * Revalidates if the tour was or is published — covers publish, unpublish, and in-catalog edits.
 */
export function shouldInvalidateMarketingCatalog(
  workspaceType: string,
  before: CanonicalDocument | null,
  after: CanonicalDocument
): boolean {
  const isPublished = resolveWorkspacePluginForType(workspaceType).publicCatalog?.isPublished;
  if (isPublished === undefined) {
    return false;
  }
  const wasPublished = before !== null && isPublished(before);
  const isNowPublished = isPublished(after);
  return wasPublished || isNowPublished;
}
