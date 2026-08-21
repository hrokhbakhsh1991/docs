import {
  fetchPublicTenantBrandingForHost as fetchGuestPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
} from "@app-tour/guest-surface-host";
import { getLocale } from "next-intl/server";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";

export type { PublicTenantBrandingSnapshot };

/** Server-only — portal guest shell chrome (no session). */
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
