import {
  fetchPublicTenantBrandingForHost as fetchGuestPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
} from "@app-tour/guest-surface-host";
import { getLocale } from "next-intl/server";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";

export type { PublicTenantBrandingSnapshot };

/** Server-only — marketing header chrome (no session). */
export async function fetchPublicTenantBrandingForHost(
  host: string,
  locale?: "fa" | "en" | null
): Promise<PublicTenantBrandingSnapshot> {
  const resolvedLocale =
    locale === undefined ? ((await getLocale()) === "fa" ? "fa" : "en") : locale;
  return fetchGuestPublicTenantBrandingForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    onBeforeFetch: assertGuestBffProductionConfig,
    locale: resolvedLocale,
  });
}
