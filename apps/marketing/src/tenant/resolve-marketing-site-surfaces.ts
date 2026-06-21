import { fetchPublicTenantContextForHost } from "./fetch-public-tenant-context";
import {
  DEFAULT_MARKETING_SITE_SURFACES,
  resolveDevMarketingSiteSurfaces,
  type MarketingSiteSurfaces,
} from "./marketing-site-surfaces";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";

/** Guest-safe site surface flags for marketing shell (P4-C). */
export async function resolveMarketingSiteSurfacesForHost(
  host: string
): Promise<MarketingSiteSurfaces> {
  if (resolveTenantIdFromDevHost(host) !== null) {
    return resolveDevMarketingSiteSurfaces();
  }

  const publicContext = await fetchPublicTenantContextForHost(host);
  if (publicContext?.siteSurfaces !== undefined) {
    return publicContext.siteSurfaces;
  }

  return DEFAULT_MARKETING_SITE_SURFACES;
}
