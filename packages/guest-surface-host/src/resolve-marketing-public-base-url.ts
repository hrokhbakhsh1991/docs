import { buildDevMarketingPublicBaseUrl } from "@app-tour/tenant-kernel";

/** Resolve public marketing base URL from any surface ingress host (WRS-URL-01). */
export function resolveMarketingPublicBaseUrl(host: string): string {
  return buildDevMarketingPublicBaseUrl({
    ingressHost: host,
    rootDomain: process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost",
    marketingPort: process.env.MARKETING_DEV_PORT?.trim() || "3002",
    configuredBaseUrl: process.env.MARKETING_PUBLIC_BASE_URL?.trim(),
  });
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
