import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import { WORKSPACE_CATALOG_LIST_FEATURES } from "./workspace-catalog-list-features.generated";

export type CatalogListServerFilterParam =
  | "q"
  | "category"
  | "difficulty"
  | "fitness"
  | "availability"
  | "sort";

export type CatalogListFeatures = {
  readonly cityFilter: boolean;
  readonly serverListFilters: readonly CatalogListServerFilterParam[];
};

export class UnknownCatalogPresentationPluginError extends Error {
  readonly code = "GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED:${pluginId}`);
    this.name = "UnknownCatalogPresentationPluginError";
  }
}

const CATALOG_LIST_SERVER_FILTER_PARAMS: readonly CatalogListServerFilterParam[] = [
  "q",
  "category",
  "difficulty",
  "fitness",
  "availability",
  "sort",
];

function isCatalogListServerFilterParam(value: string): value is CatalogListServerFilterParam {
  return (CATALOG_LIST_SERVER_FILTER_PARAMS as readonly string[]).includes(value);
}

/** List-page capabilities for marketing shell (ADR-MKT-004 companion). */
export function resolveCatalogListFeatures(
  pluginId: WorkspacePluginId | string
): CatalogListFeatures {
  const features = WORKSPACE_CATALOG_LIST_FEATURES[pluginId];
  if (features === undefined) {
    throw new UnknownCatalogPresentationPluginError(pluginId);
  }
  const serverListFilters = features.serverListFilters.filter(isCatalogListServerFilterParam);
  return {
    cityFilter: features.cityFilter,
    serverListFilters,
  };
}

export function catalogListSupportsServerFilter(
  features: CatalogListFeatures,
  param: CatalogListServerFilterParam
): boolean {
  return features.serverListFilters.includes(param);
}
