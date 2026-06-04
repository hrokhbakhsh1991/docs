import { findTenantById } from "./tenant-registry";

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Dev/test tenant ids not in DEV_TENANTS default to starter (BLOCKER-P5-011 waiver).
 */
export function resolveWorkspaceTypeForTenant(tenantId: string): string {
  const registered = findTenantById(tenantId);
  return registered?.workspaceType ?? "starter";
}
