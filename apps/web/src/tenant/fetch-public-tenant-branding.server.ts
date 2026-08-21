import {
  fetchPublicTenantBrandingForHost as fetchGuestPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
} from "@app-tour/guest-surface-host";
import { getLocale } from "next-intl/server";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export type { PublicTenantBrandingSnapshot };

/** Server-only — login chrome + metadata (host subdomain → public branding API). */
export async function fetchPublicTenantBrandingForHost(
  host: string,
  locale?: "fa" | "en" | null
): Promise<PublicTenantBrandingSnapshot> {
  const resolvedLocale = locale ?? ((await getLocale()) === "fa" ? "fa" : "en");
  return fetchGuestPublicTenantBrandingForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    onBeforeFetch: assertGuestBffProductionConfig,
    locale: resolvedLocale,
  });
}
