import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

export class SettingsWorkspaceForbiddenError extends Error {
  readonly code = "SETTINGS_WORKSPACE_FORBIDDEN" as const;

  constructor() {
    super("SETTINGS_WORKSPACE_FORBIDDEN");
    this.name = "SettingsWorkspaceForbiddenError";
  }
}

export async function isUrbanOperatorSettingsWorkspace(tenantId: string): Promise<boolean> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  return workspaceType === "urban";
}

export async function assertDenaliOperatorSettingsWorkspace(tenantId: string): Promise<void> {
  if (await isUrbanOperatorSettingsWorkspace(tenantId)) {
    throw new SettingsWorkspaceForbiddenError();
  }
}
