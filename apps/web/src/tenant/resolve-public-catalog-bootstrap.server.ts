import {
  resolveBootstrapAppSession,
  resolveBootstrapPluginIdForTenant,
  type ResolvedBootstrapSession,
} from "@/tenant/tenant-kernel.server";

import { fetchPublicTenantContextForHost } from "./fetch-public-tenant-context.server";
import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";
import { resolvePublicFallbackTenantId } from "./resolve-public-host-fallback";

/** Guest actor for public catalog shell — sync with `PUBLIC_CATALOG_GUEST_USER_ID` in workspace HTTP resolvers. */
export const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-8000-000000000001";

export type PublicCatalogBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

function fallbackTenantId(): string {
  return (
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ||
    "00000000-0000-4000-8000-000000000014"
  );
}

/** Guest-safe tenant + plugin for catalog register routes (dev host map → tenant-context → env). */
export async function resolvePublicCatalogBootstrapForHost(
  host: string
): Promise<PublicCatalogBootstrap> {
  const devTenantId = resolveTenantIdFromDevHost(host);
  if (devTenantId !== null) {
    return {
      tenantId: devTenantId,
      pluginId: resolveBootstrapPluginIdForTenant(devTenantId, host),
    };
  }

  const publicContext = await fetchPublicTenantContextForHost(host);
  if (publicContext !== null) {
    return {
      tenantId: publicContext.tenantId,
      pluginId: publicContext.pluginId,
    };
  }

  if (isDevWebSessionAllowed()) {
    const tenantId = fallbackTenantId();
    return {
      tenantId,
      pluginId: resolveBootstrapPluginIdForTenant(tenantId, host),
    };
  }

  const fallbackTenantId = resolvePublicFallbackTenantId(host);
  if (fallbackTenantId !== null) {
    return {
      tenantId: fallbackTenantId,
      pluginId: resolveBootstrapPluginIdForTenant(fallbackTenantId, host),
    };
  }

  throw new Error("PUBLIC_CATALOG_TENANT_UNRESOLVED");
}

/** Guest-safe bootstrap session for root layout on catalog routes (theme + data-tenant-id). */
export async function resolvePublicCatalogRootSessionForHost(
  host: string
): Promise<ResolvedBootstrapSession> {
  const { tenantId } = await resolvePublicCatalogBootstrapForHost(host);
  return resolveBootstrapAppSession(
    {
      userId: PUBLIC_CATALOG_GUEST_USER_ID,
      tenantId,
      workspaceId:
        process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
        process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim() ??
        "default",
      role: "member",
      status: "ACTIVE",
    },
    host
  );
}

export function isPublicCatalogPath(pathname: string): boolean {
  return pathname === "/catalog" || pathname.startsWith("/catalog/");
}
