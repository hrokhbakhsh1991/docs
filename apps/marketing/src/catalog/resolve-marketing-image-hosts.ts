import type { RemotePattern } from "next/dist/shared/lib/image-config";

export type MarketingImageHostEntry = {
  readonly hostname: string;
  readonly port?: string;
};

const HOST_ENTRY_PATTERN = /^([^:]+)(?::(\d+))?$/;

export function parseMarketingImageRemoteHosts(
  raw: string | undefined
): readonly MarketingImageHostEntry[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }

  const entries: MarketingImageHostEntry[] = [];
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim().toLowerCase();
    if (trimmed.length === 0) {
      continue;
    }
    const match = HOST_ENTRY_PATTERN.exec(trimmed);
    if (match === null) {
      continue;
    }
    const hostname = match[1]?.trim() ?? "";
    if (hostname.length === 0) {
      continue;
    }
    const port = match[2]?.trim();
    entries.push(port !== undefined && port.length > 0 ? { hostname, port } : { hostname });
  }
  return entries;
}

export function buildMarketingImageRemotePatterns(
  raw: string | undefined
): RemotePattern[] {
  const patterns: RemotePattern[] = [];
  for (const entry of parseMarketingImageRemoteHosts(raw)) {
    for (const protocol of ["http", "https"] as const) {
      patterns.push({
        protocol,
        hostname: entry.hostname,
        ...(entry.port !== undefined ? { port: entry.port } : {}),
        pathname: "/**",
      });
    }
  }
  return patterns;
}

function hostEntryMatchesUrl(entry: MarketingImageHostEntry, url: URL): boolean {
  if (url.hostname.toLowerCase() !== entry.hostname) {
    return false;
  }
  if (entry.port === undefined) {
    return true;
  }
  return url.port === entry.port;
}

export function isMarketingCatalogImageOptimizable(src: string): boolean {
  if (process.env.MARKETING_IMAGES_FORCE_UNOPTIMIZED?.trim() === "true") {
    return false;
  }

  const allowedHosts = parseMarketingImageRemoteHosts(
    process.env.MARKETING_IMAGE_REMOTE_HOSTS
  );
  if (allowedHosts.length === 0) {
    return false;
  }

  try {
    const url = new URL(src);
    return allowedHosts.some((entry) => hostEntryMatchesUrl(entry, url));
  } catch {
    return false;
  }
}
