import { resolvePublicBrandingHost } from "./resolve-public-branding-host";

export type PublicTenantBrandingSnapshot = {
  readonly displayName: string | null;
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
  readonly defaultLocale: string | null;
  /** Optional tenant-specific marketing hero background (PR-8). */
  readonly marketingHeroUrl?: string | null;
};

export type FetchPublicTenantBrandingOptions = {
  readonly apiBaseUrl: string;
  readonly onBeforeFetch?: () => void;
  readonly locale?: "fa" | "en" | null;
};

const EMPTY_BRANDING: PublicTenantBrandingSnapshot = {
  displayName: null,
  displayNameFa: null,
  displayNameEn: null,
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
  displayNameFa?: string | null;
  displayNameEn?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  defaultLocale?: string | null;
  marketingHeroUrl?: string | null;
}): PublicTenantBrandingSnapshot {
  return {
    displayName: body.displayName?.trim() || null,
    displayNameFa: body.displayNameFa?.trim() || null,
    displayNameEn: body.displayNameEn?.trim() || null,
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
  const resolvedHost = resolvePublicBrandingHost(host);
  const cacheKey = `${resolvedHost}::${options.locale ?? "default"}`;
  const url = `${options.apiBaseUrl.replace(/\/$/, "")}/public/tenant-branding`;

  try {
    const init: RequestInit = {
      headers: {
        "x-forwarded-host": resolvedHost,
        ...(options.locale !== undefined && options.locale !== null
          ? { "x-tenant-locale": options.locale }
          : {}),
      },
      cache: "no-store",
    };
    const res = await fetch(url, init);
    if (!res.ok) {
      return fallbackSnapshot(cacheKey);
    }
    const body = (await res.json()) as {
      displayName?: string | null;
      displayNameFa?: string | null;
      displayNameEn?: string | null;
      primaryColor?: string | null;
      logoUrl?: string | null;
      defaultLocale?: string | null;
      marketingHeroUrl?: string | null;
    };
    return rememberSuccessfulSnapshot(cacheKey, snapshotFromBody(body));
  } catch {
    return fallbackSnapshot(cacheKey);
  }
}
