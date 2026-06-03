import type { ScopedTenantAuthz } from "@app-tour/workspace-sdk";

export type AppSession = {
  readonly authz: ScopedTenantAuthz;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly pluginId: string;
};
