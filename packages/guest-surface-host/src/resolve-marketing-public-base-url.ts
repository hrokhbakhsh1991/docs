import { buildDevMarketingPublicBaseUrl } from "@app-tour/tenant-kernel/host-only";

function resolveProductionMarketingBaseUrl(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const configured = process.env.MARKETING_PUBLIC_BASE_URL?.trim();
  const allowlist = (process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!configured || allowlist.length === 0 || !allowlist.includes(configured.replace(/\/$/, ""))) {
    throw new Error("MARKETING_PUBLIC_BASE_URL must be an allowlisted production origin");
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("MARKETING_PUBLIC_BASE_URL must be a valid URL");
  }
  if (!((url.protocol === "https:" || url.protocol === "http:") && url.hostname && !url.port)) {
    throw new Error("MARKETING_PUBLIC_BASE_URL must be a portless HTTP(S) origin");
  }
  return configured.replace(/\/$/, "");
}

/** Resolve public marketing base URL from any surface ingress host (WRS-URL-01). */
export function resolveMarketingPublicBaseUrl(host: string): string {
  const productionBaseUrl = resolveProductionMarketingBaseUrl();
  if (productionBaseUrl !== undefined) return productionBaseUrl;
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
