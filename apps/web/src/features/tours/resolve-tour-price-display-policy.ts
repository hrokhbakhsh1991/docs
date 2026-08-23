import {
  resolveCatalogPriceDisplay,
  UnknownCatalogPresentationPluginError,
  type CatalogPriceDisplayPolicy,
} from "@app-tour/workspace-sdk";

/** Manifest-derived IRR label policy for operator tour price formatters (DEC-CW-06 Option E / CW2-03). */
export function resolveTourPriceDisplayPolicy(
  pluginId: string
): CatalogPriceDisplayPolicy | null {
  try {
    return resolveCatalogPriceDisplay(pluginId.trim());
  } catch (error) {
    if (error instanceof UnknownCatalogPresentationPluginError) {
      return null;
    }
    throw error;
  }
}
