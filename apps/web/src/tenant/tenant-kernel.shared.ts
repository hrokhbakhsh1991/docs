import { resolveDevPluginIdForTenantId } from "@app-tour/guest-surface-host/host-only";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { listBootstrapWorkspacePlugins } from "@/bootstrap/workspace-plugins";

import { isDevWebSessionAllowed } from "./auth-env";
import type { TenantKernelResolveInput } from "./tenant-kernel.types";

const bootstrapPlugin = listBootstrapWorkspacePlugins()[0];

if (!bootstrapPlugin) {
  throw new Error("BOOTSTRAP_WORKSPACE_PLUGIN_MISSING");
}

/** Dev/provisioned tenant UUID → pluginId via codegen map (PSC-001 Phase 1c — no hostname heuristics). */
function resolveBootstrapPluginId(tenantId: string): string {
  try {
    return resolveDevPluginIdForTenantId(tenantId);
  } catch {
    return bootstrapPlugin.id;
  }
}

export function resolveBootstrapPluginIdForTenant(tenantId: string, _host?: string): string {
  return resolveBootstrapPluginId(tenantId);
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
