import {
  fetchPublicTenantContextForHost,
  type FetchPublicTenantContextOptions,
} from "./fetch-public-tenant-context";
import { isDevGuestHostAllowed } from "./is-dev-guest-host-allowed";
import { OPERATOR_SMOKE_TENANT_ID, resolveDevPluginIdForTenantId } from "./resolve-dev-plugin-id";
import {
  resolveTenantIdFromDevHost,
  type GuestDevHostSurface,
} from "./resolve-tenant-id-from-dev-host";

export type GuestSurfaceBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

export type GuestSurfaceUnresolvedError = "MARKETING_TENANT_UNRESOLVED" | "PORTAL_TENANT_UNRESOLVED";

export type ResolveGuestSurfaceBootstrapOptions = {
  readonly surface: GuestDevHostSurface;
  readonly host: string;
  readonly resolveFetch: () => FetchPublicTenantContextOptions;
  readonly unresolvedError: GuestSurfaceUnresolvedError;
  readonly devFallbackTenantId?: () => string;
};

function defaultDevFallbackTenantId(): string {
  return (
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ||
    OPERATOR_SMOKE_TENANT_ID
  );
}

/** Shared M+P bootstrap — prod pluginId from API; dev from UUID map only (G-BOOT-03). */
export async function resolveGuestSurfaceBootstrapForHost(
  options: ResolveGuestSurfaceBootstrapOptions
): Promise<GuestSurfaceBootstrap> {
  const { surface, host, resolveFetch, unresolvedError } = options;
  const devFallbackTenantId = options.devFallbackTenantId ?? defaultDevFallbackTenantId;

  const devTenantId = resolveTenantIdFromDevHost(host, surface);
  if (devTenantId !== null) {
    return {
      tenantId: devTenantId,
      pluginId: resolveDevPluginIdForTenantId(devTenantId),
    };
  }

  const publicContext = await fetchPublicTenantContextForHost(host, resolveFetch());
  if (publicContext !== null) {
    return { tenantId: publicContext.tenantId, pluginId: publicContext.pluginId };
  }

  if (isDevGuestHostAllowed()) {
    const tenantId = devFallbackTenantId();
    return { tenantId, pluginId: resolveDevPluginIdForTenantId(tenantId) };
  }

  throw new Error(unresolvedError);
}
