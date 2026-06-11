import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
} from "@app-tour/workspace-sdk";

import { fetchPublicTenantContextForHost } from "./fetch-public-tenant-context";
import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

export type PortalBootstrap = {
  readonly tenantId: string;
  readonly pluginId: string;
};

function resolvePluginIdForTenant(tenantId: string, host: string): string {
  if (tenantId === DENALI_SMOKE_TENANT_ID || tenantId === OPERATOR_SMOKE_TENANT_ID) {
    return "denali";
  }
  if (tenantId === URBAN_SMOKE_TENANT_ID) {
    return "urban";
  }
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.includes("denali") || hostname.includes("operator")) {
    return "denali";
  }
  if (hostname.includes("urban")) {
    return "urban";
  }
  return resolveWorkspacePluginIdForType("denali", DEFAULT_WORKSPACE_TYPE_BINDINGS) ?? "denali";
}

function fallbackTenantId(): string {
  return (
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ||
    OPERATOR_SMOKE_TENANT_ID
  );
}

export async function resolvePortalBootstrapForHost(host: string): Promise<PortalBootstrap> {
  const devTenantId = resolveTenantIdFromDevHost(host);
  if (devTenantId !== null) {
    return { tenantId: devTenantId, pluginId: resolvePluginIdForTenant(devTenantId, host) };
  }

  const publicContext = await fetchPublicTenantContextForHost(host);
  if (publicContext !== null) {
    return { tenantId: publicContext.tenantId, pluginId: publicContext.pluginId };
  }

  if (isDevWebSessionAllowed()) {
    const tenantId = fallbackTenantId();
    return { tenantId, pluginId: resolvePluginIdForTenant(tenantId, host) };
  }

  throw new Error("PORTAL_TENANT_UNRESOLVED");
}
