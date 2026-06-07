import { resolveRegisteredTenantById } from "./resolve-registered-tenant";

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Postgres `tenants.workspace_type` when present; else static registry; else starter.
 */
export async function resolveWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  if (process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW === "1") {
    throw new Error("INTERNAL_SERVER_ERROR");
  }
  const override = process.env.URBAN_TEST_WORKSPACE_TYPE?.trim();
  if (override) {
    return override;
  }
  const registered = await resolveRegisteredTenantById(tenantId);
  return registered?.workspaceType ?? "starter";
}
