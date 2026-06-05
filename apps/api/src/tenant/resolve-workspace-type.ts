import { resolveRegisteredTenantById } from "./resolve-registered-tenant";

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Postgres `tenants.workspace_type` when present; else static registry; else starter.
 */
export async function resolveWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  const registered = await resolveRegisteredTenantById(tenantId);
  return registered?.workspaceType ?? "starter";
}
