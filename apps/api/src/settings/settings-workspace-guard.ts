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

/** Urban may only access wizard_template tenant config — all other settings config keys stay Denali-only. */
export async function assertSettingsConfigWorkspaceAllowed(
  tenantId: string,
  configKey: string
): Promise<void> {
  if (await isUrbanOperatorSettingsWorkspace(tenantId)) {
    if (configKey !== "wizard_template") {
      throw new SettingsWorkspaceForbiddenError();
    }
  }
}
