export const PUBLIC_AUTH_CORS_ALLOW_METHODS = "GET, POST, OPTIONS";
export const PUBLIC_AUTH_CORS_ALLOW_HEADERS = "content-type";
export const PUBLIC_AUTH_CORS_MAX_AGE_SECONDS = "600";

/** Portal public-auth BFF prefix — the only CORS surface (PCMS-CORS-01). */
export function isPortalPublicAuthApiPath(pathname: string): boolean {
  return pathname === "/api/public-auth" || pathname.startsWith("/api/public-auth/");
}

/**
 * Attach credentialed CORS for an already-allowlisted origin.
 * Refuses `*` / empty so a caller cannot widen PCMS-CORS-01 by accident.
 */
export function applyPublicAuthCorsHeaders(headers: Headers, allowOrigin: string): void {
  const origin = allowOrigin.trim();
  if (origin.length === 0 || origin === "*") {
    return;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", PUBLIC_AUTH_CORS_ALLOW_METHODS);
  headers.set("Access-Control-Allow-Headers", PUBLIC_AUTH_CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Max-Age", PUBLIC_AUTH_CORS_MAX_AGE_SECONDS);

  const vary = headers.get("Vary");
  if (vary === null || vary.trim().length === 0) {
    headers.set("Vary", "Origin");
    return;
  }
  if (!/(?:^|,\s*)origin(?:\s*,|$)/i.test(vary)) {
    headers.set("Vary", `${vary}, Origin`);
  }
}
