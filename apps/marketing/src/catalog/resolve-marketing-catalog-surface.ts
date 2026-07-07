import { resolveMarketingCatalogSurface } from "@/bootstrap/workspace-marketing-catalog-bindings.generated";

export { resolveMarketingCatalogSurface };

export function hasMarketingCatalogSurface(pluginId: string): boolean {
  return resolveMarketingCatalogSurface(pluginId) != null;
}
