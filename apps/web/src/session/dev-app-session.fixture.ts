/**
 * Test-only fixtures — do not import from production app code.
 */
import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
  type ScopedTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type { WorkspaceThemeSubject } from "@app-tour/workspace-sdk";

import { listBootstrapWorkspacePlugins } from "@/bootstrap/workspace-plugins";

import type { AppSession } from "./app-session";

export const DEV_WORKSPACE_ID = "default";
export const DEV_TENANT_ID = "dev-tenant-local";

const bootstrapPlugin = listBootstrapWorkspacePlugins()[0]!;

export const devScopedAuthz: ScopedTenantAuthz = createTenantAuthz({
  userId: "dev-user",
  tenantId: DEV_TENANT_ID,
  role: "admin",
  status: "ACTIVE",
  workspaceId: DEV_WORKSPACE_ID,
});

export const devWorkspaceThemeAccess: WorkspaceThemeSubject = bindWorkspaceThemeAccess(
  devScopedAuthz.context,
  {
    workspaceId: DEV_WORKSPACE_ID,
    pluginId: bootstrapPlugin.id,
  },
);

export const devAppSession: AppSession = {
  authz: devScopedAuthz,
  tenantId: DEV_TENANT_ID,
  workspaceId: DEV_WORKSPACE_ID,
  pluginId: bootstrapPlugin.id,
};
