import type { ScopedTenantAuthz, TenantAuthz } from "@app-tour/workspace-sdk";

export type WorkspaceWizardAccessContext = {
  readonly authz: TenantAuthz | ScopedTenantAuthz;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly workspaceId: string;
};

function asTenantAuthz(authz: TenantAuthz | ScopedTenantAuthz): TenantAuthz {
  return "authz" in authz ? authz.authz : authz;
}

/**
 * Deny-by-default — wizard host must not load plugin or render fields without CASL read on workspace + plugin.
 */
export function canLoadWorkspaceWizard(ctx: WorkspaceWizardAccessContext): boolean {
  if (ctx.tenantId.trim().length === 0) {
    return false;
  }
  const rules = asTenantAuthz(ctx.authz);
  return (
    rules.canReadWorkspace(ctx.tenantId, ctx.workspaceId) &&
    rules.canReadPlugin({ tenantId: ctx.tenantId, pluginId: ctx.pluginId })
  );
}
