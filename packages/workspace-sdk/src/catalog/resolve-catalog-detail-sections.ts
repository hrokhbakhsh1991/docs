import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import { UnknownCatalogPresentationPluginError } from "./resolve-catalog-list-features";
import { WORKSPACE_CATALOG_DETAIL_SECTIONS } from "./workspace-catalog-detail-sections.generated";

export type CatalogDetailSections = {
  readonly difficulty: boolean;
  readonly fitness: boolean;
  readonly itinerary: boolean;
  readonly policies: boolean;
};

export { UnknownCatalogPresentationPluginError };

/** Detail-page section gates for marketing shell (ADR-MKT-004 companion). */
export function resolveCatalogDetailSections(
  pluginId: WorkspacePluginId | string
): CatalogDetailSections {
  const sections = WORKSPACE_CATALOG_DETAIL_SECTIONS[pluginId];
  if (sections === undefined) {
    throw new UnknownCatalogPresentationPluginError(pluginId);
  }
  return sections;
}
