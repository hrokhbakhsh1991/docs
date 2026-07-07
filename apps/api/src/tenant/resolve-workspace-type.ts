import { resolveRegisteredTenantById } from "./resolve-registered-tenant";

const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

/**
 * Loads workspace_type for validation-time plugin resolution (5.2).
 * Postgres `tenants.workspace_type` when present; else static registry; else starter.
 * Operator smoke (`…000014`) uses registry `denali` — see DEC-P11-001 (Phase 11.0).
 *
 * `URBAN_TEST_WORKSPACE_TYPE` applies only to urban tenants (dual-smoke matrix safe).
 */
export async function resolveWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  if (process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW === "1") {
    throw new Error("INTERNAL_SERVER_ERROR");
  }
  const registered = await resolveRegisteredTenantById(tenantId);
  const override = process.env.URBAN_TEST_WORKSPACE_TYPE?.trim();
  if (
    override &&
    (tenantId === URBAN_SMOKE_TENANT_ID || registered?.workspaceType === "urban")
  ) {
    return override;
  }
  return registered?.workspaceType ?? "starter";
}
