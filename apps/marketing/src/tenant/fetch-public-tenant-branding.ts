import {
  fetchPublicTenantBrandingForHost as fetchGuestPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";

export type { PublicTenantBrandingSnapshot };

/** Server-only — marketing header chrome (no session). */
export async function fetchPublicTenantBrandingForHost(
  host: string
): Promise<PublicTenantBrandingSnapshot> {
  return fetchGuestPublicTenantBrandingForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    onBeforeFetch: assertGuestBffProductionConfig,
  });
}
