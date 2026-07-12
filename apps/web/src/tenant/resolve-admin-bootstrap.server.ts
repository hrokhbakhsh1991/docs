import {
  resolveAdminBootstrapForHost,
  resolveGuestBootstrapRevalidateSeconds,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export type AdminBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

/** Thin web wrapper — PSC/ASB-001 admin surface bootstrap delegate. */
export async function resolveAdminBootstrapForWebHost(host: string): Promise<AdminBootstrap> {
  return resolveAdminBootstrapForHost({
    host,
    resolveFetch: () => ({
      apiBaseUrl: resolveTourOpsApiBaseUrl(),
      onBeforeFetch: assertGuestBffProductionConfig,
      nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
    }),
  });
}
