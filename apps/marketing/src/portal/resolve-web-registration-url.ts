/** Whether marketing detail should link to web registration intake. */
export function supportsCatalogRegistration(pluginId: string): boolean {
  return pluginId === "urban" || pluginId === "denali";
}

/** Resolve user portal base URL from marketing host (inverse of M2b shop prefix). */
export function resolvePortalPublicBaseUrl(host: string): string {
  const configured = process.env.PORTAL_PUBLIC_BASE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = process.env.PORTAL_DEV_PORT?.trim() || "3003";
  const portalHost = hostname.startsWith("shop.") ? hostname.slice("shop.".length) : hostname;
  return `http://${portalHost}:${port}`;
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
