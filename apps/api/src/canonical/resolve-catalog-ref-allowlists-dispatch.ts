import { requiresCatalogRefEnrichment } from "./workspace-canonical-tour-dispatch.ts";
import type { CatalogRefAllowlists } from "./assert-catalog-ref-integrity.ts";
import { resolveCatalogRefAllowlistsForWorkspaceBinding } from "./workspace-catalog-ref-allowlist-resolvers.generated.ts";

/** Workspace-scoped catalog ref allowlists for publish gate (manifest `catalogRefEnrichment`). */
export async function resolveCatalogRefAllowlistsForWorkspace(
  workspaceType: string,
  tenantId: string
): Promise<CatalogRefAllowlists | undefined> {
  if (!requiresCatalogRefEnrichment(workspaceType)) {
    return undefined;
  }
  return resolveCatalogRefAllowlistsForWorkspaceBinding(workspaceType, tenantId);
}
