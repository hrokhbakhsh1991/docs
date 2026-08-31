import { resolveRegisteredTenantById } from "./resolve-registered-tenant";
import { resolveWorkspaceDevSmokeTenantByTenantId } from "../settings/resolve-workspace-dev-smoke-tenant";

export const WORKSPACE_TYPE_UNRESOLVED = "WORKSPACE_TYPE_UNRESOLVED";

/** True when `resolveWorkspaceTypeForTenant` failed closed for an unregistered tenant. */
export function isWorkspaceTypeUnresolvedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === WORKSPACE_TYPE_UNRESOLVED ||
      error.message.startsWith(`${WORKSPACE_TYPE_UNRESOLVED}:`))
  );
}

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Postgres `tenants.workspace_type` when present; else static registry.
 * Missing tenant → fail closed (no silent `starter` — PREV-AUD-013 / PREV-AUD-013).
 *
 * `URBAN_TEST_WORKSPACE_TYPE` applies only when `NODE_ENV=test` and urban tenant.
 */
export async function resolveWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  if (process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW === "1") {
    throw new Error("INTERNAL_SERVER_ERROR");
  }
  const registered = await resolveRegisteredTenantById(tenantId);
  const override = process.env.URBAN_TEST_WORKSPACE_TYPE?.trim();
  const smokeBinding = resolveWorkspaceDevSmokeTenantByTenantId(tenantId);
  if (
    process.env.NODE_ENV === "test" &&
    override &&
    (smokeBinding?.workspaceId === override || registered?.workspaceType === override)
  ) {
    return override;
  }
  if (registered?.workspaceType !== undefined && registered.workspaceType.trim().length > 0) {
    return registered.workspaceType;
  }
  throw new Error(`${WORKSPACE_TYPE_UNRESOLVED}:${tenantId}`);
}
