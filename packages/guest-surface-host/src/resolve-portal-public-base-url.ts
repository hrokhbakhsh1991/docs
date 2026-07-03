import { buildDevPortalPublicBaseUrl } from "@app-tour/tenant-kernel";

/** Resolve user portal base URL from any surface ingress host (WRS-URL-01). */
export function resolvePortalPublicBaseUrl(host: string): string {
  return buildDevPortalPublicBaseUrl({
    ingressHost: host,
    rootDomain: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    portalPort: process.env.PORTAL_DEV_PORT?.trim() || "3003",
    configuredBaseUrl: process.env.PORTAL_PUBLIC_BASE_URL?.trim(),
  });
}

export function resolvePortalRegistrationUrl(host: string, tourId: string): string {
  const id = tourId.trim();
  return `${resolvePortalPublicBaseUrl(host)}/catalog/${encodeURIComponent(id)}/register`;
}

/** PCMS-003 — static marketing link to member area (no session probe). */
export function resolvePortalMemberAreaUrl(host: string): string {
  return `${resolvePortalPublicBaseUrl(host)}/me/registrations`;
}
