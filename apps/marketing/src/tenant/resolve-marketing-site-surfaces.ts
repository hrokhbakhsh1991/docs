import {
  fetchPublicTenantContextForHost,
  resolveGuestBootstrapRevalidateSeconds,
  resolveTenantIdFromDevHost,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";
import {
  DEFAULT_MARKETING_SITE_SURFACES,
  normalizeMarketingSiteSurfaces,
  resolveDevMarketingSiteSurfaces,
  type MarketingSiteSurfaces,
} from "./marketing-site-surfaces";

/** Guest-safe site surface flags for marketing shell (P4-C). */
export async function resolveMarketingSiteSurfacesForHost(
  host: string
): Promise<MarketingSiteSurfaces> {
  if (resolveTenantIdFromDevHost(host, "marketing") !== null) {
    return resolveDevMarketingSiteSurfaces();
  }

  const publicContext = await fetchPublicTenantContextForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    onBeforeFetch: assertGuestBffProductionConfig,
    nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
  });
  if (publicContext?.siteSurfaces !== undefined) {
    return normalizeMarketingSiteSurfaces(publicContext.siteSurfaces);
  }

  return DEFAULT_MARKETING_SITE_SURFACES;
}
