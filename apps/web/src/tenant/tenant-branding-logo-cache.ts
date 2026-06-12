import {
  fetchTenantBranding,
  resolveTenantBrandLogoPreviewUrl,
} from "@/features/settings/tenant-brand-logo-client";

type LogoCacheListener = () => void;

let cachedLogoUrl: string | null = null;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<LogoCacheListener>();

/** Cross-shell logo URL cache (operator shell + wizard bridge share one fetch). */
export function bumpTenantBrandingLogoCache(): void {
  cachedLogoUrl = null;
  inflight = null;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeTenantBrandingLogoCache(listener: LogoCacheListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function fetchTenantBrandingLogoShared(): Promise<string | null> {
  if (cachedLogoUrl !== null) {
    return cachedLogoUrl;
  }
  if (inflight !== null) {
    return inflight;
  }
  inflight = fetchTenantBranding()
    .then(async (branding) => {
      if (branding.logo === null) {
        return null;
      }
      return resolveTenantBrandLogoPreviewUrl();
    })
    .then((url) => {
      cachedLogoUrl = url;
      inflight = null;
      return url;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}
