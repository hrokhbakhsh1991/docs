import { resolveMemberLoginCatalogTourId } from "@app-tour/guest-surface-host";

import { resolveMarketingPublicBaseUrl } from "./resolve-marketing-public-url";

function catalogGuestRegisterPath(pluginId: string | null): string {
  const tourId = resolveMemberLoginCatalogTourId(pluginId);
  return `/catalog/${tourId}/register`;
}

function configuredMarketingUrlIsHealthFallback(): boolean {
  const configured = process.env.MARKETING_PUBLIC_BASE_URL?.trim();
  if (configured === undefined || configured.length === 0) {
    return false;
  }
  try {
    return new URL(configured).pathname === "/health";
  } catch {
    return false;
  }
}

function marketingUrlIsPortalHealthFallback(marketingUrl: string, portalHost: string): boolean {
  try {
    const target = new URL(marketingUrl);
    const portalHostname = portalHost.split(":")[0];
    return (
      (target.host === portalHost || target.hostname === portalHostname) &&
      target.pathname === "/health"
    );
  } catch {
    return false;
  }
}

/** True when MARKETING_PUBLIC_BASE_URL points at portal /health (portal-only smoke). */
export function isPortalOnlyDevMarketing(): boolean {
  return configuredMarketingUrlIsHealthFallback();
}

/** Guest egress when portal `/` has no member session (PCMS-003). */
export function resolvePortalGuestEgressUrl(portalHost: string, pluginId: string | null): string {
  if (configuredMarketingUrlIsHealthFallback()) {
    return catalogGuestRegisterPath(pluginId);
  }

  const marketingUrl = resolveMarketingPublicBaseUrl(portalHost);
  if (marketingUrlIsPortalHealthFallback(marketingUrl, portalHost)) {
    return catalogGuestRegisterPath(pluginId);
  }
  return marketingUrl;
}
