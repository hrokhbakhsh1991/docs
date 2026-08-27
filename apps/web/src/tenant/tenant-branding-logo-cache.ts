import {
  fetchTenantBranding,
  resolveTenantBrandLogoPreviewUrl,
} from "@/features/settings/tenant-brand-logo-client";
import type { TenantBrandingState } from "@/features/settings/branding-types";

type LogoCacheListener = () => void;
type TenantBrandingSnapshot = {
  readonly branding: TenantBrandingState;
  readonly logoUrl: string | null;
};

let cachedSnapshot: TenantBrandingSnapshot | null = null;
let inflightSnapshot: Promise<TenantBrandingSnapshot | null> | null = null;
const listeners = new Set<LogoCacheListener>();

/** Cross-shell logo URL cache (operator shell + wizard bridge share one fetch). */
export function bumpTenantBrandingLogoCache(): void {
  cachedSnapshot = null;
  inflightSnapshot = null;
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

export async function fetchTenantBrandingShared(): Promise<TenantBrandingSnapshot | null> {
  if (cachedSnapshot !== null) {
    return cachedSnapshot;
  }
  if (inflightSnapshot !== null) {
    return inflightSnapshot;
  }

  inflightSnapshot = fetchTenantBranding()
    .then(async (branding) => {
      if (branding.logo === null) {
        return { branding, logoUrl: null };
      }
      const logoUrl = await resolveTenantBrandLogoPreviewUrl().catch(() => null);
      return { branding, logoUrl };
    })
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      inflightSnapshot = null;
      return snapshot;
    })
    .catch(() => {
      inflightSnapshot = null;
      return null;
    });
  return inflightSnapshot;
}

export async function fetchTenantBrandingLogoShared(): Promise<string | null> {
  return (await fetchTenantBrandingShared())?.logoUrl ?? null;
}
