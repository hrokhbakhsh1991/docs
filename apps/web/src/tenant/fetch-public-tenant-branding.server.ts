import {
  fetchPublicTenantBrandingForHost as fetchGuestPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export type { PublicTenantBrandingSnapshot };

/** Server-only — login chrome + metadata (host subdomain → public branding API). */
export async function fetchPublicTenantBrandingForHost(
  host: string
): Promise<PublicTenantBrandingSnapshot> {
  return fetchGuestPublicTenantBrandingForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    onBeforeFetch: assertGuestBffProductionConfig,
  });
}
