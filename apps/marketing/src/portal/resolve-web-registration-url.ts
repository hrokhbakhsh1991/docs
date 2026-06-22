import { buildDevPortalPublicBaseUrl } from "@app-tour/tenant-kernel";

/** Whether marketing detail should link to web registration intake. */
export function supportsCatalogRegistration(pluginId: string): boolean {
  return pluginId === "urban" || pluginId === "denali";
}

/** Resolve user portal base URL from marketing host (P6 canonical `.portal.` dev origin). */
export function resolvePortalPublicBaseUrl(host: string): string {
  return buildDevPortalPublicBaseUrl({
    ingressHost: host,
    rootDomain: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    portalPort: process.env.PORTAL_DEV_PORT?.trim() || "3003",
    configuredBaseUrl: process.env.PORTAL_PUBLIC_BASE_URL?.trim(),
  });
}

/** @deprecated Use `resolvePortalPublicBaseUrl` — kept for transitional imports. */
export const resolveWebPublicBaseUrl = resolvePortalPublicBaseUrl;

/** Public registration on apps/portal — null when workspace has no public intake. */
export function resolveWebRegistrationUrl(
  host: string,
  tourId: string,
  pluginId: string
): string | null {
  if (!supportsCatalogRegistration(pluginId)) {
    return null;
  }
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}/catalog/${encodeURIComponent(id)}/register`;
}
