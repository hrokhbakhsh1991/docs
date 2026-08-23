import { WORKSPACE_DEV_SMOKE_TENANT_BINDINGS } from "./workspace-dev-bootstrap-bindings.generated";

export type WorkspaceDevSmokeTenantBinding = (typeof WORKSPACE_DEV_SMOKE_TENANT_BINDINGS)[number];

export function resolveWorkspaceDevSmokeTenant(
  workspaceId: string
): WorkspaceDevSmokeTenantBinding {
  const binding = WORKSPACE_DEV_SMOKE_TENANT_BINDINGS.find(
    (entry) => entry.workspaceId === workspaceId
  );
  if (binding === undefined) {
    throw new Error(`WORKSPACE_DEV_SMOKE_TENANT_NOT_FOUND:${workspaceId}`);
  }
  return binding;
}

export function resolveWorkspaceDevSmokeTenantByTenantId(
  tenantId: string
): WorkspaceDevSmokeTenantBinding | null {
  return WORKSPACE_DEV_SMOKE_TENANT_BINDINGS.find((entry) => entry.tenantId === tenantId) ?? null;
}

const denaliSmokeBinding = resolveWorkspaceDevSmokeTenant("denali");
const urbanSmokeBinding = resolveWorkspaceDevSmokeTenant("urban");

/** Stable re-exports for host callers — sourced from manifest devBootstrap.smokeTenant. */
export const DENALI_SMOKE_TENANT_ID = denaliSmokeBinding.tenantId;
export const DENALI_SMOKE_SUBDOMAIN = denaliSmokeBinding.subdomain;
export const URBAN_SMOKE_TENANT_ID = urbanSmokeBinding.tenantId;
export const URBAN_SMOKE_SUBDOMAIN = urbanSmokeBinding.subdomain;
