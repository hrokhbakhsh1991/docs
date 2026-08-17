import { resolveGuestBrandingRevalidateSeconds } from "./resolve-guest-fetch-revalidate";
import { resolvePublicBrandingHost } from "./resolve-public-branding-host";

export type PublicTenantBrandingSnapshot = {
  readonly displayName: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
  readonly defaultLocale: string | null;
  /** Optional tenant-specific marketing hero background (PR-8). */
  readonly marketingHeroUrl?: string | null;
};

export type FetchPublicTenantBrandingOptions = {
  readonly apiBaseUrl: string;
  readonly onBeforeFetch?: () => void;
  readonly nextRevalidate?: number;
};

const EMPTY_BRANDING: PublicTenantBrandingSnapshot = {
  displayName: null,
  primaryColor: null,
  logoUrl: null,
  defaultLocale: null,
};

/** Last successful GET per branding host — fail-soft when the API blips (BUG-8). */
const lastSuccessfulBrandingByHost = new Map<string, PublicTenantBrandingSnapshot>();

export function resetPublicTenantBrandingSnapshotCacheForTests(): void {
  lastSuccessfulBrandingByHost.clear();
}

function snapshotFromBody(body: {
  displayName?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  defaultLocale?: string | null;
  marketingHeroUrl?: string | null;
}): PublicTenantBrandingSnapshot {
  return {
    displayName: body.displayName?.trim() || null,
    primaryColor: body.primaryColor?.trim() || null,
    logoUrl: body.logoUrl?.trim() || null,
    defaultLocale: body.defaultLocale?.trim() || null,
    marketingHeroUrl: body.marketingHeroUrl?.trim() || null,
  };
}

function rememberSuccessfulSnapshot(
  brandingHost: string,
  snapshot: PublicTenantBrandingSnapshot
): PublicTenantBrandingSnapshot {
  lastSuccessfulBrandingByHost.set(brandingHost, snapshot);
  return snapshot;
}

function fallbackSnapshot(brandingHost: string): PublicTenantBrandingSnapshot {
  return lastSuccessfulBrandingByHost.get(brandingHost) ?? EMPTY_BRANDING;
}

/** Server-only — guest-safe tenant chrome from `GET /public/tenant-branding` (G-BOOT-05). */
export async function fetchPublicTenantBrandingForHost(
  host: string,
  options: FetchPublicTenantBrandingOptions
): Promise<PublicTenantBrandingSnapshot> {
  options.onBeforeFetch?.();
  const brandingHost = resolvePublicBrandingHost(host);
  const url = `${options.apiBaseUrl.replace(/\/$/, "")}/public/tenant-branding`;
  const revalidate = options.nextRevalidate ?? resolveGuestBrandingRevalidateSeconds();

  try {
    const isDev = process.env.NODE_ENV === "development";
    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: { "x-forwarded-host": brandingHost },
      ...(isDev ? { cache: "no-store" } : { next: { revalidate } }),
    };
    const res = await fetch(url, init);
    if (!res.ok) {
      return fallbackSnapshot(brandingHost);
    }
    const body = (await res.json()) as {
      displayName?: string | null;
      primaryColor?: string | null;
      logoUrl?: string | null;
      defaultLocale?: string | null;
      marketingHeroUrl?: string | null;
    };
    return rememberSuccessfulSnapshot(brandingHost, snapshotFromBody(body));
  } catch {
    return fallbackSnapshot(brandingHost);
  }
}
