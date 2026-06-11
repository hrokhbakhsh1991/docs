/** Map web host to portal registration URL (DEC-P11-014). */
export function resolvePortalPublicBaseUrl(host: string): string {
  const configured = process.env.PORTAL_PUBLIC_BASE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = process.env.PORTAL_DEV_PORT?.trim() || "3003";
  return `http://${hostname}:${port}`;
}

export function resolvePortalRegistrationRedirectUrl(host: string, tourId: string): string {
  const id = tourId.trim();
  return `${resolvePortalPublicBaseUrl(host)}/catalog/${encodeURIComponent(id)}/register`;
}
