import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import { UnknownCatalogPresentationPluginError } from "./resolve-catalog-list-features";
import { WORKSPACE_CATALOG_PRICE_DISPLAY } from "./workspace-catalog-price-display.generated";

export type CatalogPriceDisplayPolicy = {
  readonly irrDisplayUnit?: "toman";
};

export { UnknownCatalogPresentationPluginError };

/**
 * Manifest-derived IRR catalog label policy for marketing formatters (DEC-CW-06 Option E).
 * Returns null when the workspace has catalog presentation but no `priceDisplay` row (Intl path).
 */
export function resolveCatalogPriceDisplay(
  pluginId: WorkspacePluginId | string
): CatalogPriceDisplayPolicy | null {
  const row = WORKSPACE_CATALOG_PRICE_DISPLAY[pluginId];
  if (row === undefined) {
    throw new UnknownCatalogPresentationPluginError(pluginId);
  }
  if (row.irrDisplayUnit === "toman") {
    return { irrDisplayUnit: "toman" };
  }
  return null;
}
