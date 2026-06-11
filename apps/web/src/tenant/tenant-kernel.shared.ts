import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { listBootstrapWorkspacePlugins } from "@/bootstrap/workspace-plugins";

import { isDevWebSessionAllowed } from "./auth-env";
import type { TenantKernelResolveInput } from "./tenant-kernel.types";

const DENALI_WORKSPACE_PLUGIN_ID = "denali" as const;
const URBAN_WORKSPACE_PLUGIN_ID = "urban" as const;

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

const bootstrapPlugin = listBootstrapWorkspacePlugins()[0];

if (!bootstrapPlugin) {
  throw new Error("BOOTSTRAP_WORKSPACE_PLUGIN_MISSING");
}

function resolveBootstrapPluginId(tenantId: string, host?: string): string {
  if (tenantId === DENALI_SMOKE_TENANT_ID || tenantId === OPERATOR_SMOKE_TENANT_ID) {
    return DENALI_WORKSPACE_PLUGIN_ID;
  }
  if (tenantId === URBAN_SMOKE_TENANT_ID) {
    return URBAN_WORKSPACE_PLUGIN_ID;
  }
  const hostname = host?.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.startsWith("denali.")) {
    return DENALI_WORKSPACE_PLUGIN_ID;
  }
  if (hostname.startsWith("urban.")) {
    return URBAN_WORKSPACE_PLUGIN_ID;
  }
  return bootstrapPlugin.id;
}

export function resolveBootstrapPluginIdForTenant(tenantId: string, host?: string): string {
  return resolveBootstrapPluginId(tenantId, host);
}

export function resolveContextFromEnv(): TenantKernelResolveInput {
  if (!isDevWebSessionAllowed()) {
    throw new Error("WEB_SESSION_NOT_CONFIGURED");
  }

  return {
    userId: process.env.TOUR_OPS_DEV_USER_ID ?? process.env.NEXT_PUBLIC_DEV_USER_ID ?? "dev-user",
    tenantId:
      process.env.TOUR_OPS_DEV_TENANT_ID ??
      process.env.NEXT_PUBLIC_DEV_TENANT_ID ??
      "dev-tenant-local",
    workspaceId:
      process.env.TOUR_OPS_DEV_WORKSPACE_ID ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID ??
      "default",
    role: (process.env.TOUR_OPS_DEV_ACTOR_ROLE ??
      process.env.NEXT_PUBLIC_DEV_ACTOR_ROLE ??
      "admin") as TenantAuthContext["role"],
    status: (process.env.TOUR_OPS_DEV_MEMBERSHIP_STATUS ??
      process.env.NEXT_PUBLIC_DEV_MEMBERSHIP_STATUS ??
      "ACTIVE") as TenantAuthContext["status"],
  };
}

export function resolveTenantContext(
  input: TenantKernelResolveInput = resolveContextFromEnv()
): TenantAuthContext {
  return {
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    status: input.status,
    workspaceId: input.workspaceId,
  };
}

export { bootstrapPlugin };
