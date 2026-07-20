import { resolveRegisteredTenantById } from "./resolve-registered-tenant";

const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

export const WORKSPACE_TYPE_UNRESOLVED = "WORKSPACE_TYPE_UNRESOLVED";

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Postgres `tenants.workspace_type` when present; else static registry.
 * Missing tenant → fail closed (no silent `starter` — TODO-011 / PREV-AUD-013).
 *
 * `URBAN_TEST_WORKSPACE_TYPE` applies only when `NODE_ENV=test` and urban tenant.
 */
export async function resolveWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  if (process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW === "1") {
    throw new Error("INTERNAL_SERVER_ERROR");
  }
  const registered = await resolveRegisteredTenantById(tenantId);
  const override = process.env.URBAN_TEST_WORKSPACE_TYPE?.trim();
  if (
    process.env.NODE_ENV === "test" &&
    override &&
    (tenantId === URBAN_SMOKE_TENANT_ID || registered?.workspaceType === "urban")
  ) {
    return override;
  }
  if (registered?.workspaceType !== undefined && registered.workspaceType.trim().length > 0) {
    return registered.workspaceType;
  }
  throw new Error(`${WORKSPACE_TYPE_UNRESOLVED}:${tenantId}`);
}
