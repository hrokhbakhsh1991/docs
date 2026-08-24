import {
  resolveGuestBootstrapRevalidateSeconds,
  resolveGuestSurfaceBootstrapForHost,
  assertGuestBffProductionConfig,
  resolveTourOpsApiBaseUrl,
} from "@app-tour/guest-surface-host";

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
