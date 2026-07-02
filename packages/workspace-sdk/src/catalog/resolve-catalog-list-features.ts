import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import { WORKSPACE_CATALOG_LIST_FEATURES } from "./workspace-catalog-list-features.generated";

export type CatalogListFeatures = {
  readonly cityFilter: boolean;
};

export class UnknownCatalogPresentationPluginError extends Error {
  readonly code = "GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED:${pluginId}`);
    this.name = "UnknownCatalogPresentationPluginError";
  }
}

/** List-page capabilities for marketing shell (ADR-MKT-004 companion). */
export function resolveCatalogListFeatures(
  pluginId: WorkspacePluginId | string
): CatalogListFeatures {
  const features = WORKSPACE_CATALOG_LIST_FEATURES[pluginId];
  if (features === undefined) {
    throw new UnknownCatalogPresentationPluginError(pluginId);
  }
  return features;
}
