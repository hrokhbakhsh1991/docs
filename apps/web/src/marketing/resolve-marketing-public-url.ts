/** Resolve marketing shell URL for web catalog redirects (M2b). */
export function resolveMarketingPublicBaseUrl(host: string): string {
  const configured = process.env.MARKETING_PUBLIC_BASE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = process.env.MARKETING_DEV_PORT?.trim() || "3002";
  const marketingHost = hostname.startsWith("shop.") ? hostname : `shop.${hostname}`;
  return `http://${marketingHost}:${port}`;
}

/**
 * Avoid blind redirect to an unreachable marketing dev server (ERR_INVALID_REDIRECT).
 * Production with MARKETING_PUBLIC_BASE_URL always redirects; localhost without override shows fallback UI.
 */
export function shouldRedirectCatalogToMarketing(host: string): boolean {
  if (process.env.MARKETING_CATALOG_REDIRECT?.trim() === "false") {
    return false;
  }
  if (process.env.MARKETING_PUBLIC_BASE_URL?.trim()) {
    return true;
  }
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

export function resolveMarketingToursUrl(host: string, cursor?: string): string {
  const base = resolveMarketingPublicBaseUrl(host);
  if (cursor === undefined || cursor.trim().length === 0) {
    return `${base}/tours`;
  }
  return `${base}/tours?cursor=${encodeURIComponent(cursor.trim())}`;
}

export function resolveMarketingTourDetailUrl(host: string, tourId: string): string {
  const base = resolveMarketingPublicBaseUrl(host);
  return `${base}/tours/${encodeURIComponent(tourId.trim())}`;
}
