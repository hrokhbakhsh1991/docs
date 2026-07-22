import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import type { TenantBrandingState } from "@/features/settings/branding-types";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export type TenantBrandingServerPrefetch = {
  readonly branding: TenantBrandingState;
  readonly logoPreviewUrl: string | null;
};

async function fetchBrandingBackendJson(
  path: string,
  host: string,
  token: string
): Promise<unknown | null> {
  const apiBase = resolveTourOpsApiBaseUrl();
  try {
    const backendRes = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        host: host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
    if (!backendRes.ok) {
      return null;
    }
    return (await backendRes.json()) as unknown;
  } catch {
    return null;
  }
}

/** Server prefetch for branding settings — avoids client-only loading stall. */
export async function fetchTenantBrandingServer(): Promise<TenantBrandingServerPrefetch | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const brandingRaw = await fetchBrandingBackendJson("/settings/branding", host, token);
  if (brandingRaw === null) {
    return null;
  }

  const branding = brandingRaw as TenantBrandingState;
  let logoPreviewUrl: string | null = null;
  if (branding.logo?.storageKey) {
    const logoUrlRaw = await fetchBrandingBackendJson("/settings/branding/logo/url", host, token);
    if (logoUrlRaw !== null && typeof logoUrlRaw === "object") {
      const url = (logoUrlRaw as { url?: unknown }).url;
      logoPreviewUrl = typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
    }
  }

  return { branding, logoPreviewUrl };
}
