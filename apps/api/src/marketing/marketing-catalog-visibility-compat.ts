import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

/**
 * CW3-03 compat — plugin `publicCatalog.isPublished` predicate (retained until census zero).
 * Parity proofs only; production consumer uses `isTourPubliclyVisible` dispatch.
 */
export async function isTourPublishedViaPublicCatalogPlugin(
  workspaceType: string,
  canonical: CanonicalDocument,
): Promise<boolean> {
  const isPublished = (await resolveWorkspacePluginForType(workspaceType)).publicCatalog?.isPublished;
  if (isPublished === undefined) {
    return false;
  }
  return isPublished(canonical);
}

/**
 * CW3-03 compat — whether workspace plugin exposes public catalog surface.
 * Retained gate: workspaces without `publicCatalog` skip marketing invalidation (starter, harbor).
 */
export async function workspaceHasPublicCatalogPluginSurface(
  workspaceType: string,
): Promise<boolean> {
  const isPublished = (await resolveWorkspacePluginForType(workspaceType)).publicCatalog?.isPublished;
  return isPublished !== undefined;
}
