import {
  fetchPublicTenantContextForHost as fetchGuestPublicTenantContextForHost,
  resolveGuestBootstrapRevalidateSeconds,
  type PublicTenantContextSnapshot,
} from "@app-tour/guest-surface-host";

import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export type { PublicTenantContextSnapshot };

/** Server-only — production public catalog bootstrap (guest-safe). */
export async function fetchPublicTenantContextForHost(
  host: string
): Promise<PublicTenantContextSnapshot | null> {
  return fetchGuestPublicTenantContextForHost(host, {
    apiBaseUrl: resolveTourOpsApiBaseUrl(),
    nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
  });
}
