import {
  resolveGuestBootstrapRevalidateSeconds,
  resolveGuestSurfaceBootstrapForHost,
} from "@app-tour/guest-surface-host";

import { assertGuestBffProductionConfig, resolveTourOpsApiBaseUrl } from "../env";

export type PortalBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

export async function resolvePortalBootstrapForHost(host: string): Promise<PortalBootstrap> {
  return resolveGuestSurfaceBootstrapForHost({
    surface: "portal",
    host,
    resolveFetch: () => ({
      apiBaseUrl: resolveTourOpsApiBaseUrl(),
      onBeforeFetch: assertGuestBffProductionConfig,
      nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
    }),
    unresolvedError: "PORTAL_TENANT_UNRESOLVED",
  });
}
