import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isTourPubliclyVisible } from "../canonical/workspace-publish-visibility-dispatch";
import { workspaceHasPublicCatalogPluginSurface } from "./marketing-catalog-visibility-compat";

/**
 * True when a canonical write may change marketing catalog HTML (M11).
 * Revalidates if the tour was or is published — covers publish, unpublish, and in-catalog edits.
 *
 * CW3-03: predicate uses manifest-bound `isTourPubliclyVisible` dispatch (denali/urban).
 * `publicCatalog` plugin gate retained for workspaces without marketing catalog surface.
 */
export async function shouldInvalidateMarketingCatalog(
  workspaceType: string,
  before: CanonicalDocument | null,
  after: CanonicalDocument,
): Promise<boolean> {
  if (!(await workspaceHasPublicCatalogPluginSurface(workspaceType))) {
    return false;
  }
  const wasPublished = before !== null && isTourPubliclyVisible(workspaceType, before);
  const isNowPublished = isTourPubliclyVisible(workspaceType, after);
  return wasPublished || isNowPublished;
}
