import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

const CATALOG_LIST_PATHS: Readonly<Record<string, string>> = {
  denali: "/denali/catalog",
  urban: "/urban/catalog",
};

export class UnknownCatalogPluginError extends Error {
  readonly code = "UNKNOWN_CATALOG_PLUGIN" as const;

  constructor(pluginId: string) {
    super(`UNKNOWN_CATALOG_PLUGIN:${pluginId}`);
    this.name = "UnknownCatalogPluginError";
  }
}

/** Resolve workspace HTTP list path for marketing BFF (ADR-MKT-004). */
export function resolveCatalogListApiPath(pluginId: WorkspacePluginId | string): string {
  const path = CATALOG_LIST_PATHS[pluginId];
  if (path === undefined) {
    throw new UnknownCatalogPluginError(pluginId);
  }
  return path;
}

/** Resolve detail path for a single tour card. */
export function resolveCatalogTourApiPath(
  pluginId: WorkspacePluginId | string,
  tourId: string
): string {
  const base = resolveCatalogListApiPath(pluginId);
  const id = tourId.trim();
  if (id.length === 0) {
    throw new Error("CATALOG_TOUR_ID_REQUIRED");
  }
  return `${base}/${encodeURIComponent(id)}`;
}
