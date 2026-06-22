import { buildDevPortalPublicBaseUrl } from "@app-tour/tenant-kernel";

/** Map web host to portal registration URL (DEC-P11-014). */
export function resolvePortalPublicBaseUrl(host: string): string {
  return buildDevPortalPublicBaseUrl({
    ingressHost: host,
    rootDomain: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    portalPort: process.env.PORTAL_DEV_PORT?.trim() || "3003",
    configuredBaseUrl: process.env.PORTAL_PUBLIC_BASE_URL?.trim(),
  });
}

export function resolvePortalRegistrationRedirectUrl(host: string, tourId: string): string {
  const id = tourId.trim();
  return `${resolvePortalPublicBaseUrl(host)}/catalog/${encodeURIComponent(id)}/register`;
}
