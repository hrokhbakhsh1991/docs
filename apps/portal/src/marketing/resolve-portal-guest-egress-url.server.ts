import { resolveMarketingPublicBaseUrl } from "./resolve-marketing-public-url";

const DEFAULT_DEV_GUEST_TOUR_ID = "00000000-0000-4000-8000-000000000210";

function catalogGuestRegisterPath(): string {
  const tourId =
    process.env.PORTAL_DEV_GUEST_TOUR_ID?.trim() || DEFAULT_DEV_GUEST_TOUR_ID;
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

function marketingUrlIsPortalHealthFallback(
  marketingUrl: string,
  portalHost: string
): boolean {
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
export function resolvePortalGuestEgressUrl(portalHost: string): string {
  if (configuredMarketingUrlIsHealthFallback()) {
    return catalogGuestRegisterPath();
  }

  const marketingUrl = resolveMarketingPublicBaseUrl(portalHost);
  if (marketingUrlIsPortalHealthFallback(marketingUrl, portalHost)) {
    return catalogGuestRegisterPath();
  }
  return marketingUrl;
}
