import { resolveMarketingTourDetailUrl } from "./resolve-marketing-public-url";
import { isPortalOnlyDevMarketing } from "./resolve-portal-guest-egress-url.server";

/** Marketing tour PDP egress, with portal-only dev fallback (no marketing app). */
export function resolvePortalRegistrationBackHref(host: string, tourId: string): string {
  if (isPortalOnlyDevMarketing()) {
    return "/";
  }
  return resolveMarketingTourDetailUrl(host, tourId);
}
