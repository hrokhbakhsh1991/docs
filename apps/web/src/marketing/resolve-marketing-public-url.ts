import {
  resolveMarketingPublicBaseUrl,
  resolveMarketingTourDetailUrl,
  resolveMarketingToursUrl,
} from "@app-tour/guest-surface-host";

export { resolveMarketingPublicBaseUrl, resolveMarketingTourDetailUrl, resolveMarketingToursUrl };

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
