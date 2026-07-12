import {
  resolveGuestBootstrapRevalidateSeconds,
  resolveGuestSurfaceBootstrapForHost,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";

export type MarketingBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

export async function resolveMarketingBootstrapForHost(host: string): Promise<MarketingBootstrap> {
  return resolveGuestSurfaceBootstrapForHost({
    surface: "marketing",
    host,
    resolveFetch: () => ({
      apiBaseUrl: resolveTourOpsApiBaseUrl(),
      onBeforeFetch: assertGuestBffProductionConfig,
      nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
    }),
    unresolvedError: "MARKETING_TENANT_UNRESOLVED",
  });
}
