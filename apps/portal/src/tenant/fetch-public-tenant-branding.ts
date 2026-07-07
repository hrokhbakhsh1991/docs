import { resolvePublicBrandingHost } from "@app-tour/guest-surface-host";
import { resolveTourOpsApiBaseUrl } from "../env";

export type PublicTenantBrandingSnapshot = {
  readonly displayName: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
  readonly defaultLocale: string | null;
};

const EMPTY_BRANDING: PublicTenantBrandingSnapshot = {
  displayName: null,
  primaryColor: null,
  logoUrl: null,
  defaultLocale: null,
};

/** Server-only — marketing header chrome (no session). */
export async function fetchPublicTenantBrandingForHost(
  host: string
): Promise<PublicTenantBrandingSnapshot> {
  const brandingHost = resolvePublicBrandingHost(host);
  const url = `${resolveTourOpsApiBaseUrl()}/public/tenant-branding`;

  try {
    const res = await fetch(url, {
      headers: { "x-forwarded-host": brandingHost },
      next: { revalidate: resolveBrandingRevalidateSeconds() },
    });
    if (!res.ok) {
      return EMPTY_BRANDING;
    }
    const body = (await res.json()) as {
      displayName?: string | null;
      primaryColor?: string | null;
      logoUrl?: string | null;
      defaultLocale?: string | null;
    };
    return {
      displayName: body.displayName?.trim() || null,
      primaryColor: body.primaryColor?.trim() || null,
      logoUrl: body.logoUrl?.trim() || null,
      defaultLocale: body.defaultLocale?.trim() || null,
    };
  } catch {
    return EMPTY_BRANDING;
  }
}

function resolveBrandingRevalidateSeconds(): number {
  const raw = process.env.MARKETING_BRANDING_REVALIDATE_SECONDS?.trim();
  if (raw === undefined || raw.length === 0) {
    return 300;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 300;
  }
  return parsed;
}
